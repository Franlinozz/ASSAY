import { describe, it, expect } from 'vitest'
import { computeStrength, tierExplanation, recomputeStrengths, markSealed } from './strength'
import { ClaimSchema, EvidenceItemSchema } from './schemas'
import type { Strength } from './types'

const ev = (over: Record<string, unknown> = {}) =>
  EvidenceItemSchema.parse({ kind: 'document', label: 'd', sourceRef: 'r', ...over })
const claim = (over: Record<string, unknown> = {}) => ClaimSchema.parse({ text: 't', ...over })

describe('strength tiers', () => {
  it('attestation only → attested', () => {
    const e = ev({ id: 'EV-a', kind: 'attestation' })
    expect(computeStrength(claim({ evidenceIds: ['EV-a'] }), [e])).toBe('attested')
  })

  it('a document → documented', () => {
    const e = ev({ id: 'EV-d', kind: 'document' })
    expect(computeStrength(claim({ evidenceIds: ['EV-d'] }), [e])).toBe('documented')
  })

  it('a live link (fetchedOk true) → linked', () => {
    const e = ev({ id: 'EV-l', kind: 'link', fetchedOk: true })
    expect(computeStrength(claim({ evidenceIds: ['EV-l'] }), [e])).toBe('linked')
  })

  it('a DEAD link never earns linked (fetchedOk false → attested)', () => {
    const e = ev({ id: 'EV-l', kind: 'link', fetchedOk: false })
    expect(computeStrength(claim({ evidenceIds: ['EV-l'] }), [e])).toBe('attested')
  })

  it('a dead link plus a document → documented, not linked', () => {
    const dead = ev({ id: 'EV-l', kind: 'link', fetchedOk: false })
    const doc = ev({ id: 'EV-d', kind: 'document' })
    expect(computeStrength(claim({ evidenceIds: ['EV-l', 'EV-d'] }), [dead, doc])).toBe('documented')
  })

  it('sealed is terminal', () => {
    expect(computeStrength(claim({ strength: 'sealed', evidenceIds: [] }), [])).toBe('sealed')
    expect(markSealed(claim()).strength).toBe('sealed')
  })

  it('tierExplanation differs per tier and never collapses into one badge', () => {
    const all = (['attested', 'documented', 'linked', 'sealed'] as Strength[]).map((s) =>
      tierExplanation(claim({ strength: s })),
    )
    expect(new Set(all).size).toBe(4)
    expect(tierExplanation(claim({ strength: 'linked' }))).toContain('live')
  })

  it('recomputeStrengths maps across a list', () => {
    const doc = ev({ id: 'EV-d', kind: 'document' })
    const claims = [claim({ id: 'CLM-1', evidenceIds: ['EV-d'] })]
    expect(recomputeStrengths(claims, [doc])[0].strength).toBe('documented')
  })
})
