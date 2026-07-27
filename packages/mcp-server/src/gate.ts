import type { Request } from 'express'
import { OKXFacilitatorClient } from '@okxweb3/x402-core/facilitator'
import { x402ResourceServer } from '@okxweb3/x402-core/server'
import type { HTTPRequestContext, RoutesConfig } from '@okxweb3/x402-core/server'
import { x402HTTPResourceServer } from '@okxweb3/x402-core/server'
import { registerExactEvmScheme } from '@okxweb3/x402-evm/exact/server'
import { ExpressAdapter } from '@okxweb3/x402-express'
import type { ServerConfig } from './config'
import { A2MCP_ROUTE_TARGETS, isPaid, priceOf } from './config'
import { TOOL_SPECS } from './toolspec'
import { priceString, sha256Hex } from './util'

// PaymentGate — the x402 settlement boundary. It only ever sees PAID tools: http.ts runs the
// PolicyGate and the free-tool bypass BEFORE calling check() (guardrail #6, per-tool free forever).
//
// Wire shape implemented to the OKX seller-SDK docs re-fetched 2026-07-26 (AGENTS.md gotcha 8):
//   • first call (no PAYMENT-SIG)  → HTTP 402 + header PAYMENT-REQUIRED: base64(JSON challenge)
//                                     advertising { scheme:'exact', network:'eip155:196', asset:USDT }
//   • replay  (PAYMENT-SIG present)→ verify+settle → 200 + header PAYMENT-RESPONSE (settlement proof)
// http.ts invokes this gate only for JSON-RPC tools/call on a paid tool. MCP initialization and
// discovery never enter the SDK payment route.

export type GateDecision =
  | { kind: 'challenge'; status: 402; headers: Record<string, string>; body: unknown }
  | { kind: 'settled'; settlement: Record<string, string>; payerRef?: string }
  | { kind: 'error'; status: number; headers: Record<string, string>; body: unknown }

export interface GateOpts {
  tool: string
  priceUsdt: number
  resourcePath?: string
}

export interface PaymentGate {
  readonly mode: 'dev' | 'okx'
  check(req: Request, opts: GateOpts): Promise<GateDecision>
}

const PAYMENT_SIG_HEADER = 'payment-sig'
const XLAYER_USDT0 = '0x779ded0c9e1022225f8e0630b35a9b54be713736'

// The window a buyer's payment authorization stays valid, advertised in every challenge. Any
// in-band work (see config.inlineJobWaitMs) must finish inside it.
export const MAX_TIMEOUT_SECONDS = 300

// The challenge advertises the capability the buyer is about to pay for, not a house slogan — a
// generic description on a specific service reads as a mismatch to anyone auditing the listing.
export function resourceDescription(tool?: string): string {
  const spec = TOOL_SPECS.find((s) => s.name === tool)
  return spec
    ? `Assay — ${spec.title}: ${spec.marketplaceSummary}`
    : 'Assay evidence-backed career intelligence'
}

function readPaymentSig(req: Request): string | undefined {
  return (
    (req.header('PAYMENT-SIG') ??
      req.header('X-PAYMENT') ??
      req.header('PAYMENT-SIGNATURE') ??
      undefined) ||
    undefined
  )
}

function buildAccepts(cfg: ServerConfig, priceUsdt: number) {
  return [
    {
      scheme: 'exact',
      network: cfg.network,
      payTo: cfg.payTo,
      asset: cfg.asset === 'USDT' ? XLAYER_USDT0 : cfg.asset,
      amount: String(Math.round(priceUsdt * 1_000_000)),
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      extra: { name: 'USD₮0', version: '1' },
    },
  ]
}

// ── DevGate — the documented shape without a facilitator. Used in fake/dev mode, CI and the cheap
// smoke. It NEVER moves funds; it proves the paywall handshake end-to-end offline. ──
export class DevGate implements PaymentGate {
  readonly mode = 'dev' as const
  constructor(private readonly cfg: ServerConfig) {}

