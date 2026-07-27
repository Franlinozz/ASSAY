import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { globSync } from 'node:fs'

const root = resolve(import.meta.dirname, '..')
const files = [
  'README.md',
  'SECURITY.md',
  'LISTING.md',
  ...globSync('docs/**/*.{md,mdx}', { cwd: root }),
  ...globSync('apps/docs/content/docs/**/*.{md,mdx,json}', { cwd: root }),
  ...globSync('apps/web/app/**/*.{ts,tsx}', { cwd: root }),
]
const failures = []
const references = []
const external = new Set()
const offline = process.env.ASSAY_LINKS_OFFLINE === '1'

const stripTail = (value) => value.replace(/[),.;:\]}]+$/g, '')
const docsTarget = (pathname) => {
  const part = pathname.replace(/^\/docs\/?/, '')
  if (!part) return resolve(root, 'apps/docs/content/docs/index.mdx')
  const asPage = resolve(root, `apps/docs/content/docs/${part}.mdx`)
  const asIndex = resolve(root, `apps/docs/content/docs/${part}/index.mdx`)
  return existsSync(asPage) ? asPage : asIndex
}
const siteRoutes = new Set([
  '/',
  '/standard',
  '/evaluation',
  '/pricing',
  '/agents',
  '/verify',
  '/gallery',
  '/judge',
  '/studio',
  '/gallery/adaeze-okonkwo',
  '/gallery/tomas-rivera',
  '/gallery/mei-lin-chao',
])

function validateInternal(raw, source) {
  const target = raw.split('#')[0].split('?')[0]
  if (!target || target.startsWith('mailto:') || target.startsWith('data:')) return
  if (target.startsWith('/docs')) {
    const file = docsTarget(target)
    if (!existsSync(file)) failures.push(`${source}: missing docs route ${target}`)
    return
  }
  if (target.startsWith('/')) {
    // A path that resolves to a file under apps/web/public is a real static asset (editorial
    // imagery, brand marks, icons), not a route — check the file, not the route table.
    if (existsSync(resolve(root, 'apps/web/public', target.slice(1)))) return
    if (!siteRoutes.has(target) && !target.startsWith('/fixtures/'))
      failures.push(`${source}: unknown site route ${target}`)
    return
  }
  const file = resolve(dirname(resolve(root, source)), decodeURIComponent(target))
  if (!existsSync(file)) failures.push(`${source}: missing local target ${target}`)
}

for (const file of files) {
  const body = readFileSync(resolve(root, file), 'utf8')
  for (const match of body.matchAll(/(?:\]\(|(?:href|src)=["'])([^"'()\s>]+)(?:\)|["'])/g)) {
    const value = stripTail(match[1])
    references.push([file, value])
    if (/^https?:\/\//.test(value)) external.add(value)
    else validateInternal(value, file)
  }
  for (const match of body.matchAll(/https?:\/\/[^\s<>"'`()\]]+/g)) {
    const value = stripTail(match[0])
    if (value.includes('${') || value.includes('{')) continue
    references.push([file, value])
    external.add(value)
  }
}

function validateAssayUrl(url, source = 'source') {
  const parsed = new URL(url)
  if (parsed.hostname === 'assayed.xyz' || parsed.hostname === 'www.assayed.xyz') {
    if (parsed.pathname.startsWith('/docs')) {
      const file = docsTarget(parsed.pathname)
      if (!existsSync(file)) failures.push(`${source}: missing docs URL ${url}`)
    } else if (!siteRoutes.has(parsed.pathname) && !parsed.pathname.startsWith('/fixtures/')) {
      failures.push(`${source}: unknown Assay URL ${url}`)
    }
    return true
  }
  if (parsed.hostname === 'api.assayed.xyz') {
    const known =
      parsed.pathname === '/' ||
      parsed.pathname === '/mcp' ||
      parsed.pathname === '/health' ||
      parsed.pathname === '/.well-known/assay.json'
    if (!known) failures.push(`${source}: unknown Assay API URL ${url}`)
    return true
  }
  if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return true
  return false
}

for (const [source, value] of references) {
  if (/^https?:\/\//.test(value)) validateAssayUrl(value, source)
}

const githubRepo = 'https://github.com/Franlinozz/ASSAY'
async function checkUrl(url) {
  if (validateAssayUrl(url)) return
  if (url.startsWith(githubRepo)) {
    const parsed = new URL(url)
    if (
      parsed.pathname.endsWith('/actions/workflows/ci.yml') &&
      !existsSync(resolve(root, '.github/workflows/ci.yml'))
    )
      failures.push(`${url}: workflow file is absent`)
    if (
      parsed.pathname.endsWith('/security/advisories/new') &&
      !existsSync(resolve(root, 'SECURITY.md'))
    )
      failures.push(`${url}: security policy is absent`)
    return
  }
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'Assay-Link-Sweep/1.0', accept: 'text/html,*/*;q=0.8' },
    })
    // A protected or bot-filtered page still exists. Treat auth/anti-bot responses as
    // reachable, while continuing to fail on redirects that terminate at 404/410/5xx.
    if (
      (response.status < 200 || response.status >= 400) &&
      response.status !== 401 &&
      response.status !== 403
    )
      failures.push(`${url}: HTTP ${response.status}`)
    await response.body?.cancel()
  } catch (error) {
    failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const externalUrls = [...external]
if (!offline)
  for (let index = 0; index < externalUrls.length; index += 6)
    await Promise.all(externalUrls.slice(index, index + 6).map(checkUrl))

if (failures.length) {
  console.error(`[dead-links] FAILED (${failures.length})`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}

console.log(
  `[dead-links] ${files.length} exhibits · ${references.length} references · ${externalUrls.length} external URLs · zero dead links${offline ? ' (external fetch skipped)' : ''}`,
)
