import { describe, it, expect } from 'vitest'
import { DossierSchema, ArtifactSchema, ClaimSchema, EvidenceItemSchema } from '@xyndicate/assay-core'
import type { Artifact } from '@xyndicate/assay-core'
import { createRouter, FakeFetcher } from '@xyndicate/providers'
import { gradeArtifact, gradeWithRepair, type GradeDeps } from './loop'
import { summarize } from './report'

function baseDossier() {
  return DossierSchema.parse({
    id: 'DSR-LOOP0001',
    tz: 'America/New_York',
    createdAt: '2026-07-01T00:00:00.000Z',
    profile: {
      fullName: 'Chidinma Eze',
      timezone: 'America/New_York',
      contact: { email: 'c@example.com', links: ['https://gh.example'] },
      experiences: [{ org: 'Paystack', title: 'SWE', startYm: '2021-03', endYm: null }],
    },
    evidence: [
      EvidenceItemSchema.parse({ id: 'EV-1', kind: 'document', label: 'resume', sourceRef: 'resume.txt', contentText: 'Reduced latency 38%' }),
    ],
    claims: [
      ClaimSchema.parse({ id: 'CLM-1', text: 'Reduced latency by 38%', status: 'confirmed', evidenceIds: ['EV-1'], numericFacts: [{ value: 38, unit: '%', context: 'latency' }] }),
    ],
  })
}

const deps: GradeDeps = { router: createRouter(), fetcher: new FakeFetcher() }
const clean = (id = 'A1') =>
  ArtifactSchema.parse({ id, kind: 'resume_ats', sentences: [{ text: 'Reduced latency by 38%.', claimIds: ['CLM-1'] }], meta: { html: '<h2>EXPERIENCE</h2><p>ok</p>' } })
const placeholder = (id = 'A1') =>
  ArtifactSchema.parse({ id, kind: 'resume_ats', sentences: [{ text: 'Led work at [COMPANY].', claimIds: ['CLM-1'] }] })

describe('gradeArtifact (fake mode)', () => {
  it('passes a clean artifact and ships a full report', async () => {
    const r = await gradeArtifact(baseDossier(), clean(), deps)
    expect(r.hardPass).toBe(true)
    expect(r.pass).toBe(true)
    expect(r.draftIndex).toBe(0)
    expect(r.craft).toHaveLength(6)
    expect(r.standardVersion).toBe('AS-1.0.0')
  })

  it('fails and attaches a repair brief when a hard check fails', async () => {
    const r = await gradeArtifact(baseDossier(), placeholder(), deps)
    expect(r.hardPass).toBe(false)
    expect(r.pass).toBe(false)
    expect(r.repairBrief).toBeTruthy()
    expect(r.repairBrief).toMatch(/PLACEHOLDER/)
  })
})

describe('gradeWithRepair', () => {
  it('stops after at most 2 repairs and ships every draft report', async () => {
    let calls = 0
    const repair = async (a: Artifact) => {
      calls += 1
      return a // never fixes
    }
    const { reports } = await gradeWithRepair(baseDossier(), placeholder(), deps, repair)
    expect(reports).toHaveLength(3) // drafts 0, 1, 2
    expect(reports[0].draftIndex).toBe(0)
    expect(reports.every((r) => !r.pass)).toBe(true)
    expect(calls).toBe(2)
  })

  it('stops early when a repair fixes the artifact; the failing first draft still persists', async () => {
    const repair = async () => clean()
    const { reports } = await gradeWithRepair(baseDossier(), placeholder(), deps, repair)
    expect(reports).toHaveLength(2)
    expect(reports[0].pass).toBe(false)
    expect(reports[1].pass).toBe(true)
  })
})

describe('summarize', () => {
  it('reports an honest post-repair pass rate', async () => {
    const good = await gradeArtifact(baseDossier(), clean('A1'), deps)
    const bad = await gradeArtifact(baseDossier(), placeholder('A2'), deps)
    const s = summarize([good, bad])
    expect(s.artifacts).toBe(2)
    expect(s.finalPassed).toBe(1)
    expect(s.postRepairPassRate).toBe(50)
  })
})
