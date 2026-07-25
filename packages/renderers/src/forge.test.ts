import { describe, it, expect } from 'vitest'
import {
  DossierSchema,
  ClaimSchema,
  EvidenceItemSchema,
  ArtifactSchema,
} from '@xyndicate/assay-core'
import type { Coverage, Dossier } from '@xyndicate/assay-core'
import { createRouter } from '@xyndicate/providers'
import { ATS_PARSE_BACK } from '@xyndicate/tribunal'
import { forgeDossier } from './forge'
import { htmlToPdf } from './pdf'
import { renderAtsHtml } from './templates/resume'
import { parseBackFromBuffer } from './parseback'

function dossier(): Dossier {
  return DossierSchema.parse({
    id: 'DSR-F0000001',
    tz: 'UTC',
    createdAt: '2026-07-01T00:00:00.000Z',
    profile: {
      fullName: 'Chidinma Eze',
      headline: 'Senior Backend Engineer',
      timezone: 'UTC',
      contact: { email: 'chidinma@example.com', links: ['https://gh.example/chidinma'] },
      experiences: [
        { org: 'Paystack', title: 'Senior Backend Engineer', startYm: '2021-03', endYm: null },
      ],
      skills: ['TypeScript', 'PostgreSQL', 'Kubernetes'],
    },
    evidence: [
      EvidenceItemSchema.parse({
        id: 'EV-1',
        kind: 'document',
        label: 'r',
        sourceRef: 'r',
        contentText: 'Reduced latency by 38%',
      }),
    ],
    claims: [
      ClaimSchema.parse({
        id: 'CLM-1',
        text: 'Reduced latency by 38%',
        status: 'confirmed',
        strength: 'documented',
        evidenceIds: ['EV-1'],
        numericFacts: [{ value: 38, unit: '%', context: 'x' }],
      }),
    ],
  })
}
const coverage: Coverage[] = [
  { requirementId: 'R1', status: 'strong', claimIds: ['CLM-1'], note: '' },
  { requirementId: 'R2', status: 'missing', claimIds: [], note: '' },
]
const bullet = [{ text: 'Reduced latency by 38%', claimIds: ['CLM-1'] }]

describe('forgeDossier (fake providers, injected PDF)', () => {
  it('produces every artifact kind, gated, with files', async () => {
    const out = await forgeDossier({
      dossier: dossier(),
      router: createRouter(),
      coverage,
      deps: {
        toPdf: async () => new Uint8Array([37, 80, 68, 70]),
        sampleContrast: async () => 12.4,
      },
    })
    const kinds = out.artifacts.map((a) => a.kind)
    for (const k of [
      'resume_ats',
      'resume_designed',
      'cover_letter',
      'story_bank',
      'fit_map',
      'gap_brief',
      'resume_docx',
      'portfolio_page',
      'manifest_json',
    ]) {
      expect(kinds).toContain(k)
    }
    const ats = out.artifacts.find((a) => a.id === 'resume_ats')
    expect((ats?.sentences ?? []).length).toBeGreaterThan(0)
    expect(out.files.has('resume_ats')).toBe(true)
    expect(out.files.has('manifest_json')).toBe(true)
    expect(out.files.has('cover')).toBe(true)
    const portfolio = out.artifacts.find((a) => a.id === 'portfolio_page')
    expect(portfolio?.meta['shareView']).toBe(true)
    expect(portfolio?.meta['renderedContrastRatio']).toBe(12.4)
  })
})

describe('ATS parse-back goes live (chromium)', () => {
  it('renders ATS → PDF → parses back at 100% fidelity', async () => {
    const d = dossier()
    const pdf = await htmlToPdf(renderAtsHtml(d, bullet))
    const r = await parseBackFromBuffer(pdf, d.profile)
    expect(r.fidelityPct).toBe(100)
  }, 60000)

  it('flips the tribunal ATS_PARSE_BACK check live; it passes on a clean resume', async () => {
    const d = dossier()
    const pdf = await htmlToPdf(renderAtsHtml(d, bullet))
    const art = ArtifactSchema.parse({ id: 'resume_ats', kind: 'resume_ats', meta: {} })
    const deps = {
      parseBack: async () => {
        const { fidelityPct, fieldDiffs } = await parseBackFromBuffer(pdf, d.profile)
        return { fidelityPct, fieldDiffs }
      },
    }
    const res = await ATS_PARSE_BACK.run({ dossier: d, artifact: art, deps })
    expect(res.status).toBe('pass')
  }, 60000)
})
