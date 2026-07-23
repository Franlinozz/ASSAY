export const packageName = '@xyndicate/tribunal' as const

export interface PackageInfo {
  readonly name: string
  readonly role: string
}

// Scaffold only — implementation lands in a later phase (see AGENTS.md).
export const info: PackageInfo = {
  name: packageName,
  role: 'The Assay Standard: deterministic checks incl. ATS parse-back, Claude critic, bounded repair loop.',
}
