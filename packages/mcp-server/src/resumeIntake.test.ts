import { describe, expect, it } from 'vitest'
import { preflight, serviceSchema } from './intake'
import { claimLinesFromResume, tailorResume } from './pipelines'
import { testRuntime } from './testutil'

// "Tailor Résumé" used to reject a résumé. The published schema was additionalProperties:false
// over {dossierId, profile, claims, evidence, jd}, so `resumeText` came back EVIDENCE_REQUIRED —
// a clean, well-explained refusal of the single most obvious way to use the service.

const RESUME = `Jane Okafor
jane@example.com
https://example.com/jane

EXPERIENCE
Northwind Freight — Platform Engineer, 2021-2024
- Led migration of 14 legacy services to Kubernetes, cutting deploy time from 45 minutes to 6 minutes
- Mentored 4 engineers, all of whom were promoted within the review period
- Built an automated configuration linter now adopted by 9 teams

SKILLS
Kubernetes, Terraform, Go`

describe('a résumé is admissible evidence for the writer services', () => {
  it('takes résumé lines as claims and drops headings and contact lines', () => {
    const lines = claimLinesFromResume(RESUME)
    // The four achievement bullets plus the employment line, which is itself a claim about where
    // and when the candidate worked. Headings, the email and the bare URL are not claims.
    expect(lines).toHaveLength(5)
    expect(lines.some((l) => /^EXPERIENCE$/i.test(l))).toBe(false)
    expect(lines.some((l) => l.includes('@'))).toBe(false)
    expect(lines.some((l) => /^https?:/i.test(l))).toBe(false)
    expect(lines[1]).toContain('14 legacy services')
  })

  it('accepts resumeText at preflight for every writer service', () => {
    for (const tool of [
      'asy_tailor_resume',
      'asy_cover_letter',
      'asy_story_bank',
      'asy_interview_prep',
    ])
      expect(preflight(tool, { resumeText: RESUME }).ok).toBe(true)
  })

  it('publishes resumeText in the free input contract', () => {
    const schema = serviceSchema('asy_tailor_resume', 'http://localhost') as {
      arguments?: Array<{ name: string }>
    }
    expect((schema.arguments ?? []).map((a) => a.name)).toContain('resumeText')
  })

  it('still refuses to write from nothing at all', () => {
    const check = preflight('asy_tailor_resume', { jd: 'Senior Platform Engineer' })
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.accepts).toContain('resumeText')
  })

  it('produces cited sentences from a résumé alone', async () => {
    const rt = testRuntime()
    const result = await tailorResume(
      { store: rt.store, router: rt.router, fetcher: rt.fetcher, cfg: rt.cfg },
      { resumeText: RESUME, jd: 'Senior Platform Engineer' },
    )
    expect(result.refused).toBeFalsy()
    expect(result.data['ok']).toBe(true)
  })
})
