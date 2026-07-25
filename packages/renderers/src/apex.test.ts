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
