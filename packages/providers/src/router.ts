import type {
  GenerateRequest,
  GenerateResult,
  ModelAdapter,
  ProviderName,
  Role,
  Usage,
} from './types'
import { Governor } from './governor'
import { repairJsonPrompt } from './prompts'
import type { GapCode } from './gaps'

// Role → provider preference. extractor/decomposer/utility favour DeepSeek; writer/critic favour
// Claude. OpenAI is the universal fallback. Only adapters actually present are used.
const PREFERENCE: Record<Role, ProviderName[]> = {
  extractor: ['deepseek', 'openai', 'claude'],
  decomposer: ['deepseek', 'openai', 'claude'],
  utility: ['deepseek', 'openai', 'claude'],
  writer: ['claude', 'openai', 'deepseek'],
  critic: ['claude', 'openai', 'deepseek'],
}

const DEFAULT_TIMEOUTS: Record<Role, number> = {
  extractor: 45_000,
  decomposer: 30_000,
  writer: 60_000,
  critic: 45_000,
  utility: 20_000,
}

export interface RouterOptions {
  timeoutMs?: Partial<Record<Role, number>>
  governor?: Governor
}

export interface GenerateContext {
  dossierId?: string
}

class TimeoutError extends Error {
  constructor() {
    super('provider timeout')
    this.name = 'TimeoutError'
  }
}

function stripFences(text: string): string {
  const t = text.trim()
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return (fenced ? fenced[1] : t).trim()
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(stripFences(text)) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController()
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      ctrl.abort()
      reject(new TimeoutError())
    }, ms)
    fn(ctrl.signal).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

function fullUsage(u?: Partial<Usage>): Usage {
  return {
    inputTokens: u?.inputTokens ?? 0,
    outputTokens: u?.outputTokens ?? 0,
    costUsd: u?.costUsd ?? 0,
  }
}

function classifyError(e: unknown): GapCode {
  if (e instanceof TimeoutError) return 'PROVIDER_TIMEOUT'
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
  if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('429'))
    return 'PROVIDER_QUOTA'
  return 'PROVIDER_ERROR'
}

export class ModelRouter {
  constructor(
    private readonly adapters: ModelAdapter[],
    private readonly opts: RouterOptions = {},
  ) {}

  private chain(role: Role): ModelAdapter[] {
    const order = PREFERENCE[role]
    const present = this.adapters.filter((a) => a.supports(role))
    const ranked = [...present].sort((a, b) => rank(order, a.name) - rank(order, b.name))
    return ranked.length > 0 ? ranked : present
  }

  async generate(req: GenerateRequest, ctx: GenerateContext = {}): Promise<GenerateResult> {
    const dossierId = ctx.dossierId ?? 'default'
    const timeout = this.opts.timeoutMs?.[req.role] ?? DEFAULT_TIMEOUTS[req.role]
    const governor = this.opts.governor

    if (governor && !governor.check(dossierId)) {
      return degraded(req.role, 'COST_CAP')
    }

    const chain = this.chain(req.role)
    let lastGap: GapCode = 'PROVIDER_ERROR'

    for (const adapter of chain) {
      try {
        let raw = await withTimeout((signal) => adapter.generate(req, signal), timeout)

        if (req.json) {
          let parsed = tryParse(raw.text)
          if (!parsed.ok) {
            // One repair retry against the SAME adapter, re-prompting with the parse error.
            const repaired = { ...req, prompt: repairJsonPrompt(req.prompt, parsed.error) }
            raw = await withTimeout((signal) => adapter.generate(repaired, signal), timeout)
            parsed = tryParse(raw.text)
          }
          if (!parsed.ok) {
            lastGap = 'PROVIDER_BADJSON'
            continue // give the fallback adapter a chance
          }
          const usage = fullUsage(raw.usage)
          governor?.charge(dossierId, usage)
          return {
            text: raw.text,
            json: parsed.value,
            provider: adapter.name,
            role: req.role,
            usage,
            degraded: false,
          }
        }

        const usage = fullUsage(raw.usage)
        governor?.charge(dossierId, usage)
        return { text: raw.text, provider: adapter.name, role: req.role, usage, degraded: false }
      } catch (e) {
        lastGap = classifyError(e)
        continue
      }
    }

    return degraded(req.role, lastGap)
  }
}

function rank(order: ProviderName[], name: ProviderName): number {
  const i = order.indexOf(name)
  return i === -1 ? order.length : i
}

function degraded(role: Role, gap: GapCode): GenerateResult {
  return {
    text: '',
    provider: 'fake',
    role,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    degraded: true,
    gap,
  }
}
