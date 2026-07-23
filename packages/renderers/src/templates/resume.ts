import type { Claim, Dossier, Sentence } from '@xyndicate/assay-core'
import { atsCss, esc, htmlDoc, officeCss, type Theme } from './theme'

function endLabel(endYm: string | null): string {
  return endYm ?? 'Present'
}

// Bullets → experiences. If Experience.claimIds link them, use that; otherwise all bullets go
// under the most recent experience (heuristic — precise attribution is an apex-month refinement).
export function bulletsForExperience(dossier: Dossier, expIndex: number, bullets: Sentence[]): Sentence[] {
  const exp = dossier.profile.experiences[expIndex]
  if (exp.claimIds.length > 0) return bullets.filter((b) => b.claimIds.some((id) => exp.claimIds.includes(id)))
  return expIndex === 0 ? bullets : []
}

export function tierOf(dossier: Dossier, sentence: Sentence): string {
  const byId = new Map(dossier.claims.map((c) => [c.id, c] as const))
  const claim: Claim | undefined = sentence.claimIds.map((id) => byId.get(id)).find(Boolean)
  return claim ? claim.strength : 'attested'
}

// STRICT ATS: single column, one sans family, standard headings, no tables/images/columns.
export function renderAtsHtml(dossier: Dossier, bullets: Sentence[]): string {
  const p = dossier.profile
  const parts: string[] = []
  parts.push(`<h1>${esc(p.fullName)}</h1>`)
  if (p.headline) parts.push(`<div class="headline">${esc(p.headline)}</div>`)
  const contact = [p.contact.email, ...p.contact.links].filter((x): x is string => Boolean(x)).map(esc).join('  |  ')
  if (contact) parts.push(`<div class="contact">${contact}</div>`)

  if (p.experiences.length > 0) {
    parts.push('<h2>EXPERIENCE</h2>')
    p.experiences.forEach((exp, i) => {
      parts.push(`<div class="role">${esc(exp.org)} — ${esc(exp.title)}</div>`)
      parts.push(`<div class="dates">${esc(exp.startYm)} – ${esc(endLabel(exp.endYm))}</div>`)
      const bs = bulletsForExperience(dossier, i, bullets)
      if (bs.length > 0) parts.push(`<ul>${bs.map((b) => `<li>${esc(b.text)}</li>`).join('')}</ul>`)
    })
  }
  if (p.education.length > 0) {
    parts.push('<h2>EDUCATION</h2>')
    for (const e of p.education) parts.push(`<div class="role">${esc(e.org)}${e.credential ? ` — ${esc(e.credential)}` : ''}</div>`)
  }
  if (p.skills.length > 0) {
    parts.push('<h2>SKILLS</h2>')
    parts.push(`<p>${esc(p.skills.join(', '))}</p>`)
  }
  if (p.certifications.length > 0) {
    parts.push('<h2>CERTIFICATIONS</h2>')
    for (const c of p.certifications) parts.push(`<div class="role">${esc(c.name)}</div>`)
  }
  return htmlDoc({ title: `${p.fullName} — Resume (ATS)`, css: atsCss(), body: parts.join('\n') })
}

// Designed variant: editorial, hairlines, viridian structure, evidence-tier chips on bullets.
export function renderDesignedHtml(dossier: Dossier, bullets: Sentence[], theme: Theme = 'light'): string {
  const p = dossier.profile
  const parts: string[] = []
  parts.push(`<div class="wordmark">${esc(p.fullName)}</div>`)
  if (p.headline) parts.push(`<div class="headline">${esc(p.headline)}</div>`)
  const contact = [p.contact.email, ...p.contact.links].filter((x): x is string => Boolean(x)).map(esc).join('  ·  ')
  if (contact) parts.push(`<div class="contact">${contact}</div>`)
  parts.push('<div class="rule"></div>')

  if (p.experiences.length > 0) {
    parts.push('<h2>Experience</h2>')
    p.experiences.forEach((exp, i) => {
      parts.push(`<div class="role">${esc(exp.org)} — ${esc(exp.title)}</div>`)
      parts.push(`<div class="dates">${esc(exp.startYm)} – ${esc(endLabel(exp.endYm))}</div>`)
      const bs = bulletsForExperience(dossier, i, bullets)
      if (bs.length > 0) {
        parts.push(
          `<ul>${bs.map((b) => `<li>${esc(b.text)}<span class="chip">${esc(tierOf(dossier, b))}</span></li>`).join('')}</ul>`,
        )
      }
    })
  }
  if (p.skills.length > 0) {
    parts.push('<h2>Skills</h2>')
    parts.push(`<p>${esc(p.skills.join(' · '))}</p>`)
  }
  return htmlDoc({ title: `${p.fullName} — Résumé`, css: officeCss(theme), body: parts.join('\n'), theme })
}

// Plain-text mirror of the ATS structure — used by the .docx builder and as a parse reference.
export function atsPlainText(dossier: Dossier, bullets: Sentence[]): { lines: string[]; headings: string[] } {
  const p = dossier.profile
  const lines: string[] = []
  const headings: string[] = []
  lines.push(p.fullName)
  if (p.headline) lines.push(p.headline)
  const contact = [p.contact.email, ...p.contact.links].filter((x): x is string => Boolean(x)).join('  |  ')
  if (contact) lines.push(contact)
  if (p.experiences.length > 0) {
    headings.push('EXPERIENCE')
    lines.push('EXPERIENCE')
    p.experiences.forEach((exp, i) => {
      lines.push(`${exp.org} — ${exp.title}`)
      lines.push(`${exp.startYm} – ${endLabel(exp.endYm)}`)
      for (const b of bulletsForExperience(dossier, i, bullets)) lines.push(`• ${b.text}`)
    })
  }
  if (p.skills.length > 0) {
    headings.push('SKILLS')
    lines.push('SKILLS')
    lines.push(p.skills.join(', '))
  }
  return { lines, headings }
}
