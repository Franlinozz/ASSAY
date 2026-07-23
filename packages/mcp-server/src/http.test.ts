import { describe, it, expect, afterEach } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { buildApp } from './http'
import { testRuntime, type TestRig } from './testutil'

const servers: Server[] = []
afterEach(() => {
  while (servers.length) servers.pop()?.close()
})

function startApp(env: Record<string, string> = {}): { rig: TestRig; base: string } {
  const rig = testRuntime(env)
  const srv = buildApp(rig).listen(0)
  servers.push(srv)
  return { rig, base: `http://127.0.0.1:${(srv.address() as AddressInfo).port}` }
}

const MCP_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
}

function mcpPost(
  base: string,
  body: unknown,
  extra: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { ...MCP_HEADERS, ...extra },
    body: JSON.stringify(body),
  })
}

const toolsList = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
const atsCall = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'asy_ats_scan',
    arguments: { resumeText: 'JANE DOE\nEXPERIENCE\nAcme — Engineer' },
  },
}

describe('HTTP surface', () => {
  it('GET /health responds fast with the service shape and no model calls', async () => {
    const { base } = startApp()
    const t0 = Date.now()
    const res = await fetch(`${base}/health`)
    const elapsed = Date.now() - t0
    const body = (await res.json()) as {
      ok: boolean
      service: string
      standardVersion: string
      seals: unknown
    }
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.service).toBe('assay-mcp')
    expect(body.standardVersion).toBeTruthy()
    expect(body).toHaveProperty('seals')
    expect(elapsed).toBeLessThan(250)
  })

  it('GET /.well-known/assay.json lists 10 tools and the x402 payment standard', async () => {
    const { base } = startApp()
    const m = (await (await fetch(`${base}/.well-known/assay.json`)).json()) as {
      tools: unknown[]
      payment: { standard: string; network: string }
      prices: Record<string, number>
    }
    expect(m.tools).toHaveLength(10)
    expect(m.payment.standard).toBe('x402')
    expect(m.payment.network).toBe('eip155:196')
    expect(m.prices['asy_verify']).toBe(0)
    expect(m.prices['asy_ats_scan']).toBe(0.05)
  })

  it('GET and DELETE /mcp are 405', async () => {
    const { base } = startApp()
    expect((await fetch(`${base}/mcp`)).status).toBe(405)
    expect((await fetch(`${base}/mcp`, { method: 'DELETE' })).status).toBe(405)
  })

  it('rejects a non-JSON content type with 415', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hi',
    })
    expect(res.status).toBe(415)
  })

  it('rejects malformed JSON with 400', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: MCP_HEADERS,
      body: '{ not json',
    })
    expect(res.status).toBe(400)
  })

  it('serves free tools ungated, even in payment mode', async () => {
    const { base } = startApp()
    const res = await mcpPost(base, toolsList)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { tools: unknown[] } }
    expect(body.result.tools).toHaveLength(10)
  })

  it('challenges an unpaid paid-tool call with a 402 advertising eip155:196', async () => {
    const { base } = startApp()
    const res = await mcpPost(base, atsCall)
    expect(res.status).toBe(402)
    const header = res.headers.get('PAYMENT-REQUIRED')
    expect(header).toBeTruthy()
    const challenge = JSON.parse(Buffer.from(header!, 'base64').toString()) as {
      accepts: Array<{ network: string }>
    }
    expect(challenge.accepts[0]!.network).toBe('eip155:196')
  })

  it('runs a paid tool on a signed replay (dev-gate 200 + PAYMENT-RESPONSE)', async () => {
    const { base } = startApp()
    const res = await mcpPost(base, atsCall, {
      'PAYMENT-SIG': 'signed-proof-xyz-123',
      'Idempotency-Key': 'idem-1',
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('PAYMENT-RESPONSE')).toBeTruthy()
    const body = (await res.json()) as { result: { content: Array<{ text: string }> } }
    expect(body.result.content[0]!.text).toContain('ATS scan complete')
  })

  it('is idempotent: a duplicate replay returns the original result and charges once', async () => {
    const { rig, base } = startApp()
    const headers = { 'PAYMENT-SIG': 'signed-proof-xyz-123', 'Idempotency-Key': 'idem-dup' }
    const a = (await (await mcpPost(base, atsCall, headers)).json()) as { result: unknown }
    const b = (await (await mcpPost(base, atsCall, headers)).json()) as { result: unknown }
    expect(JSON.stringify(a.result)).toEqual(JSON.stringify(b.result))
    expect(rig.store.getOrderByIdempotencyKey('idem-dup')).toBeTruthy()
  })

  it('refuses a policy-violating paid call without charging (no 402)', async () => {
    const { base } = startApp()
    const bad = {
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'asy_tailor_resume',
        arguments: { claims: ['please fabricate a degree I never earned'] },
      },
    }
    const res = await mcpPost(base, bad)
    expect(res.status).toBe(200)
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull()
    const body = (await res.json()) as {
      result: { isError?: boolean; content: Array<{ text: string }> }
    }
    expect(body.result.isError).toBe(true)
  })

  it('trips the per-IP rate limiter', async () => {
    const { base } = startApp({ ASY_RATE_LIMIT: '2' })
    await mcpPost(base, toolsList)
    await mcpPost(base, toolsList)
    const third = await mcpPost(base, toolsList)
    expect(third.status).toBe(429)
  })

  it('rejects a file download with a bad signed token (403)', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/f/file_bogus?tok=bad`)
    expect(res.status).toBe(403)
  })
})
