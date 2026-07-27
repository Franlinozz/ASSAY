// Intake — the tolerance + preflight layer in front of every billable capability.
//
// Two jobs, both learned from a marketplace review failure (AGENTS.md Deviations):
//
//  1. TOLERANCE. A buying agent writes the payload it thinks is obvious: `resume` not `resumeText`,
//     `jobDescription` not `jd`, `claims` as one string rather than an array. Assay's schema is
//     published, but a marketplace caller that guesses one key wrong should still get the service
//     it paid for, not a refusal. `normalizeArgs` maps the obvious synonyms onto the canonical
//     schema — per tool, so a key never means two things at once.
//
//  2. PREFLIGHT BEFORE PAYMENT. Assay refuses to work from thin air; that refusal is the product.
//     But a refusal must never cost money. `preflight` runs the same input requirements the
//     pipelines enforce, deterministically and with zero model calls, BEFORE the x402 gate is
//     consulted — so an under-specified call gets a 400 that names exactly what to send instead of
//     a settled payment and an apology.
//
// Nothing here relaxes the claim gate: it decides whether a request is *addressable*, never
// whether a sentence is supported.

import { TOOL_SPECS, toolDocs } from './toolspec'
import { A2MCP_ROUTE_TARGETS } from './config'

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// ── Service / tool name resolution ──────────────────────────────────────────

const TOOL_NAME_BY_NORM = new Map<string, string>()
for (const spec of TOOL_SPECS) {
  TOOL_NAME_BY_NORM.set(norm(spec.name), spec.name)
  // "asy_ats_scan" is also reachable as "ats_scan" / "atsScan" / "ATS scan" (its title).
  TOOL_NAME_BY_NORM.set(norm(spec.name.replace(/^asy_/, '')), spec.name)
  TOOL_NAME_BY_NORM.set(norm(spec.title), spec.name)
}
// Marketplace-facing service names, as they read on the OKX.AI listing.
const MARKETPLACE_NAMES: Record<string, string> = {
  'ATS Resume Scan': 'asy_ats_scan',
  'Resume Scan': 'asy_ats_scan',
  'ATS Scan': 'asy_ats_scan',
  'Job Fit Brief': 'asy_fit_brief',
  'Fit Brief': 'asy_fit_brief',
  'Career Dossier': 'asy_create_dossier_job',
  'Promotion Dossier': 'asy_create_dossier_job',
  'Freelancer Proof Pack': 'asy_create_dossier_job',
  'Interview Prep': 'asy_interview_prep',
  'Claim Audit': 'asy_claim_audit',
  'Cover Letter': 'asy_cover_letter',
  'Story Bank': 'asy_story_bank',
  'Tailor Resume': 'asy_tailor_resume',
  'Tailor Résumé': 'asy_tailor_resume',
  'Verify Seal': 'asy_verify',
  'Job Status': 'asy_job_status',
  'Job Result': 'asy_job_result',
}
for (const [label, tool] of Object.entries(MARKETPLACE_NAMES))
  TOOL_NAME_BY_NORM.set(norm(label), tool)

/** Resolve a caller-supplied tool name (canonical, short, title, or marketplace label). */
export function resolveToolName(name: unknown): string | undefined {
  if (typeof name !== 'string' || !name.trim()) return undefined
  return TOOL_NAME_BY_NORM.get(norm(name))
}

// A2MCP route slugs: the three dossier entry points keep their own slugs (they carry a variant
// default), everything else resolves through the tool table.
const SLUG_BY_NORM = new Map<string, string>()
for (const slug of Object.keys(A2MCP_ROUTE_TARGETS)) {
  SLUG_BY_NORM.set(norm(slug), slug)
  SLUG_BY_NORM.set(norm(slug.replace(/^asy_/, '')), slug)
}
const SLUG_LABELS: Record<string, string> = {
  'ATS Resume Scan': 'asy_ats_scan',
  'Resume Scan': 'asy_ats_scan',
  'Job Fit Brief': 'asy_fit_brief',
  'Career Dossier': 'asy_create_dossier_job',
  'Promotion Dossier': 'asy_promotion_dossier',
  'Freelancer Proof Pack': 'asy_freelancer_proof_pack',
  'Freelance Proof Pack': 'asy_freelancer_proof_pack',
  'Interview Prep': 'asy_interview_prep',
  'Claim Audit': 'asy_claim_audit',
  'Cover Letter': 'asy_cover_letter',
  'Story Bank': 'asy_story_bank',
  'Tailor Resume': 'asy_tailor_resume',
  'Tailor Résumé': 'asy_tailor_resume',
  'Verify Seal': 'asy_verify',
  'Job Status': 'asy_job_status',
  'Job Result': 'asy_job_result',
}
for (const [label, slug] of Object.entries(SLUG_LABELS)) SLUG_BY_NORM.set(norm(label), slug)

