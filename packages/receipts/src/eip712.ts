import { recoverTypedDataAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// EIP-712 seal: the sealer signs a typed DossierSeal. Nothing personal is signed — only the
// manifest hash, dossier id, standard version, and issue time.
export const SEAL_DOMAIN_NAME = 'Assay'
export const SEAL_DOMAIN_VERSION = '1'

export const SEAL_TYPES = {
  DossierSeal: [
    { name: 'manifestHash', type: 'bytes32' },
    { name: 'dossierId', type: 'string' },
    { name: 'standardVersion', type: 'string' },
    { name: 'issuedAt', type: 'uint256' },
  ],
} as const

export interface DossierSeal {
  manifestHash: Hex
  dossierId: string
  standardVersion: string
  issuedAt: bigint
}

export function sealDomain(chainId: number, verifyingContract: Address) {
  return { name: SEAL_DOMAIN_NAME, version: SEAL_DOMAIN_VERSION, chainId, verifyingContract } as const
}

export function sealerAddress(sealerKey: Hex): Address {
  return privateKeyToAccount(sealerKey).address
}

export async function signSeal(sealerKey: Hex, chainId: number, registry: Address, seal: DossierSeal): Promise<Hex> {
  const account = privateKeyToAccount(sealerKey)
  return account.signTypedData({
    domain: sealDomain(chainId, registry),
    types: SEAL_TYPES,
    primaryType: 'DossierSeal',
    message: seal,
  })
}

// Recover the signer of a seal.
export async function recoverSealer(chainId: number, registry: Address, seal: DossierSeal, signature: Hex): Promise<Address> {
  return recoverTypedDataAddress({
    domain: sealDomain(chainId, registry),
    types: SEAL_TYPES,
    primaryType: 'DossierSeal',
    message: seal,
    signature,
  })
}

// True iff the signature was produced by `expectedSigner` over exactly this seal.
export async function verifySeal(
  chainId: number,
  registry: Address,
  seal: DossierSeal,
  signature: Hex,
  expectedSigner: Address,
): Promise<boolean> {
  try {
    const recovered = await recoverSealer(chainId, registry, seal, signature)
    return recovered.toLowerCase() === expectedSigner.toLowerCase()
  } catch {
    return false
  }
}
