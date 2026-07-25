import type {
  Claim,
  Coverage,
  Dossier,
  EvidenceItem,
  Profile,
  Requirement,
} from '@xyndicate/assay-core'
import {
  DossierSchema,
  ProfileSchema,
  newClaimId,
  newEvidenceId,
  policyGate,
  computeStrength,
} from '@xyndicate/assay-core'
import {
  createModeFetcher,
  decomposeJd,
  extractProfile,
  computeCoverage,
  type Fetcher,
  type ModelRouter,
} from '@xyndicate/providers'
import { ingestDocument } from '@xyndicate/providers'
import {
  writeArtifact,
  generateInterviewQuestions,
  evaluateInterviewAnswer,
  buildInterviewArtifact,
} from '@xyndicate/renderers'
import { gradeArtifact, APPROVED_HEADINGS } from '@xyndicate/tribunal'
import { pdfToLines, reconstruct } from '@xyndicate/renderers'
import { RegistryClient } from '@xyndicate/contracts'
import { buildVerifyBundle } from '@xyndicate/receipts'
import type { Address, Hex } from 'viem'
import type { ServerConfig } from './config'
import type { Store } from './store'
import { parseVersionRef, versionRef } from './store'
import { sealedExhibitFor } from './sealedExhibits'
import { decodeUpload, signFileToken } from './util'

export interface PipelineCtx {
  store: Store
  router: ModelRouter
  fetcher: Fetcher
  cfg: ServerConfig
}

export interface ToolResult {
  summary: string
  data: Record<string, unknown>
  refused?: boolean
}

// ── shared helpers ──────────────────────────────────────────────────────────

// Optional fields carry `| undefined` so these types accept the MCP SDK's zod-inferred args
// (ShapeOutput makes optionals `T | undefined`) under exactOptionalPropertyTypes.
interface UploadArgs {
  resumeText?: string | undefined
  resumeB64?: string | undefined
  filename?: string | undefined
}

async function ingestUpload(
  args: UploadArgs,
): Promise<{ ok: boolean; text: string; bytes: Uint8Array; kind: string; gap?: string }> {
  const { bytes, wasB64 } = decodeUpload({ text: args.resumeText, textB64: args.resumeB64 })
  const filename = args.filename ?? (wasB64 ? 'resume.pdf' : 'resume.txt')
  const res = await ingestDocument(filename, bytes)
  return {
    ok: res.ok,
    text: res.contentText,
    bytes,
    kind: res.meta.kind,
    ...(res.gap ? { gap: res.gap } : {}),
  }
}

// Provided claim strings become confirmed claims backed by one attestation evidence item — the
// agent is asserting these on the user's behalf, which is what "confirmed" means in Assay's model.
function claimsFromStrings(texts: string[], evidence: EvidenceItem): Claim[] {
  return texts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => {
      const base: Claim = {
        id: newClaimId(),
        text,
        evidenceIds: [evidence.id],
        strength: 'attested',
        status: 'confirmed',
        numericFacts: [],
        tags: [],
      }
      return { ...base, strength: computeStrength(base, [evidence]) }
    })
}

function attestation(text: string, label = 'Agent-provided evidence'): EvidenceItem {
  return {
    id: newEvidenceId(),
    kind: 'attestation',
    label,
    sourceRef: 'agent-input',
    contentText: text,
    addedAt: new Date().toISOString(),
  }
}

function coerceProfile(raw: unknown): Profile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return ProfileSchema.parse({
    fullName: typeof r['fullName'] === 'string' ? r['fullName'] : 'Candidate',
    timezone: typeof r['timezone'] === 'string' ? r['timezone'] : 'UTC',
    ...(r['headline'] ? { headline: r['headline'] } : {}),
    ...(r['contact'] ? { contact: r['contact'] } : {}),
    ...(Array.isArray(r['experiences']) ? { experiences: r['experiences'] } : {}),
    ...(Array.isArray(r['skills']) ? { skills: r['skills'] } : {}),
  })
}

