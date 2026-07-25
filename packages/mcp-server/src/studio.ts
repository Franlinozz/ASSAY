import type {
  Artifact,
  Claim,
  Coverage,
  Dossier,
  EvidenceItem,
  Experience,
  Profile,
  Sentence,
} from '@xyndicate/assay-core'
import {
  DossierSchema,
  ProfileSchema,
  newDossierId,
  newClaimId,
  newEvidenceId,
  computeStrength,
  tierExplanation,
} from '@xyndicate/assay-core'
import {
  decomposeJd,
  computeCoverage,
  extractProfile,
  ingestDocument,
  resetFakeRepairDemo,
  type Fetcher,
  type ModelRouter,
} from '@xyndicate/providers'
import {
  forgeDossier,
  writeArtifact,
  renderArtifactHtml,
  parseBackFromBuffer,
  generateInterviewQuestions,
  evaluateInterviewAnswer,
  buildInterviewArtifact,
  type RenderBundle,
} from '@xyndicate/renderers'
import { gradeArtifact, gradeWithRepair, summarize, type TribunalReport } from '@xyndicate/tribunal'
import { buildVerifyBundle, newSalt } from '@xyndicate/receipts'
import type { Address, Hex } from 'viem'
import type { ServerConfig } from './config'
import { versionRef, type Store } from './store'
import { signedLink } from './pipelines'
import { signCapabilityToken, decodeUpload } from './util'

// The Studio: the interactive, browser-driven dossier flow. It reuses the SAME packages the paid
// MCP tools use (ingest, extract, decompose, coverage, forge, tribunal repair loop, receipts) —
// the human in the Studio and the agent at the endpoint share one engine (ASSAY.md). Every slow
// step (extract, forge) is a job (gotcha #10) that streams a "role · action" event feed.

export interface StudioDeps {
  store: Store
  router: ModelRouter
  fetcher: Fetcher
  cfg: ServerConfig
  toPdf: (html: string) => Promise<Uint8Array>
  // True when toPdf is the real headless-chromium renderer (prod, or forced in e2e). The ATS
  // parse-back can only re-parse a real PDF; against the dev stub it stays honestly 'pending'.
  realPdf: boolean
  sampleContrast?: (html: string) => Promise<number>
}

const WRITER_KINDS = new Set([
  'resume_ats',
  'resume_designed',
  'cover_letter',
  'story_bank',
  'promotion_narrative',
  'promotion_memo',
  'manager_one_pager',
  'capability_statement',
  'case_studies',
  'proposal_letter',
])

function explorerBase(chainId: number): string {
  return chainId === 196
    ? 'https://www.oklink.com/x-layer'
    : 'https://www.oklink.com/x-layer-testnet'
}

// ── create ───────────────────────────────────────────────────────────────────
export function createDossier(
  store: Store,
  cfg: ServerConfig,
  input: { name: string; timezone: string; email?: string },
): { id: string; token: string; url: string } {
  const profile = ProfileSchema.parse({
    fullName: input.name.trim() || 'Candidate',
    timezone: input.timezone || 'UTC',
    ...(input.email ? { contact: { email: input.email, links: [] } } : {}),
  })
  const dossier: Dossier = DossierSchema.parse({
    id: newDossierId(),
    profile,
    tz: profile.timezone,
    evidence: [],
    claims: [],
  })
  store.createStudioDossier(dossier, input.email ? { email: input.email } : {})
  store.recordStudioEvent(dossier.id, 'Studio', 'dossier opened — bring your evidence')
  const token = signCapabilityToken(cfg.signingSecret, dossier.id)
  return { id: dossier.id, token, url: `/d/${dossier.id}?t=${token}` }
}

// ── merge helpers (later ingests enrich the same dossier) ─────────────────────
function mergeExperiences(existing: Experience[], incoming: Experience[]): Experience[] {
  const key = (e: Experience): string => `${e.org}|${e.title}|${e.startYm}`.toLowerCase()
  const seen = new Set(existing.map(key))
  const out = [...existing]
  for (const e of incoming)
    if (!seen.has(key(e))) {
      seen.add(key(e))
      out.push(e)
    }
  return out
}

function mergeProfile(existing: Profile, extracted: Profile): Profile {
  return ProfileSchema.parse({
    fullName: existing.fullName || extracted.fullName || 'Candidate',
    ...(extracted.headline || existing.headline
      ? { headline: extracted.headline ?? existing.headline }
      : {}),
    contact: {
      ...(existing.contact.email
        ? { email: existing.contact.email }
        : extracted.contact.email
          ? { email: extracted.contact.email }
          : {}),
      links: [...new Set([...existing.contact.links, ...extracted.contact.links])],
    },
    timezone: existing.timezone,
    experiences: mergeExperiences(existing.experiences, extracted.experiences),
    education: existing.education.length ? existing.education : extracted.education,
    certifications: existing.certifications.length
      ? existing.certifications
      : extracted.certifications,
    skills: [...new Set([...existing.skills, ...extracted.skills])],
  })
}

// ── ingest + extract (JOB) ────────────────────────────────────────────────────
export interface StudioExtractInput {
  dossierId: string
  kind: 'document' | 'answers' | 'links'
  filename?: string
  contentB64?: string
  text?: string
  answers?: string
  links?: string[]
}

