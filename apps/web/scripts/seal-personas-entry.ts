// Persona seal step — anchors the three persona commitment leaves on X Layer mainnet in ONE batch
// (guardrail #3: only salted commitment leaves ever touch the chain; batching keeps gas trivial).
// Reads lib/personas.generated.json + the salts sidecar, sends sealBatch with ASY_SEALER_KEY, then
// writes the tx + explorer link + anchoredAt back into the public JSON so /gallery + /judge + /verify
// show a real, on-chain-confirmable seal. Idempotent: the registry no-ops already-anchored leaves.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RegistryClient } from '@xyndicate/contracts'
import type { Address, Hex } from 'viem'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')

const CHAIN_ID = Number(process.env['ASY_CHAIN_ID'] ?? '196')
const REGISTRY = (process.env['ASY_REGISTRY'] ??
  '0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4') as Address
const RPC = process.env['ASY_RPC_URL'] ?? (CHAIN_ID === 196 ? 'https://rpc.xlayer.tech' : 'https://testrpc.xlayer.tech')
const SEALER = process.env['ASY_SEALER_KEY'] as Hex | undefined

function explorerTx(tx: string): string {
  const net = CHAIN_ID === 196 ? 'x-layer' : 'x-layer-testnet'
  return `https://www.oklink.com/${net}/tx/${tx}`
}

async function main(): Promise<void> {
  if (!SEALER) throw new Error('ASY_SEALER_KEY required to anchor persona seals')
  const jsonPath = resolve(webRoot, 'lib/personas.generated.json')
  const doc = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
    personas: Array<{ slug: string; seal: Record<string, unknown> }>
  }
  const salts = JSON.parse(readFileSync(resolve(webRoot, '.persona-salts.json'), 'utf8')) as Record<
    string,
    { leaf: Hex; salt: Hex }
  >

  const client = new RegistryClient({ rpcUrl: RPC, chainId: CHAIN_ID, registry: REGISTRY, sealerKey: SEALER })

  // Only anchor leaves not already on-chain.
  const toAnchor: Hex[] = []
  for (const p of doc.personas) {
    const leaf = salts[p.slug]?.leaf ?? (p.seal.leaf as Hex)
    const already = await client.anchoredAt(leaf)
    if (already === 0n) toAnchor.push(leaf)
    else console.log(`[seal] ${p.slug} already anchored @ ${already}`)
  }

  let tx: string | null = null
  if (toAnchor.length > 0) {
    console.log(`[seal] anchoring ${toAnchor.length} leaves on chain ${CHAIN_ID}…`)
    tx = await client.sealBatch([...new Set(toAnchor)])
    console.log(`[seal] sealBatch tx ${tx}`)
  } else {
    console.log('[seal] nothing to anchor — all leaves already on-chain')
  }

  // Read back anchoredAt for each and record it.
  for (const p of doc.personas) {
    const leaf = salts[p.slug]?.leaf ?? (p.seal.leaf as Hex)
    const at = await client.anchoredAt(leaf)
    p.seal.status = at > 0n ? 'sealed' : 'pending'
    p.seal.anchoredAt = at > 0n ? Number(at) : null
    if (at > 0n && tx) p.seal.tx = tx
    p.seal.explorerLink = p.seal.tx ? explorerTx(String(p.seal.tx)) : null
    p.seal.registryExplorer = `https://www.oklink.com/${CHAIN_ID === 196 ? 'x-layer' : 'x-layer-testnet'}/address/${REGISTRY}`
  }

  writeFileSync(jsonPath, JSON.stringify(doc, null, 2))
  console.log(`[seal] updated ${jsonPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
