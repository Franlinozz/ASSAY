import { describe, it, expect } from 'vitest'
import { passRule, renderStandardMarkdown, CRAFT_AXES } from './standard'
import { HARD_CHECKS } from './hard/index'
import type { CheckStatus } from './hard/types'

const s = (status: CheckStatus) => ({ status })
const GOOD = { voice: 80, specificity: 80, quantification: 80, positioning: 80, tailoring: 80, evidence_honesty: 80 }

describe('passRule (hard/craft split, exact)', () => {
  it('passes when all hard checks pass and craft clears the bar', () => {
    const hard = HARD_CHECKS.map(() => s('pass'))
    expect(passRule(hard, GOOD).pass).toBe(true)
  })

  it('a single hard failure overrides excellent craft', () => {
    const excellent = { voice: 95, specificity: 95, quantification: 95, positioning: 95, tailoring: 95, evidence_honesty: 95 }
    const v = passRule([s('fail'), s('pass')], excellent)
    expect(v.hardPass).toBe(false)
    expect(v.pass).toBe(false)
  })

  it('fails just below the craft boundary (weighted mean < 72)', () => {
    const scores = { voice: 72, specificity: 72, quantification: 72, positioning: 72, tailoring: 72, evidence_honesty: 71 }
    const v = passRule([s('pass')], scores)
    expect(v.weightedMean).toBeLessThan(72)
    expect(v.craftPass).toBe(false)
    expect(v.pass).toBe(false)
  })

  it('passes at exactly 72 with every axis >= 60', () => {
    const scores = { voice: 72, specificity: 72, quantification: 72, positioning: 72, tailoring: 72, evidence_honesty: 72 }
    const v = passRule([s('pass')], scores)
    expect(v.weightedMean).toBe(72)
    expect(v.pass).toBe(true)
  })

  it('fails when one axis is below the floor even though the mean clears 72', () => {
    const scores = { voice: 90, specificity: 90, quantification: 90, positioning: 90, tailoring: 90, evidence_honesty: 59 }
    const v = passRule([s('pass')], scores)
    expect(v.weightedMean).toBeGreaterThanOrEqual(72)
    expect(v.craftPass).toBe(false)
  })

  it('pending and skip hard checks do not block', () => {
    expect(passRule([s('pending'), s('skip'), s('pass')], GOOD).hardPass).toBe(true)
  })

  it('non-prose (structured) artifacts pass on hard checks alone', () => {
    expect(passRule([s('pass')], {}, { craftApplicable: false }).pass).toBe(true)
    expect(passRule([s('pass')], {}, { craftApplicable: false }).craftPass).toBe(true)
    expect(passRule([s('fail')], {}, { craftApplicable: false }).pass).toBe(false)
  })
})

describe('the standard publishes itself', () => {
  it('defines the six craft axes in order', () => {
    expect(CRAFT_AXES.map((a) => a.id)).toEqual([
      'voice',
      'specificity',
      'quantification',
      'positioning',
      'tailoring',
      'evidence_honesty',
    ])
  })

  it('renderStandardMarkdown is generated from the same registry the grader uses', () => {
    const md = renderStandardMarkdown()
    expect(md).toContain('AS-1.0.0')
    expect(md).toContain('does not bend')
    expect(md).toContain('≥ 72')
    expect(md).toContain('below 60')
    for (const c of HARD_CHECKS) expect(md).toContain(`\`${c.id}\``)
    for (const a of CRAFT_AXES) expect(md).toContain(a.title)
  })
})
