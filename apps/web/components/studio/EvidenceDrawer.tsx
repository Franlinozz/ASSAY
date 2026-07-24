'use client'

import { EvidenceThreads } from '../EvidenceThreads'
import { TIERS, type Tier } from '../../lib/site'
import type { ForgeArtifact, StudioClaim, StudioEvidence } from '../../lib/studio'

// The evidence drawer: click any sentence and its proof lights up via threads. This is the hero
// interaction, running for real on the dossier's own forged sentences.
export function EvidenceDrawer({
  artifact,
  claims,
  evidence,
}: {
  artifact: ForgeArtifact
  claims: StudioClaim[]
  evidence: StudioEvidence[]
}) {
  const claimById = new Map(claims.map((c) => [c.id, c]))
  const evTier = new Map<string, Tier>()
  for (const c of claims) for (const eid of c.evidenceIds) evTier.set(eid, c.tier)

  const used = new Set<string>()
  const bullets = artifact.sentences.map((s, i) => {
    const eids = new Set<string>()
    for (const cid of s.claimIds) {
      for (const eid of claimById.get(cid)?.evidenceIds ?? []) {
        eids.add(eid)
        used.add(eid)
      }
    }
    return { id: `s${i}`, text: s.text, evidenceIds: [...eids] }
  })

  const cards = evidence
    .filter((e) => used.has(e.id))
    .map((e) => {
      const tier = evTier.get(e.id) ?? 'attested'
      return { id: e.id, tier, label: e.label, detail: TIERS[tier].explanation }
    })

  if (bullets.length === 0 || cards.length === 0) {
    return (
      <p className="caption" style={{ padding: '1rem 0' }}>
        This artifact is structured (no prose to thread) — its integrity is decided by the hard
        checks in the Report.
      </p>
    )
  }

  return (
    <EvidenceThreads
      heading={`${artifact.kind.replace(/_/g, ' ')} — your evidence`}
      subheading="click a line to see its proof"
      bullets={bullets}
      evidence={cards}
      testId="evidence-drawer"
    />
  )
}
