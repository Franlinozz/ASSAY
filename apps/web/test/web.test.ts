import { describe, expect, it } from 'vitest'
import { SITE, TIERS, INTEGRITY_LINE } from '../lib/site'
import { STANDARD, STANDARD_MARKDOWN, TOOL_PRICES, TOOLS } from '../lib/standard.generated'

// The web app's own guardrail tests: the generated modules the pages render from must stay
// complete and coherent with the published facts.

describe('site constants', () => {
  it('carries the four evidence tiers, never collapsed', () => {
    expect(Object.keys(TIERS)).toEqual(['attested', 'documented', 'linked', 'sealed'])
  })
  it('states the integrity-vs-truth line verbatim', () => {
    expect(INTEGRITY_LINE).toContain(
      'A seal proves the artifact is unchanged — not that a claim is objectively true.',
    )
  })
  it('pins the real registry + agent facts', () => {
    expect(SITE.registry).toMatch(/^0x[0-9a-f]{40}$/)
    expect(SITE.chainId).toBe(196)
    expect(SITE.agentId).toBe('8599')
  })
})

describe('generated standard (guardrail #2)', () => {
  it('has the 15 shipped hard checks, 6 craft axes, and artifact profiles', () => {
    expect(STANDARD.hardChecks).toHaveLength(15)
    expect(STANDARD.craftAxes).toHaveLength(6)
    expect(STANDARD.artifactProfiles).toHaveLength(16)
  })
  it('markdown carries the no-bend motto', () => {
    expect(STANDARD_MARKDOWN).toContain('The standard does not bend for our own marketing.')
  })
})

describe('generated price table (guardrail #5)', () => {
  it('matches the fixed table exactly', () => {
    expect(TOOL_PRICES).toEqual({
      asy_ats_scan: 0.05,
      asy_claim_audit: 0.05,
      asy_fit_brief: 0.1,
      asy_cover_letter: 0.15,
      asy_story_bank: 0.2,
      asy_interview_prep: 0.2,
      asy_tailor_resume: 0.3,
      asy_create_dossier_job: 2,
      asy_job_status: 0,
      asy_job_result: 0,
      asy_verify: 0,
    })
  })
  it('documents all eleven tools with schema-derived args', () => {
    expect(TOOLS).toHaveLength(11)
    for (const tool of TOOLS) {
      expect(tool.marketplaceSummary.length).toBeGreaterThan(30)
      expect(tool.description.length).toBeGreaterThan(40)
      expect(Array.isArray(tool.args)).toBe(true)
    }
  })
})
