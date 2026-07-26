import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { Dossier } from '@xyndicate/assay-core'
import { canonicalize, policyGate } from '@xyndicate/assay-core'
import type { ModelRouter, Fetcher } from '@xyndicate/providers'
import type { ServerConfig } from './config'
import { A2MCP_ROUTE_TARGETS, isPaid, priceOf, TOOL_NAMES, PRICES } from './config'
import type { Store } from './store'
import type { PaymentGate } from './gate'
import { readPaymentSig } from './gate'
import { buildServer, executeTool } from './server'
import { buildStudioRouter } from './studioHttp'
import { devPdf } from './jobs'
import { TokenBucket, verifyFileToken, sha256Hex, toJson, freeDiskBytes } from './util'

export interface AppRuntime {
  store: Store
  router: ModelRouter
  fetcher: Fetcher
  cfg: ServerConfig
  gate: PaymentGate
  // The Studio's inline steps (brief/seal) render + hash; forge runs in a job. toPdf is the
  // headless-chromium renderer in prod, the dev stub in fake/CI. Optional so tests can omit it.
  toPdf?: (html: string) => Promise<Uint8Array>
  realPdf?: boolean
  diskFreeBytes?: () => number
}

interface JsonRpcBody {
  jsonrpc?: string
  id?: unknown
  method?: string
  params?: { name?: string; arguments?: Record<string, unknown> }
}

const clientIp = (req: Request): string =>
  (req.headers['x-forwarded-for']?.toString().split(',')[0] ?? req.ip ?? 'unknown').trim()

function argsText(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  return Object.values(args)
    .map((v) =>
      typeof v === 'string'
        ? v
        : Array.isArray(v)
          ? v.filter((x) => typeof x === 'string').join('\n')
          : '',
    )
    .join('\n')
}

