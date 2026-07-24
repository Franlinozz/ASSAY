'use client'

import { useRef, useState } from 'react'
import type { StudioState, StudioClaim } from '../../lib/studio'
import type { StudioActions } from './StudioWorkspace'
import { TierChip } from '../TierChip'

const MAX_BYTES = 8 * 1024 * 1024
type Intake = 'upload' | 'text' | 'links' | 'answers'

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result)
      resolve(s.slice(s.indexOf(',') + 1))
    }
    r.onerror = () => reject(new Error('could not read file'))
    r.readAsDataURL(file)
  })
}

function highlightNumbers(text: string, facts: StudioClaim['numericFacts']): React.ReactNode {
  if (facts.length === 0) return text
  const values = facts.map((f) => String(f.value))
  const re = new RegExp(
    `(${values.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g',
  )
  const parts = text.split(re)
  return parts.map((p, i) =>
    values.includes(p) ? (
      <mark key={i} className="num-fact">
        {p}
      </mark>
    ) : (
      p
    ),
  )
}

function ClaimCard({ claim, actions }: { claim: StudioClaim; actions: StudioActions }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(claim.text)
  const [answer, setAnswer] = useState('')
  const needs = claim.status === 'needs_confirmation'

  return (
    <div
      className={`claim-card claim-${claim.status}`}
      data-testid="claim-card"
      data-status={claim.status}
    >
      <div className="claim-top">
        <TierChip tier={claim.tier} />
        <span className="claim-tier-note caption">{claim.tierExplanation}</span>
      </div>

      {editing ? (
        <textarea
          className="claim-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          aria-label="Edit claim"
        />
      ) : (
        <p className="claim-text">{highlightNumbers(claim.text, claim.numericFacts)}</p>
      )}

      {needs ? (
        <div className="claim-question">
          <p className="caption claim-question-text">
            {claim.question ?? 'Which number is correct here, and where is it from?'}
          </p>
          <input
            className="field-input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="e.g. 38% — from my 2023 performance review"
            data-testid="claim-answer"
            aria-label="Confirm the figure"
          />
        </div>
      ) : null}

      <div className="claim-actions">
        {editing ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={async () => {
                await actions.confirmClaim(claim.id, 'edit', { text: draft })
                setEditing(false)
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEditing(false)
                setDraft(claim.text)
              }}
            >
              Cancel
            </button>
          </>
        ) : claim.status === 'confirmed' ? (
          <>
            <span className="claim-confirmed mono">✓ confirmed</span>
            <button
              type="button"
              className="claim-link"
              onClick={() => actions.confirmClaim(claim.id, 'reject')}
            >
              set aside
            </button>
          </>
        ) : claim.status === 'rejected' ? (
          <>
            <span className="claim-rejected mono">set aside</span>
            <button
              type="button"
              className="claim-link"
              onClick={() => actions.confirmClaim(claim.id, 'confirm')}
            >
              restore
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              data-testid="claim-confirm"
              disabled={needs && !answer.trim()}
              onClick={() => actions.confirmClaim(claim.id, 'confirm', needs ? { answer } : {})}
            >
              Confirm
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="claim-link"
              onClick={() => actions.confirmClaim(claim.id, 'reject')}
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function LedgerStage({ state, actions }: { state: StudioState; actions: StudioActions }) {
  const [intake, setIntake] = useState<Intake>('upload')
  const [text, setText] = useState('')
  const [links, setLinks] = useState('')
  const [answers, setAnswers] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const active = state.claims.filter((c) => c.status !== 'rejected')
  const denom = active.length || 1
  const pct = Math.round((state.counts.confirmed / denom) * 100)
  const canContinue = state.counts.confirmed > 0

  const onFiles = async (files: FileList | null) => {
    setLocalError(null)
    const file = files?.[0]
    if (!file) return
    if (file.size > MAX_BYTES) return setLocalError('that file is over 8MB — please trim it')
    try {
      const contentB64 = await readAsBase64(file)
      await actions.runIngest({ kind: 'document', filename: file.name, contentB64 })
    } catch {
      setLocalError('could not read that file — try plain text')
    }
  }

  return (
    <div className="stage">
      <header className="stage-header">
        <div>
          <p className="overline">Stage 1 · the Ledger</p>
          <h2>File your evidence.</h2>
          <p className="stage-lede">
            Drop in what you have. Assay reads it, lifts the claims, and files each with the tier
            its proof earns. Nothing advances to the Forge until you&rsquo;ve confirmed it.
          </p>
        </div>
      </header>

      {/* intake */}
      <div className="intake">
        <div className="intake-tabs" role="tablist" aria-label="Add evidence">
          {(['upload', 'text', 'links', 'answers'] as Intake[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={intake === t}
              className={`intake-tab ${intake === t ? 'intake-tab-on' : ''}`}
              onClick={() => setIntake(t)}
            >
              {t === 'upload'
                ? 'Upload'
                : t === 'text'
                  ? 'Paste text'
                  : t === 'links'
                    ? 'Add links'
                    : 'Guided answers'}
            </button>
          ))}
        </div>

        {intake === 'upload' ? (
          <div
            className={`dropzone ${dragOver ? 'dropzone-over' : ''}`}
            data-testid="dropzone"
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              void onFiles(e.dataTransfer.files)
            }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              hidden
              data-testid="file-input"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <p className="dropzone-title">Drop a résumé or document here</p>
            <p className="caption">PDF, DOCX, TXT or Markdown · up to 8MB</p>
          </div>
        ) : intake === 'text' ? (
          <div className="intake-body">
            <textarea
              className="field-input intake-textarea"
              data-testid="intake-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste your résumé text, project notes, or achievements…"
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!text.trim() || actions.busy}
              onClick={async () => {
                await actions.runIngest({ kind: 'document', filename: 'notes.txt', text })
                setText('')
              }}
            >
              Read it
            </button>
          </div>
        ) : intake === 'links' ? (
          <div className="intake-body">
            <textarea
              className="field-input intake-textarea"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              rows={4}
              placeholder="One URL per line — GitHub, a portfolio, a published talk…"
            />
            <p className="caption">
              We fetch each link live. A dead link never earns a Linked tier.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!links.trim() || actions.busy}
              onClick={async () => {
                const list = links
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean)
                await actions.runIngest({ kind: 'links', links: list })
                setLinks('')
              }}
            >
              Check &amp; add
            </button>
          </div>
        ) : (
          <div className="intake-body">
            <textarea
              className="field-input intake-textarea"
              value={answers}
              onChange={(e) => setAnswers(e.target.value)}
              rows={6}
              placeholder="Tell us about your work in your own words — roles, wins, numbers you can stand behind…"
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!answers.trim() || actions.busy}
              onClick={async () => {
                await actions.runIngest({ kind: 'answers', answers })
                setAnswers('')
              }}
            >
              Add my answers
            </button>
          </div>
        )}
        {localError ? <p className="field-error">{localError}</p> : null}
      </div>

      {/* progress */}
      {state.claims.length > 0 ? (
        <div className="ledger-progress" data-testid="ledger-progress">
          <div className="ledger-progress-head">
            <span className="overline">Claims confirmed</span>
            <span className="mono">
              {state.counts.confirmed} / {active.length}
              {state.counts.needsConfirmation > 0
                ? ` · ${state.counts.needsConfirmation} need a number`
                : ''}
            </span>
          </div>
          <div className="meter">
            <span className="meter-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {/* claim cards */}
      {active.length > 0 ? (
        <div className="claim-grid">
          {[...active]
            .sort((a, b) => rank(a.status) - rank(b.status))
            .map((c) => (
              <ClaimCard key={c.id} claim={c} actions={actions} />
            ))}
        </div>
      ) : (
        <div className="ledger-empty">
          <p className="caption">
            Your claims will appear here as review cards — confirm, edit, or set each aside.
          </p>
        </div>
      )}

      <div className="stage-footer">
        <button
          type="button"
          className="btn btn-primary"
          data-testid="to-brief"
          disabled={!canContinue}
          onClick={() => actions.goTo('brief')}
        >
          Continue to the Brief →
        </button>
        {!canContinue ? (
          <span className="caption">Confirm at least one claim to continue.</span>
        ) : null}
      </div>
    </div>
  )
}

function rank(status: string): number {
  return status === 'needs_confirmation' ? 0 : status === 'extracted' ? 1 : 2
}
