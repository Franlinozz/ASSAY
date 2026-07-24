'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  fetchState,
  fetchEvents,
  ingest,
  updateClaim,
  submitBrief,
  startForge,
  jobStatus,
  sealDossier,
  createShare,
  revokeShare,
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
  runBrief: (jd: string) => Promise<void>
  runForge: (selected?: string[]) => Promise<void>
  seal: () => Promise<SealReceipt | null>
  share: (config: {
    exposedClaimIds?: string[]
    showContact: boolean
    expiryDays: 7 | 30 | null
  }) => Promise<void>
  revoke: () => Promise<void>
  goTo: (s: Stage) => void
}

export function StudioWorkspace({ id, token }: { id: string; token: string }) {
  const [state, setState] = useState<StudioState | null>(null)
  const [active, setActive] = useState<Stage>('ledger')
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState<'token' | 'missing' | null>(null)
  const cursor = useRef(0)
  const didInitStage = useRef(false)

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
  }, [id, token, fatal])

  const runJob = useCallback(
    async (starter: () => Promise<{ jobId: string }>) => {
      setBusy(true)
      setError(null)
      try {
        const { jobId } = await starter()
        for (let i = 0; i < 240; i++) {
          const st = await jobStatus(id, token, jobId)
          if (st.status === 'done') break
          if (st.status === 'failed') {
            setError(st.error ?? 'that step could not be completed — please retry')
            break
          }
          await new Promise((r) => setTimeout(r, 1000))
        }
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'something went wrong — please retry')
      } finally {
        setBusy(false)
      }
    },
    [id, token, refresh],
  )

  const actions: StudioActions = {
    busy,
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
    runBrief: async (jd) => {
      setBusy(true)
      setError(null)
      try {
        await submitBrief(id, token, jd)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'could not map the brief')
      } finally {
        setBusy(false)
      }
    },
    runForge: (selected) => runJob(() => startForge(id, token, selected)),
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
      <div className="studio-topbar">
        <div className="container studio-topbar-row">
          <div>
            <span className="overline">Career dossier</span>
            <p className="studio-title">
              {state ? state.profile.fullName : 'Loading…'}
              <span className="mono studio-id">{id}</span>
            </p>
          </div>
          <StageRail state={state} active={active} onNavigate={setActive} />
        </div>
      </div>

      <div className="container studio-body">
        <div className="studio-main">
          {error ? (
            <div className="studio-error" role="alert" data-testid="studio-error">
              {error}
            </div>
          ) : null}
          {!state ? (
            <p className="caption">Opening your dossier…</p>
          ) : active === 'ledger' ? (
            <LedgerStage state={state} actions={actions} />
          ) : active === 'brief' ? (
            <BriefStage state={state} actions={actions} />
          ) : active === 'forge' ? (
            <ForgeStage state={state} actions={actions} />
          ) : (
            <ReportStage id={id} token={token} state={state} actions={actions} />
          )}
        </div>
        <aside className="studio-side">
          <EventFeed events={feed} busy={busy} />
        </aside>
      </div>
    </div>
  )
}
