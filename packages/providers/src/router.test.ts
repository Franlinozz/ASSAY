import { describe, it, expect } from 'vitest'
import { ModelRouter } from './router'
import { Governor } from './governor'
import type { GenerateRequest, ModelAdapter, ProviderName, RawResult, Role } from './types'

class StubAdapter implements ModelAdapter {
  calls = 0
  constructor(
    readonly name: ProviderName,
    private readonly impl: (req: GenerateRequest, call: number) => Promise<RawResult>,
  ) {}
  supports(_role: Role): boolean {
    return true
  }
  async generate(req: GenerateRequest): Promise<RawResult> {
    this.calls += 1
    return this.impl(req, this.calls)
  }
}

describe('ModelRouter', () => {
  it('repairs invalid JSON with one retry on the same adapter', async () => {
    const adapter = new StubAdapter('openai', async (_req, n) =>
      n === 1 ? { text: 'not json at all' } : { text: '{"ok":true}' },
    )
    const router = new ModelRouter([adapter])
    const res = await router.generate({ role: 'extractor', prompt: 'x', json: true })
    expect(res.degraded).toBe(false)
    expect(res.json).toEqual({ ok: true })
    expect(adapter.calls).toBe(2)
    expect(res.provider).toBe('openai')
  })

  it('falls back to the next adapter when the primary throws', async () => {
    const failing = new StubAdapter('deepseek', async () => {
      throw new Error('boom')
    })
    const good = new StubAdapter('openai', async () => ({ text: 'hello' }))
    const res = await new ModelRouter([failing, good]).generate({ role: 'extractor', prompt: 'x' })
    expect(res.degraded).toBe(false)
    expect(res.provider).toBe('openai')
    expect(res.text).toBe('hello')
  })

  it('times out, falls back, then degrades when all adapters hang', async () => {
    const hang = () => new Promise<RawResult>(() => {})
    const a = new StubAdapter('deepseek', hang)
    const b = new StubAdapter('openai', hang)
    const router = new ModelRouter([a, b], { timeoutMs: { extractor: 20 } })
    const res = await router.generate({ role: 'extractor', prompt: 'x' })
    expect(res.degraded).toBe(true)
    expect(res.gap).toBe('PROVIDER_TIMEOUT')
    expect(a.calls).toBe(1)
    expect(b.calls).toBe(1)
  })

  it('trips into COST_CAP without calling any adapter when the budget is exhausted', async () => {
    const gov = new Governor({ maxCostUsd: 0.01, maxTokens: 100 })
    gov.charge('d1', { inputTokens: 200, outputTokens: 0, costUsd: 0 })
    const adapter = new StubAdapter('openai', async () => ({ text: '{}' }))
    const res = await new ModelRouter([adapter], { governor: gov }).generate(
      { role: 'extractor', prompt: 'x', json: true },
      { dossierId: 'd1' },
    )
    expect(res.degraded).toBe(true)
    expect(res.gap).toBe('COST_CAP')
    expect(adapter.calls).toBe(0)
  })

  it('charges the governor on a successful call', async () => {
    const gov = new Governor({ maxCostUsd: 1, maxTokens: 1000 })
    const adapter = new StubAdapter('openai', async () => ({
      text: 'ok',
      usage: { inputTokens: 10, outputTokens: 20, costUsd: 0.001 },
    }))
    await new ModelRouter([adapter], { governor: gov }).generate(
      { role: 'utility', prompt: 'x' },
      { dossierId: 'd2' },
    )
    expect(gov.spentFor('d2').tokens).toBe(30)
  })
})
