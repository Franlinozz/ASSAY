import { describe, it, expect } from 'vitest'
import { SAMPLE_RESUME_TEXT } from '@xyndicate/providers'
import { buildVerifyBundle } from '@xyndicate/receipts'
import type { Address, Hex } from 'viem'
import { JobRunner, devPdf, type JobDeps } from './jobs'
import { AnchorWorker } from './anchor'
import { createDossierJob, verify, makeCtx, type PipelineCtx } from './pipelines'
import { testRuntime, type TestRig } from './testutil'

function rig(): { r: TestRig; deps: JobDeps; pipe: PipelineCtx } {
  // These tests drive the JobRunner by hand, so the paid call must hand back its jobId immediately
  // instead of waiting in-band for a worker that only ticks when the test says so.
  const r = testRuntime({ ASY_INLINE_JOB_WAIT_MS: '0' })
  const deps: JobDeps = {
    store: r.store,
    router: r.router,
    fetcher: r.fetcher,
    cfg: r.cfg,
    toPdf: devPdf,
    realPdf: false,
    sampleContrast: async () => 12.4,
  }
  const pipe = makeCtx(r.store, r.router, r.cfg, r.fetcher)
  return { r, deps, pipe }
}

describe('dossier job pipeline', () => {
  it('runs queued → done and produces a tribunal summary, artifacts and a seal', async () => {
    const { r, deps, pipe } = rig()
    const created = await createDossierJob(pipe, {
      resumeText: SAMPLE_RESUME_TEXT,
      jd: 'Must have PostgreSQL\nStrong TypeScript',
    })
    const jobId = created.data['jobId'] as string
    expect(r.store.getJob(jobId)?.status).toBe('queued')

    const runner = new JobRunner(deps, 10)
    await runner.tick()

    const job = r.store.getJob(jobId)!
    expect(job.status).toBe('done')
    const result = JSON.parse(job.result!) as {
      dossierId: string
      artifacts: unknown[]
      tribunal: { of: number }
      seal: { leaf: string }
    }
    expect(result.artifacts.length).toBeGreaterThan(0)
    expect(result.tribunal.of).toBeGreaterThan(0)
    expect(result.seal.leaf).toMatch(/^0x/)

    // A sealed dossier is persisted with its seal commitment.
    const dossier = r.store.getDossier(result.dossierId)!
    expect(dossier.seal?.commitment).toBe(result.seal.leaf)
  })

  it('verify round-trips a sealed fixture: the leaf recomputes from the stored salt', async () => {
    const { r, deps, pipe } = rig()
    const created = await createDossierJob(pipe, { resumeText: SAMPLE_RESUME_TEXT })
    await new JobRunner(deps, 10).tick()
    const jobId = created.data['jobId'] as string
    const dossierId = JSON.parse(r.store.getJob(jobId)!.result!).dossierId as string

    const dossier = r.store.getDossier(dossierId)!
    const salt = r.store.getSalt(dossierId)!
    const bundle = await buildVerifyBundle(dossier, {
      chainId: r.cfg.chainId,
      registry: r.cfg.registry as Address,
      salt: salt as Hex,
    })
    expect(bundle.leaf).toBe(dossier.seal!.commitment)
  })

  it('asy_verify reports pending seal status for an un-anchored dossier without a live chain', async () => {
    const { r, deps, pipe } = rig()
    const created = await createDossierJob(pipe, { resumeText: SAMPLE_RESUME_TEXT })
    await new JobRunner(deps, 10).tick()
    const dossierId = JSON.parse(r.store.getJob(created.data['jobId'] as string)!.result!)
      .dossierId as string
    // sealStatus is tracked locally as 'pending' before the anchor worker runs.
    expect(r.store.getSealStatus(dossierId)).toBe('pending')
  })
})

describe('anchor worker', () => {
  it('skips draining when no sealer key is configured (dev), leaving seals pending', async () => {
    const { r, deps, pipe } = rig()
    await createDossierJob(pipe, { resumeText: SAMPLE_RESUME_TEXT })
    await new JobRunner(deps, 10).tick()
    expect(r.store.pendingSealCount()).toBe(1)
    const anchor = new AnchorWorker(r.store, r.cfg)
    const result = await anchor.drainOnce()
    expect(result.skipped).toBe(true)
    expect(r.store.pendingSealCount()).toBe(1)
  })
})

describe('paid dossier delivery', () => {
  it('returns the finished dossier in-band when the pipeline lands inside the wait budget', async () => {
    const r = testRuntime({ ASY_INLINE_JOB_WAIT_MS: '20000' })
    const deps: JobDeps = {
      store: r.store,
      router: r.router,
      fetcher: r.fetcher,
      cfg: r.cfg,
      toPdf: devPdf,
      realPdf: false,
      sampleContrast: async () => 12.4,
    }
    const pipe = makeCtx(r.store, r.router, r.cfg, r.fetcher)
    // The worker runs alongside the paid call, exactly as it does in production.
    const runner = new JobRunner(deps, 10)
    const ticking = setInterval(() => void runner.tick(), 50)
    try {
      const delivered = await createDossierJob(pipe, { resumeText: SAMPLE_RESUME_TEXT })
      expect(delivered.data['deliveredInline']).toBe(true)
      expect(delivered.data['dossierId']).toBeTruthy()
      expect((delivered.data['artifacts'] as unknown[]).length).toBeGreaterThan(0)
      expect(delivered.refused).toBeUndefined()
    } finally {
      clearInterval(ticking)
    }
  })

  it('falls back to the documented jobId contract when the run outlasts the budget', async () => {
    const r = testRuntime({ ASY_INLINE_JOB_WAIT_MS: '0' })
    const pipe = makeCtx(r.store, r.router, r.cfg, r.fetcher)
    const queued = await createDossierJob(pipe, { resumeText: SAMPLE_RESUME_TEXT })
    expect(queued.data['jobId']).toBeTruthy()
    expect(queued.data['poll']).toBe('asy_job_status')
    expect(queued.data['deliveredInline']).toBeUndefined()
  })
})
