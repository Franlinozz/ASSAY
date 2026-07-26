import { describe, it, expect } from 'vitest'
import { DossierSchema } from '@xyndicate/assay-core'
import { Store } from './store'
import { signFileToken, verifyFileToken } from './util'
import { testRuntime } from './testutil'

describe('Store', () => {
  it('round-trips files with a signed URL token and rejects a bad token', () => {
    const { store, cfg } = testRuntime()
    const row = store.putFile({
      name: 'resume_ats',
      ext: 'pdf',
      bytes: new TextEncoder().encode('%PDF-1.4'),
    })
    const bytes = store.readFileBytes(row.id)
    expect(bytes?.toString()).toContain('%PDF-1.4')
    const good = signFileToken(cfg.signingSecret, row.id, Date.now() + 60_000)
    expect(verifyFileToken(cfg.signingSecret, row.id, good)).toBe(true)
    expect(verifyFileToken(cfg.signingSecret, row.id, 'nonsense')).toBe(false)
    // Expired token
    const stale = signFileToken(cfg.signingSecret, row.id, Date.now() - 1)
    expect(verifyFileToken(cfg.signingSecret, row.id, stale)).toBe(false)
  })

  it('enforces one order per idempotency key (never double-charges)', () => {
    const { store } = testRuntime()
    store.createOrder({
      tool: 'asy_ats_scan',
      priceUsdt: 0.05,
      idempotencyKey: 'k1',
      requestHash: 'hash-one',
      status: 'settled',
    })
    expect(() =>
      store.createOrder({
        tool: 'asy_ats_scan',
        priceUsdt: 0.05,
        idempotencyKey: 'k1',
        status: 'settled',
      }),
    ).toThrow()
    expect(store.getOrderByIdempotencyKey('k1')?.tool).toBe('asy_ats_scan')
    expect(store.getOrderByIdempotencyKey('k1')?.requestHash).toBe('hash-one')
  })

  it('runs a job through queued → running → done and claims it once', () => {
    const { store } = testRuntime()
    const job = store.createJob('dossier', { a: 1 })
    expect(job.status).toBe('queued')
    const claimed = store.claimNextQueuedJob()
    expect(claimed?.id).toBe(job.id)
    expect(claimed?.status).toBe('running')
    expect(store.claimNextQueuedJob()).toBeUndefined() // nothing left to claim
    store.finishJob(job.id, { status: 'done', resultRef: 'dsr_1', result: { ok: true } })
    expect(store.getJob(job.id)?.status).toBe('done')
  })

  it('queues, ages and drains the seal queue', () => {
    const { store } = testRuntime()
    store.saveDossier(
      DossierSchema.parse({
        id: 'dsr_x',
        profile: {
          fullName: 'A',
          contact: { links: [] },
          timezone: 'UTC',
          experiences: [],
          education: [],
          certifications: [],
          skills: [],
        },
        evidence: [],
        claims: [],
        artifacts: [],
        tribunalReports: [],
        createdAt: new Date().toISOString(),
        tz: 'UTC',
      }),
    )
    store.enqueueSeal('dsr_x', '0xdeadbeef')
    expect(store.pendingSealCount()).toBe(1)
    expect(store.getSealStatus('dsr_x')).toBe('pending')
    expect(store.oldestSealAgeMs()).toBeGreaterThanOrEqual(0)
    store.setSealStatus('dsr_x', 'sealed')
    store.removeSeal('dsr_x')
    expect(store.pendingSealCount()).toBe(0)
  })

  it('keeps an append-only per-dossier event log', () => {
    const { store } = testRuntime()
    store.recordEvent('ats_scan', { chars: 10 }, 'dsr_1')
    store.recordEvent('verify', { found: false }, 'dsr_1')
    const events = store.listEvents('dsr_1')
    expect(events).toHaveLength(2)
    expect(events[0]!.kind).toBe('ats_scan')
  })
})
