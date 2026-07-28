import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { REGISTRY_ABI } from './artifact'

export const XLAYER_MAINNET = { chainId: 196, rpcUrl: 'https://rpc.xlayer.tech' } as const
// NOTE: X Layer testnet chainId is 1952 (NOT 195 as some docs state) — verified against the RPC.
export const XLAYER_TESTNET = { chainId: 1952, rpcUrl: 'https://testrpc.xlayer.tech' } as const

export function xlayerChain(chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: chainId === 196 ? 'X Layer' : 'X Layer Testnet',
    nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  }
}

export interface RegistryClientOptions {
  rpcUrl: string
  chainId: number
  registry: Address
  sealerKey?: Hex
}

export class RegistryClient {
  private readonly pub: ReturnType<typeof createPublicClient>
  private readonly wallet: ReturnType<typeof createWalletClient> | undefined
  private readonly account: ReturnType<typeof privateKeyToAccount> | undefined

  constructor(private readonly opts: RegistryClientOptions) {
    const chain = xlayerChain(opts.chainId, opts.rpcUrl)
    this.pub = createPublicClient({ chain, transport: http(opts.rpcUrl) })
    if (opts.sealerKey) {
      this.account = privateKeyToAccount(opts.sealerKey)
      this.wallet = createWalletClient({
        account: this.account,
        chain,
        transport: http(opts.rpcUrl),
      })
    }
  }

  async anchoredAt(leaf: Hex): Promise<bigint> {
    return (await this.pub.readContract({
      address: this.opts.registry,
      abi: REGISTRY_ABI,
      functionName: 'anchoredAt',
      args: [leaf],
    })) as bigint
  }

  async sealer(): Promise<Address> {
    return (await this.pub.readContract({
      address: this.opts.registry,
      abi: REGISTRY_ABI,
      functionName: 'sealer',
    })) as Address
  }

  async sealBatch(leaves: Hex[]): Promise<Hex> {
    if (!this.wallet || !this.account) throw new Error('sealBatch requires a sealer key')
    const hash = await this.wallet.writeContract({
      account: this.account,
      chain: xlayerChain(this.opts.chainId, this.opts.rpcUrl),
      address: this.opts.registry,
      abi: REGISTRY_ABI,
      functionName: 'sealBatch',
      args: [leaves],
    })
    await this.pub.waitForTransactionReceipt({ hash })
    return hash
  }
}
