import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { REGISTRY_ABI, REGISTRY_BYTECODE } from './artifact'
import { RegistryClient, xlayerChain } from './client'

const PORT = 8545 + Math.floor(Math.random() * 500)
const RPC = `http://127.0.0.1:${PORT}`
const CHAIN_ID = 31337
let anvil: ChildProcess
const keys: Hex[] = []

beforeAll(async () => {
  anvil = spawn('anvil', ['--port', String(PORT), '--chain-id', String(CHAIN_ID)])
  await new Promise<void>((resolve, reject) => {
    let buf = ''
    const timeout = setTimeout(() => reject(new Error('anvil failed to start')), 20000)
    anvil.stdout?.on('data', (d: Buffer) => {
      buf += d.toString()
      if (/Listening on/.test(buf) && keys.length === 0) {
        for (const m of buf.matchAll(/\(\d+\)\s+(0x[0-9a-fA-F]{64})/g)) keys.push(m[1] as Hex)
        if (keys.length >= 2) {
          clearTimeout(timeout)
          resolve()
        }
      }
    })
    anvil.on('error', reject)
  })
}, 30000)

afterAll(() => {
  anvil?.kill('SIGKILL')
})

async function deployRegistry(sealerKey: Hex, sealerAddr: Address): Promise<Address> {
  const account = privateKeyToAccount(sealerKey)
  const chain = xlayerChain(CHAIN_ID, RPC)
  const wallet = createWalletClient({ account, chain, transport: http(RPC) })
  const pub = createPublicClient({ chain, transport: http(RPC) })
  const tx = await wallet.deployContract({
    abi: REGISTRY_ABI,
    bytecode: REGISTRY_BYTECODE,
    args: [sealerAddr],
  })
  const receipt = await pub.waitForTransactionReceipt({ hash: tx })
  if (!receipt.contractAddress) throw new Error('no contract address')
  return receipt.contractAddress
}

describe('RegistryClient against a local anvil node', () => {
  it('deploys, seals a batch, and reads anchoredAt back', async () => {
    const sealerKey = keys[0]
    const sealerAddr = privateKeyToAccount(sealerKey).address
    const registry = await deployRegistry(sealerKey, sealerAddr)
    const client = new RegistryClient({ rpcUrl: RPC, chainId: CHAIN_ID, registry, sealerKey })
    expect((await client.sealer()).toLowerCase()).toBe(sealerAddr.toLowerCase())
    const leaves = [keccak256(toHex('a')), keccak256(toHex('b'))]
    await client.sealBatch(leaves)
    for (const leaf of leaves) expect(await client.anchoredAt(leaf)).toBeGreaterThan(0n)
    expect(await client.anchoredAt(keccak256(toHex('never-sealed')))).toBe(0n)
  }, 30000)

  it('reverts sealBatch from a non-sealer', async () => {
    const sealerAddr = privateKeyToAccount(keys[0]).address
    const registry = await deployRegistry(keys[0], sealerAddr)
    const attacker = new RegistryClient({
      rpcUrl: RPC,
      chainId: CHAIN_ID,
      registry,
      sealerKey: keys[1],
    })
    await expect(attacker.sealBatch([keccak256(toHex('x'))])).rejects.toThrow()
  }, 30000)

  it('is idempotent — a re-seal keeps the original timestamp', async () => {
    const sealerKey = keys[0]
    const registry = await deployRegistry(sealerKey, privateKeyToAccount(sealerKey).address)
    const client = new RegistryClient({ rpcUrl: RPC, chainId: CHAIN_ID, registry, sealerKey })
    const leaf = keccak256(toHex('once'))
    await client.sealBatch([leaf])
    const first = await client.anchoredAt(leaf)
    await client.sealBatch([leaf])
    expect(await client.anchoredAt(leaf)).toBe(first)
  }, 30000)
})
