import { chromium } from 'playwright'

// HTML → PDF via headless chromium (installed on the VPS). Self-contained HTML only (no network),
// so 'load' is enough. preferCSSPageSize honors the template's @page size/margins.
export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await browser.close()
  }
}

// Full-page PNG (used for the self-audit screenshots).
export async function htmlToPng(html: string, width = 820): Promise<Uint8Array> {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width, height: 1160 } })
    await page.setContent(html, { waitUntil: 'load' })
    return await page.screenshot({ fullPage: true })
  } finally {
    await browser.close()
  }
}
