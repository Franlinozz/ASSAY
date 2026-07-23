export const packageName = '@xyndicate/renderers' as const

export interface PackageInfo {
  readonly name: string
  readonly role: string
}

// Scaffold only — implementation lands in a later phase (see AGENTS.md).
export const info: PackageInfo = {
  name: packageName,
  role: 'Artifact rendering: designed PDF, ATS-safe PDF, .docx, portfolio page, JSON manifest.',
}
