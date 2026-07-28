import type { Profile } from '@xyndicate/assay-core'

// THE parse-back engine. Render the ATS PDF, re-extract its text, deterministically reconstruct
// the structured fields, and diff them against the source profile. Honest label used everywhere
// this is described:
export const PARSE_BACK_LABEL =
  "verified against Assay's deterministic parser and ATS format law — not a simulation of any specific vendor."

const SECTION_HEADINGS = ['SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'CERTIFICATIONS']

export interface ParsedResume {
  name: string
  email: string
  links: string[]
  experiences: Array<{ org: string; title: string; startYm: string; endYm: string }>
  skills: string[]
}

export interface ParseBackResult {
  fidelityPct: number
  fieldDiffs: Array<{ field: string; expected: string; got: string }>
  parsed: ParsedResume
  label: string
}

// Extract text as lines, reconstructing rows by y-position (robust to space-joined PDF text).
export async function pdfToLines(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    verbosity: 0,
  }).promise
  const lines: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const rows = new Map<number, Array<{ x: number; s: string }>>()
    for (const it of content.items) {
      if (!('str' in it)) continue
      const item = it as { transform: number[]; str: string }
      const y = Math.round(item.transform[5]!)
      const arr = rows.get(y) ?? []
      arr.push({ x: item.transform[4]!, s: item.str })
      rows.set(y, arr)
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const row = rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((r) => r.s)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (row) lines.push(row)
    }
  }
  try {
    await doc.destroy()
  } catch {
    /* teardown can throw under Node; text is already extracted */
  }
  return lines
}

export function reconstruct(lines: string[]): ParsedResume {
  const all = lines.join('\n')
  const name = lines[0] ?? ''
  const email = all.match(/[^\s|·]+@[^\s|·]+\.[^\s|·]+/)?.[0] ?? ''
  const links = [...all.matchAll(/https?:\/\/[^\s|·]+/g)].map((m) => m[0])

  const experiences: ParsedResume['experiences'] = []
  const expStart = lines.findIndex((l) => l.toUpperCase() === 'EXPERIENCE')
  if (expStart >= 0) {
    let end = lines.length
    for (let i = expStart + 1; i < lines.length; i++) {
      if (SECTION_HEADINGS.includes(lines[i]!.toUpperCase())) {
        end = i
        break
      }
    }
    let current: { org: string; title: string; startYm: string; endYm: string } | null = null
    for (let i = expStart + 1; i < end; i++) {
      const line = lines[i]!
      const dateMatch = line.match(/(\d{4}-\d{2})\s*[–—-]\s*(\d{4}-\d{2}|Present)/i)
      const roleMatch = line.match(/^(.+?)\s+[—–]\s+(.+)$/)
      if (dateMatch && current) {
        current.startYm = dateMatch[1]!
        current.endYm = dateMatch[2]!
      } else if (roleMatch && !/^[•\-*]/.test(line)) {
        current = { org: roleMatch[1]!.trim(), title: roleMatch[2]!.trim(), startYm: '', endYm: '' }
        experiences.push(current)
      }
    }
  }

  const skillsStart = lines.findIndex((l) => l.toUpperCase() === 'SKILLS')
  const skills =
    skillsStart >= 0 && lines[skillsStart + 1]
      ? lines[skillsStart + 1]!.split(/[,·]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : []

  return { name, email, links, experiences, skills }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function diffProfile(source: Profile, parsed: ParsedResume): ParseBackResult {
  const fieldDiffs: ParseBackResult['fieldDiffs'] = []
  let total = 0
  let matched = 0
  const check = (field: string, expected: string, got: string) => {
    total += 1
    if (norm(expected) === norm(got)) matched += 1
    else fieldDiffs.push({ field, expected, got })
  }

  check('name', source.fullName, parsed.name)
  check('email', source.contact.email ?? '', parsed.email)
  source.experiences.forEach((exp, i) => {
    const pe = parsed.experiences[i]
    check(`exp${i}.org`, exp.org, pe?.org ?? '')
    check(`exp${i}.title`, exp.title, pe?.title ?? '')
    check(`exp${i}.startYm`, exp.startYm, pe?.startYm ?? '')
    check(`exp${i}.endYm`, exp.endYm ?? 'Present', pe?.endYm ?? '')
  })

  return {
    fidelityPct: total === 0 ? 100 : Math.round((matched / total) * 100),
    fieldDiffs,
    parsed,
    label: PARSE_BACK_LABEL,
  }
}

export async function parseBackFromBuffer(
  pdf: Uint8Array,
  source: Profile,
): Promise<ParseBackResult> {
  return diffProfile(source, reconstruct(await pdfToLines(pdf)))
}

export function parseBackFromLines(lines: string[], source: Profile): ParseBackResult {
  return diffProfile(source, reconstruct(lines))
}
