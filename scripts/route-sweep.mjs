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

async function hit(base, path, { expect = [200], allowRawGap = false, method = 'GET', body } = {}) {
  const url = `${base}${path}`
  let res
  try {
    res = await fetch(url, {
      method,
      ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
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
    await hit(web, '/api/verify', { method: 'POST', body: { leaf: personas[0].seal.leaf }, expect: [200] })
    await hit(web, '/api/verify', { method: 'POST', body: {}, expect: [400] })

    console.log('\n[route-sweep] mcp-server public HTTP')
    await hit(api, '/health', { expect: [200] })
    await hit(api, '/.well-known/assay.json', { expect: [200] })
    await hit(api, '/d-api', { expect: [200] })
    await hit(api, `/d-api/${seeded.dossierId}`, { expect: [200] })
    await hit(api, '/d-api/DSR-NOPE', { expect: [404], allowRawGap: true })
    await hit(api, '/mcp', { expect: [405], allowRawGap: true })
    // The seeded dossier's portfolio share slug (agent-facing /p/:slug), if present.
    const portfolio = seeded.result?.portfolio
    if (portfolio) await hit(api, new URL(portfolio).pathname, { expect: [200] })
    else failures.push('asy_job_result did not surface a portfolio URL (/p/:slug invisible)')
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
