import type { Store } from './store'
import { toJson } from './util'

// ── Paid delivery: settlement is not delivery ────────────────────────────────
//
// A marketplace buyer's client abandons a purchase at roughly 30 seconds. Assay settles first and
// runs the tool afterwards, so any capability slower than that window used to charge, finish the
// work, cache it — and write the response into a socket nobody was still holding. Measured on
// production 2026-07-31: three purchases (cover letter, story bank, tailored résumé) settled,
// completed, and were never received; their results are still sitting in the orders table. The
// buyer had no way to reach them, because the only recovery key was a payment signature their
// client had already thrown away.
//
// Two rules fix that, and neither of them touches the listing:
//   1. Never hold a paid response past the budget. If the work outruns it, answer immediately with
//      a RECEIPT and keep working; the result lands in the order the moment it is ready.
//   2. Never charge twice for work the buyer never received. A retry of the identical request can
//      collect a completed-but-undelivered order for free.

/**
 * How long a paid call may hold its HTTP response open before handing back a receipt instead.
 * Sits under the ~30s marketplace client timeout with room for settlement (~5s) ahead of it.
 */
export const DEFAULT_PAID_INLINE_BUDGET_MS = 20_000

/** How far back a retry may reach to collect a purchase that was paid for but never delivered. */
export const DEFAULT_RECOVERY_WINDOW_MS = 60 * 60_000

export type PaidOutcome =
  | { kind: 'delivered'; result: unknown }
  | { kind: 'failed'; error: unknown }
  | { kind: 'working' }

/**
 * Run paid work against a response budget. The work always runs to completion and always caches
 * its result — the budget only decides whether the caller waits for it or gets a receipt. A run
 * that throws is deliberately NOT cached, so replaying the same payment proof re-runs it for free.
 */
export function runPaidWork(opts: {
  store: Store
  idempotencyKey: string
  budgetMs: number
  run: () => Promise<unknown>
}): Promise<PaidOutcome> {
  const { store, idempotencyKey, budgetMs } = opts
  const work: Promise<PaidOutcome> = opts.run().then(
    (result): PaidOutcome => {
      store.attachOrderResult(idempotencyKey, toJson(result))
      return { kind: 'delivered', result }
    },
    (error): PaidOutcome => ({ kind: 'failed', error }),
  )
  if (budgetMs <= 0) return work
  return new Promise<PaidOutcome>((resolve) => {
    const timer = setTimeout(() => resolve({ kind: 'working' }), budgetMs)
    // Never let the budget timer be the reason the process stays alive.
    timer.unref?.()
    void work.then((outcome) => {
      clearTimeout(timer)
      // A no-op once the budget already answered — the result is cached either way.
      resolve(outcome)
    })
  })
}

/**
 * The in-band answer when work outruns the budget. It is a 200, not an error: the purchase is
 * good, the work is running, and this says exactly how to collect it at no further cost.
 */
export function receiptBody(opts: {
  tool: string
  receipt: string
  baseUrl: string
}): Record<string, unknown> {
  const { tool, receipt, baseUrl } = opts
  return {
    ok: true,
    status: 'working',
    tool,
    receipt,
    charged: true,
    message:
      `Payment settled and ${tool} is running — it needs a little longer than this response can be held open. ` +
      `Collect the finished result with your receipt ${receipt}; collection is free and you are never charged twice.`,
    collect: {
      url: `${baseUrl}/x402/receipt/${receipt}`,
      tool: 'asy_order_result',
      arguments: { receipt },
      retryAfterMs: 5_000,
    },
  }
}
