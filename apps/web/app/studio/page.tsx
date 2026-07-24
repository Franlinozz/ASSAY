import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'The Studio',
  description: 'Begin a dossier — the working studio surface.',
}

// Interim surface: the full four-stage Studio (Ledger → Brief → Forge → Report) ships in the
// next phase of this build. Until then, the honest state — no fake door.
export default function StudioPage() {
  return (
    <div className="container section" style={{ maxWidth: '46rem' }}>
      <p className="overline">The Studio</p>
      <h1 style={{ marginTop: '0.7rem' }}>The bench is being set.</h1>
      <p className="lede" style={{ marginTop: '1rem' }}>
        The full Studio — upload your evidence, confirm your claims, map a brief, forge the dossier,
        and seal it — is landing here imminently. Agents can already run the entire pipeline today
        over MCP.
      </p>
      <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.6rem', flexWrap: 'wrap' }}>
        <Link href="/agents" className="btn btn-primary">
          Call the pipeline as an agent
        </Link>
        <Link href="/evaluation" className="btn btn-ghost">
          See a real run
        </Link>
      </div>
    </div>
  )
}
