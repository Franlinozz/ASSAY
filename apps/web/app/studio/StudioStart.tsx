'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDossier } from '../../lib/studio'
import { RegCorners } from '../../components/Guilloche'

export function StudioStart() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [email, setEmail] = useState('')
  const [zones, setZones] = useState<string[]>(['UTC'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const all = (
        Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
      ).supportedValuesOf?.('timeZone')
      if (all && all.length) setZones(all)
      const guess = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (guess) setTimezone(guess)
    } catch {
      /* older engine — UTC stands */
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const created = await createDossier({
        name: name.trim(),
        timezone,
        ...(email.trim() && email.includes('@') ? { email: email.trim() } : {}),
      })
      router.push(created.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not open a dossier — please retry')
      setBusy(false)
    }
  }

  return (
    <div className="start-grid">
      <form className="card-paper start-card" onSubmit={submit}>
        <RegCorners />
        <p className="overline" style={{ marginBottom: '1.2rem' }}>
          Open a dossier
        </p>
        <label className="field">
          <span className="field-label">Your name</span>
          <input
            className="field-input"
            data-testid="start-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chidinma Eze"
            autoComplete="name"
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Timezone</span>
          <select
            className="field-input"
            data-testid="start-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <span className="field-hint">All dates in the dossier are shown in your timezone.</span>
        </label>
        <label className="field">
          <span className="field-label">
            Email <span className="field-optional">— optional</span>
          </span>
          <input
            className="field-input"
            data-testid="start-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="so we can send you the private link"
            type="email"
            autoComplete="email"
          />
          <span className="field-hint">
            Only used for your capability link. Never shared, never on-chain.
          </span>
        </label>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="btn btn-primary"
          data-testid="start-submit"
          disabled={busy || !name.trim()}
        >
          {busy ? 'Opening…' : 'Begin →'}
        </button>
      </form>

      <aside className="start-aside">
        <p className="overline">How it works</p>
        <ol className="start-steps">
          <li>
            <span className="start-step-n mono">01</span>
            <span>
              <strong>Ledger.</strong> Drop in your evidence — files, links, or answers. Assay
              extracts claims and files each with an evidence tier. You confirm what&rsquo;s true.
            </span>
          </li>
          <li>
            <span className="start-step-n mono">02</span>
            <span>
              <strong>Brief.</strong> Paste a job description. Assay maps your proof to each
              requirement — honestly, including what&rsquo;s missing.
            </span>
          </li>
          <li>
            <span className="start-step-n mono">03</span>
            <span>
              <strong>Forge.</strong> Generate the dossier. Every sentence carries a claim; click
              any line to see its proof light up.
            </span>
          </li>
          <li>
            <span className="start-step-n mono">04</span>
            <span>
              <strong>Report &amp; Seal.</strong> Read the Tribunal&rsquo;s grade, then seal on X
              Layer and share a recruiter link with evidence threads.
            </span>
          </li>
        </ol>
        <p className="caption start-privacy">
          No account. The private link Assay issues is the only key to your dossier — keep it, and
          it&rsquo;s yours to revoke.
        </p>
      </aside>
    </div>
  )
}
