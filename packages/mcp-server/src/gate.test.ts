import { describe, it, expect } from 'vitest'
import { DevGate, buildRoutes } from './gate'
import { A2MCP_ROUTE_TARGETS, isPaid } from './config'
import { testRuntime, fakeReq } from './testutil'

describe('DevGate (documented x402 shape, no facilitator)', () => {
  it('challenges an unpaid paid-tool call with a base64 PAYMENT-REQUIRED advertising eip155:196 + USDT', async () => {
    const { cfg } = testRuntime()
    const gate = new DevGate(cfg)
    const decision = await gate.check(fakeReq(), { tool: 'asy_ats_scan', priceUsdt: 0.05 })
    expect(decision.kind).toBe('challenge')
    if (decision.kind !== 'challenge') throw new Error('expected challenge')
    expect(decision.status).toBe(402)
    const header = decision.headers['PAYMENT-REQUIRED']
    expect(header).toBeTruthy()
    const challenge = JSON.parse(Buffer.from(header!, 'base64').toString()) as {
      x402Version: number
      resource: { url: string }
      accepts: Array<{ network: string; asset: string; scheme: string; amount: string }>
    }
    expect(challenge.x402Version).toBe(2)
    expect(challenge.resource.url).toBe('http://localhost/mcp')
    expect(challenge.accepts[0]!.network).toBe('eip155:196')
    expect(challenge.accepts[0]!.asset).toBe('0x779ded0c9e1022225f8e0630b35a9b54be713736')
    expect(challenge.accepts[0]!.scheme).toBe('exact')
    expect(challenge.accepts[0]!.amount).toBe('50000')
  })

  it('settles a signed replay and returns a PAYMENT-RESPONSE proof', async () => {
    const { cfg } = testRuntime()
    const gate = new DevGate(cfg)
    const decision = await gate.check(fakeReq({ 'PAYMENT-SIG': 'signed-proof-abc123' }), {
      tool: 'asy_fit_brief',
      priceUsdt: 0.1,
    })
    expect(decision.kind).toBe('settled')
    if (decision.kind !== 'settled') throw new Error('expected settled')
    expect(decision.settlement['PAYMENT-RESPONSE']).toBeTruthy()
    expect(decision.payerRef).toMatch(/^dev:/)
  })

  it('rejects a trivially short signature', async () => {
    const { cfg } = testRuntime()
    const gate = new DevGate(cfg)
    const decision = await gate.check(fakeReq({ 'PAYMENT-SIG': 'x' }), {
      tool: 'asy_fit_brief',
      priceUsdt: 0.1,
    })
    expect(decision.kind).toBe('error')
  })
})

describe('OkxGate paid-route map (prod-only config, unreachable in CI)', () => {
  it('challenges on GET /mcp — the probe a marketplace buyer validates an endpoint with', () => {
    const { cfg } = testRuntime()
    const routes = buildRoutes(cfg)
    // Registered endpoint of the ATS Resume Scan service: without this row the SDK answers
    // "no payment required", the route returns 200, and the buyer refuses to purchase.
    expect(Object.keys(routes)).toContain('GET /mcp')
    expect(Object.keys(routes)).toContain('POST /mcp')
  })

  it('covers both methods of every paid marketplace resource', () => {
    const { cfg } = testRuntime()
    const routes = buildRoutes(cfg)
    for (const [slug, target] of Object.entries(A2MCP_ROUTE_TARGETS)) {
      if (!isPaid(target.tool)) continue
      expect(Object.keys(routes), slug).toContain(`GET /x402/${slug}`)
      expect(Object.keys(routes), slug).toContain(`POST /x402/${slug}`)
    }
  })
})