export async function runStudioExtract(deps: StudioDeps, input: StudioExtractInput): Promise<void> {
  const { store, router, fetcher } = deps
  const id = input.dossierId
  const dossier = store.getDossier(id)
  if (!dossier) throw new Error('dossier not found')

  const documents: Array<{ label: string; contentText: string; sourceRef?: string }> = []
  const linkEvidence: EvidenceItem[] = []

  if (input.kind === 'document') {
    const { bytes, wasB64 } = decodeUpload({ text: input.text, textB64: input.contentB64 })
    const filename = input.filename ?? (wasB64 ? 'document.pdf' : 'notes.txt')
    store.recordStudioEvent(id, 'Extractor', `reading ${filename}`)
    const ing = await ingestDocument(filename, bytes)
    if (!ing.ok || !ing.contentText.trim()) {
      store.recordStudioEvent(id, 'Extractor', `could not read ${filename} — try plain text`)
      throw new Error(ing.gap ?? 'INGEST_EMPTY')
    }
    documents.push({ label: filename, contentText: ing.contentText })
  } else if (input.kind === 'answers') {
    store.recordStudioEvent(id, 'Extractor', 'reading your guided answers')
  } else if (input.kind === 'links') {
    for (const url of input.links ?? []) {
      store.recordStudioEvent(id, 'Fetcher', `checking ${hostOf(url)} is live`)
      const r = await fetcher.fetch(url)
      if (r.ok) {
        const ev: EvidenceItem = {
          id: newEvidenceId(),
          kind: 'link',
          label: r.title ? `${r.title} (${hostOf(url)})` : hostOf(url),
          sourceRef: url,
          contentText: r.textExcerpt ?? r.title ?? url,
          fetchedOk: true,
          addedAt: new Date().toISOString(),
        }
        linkEvidence.push(ev)
        documents.push({ label: ev.label, contentText: ev.contentText ?? '', sourceRef: url })
        store.recordStudioEvent(id, 'Fetcher', `${hostOf(url)} resolved — earns a Linked tier`)
      } else {
        store.recordStudioEvent(id, 'Fetcher', `${hostOf(url)} is dead — no Linked tier granted`)
      }
    }
  }

  store.recordStudioEvent(id, 'Extractor', 'lifting experiences, skills and claims')
  const extracted = await extractProfile({
    documents,
    ...(input.kind === 'answers' && input.answers ? { answers: input.answers } : {}),
    router,
    dossierId: id,
  })

  // Merge into the evolving dossier.
  const mergedProfile = mergeProfile(dossier.profile, extracted.profile)
  const existingClaimTexts = new Set(dossier.claims.map((c) => normText(c.text)))
  const newClaims = extracted.claims.filter((c) => !existingClaimTexts.has(normText(c.text)))
  const allEvidence = [...dossier.evidence, ...linkEvidence, ...extracted.evidence]

  // Re-strength any link-backed claims against the full evidence set.
  const restrengthed = newClaims.map((c) => ({ ...c, strength: computeStrength(c, allEvidence) }))

  const next: Dossier = DossierSchema.parse({
    ...dossier,
    profile: mergedProfile,
    evidence: allEvidence,
    claims: [...dossier.claims, ...restrengthed],
  })
  store.saveDossier(next)
  const needs = restrengthed.filter((c) => c.status === 'needs_confirmation').length
  store.recordStudioEvent(
    id,
    'Extractor',
    `found ${restrengthed.length} claim${restrengthed.length === 1 ? '' : 's'}${needs ? ` · ${needs} need${needs === 1 ? 's' : ''} a number confirmed` : ''}`,
  )
}

// ── confirm / edit / reject a claim ───────────────────────────────────────────
export function updateClaim(
  store: Store,
  dossierId: string,
  claimId: string,
  action: 'confirm' | 'reject' | 'edit',
  patch: { text?: string; answer?: string } = {},
): { ok: boolean; claim?: Claim } {
  const dossier = store.getDossier(dossierId)
  if (!dossier) return { ok: false }
  const idx = dossier.claims.findIndex((c) => c.id === claimId)
  if (idx < 0) return { ok: false }
  const claim = { ...dossier.claims[idx]! }

  if (action === 'reject') {
    claim.status = 'rejected'
  } else if (action === 'edit') {
    if (patch.text) claim.text = patch.text.trim()
    // An edit that supplies the missing figure's source confirms it too.
    if (patch.answer) claim.status = 'confirmed'
  } else {
    // confirm — including answering a needs_confirmation question. The answer becomes an
    // attestation the claim now rests on (the number is on the record).
    claim.status = 'confirmed'
    if (patch.answer && patch.answer.trim()) {
      const att: EvidenceItem = {
        id: newEvidenceId(),
        kind: 'attestation',
        label: 'Confirmed by candidate',
        sourceRef: 'studio-confirm',
        contentText: patch.answer.trim(),
        addedAt: new Date().toISOString(),
      }
      dossier.evidence.push(att)
      claim.evidenceIds = [...new Set([...claim.evidenceIds, att.id])]
    }
  }
  claim.strength = computeStrength(claim, dossier.evidence)
  dossier.claims[idx] = claim
  store.saveDossier(DossierSchema.parse(dossier))
  store.recordStudioEvent(
    dossierId,
    'Ledger',
    `claim ${action === 'reject' ? 'set aside' : action === 'edit' ? 'edited' : 'confirmed'}`,
  )
  return { ok: true, claim }
}

