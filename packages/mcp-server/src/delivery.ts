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
 * How long a paid call may hold its HTTP response open before answering with what it has.
 *
 * Calibrated against production, not guessed. Two different clients are visible in the capability
 * log, and they have very different patience:
 *   • a direct caller (curl, a script) waits a long time — 28s, 36s, 37s and one 132s dossier all
 *     delivered successfully on 2026-07-27;
 *   • the OKX marketplace buyer client gives up at about 30 SECONDS — on 2026-07-31 it collected
 *     calls of 3.3s, 3.7s, 4.7s and 13.2s, and abandoned three calls that ran 26-31s including
 *     settlement.
 *
 * Settlement runs ahead of the work and costs ~5s of that window, so the budget is what is left
 * over minus a real margin: 15s of work answers by ~20s, a full 10s inside the observed hangup.
 * A budget set close to the wire is worthless — a receipt that arrives after the client has gone
 * is exactly as lost as the result it replaced.
 */
export const DEFAULT_PAID_INLINE_BUDGET_MS = 15_000

/** How far back a retry may reach to collect a purchase that was paid for but never delivered. */
export const DEFAULT_RECOVERY_WINDOW_MS = 60 * 60_000

export type PaidOutcome =
  { kind: 'delivered'; result: unknown } | { kind: 'failed'; error: unknown } | { kind: 'working' }

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
  /** Whatever the capability had finished producing when the budget ran out. */
  partial?: unknown
}): Record<string, unknown> {
  const { tool, receipt, baseUrl, partial } = opts
  return {
    ok: true,
    // A response carrying the deliverable is a delivery, even though a slower part is still
    // running. Saying "working" over the top of real output understates what the buyer has.
    status: partial ? 'partial' : 'working',
    tool,
    receipt,
    charged: true,
    ...(partial ? { result: partial } : {}),
    message: partial
      ? `Payment settled. The deliverable is in this response; one slower step (the tribunal grade) is still running. ` +
        `Collect the completed version with your receipt ${receipt} — collection is free and you are never charged twice.`
      : `Payment settled and ${tool} is running — it needs a little longer than this response can be held open. ` +
        `Collect the finished result with your receipt ${receipt}; collection is free and you are never charged twice.`,
    collect: {
      url: `${baseUrl}/x402/receipt/${receipt}`,
      tool: 'asy_order_result',
      arguments: { receipt },
      retryAfterMs: 5_000,
    },
  }
}
