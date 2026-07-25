import { build } from 'esbuild'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagesRoot = resolve(root, 'packages')
const tmp = mkdtempSync(join(tmpdir(), 'assay-marketplace-'))

const resolvePlugin = {
  name: 'assay-resolve',
  setup(bundle) {
    bundle.onResolve({ filter: /^@xyndicate\// }, (args) => ({
      path: resolve(packagesRoot, `${args.path.slice('@xyndicate/'.length)}/src/index.ts`),
    }))
  },
}

const invariant = (condition, message) => {
  if (!condition) throw new Error(message)
}

try {
  await build({
    entryPoints: {
      config: resolve(packagesRoot, 'mcp-server/src/config.ts'),
      toolspec: resolve(packagesRoot, 'mcp-server/src/toolspec.ts'),
      web: resolve(root, 'apps/web/lib/standard.generated.ts'),
    },
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

  const config = await import(pathToFileURL(resolve(tmp, 'config.js')).href)
  const toolspec = await import(pathToFileURL(resolve(tmp, 'toolspec.js')).href)
  const web = await import(pathToFileURL(resolve(tmp, 'web.js')).href)
  const docsIndex = readFileSync(resolve(root, 'apps/docs/content/docs/tools/index.mdx'), 'utf8')
  const pricingSource = readFileSync(resolve(root, 'apps/web/app/pricing/page.tsx'), 'utf8')

  const sourceTools = toolspec.toolDocs()
  const names = sourceTools.map((tool) => tool.name)
  invariant(
    JSON.stringify(config.TOOL_NAMES) === JSON.stringify(names),
    'machine manifest tool order differs from toolspec',
  )
  invariant(
    JSON.stringify(Object.keys(config.PRICES)) === JSON.stringify(names),
    'paywall price keys differ from toolspec',
  )
  invariant(
    JSON.stringify(web.TOOL_PRICES) === JSON.stringify(config.PRICES),
    'pricing-page generated prices differ from machine manifest',
  )
  invariant(
    JSON.stringify(web.TOOLS.map((tool) => tool.name)) === JSON.stringify(names),
    'pricing-page generated tools differ from machine manifest',
  )
  invariant(
    pricingSource.includes('TOOLS.map((tool)'),
    'pricing page must render the generated tools collection',
  )

  for (const tool of sourceTools) {
    invariant(
      tool.priceUsdt === config.PRICES[tool.name],
      `${tool.name}: toolspec price differs from paywall`,
    )
    const webTool = web.TOOLS.find((candidate) => candidate.name === tool.name)
    invariant(webTool, `${tool.name}: absent from pricing-page projection`)
    invariant(
      webTool.priceUsdt === tool.priceUsdt &&
        webTool.description === tool.description &&
        webTool.marketplaceSummary === tool.marketplaceSummary,
      `${tool.name}: pricing-page projection is stale`,
    )
    const price = tool.priceUsdt > 0 ? `${tool.priceUsdt.toFixed(2)} USDT` : 'free'
    const docsPage = readFileSync(
      resolve(root, `apps/docs/content/docs/tools/${tool.name}.mdx`),
      'utf8',
    )
    invariant(
      docsIndex.includes(`/docs/tools/${tool.name}`),
      `${tool.name}: absent from docs index`,
    )
    invariant(
      docsPage.includes(`# \`${tool.name}\` — ${tool.title}`) &&
        docsPage.includes(`**Price:** ${price}`) &&
        docsPage.includes(tool.marketplaceSummary),
      `${tool.name}: generated docs page is stale`,
    )
  }

  console.log(
    `[marketplace-consistency] ${sourceTools.length} tools · machine manifest = docs = pricing`,
  )
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
