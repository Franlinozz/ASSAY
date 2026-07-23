import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { Dossier } from '@xyndicate/assay-core'
import { policyGate } from '@xyndicate/assay-core'
import type { ModelRouter, Fetcher } from '@xyndicate/providers'
import type { ServerConfig } from './config'
import { isPaid, priceOf, TOOL_NAMES, PRICES } from './config'
import type { Store } from './store'
import type { PaymentGate } from './gate'
import { readPaymentSig } from './gate'
import { buildServer } from './server'
import { TokenBucket, verifyFileToken, sha256Hex, toJson } from './util'

export interface AppRuntime {
  store: Store
  router: ModelRouter
  fetcher: Fetcher
  cfg: ServerConfig
  gate: PaymentGate
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

export function buildApp(rt: AppRuntime): Express {
  const { store, cfg, gate } = rt
  const app = express()
  app.disable('x-powered-by')
  const bucket = new TokenBucket(cfg.rateLimitPerMin)

  // ── GET /health — zero model calls, <100ms. Surfaces the anchor-queue age as an alert. ──
  app.get('/health', (_req: Request, res: Response) => {
    const oldest = store.oldestSealAgeMs()
    const alert = oldest > 2 * cfg.anchorIntervalMs
    res.json({
      ok: true,
      service: cfg.service,
      version: cfg.version,
      standardVersion: cfg.standardVersion,
      paymentMode: cfg.paymentMode,
      seals: { pending: store.pendingSealCount(), oldestAgeMs: oldest, alert },
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

  // ── /mcp — the stateless paywall + MCP endpoint. ──
  app.get(
    '/mcp',
    (_req: Request, res: Response) =>
      void res.status(405).json({ error: 'method not allowed; POST JSON-RPC to /mcp' }),
  )
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
        if (!req.is('application/json'))
          return void res
            .status(415)
            .json({ error: 'unsupported media type; send application/json' })
        const body = req.body as JsonRpcBody
        if (!body || typeof body !== 'object' || Array.isArray(body))
          return void res.status(400).json({ error: 'malformed JSON-RPC body' })

        const isToolCall = body.method === 'tools/call'
        const tool = isToolCall ? (body.params?.name ?? '') : ''

        // Only paid tool calls hit the paywall. Everything else — initialize, tools/list, free tools —
        // flows straight to MCP (free forever per the price table).
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

          const price = priceOf(tool)
          const paymentSig = readPaymentSig(req)

          if (!paymentSig) {
            const decision = await gate.check(req, { tool, priceUsdt: price })
            if (decision.kind === 'challenge') {
              for (const [k, v] of Object.entries(decision.headers)) res.setHeader(k, v)
              return void res.status(402).json(decision.body)
            }
            // A paid tool with no signature that didn't produce a challenge is a gate error.
            return void res.status(402).json({ error: 'payment required' })
          }

          const idemKey = (req.header('Idempotency-Key') ?? sha256Hex(paymentSig)).slice(0, 80)
          const existing = store.getOrderByIdempotencyKey(idemKey)
          if (existing) {
            // Already paid — never charge twice.
            if (existing.settlement)
              for (const [k, v] of Object.entries(
                JSON.parse(existing.settlement) as Record<string, string>,
              ))
                res.setHeader(k, v)
            if (existing.result)
              return void res.json(jsonRpcResult(body.id, JSON.parse(existing.result)))
            // Paid but never completed (crash) — re-run without re-charging.
            return void (await handleMcp(rt, req, res, body, (mcp) =>
              store.attachOrderResult(idemKey, toJson(mcp)),
            ))
          }

          const decision = await gate.check(req, { tool, priceUsdt: price })
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
            tool,
            priceUsdt: price,
            idempotencyKey: idemKey,
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

  // ── Error mapping: malformed → 400, oversize → 413, everything else sanitized 5xx. ──
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return
    const e = err as { type?: string; status?: number; statusCode?: number; message?: string }
    if (e?.type === 'entity.too.large' || e?.status === 413)
      return void res.status(413).json({ error: 'payload too large' })
    if (e?.type === 'entity.parse.failed' || e?.status === 400 || err instanceof SyntaxError)
      return void res.status(400).json({ error: 'malformed JSON' })
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
