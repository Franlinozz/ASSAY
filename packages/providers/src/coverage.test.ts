import { describe, it, expect } from 'vitest'
import { computeCoverage } from './coverage'
import { ClaimSchema } from '@xyndicate/assay-core'
import type { Requirement } from '@xyndicate/assay-core'

const claim = (over: Record<string, unknown>) => ClaimSchema.parse(over)

describe('computeCoverage (deterministic, no LLM)', () => {
  const claims = [
    claim({ id: 'CLM-1', text: 'Built services in TypeScript and Node', status: 'confirmed', evidenceIds: ['EV-1'], tags: ['typescript', 'node'] }),
    claim({ id: 'CLM-2', text: 'Optimized PostgreSQL queries', status: 'confirmed', evidenceIds: ['EV-2'], tags: ['postgresql'] }),
    claim({ id: 'CLM-3', text: 'Deployed on Kubernetes clusters', status: 'extracted', evidenceIds: ['EV-3'], tags: ['kubernetes'] }),
  ]
  const req = (id: string, keywords: string[]): Requirement => ({ id, text: keywords.join(' '), kind: 'must', keywords })

  it('scores strong / partial / confirm / missing honestly', () => {
    const reqs = [
      req('R1', ['typescript', 'node']), // both in confirmed CLM-1 → strong
      req('R2', ['postgresql', 'indexing']), // 1/2 in confirmed CLM-2 → partial
      req('R3', ['kubernetes', 'helm']), // 1/2 only in UNCONFIRMED CLM-3 → confirm
      req('R4', ['rust', 'embedded']), // nothing → missing
    ]
    const byId = Object.fromEntries(computeCoverage(reqs, claims).map((c) => [c.requirementId, c.status]))
    expect(byId['R1']).toBe('strong')
    expect(byId['R2']).toBe('partial')
    expect(byId['R3']).toBe('confirm')
    expect(byId['R4']).toBe('missing')
  })

  it('missing coverage advises not to claim it', () => {
    const cov = computeCoverage([req('R4', ['rust', 'embedded'])], claims)
    expect(cov[0].note).toMatch(/do not claim/i)
  })
})
