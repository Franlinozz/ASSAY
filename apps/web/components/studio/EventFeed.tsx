'use client'

import { useEffect, useRef } from 'react'
import type { FeedEvent } from '../../lib/studio'

// The live "role · action" feed. Labels are always specific ("Extractor · reading resume.pdf"),
// never generic noise. Auto-scrolls to the newest line.
export function EventFeed({ events, busy }: { events: FeedEvent[]; busy: boolean }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [events.length])

  return (
    <div className="feed" data-testid="event-feed" aria-live="polite">
      <div className="feed-head">
        <span className="overline">The bench</span>
        <span className={`feed-pulse ${busy ? 'feed-pulse-on' : ''}`} aria-hidden="true" />
      </div>
      <div className="feed-track">
        {events.length === 0 ? (
          <p className="caption">Every step the Studio takes shows here, named by role.</p>
        ) : (
          events.slice(-40).map((e) => (
            <div key={e.id} className="feed-row">
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
