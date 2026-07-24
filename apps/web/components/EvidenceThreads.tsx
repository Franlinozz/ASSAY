'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Tier } from '../lib/site'
import { TierChip } from './TierChip'
import styles from './EvidenceThreads.module.css'

// The signature interaction, built real (SVG hairlines + framer-motion), not a static image:
// hover a résumé bullet and taut threads connect it to the evidence cards that back it, each
// wearing its strength tier. Reused verbatim by the Studio's evidence drawer and the recruiter
// share portal — the hero IS the product.

export interface ThreadBullet {
  id: string
  text: string
  evidenceIds: string[]
}

export interface ThreadEvidence {
  id: string
  tier: Tier
  label: string
  detail: string
}

export interface EvidenceThreadsProps {
  heading?: string
  subheading?: string
  bullets: ThreadBullet[]
  evidence: ThreadEvidence[]
  /** Testing hook so e2e can assert the interaction fired. */
  testId?: string
}

interface Pt {
  x: number
  y: number
}

const SAG_IDLE = 14
const SAG_TAUT = 3

function threadPath(a: Pt, b: Pt, sag: number): string {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2 + sag
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

export function EvidenceThreads({
  heading = 'Résumé — fragment',
  subheading,
  bullets,
  evidence,
  testId = 'evidence-threads',
}: EvidenceThreadsProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const bulletRefs = useRef(new Map<string, HTMLElement>())
  const evidenceRefs = useRef(new Map<string, HTMLElement>())
  const [anchors, setAnchors] = useState<{ b: Map<string, Pt>; e: Map<string, Pt> } | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const reduced = useReducedMotion()

  const measure = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const w = wrap.getBoundingClientRect()
    const b = new Map<string, Pt>()
    const e = new Map<string, Pt>()
    const stacked = wrap.offsetWidth < 660
    for (const [id, el] of bulletRefs.current) {
      const r = el.getBoundingClientRect()
      b.set(
        id,
        stacked
          ? { x: r.left - w.left + 18, y: r.bottom - w.top }
          : { x: r.right - w.left + 2, y: r.top - w.top + r.height / 2 },
      )
    }
    for (const [id, el] of evidenceRefs.current) {
      const r = el.getBoundingClientRect()
      e.set(
        id,
        stacked
          ? { x: r.left - w.left + 18, y: r.top - w.top }
          : { x: r.left - w.left - 2, y: r.top - w.top + r.height / 2 },
      )
    }
    setAnchors({ b, e })
  }, [])

  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [measure])

  // Fonts swapping in shifts line boxes — re-measure once they settle.
  useEffect(() => {
    let alive = true
    void document.fonts?.ready?.then(() => {
      if (alive) measure()
    })
    return () => {
      alive = false
    }
  }, [measure])

  const activeEvidence = new Set(
    active ? (bullets.find((x) => x.id === active)?.evidenceIds ?? []) : [],
  )

  const threads = bullets.flatMap((bullet) =>
    bullet.evidenceIds.map((eid) => ({ bulletId: bullet.id, evidenceId: eid })),
  )

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-testid={testId}
      data-active-bullet={active ?? ''}
    >
      {/* thread layer */}
      <svg className={styles.threads} aria-hidden="true">
        {anchors &&
          threads.map(({ bulletId, evidenceId }) => {
            const a = anchors.b.get(bulletId)
            const b = anchors.e.get(evidenceId)
            if (!a || !b) return null
            const isActive = active === bulletId
            const dimmed = active !== null && !isActive
            return (
              <g key={`${bulletId}-${evidenceId}`}>
                <motion.path
                  className={styles.thread}
                  initial={false}
                  animate={{
                    d: threadPath(a, b, isActive ? SAG_TAUT : SAG_IDLE),
                    opacity: isActive ? 0.95 : dimmed ? 0.12 : 0.45,
                  }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 380, damping: 28, opacity: { duration: 0.18 } }
                  }
                  stroke={isActive ? 'var(--viridian)' : 'var(--graphite)'}
                  strokeWidth={isActive ? 1.1 : 0.9}
                  fill="none"
                  data-thread={isActive ? 'taut' : 'idle'}
                />
                <circle className={styles.node} cx={a.x} cy={a.y} r={2} />
                <circle className={styles.node} cx={b.x} cy={b.y} r={2} />
              </g>
            )
          })}
      </svg>

      {/* résumé fragment */}
      <div className={styles.fragment}>
        <div className={styles.fragmentHead}>
          <span className="overline">{heading}</span>
          {subheading ? <span className="caption">{subheading}</span> : null}
        </div>
        <ul className={styles.bullets}>
          {bullets.map((bullet) => (
            <li key={bullet.id}>
              <button
                type="button"
                ref={(el) => {
                  if (el) bulletRefs.current.set(bullet.id, el)
                  else bulletRefs.current.delete(bullet.id)
                }}
                className={`${styles.bullet} ${active === bullet.id ? styles.bulletActive : ''}`}
                onMouseEnter={() => setActive(bullet.id)}
                onMouseLeave={() => setActive((v) => (v === bullet.id ? null : v))}
                onFocus={() => setActive(bullet.id)}
                onBlur={() => setActive((v) => (v === bullet.id ? null : v))}
                onClick={() => setActive((v) => (v === bullet.id ? null : bullet.id))}
                aria-pressed={active === bullet.id}
              >
                <span aria-hidden="true" className={styles.tick}>
                  ·
                </span>
                {bullet.text}
              </button>
            </li>
          ))}
        </ul>
        <p className={`caption ${styles.hint}`}>Hover a line — every sentence knows its proof.</p>
      </div>

      {/* evidence cards */}
      <div className={styles.evidence}>
        {evidence.map((item) => {
          const lit = activeEvidence.has(item.id)
          const dimmed = active !== null && !lit
          return (
            <div
              key={item.id}
              ref={(el) => {
                if (el) evidenceRefs.current.set(item.id, el)
                else evidenceRefs.current.delete(item.id)
              }}
              className={`${styles.evidenceCard} ${lit ? styles.evidenceLit : ''} ${dimmed ? styles.evidenceDim : ''}`}
              data-lit={lit || undefined}
            >
              <div className={styles.evidenceTop}>
                <TierChip tier={item.tier} />
              </div>
              <p className={styles.evidenceLabel}>{item.label}</p>
              <p className={`caption ${styles.evidenceDetail}`}>{item.detail}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
