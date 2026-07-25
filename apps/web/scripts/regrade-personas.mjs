import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const packagesRoot = resolve(webRoot, '../../packages')
const tmp = resolve(webRoot, '.persona-regrade')

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

mkdirSync(tmp, { recursive: true })
await build({
  entryPoints: { regrade: resolve(here, 'regrade-personas-entry.ts') },
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
const target = resolve(webRoot, 'lib/personas.generated.json')
const result = spawnSync(process.execPath, [resolve(tmp, 'regrade.js'), target], {
  stdio: 'inherit',
})
rmSync(tmp, { recursive: true, force: true })
process.exit(result.status ?? 1)
