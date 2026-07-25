import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const apiPort = Number(process.env.ASY_DEV_API_PORT ?? 8455)
const webPort = Number(process.env.ASY_DEV_WEB_PORT ?? 3400)
const dataDir = mkdtempSync(resolve(tmpdir(), 'assay-dev-'))

await new Promise((resolveBundle, reject) => {
  const bundle = spawn(process.execPath, ['packages/mcp-server/scripts/bundle.mjs'], {
    cwd: root,
    stdio: 'inherit',
  })
  bundle.on('error', reject)
  bundle.on('exit', (code) =>
    code === 0 ? resolveBundle() : reject(new Error(`MCP bundle failed (${code ?? 'unknown'})`)),
  )
})

const api = spawn(process.execPath, ['packages/mcp-server/dist/main.js'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    ASY_PORT: String(apiPort),
    ASY_DATA_DIR: dataDir,
    ASY_PAYMENT_MODE: 'dev',
    ASY_PROVIDER_MODE: process.env.ASY_PROVIDER_MODE ?? 'fake',
    ASY_BASE_URL: `http://127.0.0.1:${apiPort}`,
    ASY_REGISTRY: '0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4',
    ASY_CHAIN_ID: '196',
  },
})

const web = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', 'apps/web', '-p', String(webPort)],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      ASY_API_URL: `http://127.0.0.1:${apiPort}`,
      ASY_PROVIDER_MODE: process.env.ASY_PROVIDER_MODE ?? 'fake',
    },
  },
)

console.log('')
console.log(`[assay-dev] Studio  http://127.0.0.1:${webPort}/studio`)
console.log(`[assay-dev] API     http://127.0.0.1:${apiPort}/health`)
console.log('[assay-dev] Fake providers + dev payment gate; no API keys or funds required.')
console.log('')

let closing = false
function close(code = 0) {
  if (closing) return
  closing = true
  api.kill('SIGTERM')
  web.kill('SIGTERM')
  rmSync(dataDir, { recursive: true, force: true })
  setTimeout(() => process.exit(code), 100)
}

process.on('SIGINT', () => close(0))
process.on('SIGTERM', () => close(0))
api.on('exit', (code, signal) => {
  if (!closing) {
    console.error(`[assay-dev] API stopped (${signal ?? code ?? 'unknown'})`)
    close(code ?? 1)
  }
})
web.on('exit', (code, signal) => {
  if (!closing) {
    console.error(`[assay-dev] web stopped (${signal ?? code ?? 'unknown'})`)
    close(code ?? 1)
  }
})
