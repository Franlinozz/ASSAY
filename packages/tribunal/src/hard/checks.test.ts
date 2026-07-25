import { describe, it, expect } from 'vitest'
import {
  DossierSchema,
  ArtifactSchema,
  ClaimSchema,
  EvidenceItemSchema,
} from '@xyndicate/assay-core'
import type { Artifact, Dossier } from '@xyndicate/assay-core'
import { FakeFetcher } from '@xyndicate/providers'
import {
  CLAIM_COVERAGE,
  EVIDENCE_RESOLVES,
  LINK_LIVENESS,
  PLACEHOLDER_TEXT,
  DATE_SANITY,
  XARTIFACT_CONSISTENCY,
  FORMAT_LAW,
  DOCX_INTEGRITY,
  ATS_PARSE_BACK,
  CONTACT_VALIDITY,
  PII_HYGIENE,
  JD_COVERAGE,
  STAR_COMPLETENESS,
  PORTFOLIO_CONTRAST,
} from './index'
import type { CheckDeps } from './types'

function mkDossier(over: Record<string, unknown> = {}): Dossier {
  return DossierSchema.parse({
    id: 'DSR-T0000001',
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
    ...over,
  })
}
function mkArtifact(over: Record<string, unknown> = {}): Artifact {
  return ArtifactSchema.parse({ id: 'A1', kind: 'resume_ats', ...over })
}
const ctx = (dossier: Dossier, artifact: Artifact, deps: CheckDeps = {}) => ({
  dossier,
  artifact,
  deps,
})

describe('CLAIM_COVERAGE', () => {
  it('passes a supported sentence with a matching number', async () => {
    const art = mkArtifact({
      sentences: [{ text: 'Reduced latency by 38%.', claimIds: ['CLM-1'] }],
    })
    expect((await CLAIM_COVERAGE.run(ctx(mkDossier(), art))).status).toBe('pass')
  })
  it('fails an unsupported sentence', async () => {
    const art = mkArtifact({ sentences: [{ text: 'A bold unbacked claim.', claimIds: [] }] })
    expect((await CLAIM_COVERAGE.run(ctx(mkDossier(), art))).status).toBe('fail')
  })
})

describe('EVIDENCE_RESOLVES', () => {
  it('passes when document evidence is readable', async () => {
    expect((await EVIDENCE_RESOLVES.run(ctx(mkDossier(), mkArtifact()))).status).toBe('pass')
  })
  it('fails an unreadable, missing-file document (broken-asset law)', async () => {
    const d = mkDossier({
      evidence: [
        EvidenceItemSchema.parse({
          id: 'EV-2',
          kind: 'document',
          label: 'cert',
          sourceRef: 'missing.pdf',
          contentText: '',
        }),
      ],
      claims: [],
    })
    const r = await EVIDENCE_RESOLVES.run(ctx(d, mkArtifact(), { fileExists: () => false }))
    expect(r.status).toBe('fail')
  })
})

describe('LINK_LIVENESS', () => {
  const deps = { fetcher: new FakeFetcher() }
  it('passes when links resolve live (mocked fetcher)', async () => {
    const art = mkArtifact({
      sentences: [{ text: 'Portfolio at https://good.example/me', claimIds: ['CLM-1'] }],
    })
    expect((await LINK_LIVENESS.run(ctx(mkDossier(), art, deps))).status).toBe('pass')
  })
  it('fails on a dead link', async () => {
    const art = mkArtifact({
      sentences: [{ text: 'See https://dead.example/404', claimIds: ['CLM-1'] }],
    })
    expect((await LINK_LIVENESS.run(ctx(mkDossier(), art, deps))).status).toBe('fail')
  })
})

