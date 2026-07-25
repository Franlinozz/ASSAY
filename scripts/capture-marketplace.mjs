import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'

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
  const pages = [{ label: 'page-1', text: await page.locator('body').innerText() }]
  mkdirSync(dirname(output), { recursive: true })
  const extension = extname(output)
  const stem = output.slice(0, -extension.length)
  await page.screenshot({ path: `${stem}-page-1${extension}`, fullPage: true })

  const services = page
    .locator('section:has(h2:text-is("Services"))')
    .filter({ visible: true })
    .first()
  const pageTwoControl = services.locator('.ac-pagination button:text-is("2")')
  if ((await pageTwoControl.count()) > 0 && (await pageTwoControl.isVisible())) {
    await pageTwoControl.click()
    await services.locator('#service-36921').waitFor({ state: 'visible' })
    await page.waitForTimeout(300)
    pages.push({ label: 'page-2', text: await page.locator('body').innerText() })
    await page.screenshot({ path: `${stem}-page-2${extension}`, fullPage: true })
  }

  const text = pages.map((entry) => entry.text).join('\n')
  for (const [name, price] of expected) {
    if (!text.includes(name) || !text.includes(price))
      throw new Error(`public listing does not yet show ${name} at ${price}`)
  }
  console.log(
    `[marketplace-proof] verified ${expected.length} services across ${pages.length} page(s) · ${stem}-page-{1,2}${extension}`,
  )
} finally {
  await browser.close()
}
