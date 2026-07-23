export const packageName = '@xyndicate/docs' as const

export interface PackageInfo {
  readonly name: string
  readonly role: string
}

// Placeholder workspace. Full Fumadocs (Next-based) documentation site wiring lands in the
// Docs phase — see AGENTS.md Deviations (P0). The workspace exists now so the set stays exact.
export const info: PackageInfo = {
  name: packageName,
  role: 'Fumadocs documentation site (placeholder — full wiring deferred to the Docs phase).',
}