  check(req: Request, opts: GateOpts): Promise<GateDecision> {
    const sig = readPaymentSig(req)
    const accepts = buildAccepts(this.cfg, opts.priceUsdt)

    if (!sig) {
      const challenge = {
        x402Version: 2,
        error: 'Payment required',
        resource: {
          url: `${this.cfg.baseUrl}${opts.resourcePath ?? '/mcp'}`,
          description: resourceDescription(opts.tool),
          mimeType: 'application/json',
        },
        accepts,
      }
      return Promise.resolve({
        kind: 'challenge',
        status: 402,
        headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge)).toString('base64') },
        body: challenge,
      })
    }

    // Dev "verification": any non-trivial signed proof settles. Deterministic payer id from the sig.
    if (sig.length < 8) {
      return Promise.resolve({
        kind: 'error',
        status: 402,
        headers: {},
        body: { error: 'invalid PAYMENT-SIG' },
      })
    }
    const payerRef = `dev:${sha256Hex(sig).slice(0, 16)}`
    const settlement = {
      success: 'true',
      network: this.cfg.network,
      asset: this.cfg.asset,
      tool: opts.tool,
      amount: priceString(opts.priceUsdt),
      payer: payerRef,
      txHash: `devsettle:${sha256Hex(`${opts.tool}:${sig}`).slice(0, 32)}`,
      mode: 'dev',
    }
    return Promise.resolve({
      kind: 'settled',
      settlement: {
        'PAYMENT-RESPONSE': Buffer.from(JSON.stringify(settlement)).toString('base64'),
      },
      payerRef,
    })
  }
}

// ── OkxGate — the real settlement path via the OKX x402 seller SDK + Facilitator. Structurally
// wired to the installed @okxweb3/x402-* SDK; funds/settlement are verified LIVE in Phase 7 against
// the production facilitator (no facilitator is reachable in dev/CI). ──
export class OkxGate implements PaymentGate {
  readonly mode = 'okx' as const
  private readonly httpServer: x402HTTPResourceServer
  private ready: Promise<void> | undefined

  constructor(private readonly cfg: ServerConfig) {
    if (!cfg.okx)
      throw new Error('OkxGate requires ASY_OKX_API_KEY / SECRET / PASSPHRASE (payment mode okx)')
    const facilitator = new OKXFacilitatorClient({
      apiKey: cfg.okx.apiKey,
      secretKey: cfg.okx.secretKey,
      passphrase: cfg.okx.passphrase,
      ...(cfg.okx.baseUrl ? { baseUrl: cfg.okx.baseUrl } : {}),
      syncSettle: true,
    })
    const resourceServer = new x402ResourceServer(facilitator)
    registerExactEvmScheme(resourceServer, { networks: [cfg.network] })

    const routeFor = (resourcePath: string, boundTool?: string) => ({
      accepts: {
        scheme: 'exact',
        network: cfg.network,
        payTo: cfg.payTo,
        price: (context: HTTPRequestContext) => {
          const toolPrice = priceOf(boundTool ?? toolFromContext(context))
          return priceString(toolPrice > 0 ? toolPrice : priceOf('asy_ats_scan'))
        },
      },
      resource: `${cfg.baseUrl}${resourcePath}`,
      description: resourceDescription(boundTool),
      mimeType: 'application/json',
    })
    const routes: RoutesConfig = {
      'POST /mcp': routeFor('/mcp'),
    }
    for (const [slug, target] of Object.entries(A2MCP_ROUTE_TARGETS)) {
      if (!isPaid(target.tool)) continue
      const path = `/x402/${slug}`
      routes[`GET ${path}`] = routeFor(path, target.tool)
      routes[`POST ${path}`] = routeFor(path, target.tool)
    }
    this.httpServer = new x402HTTPResourceServer(resourceServer, routes)
  }

  private init(): Promise<void> {
    if (!this.ready) this.ready = this.httpServer.initialize()
    return this.ready
  }

  async check(req: Request, opts: GateOpts): Promise<GateDecision> {
    await this.init()
    const context: HTTPRequestContext = {
      adapter: new ExpressAdapter(req),
      path: opts.resourcePath ?? '/mcp',
      method: req.method,
    }
    const result = await this.httpServer.processHTTPRequest(context)

    if (result.type === 'no-payment-required') {
      return { kind: 'settled', settlement: {} }
    }
    if (result.type === 'payment-error') {
      const r = result.response
      return {
        kind: r.status === 402 ? 'challenge' : 'error',
        status: r.status as 402,
        headers: r.headers,
        body: r.body,
      }
    }
    // payment-verified → settle now (before we run the tool) so we can attach PAYMENT-RESPONSE.
    const settle = await this.httpServer.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
    )
    if (!settle.success) {
      return {
        kind: 'error',
        status: settle.response.status,
        headers: settle.response.headers,
        body: settle.response.body,
      }
    }
    return { kind: 'settled', settlement: settle.headers, payerRef: opts.tool }
  }
}

// Best-effort extraction of the MCP tool name from an already-parsed express body.
function toolFromContext(context: HTTPRequestContext): string {
  const body = context.adapter.getBody?.() as { params?: { name?: string } } | undefined
  return body?.params?.name ?? context.path.split('/').at(-1) ?? ''
}

export function createGate(cfg: ServerConfig): PaymentGate {
  return cfg.paymentMode === 'okx' ? new OkxGate(cfg) : new DevGate(cfg)
}

export { PAYMENT_SIG_HEADER, readPaymentSig }