// ── brief (inline) ────────────────────────────────────────────────────────────
export async function runBrief(
  deps: StudioDeps,
  dossierId: string,
  input:
    | string
    | {
        text: string
        mode?: 'job' | 'promotion' | 'freelance'
        dateFrom?: string
        dateTo?: string
        projectClaimIds?: string[]
      },
): Promise<{ requirements: unknown[]; coverage: unknown[] }> {
  const { store, router } = deps
  const dossier = store.getDossier(dossierId)
  if (!dossier) throw new Error('dossier not found')
  const opts = typeof input === 'string' ? { text: input, mode: 'job' as const } : input
  const mode = opts.mode ?? 'job'
  const jd = opts.text
  store.recordStudioEvent(dossierId, 'Role Lab', 'decomposing the brief into requirements')
  const { requirements } = await decomposeJd({ jdText: jd, router, dossierId })
  const confirmed = dossier.claims.filter((c) => c.status === 'confirmed')
  const coverage = computeCoverage(requirements, confirmed)
  const next: Dossier = DossierSchema.parse({
    ...dossier,
    variant: mode,
    claims: dossier.claims.map((c) =>
      mode === 'freelance' && opts.projectClaimIds?.includes(c.id)
        ? { ...c, tags: [...new Set([...c.tags, 'project'])] }
        : c,
    ),
    brief: {
      jdText: jd,
      decomposed: requirements,
      mode,
      projectClaimIds: mode === 'freelance' ? (opts.projectClaimIds ?? []) : [],
      ...(opts.dateFrom ? { dateFrom: opts.dateFrom } : {}),
      ...(opts.dateTo ? { dateTo: opts.dateTo } : {}),
    },
  })
  store.saveDossier(next)
  store.setStage(dossierId, 'brief')
  const missing = coverage.filter((c) => c.status === 'missing').length
  store.recordStudioEvent(
    dossierId,
    'Role Lab',
    `mapped ${coverage.length} requirement${coverage.length === 1 ? '' : 's'}${missing ? ` · ${missing} honestly missing` : ''}`,
  )
  const reqById = new Map(requirements.map((r) => [r.id, r]))
  return {
    requirements: requirements.map((r) => ({ id: r.id, text: r.text, kind: r.kind })),
    coverage: coverage.map((c) => ({
      requirement: reqById.get(c.requirementId)?.text ?? c.requirementId,
      kind: reqById.get(c.requirementId)?.kind ?? 'nice',
      status: c.status,
      note: c.note,
      claimIds: c.claimIds,
    })),
  }
}

// ── interview room (question generation + one bounded critic call per answer) ────────────────
export function prepareInterview(
  deps: StudioDeps,
  dossierId: string,
): { questions: Dossier['interview']['questions'] } {
  const dossier = deps.store.getDossier(dossierId)
  if (!dossier) throw new Error('dossier not found')
  const confirmed = dossier.claims.filter((c) => c.status === 'confirmed')
  const coverage = dossier.brief ? computeCoverage(dossier.brief.decomposed, confirmed) : []
  const questions = generateInterviewQuestions(dossier, coverage)
  const next = DossierSchema.parse({
    ...dossier,
    interview: { ...dossier.interview, questions },
  })
  deps.store.saveDossier(next)
  deps.store.recordStudioEvent(
    dossierId,
    'Interview Room',
    `prepared ${questions.length} evidence-grounded questions`,
  )
  return { questions }
}

export async function submitInterviewAnswer(
  deps: StudioDeps,
  dossierId: string,
  questionId: string,
  answer: string,
): Promise<Record<string, unknown>> {
  const dossier = deps.store.getDossier(dossierId)
  if (!dossier) throw new Error('dossier not found')
  const question = dossier.interview.questions.find((q) => q.id === questionId)
  if (!question) throw new Error('interview question not found')
  const evaluation = await evaluateInterviewAnswer({
    dossier,
    question,
    answer,
    router: deps.router,
  })
  const evaluations = [
    ...dossier.interview.evaluations.filter((e) => e.questionId !== questionId),
    evaluation,
  ]
  const artifact = buildInterviewArtifact(evaluations)
  const report = await gradeArtifact(dossier, artifact, {
    router: deps.router,
    fetcher: deps.fetcher,
    fileExists: () => true,
  })
  const next = DossierSchema.parse({
    ...dossier,
    interview: { ...dossier.interview, evaluations },
    artifacts: [...dossier.artifacts.filter((a) => a.kind !== 'interview_evaluation'), artifact],
    tribunalReports: [
      ...dossier.tribunalReports.filter((r) => r.artifactId !== artifact.id),
      {
        artifactId: artifact.id,
        standardVersion: report.standardVersion,
        passed: report.pass,
        hardFindings: report.hard
          .filter((h) => h.status === 'fail')
          .flatMap((h) => h.findings.map((f) => ({ code: f.code, detail: f.detail }))),
        createdAt: report.createdAt,
      },
    ],
  })
  deps.store.saveDossier(next)
  deps.store.recordStudioEvent(
    dossierId,
    'Interview Critic',
    evaluation.final
      ? 'answer passed STAR + ledger checks'
      : 'answer needs a correction before it is final',
  )
  return { evaluation, tribunal: serializeReport(report) }
}

