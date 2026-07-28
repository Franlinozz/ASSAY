import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import type { Dossier, Sentence } from '@xyndicate/assay-core'
import { bulletsForExperience } from './templates/resume'

const SECTION_HEADINGS = ['SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'CERTIFICATIONS']

// .docx that mirrors the ATS structure exactly (same section headings), so DOCX_INTEGRITY can
// reopen it and confirm the headings survived.
export async function buildResumeDocx(dossier: Dossier, bullets: Sentence[]): Promise<Uint8Array> {
  const p = dossier.profile
  const children: Paragraph[] = []
  children.push(
    new Paragraph({ children: [new TextRun({ text: p.fullName, bold: true, size: 32 })] }),
  )
  if (p.headline)
    children.push(new Paragraph({ children: [new TextRun({ text: p.headline, size: 22 })] }))
  const contact = [p.contact.email, ...p.contact.links]
    .filter((x): x is string => Boolean(x))
    .join('  |  ')
  if (contact)
    children.push(new Paragraph({ children: [new TextRun({ text: contact, size: 18 })] }))

  if (p.experiences.length > 0) {
    children.push(new Paragraph({ text: 'EXPERIENCE', heading: HeadingLevel.HEADING_2 }))
    p.experiences.forEach((exp, i) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${exp.org} — ${exp.title}`, bold: true })],
        }),
      )
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${exp.startYm} – ${exp.endYm ?? 'Present'}`,
              italics: true,
              size: 18,
            }),
          ],
        }),
      )
      for (const b of bulletsForExperience(dossier, i, bullets))
        children.push(new Paragraph({ text: b.text, bullet: { level: 0 } }))
    })
  }
  if (p.skills.length > 0) {
    children.push(new Paragraph({ text: 'SKILLS', heading: HeadingLevel.HEADING_2 }))
    children.push(new Paragraph({ text: p.skills.join(', ') }))
  }

  const doc = new Document({ sections: [{ children }] })
  return await Packer.toBuffer(doc)
}

// Reopen a generated .docx and recover its section headings (for the DOCX_INTEGRITY check).
export async function readDocxHeadings(
  filePath: string,
): Promise<{ text: string; headings: string[] }> {
  const mod = await import('mammoth')
  const mammoth = ((mod as { default?: unknown }).default ?? mod) as {
    convertToHtml(input: { path: string }): Promise<{ value: string }>
  }
  const { value: html } = await mammoth.convertToHtml({ path: filePath })
  let headings = [...html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi)].map((m) =>
    m[1]!.trim().toUpperCase(),
  )
  if (headings.length === 0) {
    const text = html.replace(/<[^>]+>/g, ' ').toUpperCase()
    headings = SECTION_HEADINGS.filter((h) => new RegExp(`\\b${h}\\b`).test(text))
  }
  return {
    text: html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    headings,
  }
}
