import { describe, it, expect } from 'vitest'
import { assertRenderable, isRenderable, extractNumbers, toQuestions } from './claimGate'
import { ClaimSchema, EvidenceItemSchema } from './schemas'
import type { Sentence } from './types'

const ev = (over: Record<string, unknown> = {}) =>
  EvidenceItemSchema.parse({ kind: 'document', label: 'doc', sourceRef: 'ref', ...over })
const claim = (over: Record<string, unknown> = {}) => ClaimSchema.parse({ text: 't', ...over })

describe('claimGate.assertRenderable', () => {
  it('passes a fully-supported sentence with a matching number', () => {
    const e = ev({ id: 'EV-1' })
    const c = claim({
      id: 'CLM-1',
      status: 'confirmed',
      evidenceIds: ['EV-1'],
      numericFacts: [{ value: 30, unit: '%', context: 'uplift' }],
    })
    const s: Sentence[] = [{ text: 'Increased conversion by 30%.', claimIds: ['CLM-1'] }]
    expect(assertRenderable(s, [c], [e])).toEqual([])
    expect(isRenderable(s, [c], [e])).toBe(true)
  })

  it('flags a sentence with no claim as UNSUPPORTED_SENTENCE', () => {
    const s: Sentence[] = [{ text: 'A bold unbacked claim.', claimIds: [] }]
    expect(assertRenderable(s, [], []).map((x) => x.code)).toContain('UNSUPPORTED_SENTENCE')
  })

  it('flags a sentence citing a missing claim', () => {
    const s: Sentence[] = [{ text: 'x', claimIds: ['CLM-nope'] }]
    const f = assertRenderable(s, [], [])
    expect(f[0].code).toBe('UNSUPPORTED_SENTENCE')
    expect(f[0].detail).toContain('CLM-nope')
  })

  it('flags an unconfirmed claim as UNCONFIRMED_CLAIM', () => {
    const e = ev({ id: 'EV-1' })
    const c = claim({ id: 'CLM-1', status: 'extracted', evidenceIds: ['EV-1'] })
    const s: Sentence[] = [{ text: 'Some line.', claimIds: ['CLM-1'] }]
    expect(assertRenderable(s, [c], [e]).map((x) => x.code)).toContain('UNCONFIRMED_CLAIM')
  })

  it('flags a confirmed claim with no evidence as DANGLING_EVIDENCE', () => {
    const c = claim({ id: 'CLM-1', status: 'confirmed', evidenceIds: [] })
    const s: Sentence[] = [{ text: 'Some line.', claimIds: ['CLM-1'] }]
    expect(assertRenderable(s, [c], []).map((x) => x.code)).toContain('DANGLING_EVIDENCE')
  })

  it('flags a claim whose evidenceId does not resolve as DANGLING_EVIDENCE', () => {
    const c = claim({ id: 'CLM-1', status: 'confirmed', evidenceIds: ['EV-missing'] })
    const s: Sentence[] = [{ text: 'Some line.', claimIds: ['CLM-1'] }]
    expect(assertRenderable(s, [c], []).map((x) => x.code)).toContain('DANGLING_EVIDENCE')
  })

  it('flags a number not present in the cited evidence (increased sales 40% vs 30%)', () => {
    const e = ev({ id: 'EV-1' })
    const c = claim({
      id: 'CLM-1',
      status: 'confirmed',
      evidenceIds: ['EV-1'],
      numericFacts: [{ value: 30, unit: '%', context: 'uplift' }],
    })
    const s: Sentence[] = [{ text: 'Increased sales 40%.', claimIds: ['CLM-1'] }]
    expect(assertRenderable(s, [c], [e]).map((x) => x.code)).toContain('NUMBER_NOT_IN_EVIDENCE')
  })

  it('accepts $ and x figures when they match the cited facts', () => {
    const e = ev({ id: 'EV-1' })
    const c = claim({
      id: 'CLM-1',
      status: 'confirmed',
      evidenceIds: ['EV-1'],
      numericFacts: [
        { value: 1200, unit: '$', context: 'savings' },
        { value: 3, unit: 'x', context: 'growth' },
      ],
    })
    const s: Sentence[] = [{ text: 'Saved $1,200 and grew pipeline 3x.', claimIds: ['CLM-1'] }]
    expect(assertRenderable(s, [c], [e])).toEqual([])
  })
})

describe('extractNumbers', () => {
  it('parses percentages, currency, multipliers and plain numbers', () => {
    expect(extractNumbers('up 40% to $1,200 and 3x over 5 teams')).toEqual([
      { raw: '40%', value: 40, unit: '%' },
      { raw: '$1,200', value: 1200, unit: '$' },
      { raw: '3x', value: 3, unit: 'x' },
      { raw: '5', value: 5, unit: '' },
    ])
  })
})

describe('toQuestions', () => {
  it('turns findings into de-duplicated user-facing questions', () => {
    const qs = toQuestions([
      { code: 'UNSUPPORTED_SENTENCE', ref: 'A', detail: '' },
      { code: 'UNSUPPORTED_SENTENCE', ref: 'A', detail: '' },
      { code: 'NUMBER_NOT_IN_EVIDENCE', ref: 'B :: 40%', detail: '' },
    ])
    expect(qs).toHaveLength(2)
    expect(qs[0]).toContain('no supporting claim')
  })
})