// ── forge (JOB) ────────────────────────────────────────────────────────────────
export async function runStudioForge(
  deps: StudioDeps,
  input: { dossierId: string; selected?: string[] },
): Promise<void> {
  const { store, router, fetcher, cfg, toPdf } = deps
  const id = input.dossierId
  const dossier = store.getDossier(id)
  if (!dossier) throw new Error('dossier not found')

  const confirmed = dossier.claims.filter((c) => c.status === 'confirmed')
  if (confirmed.length === 0) throw new Error('no confirmed claims to forge from')

  // e2e repair-demo: give this forge its own first-draft fail (no-op outside fake demo mode).
  resetFakeRepairDemo()

  // Forge over ONLY confirmed claims (the claim gate never sees unconfirmed ones).
  const forgeDossierObj: Dossier = DossierSchema.parse({ ...dossier, claims: confirmed })
  const coverage: Coverage[] = dossier.brief
    ? computeCoverage(dossier.brief.decomposed, confirmed)
    : []

  store.recordStudioEvent(id, 'Forge', 'writing evidence-cited artifacts')
  const forge = await forgeDossier({
    dossier: forgeDossierObj,
    router,
    coverage,
    deps: { toPdf, ...(deps.sampleContrast ? { sampleContrast: deps.sampleContrast } : {}) },
  })

  const selected = new Set(
    input.selected && input.selected.length ? input.selected : forge.artifacts.map((a) => a.id),
  )
  const artifacts = forge.artifacts.filter((a) => selected.has(a.id))

  const pdfBytes = new Map<string, Uint8Array>()
  for (const [name, f] of forge.files) if (f.ext === 'pdf') pdfBytes.set(name, f.bytes)

  // Grade with the repair loop live so the REPORT stage shows the draft-by-draft story.
  // parseBack only runs against a real PDF (guardrail #11-adjacent honesty: no fake fidelity).
  const gradeDeps = {
    router,
    fetcher,
    fileExists: () => true,
    ...(deps.realPdf
      ? {
          parseBack: async (artifact: Artifact, d: Dossier) => {
            const bytes = pdfBytes.get(artifact.id)
            if (!bytes) throw new Error(`no pdf for ${artifact.id}`)
            return parseBackFromBuffer(bytes, d.profile)
          },
        }
      : {}),
  }
  const repairFor =
    (kind: Artifact['kind']) =>
    async (artifact: Artifact, repairBrief: string): Promise<Artifact> => {
      store.recordStudioEvent(id, 'Forge', `tightening ${label(kind)} to the tribunal's brief`)
      const rewritten = await writeArtifact({ kind, dossier: forgeDossierObj, router, coverage })
      const rb: RenderBundle = { dossier: forgeDossierObj, sentences: rewritten.sentences }
      const html = renderArtifactHtml(kind, rb)
      const next: Artifact = {
        ...artifact,
        sentences: rewritten.sentences,
        meta: { ...artifact.meta, html, repairBriefApplied: repairBrief.slice(0, 400) },
      }
      if (kind === 'resume_ats') pdfBytes.set(artifact.id, await toPdf(html))
      return next
    }

  const reports: TribunalReport[] = []
  const finalArtifacts: Artifact[] = []
  for (const artifact of artifacts) {
    store.recordStudioEvent(id, 'Tribunal', `grading ${label(artifact.kind)}`)
    const repair = WRITER_KINDS.has(artifact.kind)
      ? repairFor(artifact.kind)
      : async (a: Artifact) => a // structured artifacts are decided by hard checks alone
    const { reports: r, artifact: fin } = await gradeWithRepair(
      forgeDossierObj,
      artifact,
      gradeDeps,
      repair,
    )
    reports.push(...r)
    finalArtifacts.push(fin)
  }

  // Persist files, collect signed links.
  const fileIdByArtifact = new Map<string, string>()
  for (const [name, f] of forge.files) {
    if (!selected.has(name) && name !== 'cover') continue
    const row = store.putFile({ dossierId: id, name, ext: f.ext, bytes: f.bytes })
    fileIdByArtifact.set(name, row.id)
  }

  // Parse-back for the REPORT stage (the ATS résumé) — only meaningful against a real PDF.
  const atsPdf = pdfBytes.get('resume_ats')
  let parseBack: { fidelityPct: number; fieldDiffs: unknown[]; fieldsChecked: number } | undefined
  if (atsPdf && deps.realPdf) {
    const pb = await parseBackFromBuffer(atsPdf, dossier.profile)
    parseBack = {
      fidelityPct: pb.fidelityPct,
      fieldDiffs: pb.fieldDiffs,
      fieldsChecked: 2 + dossier.profile.experiences.length * 4,
    }
  }

  const lean = finalArtifacts.map((a): Artifact => {
    const out: Artifact = { id: a.id, kind: a.kind, meta: {} }
    if (a.fileRef) out.fileRef = a.fileRef
    if (a.sentences) out.sentences = a.sentences
    return out
  })
  const version = store.latestDossierVersion(id) + 1
  const nextInput: Record<string, unknown> = {
    ...dossier,
    version,
    artifacts: lean,
    tribunalReports: reports.map((r) => ({
      artifactId: r.artifactId,
      standardVersion: r.standardVersion,
      passed: r.pass,
      hardFindings: r.hard
        .filter((h) => h.status === 'fail')
        .flatMap((h) => h.findings.map((f) => ({ code: f.code, detail: f.detail }))),
      craftScores: Object.fromEntries(r.craft.map((c) => [c.axis, c.score])),
      createdAt: r.createdAt,
    })),
  }
  delete nextInput['seal']
  const next: Dossier = DossierSchema.parse(nextInput)
  store.saveDossier(next)
  store.saveDossierVersion(next)
  store.setStage(id, 'forged')

  // Store the rich forge output (sentences per artifact, full reports, file ids, parse-back) as a
  // 'forge_result' event so getStudioState can rebuild the evidence drawer + report cards.
  const fileUrls: Record<string, string> = {}
  for (const [name, fid] of fileIdByArtifact) fileUrls[name] = signedLink(cfg, fid)
  store.recordEvent(
    'forge_result',
    {
      artifacts: finalArtifacts.map((a) => ({
        id: a.id,
        kind: a.kind,
        sentences: (a.sentences ?? []).map((s) => ({ text: s.text, claimIds: s.claimIds })),
        fileUrl: fileUrls[a.id] ?? null,
      })),
      reports: reports.map(serializeReport),
      rollup: summarize(reports),
      parseBack: parseBack ?? null,
      questions: forge.questions,
      fileUrls,
    },
    id,
  )
  store.recordStudioEvent(
    id,
    'Forge',
    `${finalArtifacts.length} artifact${finalArtifacts.length === 1 ? '' : 's'} forged and graded`,
  )
}

