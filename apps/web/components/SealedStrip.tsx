'use client'

import { useEffect, useState } from 'react'

interface SealItem {
  ref: string
  sealStatus: 'pending' | 'sealed'
  standardVersion: string
  day: string
}

// The live strip of recently sealed dossiers — anonymized upstream (truncated id, status, standard
// version, day). Real data or an honest quiet state; never invented entries (guardrail #7).
export function SealedStrip() {
  const [items, setItems] = useState<SealItem[] | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/recent-seals')
      .then((r) => (r.ok ? r.json() : { recent: [] }))
      .then((b: { recent: SealItem[] }) => {
        if (alive) setItems(Array.isArray(b.recent) ? b.recent : [])
      })
      .catch(() => {
        if (alive) setItems([])
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="sealed-strip" data-testid="sealed-strip" aria-label="Recently sealed dossiers">
      <span className="overline sealed-strip-label">Ledger · recent seals</span>
      <div className="sealed-strip-track" tabIndex={0} aria-label="Scrollable recent seal entries">
        {items === null ? (
          <span className="caption">reading the registry…</span>
        ) : items.length === 0 ? (
          <span className="caption">
            The ledger is quiet — the next sealed dossier appears here.
          </span>
        ) : (
          items.map((it, i) => (
            <span key={i} className="sealed-strip-item mono">
              {it.ref}
              <span
                className={`sealed-dot ${it.sealStatus === 'sealed' ? 'sealed-dot-on' : ''}`}
                aria-hidden="true"
              />
              {it.sealStatus} · {it.standardVersion} · {it.day}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
