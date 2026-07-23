import { BRAND } from './brand'

export default function HoldingPage() {
  return (
    <main className="office">
      <div className="regmark">
        <span>ASSAY OFFICE</span>
        <span>AS · v0.1.0</span>
      </div>

      <h1 className="wordmark">ASSAY</h1>
      <p className="tagline">{BRAND.tagline}</p>

      <div className="rule" />

      <p className="pitch">{BRAND.description}</p>

      <div className="rule" />

      <nav className="meta">
        <a href="https://github.com/Franlinozz/ASSAY">Repository</a>
        <span>OKX.AI Genesis · Lifestyle Companion</span>
        <span>by Xyndicate</span>
      </nav>

      <p className="status">The Studio opens soon — every claim traced to proof.</p>
    </main>
  )
}
