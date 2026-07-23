import type { Artifact, Dossier } from '@xyndicate/assay-core'
import type { Fetcher } from '@xyndicate/providers'

export type CheckStatus = 'pass' | 'fail' | 'pending' | 'skip'
export type Severity = 'error' | 'warn'

export interface CheckFinding {
  code: string
  detail: string
  ref?: string
  severity?: Severity // default 'error'
}

export interface CheckResult {
  status: CheckStatus
  findings: CheckFinding[]
  evidence?: string
}

export interface ParseBackResult {
  fidelityPct: number
  fieldDiffs: Array<{ field: string; expected: string; got: string }>
}

// Injected capabilities the deterministic checks need. All optional so checks degrade to 'skip'
// or 'pending' when a capability is not wired yet (e.g. parseBack lands in P4).
export interface CheckDeps {
  fetcher?: Fetcher
  fileExists?: (ref: string) => boolean
  readDocx?: (ref: string) => Promise<{ text: string; headings: string[] }>
  parseBack?: (artifact: Artifact, dossier: Dossier) => Promise<ParseBackResult>
}

export interface CheckContext {
  dossier: Dossier
  artifact: Artifact
  deps: CheckDeps
}

export interface HardCheck {
  id: string
  title: string
  description: string
  run(ctx: CheckContext): Promise<CheckResult> | CheckResult
}

// A hard check fails iff it has at least one error-severity finding.
export function statusFromFindings(findings: CheckFinding[]): CheckStatus {
  return findings.some((f) => (f.severity ?? 'error') === 'error') ? 'fail' : 'pass'
}

export function htmlOf(a: Artifact): string {
  return typeof a.meta['html'] === 'string' ? (a.meta['html'] as string) : ''
}

export function artifactText(a: Artifact): string {
  const sentences = a.sentences?.map((s) => s.text).join('\n') ?? ''
  return `${sentences}\n${htmlOf(a)}`.trim()
}
