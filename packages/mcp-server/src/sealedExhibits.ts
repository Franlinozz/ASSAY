import type { Address, Hex } from 'viem'

export interface SealedExhibit {
  dossierId: string
  leaf: Hex
  chainId: 196
  registry: Address
}

const MAINNET_REGISTRY = '0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4' as const

// Public demonstration dossiers are generated and sealed outside the mutable production SQLite
// store. This small index lets the free verifier resolve their stable public IDs to the exact
// leaves anchored by the gallery's one mainnet sealBatch.
export const SEALED_EXHIBITS: Readonly<Record<string, SealedExhibit>> = Object.freeze({
  'DSR-WC0Q7NZ7': {
    dossierId: 'DSR-WC0Q7NZ7',
    leaf: '0xf838233e08922df8238f2fea3f22d98bbb1a1f32d08b8dd1b6f17d880ae64b29',
    chainId: 196,
    registry: MAINNET_REGISTRY,
  },
  'DSR-DFGF2A21': {
    dossierId: 'DSR-DFGF2A21',
    leaf: '0x0f9b129c8354f63cba18aa20aa019f43c1178947ade40ddd2feedff1ae831efc',
    chainId: 196,
    registry: MAINNET_REGISTRY,
  },
  'DSR-31MV2EHX': {
    dossierId: 'DSR-31MV2EHX',
    leaf: '0x873a0cb96e1df29cc82e08e0be1bead01be9237c7234b12959cae9d2ba04ac71',
    chainId: 196,
    registry: MAINNET_REGISTRY,
  },
})

export function sealedExhibitFor(
  dossierId: string,
  chainId: number,
  registry: string,
): SealedExhibit | undefined {
  const exhibit = SEALED_EXHIBITS[dossierId]
  if (
    !exhibit ||
    exhibit.chainId !== chainId ||
    exhibit.registry.toLowerCase() !== registry.toLowerCase()
  )
    return undefined
  return exhibit
}