export function signedLink(cfg: ServerConfig, fileId: string): string {
  const tok = signFileToken(cfg.signingSecret, fileId, Date.now() + cfg.fileTtlMs)
  return `${cfg.baseUrl}/f/${fileId}?tok=${tok}`
}

// Deterministic ATS format-law analysis of an uploaded résumé (no LLM). Reuses the tribunal's exact
// APPROVED_HEADINGS list so what we flag here matches what the Standard grades.
export function analyzeAtsFormat(text: string): {
  findings: Array<{ code: string; detail: string }>
  headingsFound: string[]
  sectionsMissing: string[]
} {
  const findings: Array<{ code: string; detail: string }> = []
  const lines = text.split('\n').map((l) => l.trim())
  const headingsFound: string[] = []
  for (const line of lines) {
    if (!line || line.length > 32) continue
    const upper = line.toUpperCase()
    // A heading-ish line: short, mostly letters, no sentence punctuation.
    if (
      /^[A-Z][A-Za-z &/]+$/.test(line) &&
      line === line.toUpperCase() &&
      line.split(' ').length <= 3
    ) {
      headingsFound.push(upper)
      if (!APPROVED_HEADINGS.has(upper))
        findings.push({
          code: 'FORMAT_HEADING',
          detail: `non-standard section heading "${line}" — ATS parsers key off SUMMARY / EXPERIENCE / EDUCATION / SKILLS / CERTIFICATIONS`,
        })
    }
  }
  const required = ['EXPERIENCE', 'SKILLS']
  const sectionsMissing = required.filter((h) => !headingsFound.includes(h))
  for (const m of sectionsMissing)
    findings.push({
      code: 'FORMAT_MISSING_SECTION',
      detail: `no recognizable ${m} section heading — an ATS may fail to segment your résumé`,
    })
  if (/\t/.test(text) || /\|\s*\w+\s*\|/.test(text))
    findings.push({
      code: 'FORMAT_TABLE',
      detail:
        'tab/pipe-delimited columns detected — tables and columns frequently scramble in ATS parsing',
    })
  if (!/@/.test(text))
    findings.push({
      code: 'FORMAT_NO_CONTACT',
      detail: 'no email address detected in the résumé text',
    })
  return { findings, headingsFound, sectionsMissing }
}

// ── 1) asy_ats_scan — the traction wedge ─────────────────────────────────────
export async function atsScan(
  ctx: PipelineCtx,
  args: UploadArgs & { jd?: string | undefined },
): Promise<ToolResult> {
  const ing = await ingestUpload(args)
  if (!ing.ok || !ing.text) {
    return {
      summary: 'Could not read that résumé — supply plain text or a valid PDF/DOCX (base64).',
      data: { ok: false, gap: ing.gap ?? 'INGEST_EMPTY' },
      refused: true,
    }
  }
  ctx.store.recordEvent('ats_scan', { kind: ing.kind, chars: ing.text.length })

  const format = analyzeAtsFormat(ing.text)

  // Parse-back: only meaningful for PDFs — show what a machine actually extracts.
  let parseBack: { name: string; email: string; experiences: number; skills: string[] } | undefined
  if (ing.kind === 'pdf') {
    try {
      const lines = await pdfToLines(ing.bytes)
      const parsed = reconstruct(lines)
      parseBack = {
        name: parsed.name,
        email: parsed.email,
        experiences: parsed.experiences.length,
        skills: parsed.skills,
      }
    } catch {
      /* parse-back is best-effort; format findings still ship */
    }
  }

  // JD keyword coverage (informational — we report coverage, we never stuff keywords).
  let jdCoverage: { must: number; nice: number; requirements: number } | undefined
  if (args.jd && args.jd.trim()) {
    const { requirements } = await decomposeJd({ jdText: args.jd, router: ctx.router })
    const body = ing.text.toLowerCase()
    const tally = (kind: 'must' | 'nice'): number => {
      const reqs = requirements.filter((r) => r.kind === kind)
      if (reqs.length === 0) return 100
      const covered = reqs.filter((r) => r.keywords.some((k) => body.includes(k.toLowerCase())))
      return Math.round((covered.length / reqs.length) * 100)
    }
    jdCoverage = { must: tally('must'), nice: tally('nice'), requirements: requirements.length }
  }

  const parts = [`${format.findings.length} format finding(s)`]
  if (parseBack)
    parts.push(
      `parse-back read name="${parseBack.name || '—'}", email="${parseBack.email || '—'}", ${parseBack.experiences} role(s)`,
    )
  if (jdCoverage) parts.push(`JD coverage: ${jdCoverage.must}% must / ${jdCoverage.nice}% nice`)
  return {
    summary: `ATS scan complete — ${parts.join('; ')}.`,
    data: {
      ok: true,
      format,
      ...(parseBack ? { parseBack } : {}),
      ...(jdCoverage ? { jdCoverage } : {}),
    },
  }
}

