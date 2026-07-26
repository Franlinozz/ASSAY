'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FeedEvent } from '../../lib/studio'

function elapsedLabel(from: string | undefined, now: number): string {
  if (!from) return 'standing by'
  const seconds = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s elapsed`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${String(remainder).padStart(2, '0')}s elapsed`
}

// The live run monitor turns the append-only event feed into an intelligible pipeline: current
// phase, honest artifact progress, elapsed time, and the underlying role/action receipt.
export function EventFeed({
  events,
  busy,
  expectedArtifacts,
}: {
  events: FeedEvent[]
  busy: boolean
  expectedArtifacts: number
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [events.length])

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [busy])

  const progress = useMemo(() => {
    let forgeStartIndex = -1
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event?.role === 'Forge' && /writing evidence-cited artifacts/i.test(event.action)) {
        forgeStartIndex = index
        break
      }
    }
    const forgeEvents = forgeStartIndex >= 0 ? events.slice(forgeStartIndex) : []
    const forgeStart = forgeEvents.at(0)
    const graded = new Set(
      forgeEvents
        .filter((event) => event.role === 'Tribunal' && /^grading /i.test(event.action))
        .map((event) => event.action.replace(/^grading /i, '').trim()),
    )
    const completeEvent = forgeEvents.find(
      (event) => event.role === 'Forge' && /artifacts? processed/i.test(event.action),
    )
    const complete = Boolean(completeEvent)
    const target = Math.max(expectedArtifacts, graded.size, 1)
    const pct = complete
      ? 100
      : forgeStart
        ? Math.min(94, Math.round(12 + (graded.size / target) * 80))
        : busy
          ? 6
          : 0
    const current = events.at(-1)
    const label = complete
      ? 'Dossier ready'
      : graded.size > 0
        ? `${graded.size} of ${target} artifacts reached the Tribunal`
        : forgeStart
          ? 'Drafting the evidence-cited artifact set'
          : busy
            ? 'Preparing the next operation'
            : 'No operation running'
    return { forgeStart, completeEvent, graded: graded.size, complete, pct, current, label }
  }, [events, busy, expectedArtifacts])

  const visibleEvents = events.slice(-14)

  return (
    <div
      className={`feed${busy ? ' feed-running' : ''}${progress.complete ? ' feed-complete' : ''}`}
      data-testid="event-feed"
      aria-live="polite"
    >
      <div className="feed-head">
        <div>
          <span className="overline">Run monitor</span>
          <p className="feed-headline">{busy ? 'The bench is working' : progress.label}</p>
        </div>
        <span className={`feed-pulse ${busy ? 'feed-pulse-on' : ''}`} aria-hidden="true" />
      </div>

      <div className="feed-progress" data-testid="forge-progress">
        <div className="feed-progress-meta">
          <span>{progress.label}</span>
          <span className="mono">{progress.pct}%</span>
        </div>
        <div
          className="feed-progress-track"
          role="progressbar"
          aria-label="Forge progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.pct}
        >
          <span style={{ width: `${progress.pct}%` }} />
        </div>
        <div className="feed-progress-foot caption">
          <span>
            {elapsedLabel(
              progress.forgeStart?.at,
              progress.completeEvent ? new Date(progress.completeEvent.at).getTime() : now,
            )}
          </span>
          <span>
            {busy ? 'Safe to keep this tab open or return later' : 'Every step is retained'}
          </span>
        </div>
      </div>

      <div className="feed-track">
        {events.length === 0 ? (
          <p className="caption">Each Studio action will appear here with its responsible role.</p>
        ) : (
          visibleEvents.map((e, index) => (
            <div
              key={e.id}
              className={`feed-row${index === visibleEvents.length - 1 ? ' feed-row-current' : ''}`}
            >
              <span className="feed-node" aria-hidden="true" />
              <span className="feed-role mono">{e.role}</span>
              <span className="feed-action">{e.action}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
