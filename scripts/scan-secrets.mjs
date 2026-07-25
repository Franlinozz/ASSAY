import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const excluded = new Set(['.git', 'node_modules', '.next', 'dist', 'data', 'playwright-report'])
const rules = [
  ['openai-key', /sk-proj-[A-Za-z0-9_-]{20,}/g],
  ['anthropic-key', /sk-ant-api\d+-[A-Za-z0-9_-]{20,}/g],
  ['deepseek-key', /sk-[0-9a-f]{24,}/gi],
  ['private-key-env', /(?:PRIVATE_KEY|SEALER_KEY|DEPLOYER_KEY)\s*=\s*0x[0-9a-f]{64}/gi],
  ['api-secret-env', /(?:SECRET_KEY|API_SECRET)\s*=\s*[0-9A-F]{32,}/g],
]
const findings = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (excluded.has(name)) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path)
    else if (stat.isFile() && stat.size <= 2_000_000) {
      let text
      try {
        text = readFileSync(path, 'utf8')
      } catch {
        continue
      }
      for (const [rule, regex] of rules) {
        regex.lastIndex = 0
        if (regex.test(text)) findings.push({ scope: 'worktree', path: relative(root, path), rule })
      }
    }
  }
}
walk(root)

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  } catch (error) {
    if (error.status === 0 && typeof error.stdout === 'string') return error.stdout
    throw error
  }
}

const commits = git(['rev-list', '--all']).trim().split('\n').filter(Boolean)
const grepPattern = [
  'sk-proj-[A-Za-z0-9_-]{20,}',
  'sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}',
  'sk-[0-9a-fA-F]{24,}',
  '(PRIVATE_KEY|SEALER_KEY|DEPLOYER_KEY)[[:space:]]*=[[:space:]]*0x[0-9a-fA-F]{64}',
  '(SECRET_KEY|API_SECRET)[[:space:]]*=[[:space:]]*[0-9A-F]{32,}',
].join('|')
for (let i = 0; i < commits.length; i += 40) {
  try {
    const output = git([
      'grep',
      '-I',
      '-l',
      '-E',
      grepPattern,
      ...commits.slice(i, i + 40),
      '--',
      '.',
    ])
    for (const location of output.trim().split('\n').filter(Boolean))
      findings.push({ scope: 'history', location })
  } catch (error) {
    if (error.status !== 1) throw error
  }
}

const unique = [...new Map(findings.map((finding) => [JSON.stringify(finding), finding])).values()]
console.log(JSON.stringify({ ok: unique.length === 0, findings: unique }, null, 2))
if (unique.length > 0) process.exitCode = 1
