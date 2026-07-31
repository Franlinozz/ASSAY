import { afterEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { buildApp } from './http'
import { testRuntime, type TestRig } from './testutil'
import { runPaidWork } from './delivery'
import { sha256Hex } from './util'

// The bug these tests exist for: on 2026-07-31 three production purchases settled on-chain,
// completed, cached their results — and were never received, because the buyer's client abandons
// the request at ~30s and Assay held the response until the work finished. The buyer had no way
// back to the work they had paid for. Settlement is not delivery.

const servers: Server[] = []
afterEach(() => {
  for (const s of servers.splice(0)) s.close()
})

function start(rt: TestRig): { base: string; rt: TestRig } {
  const server = buildApp(rt).listen(0)
  servers.push(server)
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, rt }
}

// Fake providers answer instantly, so nothing in this repo is naturally slower than a response
// budget. Production is: the craft critic alone measured 18-23s. Slow the model down to reproduce
// a capability that outruns its budget without spending a cent.
function slowRouter(rt: TestRig, delayMs: number): void {
  const generate = rt.router.generate.bind(rt.router)
  rt.router.generate = async (req, ctx) => {
    await new Promise((r) => setTimeout(r, delayMs))
    return generate(req, ctx)
  }
}

const PAID_BODY = {
  claims: ['Cut deploy time from 45 minutes to 6 minutes across 14 services'],
  evidence: 'Platform engineer 2021-2024; deploy time fell from 45 minutes to 6 minutes.',
  jd: 'Senior Platform Engineer',
}

