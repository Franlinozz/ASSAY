import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const base = (process.env.ASSAY_CAPTURE_BASE ?? 'https://assayed.xyz').replace(/\/$/, '')
const out = resolve('assets/screenshots')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  })
  await context.addInitScript(() => localStorage.setItem('assay-theme', 'light'))
  const page = await context.newPage()

  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.locator('.hero-grid').waitFor()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/product-hero.png` })

  await page.goto(`${base}/gallery`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid^="persona-card-"]').first().waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/sealed-gallery.png` })

  await page.goto(`${base}/judge`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('judge-tour').waitFor()
  for (let i = 0; i < 12; i++) {
    const beat = await page.getByTestId('judge-tour').getAttribute('data-beat')
    if (beat === 'repair-pass') break
    await page.getByTestId('judge-skip').click()
  }
  await page.waitForTimeout(300)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: `${out}/tribunal-repair.png` })

  await page.goto(`${base}/verify?dossierId=DSR-WC0Q7NZ7`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByTestId('verify-result').waitFor({ timeout: 30_000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/xlayer-verification.png` })

  console.log(`[readme-captures] 4 public product exhibits → ${out}`)
} finally {
  await browser.close()
}
