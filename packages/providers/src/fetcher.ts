import { promises as dns } from 'node:dns'
import type { GapCode } from './gaps'

// Link-liveness + content fetcher with SSRF guards. Resolve DNS FIRST, block private/reserved
// ranges + loopback + link-local (incl. cloud metadata 169.254.169.254) + non-http(s) schemes.
// 5s timeout, <=3 redirects (each re-validated), 1MB cap, content-type allowlist. Used for
// evidence links AND the tribunal LINK_LIVENESS check. Results cached for 1h.

export interface FetchResult {
  ok: boolean
  status: number
  url: string
  title?: string
  textExcerpt?: string
  blockedReason?: string
  gap?: GapCode
}

export interface Fetcher {
  fetch(url: string): Promise<FetchResult>
}

export interface TransportResponse {
  status: number
  contentType: string
  body: string
  location?: string
}

export interface FetcherDeps {
  lookup: (host: string) => Promise<string[]>
  transport: (url: string, signal: AbortSignal) => Promise<TransportResponse>
  now: () => number
}

const TIMEOUT_MS = 5_000
const CACHE_TTL_MS = 60 * 60 * 1000
const MAX_REDIRECTS = 3
const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain', 'application/xhtml+xml']

// ── IP classification ──
function ipv4ToParts(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return null
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  return parts.every((p) => p >= 0 && p <= 255) ? parts : null
}

function isBlockedIpv4(p: number[]): boolean {
  const a = p[0]
  const b = p[1]
  const c = p[2]
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // private
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  if (a === 192 && b === 0 && c === 0) return true // 192.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking 198.18/15
  if (a >= 224) return true // multicast + reserved
  return false
}

export function isBlockedIp(ip: string): boolean {
  const v4 = ipv4ToParts(ip)
  if (v4) return isBlockedIpv4(v4)

  const addr = ip.toLowerCase()
  if (addr === '::' || addr === '::1') return true
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mapped) {
    const inner = ipv4ToParts(mapped[1])
    return inner ? isBlockedIpv4(inner) : true
  }
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true // fe80::/10 link-local
  return false
}

function isIpLiteral(host: string): boolean {
  return ipv4ToParts(host) !== null || host.includes(':')
}

// ── HTML helpers ──
function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? m[1].trim().replace(/\s+/g, ' ').slice(0, 200) : undefined
}

function textExcerpt(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

function blocked(url: string, reason: string): FetchResult {
  return { ok: false, status: 0, url, blockedReason: reason, gap: 'FETCH_BLOCKED' }
}

function dead(url: string, reason: string): FetchResult {
  return { ok: false, status: 0, url, blockedReason: reason, gap: 'FETCH_DEAD' }
}

// Validate scheme + resolve DNS + block private IPs for a single URL. Returns a reason if blocked.
async function guard(
  url: string,
  lookup: FetcherDeps['lookup'],
): Promise<{ blocked: FetchResult } | { ok: true }> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { blocked: blocked(url, 'malformed url') }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { blocked: blocked(url, `scheme ${u.protocol} not allowed`) }
  }
  const host = u.hostname.replace(/^\[|\]$/g, '')
  let ips: string[]
  if (isIpLiteral(host)) {
    ips = [host]
  } else {
    try {
      ips = await lookup(host)
    } catch {
      return { blocked: dead(url, 'dns failed') }
    }
    if (ips.length === 0) return { blocked: dead(url, 'no dns records') }
  }
  for (const ip of ips) {
    if (isBlockedIp(ip)) return { blocked: blocked(url, `resolves to blocked ip ${ip}`) }
  }
  return { ok: true }
}

async function defaultTransport(url: string, signal: AbortSignal): Promise<TransportResponse> {
  const res = await fetch(url, { redirect: 'manual', signal, headers: { accept: 'text/html' } })
  if (res.status >= 300 && res.status < 400) {
    const redirect: TransportResponse = { status: res.status, contentType: '', body: '' }
    const loc = res.headers.get('location')
    if (loc) redirect.location = loc
    return redirect
  }
  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const reader = res.body?.getReader()
  let received = 0
  let body = ''
  const decoder = new TextDecoder()
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > 1_000_000) {
        await reader.cancel()
        break
      }
      body += decoder.decode(value, { stream: true })
    }
  }
  return { status: res.status, contentType, body }
}

export function createFetcher(deps: Partial<FetcherDeps> = {}): Fetcher {
  const lookup =
    deps.lookup ??
    (async (host: string) => (await dns.lookup(host, { all: true })).map((r) => r.address))
  const transport = deps.transport ?? defaultTransport
  const now = deps.now ?? (() => Date.now())
  const cache = new Map<string, { result: FetchResult; expiresAt: number }>()

  async function run(startUrl: string): Promise<FetchResult> {
    let current = startUrl
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const g = await guard(current, lookup) // re-validate SSRF on every hop
      if ('blocked' in g) return { ...g.blocked, url: startUrl }

      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
      let res: TransportResponse
      try {
        res = await transport(current, ctrl.signal)
      } catch {
        return dead(startUrl, 'transport failed')
      } finally {
        clearTimeout(timer)
      }

      if (res.status >= 300 && res.status < 400 && res.location) {
        if (hop === MAX_REDIRECTS) return dead(startUrl, 'too many redirects')
        current = new URL(res.location, current).toString()
        continue
      }

      if (res.contentType && !ALLOWED_CONTENT_TYPES.includes(res.contentType)) {
        return {
          ok: false,
          status: res.status,
          url: startUrl,
          blockedReason: `content-type ${res.contentType}`,
          gap: 'FETCH_BLOCKED',
        }
      }
      const ok = res.status >= 200 && res.status < 400
      const title = extractTitle(res.body)
      const out: FetchResult = { ok, status: res.status, url: startUrl }
      if (title !== undefined) out.title = title
      if (res.body) out.textExcerpt = textExcerpt(res.body)
      if (!ok) out.gap = 'FETCH_DEAD'
      return out
    }
    return dead(startUrl, 'too many redirects')
  }

  return {
    async fetch(url: string): Promise<FetchResult> {
      const hit = cache.get(url)
      if (hit && hit.expiresAt > now()) return hit.result
      const result = await run(url)
      cache.set(url, { result, expiresAt: now() + CACHE_TTL_MS })
      return result
    },
  }
}
