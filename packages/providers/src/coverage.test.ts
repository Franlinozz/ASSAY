import { describe, it, expect } from 'vitest'
import { computeCoverage } from './coverage'
import { keywordSet, normalizeKeywords } from './text'
import { ClaimSchema } from '@xyndicate/assay-core'
import type { Requirement } from '@xyndicate/assay-core'

const claim = (over: Record<string, unknown>) => ClaimSchema.parse(over)

describe('computeCoverage (deterministic, no LLM)', () => {
  const claims = [
    claim({
      id: 'CLM-1',
      text: 'Built services in TypeScript and Node',
      status: 'confirmed',
      evidenceIds: ['EV-1'],
      tags: ['typescript', 'node'],
    }),
    claim({
      id: 'CLM-2',
      text: 'Optimized PostgreSQL queries',
      status: 'confirmed',
      evidenceIds: ['EV-2'],
      tags: ['postgresql'],
    }),
    claim({
      id: 'CLM-3',
      text: 'Deployed on Kubernetes clusters',
      status: 'extracted',
      evidenceIds: ['EV-3'],
      tags: ['kubernetes'],
    }),
  ]
  const req = (id: string, keywords: string[]): Requirement => ({
    id,
    text: keywords.join(' '),
    kind: 'must',
    keywords,
  })

  it('scores strong / partial / confirm / missing honestly', () => {
    const reqs = [
      req('R1', ['typescript', 'node']), // both in confirmed CLM-1 → strong
      req('R2', ['postgresql', 'indexing']), // 1/2 in confirmed CLM-2 → partial
      req('R3', ['kubernetes', 'helm']), // 1/2 only in UNCONFIRMED CLM-3 → confirm
      req('R4', ['rust', 'embedded']), // nothing → missing
    ]
    const byId = Object.fromEntries(
      computeCoverage(reqs, claims).map((c) => [c.requirementId, c.status]),
    )
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

describe('a claim is scored with the evidence behind it', () => {
  // Regression: a requirement naming a toolchain was reported "missing" even though the cited
  // evidence listed that exact stack — overlap() only read the claim sentence and its tags.
  const claim = {
    id: 'CLM-STACK',
    text: 'Ran the platform team',
    evidenceIds: ['EV-1'],
    status: 'confirmed' as const,
    strength: 'documented' as const,
    numericFacts: [],
    tags: [],
  }
  const evidence = [
    {
      id: 'EV-1',
      kind: 'document' as const,
      label: 'platform.pdf',
      sourceRef: 'platform.pdf',
      contentText: 'Operated Kubernetes and Terraform with Prometheus and Grafana dashboards.',
      addedAt: '2026-07-01T00:00:00.000Z',
    },
  ]
  const requirement = {
    id: 'REQ-STACK',
    text: 'Kubernetes, Terraform, Prometheus/Grafana',
    keywords: ['kubernetes', 'terraform', 'prometheus', 'grafana'],
    weight: 1,
    kind: 'must' as const,
  }

  it('reports missing when only the claim sentence is read', () => {
    const [cov] = computeCoverage([requirement], [claim])
    expect(cov?.status).toBe('missing')
  })

  it('finds the coverage once the cited evidence is supplied', () => {
    const [cov] = computeCoverage([requirement], [claim], evidence)
    expect(cov?.status).toBe('strong')
    expect(cov?.claimIds).toContain('CLM-STACK')
  })

  it('still reports missing when nothing — claim or evidence — covers it', () => {
    const unrelated = { ...requirement, id: 'REQ-X', keywords: ['welding', 'forklift'] }
    const [cov] = computeCoverage([unrelated], [claim], evidence)
    expect(cov?.status).toBe('missing')
  })
})

// A live buyer's fit brief reported "Working knowledge of ICH-GCP" as MISSING against a claim that
// read "Completed ICH-GCP training (TCD Clinical Research Facility, March 2024)". The requirement
// side kept keywords down to three characters; the claim side threw away anything under four. Every
// acronym requirement was unmatchable, and the resulting "missing" looked like an honest finding.
describe('coverage: acronym requirements are matchable', () => {
  const evidence = [
    {
      id: 'EVD-GCP',
      kind: 'attestation' as const,
      label: 'Training record',
      sourceRef: 'agent-input',
      contentText: 'Completed ICH-GCP training at the TCD Clinical Research Facility, March 2024.',
      addedAt: '2026-07-01T00:00:00.000Z',
    },
  ]
  const claim = {
    id: 'CLM-GCP',
    text: 'Completed ICH-GCP training (TCD Clinical Research Facility, March 2024)',
    evidenceIds: ['EVD-GCP'],
    strength: 'attested' as const,
    status: 'confirmed' as const,
    numericFacts: [],
    tags: [],
  }
  const requirement = {
    id: 'REQ-GCP',
    text: 'Working knowledge of ICH-GCP; certification within 6 months',
    keywords: normalizeKeywords(['Working knowledge of ICH-GCP; certification within 6 months']),
    weight: 1,
    kind: 'must' as const,
  }

  it('keeps three-letter acronyms on both sides of the match', () => {
    expect(requirement.keywords).toContain('ich')
    expect(requirement.keywords).toContain('gcp')
    expect(keywordSet(claim.text)).toContain('gcp')
  })

  it('reports partial, not missing — training is evidence, certification is not yet', () => {
    const [cov] = computeCoverage([requirement], [claim], evidence)
    expect(cov?.status).toBe('partial')
    expect(cov?.claimIds).toContain('CLM-GCP')
  })

  it('does not start matching genuinely unrelated acronyms', () => {
    const unrelated = { ...requirement, id: 'REQ-FAA', keywords: ['faa', 'part', 'pilot'] }
    const [cov] = computeCoverage([unrelated], [claim], evidence)
    expect(cov?.status).toBe('missing')
  })
})