describe('PLACEHOLDER_TEXT', () => {
  it('passes clean prose', async () => {
    const art = mkArtifact({
      sentences: [{ text: 'Led the migration to TypeScript.', claimIds: ['CLM-1'] }],
    })
    expect((await PLACEHOLDER_TEXT.run(ctx(mkDossier(), art))).status).toBe('pass')
  })
  it('fails on [BRACKETS] and TBD', async () => {
    const art = mkArtifact({
      sentences: [{ text: 'Worked at [COMPANY NAME] on TBD projects.', claimIds: ['CLM-1'] }],
    })
    expect((await PLACEHOLDER_TEXT.run(ctx(mkDossier(), art))).status).toBe('fail')
  })
})

describe('DATE_SANITY', () => {
  it('passes real, non-future dates', async () => {
    expect((await DATE_SANITY.run(ctx(mkDossier(), mkArtifact()))).status).toBe('pass')
  })
  it('fails a future date (2099)', async () => {
    const d = mkDossier({
      profile: {
        fullName: 'X',
        timezone: 'America/New_York',
        experiences: [{ org: 'Y', title: 'Z', startYm: '2099-01', endYm: null }],
      },
    })
    expect((await DATE_SANITY.run(ctx(d, mkArtifact()))).status).toBe('fail')
  })
})

describe('XARTIFACT_CONSISTENCY', () => {
  it('passes when a claim renders the same number everywhere', async () => {
    const d = mkDossier({
      artifacts: [
        { id: 'A', kind: 'resume_ats', sentences: [{ text: 'Grew 38%', claimIds: ['CLM-1'] }] },
        {
          id: 'B',
          kind: 'cover_letter',
          sentences: [{ text: 'again grew 38%', claimIds: ['CLM-1'] }],
        },
      ],
    })
    expect((await XARTIFACT_CONSISTENCY.run(ctx(d, mkArtifact()))).status).toBe('pass')
  })
  it('fails when a claim renders conflicting numbers', async () => {
    const d = mkDossier({
      artifacts: [
        { id: 'A', kind: 'resume_ats', sentences: [{ text: 'Grew 38%', claimIds: ['CLM-1'] }] },
        { id: 'B', kind: 'cover_letter', sentences: [{ text: 'Grew 40%', claimIds: ['CLM-1'] }] },
      ],
    })
    expect((await XARTIFACT_CONSISTENCY.run(ctx(d, mkArtifact()))).status).toBe('fail')
  })
})

describe('FORMAT_LAW', () => {
  it('passes a single-column ATS resume with approved headings', async () => {
    const art = mkArtifact({
      meta: { html: '<h2>EXPERIENCE</h2><p>Did things.</p><h2>SKILLS</h2>' },
    })
    expect((await FORMAT_LAW.run(ctx(mkDossier(), art))).status).toBe('pass')
  })
  it('fails a two-column (table) ATS layout', async () => {
    const art = mkArtifact({
      meta: { html: '<table><tr><td>left</td><td>right</td></tr></table>' },
    })
    expect((await FORMAT_LAW.run(ctx(mkDossier(), art))).status).toBe('fail')
  })
})

describe('DOCX_INTEGRITY', () => {
  it('passes when the docx reopens with headings', async () => {
    const art = mkArtifact({ id: 'D', kind: 'resume_docx', fileRef: 'out.docx' })
    const deps = {
      readDocx: async () => ({ text: 'EXPERIENCE ... SKILLS', headings: ['EXPERIENCE', 'SKILLS'] }),
    }
    expect((await DOCX_INTEGRITY.run(ctx(mkDossier(), art, deps))).status).toBe('pass')
  })
  it('fails when the docx will not reopen', async () => {
    const art = mkArtifact({ id: 'D', kind: 'resume_docx', fileRef: 'corrupt.docx' })
    const deps = {
      readDocx: async () => {
        throw new Error('not a zip')
      },
    }
    expect((await DOCX_INTEGRITY.run(ctx(mkDossier(), art, deps))).status).toBe('fail')
  })
})

