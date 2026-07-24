import type { Metadata } from 'next'
import Link from 'next/link'
import { GuillocheBand } from '../../components/Guilloche'
import { STANDARD } from '../../lib/standard.generated'
import demo from '../../lib/demo-run.generated.json'

export const metadata: Metadata = {
  title: 'Evaluation — how the Tribunal grades',
  description:
    'A real dossier run, draft by draft: findings, repair briefs, verdicts, and the parse-back diff. Honesty is the aesthetic.',
  openGraph: { images: ['/og/evaluation.png'] },
}

// Every card on this page renders REAL pipeline output from lib/demo-run.generated.json —
// a genuine run of the same packages the server runs, on a clearly-labeled fictional persona
// (guardrail #7). Nothing is mocked up; failures, when the critic finds them, ship too.

interface Report {
  artifactId: string
  artifactKind: string
  draftIndex: number
  pass: boolean
  hardPass: boolean
  craftPass: boolean
  craftWeightedMean: number
  craft: Array<{ axis: string; score: number }>
  hard: Array<{
    id: string
    title: string
    status: string
    findings: Array<{ code: string; detail: string }>
  }>
  repairBrief?: string
  standardVersion: string
}

const AXIS_TITLE: Record<string, string> = Object.fromEntries(
  STANDARD.craftAxes.map((a) => [a.id, a.title]),
)

function VerdictCard({ report }: { report: Report }) {
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
        <div>
          <p className="overline" style={{ marginBottom: '0.4rem' }}>
            Hard checks — {report.hard.filter((h) => h.status === 'pass').length} passed
            {failedHard.length > 0 ? ` · ${failedHard.length} failed` : ''}
          </p>
          {failedHard.length === 0 ? (
            <p className="caption">
              All deterministic checks passed
              {report.hard.some((h) => h.status === 'skipped' || h.status === 'pending')
                ? ' (checks that need a rendered file run in the full server flow)'
                : ''}
              .
            </p>
          ) : (
            failedHard.map((h) =>
              h.findings.map((f, i) => (
                <div key={`${h.id}-${i}`} className="finding">
                  <span className="finding-code">{f.code}</span>
                  <span>{f.detail}</span>
                </div>
              )),
            )
          )}
        </div>
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
        {report.repairBrief && (
          <div>
            <p className="overline" style={{ marginBottom: '0.4rem' }}>
              Repair brief — issued to the Forge
            </p>
            <div className="repair-brief">{report.repairBrief}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EvaluationPage() {
  const reports = demo.tribunal.reports as Report[]
  const rollup = demo.tribunal.rollup

  // Artifacts with the most drafts tell the repair story best; prose artifacts first.
  const byArtifact = new Map<string, Report[]>()
  for (const r of reports) {
    const list = byArtifact.get(r.artifactId) ?? []
    list.push(r)
    byArtifact.set(r.artifactId, list)
  }
  const storyOrder = [...byArtifact.entries()].sort(
    (a, b) =>
      b[1].length - a[1].length ||
      (b[1][0]?.craft.length ? 1 : 0) - (a[1][0]?.craft.length ? 1 : 0),
  )
  const hadRepairs = storyOrder.some(([, drafts]) => drafts.length > 1)

  const pb = demo.parseBack
  const parseRows = pb
    ? [
        { field: 'name', expected: demo.profile.fullName, got: pb.parsed.name },
        {
          field: 'email',
          expected: (demo.profile as { email?: string }).email ?? '',
          got: pb.parsed.email,
        },
        ...demo.profile.experiences.flatMap((exp, i) => {
          const p = pb.parsed.experiences[i]
          return [
            { field: `exp${i}.org`, expected: exp.org, got: p?.org ?? '' },
            { field: `exp${i}.title`, expected: exp.title, got: p?.title ?? '' },
            { field: `exp${i}.startYm`, expected: exp.startYm, got: p?.startYm ?? '' },
            { field: `exp${i}.endYm`, expected: exp.endYm ?? 'Present', got: p?.endYm ?? '' },
          ]
        }),
      ]
    : []

  return (
    <>
      <div className="container page-head">
        <p className="overline">
          Evaluation · a real run · {demo.meta.providerMode} providers ·{' '}
          <span className="mono">{STANDARD.version}</span>
        </p>
        <h1>Watch the Standard do its work.</h1>
        <p className="lede">
          This page is not a mock-up. Below is an actual dossier run — {demo.meta.persona} — graded
          by the same tribunal that grades every dossier. Draft by draft, findings and all. Honesty
          is the aesthetic.
        </p>
      </div>

      <section className="section-tight">
        <div className="container">
          <div className="pass-rule" data-testid="eval-rollup">
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
                passed on the first draft — we publish this so the repair loop can&rsquo;t flatter
                itself.
              </span>
            </div>
            <div>
              <span className="mono">{reports.length}</span>
              <span className="caption">
                reports shipped. Every draft&rsquo;s verdict is kept, including failures.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container stack-lg">
          <div>
            <p className="overline">The repair loop, draft by draft</p>
            {!hadRepairs && (
              <p className="caption" style={{ marginTop: '0.5rem', maxWidth: '46rem' }}>
                In this run every artifact passed on its first draft — the fixture persona&rsquo;s
                evidence is small and clean. When the critic does fail a draft, the FAIL report and
                its repair brief ship here, exactly as recorded.
              </p>
            )}
          </div>
          {storyOrder.slice(0, 3).map(([artifactId, drafts]) => (
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

      <GuillocheBand height={20} opacity={0.4} />

      <section className="section-tight">
        <div className="container">
          <p className="overline" style={{ marginBottom: '0.4rem' }}>
            The parse-back diff — every field survived machine reading
          </p>
          <p className="caption" style={{ marginBottom: '1rem', maxWidth: '46rem' }}>
            The ATS résumé PDF from this run, re-parsed by Assay&rsquo;s deterministic engine and
            diffed against the source profile. Fidelity:{' '}
            <strong style={{ color: 'var(--viridian-text)' }}>{pb?.fidelityPct ?? '—'}%</strong> ·{' '}
            {pb?.fieldDiffs.length ?? 0} fields lost.
          </p>
          <div className="table-wrap">
            <table className="office" data-testid="parseback-table">
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Source profile</th>
                  <th scope="col">Machine read-back</th>
                  <th scope="col">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {parseRows.map((row) => {
                  const okRow =
                    row.expected.trim().toLowerCase() === row.got.trim().toLowerCase() ||
                    (row.field.endsWith('endYm') &&
                      row.expected === 'Present' &&
                      row.got === 'Present')
                  return (
                    <tr key={row.field}>
                      <td className="mono">{row.field}</td>
                      <td>{row.expected || '—'}</td>
                      <td>{row.got || '—'}</td>
                      <td>
                        <span className={`chip ${okRow ? 'chip-ok' : 'chip-fail'}`}>
                          {okRow ? 'survived' : 'diff'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="caption" style={{ marginTop: '0.9rem' }}>
            {pb?.label}
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container" style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <Link href="/standard" className="btn btn-ghost">
            Read the Standard it grades against
          </Link>
          <Link href="/studio" className="btn btn-primary">
            Run yours
          </Link>
        </div>
      </section>
    </>
  )
}
