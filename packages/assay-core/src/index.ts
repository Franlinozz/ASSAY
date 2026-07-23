export const packageName = '@xyndicate/assay-core' as const

export interface PackageInfo {
  readonly name: string
  readonly role: string
}

// Scaffold only — implementation lands in a later phase (see AGENTS.md).
export const info: PackageInfo = {
  name: packageName,
  role: 'Pure domain heart: schemas, claim gate, strength tiers, canonical manifest, policy.',
}
