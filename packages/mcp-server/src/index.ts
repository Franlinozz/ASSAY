export const packageName = '@xyndicate/mcp-server' as const

export interface PackageInfo {
  readonly name: string
  readonly role: string
}

// Scaffold only — implementation lands in a later phase (see AGENTS.md).
export const info: PackageInfo = {
  name: packageName,
  role: 'Stateless /mcp, x402 payment gate, async dossier jobs, better-sqlite3 store.',
}
