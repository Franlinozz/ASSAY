import type { Claim, EvidenceItem, Sentence } from './types'

// The claim gate is the load-bearing guardrail: no rendered sentence survives without
// claimIds[] resolving to confirmed claims backed by existing evidence, and no number in a
// sentence survives unless it appears in a cited claim's numericFacts. Enforced in code — an
// injected or hallucinated statement with no evidence simply produces a finding, never prose.

export type FindingCode =
  'UNSUPPORTED_SENTENCE' | 'UNCONFIRMED_CLAIM' | 'DANGLING_EVIDENCE' | 'NUMBER_NOT_IN_EVIDENCE'

export interface Finding {
  code: FindingCode
  ref: string
  detail: string
}

export interface NormalizedNumber {
  raw: string
  value: number
  unit: string
}

// Matches quantities: optional $ prefix, an integer (with thousands commas) or decimal, and an
// optional unit suffix. "40%", "40 percent", "$1,200", "3x", "10k", "5". The leading (?<![A-Za-z])
// means digits glued to letters (p95, h2, v4, COVID19) are NOT read as claimed quantities.
const NUMBER_RE =
  /(?<![A-Za-z0-9])(\$)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(%|percent\b|pct\b|x\b|k\b|m\b|bn\b|b\b)?/gi

export function extractNumbers(text: string): NormalizedNumber[] {
  const out: NormalizedNumber[] = []
  for (const m of text.matchAll(NUMBER_RE)) {
    const dollar = m[1] ? '$' : ''
    const digits = (m[2] ?? '').replace(/,/g, '')
    const value = Number.parseFloat(digits)
    if (Number.isNaN(value)) continue
    out.push({ raw: m[0].trim(), value, unit: `${dollar}${canonUnit(m[3] ?? '')}` })
  }
  return out
}

// Canonical unit classes for value+unit comparison. Live extraction writes descriptive units
// ("percent", "requests per second", "junior engineers") that prose can never carry as a regex
// suffix — those compare on VALUE alone (the embellishment protection is the value: "40%" still
// never matches {value:30}). Suffix-expressible units keep their strict class.
export function canonUnit(unit: string): string {
  const t = unit.trim().toLowerCase()
  if (t === '%' || t === 'percent' || t === 'pct') return '%'
  if (t === '$' || t === 'usd' || t === 'dollars') return '$'
  if (t === 'bn') return 'b'
  if (t === 'x' || t === 'k' || t === 'm' || t === 'b') return t
  return '' // descriptive unit → value-only match
}

// Normalized key for value+unit comparison. "30%" from a sentence and {value:30,unit:'%'}
// from a claim produce the same key; "40%" does not match {value:30,unit:'%'}.
function numberKey(value: number, unit: string): string {
  return `${value}|${unit.toLowerCase()}`
}

function factKeys(claims: Claim[]): Set<string> {
  const keys = new Set<string>()
  for (const c of claims) {
    for (const f of c.numericFacts) {
      const canon = canonUnit(f.unit ?? '')
      keys.add(numberKey(f.value, canon))
      // A strict-unit fact also authorizes its bare-value mention ("latency down 38" citing the
      // 38% claim) — the value is the protected quantity.
      if (canon !== '') keys.add(numberKey(f.value, ''))
    }
  }
  return keys
}

export function assertRenderable(
  sentences: Sentence[],
  claims: Claim[],
  evidence: EvidenceItem[],
): Finding[] {
  const findings: Finding[] = []
  const claimById = new Map(claims.map((c) => [c.id, c]))
  const evidenceIds = new Set(evidence.map((e) => e.id))

  for (const s of sentences) {
    const cited: Claim[] = []

    if (s.claimIds.length === 0) {
      findings.push({
        code: 'UNSUPPORTED_SENTENCE',
        ref: s.text,
        detail: 'sentence cites no claim',
      })
    }

    for (const cid of s.claimIds) {
      const claim = claimById.get(cid)
      if (!claim) {
        findings.push({
          code: 'UNSUPPORTED_SENTENCE',
          ref: s.text,
          detail: `cites missing claim ${cid}`,
        })
        continue
      }
      cited.push(claim)

      if (claim.status !== 'confirmed') {
        findings.push({
          code: 'UNCONFIRMED_CLAIM',
          ref: claim.id,
          detail: `claim status is "${claim.status}", not "confirmed"`,
        })
      }

      if (claim.evidenceIds.length === 0) {
        findings.push({
          code: 'DANGLING_EVIDENCE',
          ref: claim.id,
          detail: 'claim has no evidence',
        })
      }
      for (const eid of claim.evidenceIds) {
        if (!evidenceIds.has(eid)) {
          findings.push({
            code: 'DANGLING_EVIDENCE',
            ref: claim.id,
            detail: `evidence ${eid} not found`,
          })
        }
      }
    }

    // Every number in the sentence must appear in a cited claim's numericFacts.
    const keys = factKeys(cited)
    for (const n of extractNumbers(s.text)) {
      if (!keys.has(numberKey(n.value, n.unit))) {
        findings.push({
          code: 'NUMBER_NOT_IN_EVIDENCE',
          ref: `${s.text} :: ${n.raw}`,
          detail: `figure ${n.raw} is not in the cited evidence`,
        })
      }
    }
  }

  return findings
}

export function isRenderable(
  sentences: Sentence[],
  claims: Claim[],
  evidence: EvidenceItem[],
): boolean {
  return assertRenderable(sentences, claims, evidence).length === 0
}

function questionFor(f: Finding): string {
  switch (f.code) {
    case 'UNSUPPORTED_SENTENCE':
      return `This line has no supporting claim: "${f.ref}". What evidence backs it — or should we drop it?`
    case 'UNCONFIRMED_CLAIM':
      return `Claim ${f.ref} isn't confirmed yet. Can you confirm it's accurate, or should we set it aside?`
    case 'DANGLING_EVIDENCE':
      return `Claim ${f.ref} points to evidence we can't find. Which document or link supports it?`
    case 'NUMBER_NOT_IN_EVIDENCE':
      return `The figure in "${f.ref}" isn't in your evidence. What's the exact number, and where's it from?`
  }
}

// Turns gate findings into user-facing questions (guardrail #1: unsupported becomes a question,
// never prose). De-duplicated, order preserved.
export function toQuestions(findings: Finding[]): string[] {
  const seen = new Set<string>()
  const questions: string[] = []
  for (const f of findings) {
    const q = questionFor(f)
    if (!seen.has(q)) {
      seen.add(q)
      questions.push(q)
    }
  }
  return questions
}
