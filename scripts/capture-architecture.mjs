import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const svg = readFileSync(resolve('assets/architecture.svg'), 'utf8')
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
const browser = await chromium.launch({ headless: true })

try {
  for (const [name, background] of [
    ['light', '#ffffff'],
    ['dark', '#0d1117'],
  ]) {
    const page = await browser.newPage({ viewport: { width: 900, height: 650 } })
    await page.setContent(
      `<style>html,body{margin:0;background:${background}}body{padding:28px 50px}img{display:block;width:800px;height:auto}</style><img src="${src}" alt="Assay architecture">`,
    )
    await page.locator('img').waitFor({ state: 'visible' })
    await page.screenshot({ path: `/tmp/architecture-${name}.png`, fullPage: true })
    console.log(`[architecture] /tmp/architecture-${name}.png`)
    await page.close()
  }
} finally {
  await browser.close()
}
