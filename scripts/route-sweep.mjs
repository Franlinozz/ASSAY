import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startStack, seed, API_PORT, WEB_PORT } from '../e2e/stack.mjs'

// P11.2 — route sweep. Boots the fake-mode stack, enumerates EVERY Next route + API endpoint + the
// mcp-server's public HTTP surface, hits each, and asserts a healthy status AND that no raw error
// string leaked into the body (guardrail #9). Fails loud (exit 1) on any bad route — this is how a
// backend capability that never surfaced, or a route that 500s in the dark, gets caught.

const HERE = dirname(fileURLToPath(import.meta.url))
const personas = JSON.parse(
  readFileSync(resolve(HERE, '../apps/web/lib/personas.generated.json'), 'utf8'),
).personas

// Substrings that must never appear in a rendered body (sanitized-gaps law + generic leaks).
const RAW_PATTERNS = [
  '>undefined<',
  '[object Object]',
  'ECONNREFUSED',
  'provider:unavailable',
  'chain:rpc',
  'at Object.',
  'Cannot read properties',
]

function bodyClean(body, path) {
  // /standard legitimately names placeholder tokens (the published PLACEHOLDER_TEXT law).
  const hits = RAW_PATTERNS.filter((p) => body.includes(p))
  return hits.length === 0 ? null : `${path} leaked: ${hits.join(', ')}`
}

const failures = []

async function hit(
  base,
  path,
  { expect = [200], allowRawGap = false, method = 'GET', body, headers = {} } = {},
) {
  const url = `${base}${path}`
  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...headers,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (e) {
    failures.push(`${method} ${path} → threw ${e.message}`)
    return
  }
  if (!expect.includes(res.status)) {
    failures.push(`${method} ${path} → ${res.status} (expected ${expect.join('/')})`)
  }
  const text = await res.text().catch(() => '')
  if (!allowRawGap) {
    const leak = bodyClean(text, path)
    if (leak) failures.push(leak)
  }
  const tag = expect.includes(res.status) ? '✓' : '✗'
  console.log(`  ${tag} ${res.status}  ${method} ${path}`)
  return { res, text }
}

async function main() {
  const { stop } = await startStack()
  let seeded
  try {
    seeded = await seed()
    const web = `http://127.0.0.1:${WEB_PORT}`
    const api = `http://127.0.0.1:${API_PORT}`

    console.log('\n[route-sweep] Next pages')
    const pages = [
      '/',
      '/standard',
      '/evaluation',
      '/pricing',
      '/agents',
      '/verify',
      '/gallery',
      '/judge',
      ...personas.map((p) => `/gallery/${p.slug}`),
      '/studio',
    ]
    for (const p of pages) await hit(web, p)
    // Deep dynamic pages that require a token/id resolve to a graceful state, never a 500.
    await hit(web, '/d/DSR-NOPE', { expect: [200] })
    await hit(web, '/s/nope', { expect: [200, 404] })
    await hit(web, `/verify?leaf=${personas[0].seal.leaf}`, { expect: [200] })

    console.log('\n[route-sweep] Next API')
    await hit(web, '/api/recent-seals', { expect: [200] })
    await hit(web, '/api/verify', {
      method: 'POST',
      body: { leaf: personas[0].seal.leaf },
      expect: [200],
    })
    await hit(web, '/api/verify', { method: 'POST', body: {}, expect: [400] })

    console.log('\n[route-sweep] mcp-server public HTTP')
    await hit(api, '/health', { expect: [200] })
    await hit(api, '/.well-known/assay.json', { expect: [200] })
    await hit(api, '/d-api', { expect: [200] })
    await hit(api, `/d-api/${seeded.dossierId}`, { expect: [200] })
    await hit(api, '/d-api/DSR-NOPE', { expect: [404], allowRawGap: true })
    const getMcp = await hit(api, '/mcp', { expect: [200], allowRawGap: true })
    if (getMcp?.res.headers.get('PAYMENT-REQUIRED'))
      failures.push('GET /mcp initiated an x402 charge outside tools/call')
    const initializeMcp = await hit(api, '/mcp', {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'route-sweep', version: '1' },
        },
      },
      expect: [200],
      allowRawGap: true,
    })
    if (initializeMcp?.res.headers.get('PAYMENT-REQUIRED'))
      failures.push('initialize initiated an x402 charge outside tools/call')
    const listMcp = await hit(api, '/mcp', {
      method: 'POST',
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      expect: [200],
      allowRawGap: true,
    })
    if (listMcp?.res.headers.get('PAYMENT-REQUIRED'))
      failures.push('tools/list initiated an x402 charge outside tools/call')
    const unpaidMcp = await hit(api, '/mcp', {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'asy_ats_scan',
          arguments: { resumeText: 'JANE DOE\nEXPERIENCE\nAcme — Engineer' },
        },
      },
      expect: [402],
      allowRawGap: true,
    })
    const paymentRequired = unpaidMcp?.res.headers.get('PAYMENT-REQUIRED')
    if (!paymentRequired) {
      failures.push('paid tools/call → 402 without PAYMENT-REQUIRED challenge')
    } else {
      try {
        const challenge = JSON.parse(Buffer.from(paymentRequired, 'base64').toString())
        const accepted = challenge.accepts?.[0]
        if (
          challenge.x402Version !== 2 ||
          accepted?.network !== 'eip155:196' ||
          accepted?.amount !== '50000'
        ) {
          failures.push('paid tools/call → malformed x402 challenge')
        }
      } catch {
        failures.push('paid tools/call → PAYMENT-REQUIRED is not valid base64 JSON')
      }
    }
    // The seeded dossier's portfolio share slug (agent-facing /p/:slug), if present.
    const portfolio = seeded.result?.portfolio
    if (portfolio) await hit(api, new URL(portfolio).pathname, { expect: [200] })
    else failures.push('asy_job_result did not surface a portfolio URL (/p/:slug invisible)')

    console.log('\n[route-sweep] artifact downloads are real files')
    const arts = seeded.result?.artifacts ?? []
    const pdf = arts.find((a) => a.kind === 'resume_ats' || a.kind === 'resume_designed')
    if (pdf) {
      const res = await fetch(pdf.url)
      const buf = Buffer.from(await res.arrayBuffer())
      const magic = buf.subarray(0, 5).toString('latin1')
      const ok = res.status === 200 && magic.startsWith('%PDF') && buf.length > 1000
      console.log(
        `  ${ok ? '✓' : '✗'} ${res.status}  download ${pdf.kind} → ${magic.trim()} (${buf.length}B)`,
      )
      if (!ok)
        failures.push(
          `download ${pdf.kind}: status ${res.status}, magic "${magic}", ${buf.length}B`,
        )
    } else {
      failures.push('no downloadable PDF artifact in the dossier result')
    }
    // A tampered/absent token must be refused (403), never served.
    if (pdf) {
      const bad = pdf.url.replace(/tok=[^&]+/, 'tok=forged')
      await hit('', bad, { expect: [403], allowRawGap: true })
    }
  } finally {
    stop()
  }

  console.log('')
  if (failures.length) {
    console.error(`[route-sweep] FAILED (${failures.length}):`)
    for (const f of failures) console.error('  ✗ ' + f)
    process.exit(1)
  }
  console.log('[route-sweep] all routes healthy, zero raw-error leaks ✓')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
