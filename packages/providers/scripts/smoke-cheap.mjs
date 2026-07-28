// One extract + decompose + coverage run on the bundled fixture resume. Prints JSON.
// Fake mode by default (zero spend). Run real cheapest tier with ASY_PROVIDER_MODE=live.
import {
  createRouter,
  extractProfile,
  decomposeJd,
  computeCoverage,
  SAMPLE_RESUME_TEXT,
} from '@xyndicate/providers'

const JD = `We are hiring a Senior Backend Engineer.
Must have strong PostgreSQL and Node.js experience.
Experience scaling high-throughput payment systems is required.
Nice to have Kubernetes and Redis.`

const mode = process.env.ASY_PROVIDER_MODE ?? 'fake'
console.error(`[smoke] provider mode: ${mode}`)

const router = createRouter()
const ex = await extractProfile({
  documents: [{ label: 'resume.txt', contentText: SAMPLE_RESUME_TEXT }],
  router,
  dossierId: 'smoke',
})
const dec = await decomposeJd({ jdText: JD, router, dossierId: 'smoke' })

// In the real flow the user confirms claims in the Ledger; here we confirm all to illustrate coverage.
const confirmed = ex.claims.map((c) => ({ ...c, status: 'confirmed' }))
const coverage = computeCoverage(dec.requirements, confirmed)

console.log(
  JSON.stringify(
    {
      mode,
      profile: {
        fullName: ex.profile.fullName,
        headline: ex.profile.headline,
        skills: ex.profile.skills,
      },
      claims: ex.claims.map((c) => ({
        id: c.id,
        text: c.text,
        strength: c.strength,
        status: c.status,
      })),
      requirements: dec.requirements.map((r) => ({ id: r.id, kind: r.kind, text: r.text })),
      coverage,
      gaps: [...ex.gaps, ...dec.gaps],
    },
    null,
    2,
  ),
)
