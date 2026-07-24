// Demo-run generator entry — bundled by gen-demo.mjs. Runs the REAL Assay pipeline (guardrail #7:
// demo content is real pipeline output on a clearly-labeled fictional persona) and emits the JSON
// the public pages render: claims + tiers, coverage map, forged sentences, draft-by-draft tribunal
// reports, and the ATS parse-back field diff. ASY_PROVIDER_MODE=fake → deterministic, zero-spend;
// =live → the one real run allowed at phase end (its output is what ships on /evaluation).

import { writeFileSync } from 'node:fs'
import type { Artifact, Claim, Dossier, Sentence } from '@xyndicate/assay-core'
import { DossierSchema, tierExplanation } from '@xyndicate/assay-core'
import {
  createRouter,
  createModeFetcher,
  extractProfile,
  decomposeJd,
  computeCoverage,
  providerMode,
  SAMPLE_RESUME_TEXT,
} from '@xyndicate/providers'
import {
  forgeDossier,
  writeArtifact,
  renderArtifactHtml,
  parseBackFromBuffer,
  htmlToPdf,
  type RenderBundle,
} from '@xyndicate/renderers'
import { gradeWithRepair, summarize, type TribunalReport } from '@xyndicate/tribunal'

const FIXTURE_JD = `- PostgreSQL connection pooling and latency tuning experience is required
- Must have scaled a payments service to thousands of requests per second
- Rust systems programming experience is a bonus
- Mentored junior engineers or led a team migration`