function jsonRpcResult(
  id: unknown,
  result: unknown,
): { jsonrpc: '2.0'; id: unknown; result: unknown } {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

function paidRequestHash(
  surface: 'mcp' | 'x402',
  tool: string,
  args: Record<string, unknown> | undefined,
): string {
  return sha256Hex(canonicalize({ surface, tool, arguments: args ?? {} }))
}

function idempotencyConflict(res: Response, message: string): void {
  res.status(409).json({
    error: 'idempotency_conflict',
    message,
  })
}

function restoreSettlement(res: Response, settlement: string | null): void {
  if (!settlement) return
  for (const [key, value] of Object.entries(JSON.parse(settlement) as Record<string, string>))
    res.setHeader(key, value)
}

export function buildApp(rt: AppRuntime): Express {
  const { store, cfg, gate } = rt
  const app = express()
  app.disable('x-powered-by')
  const bucket = new TokenBucket(cfg.rateLimitPerMin)

  // ── The Studio surface (P9): capability-URL dossier flow + recruiter portal. ──
  app.use(
    buildStudioRouter({
      store,
      router: rt.router,
      fetcher: rt.fetcher,
      cfg,
      toPdf: rt.toPdf ?? devPdf,
      realPdf: rt.realPdf ?? false,
      diskFreeBytes: rt.diskFreeBytes ?? (() => freeDiskBytes(cfg.filesDir)),
    }),
  )

  // ── GET /health — zero model calls, <100ms. Surfaces the anchor-queue age as an alert. ──
  app.get('/health', (_req: Request, res: Response) => {
    const oldest = store.oldestSealAgeMs()
    const alert = oldest >= cfg.anchorAlertMs
    const freeBytes = (rt.diskFreeBytes ?? (() => freeDiskBytes(cfg.filesDir)))()
    res.json({
      ok: true,
      service: cfg.service,
      version: cfg.version,
      standardVersion: cfg.standardVersion,
      paymentMode: cfg.paymentMode,
      seals: { pending: store.pendingSealCount(), oldestAgeMs: oldest, alert },
      storage: {
        acceptingUploads: freeBytes >= cfg.minFreeDiskBytes,
        freeBytes,
        minimumFreeBytes: cfg.minFreeDiskBytes,
      },
    })
  })

  // ── GET /.well-known/assay.json — the machine manifest agents read before calling. ──
  app.get('/.well-known/assay.json', (_req: Request, res: Response) => {
    res.json({
      name: 'Assay',
      tagline: 'Proof before polish.',
      standardVersion: cfg.standardVersion,
      transport: 'streamable-http',
      endpoint: `${cfg.baseUrl}/mcp`,
      payment: {
        standard: 'x402',
        network: cfg.network,
        asset: cfg.asset,
        payTo: cfg.payTo,
        ...(cfg.paymentMode === 'okx' ? {} : { mode: 'dev' }),
      },
      prices: PRICES,
      tools: TOOL_NAMES.map((t) => ({ name: t, priceUsdt: priceOf(t), free: !isPaid(t) })),
      marketplaceResources: Object.entries(A2MCP_ROUTE_TARGETS).map(([slug, target]) => ({
        slug,
        tool: target.tool,
        endpoint: `${cfg.baseUrl}/x402/${slug}`,
        priceUsdt: priceOf(target.tool),
        free: !isPaid(target.tool),
        ...(target.defaults ? { defaults: target.defaults } : {}),
      })),
      seal: {
        registry: cfg.registry,
        chainId: cfg.chainId,
        ...(cfg.agentId ? { agentId: cfg.agentId } : {}),
      },
      standardUrl: `${cfg.baseUrl}/standard`,
    })
  })

  // ── GET /f/:id — HMAC signed file downloads (24h tokens). ──
  app.get('/f/:id', (req: Request, res: Response) => {
    const id = String(req.params.id)
    const tok = typeof req.query['tok'] === 'string' ? req.query['tok'] : ''
    if (!tok || !verifyFileToken(cfg.signingSecret, id, tok))
      return void res.status(403).json({ error: 'invalid or expired token' })
    const meta = store.getFileMeta(id)
    const bytes = meta ? store.readFileBytes(id) : undefined
    if (!meta || !bytes) return void res.status(404).json({ error: 'not found' })
    res.setHeader('Content-Type', meta.mime)
    res.setHeader('Content-Disposition', `inline; filename="${meta.name}.${meta.ext}"`)
    return void res.send(bytes)
  })

  // ── GET /p/:slug — public portfolio share page. ──
  app.get('/p/:slug', (req: Request, res: Response) => {
    const share = store.getShare(String(req.params.slug))
    const bytes = share?.fileId ? store.readFileBytes(share.fileId) : undefined
    if (!share || !bytes) return void res.status(404).send('Not found')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return void res.send(bytes)
  })

  // ── GET /d-api — anonymized recent seals (the landing page's live strip). No PII: a truncated
  // dossier id, seal status, standard version, and a coarse timestamp only. ──
  app.get('/d-api', (_req: Request, res: Response) => {
    const rows = store.listRecentSealed(8).map((r) => ({
      ref: `${r.id.slice(0, 4)}…${r.id.slice(-3)}`,
      sealStatus: r.sealStatus,
      standardVersion: cfg.standardVersion,
      day: r.createdAt.slice(0, 10),
    }))
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.json({ recent: rows })
  })

  // ── GET /d-api/:id — public, PII-sanitized dossier JSON (guardrail #3/#9). ──
  app.get('/d-api/:id', (req: Request, res: Response) => {
    const d = store.getDossier(String(req.params.id)) as Dossier | undefined
    if (!d) return void res.status(404).json({ error: 'not found' })
    return void res.json({
      id: d.id,
      standardVersion: cfg.standardVersion,
      createdAt: d.createdAt,
      artifacts: d.artifacts.map((a) => ({ id: a.id, kind: a.kind })),
      claims: d.claims.map((c) => ({ id: c.id, strength: c.strength, status: c.status })),
      tribunal: d.tribunalReports.map((r) => ({ artifactId: r.artifactId, passed: r.passed })),
      seal: d.seal
        ? {
            commitment: d.seal.commitment,
            chainId: d.seal.chainId,
            standardVersion: d.seal.standardVersion,
            status: store.getSealStatus(d.id) ?? 'unsealed',
          }
        : null,
    })
  })

  // ── /mcp — stateless MCP transport. Discovery/negotiation is always free; the x402 boundary
  // is reached only by a JSON-RPC tools/call targeting a paid tool. This ordering matters:
  // initialize and tools/list must complete before a buyer can select a tool to purchase.
  app.get('/mcp', (_req: Request, res: Response) => void res.json(discoveryResult(cfg)))
  app.delete(
    '/mcp',
    (_req: Request, res: Response) => void res.status(405).json({ error: 'method not allowed' }),
  )

  app.post(
    '/mcp',
    express.json({ limit: cfg.maxBodyBytes }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!bucket.take(clientIp(req)))
          return void res.status(429).json({ error: 'rate limit exceeded (60/min)' })
        if (!req.is('application/json')) {
          return void res
            .status(415)
            .json({ error: 'unsupported media type; send application/json' })
        }
        const body = req.body as JsonRpcBody
        if (!body || typeof body !== 'object' || Array.isArray(body))
          return void res.status(400).json({ error: 'malformed JSON-RPC body' })

        const isToolCall = body.method === 'tools/call'
        const tool = isToolCall ? (body.params?.name ?? '') : ''
        const args = body.params?.arguments
        const carriesUpload =
          !!args &&
          ['resumeB64', 'resumeText', 'contentB64', 'textB64'].some(
            (key) => typeof args[key] === 'string' && args[key].length > 0,
          )
        if (
          carriesUpload &&
          (rt.diskFreeBytes ?? (() => freeDiskBytes(cfg.filesDir)))() < cfg.minFreeDiskBytes
        ) {
          return void res.status(507).json(
            jsonRpcResult(body.id, {
              content: [
                {
                  type: 'text',
                  text: 'Storage capacity is low — new uploads are paused; existing work is safe.',
                },
              ],
              isError: true,
            }),
          )
        }

        // Charge only at the tool/call stage. initialize, tools/list, notifications and transport
        // negotiation are free; paid tools keep their own prices and the three explicit free tools
        // remain free forever.
        if (isToolCall && isPaid(tool)) {
          // PolicyGate BEFORE any payment semantics (guardrail #6): refuse politely, never charge.
          const policy = policyGate({ text: argsText(body.params?.arguments) })
          if (!policy.allowed) {
            return void res.json(
              jsonRpcResult(body.id, {
                content: [{ type: 'text', text: policy.reason }],
                isError: true,
              }),
            )
          }

          const billableTool = tool
          const price = priceOf(tool)
          const requestHash = paidRequestHash('mcp', billableTool, args)
          const explicitIdem = req.header('Idempotency-Key')?.slice(0, 80)
          const paymentSig = readPaymentSig(req)

          // Response recovery is checked before demanding a fresh credential. The key is bound to
          // the tool + canonical arguments, so it cannot be used to retrieve a different purchase.
          if (explicitIdem) {
            const recovered = store.getOrderByIdempotencyKey(explicitIdem)
            if (recovered) {
              if (
                recovered.tool !== billableTool ||
                (recovered.requestHash !== null && recovered.requestHash !== requestHash)
              )
                return void idempotencyConflict(
                  res,
                  'That Idempotency-Key is already bound to a different paid request.',
                )
              restoreSettlement(res, recovered.settlement)
              if (recovered.result)
                return void res.json(jsonRpcResult(body.id, JSON.parse(recovered.result)))
              if (!paymentSig)
                return void res.status(409).json({
                  error: 'paid_request_incomplete',
                  message:
                    'Payment settled but the result is not cached yet; retry with the original payment proof.',
                })
            }
          }

          if (!paymentSig) {
            const decision = await gate.check(req, { tool: billableTool, priceUsdt: price })
            if (decision.kind === 'challenge') {
              for (const [k, v] of Object.entries(decision.headers)) res.setHeader(k, v)
              return void res.status(402).json(decision.body)
            }
            // A paid tool with no signature that didn't produce a challenge is a gate error.
            return void res.status(402).json({ error: 'payment required' })
          }

          const idemKey = (explicitIdem ?? sha256Hex(paymentSig)).slice(0, 80)
          const existing = store.getOrderByIdempotencyKey(idemKey)
          if (existing) {
            if (
              existing.tool !== billableTool ||
              (existing.requestHash !== null && existing.requestHash !== requestHash)
            )
              return void idempotencyConflict(
                res,
                'That Idempotency-Key is already bound to a different paid request.',
              )
            // Already paid — never charge twice.
            restoreSettlement(res, existing.settlement)
            if (existing.result)
              return void res.json(jsonRpcResult(body.id, JSON.parse(existing.result)))
            // Paid but never completed (crash) — re-run without re-charging.
            return void (await handleMcp(rt, req, res, body, (mcp) =>
              store.attachOrderResult(idemKey, toJson(mcp)),
            ))
          }

          const decision = await gate.check(req, { tool: billableTool, priceUsdt: price })
          if (decision.kind === 'challenge') {
            for (const [k, v] of Object.entries(decision.headers)) res.setHeader(k, v)
            return void res.status(402).json(decision.body)
          }
          if (decision.kind === 'error') {
            for (const [k, v] of Object.entries(decision.headers)) res.setHeader(k, v)
            return void res.status(decision.status).json(decision.body)
          }
          // settled → record the order, attach settlement proof, run the tool, cache the result.
          store.createOrder({
            tool: billableTool,
            priceUsdt: price,
            idempotencyKey: idemKey,
            requestHash,
            status: 'settled',
            settlement: JSON.stringify(decision.settlement),
            ...(decision.payerRef ? { payerRef: decision.payerRef } : {}),
          })
          for (const [k, v] of Object.entries(decision.settlement)) res.setHeader(k, v)
          return void (await handleMcp(rt, req, res, body, (mcp) =>
            store.attachOrderResult(idemKey, toJson(mcp)),
          ))
        }

        // Free path.
        return void (await handleMcp(rt, req, res, body))
      } catch (e) {
        next(e)
      }
    },
  )

  // Validator-friendly A2MCP resources. MCP discovery stays free at /mcp; each marketplace
  // service can point at its own concrete route, where a direct unpaid probe receives the standard
  // 402 immediately. Free tools return their result directly.
  const directTool = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!bucket.take(clientIp(req)))
        return void res.status(429).json({ error: 'rate limit exceeded (60/min)' })
      const slug = String(req.params['tool'] ?? '')
      const target = A2MCP_ROUTE_TARGETS[slug]
      if (!target) return void res.status(404).json({ error: 'unknown Assay service' })
      const tool = target.tool

      const raw =
        req.method === 'GET'
          ? req.query
          : ((req.body as { arguments?: unknown; params?: { arguments?: unknown } } | undefined)
              ?.arguments ??
            (req.body as { params?: { arguments?: unknown } } | undefined)?.params?.arguments ??
            req.body)
      const suppliedArgs =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {}
      const args = { ...suppliedArgs, ...(target.defaults ?? {}) }
      const policy = policyGate({ text: argsText(args) })
      if (!policy.allowed) return void res.status(422).json({ ok: false, error: policy.reason })

      if (!isPaid(tool)) {
        const result = await executeTool(
          { store: rt.store, router: rt.router, fetcher: rt.fetcher, cfg: rt.cfg },
          tool,
          args,
        )
        return void res.json(result)
      }

      const price = priceOf(tool)
      const resourcePath = `/x402/${slug}`
      const requestHash = paidRequestHash('x402', tool, args)
      const explicitIdem = req.header('Idempotency-Key')?.slice(0, 80)
      const paymentSig = readPaymentSig(req)

      if (explicitIdem) {
        const recovered = store.getOrderByIdempotencyKey(explicitIdem)
        if (recovered) {
          if (
            recovered.tool !== tool ||
            (recovered.requestHash !== null && recovered.requestHash !== requestHash)
          )
            return void idempotencyConflict(
              res,
              'That Idempotency-Key is already bound to a different paid request.',
            )
          restoreSettlement(res, recovered.settlement)
          if (recovered.result) return void res.json(JSON.parse(recovered.result))
          if (!paymentSig)
            return void res.status(409).json({
              error: 'paid_request_incomplete',
              message:
                'Payment settled but the result is not cached yet; retry with the original payment proof.',
            })
        }
      }

      if (!paymentSig) {
        const decision = await gate.check(req, { tool, priceUsdt: price, resourcePath })
        if (decision.kind === 'challenge') {
          for (const [key, value] of Object.entries(decision.headers)) res.setHeader(key, value)
          return void res.status(402).json(decision.body)
        }
        return void res.status(402).json({ error: 'payment required' })
      }

      const idemKey = (explicitIdem ?? sha256Hex(paymentSig)).slice(0, 80)
      const existing = store.getOrderByIdempotencyKey(idemKey)
      if (existing) {
        if (
          existing.tool !== tool ||
          (existing.requestHash !== null && existing.requestHash !== requestHash)
        )
          return void idempotencyConflict(
            res,
            'That Idempotency-Key is already bound to a different paid request.',
          )
        restoreSettlement(res, existing.settlement)
        if (existing.result) return void res.json(JSON.parse(existing.result))
      } else {
        const decision = await gate.check(req, { tool, priceUsdt: price, resourcePath })
        if (decision.kind === 'challenge') {
          for (const [key, value] of Object.entries(decision.headers)) res.setHeader(key, value)
          return void res.status(402).json(decision.body)
        }
        if (decision.kind === 'error') {
          for (const [key, value] of Object.entries(decision.headers)) res.setHeader(key, value)
          return void res.status(decision.status).json(decision.body)
        }
        store.createOrder({
          tool,
          priceUsdt: price,
          idempotencyKey: idemKey,
          requestHash,
          status: 'settled',
          settlement: JSON.stringify(decision.settlement),
          ...(decision.payerRef ? { payerRef: decision.payerRef } : {}),
        })
        for (const [key, value] of Object.entries(decision.settlement)) res.setHeader(key, value)
      }

      const result = await executeTool(
        { store: rt.store, router: rt.router, fetcher: rt.fetcher, cfg: rt.cfg },
        tool,
        args,
      )
      store.attachOrderResult(idemKey, toJson(result))
      return void res.json(result)
    } catch (error) {
      next(error)
    }
  }
  app.get('/x402/:tool', directTool)
  app.post('/x402/:tool', express.json({ limit: cfg.maxBodyBytes }), directTool)

  // ── Error mapping: malformed → 400, oversize → 413, everything else sanitized 5xx. ──
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return
    const e = err as { type?: string; status?: number; statusCode?: number; message?: string }
    if (e?.type === 'entity.too.large' || e?.status === 413)
      return void res.status(413).json({ error: 'payload too large' })
    if (e?.type === 'entity.parse.failed' || e?.status === 400 || err instanceof SyntaxError)
      return void res.status(400).json({ error: 'malformed JSON' })
    if ((e as { code?: string }).code === 'SQLITE_BUSY') {
      res.setHeader('Retry-After', '2')
      return void res.status(503).json({ error: 'storage busy — retry shortly' })
    }
    // Sanitized gap only (guardrail #9) — raw error to server logs.
    console.error('[assay] unhandled:', e?.message ?? err)
    res.status(502).json({ error: 'provider:unavailable — request could not be completed' })
  })

  return app
}

