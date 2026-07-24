import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// Boots the fake-mode stack (mcp-server + built web) and seeds one dossier through the real
// asy_create_dossier_job pipeline. State for the tests (dossier id) + child pids for teardown
// land in e2e/.stack-state.json.
export default async function globalSetup(): Promise<void> {
  const { startStack, seed } = await import('./stack.mjs')
  const { api, web } = await startStack()
  const seeded = await seed()
  writeFileSync(
    resolve(HERE, '.stack-state.json'),
    JSON.stringify({ apiPid: api.pid, webPid: web.pid, dossierId: seeded.dossierId }),
  )
}
