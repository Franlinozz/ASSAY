import type { Metadata } from 'next'
import { StudioWorkspace } from '../../../components/studio/StudioWorkspace'

export const metadata: Metadata = {
  title: 'Your dossier',
  robots: { index: false, follow: false },
}

// The capability URL: /d/:id?t=<HMAC>. The token is the only credential (no accounts). It stays
// client-side and rides every API call through the same-origin proxy.
export default async function DossierPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { id } = await props.params
  const { t } = await props.searchParams
  return <StudioWorkspace id={id} token={t ?? ''} />
}
