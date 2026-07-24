// Guilloché lattice — the security-print signature of the Assay Office (AGENTS.md §DESIGN TOKENS).
// Deterministic SVG: interleaved harmonic strands, the pattern engravers used on certificates so
// forgeries would show. Pure function of its props — renders identically on server and client.

const STEP = 6

function strand(
  width: number,
  height: number,
  a: number,
  f1: number,
  f2: number,
  phase: number,
): string {
  const mid = height / 2
  const pts: string[] = []
  for (let x = 0; x <= width; x += STEP) {
    const t = (x / width) * Math.PI * 2
    const y = mid + a * Math.sin(t * f1 + phase) * Math.cos(t * f2 + phase / 2)
    pts.push(`${x.toFixed(1)},${y.toFixed(2)}`)
  }
  return `M${pts.join(' L')}`
}

export function guillochePaths(width: number, height: number, strands = 8): string[] {
  const paths: string[] = []
  const amp = height * 0.36
  for (let i = 0; i < strands; i++) {
    const phase = (i / strands) * Math.PI * 2
    paths.push(strand(width, height, amp, 3, 7, phase))
    paths.push(strand(width, height, amp * 0.62, 5, 2, phase + Math.PI / strands))
  }
  return paths
}

export function GuillocheBand({
  height = 28,
  className,
  opacity = 0.5,
}: {
  height?: number
  className?: string
  opacity?: number
}) {
  const width = 1440
  const paths = guillochePaths(width, height)
  return (
    <div className={className} aria-hidden="true" style={{ overflow: 'hidden', lineHeight: 0 }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={i % 3 === 0 ? 'var(--viridian)' : 'var(--hairline-strong)'}
            strokeWidth={0.55}
            opacity={i % 3 === 0 ? opacity * 0.55 : opacity}
          />
        ))}
      </svg>
    </div>
  )
}

// A rosette — circular guilloché, used as the seal-adjacent ornament and the favicon motif.
export function GuillocheRosette({ size = 120, className }: { size?: number; className?: string }) {
  const c = size / 2
  const rings: string[] = []
  const petals = 18
  for (let i = 0; i < petals; i++) {
    const phase = (i / petals) * Math.PI * 2
    const pts: string[] = []
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      const r = c * 0.42 + c * 0.34 * Math.sin(a * 3 + phase) * Math.cos(a * 2 - phase)
      pts.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`)
    }
    rings.push(`M${pts.join(' L')}Z`)
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      {rings.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={i % 3 === 0 ? 'var(--viridian)' : 'var(--graphite)'}
          strokeWidth={0.45}
          opacity={i % 3 === 0 ? 0.5 : 0.25}
        />
      ))}
      <circle
        cx={c}
        cy={c}
        r={c * 0.14}
        fill="none"
        stroke="var(--viridian)"
        strokeWidth={0.6}
        opacity={0.6}
      />
    </svg>
  )
}

// Registration marks — the print-shop corner ticks that frame certificate panels.
export function RegCorners({ inset = 8 }: { inset?: number }) {
  const L = 14
  const s: React.CSSProperties = {
    position: 'absolute',
    width: L,
    height: L,
    pointerEvents: 'none',
  }
  const stroke = { stroke: 'var(--graphite)', strokeWidth: 1, opacity: 0.55 }
  const mark = (
    <svg width={L} height={L} viewBox={`0 0 ${L} ${L}`} aria-hidden="true">
      <line x1="0" y1="0" x2={L} y2="0" {...stroke} />
      <line x1="0" y1="0" x2="0" y2={L} {...stroke} />
    </svg>
  )
  return (
    <>
      <span style={{ ...s, top: inset, left: inset }}>{mark}</span>
      <span style={{ ...s, top: inset, right: inset, transform: 'rotate(90deg)' }}>{mark}</span>
      <span style={{ ...s, bottom: inset, right: inset, transform: 'rotate(180deg)' }}>{mark}</span>
      <span style={{ ...s, bottom: inset, left: inset, transform: 'rotate(270deg)' }}>{mark}</span>
    </>
  )
}
