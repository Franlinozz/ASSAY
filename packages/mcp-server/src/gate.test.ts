import { describe, it, expect } from 'vitest'
import { DevGate } from './gate'
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
      accepts: Array<{ network: string; asset: string; scheme: string; price: string }>
    }
    expect(challenge.accepts[0]!.network).toBe('eip155:196')
    expect(challenge.accepts[0]!.asset).toBe('USDT')
    expect(challenge.accepts[0]!.scheme).toBe('exact')
    expect(challenge.accepts[0]!.price).toBe('$0.05')
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
