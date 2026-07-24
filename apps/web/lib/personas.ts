// Typed access to the generated persona runs (lib/personas.generated.json). Every field here is REAL
// pipeline output on a clearly-labeled fictional persona (guardrail #7). The /gallery, /gallery/[slug],
// and /judge pages render only from this data.
import raw from './personas.generated.json'
import type { Tier } from './site'

export interface PersonaNumericFact {
  value: number
  unit?: string
  context: string
}
export interface PersonaClaim {
  id: string
  text: string
  strength: Tier
  status: 'confirmed' | 'needs_confirmation' | 'extracted' | 'rejected'
  numericFacts: PersonaNumericFact[]
  evidenceIds: string[]
  tierExplanation: string
  question?: string
}
export interface PersonaEvidence {
  id: string
  kind: 'document' | 'link' | 'attestation'
  label: string
  sourceRef?: string
  fetchedOk?: boolean
  url?: string
}
export interface PersonaCoverage {
  requirement: string
  kind: 'must' | 'nice'
  status: 'strong' | 'partial' | 'confirm' | 'missing'
  note: string
  claimIds: string[]
}
export interface PersonaReport {
  artifactId: string
  artifactKind: string
  draftIndex: number
  pass: boolean
  hardPass: boolean
  craftPass: boolean
  craftWeightedMean: number
  craft: Array<{ axis: string; score: number }>
  hard: Array<{
    id: string
    title: string
    status: string
    findings: Array<{ code: string; detail: string }>
  }>
  repairBrief?: string
  standardVersion: string
}
export interface PersonaSeal {
  manifestHash: string
  leaf: string
  chainId: number
  registry: string
  standardVersion: string
  status: 'pending' | 'sealed'
  tx: string | null
  anchoredAt: number | null
  explorerLink: string | null
  registryExplorer?: string
}
export interface Persona {
  slug: string
  name: string
  headline: string
  location: string
  caseType: string
  blurb: string
  jd: string
  dossierId: string
  profile: {
    fullName: string
    email: string
    headline: string
    skills: string[]
    experiences: Array<{ org: string; title: string; startYm: string; endYm: string | null }>
  }
  claims: PersonaClaim[]
  evidence: PersonaEvidence[]
  coverage: PersonaCoverage[]
  questions: string[]
  sentences: Record<string, Array<{ text: string; claimIds: string[] }>>
  tribunal: {
    rollup: {
      reports: number
      artifacts: number
      firstDraftPassed: number
      finalPassed: number
      postRepairPassRate?: number
    }
    reports: PersonaReport[]
  }
  parseBack: {
    fidelityPct: number
    fieldDiffs: Array<{ field: string; expected: string; got: string }>
    fieldsChecked: number
    parsed: { name: string; email: string; experiences: Array<{ org?: string; title?: string; startYm?: string; endYm?: string }> }
    label: string
  } | null
  seal: PersonaSeal
}

export interface PersonasDoc {
  meta: { providerMode: string; generatedAt: string; note: string }
  personas: Persona[]
}

const doc = raw as unknown as PersonasDoc

export const PERSONAS_META = doc.meta
export const PERSONAS: Persona[] = doc.personas

// The featured persona is the career-ladder case: it exercises the whole pipeline best — mixed
// evidence tiers, one ambiguity question, and a real FAIL→repair→PASS arc — and is the one the
// /judge tour walks through. The others are listed beneath (no duplicates).
export const FEATURED_SLUG = 'adaeze-okonkwo'

export function featuredPersona(): Persona {
  return PERSONAS.find((p) => p.slug === FEATURED_SLUG) ?? PERSONAS[0]
}
export function otherPersonas(): Persona[] {
  return PERSONAS.filter((p) => p.slug !== featuredPersona().slug)
}
export function personaBySlug(slug: string): Persona | undefined {
  return PERSONAS.find((p) => p.slug === slug)
}
export function personaTiers(p: Persona): Tier[] {
  return [...new Set(p.claims.filter((c) => c.status === 'confirmed').map((c) => c.strength))] as Tier[]
}
