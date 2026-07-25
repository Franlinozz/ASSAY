'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { SealReceipt } from '../../lib/studio'
import { SITE } from '../../lib/site'

// The seal moment: pressing "Seal this dossier" plays a weighted vermilion stamp (≈400ms, no
// confetti) and reveals the receipt. Vermilion is permitted here — this is the seal state.
function StampMark() {
  const size = 132
  const c = size / 2
  const petals = 16
  const rings: string[] = []
  for (let p = 0; p < petals; p++) {
    const phase = (p / petals) * Math.PI * 2
    const pts: string[] = []
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.06) {
      const r = c * 0.5 + c * 0.28 * Math.sin(a * 3 + phase) * Math.cos(a * 2 - phase)
      pts.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`)
    }
    rings.push(`M${pts.join(' L')}Z`)
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={c}
        cy={c}
        r={c - 3}
        fill="none"
        stroke="var(--vermilion)"
        strokeWidth="2.5"
        opacity="0.9"
      />
      <circle
        cx={c}
        cy={c}
        r={c - 10}
        fill="none"
        stroke="var(--vermilion)"
        strokeWidth="0.8"
        opacity="0.6"
      />
      {rings.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="var(--vermilion)"
          strokeWidth="0.5"
          opacity={i % 2 ? 0.3 : 0.55}
        />
      ))}
      <text
        x={c}
        y={c - 6}
        textAnchor="middle"
        style={{
          font: '700 13px var(--font-jbmono), monospace',
          letterSpacing: '0.2em',
          fill: 'var(--vermilion)',
        }}
      >
        SEALED
      </text>
      <text
        x={c}
        y={c + 12}
        textAnchor="middle"
        style={{
          font: '500 8px var(--font-jbmono), monospace',
          letterSpacing: '0.18em',
          fill: 'var(--vermilion)',
        }}
      >
        AS v1.1.0
      </text>
    </svg>
  )
}

export function SealMoment({
  seal,
  busy,
  onSeal,
}: {
  seal: SealReceipt | null
  busy: boolean
  onSeal: () => Promise<SealReceipt | null>
}) {
  const [stamped, setStamped] = useState(!!seal)
  const reduced = useReducedMotion()

  const doSeal = async () => {
    const r = await onSeal()
    if (r) setStamped(true)
  }

  if (!seal && !stamped) {
    return (
      <div className="seal-cta" data-testid="seal-cta">
        <div>
          <h3>Seal this dossier.</h3>
          <p className="caption" style={{ maxWidth: '30rem' }}>
            Assay canonically hashes the manifest, signs it, and anchors a salted commitment on X
            Layer. No personal data goes on-chain — only proof that this dossier is unchanged.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-seal"
          data-testid="seal-button"
          disabled={busy}
          onClick={doSeal}
        >
          {busy ? 'Sealing…' : 'Seal this dossier'}
        </button>
      </div>
    )
  }

  return (
    <div className="seal-receipt" data-testid="seal-receipt">
      <motion.div
        className="seal-stamp"
        initial={reduced ? { opacity: 1 } : { scale: 1.7, opacity: 0, rotate: -9 }}
        animate={{ scale: 1, opacity: 1, rotate: -4 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 650, damping: 20 }}
      >
        <StampMark />
      </motion.div>
      <div className="seal-detail">
        <p className="overline">Receipt</p>
        <div className="receipt-line">
          <span className="caption">Manifest hash</span>
          <span className="mono">{seal?.manifestHash}</span>
        </div>
        <div className="receipt-line">
          <span className="caption">Commitment leaf</span>
          <span className="mono">{seal?.leaf}</span>
        </div>
        <div className="receipt-line">
          <span className="caption">Signature</span>
          <span className="mono">
            {seal?.signer ? `${seal.signer.slice(0, 22)}…` : 'unsigned (dev)'}
          </span>
        </div>
        <div className="receipt-line">
          <span className="caption">Anchor</span>
          <span className="mono">{seal?.status === 'sealed' ? 'anchored' : 'anchoring…'}</span>
        </div>
        <div className="receipt-line">
          <span className="caption">Registry · X Layer</span>
          <a className="mono" href={seal?.explorerLink ?? SITE.explorerRegistry} rel="noopener">
            {seal?.registry}
          </a>
        </div>
      </div>
    </div>
  )
}
