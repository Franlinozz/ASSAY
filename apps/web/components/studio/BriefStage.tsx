'use client'

import { useState } from 'react'
import type { StudioState, CoverageRow } from '../../lib/studio'
import type { StudioActions } from './StudioWorkspace'

const STATUS_LABEL: Record<CoverageRow['status'], string> = {
  strong: 'Strong',
  partial: 'Partial',
  confirm: 'To confirm',
  missing: 'Missing',
}

function CoverageRowView({
  row,
  claimText,
}: {
  row: CoverageRow
  claimText: (id: string) => string
}) {
  const strongest = row.claimIds[0]
  return (
    <div
      className={`coverage-row coverage-${row.status}`}
      data-testid="coverage-row"
      data-status={row.status}
    >
      <span className={`chip coverage-chip-${row.status}`}>{STATUS_LABEL[row.status]}</span>
      <div className="coverage-body">
        <p className="coverage-req">
          {row.requirement}
          {row.kind === 'must' ? <span className="coverage-must mono"> must-have</span> : null}
        </p>
        {row.status === 'missing' ? (
          <p className="coverage-gap">
            We will not claim this — your evidence doesn&rsquo;t cover it yet.
          </p>
        ) : strongest ? (
          <p className="coverage-proof caption">
            Strongest proof: &ldquo;{claimText(strongest).slice(0, 80)}…&rdquo;
          </p>
        ) : (
          <p className="coverage-proof caption">{row.note}</p>
        )}
      </div>
    </div>
  )
}

export function BriefStage({ state, actions }: { state: StudioState; actions: StudioActions }) {
  const [jd, setJd] = useState(state.brief?.jdText ?? '')
  const claimText = (id: string): string => state.claims.find((c) => c.id === id)?.text ?? id
  const coverage = state.coverage ?? []
  const counts = coverage.reduce(
    (a, c) => ({ ...a, [c.status]: (a[c.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  )

  return (
    <div className="stage">
      <header className="stage-header">
        <div>
          <p className="overline">Stage 2 · the Role Lab</p>
          <h2>Map the brief.</h2>
          <p className="stage-lede">
            Paste a job description. Assay decomposes it into requirements and maps your confirmed
            evidence to each — an honest coverage report, never a fake match score.
          </p>
        </div>
      </header>

      <div className="brief-input">
        <div className="brief-presets">
          <button
            type="button"
            className="preset"
            onClick={() => setJd('General-purpose professional résumé — no specific role.')}
          >
            General purpose
          </button>
          <button
            type="button"
            className="preset preset-soon"
            disabled
            title="Coming in a later phase"
          >
            Promotion case <span className="preset-soon-tag">soon</span>
          </button>
        </div>
        <textarea
          className="field-input brief-textarea"
          data-testid="brief-jd"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={7}
          placeholder="Paste the job description here…"
        />
        <button
          type="button"
          className="btn btn-primary"
          data-testid="brief-submit"
          disabled={!jd.trim() || actions.busy}
          onClick={() => actions.runBrief(jd)}
        >
          {actions.busy ? 'Mapping…' : state.brief ? 'Re-map' : 'Map my fit'}
        </button>
      </div>

      {coverage.length > 0 ? (
        <div className="coverage" data-testid="coverage-map">
          <div className="coverage-summary">
            <span className="coverage-stat">
              <strong>{counts['strong'] ?? 0}</strong> strong
            </span>
            <span className="coverage-stat">
              <strong>{counts['partial'] ?? 0}</strong> partial
            </span>
            <span className="coverage-stat">
              <strong>{counts['confirm'] ?? 0}</strong> to confirm
            </span>
            <span className="coverage-stat coverage-stat-missing">
              <strong>{counts['missing'] ?? 0}</strong> missing
            </span>
          </div>
          <div className="coverage-list">
            {coverage.map((row, i) => (
              <CoverageRowView key={i} row={row} claimText={claimText} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="stage-footer">
        <button type="button" className="btn btn-ghost" onClick={() => actions.goTo('ledger')}>
          ← Back to the Ledger
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="to-forge"
          disabled={!state.brief}
          onClick={() => actions.goTo('forge')}
        >
          Continue to the Forge →
        </button>
      </div>
    </div>
  )
}
