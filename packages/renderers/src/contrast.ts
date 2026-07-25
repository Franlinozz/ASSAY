import { chromium } from 'playwright'
import sharp from 'sharp'

const linear = (value: number): number => {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

const luminance = ([r, g, b]: [number, number, number]): number =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)

const contrast = (a: [number, number, number], b: [number, number, number]): number => {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (bright + 0.05) / (dark + 0.05)
}

function rgb(css: string): [number, number, number] {
  const values = css
    .match(/\d+(?:\.\d+)?/g)
    ?.slice(0, 3)
    .map(Number)
  return values?.length === 3 ? (values as [number, number, number]) : [0, 0, 0]
}

// Render first, then sample the raster that Chromium actually produced. The foreground comes from
// the rendered body text; the background is the dominant screenshot pixel, so CSS variables,
// inherited themes, and composited backgrounds are all measured in their final state.
export async function sampleRenderedContrast(html: string): Promise<number> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
    await page.setContent(html, { waitUntil: 'networkidle' })
    const foreground = rgb(
      await page
        .locator('body')
        .evaluate((node) => (node as any).ownerDocument.defaultView.getComputedStyle(node).color),
    )
    const screenshot = await page.screenshot({ type: 'png' })
    const { data, info } = await sharp(screenshot)
      .removeAlpha()
      .resize({ width: 300 })
      .raw()
      .toBuffer({ resolveWithObject: true })
    const counts = new Map<string, number>()
    for (let i = 0; i < data.length; i += info.channels) {
      const key = `${Math.round(data[i]! / 8) * 8},${Math.round(data[i + 1]! / 8) * 8},${Math.round(data[i + 2]! / 8) * 8}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const background = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])[0]![0]
      .split(',')
      .map(Number) as [number, number, number]
    return Math.round(contrast(foreground, background) * 100) / 100
  } finally {
    await browser.close()
  }
}
