import { spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const packagesRoot = resolve(root, 'packages')
const tmp = mkdtempSync(resolve(tmpdir(), 'assay-judge-'))
let commandIndex = 0
const fail = (message) => {
  throw new Error(`[judged-artifact] ${message}`)
}
const requireText = (body, text, where) => {
  if (!body.includes(text)) fail(`${where} is missing ${JSON.stringify(text)}`)
}
const run = (command, args) =>
  new Promise((resolveRun, reject) => {
    const id = commandIndex++
    const stdoutPath = resolve(tmp, `command-${id}.stdout`)
    const stderrPath = resolve(tmp, `command-${id}.stderr`)
    const stdoutFd = openSync(stdoutPath, 'w')
    const stderrFd = openSync(stderrPath, 'w')
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', stdoutFd, stderrFd] })
    child.on('error', (error) => {
      closeSync(stdoutFd)
      closeSync(stderrFd)
      reject(error)
    })
    child.on('exit', (code) => {
      closeSync(stdoutFd)
      closeSync(stderrFd)
      const stdout = readFileSync(stdoutPath, 'utf8')
      const stderr = readFileSync(stderrPath, 'utf8')
      if (code === 0) resolveRun(stdout)
      else reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stderr}`))
    })
  })

try {
  await build({
    entryPoints: {
      core: resolve(packagesRoot, 'assay-core/src/index.ts'),
      tools: resolve(packagesRoot, 'mcp-server/src/toolspec.ts'),
    },
    outdir: tmp,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    logLevel: 'silent',
    plugins: [
      {
        name: 'assay-resolve',
        setup(bundle) {
          bundle.onResolve({ filter: /^@xyndicate\// }, (args) => ({
            path: resolve(packagesRoot, `${args.path.slice('@xyndicate/'.length)}/src/index.ts`),
          }))
        },
      },
    ],
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    },
  })

  const core = await import(pathToFileURL(resolve(tmp, 'core.js')).href)
  const tools = await import(pathToFileURL(resolve(tmp, 'tools.js')).href)
  const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
  const security = readFileSync(resolve(root, 'SECURITY.md'), 'utf8')
  const quickstartTranscript = readFileSync(resolve(root, 'docs/QUICKSTART-TRANSCRIPT.md'), 'utf8')
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const toolDocs = tools.toolDocs()

  if (packageJson.version !== '1.0.0')
    fail(`package.json version is ${packageJson.version}; expected the v1.0.0 release`)

  for (const heading of [
    '## The problem',
    '## How it works',
    '## Four moats',
    '## MCP tools and prices',
    '## Five-minute quickstart',
    '## Verify it yourself',
    '## What the proofs do—and do not—mean',
    '## Test evidence',
  ])
    requireText(readme, heading, 'README.md')

  requireText(readme, '<img src="assets/architecture.svg" width="100%"', 'README.md')
  if (!existsSync(resolve(root, 'assets/architecture.svg'))) fail('architecture SVG is absent')
  requireText(readme, core.STANDARD_VERSION, 'README.md')
  requireText(readme, 'OKX.AI_agent-%238599', 'README.md')
  requireText(readme, '0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4', 'README.md')
  requireText(readme, 'DSR-WC0Q7NZ7', 'README.md')
  requireText(readme, 'docs/QUICKSTART-TRANSCRIPT.md', 'README.md')
  for (const phrase of [
    'git clone --no-local',
    'npm ci',
    'ATS parse-back fidelity: 100%',
    '"version":"1.0.0"',
    '**PASS.**',
  ])
    requireText(quickstartTranscript, phrase, 'fresh-clone transcript')

  for (const tool of toolDocs) {
    const expectedPrice =
      tool.priceUsdt > 0
        ? `${tool.priceUsdt.toFixed(2)} USDT`
        : tool.name === 'asy_verify'
          ? '**free forever**'
          : 'free'
    const row = readme.split('\n').find((line) => line.startsWith(`| [\`${tool.name}\`]`))
    if (!row) fail(`README tool table is missing ${tool.name}`)
    if (!row.includes(expectedPrice)) fail(`${tool.name} README price is not ${expectedPrice}`)
  }

  const supplied = {
    vitest: Number(process.env.ASSAY_VITEST_COUNT),
    playwright: Number(process.env.ASSAY_PLAYWRIGHT_COUNT),
    foundry: Number(process.env.ASSAY_FOUNDRY_COUNT),
  }
  const hasSuppliedCounts = Object.values(supplied).every(
    (count) => Number.isInteger(count) && count > 0,
  )
  let counts
  if (hasSuppliedCounts) {
    counts = supplied
  } else {
    const vitestList = JSON.parse(
      await run(process.execPath, ['node_modules/vitest/vitest.mjs', 'list', '--json']),
    )
    const playwrightList = await run(process.execPath, [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--list',
    ])
    const playwrightMatch = playwrightList.match(/Total:\s+(\d+)\s+tests?/)
    if (!playwrightMatch) fail('could not count Playwright tests')
    const foundryList = await run('forge', ['test', '--root', 'packages/contracts', '--list'])
    counts = {
      vitest: vitestList.length,
      playwright: Number(playwrightMatch[1]),
      foundry: foundryList.split('\n').filter((line) => /^\s+test_/.test(line)).length,
    }
  }
  const total = counts.vitest + counts.playwright + counts.foundry
  for (const [kind, count] of Object.entries(counts))
    requireText(
      readme,
      `${count} ${kind === 'foundry' ? 'Foundry' : kind === 'vitest' ? 'Vitest' : 'Playwright'}`,
      'README.md',
    )
  requireText(readme, `${total} tests`, 'README.md')
  requireText(readme, `tests-${total}_passing`, 'README.md badge')
  requireText(readme, 'v1.0.0', 'README.md')

  for (const phrase of [
    'SSRF',
    'prompt injection',
    'PII',
    'capability token',
    'archonaudit@gmail.com',
    'does **not** prove',
  ])
    requireText(security, phrase, 'SECURITY.md')

  console.log(
    `[judged-artifact] README facts verified · AS ${core.STANDARD_VERSION} · ${toolDocs.length} tools · ${counts.vitest}+${counts.playwright}+${counts.foundry}=${total} tests`,
  )
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
