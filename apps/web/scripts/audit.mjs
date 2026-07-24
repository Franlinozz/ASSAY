import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// The MANDATORY self-audit loop (P8/P9): after each page, screenshot desktop 1440 + mobile 390 in
// BOTH themes; the executor then VIEWS every image, lists defects, fixes, re-shoots. Output goes
// to apps/web/.audit/ (gitignored).

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(webRoot, '.audit')
mkdirSync(outDir, { recursive: true })

const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:3100'
const only = process.argv[2] // optional: audit a single route, e.g. `node audit.mjs /standard`

const ROUTES = [
  ['home', '/'],
  ['standard', '/standard'],
  ['evaluation', '/evaluation'],
  ['pricing', '/pricing'],
  ['agents', '/agents'],
  ['verify', '/verify'],
  ['gallery', '/gallery'],
  ['studio', '/studio'],
]

const VIEWPORTS = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]
const THEMES = ['light', 'dark']

const browser = await chromium.launch({ args: ['--no-sandbox'] })
for (const [name, path] of ROUTES) {
  if (only && path !== only && name !== only) continue
  for (const [vpName, viewport] of VIEWPORTS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 })
      await ctx.addInitScript((t) => window.localStorage.setItem('assay-theme', t), theme)
      const page = await ctx.newPage()
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400) // fonts + thread measurement settle
      const file = resolve(outDir, `${name}-${vpName}-${theme}.png`)
      await page.screenshot({ path: file, fullPage: true })
      console.log(`[audit] ${name}-${vpName}-${theme}.png`)
      await ctx.close()
    }
  }
}
await browser.close()
