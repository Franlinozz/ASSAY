import type { Coverage, CoverageStatus, Dossier, Manifest } from '@xyndicate/assay-core'
import { STANDARD_VERSION, buildManifest, canonicalize, sha256Hex } from '@xyndicate/assay-core'

export function assembleManifest(dossier: Dossier): Manifest {
  return buildManifest(dossier)
}

// The machine-readable manifest for agent consumers. No raw PII beyond approved claim text.
export interface AgentManifest {
  dossierId: string
  standardVersion: string
  coverage: Record<CoverageStatus, number>
  approvedClaims: Array<{ id: string; strength: string; text: string }>
  risks: string[]
  integrity: { manifestSha256: string }
}

export function buildAgentManifest(dossier: Dossier, coverage: Coverage[]): AgentManifest {
  const tally: Record<CoverageStatus, number> = { strong: 0, partial: 0, missing: 0, confirm: 0 }
  for (const c of coverage) tally[c.status] += 1
  const approvedClaims = dossier.claims
    .filter((c) => c.status === 'confirmed')
    .map((c) => ({ id: c.id, strength: c.strength, text: c.text }))
  const risks = coverage
    .filter((c) => c.status === 'missing')
    .map((c) => `Missing coverage: ${c.requirementId}`)
  return {
    dossierId: dossier.id,
    standardVersion: STANDARD_VERSION,
    coverage: tally,
    approvedClaims,
    risks,
    integrity: { manifestSha256: sha256Hex(canonicalize(buildManifest(dossier))) },
  }
}
