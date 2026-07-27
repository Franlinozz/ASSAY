import { describe, it, expect, afterEach } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { buildApp } from './http'
import { testRuntime, type TestRig } from './testutil'
import { TOOL_NAMES } from './config'

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
const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'listing-probe', version: '1' },
  },
}
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
    // The endpoint itself is synchronous and model-free; allow CI scheduler contention while the
    // full Vitest pool concurrently launches Chromium and Anvil.
    expect(elapsed).toBeLessThan(750)
  })

  it('GET /.well-known/assay.json lists every tool and the x402 payment standard', async () => {
    const { base } = startApp()
    const m = (await (await fetch(`${base}/.well-known/assay.json`)).json()) as {
      tools: unknown[]
      payment: { standard: string; network: string }
      prices: Record<string, number>
    }
    expect(m.tools).toHaveLength(TOOL_NAMES.length)
    expect(m.payment.standard).toBe('x402')
    expect(m.payment.network).toBe('eip155:196')
    expect(m.prices['asy_verify']).toBe(0)
    expect(m.prices['asy_ats_scan']).toBe(0.05)
  })

  it('GET /mcp is free discovery with no payment challenge; DELETE stays 405', async () => {
    const { base } = startApp()
    const get = await fetch(`${base}/mcp`)
    expect(get.status).toBe(200)
    expect(get.headers.get('PAYMENT-REQUIRED')).toBeNull()
    expect(await get.json()).toMatchObject({ ok: true, service: 'Assay' })
    expect((await fetch(`${base}/mcp`, { method: 'DELETE' })).status).toBe(405)
  })

  it('GET /mcp ignores payment headers and never creates an order', async () => {
    const { rig, base } = startApp()
    const headers = {
      'PAYMENT-SIG': 'signed-get-discovery',
      'Idempotency-Key': 'get-discovery',
    }
    const response = await fetch(`${base}/mcp`, { headers })
    expect(response.status).toBe(200)
    expect(response.headers.get('PAYMENT-RESPONSE')).toBeNull()
    expect(rig.store.getOrderByIdempotencyKey('get-discovery')).toBeUndefined()
  })

  it('rejects an unpaid bare POST without initiating a charge', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hi',
    })
    expect(res.status).toBe(415)
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull()
  })

  it('rejects a paid replay with a non-JSON content type', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'PAYMENT-SIG': 'signed-proof-abc123' },
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

  it('serves tools/list free without requiring an SSE Accept header', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toolsList),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull()
    const body = (await res.json()) as { result: { tools: unknown[] } }
    expect(body.result.tools).toHaveLength(TOOL_NAMES.length)
  })

  it('serves initialize free as JSON without an SSE Accept header', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(initialize),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull()
    expect(res.headers.get('PAYMENT-RESPONSE')).toBeNull()
    const body = (await res.json()) as { result: { serverInfo: { name: string } } }
    expect(body.result.serverInfo.name).toBe('assay')
  })

  it('serves the explicitly free job-status tool without a payment', async () => {
    const { base } = startApp()
    const res = await mcpPost(base, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'asy_job_status', arguments: { jobId: 'missing-job' } },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeNull()
  })

  it('challenges an unpaid paid-tool call with a 402 advertising eip155:196', async () => {
    const { base } = startApp()
    const res = await mcpPost(base, atsCall)
    expect(res.status).toBe(402)
    const header = res.headers.get('PAYMENT-REQUIRED')
    expect(header).toBeTruthy()
    const challenge = JSON.parse(Buffer.from(header!, 'base64').toString()) as {
      accepts: Array<{ network: string; amount: string }>
    }
    expect(challenge.accepts[0]!.network).toBe('eip155:196')
    expect(challenge.accepts[0]!.amount).toBe('50000')
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

  it('recovers a completed paid result with the same key and body but no payment proof', async () => {
    const { rig, base } = startApp()
    const paid = await mcpPost(base, atsCall, {
      'PAYMENT-SIG': 'signed-proof-recovery-123',
      'Idempotency-Key': 'idem-recovery',
    })
    expect(paid.status).toBe(200)
    const original = (await paid.json()) as { result: unknown }

    const recovered = await mcpPost(base, atsCall, { 'Idempotency-Key': 'idem-recovery' })
    expect(recovered.status).toBe(200)
    expect(recovered.headers.get('PAYMENT-REQUIRED')).toBeNull()
    expect((await recovered.json()) as { result: unknown }).toEqual(original)
    expect(rig.store.orderCount()).toBe(1)
  })

  it('rejects reusing an idempotency key with different arguments', async () => {
    const { base } = startApp()
    await mcpPost(base, atsCall, {
      'PAYMENT-SIG': 'signed-proof-conflict-123',
      'Idempotency-Key': 'idem-conflict',
    })
    const changed = {
      ...atsCall,
      params: {
        ...atsCall.params,
        arguments: { resumeText: 'A DIFFERENT RESUME\nEXPERIENCE\nOther role' },
      },
    }
    const conflict = await mcpPost(base, changed, { 'Idempotency-Key': 'idem-conflict' })
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toMatchObject({ error: 'idempotency_conflict' })
  })

  it('offers concrete per-service x402 routes while keeping free tools directly callable', async () => {
    const { base } = startApp()
    const paid = await fetch(`${base}/x402/asy_story_bank`)
    expect(paid.status).toBe(402)
    const challenge = JSON.parse(
      Buffer.from(paid.headers.get('PAYMENT-REQUIRED')!, 'base64').toString(),
    ) as { resource: { url: string }; accepts: Array<{ amount: string }> }
    expect(challenge.resource.url).toContain('/x402/asy_story_bank')
    expect(challenge.accepts[0]!.amount).toBe('200000')

    const promotion = await fetch(`${base}/x402/asy_promotion_dossier`)
    expect(promotion.status).toBe(402)
    const promotionChallenge = JSON.parse(
      Buffer.from(promotion.headers.get('PAYMENT-REQUIRED')!, 'base64').toString(),
    ) as { accepts: Array<{ amount: string }> }
    expect(promotionChallenge.accepts[0]!.amount).toBe('2000000')

    const free = await fetch(`${base}/x402/asy_job_status?jobId=missing-job`)
    expect(free.status).toBe(200)
    expect(free.headers.get('PAYMENT-REQUIRED')).toBeNull()
  })

  // ── Intake: the marketplace-review defences ──────────────────────────────
  // A buyer must never pay and receive a refusal, and a payload that guesses one key name wrong
  // must still get the advertised service.

  it('rejects an under-specified paid call before settling, and charges nothing', async () => {
    const { rig, base } = startApp()
    const res = await fetch(`${base}/x402/asy_ats_scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'PAYMENT-SIG': 'signed-proof-empty-args' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      code: string
      charged: boolean
      provideAnyOf: string[]
      example: Record<string, unknown>
    }
    expect(body.code).toBe('RESUME_REQUIRED')
    expect(body.charged).toBe(false)
    expect(body.provideAnyOf).toContain('resumeText')
    expect(body.example['resumeText']).toBeTruthy()
    expect(rig.store.orderCount()).toBe(0)
  })

  it('never charges a paid MCP tool call that cannot produce its capability', async () => {
    const { rig, base } = startApp()
    const res = await mcpPost(
      base,
      {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'asy_cover_letter', arguments: { query: 'write me a cover letter' } },
      },
      { 'PAYMENT-SIG': 'signed-proof-thin-air-123' },
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('PAYMENT-RESPONSE')).toBeNull()
    const body = (await res.json()) as { result: { isError: boolean; content: Array<{ text: string }> } }
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0]!.text).toContain('EVIDENCE_REQUIRED')
    expect(rig.store.orderCount()).toBe(0)
  })

  it('keeps the standard 402 for an unpaid probe even when arguments are missing', async () => {
    const { base } = startApp()
    const probe = await fetch(`${base}/x402/asy_ats_scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(probe.status).toBe(402)
    expect(probe.headers.get('PAYMENT-REQUIRED')).toBeTruthy()
  })

  it('serves the paid capability when the caller uses obvious synonyms', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/x402/ats-resume-scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'PAYMENT-SIG': 'signed-proof-alias-123' },
      body: JSON.stringify({
        resume: 'JANE DOE — jane@example.com\nEXPERIENCE\nAcme — Product Manager, shipped billing v2\nSKILLS\nSQL',
        jobDescription: 'Senior Product Manager — billing roadmap, 5+ years B2B SaaS',
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { summary: string; data: { ok: boolean } }
    expect(body.data.ok).toBe(true)
    expect(body.summary).toContain('ATS scan complete')
  })

  it('accepts the marketplace service name as an MCP tool name', async () => {
    const { base } = startApp()
    const res = await mcpPost(base, {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'Verify Seal', arguments: { dossierId: 'DSR-UNKNOWN' } },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { content: Array<{ text: string }> } }
    expect(body.result.content[0]!.text).not.toContain('not found')
  })

  it('publishes a free input contract per service', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/x402/Career%20Dossier/schema`)
    expect(res.status).toBe(200)
    const schema = (await res.json()) as {
      tool: string
      priceUsdt: number
      example: Record<string, unknown>
    }
    expect(schema.tool).toBe('asy_create_dossier_job')
    expect(schema.priceUsdt).toBe(2)
    expect(schema.example['resumeText']).toBeTruthy()

    const unknown = await fetch(`${base}/x402/not-a-service`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(unknown.status).toBe(404)
    expect((await unknown.json()) as { services: string[] }).toHaveProperty('services')
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

describe('GET /d-api — anonymized recent seals (P8 landing strip)', () => {
  it('returns truncated refs only, never full ids or PII', async () => {
    const { rig, base } = startApp()
    const dossier = {
      id: 'DSR-STRIPTEST01',
      profile: {
        fullName: 'Secret Name',
        contact: {},
        timezone: 'UTC',
        experiences: [],
        education: [],
        certifications: [],
        skills: [],
      },
      tz: 'UTC',
      evidence: [],
      claims: [],
      artifacts: [],
      tribunalReports: [],
      seal: {
        manifestHash: '0xabc',
        commitment: '0xdef',
        chainId: 196,
        standardVersion: 'AS-1.1.0',
      },
      createdAt: new Date().toISOString(),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rig.store.saveDossier(dossier as any, '0xsalt')
    const res = await fetch(`${base}/d-api`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      recent: Array<{ ref: string; sealStatus: string; day: string }>
    }
    expect(body.recent.length).toBe(1)
    expect(body.recent[0]!.ref).toBe('DSR-…T01')
    expect(body.recent[0]!.sealStatus).toBe('pending')
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('DSR-STRIPTEST01')
    expect(raw).not.toContain('Secret Name')
  })

  it('is empty, not an error, on a fresh store', async () => {
    const { base } = startApp()
    const res = await fetch(`${base}/d-api`)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { recent: unknown[] }).recent).toEqual([])
  })
})
