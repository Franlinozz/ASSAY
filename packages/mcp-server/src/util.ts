import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

// JSON.stringify with a bigint replacer (gotcha #2) — payment/settlement objects and on-chain
// timestamps carry bigints that would otherwise throw.
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

export function toJson(value: unknown): string {
  return JSON.stringify(value, bigintReplacer)
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// USDT price → the USD amount string the x402 seller SDK expects ("$0.05"). The facilitator converts
// USD → the network's USDT asset. (Doc shape re-fetched 2026-07-23 — AGENTS.md gotcha 8.)
export function priceString(usdt: number): string {
  return `$${usdt.toFixed(usdt < 1 ? 2 : 2)}`
}

// ── HMAC signed URLs for evidence/artifact files ──
// token = "<expiryMs>.<hmacHex>", hmac over `${id}.${expiryMs}`. 24h default TTL. Constant-time
// verification. Files are never public: every /f/:id read must carry a live, unexpired token.
export function signFileToken(secret: string, id: string, expiresAt: number): string {
  const mac = createHmac('sha256', secret).update(`${id}.${expiresAt}`).digest('hex')
  return `${expiresAt}.${mac}`
}

export function verifyFileToken(
  secret: string,
  id: string,
  token: string,
  now = Date.now(),
): boolean {
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const expStr = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expiresAt = Number(expStr)
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false
  const expected = createHmac('sha256', secret).update(`${id}.${expiresAt}`).digest('hex')
  if (mac.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

// Decode an uploaded document supplied as base64 or plain text. Returns bytes + a best-effort flag
// of whether the input was base64 (so callers can pick pdf/docx parsing vs plain text).
export function decodeUpload(input: { textB64?: string | undefined; text?: string | undefined }): {
  bytes: Uint8Array
  wasB64: boolean
} {
  if (input.textB64 && input.textB64.trim()) {
    return { bytes: new Uint8Array(Buffer.from(input.textB64, 'base64')), wasB64: true }
  }
  return { bytes: new Uint8Array(Buffer.from(input.text ?? '', 'utf-8')), wasB64: false }
}

// Small, dependency-free per-IP token bucket (gotcha: rate limiting lives in-process; the VPS is
// single-instance behind Caddy).
export class TokenBucket {
  private readonly hits = new Map<string, number[]>()
  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  take(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff)
    if (list.length >= this.limit) {
      this.hits.set(key, list)
      return false
    }
    list.push(now)
    this.hits.set(key, list)
    return true
  }
}
