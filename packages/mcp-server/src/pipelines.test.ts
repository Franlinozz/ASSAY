import { describe, it, expect } from 'vitest'
import { SAMPLE_RESUME_TEXT } from '@xyndicate/providers'
import {
  atsScan,
  claimAudit,
  fitBrief,
  coverLetter,
  storyBank,
  makeCtx,
  type PipelineCtx,
} from './pipelines'
import { testRuntime } from './testutil'

function ctx(): PipelineCtx {
  const rig = testRuntime()
  return makeCtx(rig.store, rig.router, rig.cfg, rig.fetcher)
}

// A deliberately ATS-hostile résumé: non-standard headings, tab columns, no email.
const SABOTAGE = `JANE DOE
PROFESSIONAL BACKGROUND
Company\tRole\tYears
Acme Corp\tEngineer\t3
CORE COMPETENCIES
Python and SQL`

describe('asy_ats_scan (the traction wedge)', () => {
  it('returns FORMAT_LAW findings on a sabotage fixture', async () => {
    const r = await atsScan(ctx(), { resumeText: SABOTAGE })
    expect(r.data['ok']).toBe(true)
    const format = r.data['format'] as { findings: Array<{ code: string }> }
    expect(format.findings.length).toBeGreaterThan(0)
    const codes = format.findings.map((f) => f.code)
    expect(codes).toContain('FORMAT_HEADING')
    expect(codes.some((c) => c === 'FORMAT_TABLE' || c === 'FORMAT_NO_CONTACT')).toBe(true)
  })

  it('labels JD keyword presence distinctly from evidence-backed fit', async () => {
    const r = await atsScan(ctx(), {
      resumeText: SAMPLE_RESUME_TEXT,
      jd: 'Must have PostgreSQL experience\nKubernetes required\nStrong TypeScript',
    })
    const presence = r.data['jdKeywordPresence'] as {
      mustMentioned: number
      niceMentioned: number
      metric: string
    }
    expect(presence.mustMentioned).toBeGreaterThanOrEqual(0)
    expect(presence.mustMentioned).toBeLessThanOrEqual(100)
    expect(presence.metric).toBe('keyword_presence')
    expect(r.summary).toContain('not evidence-backed fit')
  })
})

describe('asy_fit_brief', () => {
  it('reports an honest "missing" when nothing covers a requirement', async () => {
    const r = await fitBrief(ctx(), {
      jd: 'Must have Rust experience\nMust have Erlang',
      claims: ['I ship Python services'],
    })
    expect(r.data['ok']).toBe(true)
    const counts = r.data['counts'] as Record<string, number>
    expect(counts['missing']).toBeGreaterThan(0)
    expect(r.data['metric']).toBe('evidence_backed_requirement_coverage')
  })
})

describe('asy_claim_audit', () => {
  it('audits grounded claims from a résumé', async () => {
    const r = await claimAudit(ctx(), { resumeText: SAMPLE_RESUME_TEXT })
    expect(r.data['ok']).toBe(true)
    const audited = r.data['audited'] as Array<{ status: string }>
    expect(audited.length).toBeGreaterThan(0)
  })
})

describe('evidence-constrained writers', () => {
  it('politely refuses to write from thin air', async () => {
    const r = await coverLetter(ctx(), {})
    expect(r.refused).toBe(true)
    expect(r.data['reason']).toBe('NO_EVIDENCE')
  })

  it('writes evidence-cited sentences when given confirmed claims', async () => {
    const r = await storyBank(ctx(), {
      claims: ['Reduced API p95 latency by 38% via PostgreSQL connection pooling'],
      evidence: 'Performance work at Paystack',
    })
    expect(r.data['ok']).toBe(true)
    expect(r.data).toHaveProperty('tribunal')
  })
})
