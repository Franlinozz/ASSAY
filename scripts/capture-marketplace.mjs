import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const url = process.env.MARKETPLACE_URL ?? 'https://www.okx.ai/agents/8599'
const output = resolve(
  process.env.MARKETPLACE_SCREENSHOT ?? 'assets/marketplace/assay-8599-prices.png',
)
const expected = [
  ['ATS Resume Scan', '0.05 USDT'],
  ['Job Fit Brief', '0.1 USDT'],
  ['Career Dossier', '2 USDT'],
  ['Interview Prep', '0.2 USDT'],
  ['Promotion Dossier', '2 USDT'],
  ['Freelancer Proof Pack', '2 USDT'],
  ['Claim Audit', '0.05 USDT'],
  ['Cover Letter', '0.15 USDT'],
  ['Story Bank', '0.2 USDT'],
  ['Tailor Resume', '0.3 USDT'],
  ['Verify Seal', '0.00 USDT'],
  ['Job Status', '0.00 USDT'],
  ['Job Result', '0.00 USDT'],
]

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  if (!response?.ok()) throw new Error(`marketplace returned HTTP ${response?.status() ?? 'none'}`)
  const text = await page.locator('body').innerText()
  for (const [name, price] of expected) {
    if (!text.includes(name) || !text.includes(price))
      throw new Error(`public listing does not yet show ${name} at ${price}`)
  }
  mkdirSync(dirname(output), { recursive: true })
  await page.screenshot({ path: output, fullPage: true })
  console.log(`[marketplace-proof] ${output}`)
} finally {
  await browser.close()
}
