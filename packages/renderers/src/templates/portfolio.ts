import type { Dossier, Sentence } from '@xyndicate/assay-core'
import { esc, htmlDoc, officeCss, type Theme } from './theme'
import { tierOf } from './resume'

// Standalone static one-pager (its own inlined CSS), served later at /p/:slug. This is a share
// view — the PII_HYGIENE check applies, so it exposes only what the candidate approved.
export function renderPortfolioHtml(dossier: Dossier, bullets: Sentence[], theme: Theme = 'light'): string {
  const p = dossier.profile
  const links = p.contact.links.map((l) => `<a href="${esc(l)}">${esc(l)}</a>`).join('  ·  ')
  const highlights = bullets
    .slice(0, 6)
    .map((b) => `<li>${esc(b.text)}<span class="chip">${esc(tierOf(dossier, b))}</span></li>`)
    .join('\n')
  const body = [
    `<div class="wordmark">${esc(p.fullName)}</div>`,
    p.headline ? `<div class="headline">${esc(p.headline)}</div>` : '',
    links ? `<div class="contact">${links}</div>` : '',
    '<div class="rule"></div>',
    '<h2>Selected, evidence-backed highlights</h2>',
    `<ul>${highlights}</ul>`,
    p.skills.length > 0 ? `<h2>Skills</h2><p>${esc(p.skills.join(' · '))}</p>` : '',
    `<div class="rule"></div>`,
    `<p class="contact">Each highlight carries the evidence tier it earned. Verify this dossier's seal on X Layer.</p>`,
  ].join('\n')
  return htmlDoc({ title: `${p.fullName} — Portfolio`, css: officeCss(theme), body, theme })
}
