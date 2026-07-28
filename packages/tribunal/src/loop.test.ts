import { describe, it, expect } from 'vitest'
import {
  DossierSchema,
  ArtifactSchema,
  ClaimSchema,
  EvidenceItemSchema,
} from '@xyndicate/assay-core'
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
      EvidenceItemSchema.parse({
        id: 'EV-1',
        kind: 'document',
        label: 'resume',
        sourceRef: 'resume.txt',
        contentText: 'Reduced latency 38%',
      }),
    ],
    claims: [
      ClaimSchema.parse({
        id: 'CLM-1',
        text: 'Reduced latency by 38%',
        status: 'confirmed',
        evidenceIds: ['EV-1'],
        numericFacts: [{ value: 38, unit: '%', context: 'latency' }],
      }),
    ],
  })
}

const deps: GradeDeps = { router: createRouter(), fetcher: new FakeFetcher() }
const clean = (id = 'A1') =>
  ArtifactSchema.parse({
    id,
    kind: 'resume_ats',
    sentences: [{ text: 'Reduced latency by 38%.', claimIds: ['CLM-1'] }],
    meta: { html: '<h2>EXPERIENCE</h2><p>ok</p>' },
  })
const placeholder = (id = 'A1') =>
  ArtifactSchema.parse({
    id,
    kind: 'resume_ats',
    sentences: [{ text: 'Led work at [COMPANY].', claimIds: ['CLM-1'] }],
  })

describe('gradeArtifact (fake mode)', () => {
  it('passes a clean artifact and ships a full report', async () => {
    const r = await gradeArtifact(baseDossier(), clean(), deps)
    expect(r.hardPass).toBe(true)
    expect(r.pass).toBe(true)
    expect(r.draftIndex).toBe(0)
    expect(r.craft).toHaveLength(6)
    expect(r.standardVersion).toBe('AS-1.1.0')
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

  it('does not spend repair calls on a deterministic blocker the writer cannot change', async () => {
    let calls = 0
    const repair = async (a: Artifact) => {
      calls += 1
      return a
    }
    const { reports } = await gradeWithRepair(baseDossier(), placeholder(), deps, repair, {
      shouldRepair: (report) =>
        !report.hard.some(
          (check) =>
            check.status === 'fail' &&
            check.findings.some((finding) => finding.code === 'BRACKET_PLACEHOLDER'),
        ),
    })
    expect(reports).toHaveLength(1)
    expect(calls).toBe(0)
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

describe('an empty prose artifact is a non-delivery, never a pass', () => {
  // Regression: a paid Career Dossier once shipped nine blank files graded 9/9 PASS. A prose
  // artifact rendered with zero sentences used to be misread as a "structured" artifact, which is
  // decided by hard checks alone and passed vacuously.
  const emptyProse = (kind: string) =>
    ArtifactSchema.parse({ id: `A-${kind}`, kind, sentences: [], meta: {} })

  it('refuses every prose kind that renders empty', async () => {
    for (const kind of [
      'resume_ats',
      'resume_designed',
      'cover_letter',
      'story_bank',
      'portfolio_page',
    ]) {
      const report = await gradeArtifact(baseDossier(), emptyProse(kind) as Artifact, deps)
      expect(report.pass, kind).toBe(false)
      expect(report.hardPass, kind).toBe(false)
      expect(report.gradeStatus, kind).toBe('not_delivered')
      expect(report.repairBrief, kind).toMatch(/empty/i)
    }
  })

  it('still grades genuinely structured artifacts on hard checks alone', async () => {
    // manifest_json and resume_docx legitimately carry no sentences — they must not be swept up.
    const structured = ArtifactSchema.parse({
      id: 'A-json',
      kind: 'manifest_json',
      sentences: [],
      meta: {},
    })
    const report = await gradeArtifact(baseDossier(), structured as Artifact, deps)
    expect(report.gradeStatus).not.toBe('not_delivered')
  })

  it('excludes the empty artifacts from the pass rate instead of inflating it', async () => {
    const reports = await Promise.all([
      gradeArtifact(baseDossier(), clean('A1'), deps),
      gradeArtifact(baseDossier(), emptyProse('cover_letter') as Artifact, deps),
    ])
    const s = summarize(reports)
    expect(s.notDelivered).toBe(1)
    expect(s.finalPassed).toBeLessThan(reports.length)
  })
})
