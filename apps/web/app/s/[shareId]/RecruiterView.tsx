'use client'

import { useState } from 'react'
import { EvidenceThreads } from '../../../components/EvidenceThreads'
import { TierChip } from '../../../components/TierChip'
import { GuillocheBand } from '../../../components/Guilloche'
import { TIERS, type Tier, SITE } from '../../../lib/site'

export interface ShareView {
  found: boolean
  revoked?: boolean
  expired?: boolean
  expiresAt?: string | null
  candidate?: { name: string; headline: string; email?: string }
  sentences?: Array<{ text: string; claimIds: string[] }>
  claims?: Array<{ id: string; text: string; tier: Tier; tierExplanation: string }>
  threads?: {
    bullets: Array<{ id: string; text: string; evidenceIds: string[] }>
    evidence: Array<{ id: string; tier: Tier; label: string }>
  }
  grade?: { pass: number; of: number } | null
  seal?: {
    leaf: string
    chainId: number
    status: string
    registry: string
    explorerLink: string
  } | null
}

export function RecruiterView({ view }: { view: ShareView }) {
  const [verify, setVerify] = useState<{
    state: 'idle' | 'checking' | 'done'
    found?: boolean
    anchoredAt?: string | null
    error?: string
  }>({ state: 'idle' })

  const candidate = view.candidate ?? { name: 'Candidate', headline: '' }
  const threads = view.threads ?? { bullets: [], evidence: [] }
  const evidenceCards = threads.evidence.map((e) => ({
    id: e.id,
    tier: e.tier,
    label: e.label,
    detail: TIERS[e.tier]?.explanation ?? '',
  }))

  const runVerify = async () => {
    if (!view.seal?.leaf) return
    setVerify({ state: 'checking' })
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leaf: view.seal.leaf }),
      })
      const body = (await res.json()) as {
        found?: boolean
        anchoredAt?: string | null
        error?: string
      }
      setVerify({
        state: 'done',
        ...(body.found !== undefined ? { found: body.found } : {}),
        ...(body.anchoredAt !== undefined ? { anchoredAt: body.anchoredAt } : {}),
        ...(body.error ? { error: body.error } : {}),
      })
    } catch {
      setVerify({ state: 'done', error: 'verification unavailable right now' })
    }
  }

  return (
    <>
      <div className="recruiter-head">
        <div className="container recruiter-head-row">
          <div>
            <p className="overline">A sealed Career Dossier · read-only</p>
            <h1 className="recruiter-name">{candidate.name}</h1>
            {candidate.headline ? (
              <p className="lede recruiter-headline">{candidate.headline}</p>
            ) : null}
            {candidate.email ? <p className="caption mono">{candidate.email}</p> : null}
          </div>
          <div className="recruiter-badges">
            {view.grade ? (
              <span className="chip chip-ok recruiter-grade">
                Tribunal {view.grade.pass}/{view.grade.of} PASS
              </span>
            ) : null}
            {view.seal ? <span className="chip chip-sealed">sealed on X Layer</span> : null}
          </div>
        </div>
      </div>

      <GuillocheBand height={20} opacity={0.4} />

      <section className="section-tight">
        <div className="container">
          <p className="overline" style={{ marginBottom: '1.2rem' }}>
            The résumé — hover any line to see its proof
          </p>
          {threads.bullets.length > 0 ? (
            <EvidenceThreads
              heading={`${candidate.name} — résumé`}
              subheading="every line traces to evidence"
              bullets={threads.bullets}
              evidence={evidenceCards}
              testId="recruiter-threads"
            />
          ) : (
            <p className="caption">
              The candidate has not exposed line-level evidence on this link.
            </p>
          )}
        </div>
      </section>

      {view.claims && view.claims.length > 0 ? (
        <section className="section-tight">
          <div className="container">
            <p className="overline" style={{ marginBottom: '1rem' }}>
              Evidence tiers
            </p>
            <div className="recruiter-claims">
              {view.claims.map((c) => (
                <div key={c.id} className="recruiter-claim">
                  <TierChip tier={c.tier} />
                  <span>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* seal verification */}
      <section className="section-tight">
        <div className="container">
          <div className="card-paper recruiter-seal" data-testid="recruiter-seal">
            <div className="recruiter-seal-top">
              <div>
                <p className="overline">Integrity</p>
                <p className="recruiter-seal-line">
                  This dossier is integrity-anchored on X Layer. Check it yourself — no wallet, no
                  trust in us required.
                </p>
              </div>
              {view.seal ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid="recruiter-verify"
                  onClick={runVerify}
                  disabled={verify.state === 'checking'}
                >
                  {verify.state === 'checking' ? 'Reading the chain…' : 'Verify on X Layer'}
                </button>
              ) : null}
            </div>
            {view.seal ? (
              <div className="recruiter-seal-detail">
                <div className="receipt-line">
                  <span className="caption">Commitment leaf</span>
                  <span className="mono">{view.seal.leaf}</span>
                </div>
                <div className="receipt-line">
                  <span className="caption">Registry</span>
                  <a className="mono" href={view.seal.explorerLink} rel="noopener">
                    {view.seal.registry}
                  </a>
                </div>
                {verify.state === 'done' ? (
                  <div className="receipt-line" data-testid="recruiter-verify-result">
                    <span className="caption">On-chain</span>
                    <span className="mono">
                      {verify.error
                        ? 'unavailable — retry'
                        : verify.found
                          ? `anchored${verify.anchoredAt ? ` ${new Date(verify.anchoredAt).toLocaleDateString()}` : ''}`
                          : 'pending anchor'}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="caption">This dossier has not been sealed yet.</p>
            )}
          </div>
          <p className="caption recruiter-honesty">
            A seal proves the dossier is unchanged — not that a claim is objectively true. Each
            claim wears the tier its evidence earns. —{' '}
            <a href={SITE.url} rel="noopener">
              Assay
            </a>
          </p>
        </div>
      </section>
    </>
  )
}
