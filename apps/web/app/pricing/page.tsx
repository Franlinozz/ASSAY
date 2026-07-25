import type { Metadata } from 'next'
import Link from 'next/link'
import { TOOLS } from '../../lib/standard.generated'
import { SITE } from '../../lib/site'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Cents per call, USDT via x402 on X Layer. Humans pay per dossier; agents pay per tool. Verification is free forever.',
  openGraph: { images: ['/og/pricing.png'] },
}

function priceLabel(tool: (typeof TOOLS)[number]): string {
  const p = tool.priceUsdt
  if (p > 0) return `${p.toFixed(2)} USDT`
  if (tool.name === 'asy_verify') return 'free forever'
  if (tool.name === 'asy_job_result') return 'free · paid at create'
  return 'free'
}

export default function PricingPage() {
  return (
    <>
      <div className="container page-head">
        <p className="overline">Pricing · x402 on X Layer ({SITE.network})</p>
        <h1>Cents per call. Proof included.</h1>
        <p className="lede">
          One product, both sides of the market: humans build a dossier in the Studio; agents call
          the same tools over A2MCP and pay per call in USDT. No subscription, no seat license — and
          checking a seal costs nothing, forever.
        </p>
      </div>

      <section className="section-tight">
        <div className="container">
          <p className="price-compare" data-testid="price-compare">
            The incumbents charge $50/month to keyword-stuff. Assay charges cents per call to prove.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="table-wrap">
            <table className="office" data-testid="price-table">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">What you get</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {TOOLS.map((tool) => (
                  <tr key={tool.name}>
                    <td>
                      <span style={{ fontWeight: 560 }}>{tool.title}</span>
                      <br />
                      <span className="mono caption">{tool.name}</span>
                    </td>
                    <td style={{ color: 'var(--ink-soft)', maxWidth: '30rem' }}>
                      {tool.marketplaceSummary}
                    </td>
                    <td className="num">
                      {tool.name === 'asy_verify' ? (
                        <strong style={{ color: 'var(--viridian-text)' }}>
                          {priceLabel(tool)}
                        </strong>
                      ) : (
                        priceLabel(tool)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="caption" style={{ marginTop: '0.9rem' }}>
            Prices are fixed in the published manifest at{' '}
            <a href={`${SITE.apiBase}/.well-known/assay.json`} rel="noopener" className="mono">
              /.well-known/assay.json
            </a>{' '}
            — the same table the paywall enforces. Payment is metered per call via the x402
            standard; a settled call is never charged twice.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container" style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <Link href="/studio" className="btn btn-primary">
            Open the Studio
          </Link>
          <Link href="/agents" className="btn btn-ghost">
            Call the tools directly
          </Link>
        </div>
      </section>
    </>
  )
}
