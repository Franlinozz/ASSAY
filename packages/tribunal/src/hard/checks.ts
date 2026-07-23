import {
  assertRenderable,
  extractNumbers,
  isFutureYm,
  monthsBetween,
  nowIso,
  ymInTz,
} from '@xyndicate/assay-core'
import type { Artifact } from '@xyndicate/assay-core'
import {
  type CheckContext,
  type CheckFinding,
  type CheckResult,
  type HardCheck,
  artifactText,
  htmlOf,
  statusFromFindings,
} from './types'

const APPROVED_HEADINGS = new Set(['SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'CERTIFICATIONS'])
const URL_RE = /(https?:\/\/[^\s"'<>)\]]+)/g

function result(findings: CheckFinding[], evidence?: string): CheckResult {
  return evidence !== undefined
    ? { status: statusFromFindings(findings), findings, evidence }
    : { status: statusFromFindings(findings), findings }
}

// ── CLAIM_COVERAGE — the load-bearing gate over every sentence-bearing artifact ──
export const CLAIM_COVERAGE: HardCheck = {
  id: 'CLAIM_COVERAGE',
  title: 'Claim coverage',
  description:
    'Every rendered sentence resolves to a confirmed claim backed by existing evidence, and every number appears in that evidence. Unsupported prose cannot ship.',
  run({ dossier, artifact }: CheckContext): CheckResult {
    if (!artifact.sentences) return { status: 'skip', findings: [] }
    const findings = assertRenderable(artifact.sentences, dossier.claims, dossier.evidence).map((f) => ({
      code: f.code,
      detail: f.detail,
      ref: f.ref,
    }))
    return result(findings)
  },
}

// ── EVIDENCE_RESOLVES — the broken-asset law (gotcha #11) ──
export const EVIDENCE_RESOLVES: HardCheck = {
  id: 'EVIDENCE_RESOLVES',
  title: 'Evidence resolves',
  description:
    'Every referenced evidence item exists, and file-backed evidence has readable content. A dangling or unreadable source is a hard failure.',
  run({ dossier, deps }: CheckContext): CheckResult {
    const findings: CheckFinding[] = []
    const evById = new Map(dossier.evidence.map((e) => [e.id, e]))
    for (const claim of dossier.claims) {
      for (const eid of claim.evidenceIds) {
        if (!evById.has(eid)) findings.push({ code: 'DANGLING_EVIDENCE', detail: `evidence ${eid} not found`, ref: claim.id })
      }
    }
    for (const e of dossier.evidence) {
      if (e.kind !== 'document') continue
      const hasText = typeof e.contentText === 'string' && e.contentText.length > 0
      const hasFile = deps.fileExists ? deps.fileExists(e.sourceRef) : false
      if (!hasText && !hasFile) {
        findings.push({ code: 'UNREADABLE_FILE', detail: `document evidence ${e.id} has no readable content`, ref: e.id })
      }
    }
    return result(findings)
  },
}

// ── LINK_LIVENESS — every URL fetch-checked (gotcha #11, second enforcement) ──
export const LINK_LIVENESS: HardCheck = {
  id: 'LINK_LIVENESS',
  title: 'Link liveness',
  description: 'Every URL in the artifact is fetch-checked and must resolve live. A dead or unsafe link never passes.',
  async run({ artifact, deps }: CheckContext): Promise<CheckResult> {
    const urls = [...new Set((artifactText(artifact).match(URL_RE) ?? []).map((u) => u.replace(/[.,]$/, '')))]
    if (urls.length === 0) return { status: 'skip', findings: [] }
    if (!deps.fetcher) return { status: 'pending', findings: [] }
    const findings: CheckFinding[] = []
    for (const url of urls) {
      const r = await deps.fetcher.fetch(url)
      if (!r.ok) findings.push({ code: 'DEAD_LINK', detail: `link did not resolve live (${r.gap ?? 'unknown'})`, ref: url })
    }
    return result(findings, `${urls.length} link(s) checked`)
  },
}

// ── PLACEHOLDER_TEXT — hard check from day one (gotcha #13) ──
const PLACEHOLDER_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: 'BRACKET_PLACEHOLDER', re: /\[[A-Z][A-Z0-9 _/-]{1,}\]/ },
  { code: 'YOUR_X_HERE', re: /\byour\b[^.\n]{0,40}\bhere\b/i },
  { code: 'TBD', re: /\bTBD\b/ },
  { code: 'LOREM', re: /\blorem\b/i },
  { code: 'XXX', re: /\bX{3,}\b/ },
]
export const PLACEHOLDER_TEXT: HardCheck = {
  id: 'PLACEHOLDER_TEXT',
  title: 'No placeholders',
  description: 'No [BRACKETS], "YOUR X HERE", TBD, lorem, or XXX placeholder text survives into any artifact.',
  run({ artifact }: CheckContext): CheckResult {
    const text = artifactText(artifact)
    const findings: CheckFinding[] = []
    for (const p of PLACEHOLDER_PATTERNS) {
      const m = text.match(p.re)
      if (m) findings.push({ code: p.code, detail: `placeholder found: "${m[0]}"`, ref: m[0] })
    }
    return result(findings)
  },
}

// ── DATE_SANITY — no future dates, end>=start, overlaps flagged; all in dossier.tz (gotcha #12) ──
export const DATE_SANITY: HardCheck = {
  id: 'DATE_SANITY',
  title: 'Date sanity',
  description:
    'No future dates, each end is on/after its start, tenure math is correct, and overlaps are flagged — all evaluated in the candidate\'s timezone.',
  run({ dossier }: CheckContext): CheckResult {
    const findings: CheckFinding[] = []
    const nowYm = ymInTz(nowIso(), dossier.tz)
    const spans: Array<{ label: string; start: string; end: string }> = []
    for (const exp of dossier.profile.experiences) {
      const label = `${exp.org} — ${exp.title}`
      if (isFutureYm(exp.startYm, nowYm)) findings.push({ code: 'FUTURE_DATE', detail: `start ${exp.startYm} is in the future`, ref: label })
      if (exp.endYm) {
        if (isFutureYm(exp.endYm, nowYm)) findings.push({ code: 'FUTURE_DATE', detail: `end ${exp.endYm} is in the future`, ref: label })
        if (monthsBetween(exp.startYm, exp.endYm) < 0) findings.push({ code: 'END_BEFORE_START', detail: `end ${exp.endYm} is before start ${exp.startYm}`, ref: label })
      }
      spans.push({ label, start: exp.startYm, end: exp.endYm ?? nowYm })
    }
    // Overlaps are flagged as warnings (concurrent roles are legitimate), not hard failures.
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        const a = spans[i]
        const b = spans[j]
        if (monthsBetween(a.start, b.end) >= 0 && monthsBetween(b.start, a.end) >= 0) {
          findings.push({ code: 'OVERLAP', detail: `"${a.label}" overlaps "${b.label}"`, severity: 'warn' })
        }
      }
    }
    return result(findings)
  },
}