function serializeReport(r: TribunalReport): Record<string, unknown> {
  return {
    artifactId: r.artifactId,
    artifactKind: r.artifactKind,
    draftIndex: r.draftIndex,
    pass: r.pass,
    hardPass: r.hardPass,
    craftPass: r.craftPass,
    craftWeightedMean: r.craftWeightedMean,
    craft: r.craft,
    hard: r.hard.map((h) => ({ id: h.id, title: h.title, status: h.status, findings: h.findings })),
    ...(r.repairBrief ? { repairBrief: r.repairBrief } : {}),
    standardVersion: r.standardVersion,
  }
}

// ── seal (inline) ────────────────────────────────────────────────────────────
export async function sealDossier(
  deps: StudioDeps,
  dossierId: string,
): Promise<{
  leaf: string
  manifestHash: string
  signer: string | null
  status: string
  chainId: number
  registry: string
  explorerLink: string
}> {
  const { store, cfg } = deps
  const dossier = store.getDossier(dossierId)
  if (!dossier) throw new Error('dossier not found')
  store.recordStudioEvent(dossierId, 'Sealer', 'canonically hashing the dossier manifest')
  const ref = versionRef(dossierId, dossier.version)
  const salt = store.getSalt(ref) ?? newSalt()
  const bundle = await buildVerifyBundle(dossier, {
    chainId: cfg.chainId,
    registry: cfg.registry as Address,
    salt: salt as Hex,
    ...(cfg.sealerKey ? { sealerKey: cfg.sealerKey as Hex } : {}),
  })
  const sealed: Dossier = DossierSchema.parse({
    ...dossier,
    seal: {
      manifestHash: bundle.manifestHash,
      commitment: bundle.leaf,
      chainId: cfg.chainId,
      standardVersion: bundle.standardVersion,
      ...(bundle.signer ? { signer: bundle.signer } : {}),
    },
  })
  store.saveDossier(sealed, salt)
  store.setSalt(dossierId, salt)
  store.saveDossierVersion(sealed, { salt, leaf: bundle.leaf, sealStatus: 'pending' })
  store.enqueueSeal(ref, bundle.leaf)
  store.setStage(dossierId, 'sealed')
  store.recordStudioEvent(
    dossierId,
    'Sealer',
    bundle.signer
      ? 'EIP-712 signed · anchoring to X Layer'
      : 'committed (unsigned dev mode) · anchoring',
  )
  return {
    leaf: bundle.leaf,
    manifestHash: bundle.manifestHash,
    signer: bundle.signer ?? null,
    status: 'pending',
    chainId: cfg.chainId,
    registry: cfg.registry,
    explorerLink: `${explorerBase(cfg.chainId)}/address/${cfg.registry}`,
  }
}

// ── share ──────────────────────────────────────────────────────────────────────
export interface ShareConfig {
  exposedClaimIds: string[]
  showContact: boolean
  expiryDays: 7 | 30 | null
  preset?: 'recruiter' | 'samples'
  logViews?: boolean
}