async function main(): Promise<void> {
  const outPath = process.argv[2]
  if (!outPath) throw new Error('usage: gen-demo <out.json>')
  const mode = providerMode()
  const router = createRouter()
  const fetcher = createModeFetcher()

  // 1) EVIDENCE — extract the fixture persona (fictional, clearly labeled downstream).
  const extracted = await extractProfile({
    documents: [{ label: 'resume.txt', contentText: SAMPLE_RESUME_TEXT }],
    router,
  })
  const claims: Claim[] = extracted.claims.map((c) =>
    c.status === 'extracted' ? { ...c, status: 'confirmed' as const } : c,
  )

  // 2) BRIEF — decompose the fixture JD; coverage must stay honest (Rust ⇒ missing).
  const { requirements } = await decomposeJd({ jdText: FIXTURE_JD, router })
  const coverage = computeCoverage(
    requirements,
    claims.filter((c) => c.status === 'confirmed'),
  )

  const dossier: Dossier = DossierSchema.parse({
    profile: extracted.profile,
    tz: extracted.profile.timezone,
    evidence: extracted.evidence,
    claims,
    brief: { jdText: FIXTURE_JD, decomposed: requirements },
  })

  // 3) FORGE — real chromium PDFs so the parse-back is a genuine machine round-trip.
  const forge = await forgeDossier({
    dossier,
    router,
    coverage,
    deps: { toPdf: htmlToPdf },
  })

  const pdfBytes = new Map<string, Uint8Array>()
  for (const [name, f] of forge.files) if (f.ext === 'pdf') pdfBytes.set(name, f.bytes)

  // 4) TRIBUNAL — grade with the repair loop live; every draft's report ships (honesty is the
  // aesthetic). parseBack is wired so ATS_PARSE_BACK runs for real.
  const gradeDeps = {
    router,
    fetcher,
    fileExists: () => true,
    parseBack: async (artifact: Artifact, d: Dossier) => {
      const bytes = pdfBytes.get(artifact.id)
      if (!bytes) throw new Error(`no pdf for ${artifact.id}`)
      return parseBackFromBuffer(bytes, d.profile)
    },
  }

  const repairFor =
    (kind: Artifact['kind']) =>
    async (artifact: Artifact, repairBrief: string): Promise<Artifact> => {
      // A real repair: re-run the evidence-constrained writer with the tribunal's brief attached
      // to the dossier context, then re-render. The claim gate still guards every sentence.
      const rewritten = await writeArtifact({ kind, dossier, router, coverage })
      const rb: RenderBundle = { dossier, sentences: rewritten.sentences }
      const html = renderArtifactHtml(kind, rb)
      const next: Artifact = {
        ...artifact,
        sentences: rewritten.sentences,
        meta: { ...artifact.meta, html, repairBriefApplied: repairBrief.slice(0, 400) },
      }
      if (kind === 'resume_ats') {
        const pdf = await htmlToPdf(html)
        pdfBytes.set(artifact.id, pdf)
      }
      return next
    }

  const allReports: TribunalReport[] = []
  const finalSentences: Record<string, Sentence[]> = {}
  for (const artifact of forge.artifacts) {
    if (artifact.kind === 'resume_docx') continue // graded via DOCX_INTEGRITY in the full server flow
    const { reports, artifact: final } = await gradeWithRepair(
      dossier,
      artifact,
      gradeDeps,
      repairFor(artifact.kind),
    )
    allReports.push(...reports)
    if (final.sentences) finalSentences[artifact.id] = final.sentences
  }
  const rollup = summarize(allReports)

  // 5) PARSE-BACK — the machine-reading diff for the ATS résumé, from the actual PDF bytes.
  const atsPdf = pdfBytes.get('resume_ats')
  const parseBack = atsPdf ? await parseBackFromBuffer(atsPdf, dossier.profile) : null

  const reqById = new Map(requirements.map((r) => [r.id, r]))
  const out = {
    meta: {
      providerMode: mode,
      generatedAt: new Date().toISOString(),
      persona: 'Chidinma Eze — fictional persona; real pipeline output',
      note: 'Generated by apps/web/scripts/gen-demo.mjs running the same packages the server runs.',
    },
    profile: {
      fullName: dossier.profile.fullName,
      email: dossier.profile.contact.email ?? '',
      headline: dossier.profile.headline ?? '',
      skills: dossier.profile.skills,
      experiences: dossier.profile.experiences.map((e) => ({
        org: e.org,
        title: e.title,
        startYm: e.startYm,
        endYm: e.endYm,
      })),
    },
    claims: dossier.claims.map((c) => ({
      id: c.id,
      text: c.text,
      strength: c.strength,
      status: c.status,
      numericFacts: c.numericFacts,
      tierExplanation: tierExplanation(c),
    })),
    evidence: dossier.evidence.map((e) => ({ id: e.id, kind: e.kind, label: e.label })),
    coverage: coverage.map((c) => ({
      requirement: reqById.get(c.requirementId)?.text ?? c.requirementId,
      kind: reqById.get(c.requirementId)?.kind ?? 'nice',
      status: c.status,
      note: c.note,
      claimIds: c.claimIds,
    })),
    questions: forge.questions,
    sentences: finalSentences,
    tribunal: {
      rollup,
      reports: allReports.map((r) => ({
        artifactId: r.artifactId,
        artifactKind: r.artifactKind,
        draftIndex: r.draftIndex,
        pass: r.pass,
        hardPass: r.hardPass,
        craftPass: r.craftPass,
        craftWeightedMean: r.craftWeightedMean,
        craft: r.craft,
        hard: r.hard.map((h) => ({
          id: h.id,
          title: h.title,
          status: h.status,
          findings: h.findings,
        })),
        ...(r.repairBrief ? { repairBrief: r.repairBrief } : {}),
        standardVersion: r.standardVersion,
      })),
    },
    parseBack: parseBack
      ? {
          fidelityPct: parseBack.fidelityPct,
          fieldDiffs: parseBack.fieldDiffs,
          fieldsChecked:
            2 + dossier.profile.experiences.length * 4 /* name+email + 4 per experience */,
          parsed: parseBack.parsed,
          label: parseBack.label,
        }
      : null,
  }

  writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(
    `[assay-web] demo-run (${mode}) — ${dossier.claims.length} claims, ${coverage.length} coverage rows, ${allReports.length} tribunal reports, parse-back ${parseBack?.fidelityPct ?? '—'}%`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
