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
  const [mode, setMode] = useState<'job' | 'promotion' | 'freelance'>(state.variant ?? 'job')
  const [dateFrom, setDateFrom] = useState('2025-01')
  const [dateTo, setDateTo] = useState('2026-07')
  const [projects, setProjects] = useState<Set<string>>(
    new Set(state.claims.filter((c) => c.status === 'confirmed').map((c) => c.id)),
  )
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
            Choose the case you are building. Assay maps the brief to confirmed evidence—whether the
            next step is a job, a promotion, or a client.
          </p>
        </div>
      </header>

      <div className="brief-input">
        <div className="brief-presets" role="tablist" aria-label="Dossier variant">
          {(
            [
              ['job', 'Job search'],
              ['promotion', 'Promotion case'],
              ['freelance', 'Client brief'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`preset ${mode === id ? 'preset-on' : ''}`}
              aria-pressed={mode === id}
              data-testid={`brief-mode-${id}`}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'promotion' ? (
          <div className="field-grid" data-testid="promotion-range">
            <label className="field">
              <span className="field-label">Review starts</span>
              <input
                className="field-input"
                type="month"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Review ends</span>
              <input
                className="field-input"
                type="month"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
          </div>
        ) : null}
        {mode === 'freelance' ? (
          <fieldset className="share-fieldset" data-testid="project-claims">
            <legend className="share-legend">Work samples for this client</legend>
            {state.claims
              .filter((c) => c.status === 'confirmed')
              .map((c) => (
                <label key={c.id} className="share-check">
                  <input
                    type="checkbox"
                    checked={projects.has(c.id)}
                    onChange={() =>
                      setProjects((old) => {
                        const next = new Set(old)
                        next.has(c.id) ? next.delete(c.id) : next.add(c.id)
                        return next
                      })
                    }
                  />
                  <span>{c.text}</span>
                </label>
              ))}
          </fieldset>
        ) : null}
        <textarea
          className="field-input brief-textarea"
          data-testid="brief-jd"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={7}
          placeholder={
            mode === 'job'
              ? 'Paste the job description here…'
              : mode === 'promotion'
                ? 'Name the level and expectations you are making the case for…'
                : 'Paste the client brief, deliverables, and constraints…'
          }
        />
        <button
          type="button"
          className="btn btn-primary"
          data-testid="brief-submit"
          disabled={!jd.trim() || actions.busy}
          onClick={() =>
            actions.runBriefMode({
              text: jd,
              mode,
              ...(mode === 'promotion' ? { dateFrom, dateTo } : {}),
              ...(mode === 'freelance' ? { projectClaimIds: [...projects] } : {}),
            })
          }
        >
          {actions.busy ? 'Mapping…' : state.brief ? 'Re-map case' : 'Map this case'}
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
          onClick={() => actions.goTo('interview')}
        >
          Continue to Interview →
        </button>
      </div>
    </div>
  )
}
