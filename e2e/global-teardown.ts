import { readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

export default async function globalTeardown(): Promise<void> {
  const statePath = resolve(HERE, '.stack-state.json')
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as {
      apiPid?: number
      webPid?: number
    }
    for (const pid of [state.apiPid, state.webPid]) {
      if (pid) {
        try {
          process.kill(-pid, 'SIGTERM')
        } catch {
          /* already gone */
        }
      }
    }
  } catch {
    /* no state — nothing started */
  }
  rmSync(statePath, { force: true })
}