export function createOrUpdateShare(
  store: Store,
  dossierId: string,
  config: ShareConfig,
): { shareId: string; url: string; expiresAt: string | null } {
  const expiresAt =
    config.expiryDays && config.expiryDays > 0
      ? new Date(Date.now() + config.expiryDays * 86_400_000).toISOString()
      : null
  const stored = {
    exposedClaimIds: config.exposedClaimIds,
    showContact: config.showContact,
    preset: config.preset ?? 'recruiter',
    logViews: config.logViews === true,
  }
  let slug = store.latestShareForDossier(dossierId)
  if (slug) {
    store.updateShareConfig(slug, stored, expiresAt)
    store.setShareRevoked(slug, false)
  } else {
    slug = store.createStudioShare({
      dossierId,
      config: stored,
      ...(expiresAt ? { expiresAt } : {}),
    })
  }
  store.recordStudioEvent(dossierId, 'Share', 'recruiter link issued')
  return { shareId: slug, url: `/s/${slug}`, expiresAt }
}

export function revokeShare(store: Store, dossierId: string): { ok: boolean } {
  const slug = store.latestShareForDossier(dossierId)
  if (!slug) return { ok: false }
  store.setShareRevoked(slug, true)
  store.recordStudioEvent(dossierId, 'Share', 'recruiter link withdrawn by candidate')
  return { ok: true }
}

// ── the recruiter portal view (public, PII-enforced) ─────────────────────────
export function getShareView(
  store: Store,
  cfg: ServerConfig,
  shareId: string,
  now: number = Date.now(), // injectable clock so expiry is testable (P11 taxonomy)
  recordView = true,
): Record<string, unknown> {
  const share = store.getShareFull(shareId)
  if (!share) return { found: false }
  if (share.revoked) return { found: true, revoked: true }
  if (share.expiresAt && new Date(share.expiresAt).getTime() < now)
    return { found: true, expired: true, expiresAt: share.expiresAt }

  const dossier = store.getDossier(share.dossierId)
  if (!dossier) return { found: false }
  const config = share.config as {
    exposedClaimIds?: string[]
    showContact?: boolean
    preset?: 'recruiter' | 'samples'
    logViews?: boolean
  }
  if (recordView && config.logViews) store.recordShareView(shareId, now)
  const exposed = new Set(
    config.exposedClaimIds ??
      dossier.claims.filter((c) => c.status === 'confirmed').map((c) => c.id),
  )

  // PII_HYGIENE: only expose sentences whose claims are ALL in the exposed set.
  const forge = latestForgeResult(store, share.dossierId)
  const resumeArtifact = forge?.artifacts.find((a) =>
    config.preset === 'samples'
      ? a.id === 'case_studies'
      : a.id === 'resume_ats' || a.id === 'resume_designed',
  )
  const redactions = store.getEvidenceRedactions(share.dossierId)
  const secrets = redactedFragments(dossier, redactions)
  const clean = (text: string): string =>
    secrets.reduce((out, secret) => out.split(secret).join('████'), text)
  const sentences = (resumeArtifact?.sentences ?? [])
    .filter((s) => s.claimIds.length > 0 && s.claimIds.every((cid) => exposed.has(cid)))
    .map((s) => ({ ...s, text: clean(s.text) }))

  const exposedClaims = dossier.claims
    .filter((c) => exposed.has(c.id) && c.status === 'confirmed')
    .map((c) => ({
      id: c.id,
      text: clean(c.text),
      strength: c.strength,
      tier: c.strength,
      tierExplanation: tierExplanation(c),
      numericFacts: c.numericFacts.filter(
        (fact) => !secrets.some((secret) => secret.includes(String(fact.value))),
      ),
    }))

  const evidenceById = new Map(dossier.evidence.map((e) => [e.id, e]))
  const exposedEvidence = dossier.claims
    .filter((c) => exposed.has(c.id))
    .flatMap((c) => c.evidenceIds)
    .filter((eid, i, arr) => arr.indexOf(eid) === i)
    .map((eid) => evidenceById.get(eid))
    .filter((e): e is EvidenceItem => !!e)
    .map((e) => ({ id: e.id, kind: e.kind, label: e.label }))

  // Pre-built evidence-thread graph for the recruiter portal (claim ids never leave the server).
  const tierByEvidence = new Map<string, string>()
  for (const c of dossier.claims)
    if (exposed.has(c.id)) for (const eid of c.evidenceIds) tierByEvidence.set(eid, c.strength)
  const threadBullets = sentences.map((s, i) => {
    const eids = new Set<string>()
    for (const cid of s.claimIds) {
      const claim = dossier.claims.find((c) => c.id === cid)
      for (const eid of claim?.evidenceIds ?? []) if (exposed.has(cid)) eids.add(eid)
    }
    return { id: `s${i}`, text: s.text, evidenceIds: [...eids] }
  })
  const threadEvidence = exposedEvidence.map((e) => ({
    id: e.id,
    tier: (tierByEvidence.get(e.id) ?? 'attested') as string,
    label: e.label,
  }))

  const rollup = forge?.rollup as { finalPassed?: number; artifacts?: number } | undefined
  const seal = dossier.seal
  return {
    found: true,
    revoked: false,
    candidate: {
      name: dossier.profile.fullName,
      headline: dossier.profile.headline ?? '',
      ...(config.showContact &&
      dossier.profile.contact.email &&
      !secrets.includes(dossier.profile.contact.email)
        ? { email: dossier.profile.contact.email }
        : {}),
    },
    sentences,
    claims: exposedClaims,
    evidence: exposedEvidence,
    threads: { bullets: threadBullets, evidence: threadEvidence },
    grade: rollup ? { pass: rollup.finalPassed ?? 0, of: rollup.artifacts ?? 0 } : null,
    seal: seal
      ? {
          leaf: seal.commitment,
          chainId: seal.chainId,
          status: store.getSealStatus(share.dossierId) ?? 'pending',
          registry: cfg.registry,
          explorerLink: `${explorerBase(cfg.chainId)}/address/${cfg.registry}`,
        }
      : null,
    expiresAt: share.expiresAt,
    preset: config.preset ?? 'recruiter',
  }
}