/** Resolve an /x402/:service path segment to a registered A2MCP route slug. */
export function resolveServiceSlug(slug: unknown): string | undefined {
  if (typeof slug !== 'string' || !slug.trim()) return undefined
  return SLUG_BY_NORM.get(norm(slug))
}

export const SERVICE_SLUGS: string[] = Object.keys(A2MCP_ROUTE_TARGETS)

// ── Argument tolerance ──────────────────────────────────────────────────────

// Synonyms are declared per canonical key and only applied to tools that actually accept that key
// (see normalizeArgs) — `job` means the job description for a fit brief and the job id for a status
// poll, and neither tool accepts the other's key, so the mapping stays unambiguous.
const ALIASES: Record<string, string[]> = {
  resumeText: [
    'resume',
    'resumetext',
    'resumecontent',
    'resumebody',
    'resumeplaintext',
    'cv',
    'cvtext',
    'cvcontent',
    'document',
    'documenttext',
    'doctext',
    'sourcetext',
    'careerhistory',
    'workhistory',
  ],
  resumeB64: [
    'resumeb64',
    'resumebase64',
    'resumefile',
    'resumepdf',
    'cvb64',
    'cvbase64',
    'cvfile',
    'file',
    'filebase64',
    'fileb64',
    'filecontent',
    'contentb64',
    'documentb64',
    'documentbase64',
    'attachment',
    'base64',
  ],
  filename: ['filename', 'fileName', 'originalfilename', 'documentname'],
  jd: [
    'jd',
    'jdtext',
    'jobdescription',
    'jobdesc',
    'jobposting',
    'joblisting',
    'jobad',
    'job',
    'posting',
    'vacancy',
    'targetrole',
    'targetjob',
    'role',
    'position',
    'roledescription',
  ],
  claims: [
    'claims',
    'claim',
    'bullets',
    'bulletpoints',
    'statements',
    'achievements',
    'accomplishments',
    'claimlist',
    'evidenceclaims',
  ],
  evidence: [
    'evidence',
    'evidencetext',
    'supportingevidence',
    'proof',
    'proofs',
    'sources',
    'backgroundinfo',
  ],
  profile: ['profile', 'profilejson', 'candidate', 'candidateprofile'],
  dossierId: ['dossierid', 'dossier', 'dossierref', 'dossierreference'],
  jobId: ['jobid', 'job', 'jobref', 'jobreference', 'taskid', 'id'],
  leaf: ['leaf', 'commitment', 'commitmentleaf', 'sealleaf'],
  answer: ['answer', 'answertext', 'response', 'reply', 'candidateanswer'],
  answers: ['answers', 'clarifications', 'clarificationanswers', 'questionanswers'],
  variant: ['variant', 'dossiertype', 'dossierkind', 'kind', 'type', 'mode'],
  dateFrom: ['datefrom', 'periodstart', 'reviewfrom', 'from'],
  dateTo: ['dateto', 'periodend', 'reviewto', 'to'],
}

// Generic containers a caller may wrap the real arguments in.
const WRAPPERS = ['arguments', 'args', 'input', 'inputs', 'params', 'parameters', 'payload', 'data']
// Generic free-text keys. These only become a résumé when the value actually looks like a
// document — a chat-style "can you scan my resume?" must fall through to preflight guidance
// rather than be graded as if it were the résumé itself.
const FREE_TEXT_KEYS = ['text', 'content', 'body', 'prompt', 'query', 'message', 'question']

const CANONICAL_KEYS = new Map<string, Set<string>>(
  TOOL_SPECS.map((s) => [s.name, new Set(Object.keys(s.inputSchema))]),
)

