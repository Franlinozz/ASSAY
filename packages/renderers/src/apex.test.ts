import { describe, expect, it } from 'vitest'
import { DossierSchema, type Coverage } from '@xyndicate/assay-core'
import { createRouter } from '@xyndicate/providers'
import { gradeArtifact } from '@xyndicate/tribunal'
import {
  buildInterviewArtifact,
  evaluateInterviewAnswer,
  findLedgerContradictions,
  forgeDossier,
  generateInterviewQuestions,
} from './index'

const dossier = DossierSchema.parse({
  id: 'DSR-APEX',
  profile: {
    fullName: 'Amina Test',
    headline: 'Operations Lead',
    timezone: 'UTC',
    experiences: [
      {
        org: 'Acme',
        title: 'Lead',
        startYm: '2024-01',
        endYm: null,
        claimIds: ['CLM-TEAM', 'CLM-SPEED'],
      },
    ],
  },
  tz: 'UTC',
  evidence: [
    {
      id: 'EV-DOC',
      kind: 'document',
      label: 'review.pdf',
      sourceRef: 'review.pdf',
      contentText: 'Led a team of 8. Reduced cycle time by 40%.',
    },
  ],
  claims: [
    {
      id: 'CLM-TEAM',
      text: 'Led a team of 8',
      evidenceIds: ['EV-DOC'],
      status: 'confirmed',
      strength: 'documented',
      numericFacts: [{ value: 8, context: 'team size' }],
      tags: ['leadership', 'project'],
    },
    {
      id: 'CLM-SPEED',
      text: 'Reduced cycle time by 40%',
      evidenceIds: ['EV-DOC'],
      status: 'confirmed',
      strength: 'documented',
      numericFacts: [{ value: 40, unit: '%', context: 'cycle time reduction' }],
      tags: ['operations'],
    },
  ],
  brief: {
    jdText: 'Must know enterprise sales',
    decomposed: [
      {
        id: 'REQ-1',
        text: 'Must know enterprise sales',
        kind: 'must',
        keywords: ['enterprise', 'sales'],
      },
    ],
  },
})

const coverage: Coverage[] = [
  { requirementId: 'REQ-1', status: 'missing', claimIds: [], note: 'No matching evidence' },
]
const router = createRouter()
const pdf = async (html: string) => new TextEncoder().encode(`%PDF ${html.length}`)

