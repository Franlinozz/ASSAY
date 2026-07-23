// Full dossier run: extract → coverage → forge → tribunal (live parse-back) → manifest.
// Saves artifacts to ./artifacts-out and screenshots the designed résumé. Fake mode by default.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createRouter,
  createModeFetcher,
  extractProfile,
  decomposeJd,
  computeCoverage,
  SAMPLE_RESUME_TEXT,
} from '@xyndicate/providers'
import { forgeDossier, parseBackFromBuffer, htmlToPng, readDocxHeadings } from '@xyndicate/renderers'
import { gradeArtifact, summarize } from '@xyndicate/tribunal'
import { DossierSchema } from '@xyndicate/assay-core'

const mode = process.env.ASY_PROVIDER_MODE ?? 'fake'
const outDir = fileURLToPath(new URL('../artifacts-out', import.meta.url))
mkdirSync(outDir, { recursive: true })

const JD = `We are hiring a Senior Backend Engineer.
Must have strong PostgreSQL and Node.js experience.
Experience scaling high-throughput payment systems is required.
Nice to have Kubernetes and Redis.`

console.error(`[run-dossier] mode=${mode}`)
const router = createRouter()
const fetcher = createModeFetcher()

const ex = await extractProfile({ documents: [{ label: 'resume.txt', contentText: SAMPLE_RESUME_TEXT }], router, dossierId: 'run' })
const claims = ex.claims.map((c) => ({ ...c, status: 'confirmed' })) // the user confirms in the Ledger
const dec = await decomposeJd({ jdText: JD, router, dossierId: 'run' })
const coverage = computeCoverage(dec.requirements, claims)

const dossier = DossierSchema.parse({
  id: 'DSR-RUNDEMO1',
  tz: 'UTC',
  profile: ex.profile,
  brief: { jdText: JD, decomposed: dec.requirements },
  evidence: ex.evidence,
  claims,
})

const out = await forgeDossier({ dossier, router, coverage })
for (const [id, f] of out.files) writeFileSync(`${outDir}/${id}.${f.ext}`, Buffer.from(f.bytes))

// Live parse-back of the ATS PDF
const atsPdf = out.files.get('resume_ats').bytes
const pb = await parseBackFromBuffer(atsPdf, dossier.profile)

// Grade every artifact with the real parse-back + docx reader wired in
dossier.artifacts = out.artifacts
const deps = {
  router,
  fetcher,
  fileExists: () => true,
  readDocx: async () => readDocxHeadings(`${outDir}/resume_docx.docx`),
  parseBack: async () => ({ fidelityPct: pb.fidelityPct, fieldDiffs: pb.fieldDiffs }),
}
const reports = []
for (const art of out.artifacts) reports.push(await gradeArtifact(dossier, art, deps))

// Screenshot the designed résumé so we can eyeball the Assay Office look
const designed = out.artifacts.find((a) => a.id === 'resume_designed')
writeFileSync(`${outDir}/resume_designed.png`, Buffer.from(await htmlToPng(designed.meta.html)))

console.log(
  JSON.stringify(
    {
      mode,
      candidate: dossier.profile.fullName,
      parseBack: { fidelityPct: pb.fidelityPct, fieldDiffs: pb.fieldDiffs, label: pb.label },
      artifacts: out.artifacts.map((a) => a.id),
      questions: out.questions,
      tribunal: summarize(reports),
      reports: reports.map((r) => ({ id: r.artifactId, pass: r.pass, hardPass: r.hardPass, craftMean: r.craftWeightedMean })),
    },
    null,
    2,
  ),
)