/** A string is treated as a supplied document only when it carries document-like bulk. */
export function looksLikeDocument(value: string): boolean {
  const text = value.trim()
  if (text.length >= 200) return true
  return text.split(/\r?\n/).filter((l) => l.trim()).length >= 3 && text.length >= 60
}

function unwrap(raw: Record<string, unknown>): Record<string, unknown> {
  let current = raw
  for (let depth = 0; depth < 3; depth += 1) {
    const keys = Object.keys(current)
    const wrapper = keys.find((k) => WRAPPERS.includes(norm(k)))
    if (!wrapper) break
    const inner = current[wrapper]
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) break
    // Outer keys win: an explicit sibling is more specific than the wrapped copy.
    const merged: Record<string, unknown> = { ...(inner as Record<string, unknown>) }
    for (const [k, v] of Object.entries(current)) if (k !== wrapper) merged[k] = v
    current = merged
  }
  return current
}

function coerceClaims(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value
      .map((v) =>
        typeof v === 'string'
          ? v
          : v && typeof v === 'object' && typeof (v as { text?: unknown }).text === 'string'
            ? (v as { text: string }).text
            : '',
      )
      .map((s) => s.trim())
      .filter(Boolean)
    return items.length ? items : undefined
  }
  if (typeof value === 'string') {
    const items = value
      .split(/\r?\n|(?<=[.!?])\s*;\s*|\s*;\s*/)
      .map((s) => s.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
      .filter(Boolean)
    return items.length ? items : undefined
  }
  return undefined
}

const VARIANTS = ['job', 'promotion', 'freelance'] as const
function coerceVariant(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const v = norm(value)
  const hit = VARIANTS.find((candidate) => v === candidate || v.includes(candidate))
  if (hit) return hit
  if (v.includes('raise') || v.includes('review')) return 'promotion'
  if (v.includes('contract') || v.includes('client')) return 'freelance'
  return undefined
}

function coerceText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

