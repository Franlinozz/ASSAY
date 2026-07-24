'use client'

import type { StudioState } from '../../lib/studio'

export type Stage = 'ledger' | 'brief' | 'forge' | 'report'

const STAGES: Array<{ id: Stage; label: string; sub: string }> = [
  { id: 'ledger', label: 'Ledger', sub: 'file your evidence' },
  { id: 'brief', label: 'Brief', sub: 'map the role' },
  { id: 'forge', label: 'Forge', sub: 'write the dossier' },
  { id: 'report', label: 'Report', sub: 'grade & seal' },
]

// Which stages are reachable, from the server's canonical stage.
function reached(state: StudioState | null): Record<Stage, boolean> {
  const confirmed = (state?.counts.confirmed ?? 0) > 0
  const hasBrief = !!state?.brief
  const forged = !!state?.forge
  return {
    ledger: true,
    brief: confirmed,
    forge: confirmed && hasBrief,
    report: forged,
  }
}

export function StageRail({
  state,
  active,
  onNavigate,
}: {
  state: StudioState | null
  active: Stage
  onNavigate: (s: Stage) => void
}) {
  const canReach = reached(state)
  const done: Record<Stage, boolean> = {
    ledger: (state?.counts.confirmed ?? 0) > 0,
    brief: !!state?.brief,
    forge: !!state?.forge,
    report: state?.stage === 'sealed',
  }
  return (
    <nav className="stage-rail" aria-label="Dossier stages">
      {STAGES.map((s, i) => {
        const reachable = canReach[s.id]
        return (
          <button
            key={s.id}
            type="button"
            className={`stage-node ${active === s.id ? 'stage-active' : ''} ${done[s.id] ? 'stage-done' : ''}`}
            data-testid={`stage-${s.id}`}
            aria-current={active === s.id ? 'step' : undefined}
            disabled={!reachable}
            onClick={() => reachable && onNavigate(s.id)}
          >
            <span className="stage-mark" aria-hidden="true">
              {done[s.id] ? (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path
                    d="M2.5 6.5 L5 9 L9.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span className="mono">{i + 1}</span>
              )}
            </span>
            <span className="stage-text">
              <span className="stage-label">{s.label}</span>
              <span className="stage-sub caption">{s.sub}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
