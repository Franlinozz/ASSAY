import type { Metadata } from 'next'
import Link from 'next/link'
import { TierChip } from '../../components/TierChip'
import type { Tier } from '../../lib/site'
import demo from '../../lib/demo-run.generated.json'

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Sealed dossiers on display — real pipeline output on clearly-labeled fictional personas.',
  openGraph: { images: ['/og/gallery.png'] },
}

// Guardrail #7: every gallery entry is REAL pipeline output on a clearly-labeled fictional
// persona. No invented users, no invented grades. The full persona set lands in Phase 10; the
// grid and the featured flag are wired to real dossier data from day one.

export default function GalleryPage() {
  const tiers = [...new Set(demo.claims.map((c) => c.strength))] as Tier[]
  const rollup = demo.tribunal.rollup

  return (
    <>
      <div className="container page-head">
        <p className="overline">Gallery · fictional personas · real pipeline output</p>
        <h1>Dossiers on display.</h1>
        <p className="lede">
          Every dossier here was produced by the same pipeline you&rsquo;d run — extracted, gated,
          graded, and sealed. The personas are fictional and say so on the tin; the grades and seals
          are real.
        </p>
      </div>

      <section className="section-tight">
        <div className="container">
          <div className="gallery-grid" data-testid="gallery-grid">
            {/* featured — the fixture persona's real run */}
            <div className="dossier-card dossier-card-featured" data-featured="true">
              <span className="featured-flag">featured</span>
              <div>
                <p className="overline" style={{ marginBottom: '0.3rem' }}>
                  Career dossier
                </p>
                <h3 style={{ fontSize: '1.3rem' }}>{demo.profile.fullName}</h3>
                <p className="caption">{demo.profile.headline} · fictional persona</p>
              </div>
              <div className="dossier-meta">
                <span className="chip chip-ok">
                  Tribunal {rollup.finalPassed}/{rollup.artifacts} PASS
                </span>
                <span className="caption mono">
                  {demo.claims.length} claims · {demo.coverage.length} requirements mapped
                </span>
              </div>
              <div className="dossier-meta">
                {tiers.map((t) => (
                  <TierChip key={t} tier={t} />
                ))}
              </div>
              <p className="caption" style={{ color: 'var(--ink-soft)' }}>
                {demo.claims[0]?.text}…
              </p>
              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.6rem' }}>
                <Link href="/evaluation" className="btn btn-ghost btn-sm">
                  See the full evaluation
                </Link>
              </div>
            </div>

            {/* honest placeholders — wired, awaiting the Phase-10 persona set */}
            {['persona-2', 'persona-3'].map((slot) => (
              <div
                key={slot}
                className="dossier-card"
                style={{ justifyContent: 'center', alignItems: 'center', minHeight: '16rem' }}
              >
                <p className="overline" style={{ textAlign: 'center' }}>
                  Awaiting assay
                </p>
                <p className="caption" style={{ textAlign: 'center', maxWidth: '16rem' }}>
                  The next fictional persona&rsquo;s dossier is forged, graded, and sealed here — by
                  the pipeline, not by hand.
                </p>
              </div>
            ))}
          </div>
          <p className="caption" style={{ marginTop: '1.2rem' }}>
            Want yours here? Sealed dossiers can opt into the gallery from the Studio&rsquo;s share
            controls.
          </p>
        </div>
      </section>
    </>
  )
}
