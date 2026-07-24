import type { Metadata } from 'next'
import Link from 'next/link'
import { JudgeTour } from './JudgeTour'
import { featuredPersona } from '../../lib/personas'

export const metadata: Metadata = {
  title: 'For Judges — the 90-second run',
  description:
    'A scripted 90-second replay of a real sealed dossier: ledger, coverage, forge, the honesty beat, the repair loop, the seal, and an on-chain verify. Pausable, skippable, outage-proof.',
}

// The judge experience. It replays the featured persona's SEALED run — real stored data, not a
// mock-up (guardrail #7). The only live call (final verify) has a cached fallback, so the tour
// survives a total provider outage (the phase NON-NEGOTIABLE).
export default function JudgePage() {
  const persona = featuredPersona()
  return (
    <>
      <div className="container page-head">
        <p className="overline">For judges · a real sealed run · ~90 seconds</p>
        <h1>Watch a dossier prove itself.</h1>
        <p className="lede">
          One scripted run over a real, sealed dossier — from raw evidence to an on-chain seal anyone
          can check. Every beat is driven by stored data from the sealed run; the honest failures ship
          too. Pause, skip, or replay any time.
        </p>
      </div>

      <section className="section-tight">
        <div className="container">
          <JudgeTour persona={persona} />
        </div>
      </section>

      <section className="section-tight">
        <div className="container" style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <Link href={`/gallery/${persona.slug}`} className="btn btn-ghost">
            Open this dossier
          </Link>
          <Link href="/gallery" className="btn btn-ghost">
            See all personas
          </Link>
          <Link href="/studio" className="btn btn-primary">
            Run your own
          </Link>
        </div>
      </section>
    </>
  )
}
