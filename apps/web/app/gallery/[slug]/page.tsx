import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TierChip } from '../../../components/TierChip'
import { GuillocheBand } from '../../../components/Guilloche'
import { STANDARD } from '../../../lib/standard.generated'
import { PERSONAS, personaBySlug, type Persona, type PersonaReport } from '../../../lib/personas'

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const p = personaBySlug(slug)
  if (!p) return { title: 'Gallery' }
  return {
    title: `${p.name} — sealed dossier (fictional persona)`,
    description: `${p.caseType}. Real Assay pipeline output on a clearly-labeled fictional persona.`,
  }
}

const AXIS_TITLE: Record<string, string> = Object.fromEntries(
  STANDARD.craftAxes.map((a) => [a.id, a.title]),
)

function FictionalTag() {
  return <span className="fictional-tag">Fictional persona — demonstration</span>
}

function VerdictCard({ report }: { report: PersonaReport }) {
  const failedHard = report.hard.filter((h) => h.status === 'fail')
  const hasCraft = report.craft.length > 0
  return (
    <div
      className={`verdict ${report.pass ? 'verdict-pass' : 'verdict-fail'}`}
      data-testid={`verdict-${report.artifactId}-d${report.draftIndex}`}
    >
      <div className="verdict-head">
        <span className={`chip ${report.pass ? 'chip-ok' : 'chip-fail'}`}>
          {report.pass ? 'PASS' : 'FAIL'}
        </span>
        <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
          {report.artifactId}
        </span>
        <span className="caption">draft {report.draftIndex + 1}</span>
        {hasCraft && (
          <span className="caption mono" style={{ marginLeft: 'auto' }}>
            craft mean {report.craftWeightedMean}
          </span>
        )}
      </div>
      <div className="verdict-body stack">
        {report.repairBrief && (
          <div>
            <p className="overline" style={{ marginBottom: '0.4rem' }}>
              Repair brief — issued to the Forge
            </p>
            <div className="repair-brief">{report.repairBrief}</div>
          </div>
        )}
        {hasCraft && (
          <div>
            <p className="overline" style={{ marginBottom: '0.4rem' }}>
              Craft axes — Claude critic
            </p>
            {report.craft.map((c) => (
              <div key={c.axis} className="axis-bar">
                <span className="caption">{AXIS_TITLE[c.axis] ?? c.axis}</span>
                <span className="axis-track">
                  <span className="axis-fill" style={{ width: `${Math.min(c.score, 100)}%` }} />
                </span>
                <span className="mono" style={{ textAlign: 'right', fontSize: '0.75rem' }}>
                  {c.score}
                </span>
              </div>
            ))}
          </div>
        )}
        {failedHard.length > 0 &&
          failedHard.map((h) =>
            h.findings.map((f, i) => (
              <div key={`${h.id}-${i}`} className="finding">
                <span className="finding-code">{f.code}</span>
                <span>{f.detail}</span>
              </div>
            )),
          )}
      </div>
    </div>
  )
}

function parseRows(p: Persona) {
  const pb = p.parseBack
  if (!pb) return []
  return [
    { field: 'name', expected: p.profile.fullName, got: pb.parsed.name },
    { field: 'email', expected: p.profile.email, got: pb.parsed.email },
    ...p.profile.experiences.flatMap((exp, i) => {
      const parsed = pb.parsed.experiences[i]
      return [
        { field: `exp${i}.org`, expected: exp.org, got: parsed?.org ?? '' },
        { field: `exp${i}.title`, expected: exp.title, got: parsed?.title ?? '' },
      ]
    }),
  ]
}

