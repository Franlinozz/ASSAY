import type { Metadata } from 'next'
import { SITE } from '../../lib/site'
import { VerifyClient } from './VerifyClient'
import { EditorialImage } from '../../components/EditorialImage'

export const metadata: Metadata = {
  title: 'Verify a dossier',
  description:
    'Check any Assay dossier against the on-chain registry on X Layer — free forever, no wallet needed.',
  openGraph: { images: ['/og/verify.png'] },
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ leaf?: string; dossierId?: string }>
}) {
  const sp = await searchParams
  const prefill = (sp.leaf ?? sp.dossierId ?? '').trim() || undefined
  return (
    <section className="container verify-editorial-layout">
      <div className="verify-editorial-copy">
        <div className="page-head verify-page-head">
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
        <div className="verify-editorial-form">
          <VerifyClient {...(prefill ? { prefill, auto: true } : {})} />
        </div>
      </div>
      <EditorialImage
        src="/media/editorial/assay/integrity-sealed.webp"
        alt="An archival specialist applying an integrity mark to a professional dossier."
        variant="verify-ghost"
        sizes="(max-width: 820px) 100vw, 52vw"
        objectPosition="44% 50%"
      />
    </section>
  )
}