// ── 2) asy_claim_audit ───────────────────────────────────────────────────────
export async function claimAudit(
  ctx: PipelineCtx,
  args: UploadArgs & { claims?: string[] | undefined },
): Promise<ToolResult> {
  let text = ''
  if (args.claims && args.claims.length) text = args.claims.join('\n')
  else {
    const ing = await ingestUpload(args)
    if (!ing.ok)
      return {
        summary: 'Could not read that input — supply résumé text or a list of claims.',
        data: { ok: false },
        refused: true,
      }
    text = ing.text
  }
  const { claims } = await extractProfile({
    documents: [{ label: 'audit-input', contentText: text }],
    router: ctx.router,
  })

  const audited = claims.map((c) => {
    const numberUnverified = c.status === 'needs_confirmation'
    const vague = c.numericFacts.length === 0 && !/\b\d/.test(c.text)
    const status = numberUnverified ? 'UNSUPPORTED_NUMBER' : vague ? 'VAGUE' : 'SUPPORTED'
    const issue = numberUnverified
      ? 'cites a figure that does not appear in the source — confirm it or drop the number'
      : vague
        ? 'no quantified outcome — add a metric an interviewer can probe'
        : 'traces to the source text'
    return { text: c.text, status, issue }
  })
  const weak = audited.filter((a) => a.status !== 'SUPPORTED')
  const repairBrief = weak.length
    ? `Tighten ${weak.length} claim(s): ${weak.map((w) => `“${w.text.slice(0, 60)}…” (${w.status})`).join('; ')}`
    : 'Every claim traces to the source — nothing to repair.'
  ctx.store.recordEvent('claim_audit', { claims: claims.length, weak: weak.length })
  return {
    summary: `Audited ${claims.length} claim(s): ${weak.length} need work.`,
    data: { ok: true, audited, repairBrief },
  }
}

// ── 3) asy_fit_brief ─────────────────────────────────────────────────────────
export async function fitBrief(
  ctx: PipelineCtx,
  args: { jd: string; profile?: unknown; claims?: string[] | undefined },
): Promise<ToolResult> {
  if (!args.jd || !args.jd.trim())
    return {
      summary: 'Provide the job description (jd) to map fit.',
      data: { ok: false },
      refused: true,
    }
  const { requirements } = await decomposeJd({ jdText: args.jd, router: ctx.router })
  const ev = attestation((args.claims ?? []).join('\n') || 'profile', 'Agent-provided profile')
  const claims = claimsFromStrings(args.claims ?? [], ev)
  const coverage: Coverage[] = computeCoverage(requirements, claims)
  const reqById = new Map(requirements.map((r) => [r.id, r]))
  const map = coverage.map((c) => ({
    requirement: reqById.get(c.requirementId)?.text ?? c.requirementId,
    status: c.status,
    note: c.note,
  }))
  const counts = { strong: 0, partial: 0, confirm: 0, missing: 0 } as Record<
    Coverage['status'],
    number
  >
  for (const c of coverage) counts[c.status] += 1
  ctx.store.recordEvent('fit_brief', counts)
  return {
    summary: `Fit brief: ${counts.strong} strong · ${counts.partial} partial · ${counts.confirm} to confirm · ${counts.missing} missing (of ${requirements.length}).`,
    data: { ok: true, coverage: map, counts },
  }
}

