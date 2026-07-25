import type {
  Artifact,
  Claim,
  Coverage,
  Dossier,
  TribunalReport as CoreTribunalReport,
} from '@xyndicate/assay-core'
import { DossierSchema } from '@xyndicate/assay-core'
import {
  extractProfile,
  decomposeJd,
  computeCoverage,
  type ModelRouter,
  type Fetcher,
} from '@xyndicate/providers'
import { ingestDocument } from '@xyndicate/providers'
import { forgeDossier } from '@xyndicate/renderers'
import { gradeArtifact, summarize, type TribunalReport } from '@xyndicate/tribunal'
import { buildVerifyBundle, newSalt } from '@xyndicate/receipts'
import type { Address, Hex } from 'viem'
import type { ServerConfig } from './config'
import type { Store, JobRow } from './store'
import { decodeUpload } from './util'
import { runStudioExtract, runStudioForge, type StudioExtractInput } from './studio'

// The in-process worker that runs the paid asy_create_dossier_job pipeline end-to-end. Anything slow
// is a job (gotcha #10); the marketplace only ever sees create → status → result.

export interface JobDeps {
  store: Store
  router: ModelRouter
  fetcher: Fetcher
  cfg: ServerConfig
  toPdf: (html: string) => Promise<Uint8Array>
  // Whether toPdf is the real chromium renderer (drives the Studio's ATS parse-back). The MCP
  // dossier pipeline ignores it; the Studio forge job reads it.
  realPdf: boolean
}

interface DossierJobInput {
  resumeText?: string
  resumeB64?: string
  filename?: string
  jd?: string
  answers?: string
  variant?: 'job' | 'promotion' | 'freelance'
  dateFrom?: string
  dateTo?: string
}

// Map a rich tribunal report onto the lean assay-core report shape the dossier schema stores.
function toCoreReport(r: TribunalReport): CoreTribunalReport {
  return {
    artifactId: r.artifactId,
    standardVersion: r.standardVersion,
    passed: r.pass,
    hardFindings: r.hard
      .filter((h) => h.status === 'fail')
      .flatMap((h) => h.findings.map((f) => ({ code: f.code, detail: f.detail }))),
    craftScores: Object.fromEntries(r.craft.map((c) => [c.axis, c.score])),
    createdAt: r.createdAt,
  }
}

// Drop heavy render output (meta.html) from the artifacts we persist + seal, keeping the dossier
// JSON lean. We seal exactly what we store, so the manifest hash stays reproducible at verify time.
function lean(a: Artifact): Artifact {
  const out: Artifact = { id: a.id, kind: a.kind, meta: {} }
  if (a.fileRef) out.fileRef = a.fileRef
  if (a.sentences) out.sentences = a.sentences
  return out
}

