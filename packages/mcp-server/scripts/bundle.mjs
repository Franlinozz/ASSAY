import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Runnable-dist strategy (finalized at P6 per AGENTS.md P2 deviation): the workspace's `tsc` emit
// nests cross-package `paths→src` output, so sibling `dist/index.js` pointers dangle. Rather than
// depend on that, we bundle mcp-server FROM SOURCE into one self-contained ESM file and externalize
// every real npm dependency (express, better-sqlite3, the MCP + x402 SDKs, viem, pdfjs, playwright…),
// which are resolved from node_modules at runtime. `node dist/main.js` then Just Works.

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(here, '..')
const packagesRoot = resolve(pkgRoot, '..')

// Resolve @xyndicate/<pkg> to its TS source; externalize everything else that is a bare specifier.
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

await build({
  entryPoints: {
    main: resolve(pkgRoot, 'src/main.ts'),
    index: resolve(pkgRoot, 'src/index.ts'),
  },
  outdir: resolve(pkgRoot, 'dist'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  plugins: [resolvePlugin],
  // ESM interop for the CJS deps we externalize (better-sqlite3, express).
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
})

console.log('[assay-mcp] bundled dist/main.js + dist/index.js')
