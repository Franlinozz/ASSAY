'use client'

import type { StudioState, Report } from '../../lib/studio'
import type { StudioActions } from './StudioWorkspace'
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
  const ungraded = report.gradeStatus === 'ungraded'
  const notDelivered = report.gradeStatus === 'not_delivered'
  const verdict = ungraded
    ? 'UNGRADED'
    : notDelivered
      ? 'NOT DELIVERED'
      : report.pass
        ? 'PASS'
        : 'FAIL'
  return (
    <div
      className={`verdict ${report.pass ? 'verdict-pass' : 'verdict-fail'}`}
      data-testid="verdict-card"
    >
      <div className="verdict-head">
        <span className={`chip ${report.pass ? 'chip-ok' : 'chip-fail'}`}>{verdict}</span>
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
            <p className="overline">Stage 5 · the Report</p>
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
  const finalReports = [...byArtifact.values()].map((reports) =>
    [...reports].sort((a, b) => a.draftIndex - b.draftIndex).at(-1)!,
  )
  const inputBlockers = finalReports.flatMap((report) =>
    report.hard.flatMap((check) =>
      check.status === 'fail'
        ? check.findings
            .filter((finding) =>
              ['DEAD_LINK', 'INVALID_CONTACT_URL', 'DANGLING_EVIDENCE', 'UNREADABLE_FILE'].includes(
                finding.code,
              ),
            )
            .map((finding) => ({ ...finding, artifactId: report.artifactId }))
        : [],
    ),
  )
  const uniqueBlockers = [
    ...new Map(
      inputBlockers.map((finding) => [`${finding.code}:${finding.ref ?? finding.detail}`, finding]),
    ).values(),
  ]
  const inputBlockedArtifacts = new Set(inputBlockers.map((finding) => finding.artifactId)).size

  return (
    <div className="stage">
      <header className="stage-header">
        <div>
          <p className="overline">Stage 5 · the Report</p>
          <h2>The Tribunal&rsquo;s verdict.</h2>
          <p className="stage-lede">
            Every artifact graded against the published Standard — draft by draft, findings and all.
            Consensus is next; the X Layer seal follows only after GenLayer finality.
          </p>
        </div>
      </header>

      <div className="pass-rule" data-testid="report-rollup">
        <div>
          <span className="mono">
            {rollup.finalPassed}/{rollup.gradedArtifacts}
          </span>
          <span className="caption">passed of artifacts actually graded.</span>
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
        {rollup.ungraded > 0 || rollup.notDelivered > 0 ? (
          <div data-testid="honest-exclusions">
            <span className="mono">
              {rollup.ungraded} ungraded · {rollup.notDelivered} not delivered
            </span>
            <span className="caption">excluded from pass-rate math; never inferred as PASS.</span>
          </div>
        ) : null}
      </div>

      {uniqueBlockers.length > 0 ? (
        <section className="report-input-blocker" data-testid="report-input-blocker">
          <div className="report-input-icon" aria-hidden="true">
            !
          </div>
          <div>
            <p className="overline">Input blocker · not a verdict on your experience</p>
            <h3>
              {uniqueBlockers.length} source issue{uniqueBlockers.length === 1 ? '' : 's'} affected{' '}
              {inputBlockedArtifacts} artifact{inputBlockedArtifacts === 1 ? '' : 's'}.
            </h3>
            <p className="caption">
              The Tribunal was right to stop these drafts, but the Studio should not have allowed
              unresolved profile metadata to reach the Forge. New and re-forged versions quarantine
              these links before writing.
            </p>
            <ul className="report-input-list">
              {uniqueBlockers.map((finding) => (
                <li key={`${finding.code}:${finding.ref ?? finding.detail}`}>
                  <span className="finding-code">{finding.code}</span>
                  <span>
                    {finding.ref ? `${finding.ref} — ` : ''}
                    {finding.detail}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => actions.goTo('forge')}
            >
              Re-forge a clean version
            </button>
          </div>
        </section>
      ) : null}

      {state.versions.length > 0 ? (
        <section className="parseback" data-testid="version-lineage">
          <p className="overline" style={{ marginBottom: '0.5rem' }}>
            Version lineage
          </p>
          <p className="caption">
            {state.versions.map((version) => (
              <span className="mono" key={version.version} style={{ marginRight: '0.8rem' }}>
                v{version.version}
                {version.sealStatus ? ` · ${version.sealStatus}` : ' · unsealed'}
              </span>
            ))}
          </p>
          {state.compare ? (
            <div style={{ marginTop: '0.8rem' }}>
              <p className="caption">
                v{state.compare.from} → v{state.compare.to}:{' '}
                {state.compare.artifacts.filter((a) => a.scoreDelta !== 0).length} score changes
              </p>
              {state.compare.artifacts
                .filter((artifact) =>
                  Boolean(
                    artifact.added.length || artifact.removed.length || artifact.scoreDelta !== 0,
                  ),
                )
                .map((artifact) => (
                  <p className="caption mono" key={artifact.id}>
                    {artifact.id}: {artifact.added.length}+ / {artifact.removed.length}− · craft{' '}
                    {artifact.scoreDelta >= 0 ? '+' : ''}
                    {artifact.scoreDelta}
                  </p>
                ))}
            </div>
          ) : (
            <p className="caption" style={{ marginTop: '0.5rem' }}>
              Re-forge after changing the ledger or brief to create v2 and unlock comparison.
            </p>
          )}
        </section>
      ) : null}

      <div className="report-list">
        {ordered.map(([artifactId, drafts]) => {
          const history = [...drafts].sort((a, b) => a.draftIndex - b.draftIndex)
          const final = history.at(-1)!
          const previous = history.slice(0, -1)
          return (
            <section key={artifactId} className="report-artifact">
              <div className="report-artifact-head">
                <div>
                  <span className="overline">Artifact verdict</span>
                  <h3>
                    {FILE_LABEL[artifactId]?.replace(/\s*\([^)]*\)$/, '') ??
                      artifactId.replace(/_/g, ' ')}
                  </h3>
                </div>
                <span className="caption mono">
                  final draft {final.draftIndex + 1} · {final.standardVersion}
                </span>
              </div>
              <VerdictCard report={final} />
              {previous.length > 0 ? (
                <details className="report-history">
                  <summary>
                    <span>
                      Show {previous.length} earlier draft{previous.length === 1 ? '' : 's'}
                    </span>
                    <span className="caption">Failures retained for audit</span>
                  </summary>
                  <div className="report-history-list">
                    {previous.map((report) => (
                      <VerdictCard key={report.draftIndex} report={report} />
                    ))}
                  </div>
                </details>
              ) : null}
            </section>
          )
        })}
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

      <div className="stage-footer">
        <button type="button" className="btn btn-ghost" onClick={() => actions.goTo('forge')}>
          ← Back to the Forge
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="to-consensus"
          onClick={() => actions.goTo('consensus')}
        >
          Continue to Consensus →
        </button>
      </div>
    </div>
  )
}