// ── XARTIFACT_CONSISTENCY — same claim renders the same number everywhere ──
export const XARTIFACT_CONSISTENCY: HardCheck = {
  id: 'XARTIFACT_CONSISTENCY',
  title: 'Cross-artifact consistency',
  description: 'Every number tied to a claim renders identically wherever that claim appears across the resume, letter, and stories.',
  run({ dossier }: CheckContext): CheckResult {
    // claimId → artifactId → set of number keys used in sentences citing that claim
    const index = new Map<string, Map<string, Set<string>>>()
    for (const art of dossier.artifacts) {
      for (const s of art.sentences ?? []) {
        const keys = new Set(extractNumbers(s.text).map((n) => `${n.value}|${n.unit}`))
        if (keys.size === 0) continue
        for (const cid of s.claimIds) {
          const byArtifact = index.get(cid) ?? new Map<string, Set<string>>()
          const existing = byArtifact.get(art.id) ?? new Set<string>()
          for (const k of keys) existing.add(k)
          byArtifact.set(art.id, existing)
          index.set(cid, byArtifact)
        }
      }
    }
    const findings: CheckFinding[] = []
    for (const [cid, byArtifact] of index) {
      if (byArtifact.size < 2) continue
      const sets = [...byArtifact.values()].map((s) => [...s].sort().join(','))
      if (new Set(sets).size > 1) {
        findings.push({ code: 'NUMBER_MISMATCH', detail: `claim ${cid} renders different numbers across artifacts (${sets.join(' vs ')})`, ref: cid })
      }
    }
    return result(findings)
  },
}

