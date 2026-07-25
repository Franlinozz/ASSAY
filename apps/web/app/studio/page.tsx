import type { Metadata } from 'next'
import { StudioStart } from './StudioStart'
import { GuillocheBand } from '../../components/Guilloche'
import { Reveal } from '../../components/Reveal'

export const metadata: Metadata = {
  title: 'The Studio',
  description: 'Begin a Career Dossier — every claim traced to proof, sealed on X Layer.',
}

export default function StudioPage() {
  return (
    <>
      <Reveal className="container page-head">
        <p className="overline">The Studio · no account, just your evidence</p>
        <h1>Begin a dossier.</h1>
        <p className="lede">
          Bring whatever you have — an old résumé, project docs, links, or just your answers. Assay
          files the proof, grades every document against the published Standard, and seals the
          result on X Layer. It never writes a sentence it can&rsquo;t trace.
        </p>
      </Reveal>
      <GuillocheBand height={20} opacity={0.4} className="motion-band" />
      <section className="section-tight">
        <Reveal className="container">
          <StudioStart />
        </Reveal>
      </section>
    </>
  )
}
