// The six-step loop as a hairline diagram — the whole product in six words.
// Pure SVG, both orientations: horizontal ≥720px, vertical below (CSS swaps them).

const STEPS = [
  { id: 'EVIDENCE', caption: 'the Ledger — every input filed with a strength tier' },
  { id: 'BRIEF', caption: 'the Role Lab — an honest coverage map, never a fake %' },
  { id: 'FORGE', caption: 'the Studio — no sentence renders without a claim' },
  { id: 'TRIBUNAL', caption: 'graded against the published Standard, repair ≤2' },
  { id: 'SEAL', caption: 'EIP-712 · salted commitment on X Layer' },
  { id: 'SHARE', caption: 'the recruiter portal — evidence threads, revocable' },
] as const

export function LoopDiagram() {
  const w = 1080
  const h = 158
  const y = 44
  const n = STEPS.length
  const pad = 70
  const gap = (w - pad * 2) / (n - 1)

  return (
    <div className="loop-diagram">
      {/* horizontal */}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="loop-h"
        role="img"
        aria-label="The Assay loop: evidence, brief, forge, tribunal, seal, share"
      >
        <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="var(--hairline-strong)" strokeWidth="1" />
        {STEPS.map((s, i) => {
          const x = pad + gap * i
          const isSeal = s.id === 'SEAL'
          return (
            <g key={s.id}>
              {i > 0 && (
                <path
                  d={`M ${x - gap / 2 + 9} ${y - 3.5} L ${x - gap / 2 + 16} ${y} L ${x - gap / 2 + 9} ${y + 3.5}`}
                  fill="none"
                  stroke="var(--graphite)"
                  strokeWidth="1"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={5}
                fill={isSeal ? 'var(--vermilion)' : 'var(--paper)'}
                stroke={isSeal ? 'var(--vermilion)' : 'var(--viridian)'}
                strokeWidth="1.4"
              />
              <text
                x={x}
                y={y - 18}
                textAnchor="middle"
                fill="var(--ink)"
                style={{
                  font: '600 13px var(--font-jbmono), monospace',
                  letterSpacing: '0.14em',
                }}
              >
                {s.id}
              </text>
              <foreignObject
                x={Math.max(4, x - gap / 2 + 6)}
                y={y + 16}
                width={Math.min(gap - 12, w - 4 - Math.max(4, x - gap / 2 + 6))}
                height={h - y - 18}
              >
                <p
                  style={{
                    margin: 0,
                    font: '400 11.5px var(--font-inter), sans-serif',
                    lineHeight: 1.45,
                    color: 'var(--graphite)',
                    textAlign: 'center',
                  }}
                >
                  {s.caption}
                </p>
              </foreignObject>
            </g>
          )
        })}
        {/* the loop-back: share feeds the next brief */}
        <path
          d={`M ${w - pad} ${y} C ${w - 16} ${y} ${w - 16} ${h - 8} ${w / 2} ${h - 8} C ${pad} ${h - 8} ${16} ${h - 8} ${pad} ${y + 4}`}
          fill="none"
          stroke="var(--hairline-strong)"
          strokeWidth="0.8"
          strokeDasharray="3 5"
          opacity="0.6"
        />
      </svg>

      {/* vertical (mobile) */}
      <ol className="loop-v" aria-hidden="true">
        {STEPS.map((s, i) => (
          <li key={s.id} className="loop-v-step">
            <span className="loop-v-rail">
              <span className={`loop-v-dot ${s.id === 'SEAL' ? 'loop-v-dot-seal' : ''}`} />
              {i < STEPS.length - 1 && <span className="loop-v-line" />}
            </span>
            <span>
              <span className="mono loop-v-id">{s.id}</span>
              <span className="caption" style={{ display: 'block' }}>
                {s.caption}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