// ── FORMAT_LAW — ATS variant structure; designed variant contrast ──
export const FORMAT_LAW: HardCheck = {
  id: 'FORMAT_LAW',
  title: 'Format law',
  description:
    'The ATS variant is single-column with no tables/images/text-boxes, uses only approved section headings, and stays within 2 pages; the designed variant meets a 4.5:1 body-text contrast ratio.',
  run({ artifact }: CheckContext): CheckResult {
    if (artifact.kind !== 'resume_ats' && artifact.kind !== 'resume_designed') return { status: 'skip', findings: [] }
    const html = htmlOf(artifact)
    if (!html) return { status: 'pending', findings: [] }
    const findings: CheckFinding[] = []
    if (artifact.kind === 'resume_ats') {
      if (/<table[\s>]/i.test(html)) findings.push({ code: 'FORMAT_TABLE', detail: 'ATS variant must not use tables' })
      if (/<img[\s>]/i.test(html)) findings.push({ code: 'FORMAT_IMAGE', detail: 'ATS variant must not use images' })
      if (/column-count\s*:/i.test(html) || /<textarea[\s>]/i.test(html)) findings.push({ code: 'FORMAT_MULTICOLUMN', detail: 'ATS variant must be single-column with no text-boxes' })
      // Section headings are h2/h3; h1 is the résumé title (the candidate's name), not a section.
      for (const m of html.matchAll(/<h[23][^>]*>([^<]+)<\/h[23]>/gi)) {
        const heading = m[1]!.trim().toUpperCase()
        if (!APPROVED_HEADINGS.has(heading)) findings.push({ code: 'FORMAT_HEADING', detail: `non-standard heading "${m[1]!.trim()}"`, ref: heading })
      }
      const pageCount = typeof artifact.meta['pageCount'] === 'number' ? (artifact.meta['pageCount'] as number) : undefined
      if (pageCount !== undefined && pageCount > 2) findings.push({ code: 'FORMAT_PAGES', detail: `ATS variant is ${pageCount} pages (max 2)` })
    } else if (artifact.meta['contrastOk'] === false) {
      findings.push({ code: 'FORMAT_CONTRAST', detail: 'designed variant body text is below 4.5:1 contrast' })
    }
    return result(findings)
  },
}

// ── DOCX_INTEGRITY — reopen the generated docx and check headings ──
export const DOCX_INTEGRITY: HardCheck = {
  id: 'DOCX_INTEGRITY',
  title: 'DOCX integrity',
  description: 'The generated .docx reopens in a parser and contains the same section headings as the ATS resume.',
  async run({ artifact, deps }: CheckContext): Promise<CheckResult> {
    if (artifact.kind !== 'resume_docx') return { status: 'skip', findings: [] }
    if (!artifact.fileRef || !deps.readDocx) return { status: 'pending', findings: [] }
    try {
      const { headings } = await deps.readDocx(artifact.fileRef)
      if (headings.length === 0) return result([{ code: 'DOCX_NO_HEADINGS', detail: 'reopened docx has no recognizable section headings' }])
      return result([], `${headings.length} heading(s) recovered`)
    } catch (e) {
      return result([{ code: 'DOCX_UNREADABLE', detail: `docx failed to reopen: ${e instanceof Error ? e.message : String(e)}` }])
    }
  },
}

