import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

// OG images, generated from a real rendered template (gotcha #11: referenced assets are verified —
// the PNGs are screenshotted from actual chromium rendering, then eyeballed in the audit loop).

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const fontsDir = resolve(webRoot, 'fonts')
const outDir = resolve(webRoot, 'public/og')
mkdirSync(outDir, { recursive: true })

const PAGES = [
  { file: 'default', title: 'Proof before polish.', sub: 'The evidence-backed career studio' },
  {
    file: 'standard',
    title: 'The Assay Standard',
    sub: 'The rubric is generated from the code that grades',
  },
  {
    file: 'evaluation',
    title: 'Watch the Standard work.',
    sub: 'A real dossier run — findings, repairs, verdicts',
  },
  { file: 'pricing', title: 'Cents per call.', sub: 'x402 on X Layer · verification free forever' },
  { file: 'agents', title: 'Ten tools. One endpoint.', sub: 'A2MCP · pay per call in USDT' },
  { file: 'verify', title: 'Check a seal.', sub: 'Free forever · no wallet · X Layer mainnet' },
  {
    file: 'gallery',
    title: 'Dossiers on display.',
    sub: 'Real pipeline output · fictional personas',
  },
]

// A modest guilloché band for the template (same math as components/Guilloche.tsx).
function guilloche(width, height, strands = 8) {
  const paths = []
  const amp = height * 0.36
  const step = 6
  for (let i = 0; i < strands; i++) {
    const phase = (i / strands) * Math.PI * 2
    for (const [f1, f2, a] of [
      [3, 7, amp],
      [5, 2, amp * 0.62],
    ]) {
      const pts = []
      for (let x = 0; x <= width; x += step) {
        const t = (x / width) * Math.PI * 2
        const y = height / 2 + a * Math.sin(t * f1 + phase) * Math.cos(t * f2 + phase / 2)
        pts.push(`${x.toFixed(1)},${y.toFixed(2)}`)
      }
      paths.push(`M${pts.join(' L')}`)
    }
  }
  return paths
    .map(
      (d, i) =>
        `<path d="${d}" fill="none" stroke="${i % 3 === 0 ? '#205C4C' : '#D8D0BC'}" stroke-width="0.6" opacity="${i % 3 === 0 ? 0.3 : 0.5}"/>`,
    )
    .join('')
}

function template({ title, sub }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Fraunces; src: url('${pathToFileURL(resolve(fontsDir, 'Fraunces-var.woff2')).href}') format('woff2'); font-weight: 300 900; }
  @font-face { font-family: JBMono; src: url('${pathToFileURL(resolve(fontsDir, 'JetBrainsMono-var.woff2')).href}') format('woff2'); font-weight: 100 800; }
  @font-face { font-family: InterV; src: url('${pathToFileURL(resolve(fontsDir, 'Inter-var.woff2')).href}') format('woff2'); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #FBF9F3; color: #1B1F2A; font-family: InterV, sans-serif; position: relative; overflow: hidden; }
  .frame { position: absolute; inset: 26px; border: 1px solid #D8D0BC; }
  .frame2 { position: absolute; inset: 32px; border: 1px solid #E6E0D2; }
  .band { position: absolute; left: 26px; right: 26px; top: 26px; }
  .band-b { position: absolute; left: 26px; right: 26px; bottom: 26px; transform: scaleY(-1); }
  .content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 110px; }
  .wordmark { font-family: Fraunces, serif; font-weight: 600; letter-spacing: 0.24em; font-size: 30px; }
  .rule { width: 64px; height: 2px; background: #205C4C; margin: 30px 0 34px; }
  h1 { font-family: Fraunces, serif; font-weight: 590; font-size: 84px; letter-spacing: -0.02em; line-height: 1.04; max-width: 950px; }
  .sub { margin-top: 26px; font-size: 27px; color: #5a5648; }
  .meta { position: absolute; left: 110px; right: 110px; bottom: 74px; display: flex; justify-content: space-between; font-family: JBMono, monospace; font-size: 17px; letter-spacing: 0.14em; color: #7E7A6E; }
  .seal { position: absolute; right: 96px; top: 96px; width: 88px; height: 88px; border: 2.5px solid #C63D21; border-radius: 999px; display: flex; align-items: center; justify-content: center; }
  .seal-inner { width: 12px; height: 12px; border-radius: 999px; background: #C63D21; }
  </style></head><body>
    <div class="frame"></div><div class="frame2"></div>
    <div class="band"><svg width="1148" height="30" viewBox="0 0 1148 30">${guilloche(1148, 30)}</svg></div>
    <div class="band-b"><svg width="1148" height="30" viewBox="0 0 1148 30">${guilloche(1148, 30)}</svg></div>
    <div class="seal"><div class="seal-inner"></div></div>
    <div class="content">
      <div class="wordmark">ASSAY</div>
      <div class="rule"></div>
      <h1>${title}</h1>
      <div class="sub">${sub}</div>
    </div>
    <div class="meta"><span>ASSAYED.XYZ</span><span>AS-1.1.0 · X LAYER · AGENT #8599</span></div>
  </body></html>`
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
const tmp = resolve(webRoot, '.og-tmp.html')
for (const p of PAGES) {
  writeFileSync(tmp, template(p))
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' })
  const png = await page.screenshot({ type: 'png' })
  writeFileSync(resolve(outDir, `${p.file}.png`), png)
  console.log(`[og] ${p.file}.png`)
}
rmSync(tmp, { force: true })
await browser.close()