describe('Phase 12 apex breadth', () => {
  it('generates behavioral questions from confirmed claims', () => {
    expect(
      generateInterviewQuestions(dossier, coverage).filter((q) => q.kind === 'behavioral'),
    ).toHaveLength(2)
  })
  it('generates a gap-probing question from missing coverage', () => {
    expect(generateInterviewQuestions(dossier, coverage).some((q) => q.kind === 'gap')).toBe(true)
  })
  it('honours the question limit', () => {
    expect(generateInterviewQuestions(dossier, coverage, 1)).toHaveLength(1)
  })
  it('links behavioral questions to the ledger claim', () => {
    expect(generateInterviewQuestions(dossier, coverage)[0]?.claimIds).toEqual(['CLM-TEAM'])
  })
  it('catches a planted team-size contradiction', () => {
    const q = generateInterviewQuestions(dossier, coverage)[0]!
    expect(findLedgerContradictions(dossier, q, 'I led a team of 12.')[0]?.ledgerValue).toBe(8)
  })
  it('accepts the ledger number', () => {
    const q = generateInterviewQuestions(dossier, coverage)[0]!
    expect(findLedgerContradictions(dossier, q, 'I led a team of 8.')).toEqual([])
  })

  // Regression: any answer number the ledger did not carry was reported as a contradiction and
  // paired with the claim's FIRST fact — so "20 people" came back as "your ledger says 840",
  // matching a latency figure. Numbers are compared within a unit or not at all.
  it('does not contradict a figure the claim does not measure', () => {
    const q = generateInterviewQuestions(dossier, coverage)[0]!
    // CLM-TEAM carries a unit-less team size of 8; a percentage is a different quantity entirely.
    expect(findLedgerContradictions(dossier, q, 'We cut latency by 35%.')).toEqual([])
  })

  it('pairs a contradiction with the fact that actually disagrees, and names the unit', () => {
    const speedQuestion = {
      id: 'Q-SPEED',
      prompt: 'Tell me about the cycle-time work.',
      kind: 'behavioral' as const,
      claimIds: ['CLM-SPEED'],
    }
    const found = findLedgerContradictions(dossier, speedQuestion, 'I reduced cycle time by 65%.')
    expect(found).toHaveLength(1)
    expect(found[0]?.ledgerValue).toBe(40)
    expect(found[0]?.claimId).toBe('CLM-SPEED')
    expect(found[0]?.detail).toContain('65 %')
    expect(found[0]?.detail).toContain('40 %')
  })
  it('evaluates STAR structure with one bounded critic result', async () => {
    const q = generateInterviewQuestions(dossier, coverage)[0]!
    const e = await evaluateInterviewAnswer({
      dossier,
      question: q,
      answer:
        'The situation was a launch. My task was delivery. I led the team of 8 and the result was on-time release.',
      router,
    })
    expect(e.star).toEqual({ situation: true, task: true, action: true, result: true })
  })
  it('does not finalize a contradictory answer', async () => {
    const q = generateInterviewQuestions(dossier, coverage)[0]!
    const e = await evaluateInterviewAnswer({
      dossier,
      question: q,
      answer:
        'The situation was a launch. My task was delivery. I led the team of 12 and the result was release.',
      router,
    })
    expect(e.final).toBe(false)
  })
  it('stores contradiction data in a proper evaluation artifact', async () => {
    const q = generateInterviewQuestions(dossier, coverage)[0]!
    const e = await evaluateInterviewAnswer({
      dossier,
      question: q,
      answer: 'I led 12 people.',
      router,
    })
    expect(buildInterviewArtifact([e]).meta['ledgerContradictions'] as unknown[]).toHaveLength(1)
  })
  it('tribunal blocks an interview artifact with ledger contradictions', async () => {
    const q = generateInterviewQuestions(dossier, coverage)[0]!
    const e = await evaluateInterviewAnswer({
      dossier,
      question: q,
      answer: 'I led 12 people.',
      router,
    })
    const report = await gradeArtifact(dossier, buildInterviewArtifact([e]), { router })
    expect(report.pass).toBe(false)
  })
  it('promotion mode produces the three promotion artifacts', async () => {
    const d = DossierSchema.parse({
      ...dossier,
      variant: 'promotion',
      brief: { ...dossier.brief!, mode: 'promotion', dateFrom: '2024-01', dateTo: '2026-07' },
    })
    const out = await forgeDossier({ dossier: d, router, coverage, deps: { toPdf: pdf } })
    expect(
      out.artifacts.filter(
        (a) => a.kind.startsWith('promotion_') || a.kind === 'manager_one_pager',
      ),
    ).toHaveLength(3)
  })
  it('promotion numbers stay consistent across narrative, memo and one-pager', async () => {
    const d = DossierSchema.parse({ ...dossier, variant: 'promotion' })
    const out = await forgeDossier({ dossier: d, router, coverage, deps: { toPdf: pdf } })
    const texts = out.artifacts
      .filter((a) => a.sentences)
      .map((a) => a.sentences!.map((s) => s.text).join(' '))
    expect(texts.every((t) => t.includes('8') && t.includes('40'))).toBe(true)
  })
  it('freelance mode produces capability, case studies and proposal', async () => {
    const d = DossierSchema.parse({
      ...dossier,
      variant: 'freelance',
      brief: { ...dossier.brief!, mode: 'freelance', projectClaimIds: ['CLM-TEAM'] },
    })
    const out = await forgeDossier({ dossier: d, router, coverage, deps: { toPdf: pdf } })
    expect(out.artifacts.map((a) => a.kind)).toEqual([
      'capability_statement',
      'case_studies',
      'proposal_letter',
      'manifest_json',
    ])
  })
  it('freelance work samples use only selected project claims', async () => {
    const d = DossierSchema.parse({
      ...dossier,
      variant: 'freelance',
      brief: { ...dossier.brief!, mode: 'freelance', projectClaimIds: ['CLM-TEAM'] },
    })
    const out = await forgeDossier({ dossier: d, router, coverage, deps: { toPdf: pdf } })
    expect(
      out.artifacts.find((a) => a.id === 'case_studies')?.sentences?.flatMap((s) => s.claimIds),
    ).toEqual(['CLM-TEAM'])
  })
  it('each variant ships an agent manifest', async () => {
    const d = DossierSchema.parse({ ...dossier, variant: 'promotion' })
    const out = await forgeDossier({ dossier: d, router, coverage, deps: { toPdf: pdf } })
    expect(out.files.get('manifest_json')?.ext).toBe('json')
  })
})

// A live buyer's interview evaluation reported "You said 61 %; your confirmed ledger says 0.4 %" —
// a data-completeness figure indicted by a migration exception rate, purely because both are
// percentages. Matching units is necessary and not sufficient: two numbers only disagree if they
// measure the same thing.
describe('a contradiction requires the same quantity, not just the same unit', () => {
  const govDossier = DossierSchema.parse({
    profile: { fullName: 'Ada Records', timezone: 'UTC', contact: { email: 'a@b.co', links: [] } },
    tz: 'UTC',
    evidence: [
      {
        id: 'EV-GOV',
        kind: 'document',
        label: 'migration report',
        sourceRef: 'migration.pdf',
        contentText:
          'Catalogue migration completed with a 0.4% exception rate. Data completeness reached 88%.',
      },
    ],
    claims: [
      {
        id: 'CLM-MIG',
        text: 'Completed the catalogue migration with a 0.4% exception rate',
        evidenceIds: ['EV-GOV'],
        status: 'confirmed',
        strength: 'documented',
        numericFacts: [{ value: 0.4, unit: '%', context: 'migration exception rate' }],
        tags: [],
      },
    ],
  })
  const question = {
    id: 'Q-MIG',
    prompt: 'Tell me about the migration.',
    kind: 'behavioral' as const,
    claimIds: ['CLM-MIG'],
  }

  it('does not indict a different percentage with an unrelated one', () => {
    expect(
      findLedgerContradictions(
        govDossier,
        question,
        'We raised data completeness to 61% across the catalogue.',
      ),
    ).toEqual([])
  })

  it('still catches a disagreement about the very same quantity', () => {
    const found = findLedgerContradictions(
      govDossier,
      question,
      'The migration finished with an exception rate of 3%.',
    )
    expect(found).toHaveLength(1)
    expect(found[0]?.ledgerValue).toBe(0.4)
  })

  it('recognises a quantity restated in different words', () => {
    // The ledger recorded "team size"; the candidate says "people". Same quantity, and the
    // disagreement is real.
    const q = generateInterviewQuestions(dossier, coverage)[0]!
    expect(findLedgerContradictions(dossier, q, 'I led 12 people.')[0]?.ledgerValue).toBe(8)
  })
})
