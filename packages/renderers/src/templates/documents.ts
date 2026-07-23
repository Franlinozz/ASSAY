import type { Coverage, Dossier, Sentence } from '@xyndicate/assay-core'
import { esc, htmlDoc, officeCss, type Theme } from './theme'
import { tierOf } from './resume'

function header(dossier: Dossier): string {
  const p = dossier.profile
  const contact = [p.contact.email, ...p.contact.links].filter((x): x is string => Boolean(x)).map(esc).join('  ·  ')
  return [
    `<div class="wordmark">${esc(p.fullName)}</div>`,
    p.headline ? `<div class="headline">${esc(p.headline)}</div>` : '',
    contact ? `<div class="contact">${contact}</div>` : '',
    '<div class="rule"></div>',
  ].join('\n')
}

export function renderCoverLetterHtml(dossier: Dossier, body: Sentence[], theme: Theme = 'light'): string {
  const paras = body.map((s) => `<p>${esc(s.text)}</p>`).join('\n')
  return htmlDoc({ title: `${dossier.profile.fullName} — Cover Letter`, css: officeCss(theme), body: `${header(dossier)}\n${paras}`, theme })
}

export function renderStoryBankHtml(dossier: Dossier, stories: Sentence[], theme: Theme = 'light'): string {
  const cards = stories
    .map(
      (s, i) =>
        `<div class="card"><div class="dates">STAR ${i + 1}</div><p>${esc(s.text)}<span class="chip">${esc(tierOf(dossier, s))}</span></p></div>`,
    )
    .join('\n')
  return htmlDoc({ title: `${dossier.profile.fullName} — Interview Stories`, css: officeCss(theme), body: `${header(dossier)}\n<h2>Interview Story Bank</h2>\n${cards}`, theme })
}

export function renderFitMapHtml(dossier: Dossier, coverage: Coverage[], theme: Theme = 'light'): string {
  const rows = coverage
    .map((c) => {
      const req = dossier.brief?.decomposed.find((r) => r.id === c.requirementId)
      return `<tr><td>${esc(req?.text ?? c.requirementId)}</td><td class="mark-${c.status}">${c.status}</td><td>${esc(c.note)}</td></tr>`
    })
    .join('')
  const table = `<table class="coverage"><thead><tr><th>Requirement</th><th>Coverage</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`
  return htmlDoc({ title: `${dossier.profile.fullName} — Fit Map`, css: officeCss(theme), body: `${header(dossier)}\n<h2>Requirement Coverage</h2>\n${table}`, theme })
}

export function renderGapBriefHtml(dossier: Dossier, coverage: Coverage[], theme: Theme = 'light'): string {
  const gaps = coverage.filter((c) => c.status === 'missing' || c.status === 'confirm')
  const cards = gaps
    .map((c) => {
      const req = dossier.brief?.decomposed.find((r) => r.id === c.requirementId)
      const label = req?.text ?? c.requirementId
      const advice =
        c.status === 'missing'
          ? `Do not claim "${label}" — there is no evidence for it yet. Frame the nearest transferable work honestly instead.`
          : `Confirm "${label}" with the candidate before claiming it.`
      return `<div class="card"><p>${esc(advice)}</p></div>`
    })
    .join('\n')
  const body = gaps.length > 0 ? cards : '<p>No gaps — every requirement is covered by confirmed evidence.</p>'
  return htmlDoc({ title: `${dossier.profile.fullName} — Gap & Risk Brief`, css: officeCss(theme), body: `${header(dossier)}\n<h2>Gap &amp; Risk Brief</h2>\n${body}`, theme })
}
