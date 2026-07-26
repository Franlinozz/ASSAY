import Link from 'next/link'
import { SITE } from '../lib/site'
import { GuillocheBand } from './Guilloche'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <GuillocheBand height={22} opacity={0.4} />
      <div className="container site-footer-grid">
        <div>
          <Link
            href="/"
            className="wordmark-sm brand-lockup brand-lockup-footer"
            aria-label="Assay — home"
          >
            <span className="brand-mark" aria-hidden="true">
              <img className="brand-mark-light" src="/brand/mark-light.webp" alt="" />
              <img className="brand-mark-dark" src="/brand/mark-dark.webp" alt="" />
            </span>
            <span>ASSAY</span>
          </Link>
          <p className="caption" style={{ maxWidth: '26rem' }}>
            {SITE.tagline} An evidence-backed career studio by {SITE.studio} — every claim traced to
            proof, graded against a published standard, sealed on X Layer.
          </p>
        </div>

        <nav aria-label="Footer — product">
          <p className="overline">Product</p>
          <ul className="footer-list">
            <li>
              <Link href="/studio">The Studio</Link>
            </li>
            <li>
              <Link href="/standard">The Standard</Link>
            </li>
            <li>
              <Link href="/evaluation">Evaluation</Link>
            </li>
            <li>
              <Link href="/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/gallery">Gallery</Link>
            </li>
            <li>
              <Link href="/docs">Documentation</Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Footer — agents and proof">
          <p className="overline">Agents &amp; proof</p>
          <ul className="footer-list">
            <li>
              <Link href="/agents">For Agents</Link>
            </li>
            <li>
              <Link href="/verify">Verify a dossier</Link>
            </li>
            <li>
              <a href={SITE.repo} rel="noopener">
                Repository
              </a>
            </li>
          </ul>
        </nav>

        <div>
          <p className="overline">On-chain</p>
          <ul className="footer-list footer-onchain">
            <li>
              <span className="caption">OKX.AI agent</span>
              <span className="mono">#{SITE.agentId}</span>
            </li>
            <li>
              <span className="caption">AssayRegistry · X Layer ({SITE.network})</span>
              <a href={SITE.explorerRegistry} rel="noopener" className="mono footer-addr">
                {SITE.registry}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="container site-footer-bottom">
        <span className="caption">
          © {new Date().getFullYear()} {SITE.studio} · OKX.AI Genesis · Lifestyle Companion
        </span>
        <span className="caption mono">AS v1.1.0</span>
      </div>
    </footer>
  )
}
