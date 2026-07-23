import type { ArtifactKind, Coverage, Dossier, Sentence } from '@xyndicate/assay-core'
import type { Theme } from './theme'
import { renderAtsHtml, renderDesignedHtml } from './resume'
import { renderCoverLetterHtml, renderFitMapHtml, renderGapBriefHtml, renderStoryBankHtml } from './documents'
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
    default:
      return ''
  }
}