// ── 4/5/6) evidence-constrained writers ──────────────────────────────────────
type WriterKind = 'cover_letter' | 'story_bank' | 'resume_ats'

async function ephemeralDossier(
  ctx: PipelineCtx,
  args: {
    dossierId?: string | undefined
    profile?: unknown
    claims?: string[] | undefined
    evidence?: string | undefined
  },
): Promise<Dossier | undefined> {
  if (args.dossierId) return ctx.store.getDossier(args.dossierId)
  const hasMaterial = (args.claims && args.claims.length) || (args.evidence && args.evidence.trim())
  if (!hasMaterial) return undefined
  const profile = coerceProfile(args.profile)
  const ev = attestation(args.evidence ?? (args.claims ?? []).join('\n'))
  const claims = claimsFromStrings(args.claims ?? [], ev)
  return DossierSchema.parse({ profile, tz: profile.timezone, evidence: [ev], claims })
}

async function writerTool(
  ctx: PipelineCtx,
  kind: WriterKind,
  label: string,
  args: {
    dossierId?: string | undefined
    profile?: unknown
    claims?: string[] | undefined
    evidence?: string | undefined
    jd?: string | undefined
  },
): Promise<ToolResult> {
  const dossier = await ephemeralDossier(ctx, args)
  if (!dossier) {
    return {
      summary: `I won't write a ${label} from thin air. Provide claims + evidence (or a dossierId), or run asy_create_dossier_job first — Assay never writes a sentence it can't trace.`,
      data: { ok: false, reason: 'NO_EVIDENCE' },
      refused: true,
    }
  }
  const written = await writeArtifact({ kind, dossier, router: ctx.router })
  const artifact = { id: kind, kind, sentences: written.sentences, meta: {} }
  const report = await gradeArtifact(dossier, artifact, {
    router: ctx.router,
    fetcher: ctx.fetcher,
    fileExists: () => true,
  })
  ctx.store.recordEvent(
    kind,
    { sentences: written.sentences.length, questions: written.questions.length, pass: report.pass },
    dossier.id,
  )
  return {
    summary: `${label}: ${written.sentences.length} evidence-cited sentence(s), ${written.questions.length} open question(s); tribunal ${report.pass ? 'PASS' : 'needs work'}.`,
    data: {
      ok: true,
      sentences: written.sentences,
      questions: written.questions,
      tribunal: {
        pass: report.pass,
        hardPass: report.hardPass,
        craftMean: report.craftWeightedMean,
        findings: report.hard.filter((h) => h.status === 'fail').flatMap((h) => h.findings),
      },
    },
  }
}

export const coverLetter = (
  ctx: PipelineCtx,
  args: Parameters<typeof writerTool>[3],
): Promise<ToolResult> => writerTool(ctx, 'cover_letter', 'cover letter', args)
export const storyBank = (
  ctx: PipelineCtx,
  args: Parameters<typeof writerTool>[3],
): Promise<ToolResult> => writerTool(ctx, 'story_bank', 'story bank', args)
export const tailorResume = (
  ctx: PipelineCtx,
  args: Parameters<typeof writerTool>[3],
): Promise<ToolResult> => writerTool(ctx, 'resume_ats', 'tailored résumé', args)

