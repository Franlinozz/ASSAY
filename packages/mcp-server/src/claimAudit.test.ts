import { describe, expect, it } from 'vitest'
import { stripThousands } from '@xyndicate/providers'
import { auditLanguage, claimAudit } from './pipelines'
import { testRuntime } from './testutil'

// From a live buyer's audit of a solar operations résumé: one false positive and two misses.

describe('a formatted figure is not an invented one', () => {
  it('matches a value written with thousands separators', () => {
    const source = 'csat 4.83 mean, 2,400 installs, 1,612 responses, 2024 calendar year'
    for (const value of [4.8, 2400, 1612, 2024])
      expect(stripThousands(source).includes(String(value))).toBe(true)
  })

  it('leaves numbers that are not thousands alone', () => {
    expect(stripThousands('4.83 and 1,612 and 12,00 and 2,4')).toBe(
      '4.83 and 1612 and 12,00 and 2,4',
    )
  })
})

describe('claims a candidate cannot defend', () => {
  it('flags a ranking asserted against a field with no data behind it', () => {
    const issue = auditLanguage('Our NABCEP pass rate is the best in the region')
    expect(issue?.status).toBe('UNVERIFIABLE_COMPARISON')
  })

  it('flags a company award claimed as personal work', () => {
    const issue = auditLanguage(
      'Was responsible for the company winning Regional Installer of the Year',
    )
    expect(issue?.status).toBe('UNCLEAR_ATTRIBUTION')
  })

  it('leaves an ordinary quantified claim alone', () => {
    expect(auditLanguage('Maintained CSAT above 4.8 across 2,400 installs in 2024')).toBeUndefined()
    expect(auditLanguage('Reduced truck rolls by 18% year over year')).toBeUndefined()
    // "best practices" is not a ranking claim — it has no comparison scope.
    expect(auditLanguage('Documented best practices for the install team')).toBeUndefined()
  })
})

describe('asy_claim_audit reads the evidence it is given', () => {
  const rt = testRuntime()
  const ctx = () => ({ store: rt.store, router: rt.router, fetcher: rt.fetcher, cfg: rt.cfg })

  it('accepts evidence alongside claims instead of discarding it', async () => {
    const result = await claimAudit(ctx(), {
      claims: [
        'Maintained CSAT above 4.8 across 2,400 installs in 2024',
        'Our NABCEP pass rate is the best in the region',
      ],
      evidence:
        'Support export 2024: CSAT 4.83 mean over 1,612 responses across 2,400 installs. I do not have regional NABCEP pass-rate comparison data.',
    })
    expect(result.data['ok']).toBe(true)
    const audited = result.data['audited'] as Array<{ text: string; status: string }>
    expect(audited).toHaveLength(2)
    // The ranking is a finding no matter what the evidence says, because the evidence cannot
    // support a ranking.
    expect(audited.find((a) => a.text.includes('NABCEP'))?.status).toBe('UNVERIFIABLE_COMPARISON')
  })

  it('still refuses when there is nothing at all to audit', async () => {
    const result = await claimAudit(ctx(), {})
    expect(result.refused).toBe(true)
  })
})

describe('the reported false positive, end to end', () => {
  const rt = testRuntime()

  it('does not call a figure unsupported when the evidence states it verbatim', async () => {
    const result = await claimAudit(
      { store: rt.store, router: rt.router, fetcher: rt.fetcher, cfg: rt.cfg },
      {
        claims: ['Maintained CSAT above 4.8 across 2,400 installs in 2024'],
        evidence:
          'Support export: CSAT 4.83 mean, 2,400 installs, 1,612 responses, 2024 calendar year.',
      },
    )
    const audited = result.data['audited'] as Array<{ status: string; issue: string }>
    expect(audited[0]?.status).toBe('SUPPORTED')
  })

  it('still catches a figure the evidence genuinely does not carry', async () => {
    const result = await claimAudit(
      { store: rt.store, router: rt.router, fetcher: rt.fetcher, cfg: rt.cfg },
      {
        claims: ['Maintained CSAT above 4.8 across 9,900 installs in 2024'],
        evidence:
          'Support export: CSAT 4.83 mean, 2,400 installs, 1,612 responses, 2024 calendar year.',
      },
    )
    const audited = result.data['audited'] as Array<{ status: string; issue: string }>
    expect(audited[0]?.status).toBe('UNSUPPORTED_NUMBER')
    expect(audited[0]?.issue).toContain('9,900')
  })
})
