// Persona-run generator — bundled by gen-personas.mjs. Runs the REAL Assay pipeline over each
// fictional persona (guardrail #7) and emits lib/personas.generated.json: the data the /gallery,
// /gallery/[slug], and /judge pages render. Also computes each dossier's salted commitment leaf +
// manifest hash so the seal step (scripts/seal-personas.mjs) can anchor all three on mainnet in one
// batch and /verify can confirm them by leaf.
//
//   ASY_PROVIDER_MODE=fake node scripts/gen-personas.mjs   → deterministic, zero-spend (layout/tests)
//   ASY_PROVIDER_MODE=live node scripts/gen-personas.mjs   → the phase's real runs (one LLM run each)
//
// The salt for each persona is written to apps/web/.persona-salts.json (gitignored) so the operator
// can re-anchor or re-verify; the public JSON is salt-free (guardrail #3).

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Artifact, Claim, Dossier, EvidenceItem, Sentence } from '@xyndicate/assay-core'
import {
  DossierSchema,
  buildManifest,
  hashManifest,
  recomputeStrengths,
  tierExplanation,
} from '@xyndicate/assay-core'
import {
  createRouter,
  createModeFetcher,
  extractProfile,
  decomposeJd,
  computeCoverage,
  providerMode,
  resetFakeRepairDemo,
  PERSONAS,
  type PersonaFixture,
} from '@xyndicate/providers'
import {
  forgeDossier,
  renderArtifactHtml,
  parseBackFromBuffer,
  htmlToPdf,
  writeArtifact,
  type RenderBundle,
} from '@xyndicate/renderers'
import { gradeWithRepair, summarize, type TribunalReport } from '@xyndicate/tribunal'
import { commitmentLeaf, newSalt } from '@xyndicate/receipts'
import type { Hex } from 'viem'

const CHAIN_ID = Number(process.env['ASY_CHAIN_ID'] ?? '196')
const REGISTRY = (process.env['ASY_REGISTRY'] ??
  '0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4') as Hex

interface SealFields {
  manifestHash: Hex
  leaf: Hex
  chainId: number
  registry: string
  standardVersion: string
}

