export const packageName = '@xyndicate/receipts' as const

export interface PackageInfo {
  readonly name: string
  readonly role: string
}

// Scaffold only — implementation lands in a later phase (see AGENTS.md).
export const info: PackageInfo = {
  name: packageName,
  role: 'EIP-712 seals, canonical hashing, salted commitments — no personal data on-chain.',
}