export async function interviewPrep(
  ctx: PipelineCtx,
  args: Parameters<typeof writerTool>[3] & { answer?: string | undefined },
): Promise<ToolResult> {
  const dossier = await ephemeralDossier(ctx, args)
  if (!dossier) {
    return {
      summary: `I won't invent an interview history. Provide claims + evidence (or a dossierId) first.`,
      data: { ok: false, reason: 'NO_EVIDENCE' },
      refused: true,
    }
  }
  let coverage: Coverage[] = []
  if (args.jd?.trim()) {
    const { requirements } = await decomposeJd({ jdText: args.jd, router: ctx.router })
    dossier.brief = { jdText: args.jd, decomposed: requirements, mode: 'job', projectClaimIds: [] }
    coverage = computeCoverage(
      requirements,
      dossier.claims.filter((c) => c.status === 'confirmed'),
    )
  } else if (dossier.brief) {
    coverage = computeCoverage(
      dossier.brief.decomposed,
      dossier.claims.filter((c) => c.status === 'confirmed'),
    )
  }
  const questions = generateInterviewQuestions(dossier, coverage)
  let evaluation
  let tribunal
  if (args.answer?.trim() && questions[0]) {
    evaluation = await evaluateInterviewAnswer({
      dossier,
      question: questions[0],
      answer: args.answer,
      router: ctx.router,
    })
    const report = await gradeArtifact(dossier, buildInterviewArtifact([evaluation]), {
      router: ctx.router,
      fetcher: ctx.fetcher,
    })
    tribunal = { pass: report.pass, findings: report.hard.flatMap((h) => h.findings) }
  }
  return {
    summary: `Interview room prepared ${questions.length} question(s)${evaluation ? `; answer ${evaluation.final ? 'ready' : 'needs correction'}` : ''}.`,
    data: { ok: true, questions, ...(evaluation ? { evaluation, tribunal } : {}) },
  }
}

// ── 7) asy_create_dossier_job ────────────────────────────────────────────────
export function createDossierJob(
  ctx: PipelineCtx,
  args: UploadArgs & {
    jd?: string | undefined
    answers?: string | undefined
    variant?: 'job' | 'promotion' | 'freelance' | undefined
    dateFrom?: string | undefined
    dateTo?: string | undefined
  },
): ToolResult {
  const policy = policyGate({
    text: [args.resumeText ?? '', args.jd ?? '', args.answers ?? ''].join('\n'),
  })
  if (!policy.allowed)
    return { summary: policy.reason, data: { ok: false, code: policy.code }, refused: true }
  const job = ctx.store.createJob('dossier', args)
  ctx.store.recordEvent('dossier_job_created', { jobId: job.id })
  return {
    summary: `Dossier job queued (${job.id}). The full pipeline — extract → grade → seal — runs in the background. Poll asy_job_status, then asy_job_result.`,
    data: {
      ok: true,
      jobId: job.id,
      status: job.status,
      poll: 'asy_job_status',
      result: 'asy_job_result',
    },
  }
}

// ── 8) asy_job_status (free) ─────────────────────────────────────────────────
export function jobStatus(ctx: PipelineCtx, args: { jobId: string }): ToolResult {
  const job = ctx.store.getJob(args.jobId)
  if (!job) return { summary: `No job ${args.jobId}.`, data: { ok: false }, refused: true }
  return {
    summary: `Job ${job.id}: ${job.status}${job.error ? ` (${job.error})` : ''}.`,
    data: {
      ok: true,
      jobId: job.id,
      status: job.status,
      ...(job.error ? { error: job.error } : {}),
    },
  }
}

// ── 9) asy_job_result (free — paid at create) ────────────────────────────────
export function jobResult(ctx: PipelineCtx, args: { jobId: string }): ToolResult {
  const job = ctx.store.getJob(args.jobId)
  if (!job) return { summary: `No job ${args.jobId}.`, data: { ok: false }, refused: true }
  if (job.status !== 'done')
    return {
      summary: `Job ${job.id} is ${job.status} — not ready.`,
      data: { ok: true, status: job.status, ...(job.error ? { error: job.error } : {}) },
    }
  const result = job.result
    ? (JSON.parse(job.result) as {
        artifacts?: Array<{ id: string; kind: string; fileId: string }>
        tribunal?: unknown
        seal?: unknown
        questions?: string[]
        dossierId?: string
        portfolio?: string | null
      })
    : {}
  const links = (result.artifacts ?? []).map((a) => ({
    kind: a.kind,
    url: signedLink(ctx.cfg, a.fileId),
  }))
  // Surface the public portfolio page URL (served at /p/:slug). It was computed at create time but
  // never returned — an invisible capability (Phase 11 surfacing audit). Absolute so agents can open it.
  const portfolio =
    typeof result.portfolio === 'string' ? `${ctx.cfg.baseUrl}${result.portfolio}` : null
  return {
    summary: `Dossier ${result.dossierId ?? job.resultRef} ready — ${links.length} artifact(s), sealed via asy_verify.`,
    data: {
      ok: true,
      dossierId: result.dossierId ?? job.resultRef,
      artifacts: links,
      portfolio,
      tribunal: result.tribunal,
      seal: result.seal,
      questions: result.questions ?? [],
    },
  }
}