async function buy(
  base: string,
  slug: string,
  sig: string,
  body: unknown = PAID_BODY,
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const res = await fetch(`${base}/x402/${slug}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'PAYMENT-SIG': sig },
    body: JSON.stringify(body),
  })
  return {
    status: res.status,
    json: (await res.json()) as Record<string, unknown>,
    headers: res.headers,
  }
}

describe('runPaidWork', () => {
  it('caches and returns the result when the work beats the budget', async () => {
    const rt = testRuntime()
    rt.store.createOrder({
      tool: 'asy_cover_letter',
      priceUsdt: 0.15,
      idempotencyKey: 'k-fast',
      status: 'settled',
    })
    const outcome = await runPaidWork({
      store: rt.store,
      idempotencyKey: 'k-fast',
      budgetMs: 5_000,
      run: () => Promise.resolve({ ok: true, value: 42 }),
    })
    expect(outcome.kind).toBe('delivered')
    expect(rt.store.getOrderByIdempotencyKey('k-fast')?.result).toContain('42')
  })

  it('hands back "working" at the budget but still finishes and caches the work', async () => {
    const rt = testRuntime()
    rt.store.createOrder({
      tool: 'asy_story_bank',
      priceUsdt: 0.2,
      idempotencyKey: 'k-slow',
      status: 'settled',
    })
    const outcome = await runPaidWork({
      store: rt.store,
      idempotencyKey: 'k-slow',
      budgetMs: 20,
      run: () => new Promise((r) => setTimeout(() => r({ ok: true, late: true }), 120)),
    })
    expect(outcome.kind).toBe('working')
    // The buyer got a receipt, not a loss: the work lands in the order moments later.
    expect(rt.store.getOrderByIdempotencyKey('k-slow')?.result).toBeNull()
    await new Promise((r) => setTimeout(r, 200))
    expect(rt.store.getOrderByIdempotencyKey('k-slow')?.result).toContain('late')
  })

  it('does not cache a failed run, so the same payment proof re-runs it for free', async () => {
    const rt = testRuntime()
    rt.store.createOrder({
      tool: 'asy_cover_letter',
      priceUsdt: 0.15,
      idempotencyKey: 'k-fail',
      status: 'settled',
    })
    const outcome = await runPaidWork({
      store: rt.store,
      idempotencyKey: 'k-fail',
      budgetMs: 5_000,
      run: () => Promise.reject(new Error('provider died')),
    })
    expect(outcome.kind).toBe('failed')
    expect(rt.store.getOrderByIdempotencyKey('k-fail')?.result).toBeNull()
  })
})

describe('a paid purchase can always be collected', () => {
  it('returns a receipt instead of stranding the buyer when work outruns the budget', { timeout: 30_000 }, async () => {
    const rig = testRuntime({ ASY_PAID_INLINE_BUDGET_MS: '30' })
    slowRouter(rig, 120)
    const { base, rt } = start(rig)
    const bought = await buy(base, 'asy_cover_letter', 'sig-receipt-0001')
    expect(bought.status).toBe(200)
    expect(bought.json['status']).toBe('working')
    expect(bought.json['charged']).toBe(true)
    const receipt = String(bought.json['receipt'])
    expect(receipt).toMatch(/^ord_/)

    // The work continues; collection is free and needs no payment proof.
    for (let i = 0; i < 100 && !rt.store.getOrder(receipt)?.result; i++)
      await new Promise((r) => setTimeout(r, 50))
    const collected = await fetch(`${base}/x402/receipt/${receipt}`)
    expect(collected.status).toBe(200)
    const body = (await collected.json()) as Record<string, unknown>
    expect(body['status']).toBe('delivered')
    expect((body['result'] as { summary?: string }).summary).toBeTruthy()
  })

  it('reports an unknown receipt honestly rather than inventing a purchase', async () => {
    const { base } = start(testRuntime())
    const res = await fetch(`${base}/x402/receipt/ord_nope`)
    expect(res.status).toBe(404)
    expect(((await res.json()) as Record<string, unknown>)['reason']).toBe('UNKNOWN_RECEIPT')
  })

  it('never charges twice for an identical request whose result was never delivered', { timeout: 30_000 }, async () => {
    const rig = testRuntime({ ASY_PAID_INLINE_BUDGET_MS: '30' })
    slowRouter(rig, 120)
    const { base, rt } = start(rig)
    const first = await buy(base, 'asy_cover_letter', 'sig-stranded-0001')
    const receipt = String(first.json['receipt'])
    for (let i = 0; i < 100 && !rt.store.getOrder(receipt)?.result; i++)
      await new Promise((r) => setTimeout(r, 50))
    expect(rt.store.getOrder(receipt)?.deliveredAt).toBeNull()

    // The buyer's client timed out and re-sends the same body with a FRESH payment proof — exactly
    // what happened in production. They get the work they already bought, and no second order.
    const before = rt.store.orderCount()
    const retry = await buy(base, 'asy_cover_letter', 'sig-stranded-0002')
    expect(retry.status).toBe(200)
    expect(retry.headers.get('assay-recovered-receipt')).toBe(receipt)
    expect(rt.store.orderCount()).toBe(before)
    expect(rt.store.getOrder(receipt)?.deliveredAt).not.toBeNull()
  })

  it('does not hand out a delivered purchase to a later identical request', async () => {
    const { base, rt } = start(testRuntime())
    const first = await buy(base, 'asy_claim_audit', 'sig-delivered-0001')
    expect(first.status).toBe(200)
    expect(first.json['status']).not.toBe('working')
    const before = rt.store.orderCount()

    // This one was received, so the next buyer of the same input is a genuine second sale.
    const second = await buy(base, 'asy_claim_audit', 'sig-delivered-0002')
    expect(second.status).toBe(200)
    expect(second.headers.get('assay-recovered-receipt')).toBeNull()
    expect(rt.store.orderCount()).toBe(before + 1)
  })

  it('records delivery only when the response actually reaches the buyer', async () => {
    const { base, rt } = start(testRuntime())
    await buy(base, 'asy_claim_audit', 'sig-flush-0001')
    // The idempotency key is the sha256 of the payment signature.
    const order = rt.store.getOrderByIdempotencyKey(sha256Hex('sig-flush-0001').slice(0, 80))
    expect(order?.result).toBeTruthy()
    expect(order?.deliveredAt).not.toBeNull()
  })
})

describe('the collection surface is discoverable and free', () => {
  it('exposes asy_order_result as a free service on its own route', async () => {
    const { base, rt } = start(testRuntime())
    const bought = await buy(base, 'asy_claim_audit', 'sig-route-0001')
    expect(bought.status).toBe(200)
    const order = rt.store.getOrderByIdempotencyKey(sha256Hex('sig-route-0001').slice(0, 80))!
    const res = await fetch(`${base}/x402/asy_order_result`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // "orderId" is a synonym, so a caller that guesses the key still collects.
      body: JSON.stringify({ orderId: order.id }),
    })
    // No PAYMENT-SIG, no 402: collecting a settled purchase costs nothing.
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data?: Record<string, unknown> }
    expect(body.data?.['receipt'] ?? body.data?.['status']).toBeTruthy()
  })

  it('publishes the free price in the manifest', async () => {
    const { base } = start(testRuntime())
    const manifest = (await (await fetch(`${base}/.well-known/assay.json`)).json()) as {
      tools: Array<{ name: string; free: boolean }>
    }
    expect(manifest.tools.find((t) => t.name === 'asy_order_result')?.free).toBe(true)
  })
})

// The judging worry this exists for: if a judge buys the story bank and the tribunal grade outruns
// the response window, they must still receive STORIES. A response whose whole content is
// {status:"working"} reads as a service that took the money and produced nothing.
describe('a budget expiry still delivers what the buyer bought', () => {
  it('carries the cited sentences in-band when only the grade is still running', { timeout: 30_000 }, async () => {
    const rig = testRuntime({ ASY_PAID_INLINE_BUDGET_MS: '40' })
    // Only the critic is slow — the writer lands, the grade does not. This is production's shape:
    // the writer measured 2.5-9s and the craft critic 6-23s.
    const generate = rig.router.generate.bind(rig.router)
    rig.router.generate = async (req, ctx) => {
      if (req.role === 'critic') await new Promise((r) => setTimeout(r, 400))
      return generate(req, ctx)
    }
    const { base, rt } = start(rig)
    const bought = await buy(base, 'asy_story_bank', 'sig-partial-0001')

    expect(bought.status).toBe(200)
    expect(bought.json['status']).toBe('partial')
    expect(bought.json['charged']).toBe(true)
    const result = bought.json['result'] as { data: { sentences: { text: string }[] } }
    // The actual deliverable, in the actual response.
    expect(result.data.sentences.length).toBeGreaterThan(0)
    expect(result.data.sentences[0]!.text.length).toBeGreaterThan(10)

    // And the graded version completes and is collectable under the same receipt.
    const receipt = String(bought.json['receipt'])
    for (let i = 0; i < 100 && !rt.store.getOrder(receipt)?.result; i++)
      await new Promise((r) => setTimeout(r, 50))
    const collected = (await (await fetch(`${base}/x402/receipt/${receipt}`)).json()) as {
      status: string
      result: { data: { tribunal?: unknown } }
    }
    expect(collected.status).toBe('delivered')
    expect(collected.result.data.tribunal).toBeTruthy()
  })

  it('says "working" only when there is genuinely nothing to show yet', async () => {
    const rig = testRuntime({ ASY_PAID_INLINE_BUDGET_MS: '30' })
    slowRouter(rig, 200)
    const { base } = start(rig)
    // The writer itself is slow here, so no deliverable exists at the budget.
    const bought = await buy(base, 'asy_story_bank', 'sig-nothing-0001')
    expect(bought.json['status']).toBe('working')
    expect(bought.json['result']).toBeUndefined()
  })
})