function redactedFragments(dossier: Dossier, records: Record<string, unknown>): string[] {
  const out = new Set<string>()
  for (const [evidenceId, raw] of Object.entries(records)) {
    const record = raw as {
      fields?: string[]
      textRanges?: Array<{ start: number; end: number }>
    }
    if (record.fields?.includes('email') && dossier.profile.contact.email)
      out.add(dossier.profile.contact.email)
    if (record.fields?.includes('phone') && dossier.profile.contact.phone)
      out.add(dossier.profile.contact.phone)
    const text = dossier.evidence.find((e) => e.id === evidenceId)?.contentText ?? ''
    for (const range of record.textRanges ?? []) {
      const fragment = text.slice(Math.max(0, range.start), Math.max(0, range.end)).trim()
      if (fragment) out.add(fragment)
    }
  }
  return [...out]
}

export function setRedactions(
  store: Store,
  dossierId: string,
  evidenceId: string,
  record: {
    fields: Array<'email' | 'phone'>
    textRanges: Array<{ start: number; end: number }>
    regions: Array<{ page: number; x: number; y: number; width: number; height: number }>
  },
): { ok: boolean } {
  const dossier = store.getDossier(dossierId)
  if (!dossier?.evidence.some((e) => e.id === evidenceId)) return { ok: false }
  store.setEvidenceRedactions(dossierId, evidenceId, record)
  store.recordStudioEvent(
    dossierId,
    'Redaction',
    'share copy updated; marked source regions stay server-side',
  )
  return { ok: true }
}

export async function importCredential(
  deps: StudioDeps,
  dossierId: string,
  input: { filename: string; contentB64?: string; text?: string },
): Promise<Record<string, unknown>> {
  const dossier = deps.store.getDossier(dossierId)
  if (!dossier) throw new Error('dossier not found')
  const { bytes } = decodeUpload({ text: input.text, textB64: input.contentB64 })
  const ing = await ingestDocument(input.filename, bytes)
  if (!ing.ok || !ing.contentText.trim()) throw new Error('credential could not be read')
  const text = ing.contentText
  const issuer = text
    .match(/\b(?:issuer|issued by|awarded by)\s*[:\-]?\s*([^\n,;]{2,80})/i)?.[1]
    ?.trim()
  const ym = text.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])\b/)
  const evidence: EvidenceItem = {
    id: newEvidenceId(),
    kind: 'document',
    label: input.filename,
    sourceRef: input.filename,
    contentText: text,
    addedAt: new Date().toISOString(),
  }
  const name =
    text.match(/\b(?:certificate|certification)\s+(?:of|in)\s+([^\n]{2,100})/i)?.[1]?.trim() ??
    input.filename.replace(/\.[^.]+$/, '')
  const next = DossierSchema.parse({
    ...dossier,
    evidence: [...dossier.evidence, evidence],
    profile: {
      ...dossier.profile,
      certifications: [
        ...dossier.profile.certifications,
        {
          name,
          ...(issuer ? { issuer } : {}),
          ...(ym ? { issuedYm: `${ym[1]}-${ym[2]}` } : {}),
        },
      ],
    },
  })
  deps.store.saveDossier(next)
  deps.store.recordStudioEvent(
    dossierId,
    'Credential',
    'certificate imported as Documented evidence',
  )
  return {
    evidence: { id: evidence.id, kind: evidence.kind, strength: 'documented' },
    extracted: { name, issuer: issuer ?? null, issuedYm: ym ? `${ym[1]}-${ym[2]}` : null },
    note: 'Issuer confirmation is out of scope in v1; this tier proves the document was supplied, not independently verified.',
  }
}

export function compareVersions(
  store: Store,
  dossierId: string,
  fromVersion: number,
  toVersion: number,
): Record<string, unknown> | undefined {
  const from = store.getDossierVersion(dossierId, fromVersion)
  const to = store.getDossierVersion(dossierId, toVersion)
  if (!from || !to) return undefined
  const score = (d: Dossier, id: string): number => {
    const report = [...d.tribunalReports].reverse().find((r) => r.artifactId === id)
    const values = Object.values(report?.craftScores ?? {})
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
  }
  const ids = [...new Set([...from.artifacts.map((a) => a.id), ...to.artifacts.map((a) => a.id)])]
  return {
    from: fromVersion,
    to: toVersion,
    artifacts: ids.map((id) => {
      const a = from.artifacts.find((x) => x.id === id)
      const b = to.artifacts.find((x) => x.id === id)
      const aText = (a?.sentences ?? []).map((s) => s.text)
      const bText = (b?.sentences ?? []).map((s) => s.text)
      return {
        id,
        added: bText.filter((x) => !aText.includes(x)),
        removed: aText.filter((x) => !bText.includes(x)),
        scoreFrom: score(from, id),
        scoreTo: score(to, id),
        scoreDelta: score(to, id) - score(from, id),
      }
    }),
  }
}

