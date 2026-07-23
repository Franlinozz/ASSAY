import type { GapCode } from './gaps'

// Document ingestion: pdf / docx / txt / md. Size limit 8MB, type allowlist, control chars
// stripped. Output {contentText, meta}. Downstream, this text is always wrapped as DATA
// (see prompts.wrapDocuments) — never as instructions.

export type DocKind = 'pdf' | 'docx' | 'txt' | 'md'

export interface IngestMeta {
  filename: string
  kind: DocKind
  bytes: number
  chars: number
}

export interface IngestResult {
  ok: boolean
  contentText: string
  meta: IngestMeta
  gap?: GapCode
}

export interface IngestDeps {
  parsePdf?: (data: Uint8Array) => Promise<string>
  parseDocx?: (data: Uint8Array) => Promise<string>
}

const MAX_BYTES = 8 * 1024 * 1024

function kindFromName(filename: string): DocKind | undefined {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'txt') return 'txt'
  if (ext === 'md' || ext === 'markdown') return 'md'
  return undefined
}

// Strip control characters, keeping only newline (10) and tab (9).
function stripControlChars(s: string): string {
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    const isControl = code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127
    if (!isControl) out += ch
  }
  return out
}

async function defaultParsePdf(data: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // pdfjs transfers (detaches) the input ArrayBuffer. readFileSync returns a Buffer backed by
  // Node's shared pool, so we hand pdfjs a private copy to avoid corrupting the caller's buffer.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true, verbosity: 0 }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
  }
  // Best-effort teardown: pdfjs's worker destroy() can throw DataCloneError under Node, but the
  // text is already extracted, so a teardown failure must not fail ingestion.
  try {
    await doc.destroy()
  } catch {
    /* ignore teardown errors */
  }
  return text
}

async function defaultParseDocx(data: Uint8Array): Promise<string> {
  const mod = await import('mammoth')
  const mammoth = ((mod as { default?: unknown }).default ?? mod) as {
    extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>
  }
  return (await mammoth.extractRawText({ buffer: Buffer.from(data) })).value
}

export async function ingestDocument(
  filename: string,
  data: Uint8Array,
  deps: IngestDeps = {},
): Promise<IngestResult> {
  const kind = kindFromName(filename)
  const bytes = data.byteLength
  const meta = (k: DocKind, chars: number): IngestMeta => ({ filename, kind: k, bytes, chars })

  if (!kind) {
    return { ok: false, contentText: '', meta: { filename, kind: 'txt', bytes, chars: 0 }, gap: 'INGEST_UNSUPPORTED' }
  }
  if (bytes > MAX_BYTES) {
    return { ok: false, contentText: '', meta: meta(kind, 0), gap: 'INGEST_TOO_LARGE' }
  }

  let raw = ''
  try {
    if (kind === 'pdf') raw = await (deps.parsePdf ?? defaultParsePdf)(data)
    else if (kind === 'docx') raw = await (deps.parseDocx ?? defaultParseDocx)(data)
    else raw = new TextDecoder('utf-8').decode(data)
  } catch {
    return { ok: false, contentText: '', meta: meta(kind, 0), gap: 'INGEST_EMPTY' }
  }

  const contentText = stripControlChars(raw).trim()
  if (!contentText) {
    return { ok: false, contentText: '', meta: meta(kind, 0), gap: 'INGEST_EMPTY' }
  }
  return { ok: true, contentText, meta: meta(kind, contentText.length) }
}