function coerceProfileValue(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, unknown>
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Map a caller's arguments onto the tool's published schema. Unknown keys are preserved (the
 * pipelines ignore them), canonical keys always win over an alias, and nothing is invented.
 */
export function normalizeArgs(tool: string, raw: unknown): Record<string, unknown> {
  const canonical = CANONICAL_KEYS.get(tool)
  if (!canonical) return raw && typeof raw === 'object' ? { ...(raw as object) } : {}

  // A bare string body is the document the caller meant to send.
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return {}
    if (canonical.has('resumeText') && looksLikeDocument(text)) return { resumeText: text }
    if (canonical.has('jd')) return { jd: text }
    if (canonical.has('dossierId') && /^(DSR-|dsr_)/i.test(text)) return { dossierId: text }
    if (canonical.has('jobId') && /^job_/i.test(text)) return { jobId: text }
    if (canonical.has('leaf') && /^0x[0-9a-f]{64}$/i.test(text)) return { leaf: text }
    if (canonical.has('claims')) return { claims: [text] }
    return {}
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const src = unwrap(raw as Record<string, unknown>)
  const byNorm = new Map<string, unknown>()
  for (const [k, v] of Object.entries(src)) if (!byNorm.has(norm(k))) byNorm.set(norm(k), v)

  const out: Record<string, unknown> = { ...src }

  for (const key of canonical) {
    const already = out[key]
    const hasValue =
      already !== undefined &&
      already !== null &&
      !(typeof already === 'string' && !already.trim()) &&
      !(Array.isArray(already) && already.length === 0)
    if (hasValue) continue
    for (const alias of ALIASES[key] ?? []) {
      const candidate = byNorm.get(norm(alias))
      if (candidate === undefined || candidate === null) continue
      // Never let one supplied value satisfy two different canonical keys.
      if (norm(alias) !== norm(key) && canonical.has(alias) && alias !== key) continue
      out[key] = candidate
      break
    }
  }

  // Free-text fallback for document-shaped input only.
  if (canonical.has('resumeText') && !coerceText(out['resumeText'])?.trim()) {
    for (const key of FREE_TEXT_KEYS) {
      const candidate = byNorm.get(norm(key))
      if (typeof candidate === 'string' && looksLikeDocument(candidate)) {
        out['resumeText'] = candidate
        break
      }
    }
  }

  // Type coercion onto the published schema.
  for (const key of ['resumeText', 'resumeB64', 'jd', 'evidence', 'answer', 'answers', 'filename'])
    if (canonical.has(key) && out[key] !== undefined) {
      const text = coerceText(out[key])
      if (text === undefined) delete out[key]
      else out[key] = text
    }
  for (const key of ['dossierId', 'jobId', 'leaf'])
    if (canonical.has(key) && out[key] !== undefined) {
      const text = coerceText(out[key])?.trim()
      if (!text) delete out[key]
      else out[key] = text
    }
  if (canonical.has('resumeB64') && typeof out['resumeB64'] === 'string')
    out['resumeB64'] = out['resumeB64'].replace(/^data:[^,]*,/, '')
  if (canonical.has('claims')) {
    const claims = coerceClaims(out['claims'])
    if (claims) out['claims'] = claims
    else delete out['claims']
  }
  if (canonical.has('variant')) {
    const variant = coerceVariant(out['variant'])
    if (variant) out['variant'] = variant
    else delete out['variant']
  }
  if (canonical.has('profile')) {
    const profile = coerceProfileValue(out['profile'])
    if (profile) out['profile'] = profile
    else delete out['profile']
  }
  // A base64 upload without a filename defaults to PDF in the pipeline; keep an explicit hint when
  // the caller gave one under any spelling.
  if (canonical.has('filename') && typeof out['filename'] === 'string' && !out['filename'].trim())
    delete out['filename']

  return out
}

// ── Preflight ───────────────────────────────────────────────────────────────

export interface IntakeProblem {
  code: string
  message: string
  /** Keys that would satisfy the requirement — any one of them. */
  accepts: string[]
  example: Record<string, unknown>
}

export type PreflightResult = { ok: true } | ({ ok: false } & IntakeProblem)

const OK: PreflightResult = { ok: true }

const hasText = (v: unknown, min = 1): boolean =>
  typeof v === 'string' && v.trim().length >= min && v.trim().length > 0
const hasClaims = (v: unknown): boolean =>
  Array.isArray(v) && v.some((c) => typeof c === 'string' && c.trim().length > 0)

const EXAMPLE_RESUME =
  'Jane Doe — jane@example.com\nEXPERIENCE\nAcme (2022–2025), Product Manager. Shipped billing v2 to 40k users.\nSKILLS\nSQL, Python, roadmap planning'
const EXAMPLE_JD =
  'Senior Product Manager — own the billing roadmap, work with data, 5+ years of B2B SaaS.'

// A base64 upload must actually decode to a document-sized payload. Catching this here means a
// garbage attachment is rejected for free instead of failing inside a paid background job.
function decodesToDocument(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const b64 = value.replace(/^data:[^,]*,/, '').replace(/\s+/g, '')
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false
  return Math.floor((b64.length * 3) / 4) >= 100
}

function upload(args: Record<string, unknown>): boolean {
  return hasText(args['resumeText'], 20) || decodesToDocument(args['resumeB64'])
}

/**
 * Deterministic, zero-cost check that the request can produce the advertised capability. Runs
 * BEFORE the payment gate — an unaddressable request is never charged.
 */
export function preflight(tool: string, args: Record<string, unknown>): PreflightResult {
  switch (tool) {
    case 'asy_ats_scan':
      if (upload(args)) return OK
      return {
        ok: false,
        code: 'RESUME_REQUIRED',
        message:
          'An ATS scan needs the résumé itself. Send `resumeText` (plain text) or `resumeB64` (base64 PDF/DOCX, with `filename`). Optionally add `jd` to get keyword coverage.',
        accepts: ['resumeText', 'resumeB64'],
        example: { resumeText: EXAMPLE_RESUME, jd: EXAMPLE_JD },
      }

    case 'asy_claim_audit':
      if (hasClaims(args['claims']) || upload(args)) return OK
      return {
        ok: false,
        code: 'CLAIMS_OR_RESUME_REQUIRED',
        message:
          'A claim audit needs something to audit. Send `claims` (an array of statements) or the résumé as `resumeText` / `resumeB64`.',
        accepts: ['claims', 'resumeText', 'resumeB64'],
        example: { claims: ['Grew revenue 300% in 2024', 'Led the payments team'] },
      }

    case 'asy_fit_brief':
      if (hasText(args['jd'], 20)) return OK
      return {
        ok: false,
        code: 'JD_REQUIRED',
        message:
          'A fit brief maps a job description to your evidence, so it needs `jd` (the job description text, 20+ characters). Add `claims` for the evidence side of the map.',
        accepts: ['jd'],
        example: { jd: EXAMPLE_JD, claims: ['Shipped billing v2 to 40k users'] },
      }

    case 'asy_cover_letter':
    case 'asy_story_bank':
    case 'asy_tailor_resume':
    case 'asy_interview_prep': {
      if (hasText(args['dossierId']) || hasClaims(args['claims']) || hasText(args['evidence'], 20))
        return OK
      const label =
        tool === 'asy_cover_letter'
          ? 'cover letter'
          : tool === 'asy_story_bank'
            ? 'story bank'
            : tool === 'asy_tailor_resume'
              ? 'tailored résumé'
              : 'interview prep'
      return {
        ok: false,
        code: 'EVIDENCE_REQUIRED',
        message: `Assay will not write a ${label} it cannot trace. Send \`claims\` (statements you stand behind) with optional \`evidence\`, or a \`dossierId\` from a completed dossier. No payment was taken.`,
        accepts: ['claims', 'evidence', 'dossierId'],
        example: {
          claims: ['Shipped billing v2 to 40k users', 'Cut checkout latency from 900ms to 320ms'],
          evidence: 'Launch post: https://example.com/billing-v2',
          jd: EXAMPLE_JD,
        },
      }
    }

    case 'asy_create_dossier_job':
      if (upload(args)) return OK
      return {
        ok: false,
        code: 'RESUME_REQUIRED',
        message:
          'A dossier is built from your work history, so the job needs `resumeText` or `resumeB64` (base64 PDF/DOCX, with `filename`). Add `jd` for a job dossier, or `variant: "promotion" | "freelance"`.',
        accepts: ['resumeText', 'resumeB64'],
        example: { resumeText: EXAMPLE_RESUME, jd: EXAMPLE_JD, variant: 'job' },
      }

    case 'asy_job_status':
    case 'asy_job_result':
      if (hasText(args['jobId'])) return OK
      return {
        ok: false,
        code: 'JOB_ID_REQUIRED',
        message: 'Send the `jobId` returned by asy_create_dossier_job.',
        accepts: ['jobId'],
        example: { jobId: 'job_abc123' },
      }

    case 'asy_verify':
      if (hasText(args['dossierId']) || hasText(args['leaf'])) return OK
      return {
        ok: false,
        code: 'DOSSIER_OR_LEAF_REQUIRED',
        message: 'Verification needs a `dossierId` (e.g. DSR-WC0Q7NZ7) or a raw commitment `leaf`.',
        accepts: ['dossierId', 'leaf'],
        example: { dossierId: 'DSR-WC0Q7NZ7' },
      }

    default:
      return OK
  }
}

/** The published input contract for one service — served free at /x402/:service/schema. */
export function serviceSchema(slug: string, baseUrl: string): Record<string, unknown> | undefined {
  const target = A2MCP_ROUTE_TARGETS[slug]
  if (!target) return undefined
  const doc = toolDocs().find((d) => d.name === target.tool)
  if (!doc) return undefined
  const problem = preflight(doc.name, { ...(target.defaults ?? {}) })
  return {
    service: slug,
    tool: doc.name,
    title: doc.title,
    summary: doc.marketplaceSummary,
    priceUsdt: doc.priceUsdt,
    endpoint: `${baseUrl}/x402/${slug}`,
    method: 'POST',
    contentType: 'application/json',
    ...(target.defaults ? { serverDefaults: target.defaults } : {}),
    arguments: doc.args,
    aliasesAccepted:
      'Common synonyms are mapped onto these names (resume→resumeText, jobDescription→jd, a single claims string→array).',
    example: problem.ok ? {} : problem.example,
    note: 'Under-specified requests are rejected with HTTP 400 before any payment is taken.',
  }
}