export default async function PersonaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = personaBySlug(slug)
  if (!p) notFound()

  const confirmed = p.claims.filter((c) => c.status === 'confirmed')
  const questions = p.claims.filter((c) => c.status === 'needs_confirmation')
  const rollup = p.tribunal.rollup
  const regrade = p.as11Regrade

  // The forged artifact with the most proof-linked sentences tells the "every sentence traces" story.
  const forgedKey =
    Object.keys(p.sentences).find((k) => k === 'cover_letter') ?? Object.keys(p.sentences)[0]
  const forgedSentences = forgedKey ? p.sentences[forgedKey] : []

  // Repair story: artifacts with >1 draft first.
  const byArtifact = new Map<string, PersonaReport[]>()
  for (const r of p.tribunal.reports) {
    const list = byArtifact.get(r.artifactId) ?? []
    list.push(r)
    byArtifact.set(r.artifactId, list)
  }
  const storyOrder = [...byArtifact.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <>
      <div className="container page-head">
        <p className="overline">
          Gallery · {p.caseType} ·{' '}
          <Link href="/gallery" className="claim-link">
            all personas
          </Link>
        </p>
        <div style={{ marginBottom: '0.8rem' }}>
          <FictionalTag />
        </div>
        <h1>{p.name}</h1>
        <p className="lede">{p.blurb}</p>
        <p className="caption mono" data-testid="persona-dossier-id">
          {p.headline} · dossier {p.dossierId}
        </p>
      </div>

      {/* Evidence ledger */}
      <section className="section-tight">
        <div className="container stack">
          <p className="overline">The evidence ledger — every claim carries its tier</p>
          <div className="claim-grid">
            {confirmed.map((c) => (
              <div key={c.id} className="claim-card claim-confirmed" data-testid={`claim-${c.id}`}>
                <div className="claim-top">
                  <TierChip tier={c.strength} />
                  <span className="claim-ref mono">{c.id}</span>
                </div>
                <p className="claim-text">{c.text}</p>
                <p className="claim-tier-note caption">{c.tierExplanation}</p>
              </div>
            ))}
          </div>

          {questions.length > 0 && (
            <div className="stack-sm" data-testid="persona-questions">
              <p className="overline" style={{ marginTop: '0.6rem' }}>
                Held back pending your confirmation — never rendered as prose
              </p>
              {questions.map((c) => (
                <div key={c.id} className="claim-card claim-needs">
                  <div className="claim-top">
                    <span className="chip">unconfirmed</span>
                    <span className="claim-ref mono">{c.id}</span>
                  </div>
                  <p className="claim-text">{c.text}</p>
                  <p className="claim-question-text caption">
                    {c.question ??
                      'A figure here isn’t in the documents yet — so Assay asks instead of writing it.'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {p.evidence.some((e) => e.kind === 'link') && (
            <div className="stack-sm">
              <p className="overline" style={{ marginTop: '0.6rem' }}>
                Live sources — fetch-checked so the “linked” tier is honest
              </p>
              <div className="dossier-meta">
                {p.evidence
                  .filter((e) => e.kind === 'link')
                  .map((e) => (
                    <a
                      key={e.id}
                      className={`chip ${e.fetchedOk ? 'chip-linked' : 'chip-fail'}`}
                      href={e.url}
                      rel="noopener nofollow"
                      target="_blank"
                    >
                      {e.fetchedOk ? '● live' : '× dead'} · {e.label}
                    </a>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <GuillocheBand height={18} opacity={0.35} />

      {/* Coverage map */}
      <section className="section-tight">
        <div className="container stack">
          <p className="overline">Coverage against the target role — gaps named, not hidden</p>
          <div className="coverage-list" data-testid="persona-coverage">
            {p.coverage.map((row, i) => (
              <div key={i} className={`coverage-row coverage-${row.status}`}>
                <span className={`coverage-chip-${row.status}`}>{row.status}</span>
                <span className="coverage-req">
                  {row.requirement}
                  {row.kind === 'must' && <span className="coverage-must"> · must</span>}
                </span>
                <span className="caption coverage-proof">{row.note}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Forged artifact — every sentence traces */}
      {forgedSentences.length > 0 && (
        <section className="section-tight">
          <div className="container stack">
            <p className="overline">
              A forged artifact — {forgedKey?.replace(/_/g, ' ')} · every sentence cites its claim
            </p>
            <div className="stack-sm">
              {forgedSentences.map((s, i) => (
                <div key={i} className="sentence-row">
                  <p>{s.text}</p>
                  <p className="sentence-claims mono caption">← {s.claimIds.join(', ')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tribunal repair story */}
      <section className="section-tight">
        <div className="container stack-lg">
          <div className="parseback" data-testid="persona-as11-regrade">
            <p className="overline">Honest AS 1.1 re-grade</p>
            <p className="caption" style={{ marginTop: '0.5rem' }}>
              {regrade.rollup.finalPassed}/{regrade.rollup.artifacts} original sealed artifacts pass
              the new profiles. Portfolio screenshot contrast:{' '}
              <strong>{regrade.profiles.portfolioPage.renderedContrastRatio}:1</strong>. Story bank:{' '}
              <strong>{regrade.profiles.storyBank.status.toUpperCase()}</strong>.
            </p>
            {regrade.profiles.storyBank.findings.map((finding, index) => (
              <div className="finding" key={`${finding.code}-${index}`}>
                <span className="finding-code">{finding.code}</span>
                <span>{finding.detail}</span>
              </div>
            ))}
            <p className="caption" style={{ marginTop: '0.6rem' }}>
              {regrade.note}
            </p>
          </div>
          <div className="pass-rule" data-testid="persona-rollup">
            <div>
              <span className="mono">
                {rollup.finalPassed}/{rollup.artifacts}
              </span>
              <span className="caption">artifacts passed on their final draft.</span>
            </div>
            <div>
              <span className="mono">
                {rollup.firstDraftPassed}/{rollup.artifacts}
              </span>
              <span className="caption">
                passed on the first draft — published so repair can’t flatter itself.
              </span>
            </div>
          </div>
          {storyOrder.slice(0, 2).map(([artifactId, drafts]) => (
            <div key={artifactId} className="stack">
              {drafts
                .sort((a, b) => a.draftIndex - b.draftIndex)
                .map((r) => (
                  <VerdictCard key={r.draftIndex} report={r} />
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* Parse-back */}
      {p.parseBack && (
        <section className="section-tight">
          <div className="container">
            <p className="overline" style={{ marginBottom: '0.4rem' }}>
              Machine read-back — the ATS PDF re-parsed
            </p>
            <p className="caption" style={{ marginBottom: '1rem', maxWidth: '46rem' }}>
              Fidelity:{' '}
              <strong style={{ color: 'var(--viridian-text)' }}>{p.parseBack.fidelityPct}%</strong>{' '}
              · {p.parseBack.fieldDiffs.length} fields lost. {p.parseBack.label}
            </p>
            <div className="table-wrap">
              <table className="office" data-testid="persona-parseback">
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Source</th>
                    <th scope="col">Read-back</th>
                    <th scope="col">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {parseRows(p).map((row) => {
                    const ok = row.expected.trim().toLowerCase() === row.got.trim().toLowerCase()
                    return (
                      <tr key={row.field}>
                        <td className="mono">{row.field}</td>
                        <td>{row.expected || '—'}</td>
                        <td>{row.got || '—'}</td>
                        <td>
                          <span className={`chip ${ok ? 'chip-ok' : 'chip-fail'}`}>
                            {ok ? 'survived' : 'diff'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Seal */}
      <section className="section-tight">
        <div className="container">
          <div className="seal-receipt" data-testid="persona-seal">
            <div className="seal-detail">
              <span className="caption">Commitment leaf</span>
              <span className="mono">{p.seal.leaf}</span>
            </div>
            <div className="seal-detail">
              <span className="caption">Status</span>
              <span className={`chip ${p.seal.status === 'sealed' ? 'chip-sealed' : ''}`}>
                {p.seal.status === 'sealed' ? 'sealed on X Layer' : 'seal pending anchor'}
              </span>
            </div>
            {p.seal.explorerLink && (
              <div className="seal-detail">
                <span className="caption">Anchor transaction</span>
                <a className="mono" href={p.seal.explorerLink} rel="noopener" target="_blank">
                  view on explorer ↗
                </a>
              </div>
            )}
            <div className="seal-detail">
              <span className="caption">Registry · X Layer eip155:{p.seal.chainId}</span>
              <a
                className="mono"
                href={
                  p.seal.registryExplorer ??
                  `https://www.oklink.com/x-layer/address/${p.seal.registry}`
                }
                rel="noopener"
                target="_blank"
              >
                {p.seal.registry}
              </a>
            </div>
            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              <Link
                href={`/verify?leaf=${p.seal.leaf}`}
                className="btn btn-primary btn-sm"
                data-testid="persona-verify-link"
              >
                Verify this seal on-chain
              </Link>
              <Link href="/judge" className="btn btn-ghost btn-sm">
                Watch the 90-second tour
              </Link>
            </div>
          </div>
          <p className="caption" style={{ marginTop: '1rem', maxWidth: '46rem' }}>
            {p.name} is a fictional persona. The seal proves this dossier&rsquo;s manifest is
            unchanged since sealing — it does not, by itself, prove any claim inside it. Each claim
            carries its own evidence tier.
          </p>
        </div>
      </section>
    </>
  )
}