describe('ATS_PARSE_BACK', () => {
  it('is pending until the parse-back engine is wired (P4)', async () => {
    expect((await ATS_PARSE_BACK.run(ctx(mkDossier(), mkArtifact()))).status).toBe('pending')
  })
  it('fails when the engine reports field diffs', async () => {
    const deps = {
      parseBack: async () => ({
        fidelityPct: 80,
        fieldDiffs: [{ field: 'title', expected: 'SWE', got: 'SVVE' }],
      }),
    }
    expect((await ATS_PARSE_BACK.run(ctx(mkDossier(), mkArtifact(), deps))).status).toBe('fail')
  })
})

describe('CONTACT_VALIDITY', () => {
  it('passes valid contact', async () => {
    expect((await CONTACT_VALIDITY.run(ctx(mkDossier(), mkArtifact()))).status).toBe('pass')
  })
  it('fails a malformed link', async () => {
    const d = mkDossier({
      profile: { fullName: 'X', timezone: 'UTC', contact: { links: ['not a url'] } },
    })
    expect((await CONTACT_VALIDITY.run(ctx(d, mkArtifact()))).status).toBe('fail')
  })
})

describe('PII_HYGIENE', () => {
  it('passes when only approved fields are exposed', async () => {
    const art = mkArtifact({
      meta: { shareView: true, approvedFields: ['email'], html: 'Reach me at c@example.com' },
    })
    expect((await PII_HYGIENE.run(ctx(mkDossier(), art))).status).toBe('pass')
  })
  it('fails when an unapproved phone number leaks into a share view', async () => {
    const d = mkDossier({
      profile: { fullName: 'X', timezone: 'UTC', contact: { phone: '+15550100', links: [] } },
    })
    const art = mkArtifact({
      meta: { shareView: true, approvedFields: [], html: 'call +15550100' },
    })
    expect((await PII_HYGIENE.run(ctx(d, art))).status).toBe('fail')
  })
  it('fails when server-marked redacted bytes survive', async () => {
    const art = mkArtifact({
      meta: {
        shareView: true,
        approvedFields: [],
        html: 'secret fragment',
        redactedSourceFragments: ['secret fragment'],
      },
    })
    expect((await PII_HYGIENE.run(ctx(mkDossier(), art))).status).toBe('fail')
  })
})

describe('AS 1.1 profile checks', () => {
  it('blocks an incomplete story-bank entry', async () => {
    const art = mkArtifact({
      kind: 'story_bank',
      sentences: [{ text: 'I built a service.', claimIds: ['CLM-1'] }],
    })
    expect((await STAR_COMPLETENESS.run(ctx(mkDossier(), art))).status).toBe('fail')
  })

  it('passes a complete STAR story', async () => {
    const art = mkArtifact({
      kind: 'story_bank',
      sentences: [
        {
          text: 'When latency rose, my task was recovery. I built pooling, which reduced it by 38%.',
          claimIds: ['CLM-1'],
        },
      ],
    })
    expect((await STAR_COMPLETENESS.run(ctx(mkDossier(), art))).status).toBe('pass')
  })

  it('blocks screenshot-sampled portfolio contrast below 4.5', async () => {
    const art = mkArtifact({ kind: 'portfolio_page', meta: { renderedContrastRatio: 3.8 } })
    expect((await PORTFOLIO_CONTRAST.run(ctx(mkDossier(), art))).status).toBe('fail')
  })

  it('passes screenshot-sampled portfolio contrast at 4.5', async () => {
    const art = mkArtifact({ kind: 'portfolio_page', meta: { renderedContrastRatio: 4.5 } })
    expect((await PORTFOLIO_CONTRAST.run(ctx(mkDossier(), art))).status).toBe('pass')
  })
})

describe('JD_COVERAGE', () => {
  it('is informational and never fails', async () => {
    const d = mkDossier({
      brief: {
        jdText: 'Need Rust',
        decomposed: [{ id: 'R1', text: 'Rust', kind: 'must', keywords: ['rust'] }],
      },
    })
    const art = mkArtifact({ sentences: [{ text: 'I write Python only.', claimIds: ['CLM-1'] }] })
    const r = await JD_COVERAGE.run(ctx(d, art))
    expect(r.status).toBe('pass')
    expect(r.evidence).toMatch(/must .*%/)
  })
})
