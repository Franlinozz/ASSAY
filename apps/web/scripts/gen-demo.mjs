import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Bundles gen-demo-entry.ts from package SOURCE (same strategy as mcp-server/scripts/bundle.mjs)
// and runs it. Deliberate content step — NOT part of predev/prebuild (it launches chromium).
//   ASY_PROVIDER_MODE=fake node scripts/gen-demo.mjs   → deterministic, zero-spend
//   ASY_PROVIDER_MODE=live node scripts/gen-demo.mjs   → the one real run at phase end

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

const tmp = resolve(webRoot, '.demo-gen')
mkdirSync(tmp, { recursive: true })

await build({
  entryPoints: { demo: resolve(here, 'gen-demo-entry.ts') },
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

const out = resolve(webRoot, 'lib/demo-run.generated.json')
const r = spawnSync(process.execPath, [resolve(tmp, 'demo.js'), out], {
  stdio: 'inherit',
  env: process.env,
})
rmSync(tmp, { recursive: true, force: true })
process.exit(r.status ?? 1)
