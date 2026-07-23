import type { Artifact, ArtifactKind, Coverage, Dossier, Sentence } from '@xyndicate/assay-core'
import type { ModelRouter } from '@xyndicate/providers'
import { writeArtifact } from './writer'
import { renderArtifactHtml, type RenderBundle } from './templates/index'
import type { Theme } from './templates/theme'
import { htmlToPdf } from './pdf'
import { buildResumeDocx } from './docx'
import { buildAgentManifest } from './manifest'
import { renderCoverSvg } from './cover'

export interface ForgeDeps {
  toPdf?: (html: string) => Promise<Uint8Array>
  toDocx?: (dossier: Dossier, sentences: Sentence[]) => Promise<Uint8Array>
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
}

const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

// The Forge: gate → render → assemble. Nothing renders that fails the claim gate (guardrail #1);
// PDFs come from headless chromium; the ATS variant feeds the parse-back engine.
export async function forgeDossier(input: ForgeInput): Promise<ForgeOutput> {
  const { dossier, router, coverage = [], theme = 'light' } = input
  const toPdf = input.deps?.toPdf ?? htmlToPdf
  const toDocx = input.deps?.toDocx ?? buildResumeDocx

  const artifacts: Artifact[] = []
  const files = new Map<string, ForgeFile>()
  const questions: string[] = []

  // Evidence-gated prose.
  const bullets = await writeArtifact({ kind: 'resume_ats', dossier, router, coverage })
  const letter = await writeArtifact({ kind: 'cover_letter', dossier, router, coverage })
  const stories = await writeArtifact({ kind: 'story_bank', dossier, router, coverage })
  questions.push(...bullets.questions, ...letter.questions, ...stories.questions)

  const addHtmlPdf = async (
    kind: ArtifactKind,
    id: string,
    opts: { sentences?: Sentence[]; coverage?: Coverage[]; withTheme?: boolean; extraMeta?: Record<string, unknown> },
  ): Promise<void> => {
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

  await addHtmlPdf('resume_ats', 'resume_ats', { sentences: bullets.sentences })
  await addHtmlPdf('resume_designed', 'resume_designed', { sentences: bullets.sentences, withTheme: true })
  await addHtmlPdf('cover_letter', 'cover_letter', { sentences: letter.sentences, withTheme: true })
  await addHtmlPdf('story_bank', 'story_bank', { sentences: stories.sentences, withTheme: true })
  await addHtmlPdf('fit_map', 'fit_map', { coverage, withTheme: true })
  await addHtmlPdf('gap_brief', 'gap_brief', { coverage, withTheme: true })

  // .docx (mirrors ATS headings)
  const docx = await toDocx(dossier, bullets.sentences)
  files.set('resume_docx', { ext: 'docx', bytes: docx })
  artifacts.push({ id: 'resume_docx', kind: 'resume_docx', fileRef: 'resume_docx.docx', meta: {} })

  // Portfolio share page (static HTML, share view)
  const portfolioRb: RenderBundle = { dossier, sentences: bullets.sentences, theme }
  const portfolioHtml = renderArtifactHtml('portfolio_page', portfolioRb)
  files.set('portfolio_page', { ext: 'html', bytes: enc(portfolioHtml) })
  artifacts.push({
    id: 'portfolio_page',
    kind: 'portfolio_page',
    fileRef: 'portfolio_page.html',
    sentences: bullets.sentences,
    meta: { html: portfolioHtml, shareView: true, approvedFields: ['email', 'links'] },
  })

  // Typographic cover (SVG, no image model)
  files.set('cover', { ext: 'svg', bytes: enc(renderCoverSvg(dossier)) })

  // Machine-readable manifest for agents
  const agentManifest = buildAgentManifest(dossier, coverage)
  files.set('manifest_json', { ext: 'json', bytes: enc(JSON.stringify(agentManifest, null, 2)) })
  artifacts.push({ id: 'manifest_json', kind: 'manifest_json', fileRef: 'manifest_json.json', meta: { agent: agentManifest } })

  return { artifacts, files, questions }
}
