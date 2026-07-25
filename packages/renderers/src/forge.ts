import type { Artifact, ArtifactKind, Coverage, Dossier, Sentence } from '@xyndicate/assay-core'
import type { ModelRouter } from '@xyndicate/providers'
import type { Gap } from '@xyndicate/providers'
import { writeArtifact } from './writer'
import { renderArtifactHtml, type RenderBundle } from './templates/index'
import type { Theme } from './templates/theme'
import { htmlToPdf } from './pdf'
import { buildResumeDocx } from './docx'
import { buildAgentManifest } from './manifest'
import { renderCoverSvg } from './cover'
import { sampleRenderedContrast } from './contrast'

export interface ForgeDeps {
  toPdf?: (html: string) => Promise<Uint8Array>
  toDocx?: (dossier: Dossier, sentences: Sentence[]) => Promise<Uint8Array>
  sampleContrast?: (html: string) => Promise<number>
}

export interface ForgeInput {
  dossier: Dossier
  router: ModelRouter
  coverage?: Coverage[]
  theme?: Theme
  deps?: ForgeDeps
}

export interface ForgeFile {
  ext: string
  bytes: Uint8Array
}

export interface ForgeOutput {
  artifacts: Artifact[]
  files: Map<string, ForgeFile>
  questions: string[]
  gaps: Gap[]
}

const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

// The Forge: gate → render → assemble. Nothing renders that fails the claim gate (guardrail #1);
// PDFs come from headless chromium; the ATS variant feeds the parse-back engine.
export async function forgeDossier(input: ForgeInput): Promise<ForgeOutput> {
  const { dossier, router, coverage = [], theme = 'light' } = input
  const toPdf = input.deps?.toPdf ?? htmlToPdf
  const toDocx = input.deps?.toDocx ?? buildResumeDocx
  const sampleContrast = input.deps?.sampleContrast ?? sampleRenderedContrast

  if (dossier.variant === 'promotion' || dossier.variant === 'freelance') {
    return forgeVariant({ ...input, coverage, theme }, toPdf)
  }

  const artifacts: Artifact[] = []
  const files = new Map<string, ForgeFile>()
  const questions: string[] = []
  const gaps: Gap[] = []

  // Evidence-gated prose.
  const bullets = await writeArtifact({ kind: 'resume_ats', dossier, router, coverage })
  const letter = await writeArtifact({ kind: 'cover_letter', dossier, router, coverage })
  const stories = await writeArtifact({ kind: 'story_bank', dossier, router, coverage })
  questions.push(...bullets.questions, ...letter.questions, ...stories.questions)
  gaps.push(...bullets.gaps, ...letter.gaps, ...stories.gaps)

  const addHtmlPdf = async (
    kind: ArtifactKind,
    id: string,
    opts: {
      sentences?: Sentence[]
      coverage?: Coverage[]
      withTheme?: boolean
      extraMeta?: Record<string, unknown>
      gap?: Gap
    },
  ): Promise<void> => {
    if (opts.gap && (opts.sentences?.length ?? 0) === 0) {
      artifacts.push({
        id,
        kind,
        meta: {
          deliveryStatus: 'not_delivered',
          gap: opts.gap,
          coverageNote: opts.gap.message,
          ...(opts.extraMeta ?? {}),
        },
      })
      return
    }
    const rb: RenderBundle = { dossier }
    if (opts.sentences) rb.sentences = opts.sentences
    if (opts.coverage) rb.coverage = opts.coverage
    if (opts.withTheme) rb.theme = theme
    const html = renderArtifactHtml(kind, rb)
    const pdf = await toPdf(html)
    files.set(id, { ext: 'pdf', bytes: pdf })
    const meta: Record<string, unknown> = { html, ...(opts.extraMeta ?? {}) }
    const art: Artifact = { id, kind, meta, fileRef: `${id}.pdf` }
    if (opts.sentences) art.sentences = opts.sentences
    artifacts.push(art)
  }

  await addHtmlPdf('resume_ats', 'resume_ats', {
    sentences: bullets.sentences,
    gap: bullets.gaps[0],
  })
  await addHtmlPdf('resume_designed', 'resume_designed', {
    sentences: bullets.sentences,
    withTheme: true,
    gap: bullets.gaps[0],
  })
  await addHtmlPdf('cover_letter', 'cover_letter', {
    sentences: letter.sentences,
    withTheme: true,
    gap: letter.gaps[0],
  })
  await addHtmlPdf('story_bank', 'story_bank', {
    sentences: stories.sentences,
    withTheme: true,
    gap: stories.gaps[0],
  })
  await addHtmlPdf('fit_map', 'fit_map', { coverage, withTheme: true })
  await addHtmlPdf('gap_brief', 'gap_brief', { coverage, withTheme: true })

  // .docx (mirrors ATS headings)
  if (bullets.gaps[0] && bullets.sentences.length === 0) {
    artifacts.push({
      id: 'resume_docx',
      kind: 'resume_docx',
      meta: {
        deliveryStatus: 'not_delivered',
        gap: bullets.gaps[0],
        coverageNote: bullets.gaps[0].message,
      },
    })
  } else {
    const docx = await toDocx(dossier, bullets.sentences)
    files.set('resume_docx', { ext: 'docx', bytes: docx })
    artifacts.push({
      id: 'resume_docx',
      kind: 'resume_docx',
      fileRef: 'resume_docx.docx',
      meta: {},
    })
  }

  // Portfolio share page (static HTML, share view)
  if (bullets.gaps[0] && bullets.sentences.length === 0) {
    artifacts.push({
      id: 'portfolio_page',
      kind: 'portfolio_page',
      meta: {
        deliveryStatus: 'not_delivered',
        gap: bullets.gaps[0],
        coverageNote: bullets.gaps[0].message,
      },
    })
  } else {
    const portfolioRb: RenderBundle = { dossier, sentences: bullets.sentences, theme }
    const portfolioHtml = renderArtifactHtml('portfolio_page', portfolioRb)
    const renderedContrastRatio = await sampleContrast(portfolioHtml)
    files.set('portfolio_page', { ext: 'html', bytes: enc(portfolioHtml) })
    artifacts.push({
      id: 'portfolio_page',
      kind: 'portfolio_page',
      fileRef: 'portfolio_page.html',
      sentences: bullets.sentences,
      meta: {
        html: portfolioHtml,
        shareView: true,
        approvedFields: ['email', 'links'],
        renderedContrastRatio,
      },
    })
  }

  // Typographic cover (SVG, no image model)
  files.set('cover', { ext: 'svg', bytes: enc(renderCoverSvg(dossier)) })

  // Machine-readable manifest for agents
  const agentManifest = buildAgentManifest(dossier, coverage)
  files.set('manifest_json', { ext: 'json', bytes: enc(JSON.stringify(agentManifest, null, 2)) })
  artifacts.push({
    id: 'manifest_json',
    kind: 'manifest_json',
    fileRef: 'manifest_json.json',
    meta: { agent: agentManifest },
  })

  return { artifacts, files, questions, gaps }
}

