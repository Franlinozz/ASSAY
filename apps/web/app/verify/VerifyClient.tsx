'use client'

import { useEffect, useRef, useState } from 'react'
import { SITE } from '../../lib/site'

interface VerifyResult {
  summary?: string
  ok?: boolean
  found?: boolean
  leaf?: string
  sealStatus?: string
  anchoredAt?: string | null
  chainId?: number
  registry?: string
  explorerLink?: string
  refused?: boolean
  error?: string
  lineage?: Array<{
    version: number
    sealStatus: string | null
    leaf: string | null
    createdAt: string
  }>
}

type State = { phase: 'idle' } | { phase: 'checking' } | { phase: 'done'; result: VerifyResult }

export function VerifyClient({ prefill, auto }: { prefill?: string; auto?: boolean } = {}) {
  const [input, setInput] = useState(prefill ?? '')
  const [state, setState] = useState<State>({ phase: 'idle' })
  const ranAuto = useRef(false)

  const check = async (override?: string) => {
    const value = (override ?? input).trim()
    if (!value) return
    setState({ phase: 'checking' })
    const isLeaf = /^0x[0-9a-fA-F]{64}$/.test(value)
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(isLeaf ? { leaf: value } : { dossierId: value }),
      })
      const body = (await res.json()) as VerifyResult
      setState({ phase: 'done', result: body })
    } catch {
      setState({ phase: 'done', result: { error: 'verification unavailable right now' } })
    }
  }

  // Auto-run when arriving from a "verify this seal" link (?leaf=… or a persona's verify button).
  useEffect(() => {
    if (auto && prefill && !ranAuto.current) {
      ranAuto.current = true
      void check(prefill)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, prefill])

  const r = state.phase === 'done' ? state.result : null
  const status = r?.error
    ? 'unavailable'
    : r?.found
      ? 'sealed'
      : r?.sealStatus === 'pending'
        ? 'pending'
        : r
          ? 'not-found'
          : null

  return (
    <div className="stack-lg" style={{ maxWidth: '46rem' }}>
      <form
        className="verify-form"
        onSubmit={(e) => {
          e.preventDefault()
          void check()
        }}
      >
        <label htmlFor="verify-input" className="visually-hidden">
          Dossier ID or commitment leaf
        </label>
        <input
          id="verify-input"
          className="verify-input"
          data-testid="verify-input"
          placeholder="DSR-… or 0x… leaf"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-primary"
          data-testid="verify-submit"
          disabled={state.phase === 'checking' || !input.trim()}
        >
          {state.phase === 'checking' ? 'Reading the chain…' : 'Verify on X Layer'}
        </button>
      </form>

      {state.phase === 'checking' && (
        <p className="caption mono" role="status">
          asy_verify → AssayRegistry ({SITE.network})…
        </p>
      )}

      {r && (
        <div className="status-card" data-testid="verify-result" data-status={status}>
          <div className="status-card-head">
            {status === 'sealed' ? (
              <>
                <span className="chip chip-sealed">sealed</span>
                <span style={{ fontWeight: 560 }}>Anchored on X Layer.</span>
              </>
            ) : status === 'pending' ? (
              <>
                <span className="chip">pending</span>
                <span style={{ fontWeight: 560 }}>
                  Sealed locally — anchoring to the chain is in progress.
                </span>
              </>
            ) : status === 'not-found' ? (
              <>
                <span className="chip chip-fail">not found</span>
                <span style={{ fontWeight: 560 }}>The registry has no record of this leaf.</span>
              </>
            ) : (
              <>
                <span className="chip chip-fail">unavailable</span>
                <span style={{ fontWeight: 560 }}>{r.error}</span>
              </>
            )}
          </div>
          {!r.error && (
            <div className="verdict-body">
              {r.leaf && (
                <div className="receipt-line">
                  <span className="caption">Commitment leaf</span>
                  <span className="mono">{r.leaf}</span>
                </div>
              )}
              {r.anchoredAt && (
                <div className="receipt-line">
                  <span className="caption">Anchored at</span>
                  <span className="mono">{new Date(r.anchoredAt).toLocaleString()}</span>
                </div>
              )}
              <div className="receipt-line">
                <span className="caption">Registry</span>
                <a className="mono" href={r.explorerLink ?? SITE.explorerRegistry} rel="noopener">
                  {r.registry ?? SITE.registry}
                </a>
              </div>
              {r.lineage && r.lineage.length > 0 ? (
                <div className="receipt-line" data-testid="verify-lineage">
                  <span className="caption">Version lineage</span>
                  <span className="mono">
                    {r.lineage
                      .map((version) => `v${version.version} ${version.sealStatus ?? 'unsealed'}`)
                      .join(' · ')}
                  </span>
                </div>
              ) : null}
              <div className="receipt-line">
                <span className="caption">Network</span>
                <span className="mono">X Layer · eip155:{r.chainId ?? SITE.chainId}</span>
              </div>
              <p className="caption" style={{ marginTop: '0.8rem' }}>
                {status === 'sealed'
                  ? 'This proves the dossier manifest is unchanged since sealing — it does not, by itself, prove any claim inside it. Each claim carries its own evidence tier.'
                  : status === 'pending'
                    ? 'The anchor worker batches seals to the registry. Check back shortly — or verify the leaf directly once anchored.'
                    : 'Nothing with this reference has been anchored. If the dossier was just sealed, the anchor may still be pending.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
