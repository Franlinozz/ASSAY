import { RegistryClient } from '@xyndicate/contracts'
import type { Address, Hex } from 'viem'
import type { ServerConfig } from './config'
import { parseVersionRef, type Store } from './store'

// The anchor worker drains seals_pending → RegistryClient.sealBatch on an interval. It NEVER crashes
// the server: every failure is recorded as a seal attempt and retried next tick. Batch anchoring
// keeps gas trivial (guardrail #3 — only salted commitment leaves ever touch the chain).

const MAX_BATCH = 50

function rpcFor(chainId: number): string {
  return chainId === 196 ? 'https://rpc.xlayer.tech' : 'https://testrpc.xlayer.tech'
}

export interface DrainResult {
  sealed: number
  skipped?: boolean
  tx?: string
  error?: string
}

export class AnchorWorker {
  private timer: ReturnType<typeof setInterval> | undefined
  private draining = false

  constructor(
    private readonly store: Store,
    private readonly cfg: ServerConfig,
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.drainOnce(), this.cfg.anchorIntervalMs)
    if (typeof this.timer.unref === 'function') this.timer.unref()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  async drainOnce(): Promise<DrainResult> {
    if (this.draining) return { sealed: 0 }
    this.draining = true
    try {
      const pending = this.store.listPendingSeals()
      if (pending.length === 0) return { sealed: 0 }
      if (!this.cfg.sealerKey) {
        // Dev/no-key: leaves stay queued (honestly 'pending') until a sealer key is present.
        return { sealed: 0, skipped: true }
      }

      const batch = pending.slice(0, MAX_BATCH)
      const client = new RegistryClient({
        rpcUrl: rpcFor(this.cfg.chainId),
        chainId: this.cfg.chainId,
        registry: this.cfg.registry as Address,
        sealerKey: this.cfg.sealerKey as Hex,
      })
      const leaves = [...new Set(batch.map((p) => p.leaf))] as Hex[]
      try {
        const tx = await client.sealBatch(leaves)
        for (const p of batch) {
          this.store.setSealStatus(p.dossierId, 'sealed')
          this.store.removeSeal(p.dossierId)
          this.store.recordEvent(
            'anchored',
            { tx, leaf: p.leaf, versionRef: p.dossierId },
            parseVersionRef(p.dossierId)?.dossierId ?? p.dossierId,
          )
        }
        return { sealed: batch.length, tx }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        for (const p of batch) this.store.markSealAttempt(p.dossierId, msg)
        this.store.recordEvent('anchor_failed', { error: msg })
        return { sealed: 0, error: msg }
      }
    } finally {
      this.draining = false
    }
  }
}
