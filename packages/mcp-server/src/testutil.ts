import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Request } from 'express'
import { createRouter, createModeFetcher } from '@xyndicate/providers'
import { loadConfig, type ServerConfig } from './config'
import { Store } from './store'
import { DevGate } from './gate'
import type { AppRuntime } from './http'

// Shared test scaffolding: an in-memory store, fake providers (zero spend), a DevGate, and a temp
// files dir. Never touches the network or a paid provider.

export interface TestRig extends AppRuntime {
  cfg: ServerConfig
  dir: string
}

export function testRuntime(env: Record<string, string> = {}): TestRig {
  const dir = mkdtempSync(join(tmpdir(), 'assay-mcp-'))
  const cfg = loadConfig({
    ASY_PAYMENT_MODE: 'dev',
    ASY_DB_PATH: ':memory:',
    ASY_FILES_DIR: join(dir, 'files'),
    ASY_TREASURY: '0x1111111111111111111111111111111111111111',
    ASY_REGISTRY: '0x355c324eed9347ec90d098d6dcde1438e6c89a7f',
    ASY_SIGNING_SECRET: 'test-signing-secret',
    ASY_BASE_URL: 'http://localhost',
    ...env,
  } as NodeJS.ProcessEnv)
  const store = new Store(cfg.dbPath, cfg.filesDir)
  const router = createRouter()
  const fetcher = createModeFetcher()
  const gate = new DevGate(cfg)
  return { store, router, fetcher, cfg, gate, dir }
}

// A minimal express.Request stand-in carrying only the headers a gate reads.
export function fakeReq(headers: Record<string, string> = {}): Request {
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v
  return { header: (n: string) => lower[n.toLowerCase()] } as unknown as Request
}
