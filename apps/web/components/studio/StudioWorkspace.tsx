'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  fetchState,
  fetchEvents,
  ingest,
  updateClaim,
  submitBrief,
  prepareInterview,
  evaluateInterview,
  startForge,
  jobStatus,
  sealDossier,
  createShare,
  revokeShare,
  saveRedactions,
  importCredential,
  type RedactionRecord,
  type StudioState,
  type FeedEvent,
  type SealReceipt,
} from '../../lib/studio'
import { StageRail, type Stage } from './StageRail'
import { EventFeed } from './EventFeed'
import { LedgerStage } from './LedgerStage'
import { BriefStage } from './BriefStage'
import { ForgeStage } from './ForgeStage'
import { ReportStage } from './ReportStage'
import { InterviewStage } from './InterviewStage'

function stageForServer(s: StudioState['stage']): Stage {
  if (s === 'forged' || s === 'sealed') return 'report'
  if (s === 'forging') return 'forge'
  if (s === 'brief') return 'brief'
  return 'ledger'
}

export interface StudioActions {
  busy: boolean
  runIngest: (body: Record<string, unknown>) => Promise<void>
  confirmClaim: (
    claimId: string,
    action: 'confirm' | 'reject' | 'edit',
    patch?: { text?: string; answer?: string },
  ) => Promise<void>
  runBriefMode: (input: {
    text: string
    mode: 'job' | 'promotion' | 'freelance'
    dateFrom?: string
    dateTo?: string
    projectClaimIds?: string[]
  }) => Promise<void>
  prepareInterview: () => Promise<void>
  evaluateInterview: (questionId: string, answer: string) => Promise<void>
  runForge: (selected?: string[]) => Promise<void>
  seal: () => Promise<SealReceipt | null>
  share: (config: {
    exposedClaimIds?: string[]
    showContact: boolean
    expiryDays: 7 | 30 | null
    preset?: 'recruiter' | 'samples'
    logViews?: boolean
  }) => Promise<void>
  revoke: () => Promise<void>
  redact: (evidenceId: string, record: RedactionRecord) => Promise<void>
  credential: (input: { filename: string; contentB64?: string; text?: string }) => Promise<void>
  goTo: (s: Stage) => void
}