// Fresh McpServer + stateless transport per request (gotcha #1); torn down on response close.
async function handleMcp(
  rt: AppRuntime,
  req: Request,
  res: Response,
  body: unknown,
  capture?: (mcpResult: unknown) => void,
): Promise<void> {
  // The SDK's transport accepts JSON responses but still validates the dual Accept header. Assay
  // always uses plain JSON, so normalize marketplace probes that correctly omit the SSE media type.
  const accept = 'application/json, text/event-stream'
  req.headers.accept = accept
  let foundAccept = false
  for (let index = 0; index < req.rawHeaders.length; index += 2) {
    if (req.rawHeaders[index]?.toLowerCase() === 'accept') {
      req.rawHeaders[index + 1] = accept
      foundAccept = true
    }
  }
  if (!foundAccept) req.rawHeaders.push('Accept', accept)
  const server = buildServer({
    pipe: { store: rt.store, router: rt.router, fetcher: rt.fetcher, cfg: rt.cfg },
    ...(capture ? { capture } : {}),
  })
  // Omit sessionIdGenerator → stateless mode (gotcha #1). enableJsonResponse → plain JSON, not SSE.
  const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true })
  res.on('close', () => {
    void transport.close()
    void server.close()
  })
  // Cast past an exactOptionalPropertyTypes friction between the SDK's transport class and its
  // Transport interface (onclose is a present-but-undefinable property on the class).
  await server.connect(transport as unknown as Transport)
  await transport.handleRequest(req, res, body)
}

function discoveryResult(cfg: ServerConfig): Record<string, unknown> {
  return {
    ok: true,
    service: 'Assay',
    endpoint: `${cfg.baseUrl}/mcp`,
    transport: 'streamable-http',
    next: 'POST MCP JSON-RPC to this endpoint',
  }
}
