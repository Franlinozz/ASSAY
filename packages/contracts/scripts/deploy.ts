import { createPublicClient, createWalletClient, http, keccak256, toHex, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { REGISTRY_ABI, REGISTRY_BYTECODE } from '../src/artifact'
import { RegistryClient, XLAYER_MAINNET, XLAYER_TESTNET, xlayerChain } from '../src/client'

// Deploy AssayRegistry to X Layer testnet (1952) or mainnet (196), then rehearse: seal 3 fixture
// leaves and read anchoredAt back. The deployer key comes from ASY_DEPLOYER_PK (never committed).
async function main(): Promise<void> {
  const net = process.argv[2] ?? process.env['ASY_NET'] ?? 'testnet'
  const cfg = net === 'mainnet' ? XLAYER_MAINNET : XLAYER_TESTNET
  const pk = process.env['ASY_DEPLOYER_PK']
  if (!pk) throw new Error('set ASY_DEPLOYER_PK (never commit it)')

  const account = privateKeyToAccount(pk as Hex)
  const sealer = (process.env['ASY_SEALER_ADDRESS'] ?? account.address) as `0x${string}`
  const chain = xlayerChain(cfg.chainId, cfg.rpcUrl)
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) })
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) })

  console.error(`[deploy] net=${net} chainId=${cfg.chainId} deployer=${account.address} sealer=${sealer}`)
  const deployTx = await wallet.deployContract({ abi: REGISTRY_ABI, bytecode: REGISTRY_BYTECODE, args: [sealer] })
  const receipt = await pub.waitForTransactionReceipt({ hash: deployTx })
  const address = receipt.contractAddress
  if (!address) throw new Error('no contract address in receipt')
  console.error(`[deploy] AssayRegistry @ ${address}`)

  const client = new RegistryClient({ rpcUrl: cfg.rpcUrl, chainId: cfg.chainId, registry: address, sealerKey: pk as Hex })
  const leaves = [
    keccak256(toHex('assay-fixture-1')),
    keccak256(toHex('assay-fixture-2')),
    keccak256(toHex('assay-fixture-3')),
  ]
  const sealTx = await client.sealBatch(leaves)
  const anchored: Array<{ leaf: Hex; anchoredAt: string }> = []
  for (const leaf of leaves) anchored.push({ leaf, anchoredAt: (await client.anchoredAt(leaf)).toString() })

  console.log(JSON.stringify({ net, chainId: cfg.chainId, address, deployTx, sealTx, sealer, anchored }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
