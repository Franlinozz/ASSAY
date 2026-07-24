import Link from 'next/link'
import type { Metadata } from 'next'
import { EvidenceThreads } from '../components/EvidenceThreads'
import { SealedStrip } from '../components/SealedStrip'
import { LoopDiagram } from '../components/LoopDiagram'
import { GuillocheBand } from '../components/Guilloche'
import { SITE } from '../lib/site'
import demo from '../lib/demo-run.generated.json'

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
}

// P7 mainnet facts — real, verified live (AGENTS.md Deviations). Never invented.
const MAINNET_SEAL_TX = '0xd19944a3e098c6984245dd030beb3a7a5ddd5748273cd8bd84b0841e2cf1e8fd'

// The hero interaction: the fixture persona's REAL claims (fake-mode pipeline output) arranged as
// a ledger showing all four tiers. Fictional persona, clearly labeled in the caption below.
const heroBullets = demo.claims.map((c, i) => ({
  id: `b${i}`,
  text: c.text,
  evidenceIds:
    i === 0
      ? ['ev-doc', 'ev-seal']
      : i === 1
        ? ['ev-doc', 'ev-link', 'ev-seal']
        : ['ev-doc', 'ev-attest', 'ev-seal'],
}))

const heroEvidence = [
  {
    id: 'ev-doc',
    tier: 'documented' as const,
    label: 'resume.txt — uploaded document',
    detail: 'A file you supplied supports it.',
  },
  {
    id: 'ev-link',
    tier: 'linked' as const,
    label: 'github.com/chidinma — fetched live',
    detail: 'We fetched the URL to confirm it resolves.',
  },
  {
    id: 'ev-attest',
    tier: 'attested' as const,
    label: 'Guided answer — on the record',
    detail: 'You said it. Your word, on the record.',
  },
  {
    id: 'ev-seal',
    tier: 'sealed' as const,
    label: 'Dossier sealed on X Layer',
    detail: 'Integrity-anchored: salted commitment, EIP-712.',
  },
]

const MOATS = [
  {
    num: '01',
    title: 'The claim gate',
    body: `An unsupported sentence physically cannot render — it becomes a question back to you. Every sentence carries hidden claim IDs, enforced in code in assay-core, not in a system prompt a competitor can copy.`,
  },
  {
    num: '02',
    title: 'The published Standard, with parse-back proof',
    body: `The grading rubric is generated from the same code that grades — and the ATS check re-parses the rendered PDF and diffs it field by field. Not “ATS-friendly” as a vibe: actually machine-read back.`,
  },
  {
    num: '03',
    title: 'The on-chain seal',
    body: `The dossier manifest is canonically hashed, EIP-712-signed, and anchored on X Layer as a salted commitment. Anyone can verify the artifact is unchanged — without trusting Assay, and without any personal data on-chain. Ever.`,
  },
  {
    num: '04',
    title: 'The recruiter share portal',
    body: `No résumé tool on Earth serves the recruiter side. A controlled share link shows the résumé with evidence threads — hover any bullet and its proof lights up, tier by tier — plus the Tribunal grade and live seal status. The candidate controls exposure, expiry, and revocation.`,
  },
] as const

