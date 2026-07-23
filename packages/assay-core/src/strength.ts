import type { Claim, EvidenceItem, Strength } from './types'

// Deterministic evidence-strength tiers. They never collapse into one dishonest "verified" badge:
// each claim earns exactly one tier, and we can always explain which and why.
export const STRENGTH_ORDER: Record<Strength, number> = {
  attested: 0,
  documented: 1,
  linked: 2,
  sealed: 3,
}

function assertNever(x: never): never {
  throw new Error(`unreachable strength: ${String(x)}`)
}

// attestation-only → attested; any document → documented; any LIVE link (fetchedOk === true) →
// linked. A dead link never earns 'linked'. 'sealed' is terminal and set only post-anchor.
export function computeStrength(claim: Claim, evidence: EvidenceItem[]): Strength {
  if (claim.strength === 'sealed') return 'sealed'

  const byId = new Map(evidence.map((e) => [e.id, e]))
  const items = claim.evidenceIds
    .map((id) => byId.get(id))
    .filter((e): e is EvidenceItem => e !== undefined)

  const hasLiveLink = items.some((e) => e.kind === 'link' && e.fetchedOk === true)
  if (hasLiveLink) return 'linked'

  const hasDocument = items.some((e) => e.kind === 'document')
  if (hasDocument) return 'documented'

  return 'attested'
}

export function applyStrength(claim: Claim, evidence: EvidenceItem[]): Claim {
  return { ...claim, strength: computeStrength(claim, evidence) }
}

export function recomputeStrengths(claims: Claim[], evidence: EvidenceItem[]): Claim[] {
  return claims.map((c) => applyStrength(c, evidence))
}

export function markSealed(claim: Claim): Claim {
  return { ...claim, strength: 'sealed' }
}

export function tierExplanation(claim: Claim): string {
  switch (claim.strength) {
    case 'attested':
      return 'Attested — your word; no supporting file or live link is on record for this claim.'
    case 'documented':
      return 'Documented — backed by a file you provided.'
    case 'linked':
      return 'Linked — backed by a live external source we fetched and confirmed resolves.'
    case 'sealed':
      return 'Sealed — the dossier containing this claim is integrity-anchored on X Layer.'
    default:
      return assertNever(claim.strength)
  }
}
