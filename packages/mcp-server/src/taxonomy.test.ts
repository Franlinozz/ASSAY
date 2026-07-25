import { describe, it, expect } from 'vitest'
import {
  DossierSchema,
  ArtifactSchema,
  ClaimSchema,
  EvidenceItemSchema,
  TOOL_PRICES,
  ymInTz,
  formatInTz,
  type Dossier,
} from '@xyndicate/assay-core'
import {
  EVIDENCE_RESOLVES,
  PLACEHOLDER_TEXT,
  DATE_SANITY,
  summarize,
  type TribunalReport,
} from '@xyndicate/tribunal'
import { sanitizeGap } from '@xyndicate/providers'
import { priceOf } from './config'

// PHASE 11 — the bug-taxonomy hunt. Each `describe` actively reproduces a bug class that bit a past
// Xyndicate project (or that AGENTS.md's gotchas name) and pins the defense so it can never regress.

function mkDossier(over: Record<string, unknown> = {}): Dossier {
  return DossierSchema.parse({
    id: 'DSR-TAX00001',
    tz: 'America/New_York',
    createdAt: '2026-07-01T00:00:00.000Z',
    profile: {
      fullName: 'Test Persona',
      timezone: 'America/New_York',
      contact: { email: 'p@example.com', links: [] },
      experiences: [{ org: 'Acme', title: 'SWE', startYm: '2021-03', endYm: null }],
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

function mkReport(over: Partial<TribunalReport>): TribunalReport {
  return {
    artifactId: 'A1',
    artifactKind: 'resume_ats',
    draftIndex: 0,
    hard: [],
    craft: [],
    craftWeightedMean: 100,
    pass: true,
    hardPass: true,
    craftPass: true,
    standardVersion: 'AS-1.0.0',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...over,
  }
}

// ── 1) asset-referenced-but-missing (the broken-image-PASS bug, gotcha #11) ──
describe('taxonomy: asset referenced but missing', () => {
  it('a document evidence with no text AND no file is a hard FAIL, not a silent pass', async () => {
    const d = mkDossier({
      evidence: [
        EvidenceItemSchema.parse({
          id: 'EV-X',
          kind: 'document',
          label: 'cert',
          sourceRef: 'gone.pdf',
          contentText: '',
        }),
      ],
      claims: [],
    })
    const r = await EVIDENCE_RESOLVES.run({
      dossier: d,
      artifact: ArtifactSchema.parse({ id: 'A1', kind: 'resume_ats' }),
      deps: { fileExists: () => false },
    })
    expect(r.status).toBe('fail')
    expect(r.findings.map((f) => f.code)).toContain('UNREADABLE_FILE')
  })

  it('a failed artifact is EXCLUDED from the pass-rate — never a broken artifact wearing a PASS badge', () => {
    // Two artifacts: one clean pass, one whose final draft failed (e.g. its asset was missing).
    const reports: TribunalReport[] = [
      mkReport({ artifactId: 'clean', pass: true }),
      mkReport({ artifactId: 'broken', pass: false, hardPass: false }),
    ]
    const s = summarize(reports)
    expect(s.artifacts).toBe(2)
    expect(s.finalPassed).toBe(1) // the broken one is NOT counted as passed
    expect(s.postRepairPassRate).toBe(50)
    expect(s.byArtifact.find((a) => a.artifactId === 'broken')?.finalPass).toBe(false)
  })
})

// ── 2) timezone (the UTC bug, gotcha #12) — all user-facing dates in the candidate's timezone ──
describe('taxonomy: timezone honored (UTC+9)', () => {
  it('an instant near UTC midnight renders on the NEXT day in Asia/Tokyo, not the UTC day', () => {
    // 2026-03-01T23:30:00Z is still Feb/Mar 1 in UTC but already Mar 2 in Tokyo (UTC+9).
    const iso = '2026-03-01T23:30:00.000Z'
    expect(ymInTz(iso, 'America/New_York')).toBe('2026-03') // UTC-5 → still Mar 1 evening
    const tokyoDay = formatInTz(iso, 'Asia/Tokyo', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    expect(tokyoDay).toContain('03/02') // Tokyo has ticked to Mar 2
    const nyDay = formatInTz(iso, 'America/New_York', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    expect(nyDay).toContain('03/01')
    expect(tokyoDay).not.toBe(nyDay)
  })

  it('DATE_SANITY evaluates a future-date check in the dossier timezone', async () => {
    // A UTC+9 dossier: an experience starting in the far future must still fail regardless of tz.
    const d = mkDossier({
      tz: 'Asia/Tokyo',
      profile: {
        fullName: 'Tokyo Persona',
        timezone: 'Asia/Tokyo',
        contact: { email: 'p@example.com', links: [] },
        experiences: [{ org: 'Future Co', title: 'SWE', startYm: '2999-01', endYm: null }],
      },
    })
    const r = await DATE_SANITY.run({
      dossier: d,
      artifact: ArtifactSchema.parse({ id: 'A1', kind: 'resume_ats' }),
      deps: {},
    })
    expect(r.status).toBe('fail')
  })
})

// ── 3) placeholder leak (gotcha #13) ──
describe('taxonomy: placeholder leak', () => {
  it('a [BRACKET] placeholder in an artifact is a hard FAIL', async () => {
    const art = ArtifactSchema.parse({
      id: 'A1',
      kind: 'cover_letter',
      sentences: [{ text: 'I would love to work at [COMPANY NAME].', claimIds: ['CLM-1'] }],
    })
    const r = await PLACEHOLDER_TEXT.run({ dossier: mkDossier(), artifact: art, deps: {} })
    expect(r.status).toBe('fail')
    expect(r.findings.map((f) => f.code)).toContain('BRACKET_PLACEHOLDER')
  })
})

// ── 4) raw provider error leak (guardrail #9) ──
describe('taxonomy: raw provider error never leaks', () => {
  it('sanitizeGap returns only a stable code + safe sentence — no raw error, stack, or host', () => {
    const gap = sanitizeGap('PROVIDER_ERROR')
    expect(gap.code).toBe('PROVIDER_ERROR')
    expect(gap.message).not.toMatch(/ECONNREFUSED|stack|at Object|https?:\/\/|Error:/i)
    expect(Object.keys(gap).sort()).toEqual(['code', 'message']) // nothing else rides along
  })
})

// ── 5) stale price display — one source of truth for every price ──
describe('taxonomy: prices never drift', () => {
  it('priceOf() == TOOL_PRICES for every tool (the single source the site + docs generate from)', () => {
    for (const [tool, price] of Object.entries(TOOL_PRICES)) {
      expect(priceOf(tool)).toBe(price)
    }
  })
  it('the free tools are exactly asy_verify, asy_job_status, asy_job_result', () => {
    const free = Object.entries(TOOL_PRICES)
      .filter(([, p]) => p === 0)
      .map(([t]) => t)
      .sort()
    expect(free).toEqual(['asy_job_result', 'asy_job_status', 'asy_verify'])
  })
})
