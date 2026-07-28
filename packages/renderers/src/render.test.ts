import { describe, it, expect } from 'vitest'
import {
  DossierSchema,
  ClaimSchema,
  EvidenceItemSchema,
  ArtifactSchema,
} from '@xyndicate/assay-core'
import type { Coverage, Dossier, Sentence } from '@xyndicate/assay-core'
import { FakeFetcher } from '@xyndicate/providers'
import { FORMAT_LAW, LINK_LIVENESS } from '@xyndicate/tribunal'
import { renderAtsHtml, renderDesignedHtml, atsPlainText } from './templates/resume'
import { renderPortfolioHtml } from './templates/portfolio'
import { renderFitMapHtml, renderGapBriefHtml } from './templates/documents'
import { parseBackFromLines, reconstruct, PARSE_BACK_LABEL } from './parseback'
import { buildAgentManifest } from './manifest'

function dossier(): Dossier {
  return DossierSchema.parse({
    id: 'DSR-R0000001',
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
const bullets: Sentence[] = [{ text: 'Reduced latency by 38%', claimIds: ['CLM-1'] }]

describe('ATS template', () => {
  it('is single-column with approved headings and no tables/images', () => {
    const html = renderAtsHtml(dossier(), bullets)
    expect(html).toContain('<h2>EXPERIENCE</h2>')
    expect(html).toContain('<h2>SKILLS</h2>')
    expect(html).not.toMatch(/<table/i)
    expect(html).not.toMatch(/<img/i)
  })

  it('passes the tribunal FORMAT_LAW check', async () => {
    const art = ArtifactSchema.parse({
      id: 'resume_ats',
      kind: 'resume_ats',
      meta: { html: renderAtsHtml(dossier(), bullets) },
    })
    const r = await FORMAT_LAW.run({ dossier: dossier(), artifact: art, deps: {} })
    expect(r.status).toBe('pass')
  })
})

describe('designed / portfolio templates (both themes)', () => {
  it('renders distinct light and dark themes', () => {
    const light = renderDesignedHtml(dossier(), bullets, 'light')
    const dark = renderDesignedHtml(dossier(), bullets, 'dark')
    expect(light).toContain('#FBF9F3')
    expect(light).toContain('data-theme="light"')
    expect(dark).toContain('#131519')
    expect(dark).toContain('data-theme="dark"')
  })

  it('portfolio page passes a link-liveness sweep with a mocked fetcher', async () => {
    const html = renderPortfolioHtml(dossier(), bullets, 'dark')
    const art = ArtifactSchema.parse({
      id: 'portfolio_page',
      kind: 'portfolio_page',
      meta: { html },
    })
    const r = await LINK_LIVENESS.run({
      dossier: dossier(),
      artifact: art,
      deps: { fetcher: new FakeFetcher() },
    })
    expect(r.status).toBe('pass')
  })
})

describe('fit map & gap brief', () => {
  const coverage: Coverage[] = [
    { requirementId: 'R1', status: 'strong', claimIds: ['CLM-1'], note: 'covered' },
    { requirementId: 'R2', status: 'missing', claimIds: [], note: 'no evidence' },
  ]
  it('fit map renders coverage marks', () => {
    const html = renderFitMapHtml(dossier(), coverage)
    expect(html).toContain('mark-strong')
    expect(html).toContain('mark-missing')
  })
  it('gap brief advises against unbacked claims', () => {
    const html = renderGapBriefHtml(dossier(), coverage)
    expect(html).toMatch(/do not claim/i)
  })
})

describe('parse-back engine', () => {
  it('reconstructs and diffs a clean ATS to 100% fidelity', () => {
    const d = dossier()
    const { lines } = atsPlainText(d, bullets)
    const r = parseBackFromLines(lines, d.profile)
    expect(r.fidelityPct).toBe(100)
    expect(r.fieldDiffs).toHaveLength(0)
    expect(r.label).toBe(PARSE_BACK_LABEL)
  })

  it('reconstructs experience org/title/dates', () => {
    const d = dossier()
    const parsed = reconstruct(atsPlainText(d, bullets).lines)
    expect(parsed.experiences[0]).toMatchObject({
      org: 'Paystack',
      title: 'Senior Backend Engineer',
      startYm: '2021-03',
      endYm: 'Present',
    })
  })

  it('drops fields on a sabotaged (jumbled) layout → below 100%', () => {
    const d = dossier()
    // Simulate a two-column interleave: drop the role + date lines so fields cannot be recovered.
    const jumbled = atsPlainText(d, bullets).lines.filter((l) => !/—|–/.test(l))
    const r = parseBackFromLines(jumbled, d.profile)
    expect(r.fidelityPct).toBeLessThan(100)
    expect(r.fieldDiffs.length).toBeGreaterThan(0)
  })
})

describe('agent manifest', () => {
  const coverage: Coverage[] = [
    { requirementId: 'R1', status: 'strong', claimIds: ['CLM-1'], note: '' },
    { requirementId: 'R2', status: 'missing', claimIds: [], note: '' },
  ]
  it('tallies coverage, lists approved claims, and is integrity-hashed + stable', () => {
    const m = buildAgentManifest(dossier(), coverage)
    expect(m.coverage.strong).toBe(1)
    expect(m.coverage.missing).toBe(1)
    expect(m.approvedClaims).toHaveLength(1)
    expect(m.risks).toHaveLength(1)
    expect(m.integrity.manifestSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(buildAgentManifest(dossier(), coverage).integrity.manifestSha256).toBe(
      m.integrity.manifestSha256,
    )
  })
})
