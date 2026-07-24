'use client'

import type { StudioState, Report } from '../../lib/studio'
import type { StudioActions } from './StudioWorkspace'
import { SealMoment } from './SealMoment'
import { ShareControls } from './ShareControls'
import { STANDARD } from '../../lib/standard.generated'

const AXIS_TITLE: Record<string, string> = Object.fromEntries(
  STANDARD.craftAxes.map((a) => [a.id, a.title]),
)

const FILE_LABEL: Record<string, string> = {
  resume_ats: 'ATS résumé (PDF)',
  resume_designed: 'Designed résumé (PDF)',
  resume_docx: 'Résumé (.docx)',
  cover_letter: 'Cover letter (PDF)',
  story_bank: 'Story bank (PDF)',
  fit_map: 'Fit map (PDF)',
  gap_brief: 'Gap brief (PDF)',
  portfolio_page: 'Portfolio page (HTML)',
  manifest_json: 'Agent manifest (JSON)',
  cover: 'Cover sheet (SVG)',
}

function VerdictCard({ report }: { report: Report }) {
  const failed = report.hard.filter((h) => h.status === 'fail')
  const hasCraft = report.craft.length > 0
  return (
    <div
      className={`verdict ${report.pass ? 'verdict-pass' : 'verdict-fail'}`}
      data-testid="verdict-card"
    >
      <div className="verdict-head">
        <span className={`chip ${report.pass ? 'chip-ok' : 'chip-fail'}`}>
          {report.pass ? 'PASS' : 'FAIL'}
        </span>
        <span className="mono" style={{ fontWeight: 600 }}>
          {report.artifactId}
        </span>
        <span className="caption">draft {report.draftIndex + 1}</span>
        {hasCraft ? (
          <span className="caption mono" style={{ marginLeft: 'auto' }}>
            craft {report.craftWeightedMean}
          </span>
        ) : null}
      </div>
      <div className="verdict-body stack">
        <div>
          <p className="overline" style={{ marginBottom: '0.4rem' }}>
            Hard checks — {report.hard.filter((h) => h.status === 'pass').length} passed
            {failed.length ? ` · ${failed.length} failed` : ''}
          </p>
          {failed.length === 0 ? (
            <p className="caption">All deterministic checks passed.</p>
          ) : (
            failed.map((h) =>
              h.findings.map((f, i) => (
                <div key={`${h.id}-${i}`} className="finding">
                  <span className="finding-code">{f.code}</span>
                  <span>{f.detail}</span>
                </div>
              )),
            )
          )}
        </div>
        {hasCraft ? (
          <div>
            <p className="overline" style={{ marginBottom: '0.4rem' }}>
              Craft axes
            </p>
            {report.craft.map((c) => (
              <div key={c.axis} className="axis-bar">
                <span className="caption">{AXIS_TITLE[c.axis] ?? c.axis}</span>
                <span className="axis-track">
                  <span className="axis-fill" style={{ width: `${Math.min(c.score, 100)}%` }} />
                </span>
                <span className="mono" style={{ textAlign: 'right', fontSize: '0.75rem' }}>
                  {c.score}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {report.repairBrief ? (
          <div>
            <p className="overline" style={{ marginBottom: '0.4rem' }}>
              Repair brief
            </p>
            <div className="repair-brief">{report.repairBrief}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ReportStage({
  id,
  token,
  state,
  actions,
}: {
  id: string
  token: string
  state: StudioState
  actions: StudioActions
}) {
  void id
  void token
  const forge = state.forge
  if (!forge) {
    return (
      <div className="stage">
        <header className="stage-header">
          <div>
            <p className="overline">Stage 4 · the Report</p>
            <h2>Forge first.</h2>
            <p className="stage-lede">
              The Tribunal grades what the Forge produces — run the Forge to see reports here.
            </p>
          </div>
        </header>
        <button type="button" className="btn btn-primary" onClick={() => actions.goTo('forge')}>
          ← Back to the Forge
        </button>
      </div>
    )
  }

  const rollup = forge.rollup
  const pb = forge.parseBack
  // Story order: artifacts with the most drafts (a repair story) first.
  const byArtifact = new Map<string, Report[]>()
  for (const r of forge.reports) {
    const list = byArtifact.get(r.artifactId) ?? []
    list.push(r)
    byArtifact.set(r.artifactId, list)
  }
  const ordered = [...byArtifact.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="stage">
      <header className="stage-header">
        <div>
          <p className="overline">Stage 4 · the Report</p>
          <h2>The Tribunal&rsquo;s verdict.</h2>
          <p className="stage-lede">
            Every artifact graded against the published Standard — draft by draft, findings and all.
            Then seal it, and share.
          </p>
        </div>
      </header>

      <div className="pass-rule" data-testid="report-rollup">
        <div>
          <span className="mono">
            {rollup.finalPassed}/{rollup.artifacts}
          </span>
          <span className="caption">passed on the final draft.</span>
        </div>
        <div>
          <span className="mono">
            {rollup.firstDraftPassed}/{rollup.artifacts}
          </span>
          <span className="caption">passed on the first draft.</span>
        </div>
        <div>
          <span className="mono">{forge.reports.length}</span>
          <span className="caption">reports shipped — failures kept.</span>
        </div>
      </div>

      <div className="report-list">
        {ordered.map(([artifactId, drafts]) => (
          <div key={artifactId} className="stack">
            {drafts
              .sort((a, b) => a.draftIndex - b.draftIndex)
              .map((r) => (
                <VerdictCard key={r.draftIndex} report={r} />
              ))}
          </div>
        ))}
      </div>

      {pb ? (
        <div className="parseback">
          <p className="overline" style={{ marginBottom: '0.5rem' }}>
            ATS parse-back — every field survived machine reading
          </p>
          <p className="caption" style={{ marginBottom: '0.9rem' }}>
            Fidelity <strong style={{ color: 'var(--viridian-text)' }}>{pb.fidelityPct}%</strong> ·{' '}
            {pb.fieldDiffs.length} fields lost of {pb.fieldsChecked} checked.
          </p>
          {pb.fieldDiffs.length > 0 ? (
            <div className="table-wrap">
              <table className="office">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Expected</th>
                    <th>Parsed</th>
                  </tr>
                </thead>
                <tbody>
                  {pb.fieldDiffs.map((d, i) => (
                    <tr key={i}>
                      <td className="mono">{d.field}</td>
                      <td>{d.expected}</td>
                      <td>{d.got}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="caption">Name, email, and every role survived re-parsing intact.</p>
          )}
        </div>
      ) : null}

      {/* THE SEAL MOMENT */}
      <SealMoment seal={state.seal} busy={actions.busy} onSeal={actions.seal} />

      {/* downloads */}
      {Object.keys(forge.fileUrls).length > 0 ? (
        <div className="downloads">
          <p className="overline" style={{ marginBottom: '0.7rem' }}>
            Download
          </p>
          <div className="download-grid">
            {Object.entries(forge.fileUrls).map(([name, url]) => (
              <a key={name} href={url} className="download-item" rel="noopener" target="_blank">
                <span className="download-label">{FILE_LABEL[name] ?? name}</span>
                <span className="download-arrow" aria-hidden="true">
                  ↓
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {/* share — only once sealed */}
      {state.seal ? (
        <ShareControls state={state} actions={actions} />
      ) : (
        <p className="caption">Seal the dossier to issue a recruiter link.</p>
      )}

      <div className="stage-footer">
        <button type="button" className="btn btn-ghost" onClick={() => actions.goTo('forge')}>
          ← Back to the Forge
        </button>
      </div>
    </div>
  )
}
