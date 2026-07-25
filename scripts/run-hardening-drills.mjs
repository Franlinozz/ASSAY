import { chromium } from 'playwright'
import { startStack } from '../e2e/stack.mjs'

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0
}

const measure = async (count, work) => {
  const samples = []
  for (let i = 0; i < count; i++) {
    const before = performance.now()
    await work(i)
    samples.push(performance.now() - before)
  }
  return {
    samples: samples.length,
    p50Ms: Math.round(percentile(samples, 0.5)),
    p95Ms: Math.round(percentile(samples, 0.95)),
    maxMs: Math.round(Math.max(...samples)),
  }
}

const stack = await startStack()
let browser
try {
  const api = 'http://127.0.0.1:8455'
  const web = 'http://127.0.0.1:3400'
  const health = await measure(80, async () => {
    const response = await fetch(`${api}/health`)
    if (!response.ok) throw new Error(`health returned ${response.status}`)
    await response.arrayBuffer()
  })

  const ats = await measure(12, async (i) => {
    const response = await fetch(`${api}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'PAYMENT-SIG': `phase16-perf-${i}`,
        'Idempotency-Key': `phase16-perf-${i}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: i,
        method: 'tools/call',
        params: {
          name: 'asy_ats_scan',
          arguments: {
            resumeText:
              'Ada Test\nEXPERIENCE\nAcme — Product Operations\nImproved onboarding and reporting.',
          },
        },
      }),
    })
    if (!response.ok) throw new Error(`ats_scan returned ${response.status}`)
    await response.arrayBuffer()
  })

  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__assayLcp = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        window.__assayLcp = Math.max(window.__assayLcp, entry.startTime)
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    connectionType: 'cellular3g',
  })
  await page.goto(web, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1_000)
  const lcpMs = Math.round(await page.evaluate(() => window.__assayLcp ?? 0))
  await context.close()

  const result = {
    measuredAt: new Date().toISOString(),
    mode: 'local fake providers; production build; Chromium Fast-3G emulation',
    budgets: {
      healthP95Ms: { target: 100, actual: health.p95Ms, pass: health.p95Ms < 100 },
      atsScanP95Ms: { target: 15_000, actual: ats.p95Ms, pass: ats.p95Ms < 15_000 },
      studioLcpMs: { target: 2_500, actual: lcpMs, pass: lcpMs < 2_500 },
    },
    samples: { health, ats },
  }
  console.log(JSON.stringify(result, null, 2))
  if (!Object.values(result.budgets).every((budget) => budget.pass)) process.exitCode = 1
} finally {
  await browser?.close()
  stack.stop()
}