async function runPersona(
  persona: PersonaFixture,
): Promise<{ out: Record<string, unknown>; leaf: Hex; salt: Hex }> {
  // In fake mode, exercise the real repair loop deterministically (first cover-letter draft fails a
  // craft check → repair → pass). resetFakeRepairDemo() gives EACH persona its own first-draft fail.
  resetFakeRepairDemo()
  const router = createRouter()
  const fetcher = createModeFetcher()

  // 1) EVIDENCE — extract from the persona's real documents.
  const documents = [
    { label: 'resume.txt', contentText: persona.resumeText },
    ...persona.extraDocs.map((d) => ({ label: d.label, contentText: d.text })),
  ]
  const extracted = await extractProfile({ documents, router })

  // Extracted, grounded claims are auto-confirmed (they trace to the persona's own documents);
  // needs_confirmation claims (a figure absent from the source) stay unconfirmed → become questions.
  let claims: Claim[] = extracted.claims.map((c) =>
    c.status === 'extracted' ? { ...c, status: 'confirmed' as const } : c,
  )

  // 2) LINK EVIDENCE — attach the persona's live external links, fetch-check them (LINK_LIVENESS runs
  // the same fetcher), and link them to the claims they back. A live link earns the 'linked' tier;
  // a dead one never does (honesty guardrail #11 / strength model).
  const evidence: EvidenceItem[] = [...extracted.evidence]
  for (const link of persona.links) {
    const res = await fetcher.fetch(link.url)
    const ev: EvidenceItem = {
      id: `EV-LINK-${persona.slug}-${persona.links.indexOf(link)}`,
      kind: 'link',
      label: link.label,
      sourceRef: link.url,
      fetchedOk: res.ok,
      addedAt: new Date().toISOString(),
      ...(res.textExcerpt ? { contentText: res.textExcerpt } : {}),
    }
    evidence.push(ev)
    for (const idx of link.backsClaims) {
      const c = claims[idx]
      if (c && !c.evidenceIds.includes(ev.id)) c.evidenceIds = [...c.evidenceIds, ev.id]
    }
  }
  claims = recomputeStrengths(claims, evidence)

  // 3) BRIEF — decompose the target JD; coverage must stay honest (real gaps show as 'missing').
  const { requirements } = await decomposeJd({ jdText: persona.jd, router })
  const coverage = computeCoverage(
    requirements,
    claims.filter((c) => c.status === 'confirmed'),
  )

  const dossier: Dossier = DossierSchema.parse({
    profile: extracted.profile,
    tz: extracted.profile.timezone,
    evidence,
    claims,
    brief: { jdText: persona.jd, decomposed: requirements },
  })

  // 4) FORGE — real chromium PDFs so the parse-back is a genuine machine round-trip.
  const forge = await forgeDossier({ dossier, router, coverage, deps: { toPdf: htmlToPdf } })
  const pdfBytes = new Map<string, Uint8Array>()
  for (const [name, f] of forge.files) if (f.ext === 'pdf') pdfBytes.set(name, f.bytes)

  // 5) TRIBUNAL — grade with the repair loop live; every draft ships.
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
      const rewritten = await writeArtifact({ kind, dossier, router, coverage })
      const rb: RenderBundle = { dossier, sentences: rewritten.sentences }
      const html = renderArtifactHtml(kind, rb)
      const next: Artifact = {
        ...artifact,
        sentences: rewritten.sentences,
        meta: { ...artifact.meta, html, repairBriefApplied: repairBrief.slice(0, 400) },
      }
      if (kind === 'resume_ats') pdfBytes.set(artifact.id, await htmlToPdf(html))
      return next
    }

  const allReports: TribunalReport[] = []
  const finalSentences: Record<string, Sentence[]> = {}
  for (const artifact of forge.artifacts) {
    if (artifact.kind === 'resume_docx') continue
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

  const atsPdf = pdfBytes.get('resume_ats')
  const parseBack = atsPdf ? await parseBackFromBuffer(atsPdf, dossier.profile) : null

  // 6) SEAL — the salted commitment leaf that gets anchored on mainnet.
  const manifest = buildManifest(dossier)
  const manifestHash = hashManifest(manifest).keccak256 as Hex
  const salt = newSalt()
  const leaf = commitmentLeaf(manifestHash, salt)
  const seal: SealFields = {
    manifestHash,
    leaf,
    chainId: CHAIN_ID,
    registry: REGISTRY,
    standardVersion: manifest.standardVersion,
  }

  const reqById = new Map(requirements.map((r) => [r.id, r]))
  const out: Record<string, unknown> = {
    slug: persona.slug,
    name: persona.name,
    headline: persona.headline,
    location: persona.location,
    caseType: persona.caseType,
    blurb: persona.blurb,
    jd: persona.jd,
    dossierId: dossier.id,
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
      evidenceIds: c.evidenceIds,
      tierExplanation: tierExplanation(c),
      ...(c.status === 'needs_confirmation'
        ? { question: `Confirm the figure in: "${c.text}". It isn't in your documents yet.` }
        : {}),
    })),
    evidence: dossier.evidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      sourceRef: e.sourceRef,
      ...(e.kind === 'link' ? { fetchedOk: e.fetchedOk === true, url: e.sourceRef } : {}),
    })),
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
        hard: r.hard.map((h) => ({ id: h.id, title: h.title, status: h.status, findings: h.findings })),
        ...(r.repairBrief ? { repairBrief: r.repairBrief } : {}),
        standardVersion: r.standardVersion,
      })),
    },
    parseBack: parseBack
      ? {
          fidelityPct: parseBack.fidelityPct,
          fieldDiffs: parseBack.fieldDiffs,
          fieldsChecked: 2 + dossier.profile.experiences.length * 4,
          parsed: parseBack.parsed,
          label: parseBack.label,
        }
      : null,
    seal: { ...seal, status: 'pending', tx: null, anchoredAt: null, explorerLink: null },
  }

  return { out, leaf, salt }
}

async function main(): Promise<void> {
  const outPath = process.argv[2]
  if (!outPath) throw new Error('usage: gen-personas <out.json>')
  const here = dirname(fileURLToPath(import.meta.url))
  const mode = providerMode()
  // Fake mode: force the deterministic repair story so the sealed judge run contains a real
  // FAIL→repair→PASS arc. Live mode: the real critic drives repairs on its own — never force it.
  if (mode === 'fake') process.env['ASY_FAKE_REPAIR_DEMO'] = '1'

  const personas: Array<Record<string, unknown>> = []
  const salts: Record<string, { leaf: Hex; salt: Hex }> = {}
  for (const persona of PERSONAS) {
    const { out, leaf, salt } = await runPersona(persona)
    personas.push(out)
    salts[persona.slug] = { leaf, salt }
    console.log(
      `[personas] ${persona.slug} (${mode}) — ${(out.claims as unknown[]).length} claims, leaf ${leaf.slice(0, 14)}…`,
    )
  }

  const doc = {
    meta: {
      providerMode: mode,
      generatedAt: new Date().toISOString(),
      note: 'Real pipeline output on clearly-labeled fictional personas (AGENTS.md guardrail #7). Generated by apps/web/scripts/gen-personas.mjs.',
    },
    personas,
  }
  writeFileSync(outPath, JSON.stringify(doc, null, 2))
  // Salts stay out of the public bundle; the operator sidecar keeps them for anchoring/re-verify.
  writeFileSync(resolve(here, '../.persona-salts.json'), JSON.stringify(salts, null, 2))
  console.log(`[personas] wrote ${personas.length} personas → ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
