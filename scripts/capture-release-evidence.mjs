import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'evidence')
mkdirSync(output, { recursive: true })

const endpoint = 'https://api.assayed.xyz/mcp'
const capturedAt = new Date().toISOString()
const challengeResponse = await fetch(endpoint, {
  headers: { accept: 'application/json, text/event-stream' },
})
const encodedChallenge = challengeResponse.headers.get('payment-required')
if (challengeResponse.status !== 402 || !encodedChallenge)
  throw new Error(`expected live 402 PAYMENT-REQUIRED, received ${challengeResponse.status}`)

const challenge = JSON.parse(Buffer.from(encodedChallenge, 'base64').toString('utf8'))
const accepts = challenge.accepts ?? []
const verifyResponse = await fetch(endpoint, {
  method: 'POST',
  headers: {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'asy_verify', arguments: { dossierId: 'DSR-WC0Q7NZ7' } },
  }),
})
if (!verifyResponse.ok) throw new Error(`asy_verify returned ${verifyResponse.status}`)
const verifyText = await verifyResponse.text()

const proof = {
  capturedAt,
  endpoint,
  unpaidStatus: challengeResponse.status,
  x402Version: challenge.x402Version,
  accepts: accepts.map(({ scheme, network, amount, asset, payTo, maxAmountRequired }) => ({
    scheme,
    network,
    amount: amount ?? maxAmountRequired,
    asset,
    payTo,
  })),
  freeVerifyStatus: verifyResponse.status,
  freeVerifyBody: JSON.parse(verifyText),
  provenSettlement: '0x4babf76c2b29c6a8ac0314b42ad93081213f62022d537903c99abfecf73794a7',
}
writeFileSync(resolve(output, 'live-marketplace-call.json'), `${JSON.stringify(proof, null, 2)}\n`)

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const rows = accepts
    .map(
      (accept) => `<tr>
        <td>${escapeHtml(accept.scheme)}</td>
        <td>${escapeHtml(accept.network)}</td>
        <td>${escapeHtml(accept.amount ?? accept.maxAmountRequired)}</td>
        <td class="mono">${escapeHtml(accept.asset)}</td>
        <td class="mono">${escapeHtml(accept.payTo)}</td>
      </tr>`,
    )
    .join('')
  await page.setContent(`<!doctype html>
    <html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;padding:64px;background:#fbf9f3;color:#1b1f2a;font:16px/1.5 ui-sans-serif,-apple-system,"Segoe UI",sans-serif}
      main{max-width:1260px;margin:auto}.over{font:700 12px/1.2 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#205c4c}
      h1{font:700 46px/1.05 Georgia,serif;margin:12px 0}.lede{font-size:20px;max-width:900px;color:#565245}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:34px 0}.card{border:1px solid #d9d1c0;background:#f4f0e6;border-radius:12px;padding:24px}
      .stamp{display:inline-block;border:2px solid #c63d21;color:#c63d21;padding:8px 12px;border-radius:6px;font:800 14px ui-monospace,monospace;transform:rotate(-1deg)}
      table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}th,td{padding:10px;border-bottom:1px solid #d9d1c0;text-align:left;vertical-align:top}
      .mono{font:12px/1.45 ui-monospace,monospace;overflow-wrap:anywhere}.good{color:#205c4c;font-weight:800}.note{color:#66614f;font-size:13px}
    </style></head><body><main>
      <div class="over">Assay release evidence · live capture</div>
      <h1>A buyer can discover terms before MCP negotiation.</h1>
      <p class="lede">Unauthenticated request → standard x402 challenge; free seal verification → successful MCP response.</p>
      <div class="grid">
        <section class="card"><div class="stamp">HTTP ${proof.unpaidStatus} · PAYMENT REQUIRED</div>
          <p><strong>Endpoint</strong><br><span class="mono">${escapeHtml(endpoint)}</span></p>
          <p><strong>x402 version</strong><br>${escapeHtml(proof.x402Version)}</p>
        </section>
        <section class="card"><p class="good">FREE VERIFY · HTTP ${proof.freeVerifyStatus}</p>
          <p><strong>Dossier</strong><br><span class="mono">DSR-WC0Q7NZ7</span></p>
          <p><strong>Existing paid settlement</strong><br><span class="mono">${proof.provenSettlement}</span></p>
        </section>
      </div>
      <section class="card"><strong>Advertised accepts</strong>
        <table><thead><tr><th>Scheme</th><th>Network</th><th>Atomic amount</th><th>Asset</th><th>Pay to</th></tr></thead><tbody>${rows}</tbody></table>
      </section>
      <p class="note">Captured ${escapeHtml(capturedAt)}. This operator evidence sheet is generated from the live response; it is not a marketplace review or fabricated transaction.</p>
    </main></body></html>`)
  await page.screenshot({ path: resolve(output, 'marketplace-call.png'), fullPage: true })

  const explorerTargets = [
    [
      'explorer-gallery-seal.png',
      'https://www.oklink.com/x-layer/tx/0xae83407122efebea92e422921f91dd319ad504c611388fe15196274dc92b923e',
    ],
    [
      'explorer-x402-order.png',
      'https://www.oklink.com/x-layer/tx/0x4babf76c2b29c6a8ac0314b42ad93081213f62022d537903c99abfecf73794a7',
    ],
  ]
  for (const [name, url] of explorerTargets) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(4_000)
    await page.screenshot({ path: resolve(output, name), fullPage: true })
  }
} finally {
  await browser.close()
}

console.log(`[release-evidence] ${output}`)
