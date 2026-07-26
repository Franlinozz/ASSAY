import type { Metadata } from 'next'
import { STANDARD } from '../../lib/standard.generated'
import { GuillocheBand, RegCorners } from '../../components/Guilloche'
import { EditorialImage } from '../../components/EditorialImage'
import { Reveal } from '../../components/Reveal'

export const metadata: Metadata = {
  title: 'The Assay Standard',
  description:
    'The published grading standard — every hard check, craft axis, and the exact pass rule, generated from the same code that grades every dossier.',
  openGraph: { images: ['/og/standard.png'] },
}

// Guardrail #2 (PUBLISHED = SHIPPED): everything below renders from lib/standard.generated.ts,
// which is regenerated on every build from packages/tribunal/src/standard.ts — the module the
// grader itself runs. No rubric copy on this page is hand-written.

// Plain-English law for each hard check, keyed by id — commentary AROUND the generated rubric
// (the check id, title, and description themselves come from the tribunal).
const PLAIN_LAW: Record<string, string> = {
  CLAIM_COVERAGE: 'If a sentence has no confirmed claim behind it, it does not ship.',
  EVIDENCE_RESOLVES: 'Every claim must point at evidence that actually exists in the ledger.',
  LINK_LIVENESS: 'A dead link never earns “Linked” — we fetch every URL and check.',
  PLACEHOLDER_TEXT: 'No [BRACKETS], no “TBD”, no lorem. A placeholder is an automatic failure.',
  DATE_SANITY: 'Timelines must be possible: no future starts, no overlapping impossibilities.',
  XARTIFACT_CONSISTENCY: 'The cover letter may not contradict the résumé. One dossier, one truth.',
  FORMAT_LAW: 'Headings an ATS actually recognizes — structure that machines can read.',
  DOCX_INTEGRITY: 'The .docx must open, parse, and mirror the ATS structure.',
  ATS_PARSE_BACK: 'We re-parse the rendered PDF and diff it field by field against your profile.',
  CONTACT_VALIDITY: 'Contact details must be present and well-formed, or the document fails.',
  PII_HYGIENE: 'Nothing you did not approve for exposure leaves the dossier.',
  JD_COVERAGE: 'Reported honestly against the brief — coverage is informed, never stuffed.',
}

export default function StandardPage() {
  return (
    <>
      <div className="container page-head">
        <p className="overline">
          The published standard · <span className="mono">{STANDARD.version}</span>
        </p>
        <h1>The Assay Standard</h1>
        <p className="lede">
          Every artifact Assay produces is graded against this page — and this page is generated
          from the same code that grades. What you read here is what runs.
        </p>
        <p
          className="serif"
          style={{ fontStyle: 'italic', fontSize: '1.15rem', marginTop: '1.2rem' }}
          data-testid="standard-motto"
        >
          &ldquo;The standard does not bend for our own marketing.&rdquo;
        </p>
      </div>

      <section className="section-tight">
        <div className="container">
          <p className="overline" style={{ marginBottom: '1rem' }}>
            The pass rule — exact
          </p>
          <div className="pass-rule">
            <div>
              <span className="mono">all</span>
              <span className="caption">
                Every hard check must pass. Any failure blocks or triggers repair.
              </span>
            </div>
            <div>
              <span className="mono">≥ {STANDARD.craftPassMean}</span>
              <span className="caption">Weighted craft mean across the six axes.</span>
            </div>
            <div>
              <span className="mono">≥ {STANDARD.craftAxisFloor}</span>
              <span className="caption">No single craft axis may fall below the floor.</span>
            </div>
          </div>
          <p className="caption" style={{ marginTop: '0.9rem' }}>
            Failing drafts are repaired at most {STANDARD.repairLimit} times — and every
            draft&rsquo;s report ships in the dossier, including the failures.
          </p>
        </div>
      </section>

      <Reveal className="container editorial-break editorial-standard-break">
        <p className="overline">The Standard in practice</p>
        <EditorialImage
          src="/media/editorial/assay/the-standard-in-practice.webp"
          alt="Three reviewers independently applying a professional evidence standard."
          variant="standard-strip"
          sizes="(max-width: 720px) 100vw, 1200px"
          objectPosition="50% 48%"
        />
      </Reveal>

      <GuillocheBand height={20} opacity={0.4} />

      <section className="section-tight">
        <div className="container">
          <p className="overline">
            Hard checks — deterministic · {STANDARD.hardChecks.length} laws
          </p>
          <div style={{ marginTop: '1rem' }}>
            {STANDARD.hardChecks.map((check, i) => (
              <div key={check.id} className="law" data-check-id={check.id}>
                <span className="law-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="law-title">
                  {check.title}
                  <span className="law-id">{check.id}</span>
                </span>
                <span className="law-desc">
                  {check.description}
                  {PLAIN_LAW[check.id] ? (
                    <>
                      {' '}
                      <em style={{ color: 'var(--viridian-text)' }}>{PLAIN_LAW[check.id]}</em>
                    </>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <p className="overline" style={{ marginBottom: '1rem' }}>
            Craft axes — Claude critic, scored 0–100
          </p>
          <div className="table-wrap">
            <table className="office">
              <thead>
                <tr>
                  <th scope="col">Axis</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Weight
                  </th>
                  <th scope="col">What it grades</th>
                </tr>
              </thead>
              <tbody>
                {STANDARD.craftAxes.map((axis) => (
                  <tr key={axis.id}>
                    <td style={{ fontWeight: 560 }}>{axis.title}</td>
                    <td className="num">{axis.weight}</td>
                    <td style={{ color: 'var(--ink-soft)' }}>{axis.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="card" style={{ position: 'relative', padding: '1.6rem 1.8rem' }}>
            <RegCorners />
            <p className="overline" style={{ marginBottom: '0.7rem' }}>
              Repair policy
            </p>
            <p style={{ color: 'var(--ink-soft)', maxWidth: '46rem' }}>
              When a draft fails, the Tribunal issues a repair brief — the exact findings, in plain
              language — and the Forge rewrites under the same claim gate. At most{' '}
              {STANDARD.repairLimit} repairs; then the dossier ships with its honest final verdict.
              Reports are never discarded: the first draft&rsquo;s failure is part of the record.
            </p>
            <p className="caption mono" style={{ marginTop: '1rem' }}>
              source: packages/tribunal/src/standard.ts · rendered via renderStandardMarkdown ·
              regenerated every build
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
