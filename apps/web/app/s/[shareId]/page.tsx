import type { Metadata } from 'next'
import { ASY_API, SITE } from '../../../lib/site'
import { RecruiterView, type ShareView } from './RecruiterView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'A sealed dossier',
  description: 'A candidate’s evidence-backed dossier — every claim traced to its proof.',
  robots: { index: false, follow: false },
}

async function loadShare(shareId: string): Promise<ShareView | null> {
  try {
    const res = await fetch(`${ASY_API}/s-api/${encodeURIComponent(shareId)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as ShareView
  } catch {
    return null
  }
}

export default async function SharePage(props: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await props.params
  const view = await loadShare(shareId)

  if (!view || view.found === false) {
    return (
      <div className="container section" style={{ maxWidth: '40rem', textAlign: 'center' }}>
        <p className="overline">Not found</p>
        <h1 style={{ marginTop: '0.6rem' }}>This link doesn&rsquo;t lead anywhere.</h1>
        <p className="lede" style={{ marginTop: '1rem' }}>
          The dossier may have been removed, or the link is mistyped.
        </p>
      </div>
    )
  }

  if (view.revoked) {
    return (
      <div
        className="container section withdrawn"
        style={{ maxWidth: '40rem', textAlign: 'center' }}
      >
        <p className="overline">Withdrawn</p>
        <h1 style={{ marginTop: '0.6rem' }}>This dossier was withdrawn by the candidate.</h1>
        <p className="lede" style={{ marginTop: '1rem' }}>
          The candidate has revoked access to this link. If you still need it, please ask them for a
          fresh one.
        </p>
        <a href={SITE.url} className="btn btn-ghost" style={{ marginTop: '1.4rem' }} rel="noopener">
          About Assay
        </a>
      </div>
    )
  }

  if (view.expired) {
    return (
      <div className="container section" style={{ maxWidth: '40rem', textAlign: 'center' }}>
        <p className="overline">Expired</p>
        <h1 style={{ marginTop: '0.6rem' }}>This link has expired.</h1>
        <p className="lede" style={{ marginTop: '1rem' }}>
          The candidate set this recruiter link to expire. Ask them for a new one to view the
          dossier.
        </p>
      </div>
    )
  }

  return <RecruiterView view={view} />
}
