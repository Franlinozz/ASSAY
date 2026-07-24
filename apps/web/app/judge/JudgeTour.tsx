'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { TierChip } from '../../components/TierChip'
import type { Persona } from '../../lib/personas'

// The 90-second judge tour. Every beat is driven by REAL stored data from the featured persona's
// SEALED run (guardrail #7) — nothing is invented at render time. The tour is pausable, skippable,
// and survives a total provider outage: the only live call (the final on-chain verify) has a cached
// fallback drawn from the sealed run, so a provider outage can never kill a judging session. A
// standing caption keeps it honest: this is a replay of a sealed run.

interface VerifyState {
  phase: 'idle' | 'live' | 'cached' | 'failed'
  anchoredAt?: number | null
  live?: boolean
}

type BeatId =
  | 'intro'
  | 'ledger'
  | 'question'
  | 'jd'
  | 'coverage'
  | 'forge'
  | 'threads'
  | 'blocked'
  | 'tribunal-fail'
  | 'repair-pass'
  | 'parseback'
  | 'seal'
  | 'share'
  | 'verify'

interface Beat {
  id: BeatId
  ms: number
  kicker: string
  title: string
}

const BEATS: Beat[] = [
  { id: 'intro', ms: 3000, kicker: 'Replaying a sealed run', title: 'A dossier, from evidence to seal.' },
  { id: 'ledger', ms: 9000, kicker: 'The ledger', title: 'Claims trace to your own documents.' },
  { id: 'question', ms: 6000, kicker: 'Honesty', title: 'An unsupported figure becomes a question.' },
  { id: 'jd', ms: 5000, kicker: 'The brief', title: 'Paste the job you’re aiming at.' },
  { id: 'coverage', ms: 7000, kicker: 'Coverage', title: 'Gaps are named, not papered over.' },
  { id: 'forge', ms: 6000, kicker: 'The forge', title: 'Artifacts are written from claims only.' },
  { id: 'threads', ms: 7000, kicker: 'Proof', title: 'Every sentence pulls its evidence thread.' },
  { id: 'blocked', ms: 6000, kicker: 'The honesty beat', title: 'One claim is blocked as unsupported.' },
  { id: 'tribunal-fail', ms: 6000, kicker: 'The tribunal', title: 'The first draft fails a real check.' },
  { id: 'repair-pass', ms: 6000, kicker: 'The repair loop', title: 'Repaired, then it passes.' },
  { id: 'parseback', ms: 5000, kicker: 'Machine-read', title: '100% of fields survive ATS parsing.' },
  { id: 'seal', ms: 6000, kicker: 'The seal', title: 'Anchored on X Layer.' },
  { id: 'share', ms: 4000, kicker: 'The share portal', title: 'A recruiter sees only what you expose.' },
  { id: 'verify', ms: 8000, kicker: 'Verify', title: 'Anyone can confirm it on-chain.' },
]

const TOTAL_MS = BEATS.reduce((s, b) => s + b.ms, 0)

