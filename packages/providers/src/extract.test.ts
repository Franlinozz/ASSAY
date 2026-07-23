import { describe, it, expect } from 'vitest'
import { extractProfile } from './extract'
import { ModelRouter } from './router'
import { setRawSink } from './gaps'
import type { GenerateRequest, ModelAdapter, RawResult, Role } from './types'

class ScriptedExtractor implements ModelAdapter {
  readonly name = 'fake' as const
  constructor(private readonly payload: unknown) {}
  supports(_role: Role): boolean {
    return true
  }
  async generate(_req: GenerateRequest): Promise<RawResult> {
    return { text: JSON.stringify(this.payload) }
  }
}

const SOURCE = 'Chidinma Eze. Reduced API latency by 38% using PostgreSQL pooling. Mentored 5 engineers.'

function routerWith(payload: unknown): ModelRouter {
  return new ModelRouter([new ScriptedExtractor(payload)])
}

describe('extractProfile groundedness post-check', () => {
  it('drops a planted hallucinated claim and keeps grounded ones', async () => {
    setRawSink(() => {})
    const payload = {
      profile: { fullName: 'Chidinma Eze', timezone: 'UTC' },
      experiences: [],
      claims: [
        { text: 'Reduced API latency by 38% using PostgreSQL pooling', numericFacts: [{ value: 38, unit: '%', context: 'latency' }] },
        { text: 'Won the Nobel Prize in Physics in Stockholm' },
        { text: 'Mentored 5 engineers', numericFacts: [{ value: 5, context: 'mentees' }] },
      ],
    }
    const res = await extractProfile({ documents: [{ label: 'resume', contentText: SOURCE }], router: routerWith(payload) })
    const texts = res.claims.map((c) => c.text)
    expect(texts).toContain('Reduced API latency by 38% using PostgreSQL pooling')
    expect(texts).toContain('Mentored 5 engineers')
    expect(texts.some((t) => /Nobel/.test(t))).toBe(false)
    expect(res.gaps.some((g) => g.code === 'EXTRACT_UNGROUNDED')).toBe(true)
  })

  it('marks a quantified-without-source claim as needs_confirmation', async () => {
    setRawSink(() => {})
    const payload = {
      profile: { fullName: 'Chidinma Eze', timezone: 'UTC' },
      claims: [{ text: 'Reduced API latency using PostgreSQL pooling by a lot', numericFacts: [{ value: 99, unit: '%', context: 'latency' }] }],
    }
    const res = await extractProfile({ documents: [{ label: 'resume', contentText: SOURCE }], router: routerWith(payload) })
    expect(res.claims).toHaveLength(1)
    expect(res.claims[0].status).toBe('needs_confirmation')
  })

  it('links kept claims to document evidence and computes a documented tier', async () => {
    setRawSink(() => {})
    const payload = {
      profile: { fullName: 'Chidinma Eze', timezone: 'UTC' },
      claims: [{ text: 'Reduced API latency by 38% using PostgreSQL pooling' }],
    }
    const res = await extractProfile({ documents: [{ label: 'resume', contentText: SOURCE }], router: routerWith(payload) })
    expect(res.claims[0].evidenceIds).toHaveLength(1)
    expect(res.claims[0].strength).toBe('documented')
    expect(res.evidence[0].kind).toBe('document')
  })
})
