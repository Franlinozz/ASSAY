import { spawn } from 'node:child_process'
import { mkdtempSync, openSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// The fake-mode test stack: mcp-server (dev gate, fake providers, temp store) + the built web app
// pointed at it. Used by the visual audit loop and the Playwright e2e suite. Zero spend, no chain
// writes (no sealer key → seals stay honestly 'pending').

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Non-default ports so the fake-mode stack never collides with the live prod services on this box
// (prod MCP :8422, prod web :3100).
export const API_PORT = Number(process.env.STACK_API_PORT ?? 8455)
export const WEB_PORT = Number(process.env.STACK_WEB_PORT ?? 3400)

const SEED_RESUME = `Chidinma Eze
Senior Backend Engineer — Lagos, Nigeria
chidinma.eze@example.com | https://github.com/chidinma

EXPERIENCE
Paystack — Senior Backend Engineer (Mar 2021 – Present), Lagos
- Reduced API p95 latency by 38% by introducing PostgreSQL connection pooling.
- Scaled the payments service to 12000 requests per second during peak sales.

Andela — Backend Engineer (Jun 2018 – Feb 2021)
- Mentored 5 junior engineers and led the migration to TypeScript.

SKILLS
TypeScript, Node.js, PostgreSQL, Redis, Kubernetes`

const SEED_JD = `- PostgreSQL connection pooling and latency tuning experience is required
- Must have scaled a payments service to thousands of requests per second
- Rust systems programming experience is required
- Mentored junior engineers or led a team migration`

function logFd(dir, name) {
  return openSync(join(dir, name), 'a')
}

async function waitFor(url, label, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${label} did not come up at ${url}`)
}

async function rpc(tool, args, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${API_PORT}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }),
  })
  const body = await res.json().catch(() => ({}))
  const text = body?.result?.content?.find((c) => c.type === 'text')?.text ?? ''
  const split = text.indexOf('\n\n')
  return {
    status: res.status,
    summary: split > 0 ? text.slice(0, split) : text,
    data: split > 0 ? JSON.parse(text.slice(split + 2)) : null,
  }
}

export async function seed() {
  const created = await rpc(
    'asy_create_dossier_job',
    { resumeText: SEED_RESUME, filename: 'resume.txt', jd: SEED_JD },
    { 'PAYMENT-SIG': `dev-seed-${Date.now()}` },
  )
  const jobId = created.data?.jobId
  if (!jobId) throw new Error(`seed job not created: ${created.summary}`)
  for (let i = 0; i < 120; i++) {
    const st = await rpc('asy_job_status', { jobId })
    if (st.data?.status === 'done') break
    if (st.data?.status === 'failed') throw new Error(`seed job failed: ${st.data?.error}`)
    await new Promise((r) => setTimeout(r, 500))
  }
  const result = await rpc('asy_job_result', { jobId })
  const dossierId = result.data?.dossierId
  console.log(`[stack] seeded dossier ${dossierId} (job ${jobId})`)
  return { jobId, dossierId, result: result.data }
}

export async function startStack({ webDev = false } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'assay-stack-'))
  const api = spawn(process.execPath, [resolve(repoRoot, 'packages/mcp-server/dist/main.js')], {
    env: {
      ...process.env,
      ASY_PORT: String(API_PORT),
      ASY_DATA_DIR: dataDir,
      ASY_PAYMENT_MODE: 'dev',
      ASY_PROVIDER_MODE: 'fake',
      ASY_BASE_URL: `http://127.0.0.1:${API_PORT}`,
      ASY_REGISTRY: '0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4',
      ASY_CHAIN_ID: '196',
      // Studio e2e: real chromium PDFs (so ATS parse-back runs) + the deterministic repair demo
      // (fails the cover letter's first draft). Both are e2e/prod-only knobs, never in unit tests.
      ASY_STUDIO_REAL_PDF: '1',
      ASY_FAKE_REPAIR_DEMO: '1',
    },
    stdio: ['ignore', logFd(dataDir, 'api.log'), logFd(dataDir, 'api.log')],
    detached: true,
  })
  await waitFor(`http://127.0.0.1:${API_PORT}/health`, 'mcp-server')

  // Spawn next directly (not `npm run start`, whose -p is hardcoded) so WEB_PORT is honored.
  const web = spawn(
    process.execPath,
    [
      resolve(repoRoot, 'node_modules/next/dist/bin/next'),
      'start',
      'apps/web',
      '-p',
      String(WEB_PORT),
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, ASY_API_URL: `http://127.0.0.1:${API_PORT}`, PORT: String(WEB_PORT) },
      stdio: ['ignore', logFd(dataDir, 'web.log'), logFd(dataDir, 'web.log')],
      detached: true,
    },
  )
  await waitFor(`http://127.0.0.1:${WEB_PORT}/`, 'web')

  const stop = () => {
    // Detached process groups: negative pid kills npm AND the servers it spawned.
    for (const child of [api, web]) {
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        /* already gone */
      }
    }
  }
  return { api, web, stop, dataDir }
}

// CLI: boot, seed, stay up.
if (process.argv[1] && process.argv[1].endsWith('stack.mjs')) {
  const { stop } = await startStack()
  const seeded = await seed()
  console.log(`[stack] up — api :${API_PORT}, web :${WEB_PORT}, dossier ${seeded.dossierId}`)
  process.on('SIGINT', () => {
    stop()
    process.exit(0)
  })
}