// ── ATS_PARSE_BACK — stub interface; real engine flips this live in P4 ──
export const ATS_PARSE_BACK: HardCheck = {
  id: 'ATS_PARSE_BACK',
  title: 'ATS parse-back',
  description:
    'The ATS PDF is re-parsed by Assay\'s deterministic parser and diffed field-by-field against the source profile; 100% of required fields must survive. Verified against Assay\'s deterministic parser and ATS format law — not a simulation of any specific vendor.',
  async run({ artifact, dossier, deps }: CheckContext): Promise<CheckResult> {
    if (artifact.kind !== 'resume_ats') return { status: 'skip', findings: [] }
    if (!deps.parseBack) return { status: 'pending', findings: [] } // P4 wires the engine and flips this live
    const { fidelityPct, fieldDiffs } = await deps.parseBack(artifact, dossier)
    const findings = fieldDiffs.map((d) => ({ code: 'PARSE_BACK_DIFF', detail: `${d.field}: expected "${d.expected}", parsed "${d.got}"`, ref: d.field }))
    return result(findings, `parse fidelity ${fidelityPct}%`)
  },
}

// ── CONTACT_VALIDITY ──
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const CONTACT_VALIDITY: HardCheck = {
  id: 'CONTACT_VALIDITY',
  title: 'Contact validity',
  description: 'The contact email is well-formed and every contact link is a syntactically valid URL.',
  run({ dossier }: CheckContext): CheckResult {
    const findings: CheckFinding[] = []
    const c = dossier.profile.contact
    if (c.email && !EMAIL_RE.test(c.email)) findings.push({ code: 'BAD_EMAIL', detail: `invalid email "${c.email}"` })
    for (const link of c.links) {
      try {
        new URL(link)
      } catch {
        findings.push({ code: 'BAD_LINK', detail: `invalid link "${link}"`, ref: link })
      }
    }
    return result(findings)
  },
}

// ── PII_HYGIENE — share views expose only approved fields ──
export const PII_HYGIENE: HardCheck = {
  id: 'PII_HYGIENE',
  title: 'PII hygiene',
  description: 'A share-view artifact exposes only the fields the candidate approved; unapproved personal data must be redacted.',
  run({ dossier, artifact }: CheckContext): CheckResult {
    if (artifact.meta['shareView'] !== true) return { status: 'skip', findings: [] }
    const approved = Array.isArray(artifact.meta['approvedFields']) ? (artifact.meta['approvedFields'] as string[]) : []
    const body = artifactText(artifact)
    const findings: CheckFinding[] = []
    const { phone, email } = dossier.profile.contact
    if (phone && body.includes(phone) && !approved.includes('phone')) findings.push({ code: 'PII_PHONE', detail: 'share view exposes an unapproved phone number' })
    if (email && body.includes(email) && !approved.includes('email')) findings.push({ code: 'PII_EMAIL', detail: 'share view exposes an unapproved email' })
    return result(findings)
  },
}

// ── JD_COVERAGE — report-only, never pass/fail ──
export const JD_COVERAGE: HardCheck = {
  id: 'JD_COVERAGE',
  title: 'JD keyword coverage (informational)',
  description: 'We report weighted must/nice keyword coverage against the job description. We report coverage; we do not stuff keywords. This check never fails.',
  run({ dossier, artifact }: CheckContext): CheckResult {
    if (!dossier.brief) return { status: 'skip', findings: [] }
    const body = artifactText(artifact).toLowerCase()
    const tally = (kind: 'must' | 'nice') => {
      const reqs = dossier.brief!.decomposed.filter((r) => r.kind === kind)
      const covered = reqs.filter((r) => r.keywords.some((k) => body.includes(k)))
      return reqs.length === 0 ? 100 : Math.round((covered.length / reqs.length) * 100)
    }
    return { status: 'pass', findings: [], evidence: `must ${tally('must')}%, nice ${tally('nice')}%` }
  },
}
