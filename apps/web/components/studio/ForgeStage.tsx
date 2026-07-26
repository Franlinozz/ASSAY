'use client'

import { useState } from 'react'
import type { StudioState } from '../../lib/studio'
import type { StudioActions } from './StudioWorkspace'
import { EvidenceDrawer } from './EvidenceDrawer'

const DEFAULT_ARTIFACTS = [
  { id: 'resume_ats', label: 'ATS résumé' },
  { id: 'resume_designed', label: 'Designed résumé' },
  { id: 'resume_docx', label: 'Word .docx' },
  { id: 'cover_letter', label: 'Cover letter' },
  { id: 'story_bank', label: 'Story bank' },
  { id: 'fit_map', label: 'Fit map' },
  { id: 'gap_brief', label: 'Gap brief' },
  { id: 'portfolio_page', label: 'Portfolio page' },
  { id: 'manifest_json', label: 'Agent manifest' },
]

const PROMOTION_ARTIFACTS = [
  { id: 'promotion_narrative', label: 'Review narrative' },
  { id: 'promotion_memo', label: 'Promotion memo' },
  { id: 'manager_one_pager', label: 'Manager one-pager' },
  { id: 'manifest_json', label: 'Agent manifest' },
]

const FREELANCE_ARTIFACTS = [
  { id: 'capability_statement', label: 'Capability statement' },
  { id: 'case_studies', label: 'Relevant case studies' },
  { id: 'proposal_letter', label: 'Proposal letter' },
  { id: 'manifest_json', label: 'Agent manifest' },
]

export function ForgeStage({ state, actions }: { state: StudioState; actions: StudioActions }) {
  const available =
    state.variant === 'promotion'
      ? PROMOTION_ARTIFACTS
      : state.variant === 'freelance'
        ? FREELANCE_ARTIFACTS
        : DEFAULT_ARTIFACTS
  const [selected, setSelected] = useState<Set<string>>(new Set(available.map((a) => a.id)))
  const unresolved = state.claims.filter(
    (c) => c.status === 'extracted' || c.status === 'needs_confirmation',
  )
  const forge = state.forge
  const proseArtifacts = forge?.artifacts.filter((a) => a.sentences.length > 0) ?? []
  const [preview, setPreview] = useState<string>('')
  // The forge arrives after mount, so derive the shown tab: honor a user pick, else the first.
  const activePreview = proseArtifacts.some((a) => a.id === preview)
    ? preview
    : (proseArtifacts[0]?.id ?? '')

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  return (
    <div className="stage">
      <header className="stage-header">
        <div>
          <p className="overline">Stage 4 · the Forge</p>
          <h2>Write the dossier.</h2>
          <p className="stage-lede">
            Every sentence is generated against a confirmed claim and checked before it renders.
            Anything that can&rsquo;t be traced becomes a question, never prose.
          </p>
        </div>
      </header>

      {unresolved.length > 0 ? (
        <div className="forge-gate" data-testid="forge-gate">
          <p>
            <strong>
              {unresolved.length} claim{unresolved.length === 1 ? '' : 's'}
            </strong>{' '}
            still need your confirmation. The Forge only draws on evidence you&rsquo;ve stood
            behind.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => actions.goTo('ledger')}
          >
            ← Resolve them in the Ledger
          </button>
        </div>
      ) : (
        <>
          <div className="artifact-select">
            <p className="overline" style={{ marginBottom: '0.7rem' }}>
              Artifacts to forge
            </p>
            <div className="artifact-chips">
              {available.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`artifact-chip ${selected.has(a.id) ? 'artifact-chip-on' : ''}`}
                  aria-pressed={selected.has(a.id)}
                  disabled={actions.busy}
                  onClick={() => toggle(a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="run-forge"
              style={{ marginTop: '1.1rem' }}
              disabled={actions.busy || selected.size === 0}
              onClick={() => actions.runForge([...selected])}
            >
              {actions.busy
                ? 'Forging…'
                : forge
                  ? 'Re-forge'
                  : `Forge ${selected.size} artifact${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>

          {state.stage === 'forging' || actions.busy ? (
            <section className="forge-live" data-testid="forge-live">
              <div className="forge-live-orbit" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div>
                <p className="overline">Forge and Tribunal are in session</p>
                <h3>Your dossier is moving through the bench.</h3>
                <p className="caption">
                  Drafting, Chromium rendering, deterministic checks, critic review, and bounded
                  repairs happen artifact by artifact. Follow the Run monitor for live progress. The
                  server keeps working if you leave and return with this private link.
                </p>
              </div>
            </section>
          ) : null}

          {forge ? (
            <div className="forge-result" data-testid="forge-result">
              {forge.gaps && forge.gaps.length > 0 ? (
                <div className="forge-questions" data-testid="forge-coverage-notes">
                  <p className="overline">Coverage notes — degraded with dignity</p>
                  {forge.gaps.map((gap, i) => (
                    <p className="forge-question caption" key={`${gap.code}-${i}`}>
                      <span className="mono">{gap.code}</span> · {gap.message}
                    </p>
                  ))}
                </div>
              ) : null}
              {forge.artifacts
                .filter((a) => a.deliveryStatus === 'not_delivered')
                .map((a) => (
                  <div className="forge-gate" data-testid="artifact-not-delivered" key={a.id}>
                    <p>
                      <strong>{a.kind.replace(/_/g, ' ')}</strong> — not delivered.
                    </p>
                    <p className="caption">
                      {a.coverageNote ??
                        'The artifact file is unavailable. It is excluded from pass-rate math.'}
                    </p>
                  </div>
                ))}
              {proseArtifacts.length > 0 ? (
                <>
                  <div className="preview-tabs">
                    {proseArtifacts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`preview-tab ${activePreview === a.id ? 'preview-tab-on' : ''}`}
                        onClick={() => setPreview(a.id)}
                      >
                        {a.kind.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  {proseArtifacts
                    .filter((a) => a.id === activePreview)
                    .map((a) => (
                      <div key={a.id} className="drawer-wrap card-paper">
                        <EvidenceDrawer
                          artifact={a}
                          claims={state.claims}
                          evidence={state.evidence}
                        />
                      </div>
                    ))}
                </>
              ) : null}

              {forge.questions.length > 0 ? (
                <div className="forge-questions">
                  <p className="overline">Open questions — surfaced, not invented</p>
                  {forge.questions.slice(0, 5).map((q, i) => (
                    <p key={i} className="forge-question caption">
                      {q}
                    </p>
                  ))}
                  <button
                    type="button"
                    className="claim-link"
                    onClick={() => actions.goTo('ledger')}
                  >
                    Add the missing evidence in the Ledger →
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="ledger-empty">
              <p className="caption">
                Your forged artifacts and their evidence threads appear here.
              </p>
            </div>
          )}
        </>
      )}

      <div className="stage-footer">
        <button type="button" className="btn btn-ghost" onClick={() => actions.goTo('interview')}>
          ← Back to Interview
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="to-report"
          disabled={!forge}
          onClick={() => actions.goTo('report')}
        >
          Continue to the Report →
        </button>
      </div>
    </div>
  )
}
