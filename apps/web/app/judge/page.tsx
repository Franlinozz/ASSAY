import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'For Judges',
  description: 'A guided tour of Assay for hackathon judges.',
}

// Route stub — the guided judge tour lands in Phase 10.
export default function JudgePage() {
  return (
    <div className="container section" style={{ maxWidth: '44rem' }}>
      <p className="overline">For judges</p>
      <h1 style={{ marginTop: '0.7rem' }}>A guided tour is on its way.</h1>
      <p className="lede" style={{ marginTop: '1rem' }}>
        A one-click walkthrough — a seeded dossier, the repair loop, the seal, and a live recruiter
        link — lands here shortly. In the meantime, everything is already live:
      </p>
      <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginTop: '1.4rem' }}>
        <Link href="/evaluation" className="btn btn-primary">
          See a real run
        </Link>
        <Link href="/studio" className="btn btn-ghost">
          Open the Studio
        </Link>
        <Link href="/standard" className="btn btn-ghost">
          Read the Standard
        </Link>
      </div>
    </div>
  )
}
