import { STANDARD_VERSION } from '@xyndicate/assay-core'
import { HARD_CHECKS, checksForArtifact } from './hard/index'
import type { CheckStatus } from './hard/types'

export { STANDARD_VERSION }
export const CRAFT_PASS_MEAN = 72
export const CRAFT_AXIS_FLOOR = 60
export const REPAIR_LIMIT = 2

export interface CraftAxis {
  id: string
  title: string
  weight: number
  description: string
}

// Claude-critic craft axes. Weights emphasize honesty and tailoring — the axes hardest to fake.
export const CRAFT_AXES: CraftAxis[] = [
  {
    id: 'voice',
    title: 'Voice',
    weight: 1,
    description: 'Confident, human, and specific — not generic AI prose.',
  },
  {
    id: 'specificity',
    title: 'Specificity',
    weight: 1.5,
    description: 'Concrete actions, tools, and outcomes rather than vague responsibilities.',
  },
  {
    id: 'quantification',
    title: 'Quantification',
    weight: 1.5,
    description: 'Impact is measured where evidence supports it — never invented.',
  },
  {
    id: 'positioning',
    title: 'Positioning',
    weight: 1,
    description: 'The strongest, most relevant evidence leads.',
  },
  {
    id: 'tailoring',
    title: 'Tailoring',
    weight: 1.5,
    description: 'The artifact answers this specific brief, not a generic role.',
  },
  {
    id: 'evidence_honesty',
    title: 'Evidence honesty',
    weight: 2,
    description: 'Every claim is framed at the strength its evidence earns — no overreach.',
  },
]
export const CRAFT_AXIS_IDS: string[] = CRAFT_AXES.map((a) => a.id)

export interface Verdict {
  pass: boolean
  hardPass: boolean
  craftPass: boolean
  weightedMean: number
}

export function weightedMean(scores: Record<string, number>): number {
  const totalWeight = CRAFT_AXES.reduce((s, a) => s + a.weight, 0)
  const sum = CRAFT_AXES.reduce((s, a) => s + (scores[a.id] ?? 0) * a.weight, 0)
  return sum / totalWeight
}

// The pass rule, exact: ALL hard checks pass AND weighted craft mean >= 72 AND no axis < 60.
// Structured artifacts with no prose (docx, json manifest, coverage tables) are not craft-graded
// — craftApplicable=false means only the hard checks decide.
export function passRule(
  hard: Array<{ status: CheckStatus }>,
  craftScores: Record<string, number>,
  opts: { craftApplicable?: boolean } = {},
): Verdict {
  const hardPass = hard.every((h) => h.status !== 'fail')
  if (opts.craftApplicable === false) {
    return { pass: hardPass, hardPass, craftPass: true, weightedMean: 0 }
  }
  const mean = weightedMean(craftScores)
  const floorOk = CRAFT_AXES.every((a) => (craftScores[a.id] ?? 0) >= CRAFT_AXIS_FLOOR)
  const craftPass = mean >= CRAFT_PASS_MEAN && floorOk
  return {
    pass: hardPass && craftPass,
    hardPass,
    craftPass,
    weightedMean: Math.round(mean * 10) / 10,
  }
}

export interface AssayStandard {
  version: string
  craftPassMean: number
  craftAxisFloor: number
  repairLimit: number
  hardChecks: Array<{ id: string; title: string; description: string }>
  craftAxes: CraftAxis[]
  artifactProfiles: Array<{ kind: string; checks: string[] }>
}

const PROFILE_KINDS = [
  'resume_ats',
  'resume_designed',
  'resume_docx',
  'cover_letter',
  'story_bank',
  'fit_map',
  'gap_brief',
  'portfolio_page',
  'manifest_json',
  'interview_evaluation',
  'promotion_narrative',
  'promotion_memo',
  'manager_one_pager',
  'capability_statement',
  'case_studies',
  'proposal_letter',
]

export const ASSAY_STANDARD: AssayStandard = {
  version: STANDARD_VERSION,
  craftPassMean: CRAFT_PASS_MEAN,
  craftAxisFloor: CRAFT_AXIS_FLOOR,
  repairLimit: REPAIR_LIMIT,
  hardChecks: HARD_CHECKS.map((c) => ({ id: c.id, title: c.title, description: c.description })),
  craftAxes: CRAFT_AXES,
  artifactProfiles: PROFILE_KINDS.map((kind) => ({
    kind,
    checks: checksForArtifact(kind).map((check) => check.id),
  })),
}

// Guardrail #2: the public /standard page and the docs rubric are generated from THIS, the same
// source the grader runs. Never hand-write rubric copy.
export function renderStandardMarkdown(standard: AssayStandard = ASSAY_STANDARD): string {
  const lines: string[] = []
  lines.push(`# The Assay Standard — ${standard.version}`)
  lines.push('')
  lines.push('> The standard does not bend for our own marketing.')
  lines.push('')
  lines.push(
    `An artifact passes only when **every hard check passes**, the craft weighted mean is **≥ ${standard.craftPassMean}**, and **no craft axis is below ${standard.craftAxisFloor}**. Failing drafts are repaired at most **${standard.repairLimit}** times, and every draft's report ships in the dossier.`,
  )
  lines.push('')
  lines.push('## Hard checks (deterministic — any failure blocks or triggers repair)')
  lines.push('')
  for (const c of standard.hardChecks) {
    lines.push(`- **${c.title}** (\`${c.id}\`) — ${c.description}`)
  }
  lines.push('')
  lines.push('## Per-artifact profiles')
  lines.push('')
  lines.push('| Artifact kind | Deterministic checks routed to it |')
  lines.push('|---|---|')
  for (const profile of standard.artifactProfiles) {
    lines.push(`| \`${profile.kind}\` | ${profile.checks.map((id) => `\`${id}\``).join(', ')} |`)
  }
  lines.push('')
  lines.push('## Craft axes (Claude critic, scored 0–100)')
  lines.push('')
  lines.push('| Axis | Weight | What it grades |')
  lines.push('|---|---:|---|')
  for (const a of standard.craftAxes) {
    lines.push(`| ${a.title} | ${a.weight} | ${a.description} |`)
  }
  lines.push('')
  return lines.join('\n')
}

// Artifact kinds whose entire purpose is prose. If one of these renders with zero sentences the
// pipeline produced an empty document — it must never be graded as if it were a structured
// artifact (docx / json / table), which is decided by hard checks alone and would otherwise pass
// vacuously. An empty document is a non-delivery, not a pass.
export const PROSE_ARTIFACT_KINDS = new Set<string>([
  'resume_ats',
  'resume_designed',
  'cover_letter',
  'story_bank',
  'portfolio_page',
  'interview_evaluation',
  'promotion_narrative',
  'promotion_memo',
  'manager_one_pager',
  'capability_statement',
  'case_studies',
  'proposal_letter',
])
