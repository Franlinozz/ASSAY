// One-off: generate the ingestion fixtures (committed). Run: node scripts/gen-fixtures.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { Document, Packer, Paragraph, TextRun } from 'docx'

const out = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))

const LINES = [
  'Chidinma Eze',
  'Senior Backend Engineer - Lagos, Nigeria',
  'chidinma.eze@example.com',
  '',
  'EXPERIENCE',
  'Paystack - Senior Backend Engineer (Mar 2021 - Present)',
  'Reduced API p95 latency by 38% using PostgreSQL connection pooling.',
  'Andela - Backend Engineer (Jun 2018 - Feb 2021)',
  'Mentored 5 junior engineers and led the migration to TypeScript.',
  '',
  'SKILLS',
  'TypeScript, Node.js, PostgreSQL, Redis, Kubernetes',
]

async function genPdf() {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842]) // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  let y = 800
  for (const line of LINES) {
    page.drawText(line, { x: 50, y, size: 12, font })
    y -= 20
  }
  writeFileSync(out('sample.pdf'), await pdf.save())
}

async function genDocx() {
  const doc = new Document({
    sections: [{ children: LINES.map((l) => new Paragraph({ children: [new TextRun(l)] })) }],
  })
  writeFileSync(out('sample.docx'), await Packer.toBuffer(doc))
}

writeFileSync(out('sample-resume.txt'), LINES.join('\n'))
await genPdf()
await genDocx()
console.log('fixtures written: sample.pdf, sample.docx, sample-resume.txt')
