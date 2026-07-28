import { concatHex, keccak256, type Address, type Hex } from 'viem'
import type { Dossier } from '@xyndicate/assay-core'
import { buildManifest, hashManifest } from '@xyndicate/assay-core'
import { type DossierSeal, signSeal, sealerAddress } from './eip712'

// The salted commitment leaf that gets anchored on-chain. leaf = keccak256(manifestHash || salt).
// The salt is 32 random bytes held ONLY in our store + shown to the user — never on-chain, never
// in the public manifest or verify bundle (guardrail #3).
export function newSalt(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}` as Hex
}

export function commitmentLeaf(manifestHash: Hex, salt: Hex): Hex {
  return keccak256(concatHex([manifestHash, salt]))
}

const EXPLORER = {
  196: 'https://www.oklink.com/x-layer/tx/{tx}',
  1952: 'https://www.oklink.com/x-layer-testnet/tx/{tx}',
} as const

function explorerTemplate(chainId: number): string {
  return EXPLORER[chainId as keyof typeof EXPLORER] ?? 'https://www.oklink.com/x-layer/tx/{tx}'
}

export interface VerifyBundle {
  dossierId: string
  manifestHash: Hex
  leaf: Hex
  standardVersion: string
  issuedAt: string
  chainId: number
  registry: Address
  status: 'signed' | 'unsigned'
  signature?: Hex
  signer?: Address
  explorerLinkTemplate: string
}

export interface BuildBundleOptions {
  chainId: number
  registry: Address
  salt: Hex
  sealerKey?: Hex
}

// Public, salt-free verification bundle. If ASY_SEALER_KEY is absent, the seal is honestly marked
// 'unsigned' (dev mode).
export async function buildVerifyBundle(
  dossier: Dossier,
  opts: BuildBundleOptions,
): Promise<VerifyBundle> {
  const manifest = buildManifest(dossier)
  const manifestHash = hashManifest(manifest).keccak256 as Hex
  const leaf = commitmentLeaf(manifestHash, opts.salt)
  const issuedAt = BigInt(Math.floor(Date.now() / 1000))

  const bundle: VerifyBundle = {
    dossierId: dossier.id,
    manifestHash,
    leaf,
    standardVersion: manifest.standardVersion,
    issuedAt: issuedAt.toString(),
    chainId: opts.chainId,
    registry: opts.registry,
    status: 'unsigned',
    explorerLinkTemplate: explorerTemplate(opts.chainId),
  }

  if (opts.sealerKey) {
    const seal: DossierSeal = {
      manifestHash,
      dossierId: dossier.id,
      standardVersion: manifest.standardVersion,
      issuedAt,
    }
    bundle.signature = await signSeal(opts.sealerKey, opts.chainId, opts.registry, seal)
    bundle.signer = sealerAddress(opts.sealerKey)
    bundle.status = 'signed'
  }
  return bundle
}
