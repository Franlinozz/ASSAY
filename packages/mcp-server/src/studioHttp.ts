import express, { type Router, type Request, type Response, type NextFunction } from 'express'
import type { StudioDeps } from './studio'
import {
  createDossier,
  getStudioState,
  updateClaim,
  runBrief,
  prepareInterview,
  submitInterviewAnswer,
  sealDossier,
  createOrUpdateShare,
  revokeShare,
  getShareView,
  setRedactions,
  importCredential,
  compareVersions,
  verifyAndStoreAdjudication,
  type ShareConfig,
} from './studio'
import { verifyCapabilityToken } from './util'

// The Studio HTTP surface. Access model = capability URLs: creating a dossier mints a token
// (HMAC over the id); every mutation and the owner state read require ?t=<token> or a 403 follows
// (P9 NON-NEGOTIABLE). No accounts. The recruiter view (/s-api) is public and PII-enforced.

function tokenOf(req: Request): string {
  const q = req.query['t']
  if (typeof q === 'string') return q
  const h = req.header('X-Assay-Token')
  return h ?? ''
}

export function buildStudioRouter(deps: StudioDeps): Router {
  const { store, cfg } = deps
  const router = express.Router()
  const json = express.json({
    limit: cfg.maxBodyBytes > 12_000_000 ? cfg.maxBodyBytes : 12_000_000,
  })

  const ok = (res: Response, body: unknown): void => void res.json(body)
  const bad = (res: Response, code: number, error: string): void =>
    void res.status(code).json({ error })
  const diskReady = (): boolean =>
    (deps.diskFreeBytes?.() ?? Number.MAX_SAFE_INTEGER) >= cfg.minFreeDiskBytes

  // ── create (no token — this mints one) ──
  router.post('/studio/dossier', json, (req: Request, res: Response) => {
    const b = (req.body ?? {}) as { name?: unknown; timezone?: unknown; email?: unknown }
    const name = typeof b.name === 'string' ? b.name.trim() : ''
    const timezone = typeof b.timezone === 'string' && b.timezone ? b.timezone : 'UTC'
    if (!name) return bad(res, 400, 'a name is required to open a dossier')
    const email = typeof b.email === 'string' && b.email.includes('@') ? b.email.trim() : undefined
    const created = createDossier(store, cfg, { name, timezone, ...(email ? { email } : {}) })
    return ok(res, created)
  })

  // ── capability gate for owner routes ──
  const requireToken = (req: Request, res: Response, next: NextFunction): void => {
    const id = String(req.params['id'])
    if (!store.dossierExists(id)) return bad(res, 404, 'no such dossier')
    if (!verifyCapabilityToken(cfg.signingSecret, id, tokenOf(req)))
      return bad(res, 403, 'this dossier requires its capability link')
    next()
  }

  // ── owner state ──
  router.get('/d-state/:id', requireToken, (req: Request, res: Response) => {
    const state = getStudioState(store, cfg, String(req.params['id']))
    return state ? ok(res, state) : bad(res, 404, 'no such dossier')
  })

  // ── ingest → studio_extract job ──
  router.post('/d/:id/ingest', requireToken, json, (req: Request, res: Response) => {
    if (!diskReady())
      return bad(
        res,
        507,
        'storage capacity is low — new uploads are paused; existing work is safe',
      )
    const id = String(req.params['id'])
    const b = (req.body ?? {}) as Record<string, unknown>
    const kind = b['kind']
    if (kind !== 'document' && kind !== 'answers' && kind !== 'links')
      return bad(res, 400, 'kind must be document | answers | links')
    const input = {
      dossierId: id,
      kind,
      ...(typeof b['filename'] === 'string' ? { filename: b['filename'] } : {}),
      ...(typeof b['contentB64'] === 'string' ? { contentB64: b['contentB64'] } : {}),
      ...(typeof b['text'] === 'string' ? { text: b['text'] } : {}),
      ...(typeof b['answers'] === 'string' ? { answers: b['answers'] } : {}),
      ...(Array.isArray(b['links'])
        ? { links: (b['links'] as unknown[]).filter((l) => typeof l === 'string') }
        : {}),
    }
    const job = store.createJob('studio_extract', input)
    return ok(res, { jobId: job.id, status: job.status })
  })

  // ── confirm / edit / reject a claim ──
  router.post('/d/:id/claims/:claimId', requireToken, json, (req: Request, res: Response) => {
    const b = (req.body ?? {}) as { action?: unknown; text?: unknown; answer?: unknown }
    if (b.action !== 'confirm' && b.action !== 'reject' && b.action !== 'edit')
      return bad(res, 400, 'action must be confirm | reject | edit')
    const patch: { text?: string; answer?: string } = {}
    if (typeof b.text === 'string') patch.text = b.text
    if (typeof b.answer === 'string') patch.answer = b.answer
    const r = updateClaim(
      store,
      String(req.params['id']),
      String(req.params['claimId']),
      b.action,
      patch,
    )
    return r.ok ? ok(res, { ok: true, claim: r.claim }) : bad(res, 404, 'no such claim')
  })

  router.post('/d/:id/evidence/:evidenceId/redact', requireToken, json, (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>
    const fields = Array.isArray(b['fields'])
      ? b['fields'].filter((x): x is 'email' | 'phone' => x === 'email' || x === 'phone')
      : []
    const textRanges = Array.isArray(b['textRanges'])
      ? b['textRanges'].flatMap((x) => {
          const r = x as { start?: unknown; end?: unknown }
          return typeof r.start === 'number' && typeof r.end === 'number' && r.end > r.start
            ? [{ start: r.start, end: r.end }]
            : []
        })
      : []
    const regions = Array.isArray(b['regions'])
      ? b['regions'].flatMap((x) => {
          const r = x as Record<string, unknown>
          return ['page', 'x', 'y', 'width', 'height'].every((k) => typeof r[k] === 'number')
            ? [
                {
                  page: r['page'] as number,
                  x: r['x'] as number,
                  y: r['y'] as number,
                  width: r['width'] as number,
                  height: r['height'] as number,
                },
              ]
            : []
        })
      : []
    const result = setRedactions(
      store,
      String(req.params['id']),
      String(req.params['evidenceId']),
      { fields, textRanges, regions },
    )
    return result.ok ? ok(res, result) : bad(res, 404, 'no such evidence')
  })

  router.post(
    '/d/:id/credential',
    requireToken,
    json,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!diskReady())
          return bad(
            res,
            507,
            'storage capacity is low — new uploads are paused; existing work is safe',
          )
        const b = (req.body ?? {}) as Record<string, unknown>
        const filename = typeof b['filename'] === 'string' ? b['filename'] : 'certificate.txt'
        return ok(
          res,
          await importCredential(deps, String(req.params['id']), {
            filename,
            ...(typeof b['contentB64'] === 'string' ? { contentB64: b['contentB64'] } : {}),
            ...(typeof b['text'] === 'string' ? { text: b['text'] } : {}),
          }),
        )
      } catch (e) {
        next(e)
      }
    },
  )

  router.get('/d/:id/compare', requireToken, (req, res) => {
    const from = Number(req.query['from'])
    const to = Number(req.query['to'])
    if (!Number.isInteger(from) || !Number.isInteger(to))
      return bad(res, 400, 'from and to versions are required')
    const result = compareVersions(store, String(req.params['id']), from, to)
    return result ? ok(res, result) : bad(res, 404, 'version not found')
  })

  // ── brief (inline) ──
  router.post(
    '/d/:id/brief',
    requireToken,
    json,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const b = (req.body ?? {}) as Record<string, unknown>
        const text =
          typeof b['text'] === 'string'
            ? b['text'].trim()
            : typeof b['jd'] === 'string'
              ? b['jd'].trim()
              : ''
        if (!text) return bad(res, 400, 'add a role, promotion goal, or client brief')
        const mode = b['mode'] === 'promotion' || b['mode'] === 'freelance' ? b['mode'] : 'job'
        const result = await runBrief(deps, String(req.params['id']), {
          text,
          mode,
          ...(typeof b['dateFrom'] === 'string' ? { dateFrom: b['dateFrom'] } : {}),
          ...(typeof b['dateTo'] === 'string' ? { dateTo: b['dateTo'] } : {}),
          ...(Array.isArray(b['projectClaimIds'])
            ? {
                projectClaimIds: b['projectClaimIds'].filter(
                  (x): x is string => typeof x === 'string',
                ),
              }
            : {}),
        })
        return ok(res, result)
      } catch (e) {
        next(e)
      }
    },
  )

  router.post('/d/:id/interview/generate', requireToken, json, (req: Request, res: Response) => {
    try {
      return ok(res, prepareInterview(deps, String(req.params['id'])))
    } catch (e) {
      return bad(res, 400, e instanceof Error ? e.message : 'could not prepare interview')
    }
  })

  router.post(
    '/d/:id/interview/:questionId',
    requireToken,
    json,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const answer =
          typeof (req.body as { answer?: unknown })?.answer === 'string'
            ? (req.body as { answer: string }).answer.trim()
            : ''
        if (!answer) return bad(res, 400, 'type an answer for the critic')
        return ok(
          res,
          await submitInterviewAnswer(
            deps,
            String(req.params['id']),
            String(req.params['questionId']),
            answer,
          ),
        )
      } catch (e) {
        next(e)
      }
    },
  )

  // ── forge → studio_forge job (gate: all claims resolved) ──
  router.post('/d/:id/forge', requireToken, json, (req: Request, res: Response) => {
    const id = String(req.params['id'])
    const dossier = store.getDossier(id)
    if (!dossier) return bad(res, 404, 'no such dossier')
    const unresolved = dossier.claims.filter(
      (c) => c.status === 'extracted' || c.status === 'needs_confirmation',
    )
    if (unresolved.length > 0)
      return bad(res, 409, `confirm or set aside ${unresolved.length} claim(s) before forging`)
    if (dossier.claims.every((c) => c.status !== 'confirmed'))
      return bad(res, 409, 'confirm at least one claim before forging')
    const b = (req.body ?? {}) as { selected?: unknown }
    const selected = Array.isArray(b.selected)
      ? (b.selected as unknown[]).filter((s) => typeof s === 'string')
      : undefined
    store.setStage(id, 'forging')
    const job = store.createJob('studio_forge', {
      dossierId: id,
      ...(selected ? { selected } : {}),
    })
    return ok(res, { jobId: job.id, status: job.status })
  })

  // ── job status ──
  router.get('/d/:id/job/:jobId', requireToken, (req: Request, res: Response) => {
    const job = store.getJob(String(req.params['jobId']))
    if (!job) return bad(res, 404, 'no such job')
    return ok(res, { status: job.status, ...(job.error ? { error: sanitize(job.error) } : {}) })
  })

  // ── event feed (incremental) ──
  router.get('/d/:id/events', requireToken, (req: Request, res: Response) => {
    const since = Number(req.query['since'] ?? 0) || 0
    const events = store.listStudioEventsSince(String(req.params['id']), since)
    const cursor = events.length ? events[events.length - 1]!.id : since
    return ok(res, { events, cursor })
  })

  // The browser submits the write directly through the user's wallet. This endpoint is read-only
  // with respect to GenLayer: it verifies exact calldata + contract state, then links the receipt
  // into the private dossier so the later X Layer manifest can commit to it.
  router.post(
    '/d/:id/adjudication',
    requireToken,
    json,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const b = (req.body ?? {}) as Record<string, unknown>
        if (
          typeof b['claimId'] !== 'string' ||
          ![
            'ACTION_AND_OUTCOME',
            'QUANTIFIED_OUTCOME',
            'ROLE_AND_SCOPE',
            'COMPETENCY_DEMONSTRATION',
          ].includes(String(b['criterionId'])) ||
          !Array.isArray(b['evidenceUrls']) ||
          typeof b['txHash'] !== 'string' ||
          !/^0x[0-9a-fA-F]{64}$/.test(b['txHash'])
        )
          return bad(res, 400, 'claim, criterion, public evidence URLs and transaction are required')
        const evidenceUrls = b['evidenceUrls'].filter(
          (value): value is string => typeof value === 'string',
        )
        return ok(
          res,
          await verifyAndStoreAdjudication(deps, String(req.params['id']), {
            claimId: b['claimId'],
            criterionId: b['criterionId'] as
              | 'ACTION_AND_OUTCOME'
              | 'QUANTIFIED_OUTCOME'
              | 'ROLE_AND_SCOPE'
              | 'COMPETENCY_DEMONSTRATION',
            evidenceUrls,
            txHash: b['txHash'] as `0x${string}`,
          }),
        )
      } catch (e) {
        next(e)
      }
    },
  )

  // ── seal (inline) ──
  router.post(
    '/d/:id/seal',
    requireToken,
    json,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dossier = store.getDossier(String(req.params['id']))
        if (!dossier?.adjudications.some((adjudication) => adjudication.status === 'finalized'))
          return bad(
            res,
            409,
            'finalize at least one GenLayer adjudication before sealing on X Layer',
          )
        const receipt = await sealDossier(deps, String(req.params['id']))
        return ok(res, receipt)
      } catch (e) {
        next(e)
      }
    },
  )

  // ── share create / update ──
  router.post('/d/:id/share', requireToken, json, (req: Request, res: Response) => {
    const id = String(req.params['id'])
    const dossier = store.getDossier(id)
    if (!dossier) return bad(res, 404, 'no such dossier')
    const b = (req.body ?? {}) as {
      exposedClaimIds?: unknown
      showContact?: unknown
      expiryDays?: unknown
      preset?: unknown
      logViews?: unknown
    }
    const confirmedIds = dossier.claims.filter((c) => c.status === 'confirmed').map((c) => c.id)
    const exposedClaimIds = Array.isArray(b.exposedClaimIds)
      ? (b.exposedClaimIds as unknown[]).filter(
          (x): x is string => typeof x === 'string' && confirmedIds.includes(x),
        )
      : confirmedIds
    const expiryDays = b.expiryDays === 7 || b.expiryDays === 30 ? b.expiryDays : null
    const config: ShareConfig = {
      exposedClaimIds,
      showContact: b.showContact === true,
      expiryDays,
      preset: b.preset === 'samples' ? 'samples' : 'recruiter',
      logViews: b.logViews === true,
    }
    return ok(res, createOrUpdateShare(store, id, config))
  })

  router.post('/d/:id/share/revoke', requireToken, json, (req: Request, res: Response) => {
    const r = revokeShare(store, String(req.params['id']))
    return r.ok ? ok(res, { ok: true }) : bad(res, 404, 'no share to revoke')
  })

  // ── recruiter portal (public, PII-enforced) ──
  router.get('/s-api/:shareId', (req: Request, res: Response) => {
    return ok(res, getShareView(store, cfg, String(req.params['shareId']), Date.now(), true))
  })

  return router
}

function sanitize(msg: string): string {
  // Public surfaces never leak raw provider errors (guardrail #9).
  if (/quota|rate|429/i.test(msg)) return 'provider:quota — please retry shortly'
  if (/timeout|abort/i.test(msg)) return 'provider:timeout — please retry'
  if (/ingest|empty|read/i.test(msg)) return 'could not read that input — try plain text or a PDF'
  if (/confirm|forge/i.test(msg)) return msg
  return 'that step could not be completed — please retry'
}