export async function runDossierPipeline(
  deps: JobDeps,
  input: DossierJobInput,
): Promise<{ dossierId: string; result: Record<string, unknown> }> {
  const { store, router, fetcher, cfg } = deps

  // 1) ingest
  const { bytes, wasB64 } = decodeUpload({ text: input.resumeText, textB64: input.resumeB64 })
  const filename = input.filename ?? (wasB64 ? 'resume.pdf' : 'resume.txt')
  const ing = await ingestDocument(filename, bytes)
  if (!ing.ok) throw new Error(`ingest failed: ${ing.gap ?? 'INGEST_EMPTY'}`)

  // 2) extract, then confirm grounded claims — they trace to the user's own uploaded evidence.
  const extracted = await extractProfile({
    documents: [{ label: filename, contentText: ing.contentText }],
    ...(input.answers ? { answers: input.answers } : {}),
    router,
  })
  const claims: Claim[] = extracted.claims.map((c) =>
    c.status === 'extracted' ? { ...c, status: 'confirmed' as const } : c,
  )

  // 3) JD decomposition + coverage
  let brief: Dossier['brief']
  let coverage: Coverage[] = []
  if (input.jd && input.jd.trim()) {
    const dec = await decomposeJd({ jdText: input.jd, router })
    brief = {
      jdText: input.jd,
      decomposed: dec.requirements,
      mode: input.variant ?? 'job',
      projectClaimIds:
        input.variant === 'freelance'
          ? claims.filter((c) => c.status === 'confirmed').map((c) => c.id)
          : [],
      ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
      ...(input.dateTo ? { dateTo: input.dateTo } : {}),
    }
    coverage = computeCoverage(
      dec.requirements,
      claims.filter((c) => c.status === 'confirmed'),
    )
  }

  // 4) assemble the dossier
  const dossier: Dossier = DossierSchema.parse({
    profile: extracted.profile,
    tz: extracted.profile.timezone,
    evidence: extracted.evidence,
    claims,
    variant: input.variant ?? 'job',
    ...(brief ? { brief } : {}),
  })
  store.recordEvent(
    'dossier_built',
    { claims: claims.length, evidence: extracted.evidence.length },
    dossier.id,
  )

  // 5) forge — evidence-gated prose + PDFs/DOCX/portfolio (claim gate enforced inside).
  const forge = await forgeDossier({ dossier, router, coverage, deps: { toPdf: deps.toPdf } })

  // 6) grade every artifact against the Standard
  const reports: TribunalReport[] = []
  for (const art of forge.artifacts) {
    reports.push(await gradeArtifact(dossier, art, { router, fetcher, fileExists: () => true }))
  }
  const tribunalSummary = summarize(reports)

  // 7) persist files, collect signed-linkable refs
  const fileIdByArtifact = new Map<string, string>()
  for (const [name, f] of forge.files) {
    const row = store.putFile({ dossierId: dossier.id, name, ext: f.ext, bytes: f.bytes })
    fileIdByArtifact.set(name, row.id)
  }

  // 8) finalize + seal (salt held off-chain in the store, never in the dossier — guardrail #3)
  dossier.artifacts = forge.artifacts.map(lean)
  dossier.tribunalReports = reports.map(toCoreReport)
  const salt = newSalt()
  const bundle = await buildVerifyBundle(dossier, {
    chainId: cfg.chainId,
    registry: cfg.registry as Address,
    salt,
    ...(cfg.sealerKey ? { sealerKey: cfg.sealerKey as Hex } : {}),
  })
  dossier.seal = {
    manifestHash: bundle.manifestHash,
    commitment: bundle.leaf,
    chainId: cfg.chainId,
    standardVersion: bundle.standardVersion,
    ...(bundle.signer ? { signer: bundle.signer } : {}),
  }

  store.saveDossier(dossier, salt)
  store.enqueueSeal(dossier.id, bundle.leaf)
  store.recordEvent('dossier_sealed_pending', { leaf: bundle.leaf }, dossier.id)

  const artifacts = forge.artifacts
    .filter((a) => fileIdByArtifact.has(a.id))
    .map((a) => ({ id: a.id, kind: a.kind, fileId: fileIdByArtifact.get(a.id)! }))

  // Public portfolio share page (served sanitized at /p/:slug).
  const portfolioFileId = fileIdByArtifact.get('portfolio_page')
  const shareSlug = portfolioFileId ? store.createShare(dossier.id, portfolioFileId) : undefined

  return {
    dossierId: dossier.id,
    result: {
      dossierId: dossier.id,
      artifacts,
      questions: forge.questions,
      portfolio: shareSlug ? `/p/${shareSlug}` : null,
      tribunal: {
        pass: tribunalSummary.finalPassed,
        of: tribunalSummary.artifacts,
        firstDraftPassed: tribunalSummary.firstDraftPassed,
        byArtifact: tribunalSummary.byArtifact,
      },
      seal: {
        leaf: bundle.leaf,
        status: 'pending',
        chainId: cfg.chainId,
        registry: cfg.registry,
        signer: bundle.signer ?? null,
      },
    },
  }
}

export class JobRunner {
  private timer: ReturnType<typeof setInterval> | undefined
  private ticking = false
  constructor(
    private readonly deps: JobDeps,
    private readonly pollMs = 1000,
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), this.pollMs)
    if (typeof this.timer.unref === 'function') this.timer.unref()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  // Claim and run at most one job per tick. Never throws (a failed job is recorded, not fatal).
  async tick(): Promise<JobRow | undefined> {
    if (this.ticking) return undefined
    this.ticking = true
    try {
      const job = this.deps.store.claimNextQueuedJob()
      if (!job) return undefined
      try {
        if (job.kind === 'studio_extract') {
          const input = JSON.parse(job.input ?? '{}') as StudioExtractInput
          await runStudioExtract(this.deps, input)
          this.deps.store.finishJob(job.id, { status: 'done', resultRef: input.dossierId })
        } else if (job.kind === 'studio_forge') {
          const input = JSON.parse(job.input ?? '{}') as { dossierId: string; selected?: string[] }
          await runStudioForge(this.deps, input)
          this.deps.store.finishJob(job.id, { status: 'done', resultRef: input.dossierId })
        } else {
          const input = job.input ? (JSON.parse(job.input) as DossierJobInput) : {}
          const { dossierId, result } = await runDossierPipeline(this.deps, input)
          this.deps.store.finishJob(job.id, { status: 'done', resultRef: dossierId, result })
        }
      } catch (e) {
        this.deps.store.finishJob(job.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : String(e),
        })
      }
      return job
    } finally {
      this.ticking = false
    }
  }
}

// A chromium-free PDF stub for dev/CI/tests. Prod injects the real headless-chromium htmlToPdf.
export function devPdf(html: string): Promise<Uint8Array> {
  const stamp = `%PDF-1.4\n% Assay dev stub (${html.length} bytes of html)\n%%EOF`
  return Promise.resolve(new TextEncoder().encode(stamp))
}
