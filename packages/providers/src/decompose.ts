import type { Requirement } from '@xyndicate/assay-core'
import type { ModelRouter } from './router'
import { DECOMPOSE_SYSTEM, buildDecomposePrompt } from './prompts'
import { sanitizeGap, type Gap } from './gaps'
import { normalizeKeywords } from './text'

export interface DecomposeInput {
  jdText: string
  router: ModelRouter
  dossierId?: string
}

export interface DecomposeResult {
  requirements: Requirement[]
  gaps: Gap[]
}

interface RawRequirement {
  text: string
  kind?: string
  keywords?: string[]
}

export async function decomposeJd(input: DecomposeInput): Promise<DecomposeResult> {
  const res = await input.router.generate(
    { role: 'decomposer', system: DECOMPOSE_SYSTEM, prompt: buildDecomposePrompt(input.jdText), json: true },
    input.dossierId ? { dossierId: input.dossierId } : {},
  )
  if (res.degraded) {
    return { requirements: [], gaps: [sanitizeGap(res.gap ?? 'PROVIDER_ERROR')] }
  }

  const raw = res.json as { requirements?: RawRequirement[] }
  const requirements: Requirement[] = (raw.requirements ?? []).map((r, i) => ({
    id: `REQ-${i + 1}`,
    text: r.text,
    kind: r.kind === 'must' ? 'must' : 'nice',
    keywords: normalizeKeywords(r.keywords && r.keywords.length ? r.keywords : [r.text]),
  }))

  return { requirements, gaps: [] }
}
