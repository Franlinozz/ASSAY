import type { Metadata } from 'next'
import { SITE } from '../../lib/site'
import { VerifyClient } from './VerifyClient'

export const metadata: Metadata = {
  title: 'Verify a dossier',
  description:
    'Check any Assay dossier against the on-chain registry on X Layer — free forever, no wallet needed.',
  openGraph: { images: ['/og/verify.png'] },
}

export default function VerifyPage() {
  return (
    <>
      <div className="container page-head">
        <p className="overline">Verify · free forever · no wallet</p>
        <h1>Check a seal against the chain.</h1>
        <p className="lede">
          Paste a dossier ID or a commitment leaf. Assay reads the{' '}
          <a href={SITE.explorerRegistry} rel="noopener">
            AssayRegistry
          </a>{' '}
          on X Layer directly and tells you exactly what the chain says — sealed, pending, or not
          found. A seal proves the artifact is unchanged; the registry holds only salted
          commitments, never personal data.
        </p>
      </div>

      <section className="section-tight">
        <div className="container">
          <VerifyClient />
        </div>
      </section>
    </>
  )
}
