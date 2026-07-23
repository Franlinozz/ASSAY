// Regenerate src/artifact.ts from the forge-compiled contract. Run: forge build && node scripts/gen-artifact.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const compiled = JSON.parse(readFileSync(fileURLToPath(new URL('../solidity/out/AssayRegistry.sol/AssayRegistry.json', import.meta.url))))
const out = [
  '// Auto-generated from solidity/src/AssayRegistry.sol via forge. Do not edit by hand.',
  '// Regenerate: forge build && node scripts/gen-artifact.mjs',
  "import type { Hex } from 'viem'",
  '',
  `export const REGISTRY_ABI = ${JSON.stringify(compiled.abi)} as const`,
  '',
  `export const REGISTRY_BYTECODE = '${compiled.bytecode.object}' as Hex`,
  '',
].join('\n')
writeFileSync(fileURLToPath(new URL('../src/artifact.ts', import.meta.url)), out)
console.log('wrote src/artifact.ts')
