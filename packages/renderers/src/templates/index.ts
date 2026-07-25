import type { ArtifactKind, Coverage, Dossier, Sentence } from '@xyndicate/assay-core'
import type { Theme } from './theme'
import { renderAtsHtml, renderDesignedHtml } from './resume'
import {
  renderCoverLetterHtml,
  renderEvidenceDocumentHtml,
  renderFitMapHtml,
  renderGapBriefHtml,
  renderStoryBankHtml,
} from './documents'
import { renderPortfolioHtml } from './portfolio'

export * from './theme'
export * from './resume'
export * from './documents'
export * from './portfolio'

export interface RenderBundle {
  dossier: Dossier
  sentences?: Sentence[]
  coverage?: Coverage[]
  theme?: Theme
}

// Returns HTML for the artifact kinds that render to HTML/PDF; '' for non-HTML kinds.
export function renderArtifactHtml(kind: ArtifactKind, b: RenderBundle): string {
  const s = b.sentences ?? []
  const cov = b.coverage ?? []
  const theme = b.theme ?? 'light'
  switch (kind) {
    case 'resume_ats':
      return renderAtsHtml(b.dossier, s)
    case 'resume_designed':
      return renderDesignedHtml(b.dossier, s, theme)
    case 'cover_letter':
      return renderCoverLetterHtml(b.dossier, s, theme)
    case 'story_bank':
      return renderStoryBankHtml(b.dossier, s, theme)
    case 'fit_map':
      return renderFitMapHtml(b.dossier, cov, theme)
    case 'gap_brief':
      return renderGapBriefHtml(b.dossier, cov, theme)
    case 'portfolio_page':
      return renderPortfolioHtml(b.dossier, s, theme)
    case 'promotion_narrative':
      return renderEvidenceDocumentHtml(b.dossier, 'Performance Review Narrative', s, theme)
    case 'promotion_memo':
      return renderEvidenceDocumentHtml(b.dossier, 'Promotion Memo', s, theme)
    case 'manager_one_pager':
      return renderEvidenceDocumentHtml(b.dossier, 'Manager One-pager', s, theme)
    case 'capability_statement':
      return renderEvidenceDocumentHtml(b.dossier, 'Capability Statement', s, theme)
    case 'case_studies':
      return renderEvidenceDocumentHtml(b.dossier, 'Relevant Case Studies', s, theme)
    case 'proposal_letter':
      return renderEvidenceDocumentHtml(b.dossier, 'Proposal Letter', s, theme)
    default:
      return ''
  }
}
