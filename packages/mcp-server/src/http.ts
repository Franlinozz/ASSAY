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
import {
  normalizeArgs,
  preflight,
  resolveServiceSlug,
  resolveToolName,
  serviceSchema,
  SERVICE_SLUGS,
  type IntakeProblem,
} from './intake'
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

// The machine-readable half of an intake rejection: what was missing, what satisfies it, and a
// payload that works. Always accompanied by the plain-language message.
function intakeBody(tool: string, problem: IntakeProblem): Record<string, unknown> {
  return {
    ok: false,
    error: 'invalid_request',
    code: problem.code,
    tool,
    message: problem.message,
    provideAnyOf: problem.accepts,
    example: problem.example,
    charged: false,
    note: 'No payment was taken — this request was rejected before the x402 gate.',
  }
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

  // ── Capability access log. The marketplace review turned on questions nobody could answer from
  // this box — which tool a buyer called, what shape the answer was, how long it took — because
  // nothing recorded a request. This records exactly that and nothing more: no bodies, no résumé
  // text, no headers, no payment proofs, no IPs (guardrails #3/#9 — never personal data). It is the
  // difference between diagnosing a failed review in minutes and guessing.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/x402') && req.path !== '/mcp') return next()
    const started = Date.now()
    res.on('finish', () => {
      const body = req.body as JsonRpcBody | undefined
      const tool =
        req.path === '/mcp'
          ? ((body?.method === 'tools/call' ? body.params?.name : body?.method) ?? 'unknown')
          : String(req.params['tool'] ?? req.path.split('/')[2] ?? 'unknown')
      try {
        store.recordEvent('capability_call', {
          surface: req.path === '/mcp' ? 'mcp' : 'x402',
          tool,
          method: req.method,
          status: res.statusCode,
          paid: !!readPaymentSig(req),
          ms: Date.now() - started,
        })
      } catch {
        // Observability must never break a paid call.
      }
    })
    next()
  })

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
        // Intake tolerance (guardrail: a marketplace caller that guesses a synonym still gets the
        // service it paid for). The canonical name + arguments are written back onto the body, so
        // the MCP SDK, the price lookup, and the idempotency hash all see one canonical request.
        if (isToolCall && body.params) {
          const resolved = resolveToolName(body.params.name)
          if (resolved) {
            body.params.name = resolved
            body.params.arguments = normalizeArgs(resolved, body.params.arguments)
          }
        }
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

        // PREFLIGHT BEFORE SETTLEMENT. A request that cannot produce the advertised capability is
        // answered with the exact payload to send, and is never charged for. Order matters twice
        // over: an UNPAID probe must still receive the standard 402 (validators depend on it), so
        // this only pre-empts a call that is actually presenting payment — or a free tool, where
        // there is no challenge to preserve.
        const known = isToolCall && TOOL_NAMES.includes(tool as (typeof TOOL_NAMES)[number])
        if (known && (!isPaid(tool) || readPaymentSig(req))) {
          const check = preflight(tool, args ?? {})
          if (!check.ok) {
            return void res.json(
              jsonRpcResult(body.id, {
                content: [
                  { type: 'text', text: `${check.message}\n\n${toJson(intakeBody(tool, check))}` },
                ],
                isError: true,
              }),
            )
          }
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
      const slug = resolveServiceSlug(req.params['tool'])
      const target = slug ? A2MCP_ROUTE_TARGETS[slug] : undefined
      if (!slug || !target)
        return void res.status(404).json({
          error: 'unknown Assay service',
          service: String(req.params['tool'] ?? ''),
          services: SERVICE_SLUGS,
          discovery: `${cfg.baseUrl}/.well-known/assay.json`,
        })
      const tool = target.tool

      const raw =
        req.method === 'GET'
          ? req.query
          : ((req.body as { arguments?: unknown; params?: { arguments?: unknown } } | undefined)
              ?.arguments ??
            (req.body as { params?: { arguments?: unknown } } | undefined)?.params?.arguments ??
            req.body)
      // Tolerant intake: synonyms map onto the published schema before anything else looks at the
      // arguments, so the price, the policy gate and the pipeline all see one canonical request.
      const args = { ...normalizeArgs(tool, raw), ...(target.defaults ?? {}) }
      const policy = policyGate({ text: argsText(args) })
      if (!policy.allowed) return void res.status(422).json({ ok: false, error: policy.reason })

      // Preflight before settlement — an under-specified request costs nothing and is told exactly
      // what to send. An UNPAID probe of a paid service still falls through to the standard 402
      // below (marketplace validators check for it); only a caller presenting payment, or a free
      // tool, is short-circuited here.
      if (!isPaid(tool) || readPaymentSig(req)) {
        const check = preflight(tool, args)
        if (!check.ok)
          return void res.status(400).json({
            ...intakeBody(tool, check),
            service: slug,
            schema: `${cfg.baseUrl}/x402/${slug}/schema`,
          })
      }
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

      let result
      try {
        result = await executeTool(
          { store: rt.store, router: rt.router, fetcher: rt.fetcher, cfg: rt.cfg },
          tool,
          args,
        )
      } catch {
        // Settled but the run failed. The result is deliberately NOT cached, so replaying the same
        // payment proof re-runs the work for free rather than leaving the buyer with nothing.
        return void res.status(502).json({
          ok: false,
          error: 'execution_failed',
          tool,
          message:
            'Payment settled but the run did not complete. Retry this request with the same payment proof (or Idempotency-Key) — it will not be charged again.',
          idempotencyKey: idemKey,
        })
      }
      store.attachOrderResult(idemKey, toJson(result))
      return void res.json(result)
    } catch (error) {
      next(error)
    }
  }
  // Free input contract for every marketplace service: a buyer can learn the exact payload before
  // spending anything. Registered ahead of the paid routes so it is never swallowed by them.
  app.get('/x402/:tool/schema', (req: Request, res: Response) => {
    const slug = resolveServiceSlug(req.params['tool'])
    const schema = slug ? serviceSchema(slug, cfg.baseUrl) : undefined
    if (!schema)
      return void res.status(404).json({ error: 'unknown Assay service', services: SERVICE_SLUGS })
    return void res.json(schema)
  })
  app.get('/x402', (_req: Request, res: Response) => {
    res.json({
      services: SERVICE_SLUGS.map((slug) => serviceSchema(slug, cfg.baseUrl)).filter(Boolean),
    })
  })
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
