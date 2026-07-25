import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve('assets/outreach')
const base = process.env.OUTREACH_BASE ?? 'https://assayed.xyz'
mkdirSync(output, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`${base}/gallery/adaeze-okonkwo`, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  })
  await page.getByTestId('persona-seal').screenshot({ path: resolve(output, 'seal-adaeze.png') })
  const regrade = page.getByTestId('persona-as11-regrade')
  await regrade.evaluate((element) => {
    element.style.padding = '24px'
    element.style.border = '1px solid var(--hairline)'
    element.style.borderRadius = '8px'
  })
  await regrade.screenshot({ path: resolve(output, 'seal-gallery-regrade.png') })
  console.log('[outreach-proof] captured two live Assay gallery panels')
} finally {
  await browser.close()
}
