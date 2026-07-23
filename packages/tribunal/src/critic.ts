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
  'You are Assay\'s craft critic. Grade a career artifact against the published Assay Standard craft axes. ' +
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
  ].join('\n\n')
}

function clamp(n: unknown): number {
  const v = typeof n === 'number' ? n : 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

export async function gradeCraft(artifact: Artifact, dossier: Dossier, router: ModelRouter): Promise<CraftGrade> {
  const res = await router.generate(
    { role: 'critic', system: CRITIC_SYSTEM, prompt: buildCriticPrompt(artifact, dossier), json: true },
    { dossierId: dossier.id },
  )
  // On critic degradation we do NOT fabricate a passing grade — a dossier can't pass craft it
  // couldn't grade. Empty axes → weighted mean 0 → craft fails → repair (safe).
  if (res.degraded) {
    return { axes: {}, findings: [{ axis: '*', detail: 'craft critic unavailable' }], repairBrief: '', degraded: true }
  }
  const raw = res.json as { axes?: Record<string, number>; findings?: Array<{ axis: string; detail: string }>; repairBrief?: string }
  const axes: Record<string, number> = {}
  for (const id of CRAFT_AXIS_IDS) axes[id] = clamp(raw.axes?.[id])
  return { axes, findings: raw.findings ?? [], repairBrief: raw.repairBrief ?? '', degraded: false }
}
