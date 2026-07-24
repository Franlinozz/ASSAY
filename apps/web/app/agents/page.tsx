import type { Metadata } from 'next'
import { TOOLS } from '../../lib/standard.generated'
import { SITE } from '../../lib/site'
import { CopyButton } from '../../components/CopyButton'
import { GuillocheBand } from '../../components/Guilloche'

export const metadata: Metadata = {
  title: 'For Agents',
  description:
    'Call Assay over A2MCP: one endpoint, ten tools, x402 metered payment in USDT on X Layer. Schemas generated from the code that serves them.',
  openGraph: { images: ['/og/agents.png'] },
}

const MCP_CONFIG = `{
  "mcpServers": {
    "assay": {
      "transport": "streamable-http",
      "url": "${SITE.mcpEndpoint}"
    }
  }
}`

const X402_STEPS = [
  {
    step: 'POST /mcp',
    text: 'Call a paid tool with plain JSON-RPC. No account, no API key.',
  },
  {
    step: 'HTTP 402',
    text: 'The PAYMENT-REQUIRED header carries a base64 challenge: price in USDT, network eip155:196, pay-to address.',
  },
  {
    step: 'PAYMENT-SIG',
    text: 'Sign the payment (EIP-3009 exact scheme) and retry the same request with the signature header.',
  },
  {
    step: '200 + receipt',
    text: 'The OKX facilitator settles on X Layer; PAYMENT-RESPONSE carries the settlement proof. Replays are idempotent — never charged twice.',
  },
] as const

export default function AgentsPage() {
  return (
    <>
      <div className="container page-head">
        <p className="overline">For agents · A2MCP · agent #{SITE.agentId}</p>
        <h1>Ten tools. One endpoint. Pay per call.</h1>
        <p className="lede">
          Assay is an Agent Service Provider on OKX.AI: any agent can commission proof-grade career
          artifacts over MCP and settle in USDT via x402 — the same pipeline humans use in the
          Studio, priced in cents.
        </p>
      </div>

      <section className="section-tight">
        <div className="container stack">
          <div className="endpoint-card">
            <span className="overline">Endpoint</span>
            <span className="mono" style={{ fontSize: '0.95rem' }} data-testid="mcp-endpoint">
              {SITE.mcpEndpoint}
            </span>
            <span style={{ marginLeft: 'auto' }}>
              <CopyButton text={SITE.mcpEndpoint} label="copy url" />
            </span>
          </div>

          <div className="codeblock">
            <CopyButton text={MCP_CONFIG} label="copy config" />
            <pre data-testid="mcp-config">{MCP_CONFIG}</pre>
          </div>
          <p className="caption">
            Streamable-HTTP transport, stateless. The machine manifest — prices, tools, seal
            registry — is published at{' '}
            <a href={`${SITE.apiBase}/.well-known/assay.json`} rel="noopener" className="mono">
              {SITE.apiBase}/.well-known/assay.json
            </a>
            .
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <p className="overline" style={{ marginBottom: '1rem' }}>
            The x402 meter — how a paid call settles
          </p>
          <div className="x402-flow">
            {X402_STEPS.map((s) => (
              <div key={s.step} className="x402-step">
                <span className="mono">{s.step}</span>
                <span className="caption" style={{ color: 'var(--ink-soft)' }}>
                  {s.text}
                </span>
              </div>
            ))}
          </div>
          <p className="caption" style={{ marginTop: '0.9rem' }}>
            Settlement is real: the rail is proven end-to-end on X Layer mainnet with USD₮0.
            PolicyGate runs before any payment semantics — refused requests are never charged.{' '}
            <span className="mono">asy_verify</span>, <span className="mono">asy_job_status</span>{' '}
            and <span className="mono">asy_job_result</span> are never gated.
          </p>
        </div>
      </section>

      <GuillocheBand height={20} opacity={0.4} />

      <section className="section-tight">
        <div className="container">
          <p className="overline" style={{ marginBottom: '0.4rem' }}>
            Tool reference — generated from the server&rsquo;s zod schemas
          </p>
          <p className="caption" style={{ marginBottom: '1.4rem' }}>
            Source: <span className="mono">packages/mcp-server/src/toolspec.ts</span> — the exact
            table the MCP server registers. Full guides live in the{' '}
            <a href="/docs" className="mono">
              docs
            </a>
            .
          </p>
          <div className="stack-lg">
            {TOOLS.map((tool) => (
              <div key={tool.name} className="card-paper" style={{ padding: '1.2rem 1.4rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.8rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="mono" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {tool.name}
                  </span>
                  <span className="caption">{tool.title}</span>
                  <span
                    className={`chip ${tool.priceUsdt > 0 ? '' : 'chip-ok'}`}
                    style={{ marginLeft: 'auto' }}
                  >
                    {tool.priceUsdt > 0 ? `${tool.priceUsdt.toFixed(2)} USDT` : 'free'}
                  </span>
                </div>
                <p
                  className="caption"
                  style={{ marginTop: '0.6rem', maxWidth: '56rem', color: 'var(--ink-soft)' }}
                >
                  {tool.description}
                </p>
                {tool.args.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: '0.9rem' }}>
                    <table className="office">
                      <thead>
                        <tr>
                          <th scope="col">Argument</th>
                          <th scope="col">Type</th>
                          <th scope="col">Required</th>
                          <th scope="col">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tool.args.map((arg) => (
                          <tr key={arg.name}>
                            <td className="mono">{arg.name}</td>
                            <td className="mono" style={{ color: 'var(--graphite)' }}>
                              {arg.type}
                            </td>
                            <td className="mono" style={{ color: 'var(--graphite)' }}>
                              {arg.required ? 'yes' : 'no'}
                            </td>
                            <td style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>
                              {arg.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
