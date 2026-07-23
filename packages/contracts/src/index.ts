export const packageName = '@xyndicate/contracts' as const

export interface PackageInfo {
  readonly name: string
  readonly role: string
}

// Scaffold only — implementation lands in a later phase (see AGENTS.md).
export const info: PackageInfo = {
  name: packageName,
  role: 'AssayRegistry.sol — testnet 195 rehearsal, mainnet 196 anchor.',
}