export default function LandingPage() {
  const atsSentences =
    (demo.sentences as Record<string, Array<{ text: string; claimIds: string[] }>>)['resume_ats'] ??
    []
  const pb = demo.parseBack

  return (
    <>
      {/* ── HERO ── */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="hero-kicker overline">Evidence-backed career studio</p>
            <h1 className="display">Proof before polish.</h1>
            <p className="lede">
              Assay turns scattered work history into a sealed Career Dossier — every claim traced
              to proof, every document graded against a published standard, machine-verified to
              survive ATS parsing. In a world where AI makes everyone sound impressive,{' '}
              <strong>you&rsquo;re the one who can prove it.</strong>
            </p>
            <div className="hero-ctas">
              <Link href="/studio" className="btn btn-primary">
                Open the Studio
              </Link>
              <Link href="/verify" className="btn btn-ghost">
                Verify a dossier
              </Link>
            </div>
          </div>
          <div>
            <EvidenceThreads
              heading="Résumé — C. Eze"
              subheading="fictional persona · live interaction"
              bullets={heroBullets}
              evidence={heroEvidence}
            />
          </div>
        </div>
      </section>

      {/* ── LIVE SEAL STRIP ── */}
      <div className="container">
        <SealedStrip />
      </div>

      {/* ── THE LOOP ── */}
      <section className="section">
        <div className="container">
          <p className="overline">The whole product in six words</p>
          <h2 style={{ marginTop: '0.6rem', marginBottom: '2.2rem' }}>
            Evidence in. Proof out. Sealed.
          </h2>
          <LoopDiagram />
        </div>
      </section>

      <GuillocheBand height={24} opacity={0.45} />

      {/* ── FOUR MOATS ── */}
      <section className="section-tight">
        <div className="container">
          <p className="overline">Four moats, visible in sixty seconds</p>

          {/* 01 — claim gate */}
          <div className="moat">
            <div className="moat-copy">
              <p className="moat-num">{MOATS[0].num}</p>
              <h3>{MOATS[0].title}</h3>
              <p className="lede" style={{ fontSize: '1rem' }}>
                {MOATS[0].body}
              </p>
            </div>
            <div className="capture">
              <div className="capture-head">
                <span className="overline">Forge output — every sentence cites its claim</span>
                <span className="caption mono">real pipeline output</span>
              </div>
              {atsSentences.map((s, i) => (
                <div key={i} className="sentence-row">
                  <span>{s.text}</span>
                  <span className="sentence-claims">
                    {s.claimIds.map((id) => (
                      <span key={id} className="claim-ref">
                        {id}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
              <div className="refusal">
                <span className="mono" style={{ color: 'var(--graphite)' }}>
                  asy_cover_letter · no evidence supplied →
                </span>{' '}
                &ldquo;I won&rsquo;t write a cover letter from thin air. Provide claims + evidence —
                Assay never writes a sentence it can&rsquo;t trace.&rdquo;
              </div>
            </div>
          </div>

          {/* 02 — standard + parse-back */}
          <div className="moat moat-flip">
            <div className="moat-copy">
              <p className="moat-num">{MOATS[1].num}</p>
              <h3>{MOATS[1].title}</h3>
              <p className="lede" style={{ fontSize: '1rem' }}>
                {MOATS[1].body}
              </p>
              <p>
                <Link href="/standard">Read the Standard →</Link>
              </p>
            </div>
            <div className="capture">
              <div className="capture-head">
                <span className="overline">ATS parse-back — machine reading diff</span>
                <span className="chip chip-ok">{pb?.fidelityPct ?? '—'}% fidelity</span>
              </div>
              <div className="receipt-line">
                <span className="caption">Fields re-read from the rendered PDF</span>
                <span className="mono">{pb?.fieldsChecked ?? '—'} checked</span>
              </div>
              <div className="receipt-line">
                <span className="caption">Fields lost or scrambled</span>
                <span className="mono">{pb?.fieldDiffs.length ?? '—'}</span>
              </div>
              <div className="receipt-line">
                <span className="caption">Parsed back</span>
                <span className="mono">
                  {pb
                    ? `${pb.parsed.name} · ${pb.parsed.experiences.length} roles · ${pb.parsed.skills.length} skills`
                    : '—'}
                </span>
              </div>
              <p className="caption" style={{ marginTop: '0.8rem' }}>
                {pb?.label}
              </p>
            </div>
          </div>

          {/* 03 — seal */}
          <div className="moat">
            <div className="moat-copy">
              <p className="moat-num">{MOATS[2].num}</p>
              <h3>{MOATS[2].title}</h3>
              <p className="lede" style={{ fontSize: '1rem' }}>
                {MOATS[2].body}
              </p>
              <p>
                <Link href="/verify">Verify a dossier →</Link>
              </p>
            </div>
            <div className="capture">
              <div className="capture-head">
                <span className="overline">AssayRegistry — live on X Layer mainnet</span>
                <span className="chip chip-sealed">sealed</span>
              </div>
              <div className="receipt-line">
                <span className="caption">Registry</span>
                <a className="mono" href={SITE.explorerRegistry} rel="noopener">
                  {SITE.registry}
                </a>
              </div>
              <div className="receipt-line">
                <span className="caption">Network</span>
                <span className="mono">X Layer · {SITE.network}</span>
              </div>
              <div className="receipt-line">
                <span className="caption">sealBatch tx</span>
                <a
                  className="mono"
                  href={`${SITE.explorerBase}/tx/${MAINNET_SEAL_TX}`}
                  rel="noopener"
                >
                  {MAINNET_SEAL_TX.slice(0, 22)}…
                </a>
              </div>
              <div className="receipt-line">
                <span className="caption">Personal data on-chain</span>
                <span className="mono">none — salted commitments only</span>
              </div>
            </div>
          </div>

          {/* 04 — recruiter portal */}
          <div className="moat moat-flip">
            <div className="moat-copy">
              <p className="moat-num">{MOATS[3].num}</p>
              <h3>{MOATS[3].title}</h3>
              <p className="lede" style={{ fontSize: '1rem' }}>
                {MOATS[3].body}
              </p>
              <p>
                <Link href="/gallery">See a dossier →</Link>
              </p>
            </div>
            <div className="capture">
              <div className="capture-head">
                <span className="overline">Share portal — what the recruiter sees</span>
                <span className="caption mono">read-only · revocable</span>
              </div>
              <div className="sentence-row">
                <span>{demo.claims[0]?.text}</span>
                <span className="sentence-claims">
                  <span className="chip chip-documented">Documented</span>
                </span>
              </div>
              <div className="sentence-row">
                <span>Tribunal grade</span>
                <span className="sentence-claims">
                  <span className="chip chip-ok">
                    PASS · {demo.tribunal.rollup.finalPassed}/{demo.tribunal.rollup.artifacts}{' '}
                    artifacts
                  </span>
                </span>
              </div>
              <div className="sentence-row">
                <span>Seal status</span>
                <span className="sentence-claims">
                  <span className="chip chip-sealed">verify on X Layer</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HONESTY LINE ── */}
      <section className="section">
        <div className="container honesty">
          <p className="overline" style={{ marginBottom: '1.2rem' }}>
            The integrity-vs-truth line — our honesty guarantee
          </p>
          <blockquote data-testid="integrity-line">
            &ldquo;
            <strong>
              A seal proves the artifact is unchanged — not that a claim is objectively true.
            </strong>{' '}
            We say exactly which tier each claim earned, and we never imply more than that.&rdquo;
          </blockquote>
        </div>
      </section>

      <GuillocheBand height={24} opacity={0.45} />

      {/* ── CTA ── */}
      <section className="cta-band">
        <div className="container">
          <h2>Begin a dossier.</h2>
          <p className="lede" style={{ maxWidth: '34rem', marginInline: 'auto' }}>
            Bring whatever you have — an old résumé, project docs, links, or just your answers.
            Assay files the proof; the polish follows.
          </p>
          <div className="hero-ctas" style={{ justifyContent: 'center' }}>
            <Link href="/studio" className="btn btn-primary">
              Open the Studio
            </Link>
            <Link href="/agents" className="btn btn-ghost">
              For Agents
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
