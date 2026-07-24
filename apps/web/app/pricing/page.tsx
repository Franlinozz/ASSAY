import type { Metadata } from 'next'
import Link from 'next/link'
import { TOOL_PRICES } from '../../lib/standard.generated'
import { SITE } from '../../lib/site'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Cents per call, USDT via x402 on X Layer. Humans pay per dossier; agents pay per tool. Verification is free forever.',
  openGraph: { images: ['/og/pricing.png'] },
}

// What each priced call actually buys — human framing around the fixed table (guardrail #5:
// names + prices come from the generated table; asy_verify is free forever).
const TOOL_COPY: Record<string, { label: string; what: string }> = {
  asy_ats_scan: {
    label: 'ATS scan',
    what: 'Your existing résumé, re-parsed the way an ATS reads it — format-law findings and honest keyword coverage.',
  },
  asy_claim_audit: {
    label: 'Claim audit',
    what: 'Every bullet classified: supported, vague, or citing a number your evidence does not back.',
  },
  asy_fit_brief: {
    label: 'Fit brief',
    what: 'A job description decomposed into requirements, each mapped to your strongest proof — missing means missing.',
  },
  asy_cover_letter: {
    label: 'Cover letter',
    what: 'A letter where every sentence cites a confirmed claim. Thin air is refused, not embellished.',
  },
  asy_story_bank: {
    label: 'Story bank',
    what: 'STAR interview stories grounded in your confirmed claims — ready to say out loud.',
  },
  asy_tailor_resume: {
    label: 'Tailored résumé',
    what: 'Achievement bullets rewritten against a target brief, evidence-constrained and format-law clean.',
  },
  asy_create_dossier_job: {
    label: 'Career Dossier — the full pipeline',
    what: 'Extract → grade → seal: ATS + designed résumé, cover letter, story bank, fit map, gap brief, portfolio, manifest — graded against the Standard and sealed on X Layer.',
  },
  asy_job_status: { label: 'Job status', what: 'Poll a running dossier job.' },
  asy_job_result: {
    label: 'Job result',
    what: 'Fetch the finished dossier — signed download links, tribunal reports, seal receipt. Paid once at create.',
  },
  asy_verify: {
    label: 'Verify a seal',
    what: 'Check any dossier against the on-chain registry. Anyone, anytime, no wallet.',
  },
}

const ORDER = Object.keys(TOOL_PRICES)

function priceLabel(tool: string): string {
  const p = TOOL_PRICES[tool] ?? 0
  if (p > 0) return `${p.toFixed(2)} USDT`
  if (tool === 'asy_verify') return 'free forever'
  if (tool === 'asy_job_result') return 'free · paid at create'
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
                {ORDER.map((tool) => (
                  <tr key={tool}>
                    <td>
                      <span style={{ fontWeight: 560 }}>{TOOL_COPY[tool]?.label ?? tool}</span>
                      <br />
                      <span className="mono caption">{tool}</span>
                    </td>
                    <td style={{ color: 'var(--ink-soft)', maxWidth: '30rem' }}>
                      {TOOL_COPY[tool]?.what}
                    </td>
                    <td className="num">
                      {tool === 'asy_verify' ? (
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