export function StudioWorkspace({ id, token }: { id: string; token: string }) {
  const [state, setState] = useState<StudioState | null>(null)
  const [active, setActive] = useState<Stage>('ledger')
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [forgeTargetCount, setForgeTargetCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState<'token' | 'missing' | null>(null)
  const cursor = useRef(0)
  const didInitStage = useRef(false)
  const previousServerStage = useRef<StudioState['stage'] | null>(null)
  const reduced = useReducedMotion()
  const stageOrder: Stage[] = ['ledger', 'brief', 'interview', 'forge', 'report']
  const stageIndex = stageOrder.indexOf(active)
  const serverWorking = state?.stage === 'forging'
  const working = busy || serverWorking
  const defaultArtifactCount =
    state?.variant === 'promotion' || state?.variant === 'freelance' ? 4 : 9
  const expectedArtifacts =
    forgeTargetCount ?? state?.forge?.artifacts.length ?? defaultArtifactCount

  const refresh = useCallback(async (): Promise<StudioState | null> => {
    try {
      const s = await fetchState(id, token)
      setState(s)
      if (!didInitStage.current) {
        setActive(stageForServer(s.stage))
        didInitStage.current = true
      }
      return s
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (/capability/i.test(msg)) setFatal('token')
      else if (/no such|not found|404/i.test(msg)) setFatal('missing')
      return null
    }
  }, [id, token])

  // Initial load.
  useEffect(() => {
    if (!token) {
      setFatal('token')
      return
    }
    void refresh()
  }, [refresh, token])

  // Always-on event poll (cheap; drives the live feed and detects job completion).
  useEffect(() => {
    if (!token || fatal) return
    let alive = true
    const tick = async () => {
      try {
        const { events, cursor: next } = await fetchEvents(id, token, cursor.current)
        if (!alive) return
        if (events.length) {
          cursor.current = next
          setFeed((prev) => [...prev, ...events])
          if (events.some((event) => /artifacts? processed/i.test(event.action))) void refresh()
        }
      } catch {
        /* transient */
      }
    }
    void tick()
    const iv = setInterval(tick, 1300)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [id, token, fatal, refresh])

  // A Forge can outlive the request that started it or a page visit. Reconcile against the
  // canonical server stage so reopening the same capability URL always catches up.
  useEffect(() => {
    if (!token || fatal || state?.stage !== 'forging') return
    const timer = setInterval(() => void refresh(), 2500)
    return () => clearInterval(timer)
  }, [fatal, refresh, state?.stage, token])

  // When a long Forge finishes, advance into the Report instead of leaving the owner stranded on
  // Stage 4 with a completed event feed.
  useEffect(() => {
    const previous = previousServerStage.current
    previousServerStage.current = state?.stage ?? null
    if (previous === 'forging' && state?.stage === 'forged') {
      setBusy(false)
      setActive('report')
    }
  }, [state?.stage])

  const runJob = useCallback(
    async (starter: () => Promise<{ jobId: string }>) => {
      setBusy(true)
      setError(null)
      try {
        const { jobId } = await starter()
        let completed = false
        for (let i = 0; i < 1800; i++) {
          const st = await jobStatus(id, token, jobId)
          if (st.status === 'done') {
            completed = true
            break
          }
          if (st.status === 'failed') {
            setError(st.error ?? 'that step could not be completed — please retry')
            break
          }
          await new Promise((r) => setTimeout(r, 1000))
        }
        const next = await refresh()
        if (completed && next?.stage === 'forged') setActive('report')
        if (!completed && next?.stage === 'forging')
          setError(
            'The run is still safe on the server. You can leave this page and return with the same private link.',
          )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'something went wrong — please retry')
      } finally {
        setBusy(false)
      }
    },
    [id, token, refresh],
  )

  const actions: StudioActions = {
    busy: working,
    runIngest: (body) => runJob(() => ingest(id, token, body)),
    confirmClaim: async (claimId, action, patch) => {
      setError(null)
      try {
        await updateClaim(id, token, claimId, action, patch ?? {})
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'could not update that claim')
      }
    },
    runBriefMode: async (input) => {
      setBusy(true)
      setError(null)
      try {
        await submitBrief(id, token, input)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'could not map the brief')
      } finally {
        setBusy(false)
      }
    },
    prepareInterview: async () => {
      setBusy(true)
      setError(null)
      try {
        await prepareInterview(id, token)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'could not prepare the interview room')
      } finally {
        setBusy(false)
      }
    },
    evaluateInterview: async (questionId, answer) => {
      setBusy(true)
      setError(null)
      try {
        await evaluateInterview(id, token, questionId, answer)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'could not evaluate that answer')
      } finally {
        setBusy(false)
      }
    },
    runForge: (selected) => {
      setForgeTargetCount(selected?.length ?? defaultArtifactCount)
      return runJob(() => startForge(id, token, selected))
    },
    seal: async () => {
      setBusy(true)
      setError(null)
      try {
        const receipt = await sealDossier(id, token)
        await refresh()
        return receipt
      } catch (e) {
        setError(e instanceof Error ? e.message : 'the seal could not be applied')
        return null
      } finally {
        setBusy(false)
      }
    },
    share: async (config) => {
      setError(null)
      try {
        await createShare(id, token, config)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'could not issue the link')
      }
    },
    revoke: async () => {
      try {
        await revokeShare(id, token)
        await refresh()
      } catch {
        setError('could not withdraw the link')
      }
    },
    redact: async (evidenceId, record) => {
      setError(null)
      try {
        await saveRedactions(id, token, evidenceId, record)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'could not save those redactions')
      }
    },
    credential: async (input) => {
      setBusy(true)
      setError(null)
      try {
        await importCredential(id, token, input)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'could not read that credential')
      } finally {
        setBusy(false)
      }
    },
    goTo: setActive,
  }

  if (fatal === 'token') {
    return (
      <div className="container section" style={{ maxWidth: '40rem' }}>
        <p className="overline">Missing key</p>
        <h1 style={{ marginTop: '0.6rem' }}>This link is missing its capability key.</h1>
        <p className="lede" style={{ marginTop: '1rem' }}>
          A dossier can only be opened with its full private link (the part after{' '}
          <span className="mono">?t=</span>). Check the link you were given, or begin a new dossier.
        </p>
        <Link href="/studio" className="btn btn-primary" style={{ marginTop: '1.4rem' }}>
          Begin a dossier
        </Link>
      </div>
    )
  }
  if (fatal === 'missing') {
    return (
      <div className="container section" style={{ maxWidth: '40rem' }}>
        <p className="overline">Not found</p>
        <h1 style={{ marginTop: '0.6rem' }}>No dossier here.</h1>
        <p className="lede" style={{ marginTop: '1rem' }}>
          This dossier doesn&rsquo;t exist or has been removed.
        </p>
        <Link href="/studio" className="btn btn-primary" style={{ marginTop: '1.4rem' }}>
          Begin a dossier
        </Link>
      </div>
    )
  }

  return (
    <div className="studio">
      <div className={`studio-topbar${working ? ' studio-is-busy' : ''}`} aria-busy={working}>
        <div className="container studio-topbar-row">
          <div>
            <span className="overline">Career dossier</span>
            <p className="studio-title">
              {state ? state.profile.fullName : 'Loading…'}
              <span className="mono studio-id">{id}</span>
              <span className="studio-stage-count mono">
                stage {stageIndex + 1} / {stageOrder.length}
              </span>
            </p>
          </div>
          <div className={`studio-run-state${working ? ' studio-run-state-live' : ''}`}>
            <span className="studio-run-dot" aria-hidden="true" />
            <span>
              {working
                ? 'Run in progress'
                : state?.stage === 'sealed'
                  ? 'Sealed'
                  : 'Private workspace'}
            </span>
          </div>
        </div>
        <div className="studio-progress-track" aria-hidden="true">
          <span
            className="studio-progress-value"
            style={{ width: `${((stageIndex + 1) / stageOrder.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="container studio-body">
        <aside className="studio-nav-panel">
          <div className="studio-nav-heading">
            <span className="overline">Dossier flow</span>
            <p>Build proof in order. Revisit any completed room.</p>
          </div>
          <StageRail state={state} active={active} onNavigate={setActive} />
          <div className="studio-proof-note">
            <span className="studio-proof-mark" aria-hidden="true">
              A
            </span>
            <p>
              <strong>Claim gate active.</strong>
              <span>No sentence ships without confirmed evidence.</span>
            </p>
          </div>
        </aside>

        <div className="studio-main">
          {error ? (
            <div className="studio-error" role="alert" data-testid="studio-error">
              {error}
            </div>
          ) : null}
          {!state ? (
            <p className="caption">Opening your dossier…</p>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={reduced ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? { opacity: 1 } : { opacity: 0, x: -12 }}
                transition={reduced ? { duration: 0 } : { duration: 0.24, ease: 'easeOut' }}
              >
                {active === 'ledger' ? (
                  <LedgerStage state={state} actions={actions} />
                ) : active === 'brief' ? (
                  <BriefStage state={state} actions={actions} />
                ) : active === 'interview' ? (
                  <InterviewStage state={state} actions={actions} />
                ) : active === 'forge' ? (
                  <ForgeStage state={state} actions={actions} />
                ) : (
                  <ReportStage id={id} token={token} state={state} actions={actions} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        <aside className="studio-side">
          <EventFeed events={feed} busy={working} expectedArtifacts={expectedArtifacts} />
        </aside>
      </div>
    </div>
  )
}
