export const packageName = '@xyndicate/providers' as const

export interface PackageInfo {
  readonly name: string
  readonly role: string
}

// Scaffold only — implementation lands in a later phase (see AGENTS.md).
export const info: PackageInfo = {
  name: packageName,
  role: 'Model router: Claude critic+writer, DeepSeek extraction/classification, deterministic math; fake mode default.',
}
