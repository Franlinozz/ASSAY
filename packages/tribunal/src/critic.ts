import type { Artifact, Dossier } from '@xyndicate/assay-core'
import type { ModelRouter } from '@xyndicate/providers'
import { CRAFT_AXES, CRAFT_AXIS_IDS } from './standard'

export interface CraftGrade {
  axes: Record<string, number>
  findings: Array<{ axis: string; detail: string }>
  repairBrief: string
  degraded: boolean
}

export const CRITIC_SYSTEM =
  "You are Assay's craft critic. Grade a career artifact against the published Assay Standard craft axes. " +
  'You judge craft only — never invent facts, and never reward unsupported claims. Output strict JSON only.'

export function buildCriticPrompt(artifact: Artifact, dossier: Dossier): string {
  const sentences = (artifact.sentences ?? []).map((s) => s.text).join('\n')
  const axes = CRAFT_AXES.map((a) => `- ${a.id}: ${a.description}`).join('\n')
  const brief = dossier.brief ? dossier.brief.jdText : '(no target brief)'
  return [
    `Artifact kind: ${artifact.kind}`,
    `Target brief:\n${brief}`,
    `Artifact text:\n${sentences}`,
    `Grade each axis 0-100:\n${axes}`,
    'Return JSON: {"axes":{"voice":n,...},"findings":[{"axis":string,"detail":string}],"repairBrief":string}.',
    'repairBrief must be a concrete instruction for anything scoring below 72.',
    // Latency is a correctness concern here, not a nicety: the craft critic measured 18-23s of a
    // 21-26s paid call on 2026-07-31, which is what pushed three services past the buyer's ~30s
    // patience. Nearly all of that is generated prose. Findings earn their place by being
    // actionable, not long — bounding them costs nothing a writer could have used.
    'Be terse. Emit findings ONLY for axes below 72, at most three, each under 25 words. ' +
      'Keep repairBrief under 60 words. Do not restate the artifact, explain your scores, or add commentary.',
  ].join('\n\n')
}

function clamp(n: unknown): number {
  const v = typeof n === 'number' ? n : 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

export async function gradeCraft(
  artifact: Artifact,
  dossier: Dossier,
  router: ModelRouter,
): Promise<CraftGrade> {
  const res = await router.generate(
    {
      role: 'critic',
      system: CRITIC_SYSTEM,
      prompt: buildCriticPrompt(artifact, dossier),
      json: true,
      // A grade plus three short findings does not need 2048 tokens, and the ceiling is what the
      // model paces itself against.
      maxTokens: 700,
    },
    { dossierId: dossier.id },
  )
  // On critic degradation we do NOT fabricate a passing grade — a dossier can't pass craft it
  // couldn't grade. Empty axes → weighted mean 0 → craft fails → repair (safe).
  if (res.degraded) {
    return {
      axes: {},
      findings: [{ axis: '*', detail: 'craft critic unavailable' }],
      repairBrief: '',
      degraded: true,
    }
  }
  const raw = res.json as {
    axes?: Record<string, number>
    findings?: unknown[]
    repairBrief?: string
  }
  const axes: Record<string, number> = {}
  for (const id of CRAFT_AXIS_IDS) axes[id] = clamp(raw.axes?.[id])
  // Live critics sometimes emit findings as bare strings or partial objects — coerce to the
  // {axis, detail} shape and drop anything empty (no "[craft:undefined] undefined" in briefs).
  const findings = (raw.findings ?? [])
    .map((f): { axis: string; detail: string } | null => {
      if (typeof f === 'string' && f.trim()) return { axis: '*', detail: f.trim() }
      if (f && typeof f === 'object') {
        const o = f as { axis?: unknown; detail?: unknown; text?: unknown }
        const detail =
          typeof o.detail === 'string' && o.detail.trim()
            ? o.detail.trim()
            : typeof o.text === 'string' && o.text.trim()
              ? o.text.trim()
              : ''
        if (detail) return { axis: typeof o.axis === 'string' && o.axis ? o.axis : '*', detail }
      }
      return null
    })
    .filter((f): f is { axis: string; detail: string } => f !== null)
  return { axes, findings, repairBrief: raw.repairBrief ?? '', degraded: false }
}
