import type { Metadata } from 'next'
import Link from 'next/link'
import { TierChip } from '../../components/TierChip'
import { featuredPersona, otherPersonas, personaTiers, type Persona } from '../../lib/personas'

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Sealed dossiers on display — real pipeline output on clearly-labeled fictional personas.',
  openGraph: { images: ['/og/gallery.png'] },
}

// Guardrail #7: every gallery entry is REAL pipeline output on a clearly-labeled fictional persona.
// No invented users, no invented grades. Featured = the career-ladder case; the others listed beneath
// with no duplicates. All data comes from lib/personas.generated.json.

function tierCounts(p: Persona) {
  const confirmed = p.claims.filter((c) => c.status === 'confirmed').length
  const questions = p.claims.filter((c) => c.status === 'needs_confirmation').length
  const linked = p.claims.filter((c) => c.strength === 'linked').length
  return { confirmed, questions, linked }
}

function PersonaCard({ persona, featured }: { persona: Persona; featured?: boolean }) {
  const tiers = personaTiers(persona)
  const rollup = persona.as11Regrade.rollup
  const { confirmed, questions, linked } = tierCounts(persona)
  const missing = persona.coverage.filter((c) => c.status === 'missing').length
  return (
    <Link
      href={`/gallery/${persona.slug}`}
      className={`dossier-card${featured ? ' dossier-card-featured' : ''}`}
      data-featured={featured ? 'true' : undefined}
      data-testid={`persona-card-${persona.slug}`}
    >
      {featured && <span className="featured-flag">featured</span>}
      <div>
        <p className="overline" style={{ marginBottom: '0.3rem' }}>
          {persona.caseType}
        </p>
        <h3 style={{ fontSize: featured ? '1.4rem' : '1.2rem' }}>{persona.name}</h3>
        <p className="caption">
          {persona.headline} · <span className="fictional-tag-inline">fictional persona</span>
        </p>
      </div>
      {featured && (
        <p className="caption" style={{ color: 'var(--ink-soft)' }}>
          {persona.blurb}
        </p>
      )}
      <div className="dossier-meta">
        <span className="chip chip-ok">
          AS 1.1 re-grade {rollup.finalPassed}/{rollup.artifacts} PASS
        </span>
        <span className={`chip ${persona.seal.status === 'sealed' ? 'chip-sealed' : ''}`}>
          {persona.seal.status === 'sealed' ? 'Sealed on X Layer' : 'Seal pending'}
        </span>
      </div>
      <div className="dossier-meta">
        {tiers.map((t) => (
          <TierChip key={t} tier={t} />
        ))}
      </div>
      <p className="caption mono">
        {confirmed} claims confirmed
        {questions > 0 ? ` · ${questions} question${questions > 1 ? 's' : ''}` : ''} · {linked}{' '}
        linked
        {missing > 0 ? ` · ${missing} gap${missing > 1 ? 's' : ''} named` : ''}
      </p>
      <span className="btn btn-ghost btn-sm" style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
        Open the dossier →
      </span>
    </Link>
  )
}

export default function GalleryPage() {
  const featured = featuredPersona()
  const others = otherPersonas()

  return (
    <>
      <div className="container page-head">
        <p className="overline">Gallery · fictional personas · real pipeline output</p>
        <h1>Dossiers on display.</h1>
        <p className="lede">
          Every dossier here was produced by the same pipeline you&rsquo;d run — extracted, gated,
          graded, and sealed on X Layer. The personas are fictional and say so on the tin; the
          grades, the gaps, and the seals are real.
        </p>
      </div>

      <section className="section-tight">
        <div className="container">
          <div className="gallery-grid" data-testid="gallery-grid">
            <PersonaCard persona={featured} featured />
            {others.map((p) => (
              <PersonaCard key={p.slug} persona={p} />
            ))}
          </div>
          <p className="caption" style={{ marginTop: '1.2rem' }}>
            Prefer to watch?{' '}
            <Link href="/judge" className="claim-link">
              Run the 90-second judge tour
            </Link>{' '}
            over the featured dossier — every beat driven by its real sealed data.
          </p>
        </div>
      </section>
    </>
  )
}
