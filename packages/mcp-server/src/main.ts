import { createRouter, createModeFetcher, providerMode } from '@xyndicate/providers'
import { htmlToPdf } from '@xyndicate/renderers'
import { loadConfig } from './config'
import { Store } from './store'
import { createGate } from './gate'
import { JobRunner, devPdf } from './jobs'
import { AnchorWorker } from './anchor'
import { buildApp } from './http'

// Env-driven assembly. Fakes are the default (zero spend); only ASY_PROVIDER_MODE=live wires real
// providers + headless-chromium PDF rendering. Boots the HTTP server, the job worker and the anchor
// worker, then logs its endpoints, signer and mode.

export function main(): void {
  const cfg = loadConfig()
  const port = Number(process.env['ASY_PORT'] ?? 8402)
  const live = providerMode() === 'live'

  const store = new Store(cfg.dbPath, cfg.filesDir)
  const router = createRouter()
  const fetcher = createModeFetcher()
  const gate = createGate(cfg)
  const toPdf = live ? htmlToPdf : devPdf

  const jobs = new JobRunner({ store, router, fetcher, cfg, toPdf })
  jobs.start()
  const anchor = new AnchorWorker(store, cfg)
  anchor.start()

  const app = buildApp({ store, router, fetcher, cfg, gate })
  const server = app.listen(port, () => {
    const signer = cfg.sealerKey ? 'set' : 'none (seals stay pending)'
    console.log(`[assay-mcp] listening on :${port}`)
    console.log(`  base           ${cfg.baseUrl}`)
    console.log(`  mcp            POST ${cfg.baseUrl}/mcp`)
    console.log(`  manifest       ${cfg.baseUrl}/.well-known/assay.json`)
    console.log(`  health         ${cfg.baseUrl}/health`)
    console.log(`  payment mode   ${cfg.paymentMode}   provider ${live ? 'live' : 'fake'}`)
    console.log(
      `  chain          eip155:${cfg.chainId}   registry ${cfg.registry}   sealer ${signer}`,
    )
    console.log(`  anchor every   ${Math.round(cfg.anchorIntervalMs / 60000)} min`)
  })

  // Keep-warm self-ping so the marketplace never hits a cold start (P7 STEP 3).
  const keepWarm = setInterval(() => {
    fetch(`http://127.0.0.1:${port}/health`).catch(() => {})
  }, 5 * 60_000)
  if (typeof keepWarm.unref === 'function') keepWarm.unref()

  const shutdown = (): void => {
    console.log('[assay-mcp] shutting down…')
    clearInterval(keepWarm)
    jobs.stop()
    anchor.stop()
    server.close(() => {
      store.close()
      process.exit(0)
    })
    setTimeout(() => process.exit(0), 3000).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

// Run when invoked as the binary (dist/main.js).
if (
  process.argv[1] &&
  (process.argv[1].endsWith('main.js') || process.argv[1].endsWith('main.ts'))
) {
  main()
}
