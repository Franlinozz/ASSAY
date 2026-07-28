import { describe, it, expect } from 'vitest'
import { buildFactsBlock } from './facts'
import { ProfileSchema, ClaimSchema, BriefSchema } from './schemas'

const profile = () =>
  ProfileSchema.parse({
    fullName: 'Grace Hopper',
    headline: 'Systems Pioneer',
    timezone: 'America/New_York',
    contact: { email: 'grace@navy.example', links: ['https://gh.example'] },
    experiences: [{ org: 'US Navy', title: 'Rear Admiral', startYm: '1944-01', endYm: null }],
    skills: ['COBOL', 'Compilers'],
  })

describe('buildFactsBlock', () => {
  it('includes candidate name, timezone, product prices and the never-invent rule', () => {
    const block = buildFactsBlock({ profile: profile() })
    expect(block).toContain('Grace Hopper')
    expect(block).toContain('America/New_York')
    expect(block).toContain('asy_ats_scan 0.05')
    expect(block).toContain('Never invent')
  })

  it('lists only CONFIRMED claims and excludes unconfirmed ones', () => {
    const claims = [
      ClaimSchema.parse({
        id: 'CLM-OK',
        text: 'Coined the term debugging.',
        status: 'confirmed',
        evidenceIds: ['EV-1'],
      }),
      ClaimSchema.parse({ id: 'CLM-NO', text: 'Unverified boast.', status: 'extracted' }),
    ]
    const block = buildFactsBlock({ profile: profile(), claims })
    expect(block).toContain('CLM-OK')
    expect(block).not.toContain('CLM-NO')
    expect(block).not.toContain('Unverified boast')
  })

  it('warns when there are no confirmed claims', () => {
    expect(buildFactsBlock({ profile: profile(), claims: [] })).toContain('do not write claims')
  })

  it('includes brief requirements when a brief is provided', () => {
    const brief = BriefSchema.parse({
      jdText: 'x',
      decomposed: [{ id: 'R1', text: 'Compiler design', kind: 'must', keywords: ['compiler'] }],
    })
    const block = buildFactsBlock({ profile: profile(), brief })
    expect(block).toContain('Compiler design')
    expect(block).toContain('[must]')
  })
})