// ── 10) asy_verify (FREE FOREVER) ────────────────────────────────────────────
export async function verify(
  ctx: PipelineCtx,
  args: { dossierId?: string | undefined; leaf?: string | undefined },
): Promise<ToolResult> {
  let leaf = args.leaf as Hex | undefined
  let dossierId = args.dossierId
  if (!leaf && dossierId) {
    const ref = parseVersionRef(dossierId)
    const dossier = ref
      ? ctx.store.getDossierVersion(ref.dossierId, ref.version)
      : ctx.store.getDossier(dossierId)
    const salt = ctx.store.getSalt(ref ? versionRef(ref.dossierId, ref.version) : dossierId)
    if (!dossier || !salt) {
      const exhibit = sealedExhibitFor(dossierId, ctx.cfg.chainId, ctx.cfg.registry)
      if (!exhibit)
        return {
          summary: `No sealed dossier ${dossierId}.`,
          data: { ok: false, found: false },
          refused: true,
        }
      leaf = exhibit.leaf
    } else {
      const bundle = await buildVerifyBundle(dossier, {
        chainId: ctx.cfg.chainId,
        registry: ctx.cfg.registry as Address,
        salt: salt as Hex,
      })
      leaf = bundle.leaf
    }
  }
  if (!leaf)
    return {
      summary: 'Provide a dossierId or a leaf to verify.',
      data: { ok: false, found: false },
      refused: true,
    }

  const client = new RegistryClient({
    rpcUrl: rpcFor(ctx.cfg.chainId),
    chainId: ctx.cfg.chainId,
    registry: ctx.cfg.registry as Address,
  })
  let anchoredAt = 0n
  try {
    anchoredAt = await client.anchoredAt(leaf)
  } catch {
    return {
      summary: 'Registry read failed — the chain RPC is unreachable right now.',
      data: { ok: false, found: false, gap: 'chain:rpc' },
    }
  }
  const found = anchoredAt > 0n
  const explorerLink = `${explorerBase(ctx.cfg.chainId)}/address/${ctx.cfg.registry}`
  const baseId = dossierId ? (parseVersionRef(dossierId)?.dossierId ?? dossierId) : undefined
  const lineage = baseId ? ctx.store.listDossierVersions(baseId) : []
  ctx.store.recordEvent('verify', { leaf, found }, dossierId)
  return {
    summary: found
      ? `Sealed on-chain at ${new Date(Number(anchoredAt) * 1000).toISOString()}.`
      : 'Not yet anchored on-chain (seal may still be pending).',
    data: {
      ok: true,
      found,
      leaf,
      sealStatus: found
        ? 'sealed'
        : dossierId
          ? (ctx.store.getSealStatus(dossierId) ?? 'unsealed')
          : 'unknown',
      anchoredAt: found ? new Date(Number(anchoredAt) * 1000).toISOString() : null,
      chainId: ctx.cfg.chainId,
      registry: ctx.cfg.registry,
      explorerLink,
      lineage,
    },
  }
}

function rpcFor(chainId: number): string {
  return chainId === 196 ? 'https://rpc.xlayer.tech' : 'https://testrpc.xlayer.tech'
}
function explorerBase(chainId: number): string {
  return chainId === 196
    ? 'https://www.oklink.com/x-layer'
    : 'https://www.oklink.com/x-layer-testnet'
}

export function makeCtx(
  store: Store,
  router: ModelRouter,
  cfg: ServerConfig,
  fetcher?: Fetcher,
): PipelineCtx {
  return { store, router, cfg, fetcher: fetcher ?? createModeFetcher() }
}

export type { Requirement }
