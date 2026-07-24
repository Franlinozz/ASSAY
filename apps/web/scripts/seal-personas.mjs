import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Anchors the persona commitment leaves on X Layer mainnet. Deliberate on-chain spend step — run once
// per persona set, AFTER gen-personas.mjs. Reads ASY_SEALER_KEY / ASY_REGISTRY / ASY_CHAIN_ID from env
// (source /etc/assay/env on the VPS).

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const packagesRoot = resolve(webRoot, '../../packages')

const resolvePlugin = {
  name: 'assay-resolve',
  setup(b) {
    b.onResolve({ filter: /^@xyndicate\// }, (args) => ({
      path: resolve(packagesRoot, `${args.path.slice('@xyndicate/'.length)}/src/index.ts`),
    }))
    b.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point') return null
      if (args.path.startsWith('.') || args.path.startsWith('/')) return null
      return { path: args.path, external: true }
    })
  },
}

const tmp = resolve(webRoot, '.seal-gen')
mkdirSync(tmp, { recursive: true })

await build({
  entryPoints: { seal: resolve(here, 'seal-personas-entry.ts') },
  outdir: tmp,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'silent',
  plugins: [resolvePlugin],
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
})

const r = spawnSync(process.execPath, [resolve(tmp, 'seal.js')], { stdio: 'inherit', env: process.env })
rmSync(tmp, { recursive: true, force: true })
process.exit(r.status ?? 1)