// ── full studio state (for the owner UI) ─────────────────────────────────────
interface ForgeResult {
  artifacts: Array<{ id: string; kind: string; sentences: Sentence[]; fileUrl: string | null }>
  reports: Array<Record<string, unknown>>
  rollup: unknown
  parseBack: unknown
  questions: string[]
  fileUrls: Record<string, string>
}

function latestForgeResult(store: Store, dossierId: string): ForgeResult | undefined {
  const events = store.listEvents(dossierId)
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.kind === 'forge_result' && events[i]!.detail) {
      try {
        return JSON.parse(events[i]!.detail!) as ForgeResult
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

export function getStudioState(
  store: Store,
  cfg: ServerConfig,
  id: string,
): Record<string, unknown> | undefined {
  const dossier = store.getDossier(id)
  if (!dossier) return undefined
  const stage = store.getStage(id) ?? 'ledger'
  const email = store.getEmail(id)

  const counts = { total: 0, confirmed: 0, needsConfirmation: 0, extracted: 0, rejected: 0 }
  for (const c of dossier.claims) {
    counts.total += 1
    if (c.status === 'confirmed') counts.confirmed += 1
    else if (c.status === 'needs_confirmation') counts.needsConfirmation += 1
    else if (c.status === 'extracted') counts.extracted += 1
    else if (c.status === 'rejected') counts.rejected += 1
  }

  const forge = latestForgeResult(store, id)
  const share = store.latestShareForDossier(id)
  const shareFull = share ? store.getShareFull(share) : undefined
  const seal = dossier.seal

  const reqById = new Map((dossier.brief?.decomposed ?? []).map((r) => [r.id, r]))
  const coverage = dossier.brief
    ? computeCoverage(
        dossier.brief.decomposed,
        dossier.claims.filter((c) => c.status === 'confirmed'),
      ).map((c) => ({
        requirement: reqById.get(c.requirementId)?.text ?? c.requirementId,
        kind: reqById.get(c.requirementId)?.kind ?? 'nice',
        status: c.status,
        note: c.note,
        claimIds: c.claimIds,
      }))
    : null

  return {
    id,
    stage,
    createdAt: dossier.createdAt,
    profile: {
      fullName: dossier.profile.fullName,
      headline: dossier.profile.headline ?? '',
      email: email ?? dossier.profile.contact.email ?? '',
      timezone: dossier.profile.timezone,
      experiences: dossier.profile.experiences,
      skills: dossier.profile.skills,
    },
    evidence: dossier.evidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      contentPreview: (e.contentText ?? '').slice(0, 800),
      ...(e.fetchedOk !== undefined ? { fetchedOk: e.fetchedOk } : {}),
    })),
    claims: dossier.claims.map((c) => ({
      id: c.id,
      text: c.text,
      status: c.status,
      strength: c.strength,
      tier: c.strength,
      tierExplanation: tierExplanation(c),
      numericFacts: c.numericFacts,
      evidenceIds: c.evidenceIds,
      // The specific question for a needs_confirmation card.
      ...(c.status === 'needs_confirmation'
        ? { question: `Which number is correct here, and where is it from?` }
        : {}),
    })),
    counts,
    brief: dossier.brief
      ? {
          jdText: dossier.brief.jdText,
          requirements: dossier.brief.decomposed.map((r) => ({
            id: r.id,
            text: r.text,
            kind: r.kind,
          })),
        }
      : null,
    variant: dossier.variant,
    coverage,
    interview: dossier.interview,
    forge: forge ?? null,
    seal: seal
      ? {
          leaf: seal.commitment,
          manifestHash: seal.manifestHash,
          signer: seal.signer ?? null,
          chainId: seal.chainId,
          status: store.getSealStatus(id) ?? 'pending',
          registry: cfg.registry,
          explorerLink: `${explorerBase(cfg.chainId)}/address/${cfg.registry}`,
        }
      : null,
    share: shareFull
      ? {
          shareId: share,
          url: `/s/${share}`,
          revoked: shareFull.revoked,
          expiresAt: shareFull.expiresAt,
          config: shareFull.config,
          views: store.shareViewLog(share!),
        }
      : null,
    redactions: store.getEvidenceRedactions(id),
    versions: store.listDossierVersions(id),
    compare:
      store.latestDossierVersion(id) >= 2
        ? compareVersions(
            store,
            id,
            store.latestDossierVersion(id) - 1,
            store.latestDossierVersion(id),
          )
        : null,
  }
}

const normText = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url.slice(0, 40)
  }
}
function label(kind: string): string {
  return kind.replace(/_/g, ' ')
}
