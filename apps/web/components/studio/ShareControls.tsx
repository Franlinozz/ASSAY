'use client'

import { useState } from 'react'
import type { StudioState } from '../../lib/studio'
import type { StudioActions } from './StudioWorkspace'
import { SITE } from '../../lib/site'

// Creator controls for the recruiter link: which evidence is exposed per claim, link expiry, and
// a revoke toggle. PII exposure is enforced server-side by the recruiter view.
export function ShareControls({ state, actions }: { state: StudioState; actions: StudioActions }) {
  const confirmed = state.claims.filter((c) => c.status === 'confirmed')
  const existing = state.share
  const [exposed, setExposed] = useState<Set<string>>(
    new Set(existing?.config.exposedClaimIds ?? confirmed.map((c) => c.id)),
  )
  const [showContact, setShowContact] = useState(existing?.config.showContact ?? false)
  const [expiry, setExpiry] = useState<7 | 30 | null>(30)
  const samplesPreset = state.variant === 'freelance'
  const [copied, setCopied] = useState(false)

  const toggle = (id: string) =>
    setExposed((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const shareUrl = existing ? `${SITE.url}${existing.url}` : ''

  return (
    <div className="share-controls" data-testid="share-controls">
      <p className="overline">Share with a recruiter</p>
      <p className="caption" style={{ marginBottom: '1rem' }}>
        {samplesPreset
          ? 'Client preset: only the selected work samples and their evidence threads are exposed.'
          : 'Choose exactly what the other side sees. The link is read-only, revocable, and shows your evidence threads—never anything you did not expose.'}
      </p>

      <fieldset className="share-fieldset">
        <legend className="share-legend">Evidence to expose</legend>
        {confirmed.map((c) => (
          <label key={c.id} className="share-check">
            <input type="checkbox" checked={exposed.has(c.id)} onChange={() => toggle(c.id)} />
            <span>{c.text}</span>
          </label>
        ))}
      </fieldset>

      <label className="share-check share-check-contact">
        <input
          type="checkbox"
          checked={showContact}
          onChange={(e) => setShowContact(e.target.checked)}
        />
        <span>Show my contact email</span>
      </label>

      <div className="share-expiry">
        <span className="share-legend">Link expires</span>
        {([7, 30, null] as const).map((d) => (
          <button
            key={String(d)}
            type="button"
            className={`preset ${expiry === d ? 'preset-on' : ''}`}
            onClick={() => setExpiry(d)}
          >
            {d === null ? 'Never' : `${d} days`}
          </button>
        ))}
      </div>

      <div className="share-actions">
        <button
          type="button"
          className="btn btn-primary"
          data-testid="issue-share"
          onClick={() =>
            actions.share({
              exposedClaimIds: [...exposed],
              showContact,
              expiryDays: expiry,
              preset: samplesPreset ? 'samples' : 'recruiter',
            })
          }
        >
          {existing ? 'Update link' : 'Issue recruiter link'}
        </button>
        {existing && !existing.revoked ? (
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="revoke-share"
            onClick={() => actions.revoke()}
          >
            Revoke
          </button>
        ) : null}
      </div>

      {existing ? (
        existing.revoked ? (
          <p className="share-status share-revoked mono" data-testid="share-revoked">
            withdrawn — this link now shows a &ldquo;withdrawn by candidate&rdquo; page
          </p>
        ) : (
          <div className="share-link" data-testid="share-link">
            <a href={existing.url} rel="noopener" className="mono">
              {shareUrl}
            </a>
            <button
              type="button"
              className="copy-btn"
              onClick={() => {
                void navigator.clipboard?.writeText(shareUrl).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }}
            >
              {copied ? '✓ copied' : 'copy'}
            </button>
            {existing.expiresAt ? (
              <span className="caption">
                expires {new Date(existing.expiresAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  )
}