function scopedVariantDossier(dossier: Dossier): Dossier {
  if (dossier.variant === 'freelance' && dossier.brief?.projectClaimIds.length) {
    const selected = new Set(dossier.brief.projectClaimIds)
    return { ...dossier, claims: dossier.claims.filter((c) => selected.has(c.id)) }
  }
  if (dossier.variant === 'promotion' && dossier.brief?.dateFrom && dossier.brief.dateTo) {
    const inRange = new Set(
      dossier.profile.experiences
        .filter((e) => {
          const end = e.endYm ?? dossier.brief!.dateTo!
          return e.startYm <= dossier.brief!.dateTo! && end >= dossier.brief!.dateFrom!
        })
        .flatMap((e) => e.claimIds),
    )
    // Older extracted dossiers did not link experiences to claims. Keep those claims rather than
    // pretending they have a date; the UI labels them as ledger-wide evidence.
    if (inRange.size > 0)
      return { ...dossier, claims: dossier.claims.filter((c) => inRange.has(c.id)) }
  }
  return dossier
}

async function forgeVariant(
  input: ForgeInput & { coverage: Coverage[]; theme: Theme },
  toPdf: (html: string) => Promise<Uint8Array>,
): Promise<ForgeOutput> {
  const dossier = scopedVariantDossier(input.dossier)
  const kinds: ArtifactKind[] =
    dossier.variant === 'promotion'
      ? ['promotion_narrative', 'promotion_memo', 'manager_one_pager']
      : ['capability_statement', 'case_studies', 'proposal_letter']
  const artifacts: Artifact[] = []
  const files = new Map<string, ForgeFile>()
  const questions: string[] = []
  const gaps: Gap[] = []
  for (const kind of kinds) {
    const written = await writeArtifact({
      kind,
      dossier,
      router: input.router,
      coverage: input.coverage,
    })
    questions.push(...written.questions)
    gaps.push(...written.gaps)
    if (written.gaps[0] && written.sentences.length === 0) {
      artifacts.push({
        id: kind,
        kind,
        meta: {
          deliveryStatus: 'not_delivered',
          gap: written.gaps[0],
          coverageNote: written.gaps[0].message,
          variant: dossier.variant,
        },
      })
      continue
    }
    const html = renderArtifactHtml(kind, {
      dossier,
      sentences: written.sentences,
      theme: input.theme,
    })
    const pdf = await toPdf(html)
    files.set(kind, { ext: 'pdf', bytes: pdf })
    artifacts.push({
      id: kind,
      kind,
      sentences: written.sentences,
      fileRef: `${kind}.pdf`,
      meta: {
        html,
        variant: dossier.variant,
        ...(dossier.brief?.dateFrom ? { dateFrom: dossier.brief.dateFrom } : {}),
        ...(dossier.brief?.dateTo ? { dateTo: dossier.brief.dateTo } : {}),
      },
    })
  }
  const agentManifest = buildAgentManifest(dossier, input.coverage)
  files.set('manifest_json', { ext: 'json', bytes: enc(JSON.stringify(agentManifest, null, 2)) })
  artifacts.push({
    id: 'manifest_json',
    kind: 'manifest_json',
    fileRef: 'manifest_json.json',
    meta: { agent: agentManifest, variant: dossier.variant },
  })
  files.set('cover', { ext: 'svg', bytes: enc(renderCoverSvg(dossier)) })
  return { artifacts, files, questions, gaps }
}
