import type { Claim, Coverage, EvidenceItem, Requirement } from '@xyndicate/assay-core'
import { keywordSet, lemma } from './text'

// DETERMINISTIC coverage mapper — NO LLM. Requirements × claims → Coverage[], scored by keyword
// overlap. 'confirm' when the best-matching claim could cover but is unconfirmed; honest 'missing'
// when nothing matches. We report coverage; we never stuff keywords.

const STRONG = 0.66
const PARTIAL = 0.33

// A claim is an assertion; the evidence it cites is what backs it. Scoring a requirement against
// the claim sentence alone reported "missing" for requirements the candidate's own evidence
// plainly covered — e.g. a stack requirement whose tools are listed in the cited document but not
// re-typed into the claim text. The claim stays the unit of coverage (status still depends on a
// confirmed claim); its evidence simply gets read too.
function claimVocabulary(claim: Claim, evidenceById: Map<string, EvidenceItem>): Set<string> {
  const set = keywordSet(claim.text, claim.tags)
  for (const id of claim.evidenceIds) {
    const item = evidenceById.get(id)
    if (!item?.contentText) continue
    for (const token of keywordSet(item.contentText, [])) set.add(token)
  }
  return set
}

function overlap(req: Requirement, claim: Claim, evidenceById: Map<string, EvidenceItem>): number {
  if (req.keywords.length === 0) return 0
  const set = claimVocabulary(claim, evidenceById)
  const hits = req.keywords.filter((k) => set.has(lemma(k))).length
  return hits / req.keywords.length
}

export function computeCoverage(
  requirements: Requirement[],
  claims: Claim[],
  evidence: EvidenceItem[] = [],
): Coverage[] {
  const evidenceById = new Map(evidence.map((e) => [e.id, e]))
  return requirements.map((req) => scoreRequirement(req, claims, evidenceById))
}

function scoreRequirement(
  req: Requirement,
  claims: Claim[],
  evidenceById: Map<string, EvidenceItem>,
): Coverage {
  const scored = claims
    .map((c) => ({ claim: c, score: overlap(req, c, evidenceById) }))
    .filter((s) => s.score >= PARTIAL)
    .sort((a, b) => b.score - a.score)

  const confirmed = scored.filter((s) => s.claim.status === 'confirmed')
  const bestConfirmed = confirmed[0]?.score ?? 0

  if (bestConfirmed >= STRONG) {
    return {
      requirementId: req.id,
      status: 'strong',
      claimIds: confirmed.filter((s) => s.score >= STRONG).map((s) => s.claim.id),
      note: 'Strong, confirmed evidence covers this requirement.',
    }
  }
  if (bestConfirmed >= PARTIAL) {
    return {
      requirementId: req.id,
      status: 'partial',
      claimIds: confirmed.map((s) => s.claim.id),
      note: 'Partially covered by confirmed evidence; consider strengthening.',
    }
  }
  if (scored.length > 0) {
    // A claim could cover this, but it is not yet confirmed.
    return {
      requirementId: req.id,
      status: 'confirm',
      claimIds: scored.map((s) => s.claim.id),
      note: 'A claim could cover this, but it needs your confirmation first.',
    }
  }
  return {
    requirementId: req.id,
    status: 'missing',
    claimIds: [],
    note: 'No evidence covers this yet — do not claim it.',
  }
}