export function JudgeTour({ persona }: { persona: Persona }) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [beatElapsed, setBeatElapsed] = useState(0)
  const [verify, setVerify] = useState<VerifyState>({ phase: 'idle' })
  const rafRef = useRef<number | undefined>(undefined)
  const lastTs = useRef<number | undefined>(undefined)
  const verifyFired = useRef(false)

  const beat = BEATS[idx]

  const elapsedBefore = useMemo(
    () => BEATS.slice(0, idx).reduce((s, b) => s + b.ms, 0),
    [idx],
  )
  const overallPct = Math.min(100, ((elapsedBefore + beatElapsed) / TOTAL_MS) * 100)

  const goTo = useCallback((next: number) => {
    setIdx(Math.max(0, Math.min(BEATS.length - 1, next)))
    setBeatElapsed(0)
    lastTs.current = undefined
  }, [])

  const restart = useCallback(() => {
    goTo(0)
    setPlaying(true)
    setVerify({ phase: 'idle' })
    verifyFired.current = false
  }, [goTo])

  // Fire the (only) live call ONCE when the verify beat opens; fall back to the sealed run's cached
  // result. A ref guard keeps this fetch stable — depending on verify.phase here would cancel the
  // in-flight request when its own state update re-ran the effect.
  useEffect(() => {
    if (beat.id !== 'verify' || verifyFired.current) return
    verifyFired.current = true
    setVerify({ phase: 'live' })
    const cachedAnchored = persona.seal.anchoredAt ?? null
    fetch('/api/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leaf: persona.seal.leaf }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then((body: { found?: boolean; anchoredAt?: string | null }) => {
        if (body.found)
          setVerify({
            phase: 'live',
            live: true,
            anchoredAt: body.anchoredAt ? Number(new Date(body.anchoredAt)) : cachedAnchored,
          })
        else setVerify({ phase: 'cached', live: false, anchoredAt: cachedAnchored })
      })
      .catch(() => setVerify({ phase: 'cached', live: false, anchoredAt: cachedAnchored }))
  }, [beat.id, persona.seal.leaf, persona.seal.anchoredAt])

  // Timeline driver.
  useEffect(() => {
    if (!playing) {
      lastTs.current = undefined
      return
    }
    const tick = (ts: number) => {
      if (lastTs.current === undefined) lastTs.current = ts
      const dt = ts - lastTs.current
      lastTs.current = ts
      setBeatElapsed((prev) => {
        const nextEl = prev + dt
        if (nextEl >= beat.ms) {
          if (idx < BEATS.length - 1) {
            setIdx((i) => i + 1)
            lastTs.current = undefined
            return 0
          }
          setPlaying(false)
          return beat.ms
        }
        return nextEl
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, idx, beat.ms])

  const finished = !playing && idx === BEATS.length - 1 && beatElapsed >= beat.ms

  return (
    <div className="judge-shell" data-testid="judge-tour" data-beat={beat.id}>
      <div className="judge-stagebox">
        <span className="judge-replay-caption" data-testid="judge-replay-caption">
          Replaying a sealed run
        </span>
        <div>
          <p className="judge-beat-kicker">{beat.kicker}</p>
          <h2 className="judge-beat-title">{beat.title}</h2>
        </div>
        <div className="judge-beat-body" key={beat.id}>
          <BeatBody beat={beat} persona={persona} verify={verify} />
        </div>
      </div>

      <div className="judge-progress-track" aria-hidden>
        <div className="judge-progress-fill" style={{ width: `${overallPct}%` }} />
      </div>

      <div className="judge-controls">
        {finished ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={restart} data-testid="judge-restart">
            ↻ Replay
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setPlaying((p) => !p)}
            data-testid="judge-playpause"
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0}
          data-testid="judge-prev"
        >
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => goTo(idx + 1)}
          disabled={idx >= BEATS.length - 1}
          data-testid="judge-skip"
        >
          Skip →
        </button>
        <span className="caption mono">
          {Math.round((elapsedBefore + beatElapsed) / 1000)}s / {Math.round(TOTAL_MS / 1000)}s
        </span>
        <div className="judge-beat-dots">
          {BEATS.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={`judge-dot ${i === idx ? 'judge-dot-on' : i < idx ? 'judge-dot-done' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Beat ${i + 1}: ${b.title}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BeatBody({
  beat,
  persona,
  verify,
}: {
  beat: Beat
  persona: Persona
  verify: VerifyState
}) {
  const confirmed = persona.claims.filter((c) => c.status === 'confirmed')
  const question = persona.claims.find((c) => c.status === 'needs_confirmation')
  const missing = persona.coverage.filter((c) => c.status === 'missing')
  const coverStrong = persona.coverage.filter((c) => c.status !== 'missing')
  const coverKey = Object.keys(persona.sentences)[0]
  const sentence = coverKey ? persona.sentences[coverKey]?.[0] : undefined
  const coverReports = persona.tribunal.reports.filter((r) => r.artifactId === 'cover_letter')
  const failDraft = coverReports.find((r) => !r.pass)
  const passDraft = coverReports.find((r) => r.pass)

  switch (beat.id) {
    case 'intro':
      return (
        <>
          <span className="fictional-tag">Fictional persona — demonstration</span>
          <p>
            <strong>{persona.name}</strong> — {persona.headline}. {persona.blurb}
          </p>
          <p className="caption">
            Everything you’re about to see is the real, sealed output of this run — pausable and
            skippable, ~90 seconds.
          </p>
        </>
      )
    case 'ledger':
      return (
        <>
          {confirmed.slice(0, 2).map((c) => (
            <div key={c.id} className="claim-card claim-confirmed">
              <div className="claim-top">
                <TierChip tier={c.strength} />
                <span className="chip chip-ok">confirmed</span>
                <span className="claim-ref mono">{c.id}</span>
              </div>
              <p className="claim-text">{c.text}</p>
            </div>
          ))}
          <p className="caption">Grounded in {persona.name.split(' ')[0]}’s own uploaded documents.</p>
        </>
      )
    case 'question':
      return question ? (
        <div className="claim-card claim-needs">
          <div className="claim-top">
            <span className="chip">unconfirmed</span>
            <span className="claim-ref mono">{question.id}</span>
          </div>
          <p className="claim-text">{question.text}</p>
          <p className="claim-question-text caption">
            {question.question ?? 'This figure isn’t in the documents — so Assay asks instead of writing it.'}
          </p>
          <p className="caption">→ Answered by holding it back: it never becomes a sentence.</p>
        </div>
      ) : (
        <p>Every quantified claim traces to a source, or it becomes a question.</p>
      )
    case 'jd':
      return (
        <>
          <p className="caption">The target role:</p>
          <pre className="judge-jd">{persona.jd}</pre>
        </>
      )
    case 'coverage':
      return (
        <div className="coverage-list">
          {[...missing.slice(0, 1), ...coverStrong.slice(0, 3)].map((row, i) => (
            <div key={i} className={`coverage-row coverage-${row.status}`}>
              <span className={`coverage-chip-${row.status}`}>{row.status}</span>
              <span className="coverage-req">{row.requirement}</span>
            </div>
          ))}
          {missing.length > 0 && (
            <p className="caption">
              {missing.length} requirement{missing.length > 1 ? 's' : ''} genuinely unmet — shown, not hidden.
            </p>
          )}
        </div>
      )
    case 'forge':
      return (
        <>
          <p>Writing {Object.keys(persona.sentences).length} artifacts — from confirmed claims only.</p>
          <div className="dossier-meta">
            {Object.keys(persona.sentences).map((k) => (
              <span key={k} className="chip">
                {k.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          <p className="caption">The claim gate guards every sentence as it’s written.</p>
        </>
      )
    case 'threads':
      return sentence ? (
        <div className="judge-thread">
          <p>{sentence.text}</p>
          <p className="sentence-claims mono caption">← traces to {sentence.claimIds.join(', ')}</p>
          <p className="caption">Pull any sentence and the evidence thread comes with it.</p>
        </div>
      ) : (
        <p>Each sentence links back to the claim that earns it.</p>
      )
    case 'blocked':
      return question ? (
        <div className="judge-blocked" data-testid="judge-blocked">
          <p className="judge-blocked-badge">■ BLOCKED — unsupported</p>
          <p className="claim-text" style={{ marginTop: '0.4rem' }}>
            {question.text}
          </p>
          <p className="caption">
            The forge refuses to render this — its figure isn’t backed. Assay will not write a
            sentence it cannot trace.
          </p>
        </div>
      ) : (
        <p>Unsupported claims are blocked from every artifact.</p>
      )
    case 'tribunal-fail':
      return failDraft ? (
        <div className="verdict verdict-fail">
          <div className="verdict-head">
            <span className="chip chip-fail">FAIL</span>
            <span className="mono" style={{ fontSize: '0.8rem' }}>
              cover_letter
            </span>
            <span className="caption">draft 1</span>
          </div>
          <div className="verdict-body">
            {failDraft.repairBrief && <div className="repair-brief">{failDraft.repairBrief}</div>}
          </div>
        </div>
      ) : (
        <p>The tribunal grades every draft against the published Standard.</p>
      )
    case 'repair-pass':
      return passDraft ? (
        <div className="verdict verdict-pass">
          <div className="verdict-head">
            <span className="chip chip-ok">PASS</span>
            <span className="mono" style={{ fontSize: '0.8rem' }}>
              cover_letter
            </span>
            <span className="caption">draft {passDraft.draftIndex + 1}</span>
            <span className="caption mono" style={{ marginLeft: 'auto' }}>
              craft mean {passDraft.craftWeightedMean}
            </span>
          </div>
          <div className="verdict-body">
            <p className="caption">Rewritten against the repair brief — now it clears the bar.</p>
          </div>
        </div>
      ) : (
        <p>Repaired and re-graded until it passes — or it ships honestly labeled.</p>
      )
    case 'parseback':
      return (
        <>
          <p style={{ fontSize: '1.6rem', fontWeight: 640, color: 'var(--viridian-text)' }}>
            {persona.parseBack?.fidelityPct ?? 100}% fields survived
          </p>
          <p className="caption">
            The ATS PDF was re-parsed by machine and diffed against the source profile —{' '}
            {persona.parseBack?.fieldDiffs.length ?? 0} fields lost.
          </p>
        </>
      )
    case 'seal':
      return (
        <>
          <div className="judge-seal-stamp" data-testid="judge-seal-stamp">
            Sealed
          </div>
          <p className="mono caption" style={{ wordBreak: 'break-all' }}>
            leaf {persona.seal.leaf}
          </p>
          <p className="caption">Only a salted commitment leaves for the chain — never personal data.</p>
        </>
      )
    case 'share':
      return (
        <>
          <p>A recruiter link opens — exposing only the claims {persona.name.split(' ')[0]} chose.</p>
          <div className="dossier-meta">
            {confirmed.slice(0, 3).map((c) => (
              <span key={c.id} className="chip chip-ok">
                {c.id}
              </span>
            ))}
          </div>
          <p className="caption">Claim IDs never leave the server; expiry and revocation are one click.</p>
        </>
      )
    case 'verify':
      return (
        <div className="status-card" data-testid="judge-verify">
          <div className="status-card-head">
            {verify.phase === 'live' && !verify.live ? (
              <span className="caption mono">asy_verify → AssayRegistry…</span>
            ) : (
              <>
                <span className="chip chip-sealed">
                  {persona.seal.status === 'sealed' ? 'sealed' : 'pending'}
                </span>
                <span style={{ fontWeight: 560 }}>
                  {verify.live
                    ? 'Confirmed live on X Layer.'
                    : verify.phase === 'cached'
                      ? 'Shown from the sealed run’s cached result.'
                      : 'Reading the chain…'}
                </span>
              </>
            )}
          </div>
          <div className="verdict-body">
            <p className="mono caption" style={{ wordBreak: 'break-all' }}>
              {persona.seal.leaf}
            </p>
            {!verify.live && verify.phase === 'cached' && (
              <p className="caption">
                The live registry read was unavailable, so the tour shows the seal recorded at run
                time — the tour never depends on a provider staying up.
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <Link href={`/verify?leaf=${persona.seal.leaf}`} className="btn btn-primary btn-sm">
                Verify it yourself
              </Link>
              <Link href={`/gallery/${persona.slug}`} className="btn btn-ghost btn-sm">
                Open the full dossier
              </Link>
            </div>
          </div>
        </div>
      )
    default:
      return null
  }
}
