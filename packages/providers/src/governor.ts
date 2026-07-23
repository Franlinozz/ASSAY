import type { Usage } from './types'

// Token/cost governor with per-dossier caps (env-tunable). When a cap is reached the router trips
// gracefully into a recorded gap instead of spending more.
export interface GovernorCaps {
  maxCostUsd: number
  maxTokens: number
}

interface Spent {
  costUsd: number
  tokens: number
}

export class Governor {
  private readonly spent = new Map<string, Spent>()

  constructor(private readonly caps: GovernorCaps) {}

  private get(dossierId: string): Spent {
    return this.spent.get(dossierId) ?? { costUsd: 0, tokens: 0 }
  }

  // true = still within budget; false = a cap has been reached.
  check(dossierId = 'default'): boolean {
    const s = this.get(dossierId)
    return s.costUsd < this.caps.maxCostUsd && s.tokens < this.caps.maxTokens
  }

  charge(dossierId: string, usage: Usage): void {
    const s = this.get(dossierId)
    this.spent.set(dossierId, {
      costUsd: s.costUsd + usage.costUsd,
      tokens: s.tokens + usage.inputTokens + usage.outputTokens,
    })
  }

  spentFor(dossierId = 'default'): Spent {
    return { ...this.get(dossierId) }
  }
}

function num(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export function governorFromEnv(): Governor {
  return new Governor({
    maxCostUsd: num('ASY_COST_CAP_USD', 1.5),
    maxTokens: num('ASY_TOKEN_CAP', 400_000),
  })
}
