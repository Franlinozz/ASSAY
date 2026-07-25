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
const MAX_EXTRACTED_CHARS = 2_000_000
const MAX_PDF_PAGES = 200
const MAX_ZIP_ENTRIES = 2_000
const MAX_ZIP_UNCOMPRESSED = 64 * 1024 * 1024
const MAX_ZIP_RATIO = 500

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
    const isControl =
      code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127
    if (!isControl) out += ch
  }
  return out
}

async function defaultParsePdf(data: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // pdfjs transfers (detaches) the input ArrayBuffer. readFileSync returns a Buffer backed by
  // Node's shared pool, so we hand pdfjs a private copy to avoid corrupting the caller's buffer.
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    verbosity: 0,
  }).promise
  if (doc.numPages > MAX_PDF_PAGES) throw new Error('unsafe pdf page count')
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
    if (text.length > MAX_EXTRACTED_CHARS) throw new Error('unsafe pdf expansion')
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

function safeContainer(kind: DocKind, data: Uint8Array): boolean {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  if (kind === 'pdf') {
    if (buf.subarray(0, 5).toString('ascii') !== '%PDF-') return false
    const head = buf.subarray(0, Math.min(buf.length, 1_000_000)).toString('latin1')
    for (const match of head.matchAll(/\/(?:Count|Size)\s+(\d{4,})/g))
      if (Number(match[1]) > 100_000) return false
    return true
  }
  if (kind !== 'docx') return true
  if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) return false
  const ascii = buf.toString('latin1')
  if (/vbaProject\.bin/i.test(ascii)) return false
  let entries = 0
  let totalCompressed = 0
  let totalUncompressed = 0
  for (let offset = 0; offset + 46 <= buf.length; offset++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) continue
    entries += 1
    totalCompressed += buf.readUInt32LE(offset + 20)
    totalUncompressed += buf.readUInt32LE(offset + 24)
    if (entries > MAX_ZIP_ENTRIES || totalUncompressed > MAX_ZIP_UNCOMPRESSED) return false
  }
  if (entries === 0) return false
  return totalUncompressed / Math.max(1, totalCompressed) <= MAX_ZIP_RATIO
}

async function bounded<T>(work: Promise<T>, timeoutMs = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('document parse timeout')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
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
    return {
      ok: false,
      contentText: '',
      meta: { filename, kind: 'txt', bytes, chars: 0 },
      gap: 'INGEST_UNSUPPORTED',
    }
  }
  if (bytes > MAX_BYTES) {
    return { ok: false, contentText: '', meta: meta(kind, 0), gap: 'INGEST_TOO_LARGE' }
  }
  if (!safeContainer(kind, data)) {
    return { ok: false, contentText: '', meta: meta(kind, 0), gap: 'INGEST_HOSTILE' }
  }

  let raw = ''
  try {
    if (kind === 'pdf') raw = await bounded((deps.parsePdf ?? defaultParsePdf)(data))
    else if (kind === 'docx') raw = await bounded((deps.parseDocx ?? defaultParseDocx)(data))
    else raw = new TextDecoder('utf-8').decode(data)
  } catch {
    return { ok: false, contentText: '', meta: meta(kind, 0), gap: 'INGEST_EMPTY' }
  }

  const contentText = stripControlChars(raw).trim()
  if (contentText.length > MAX_EXTRACTED_CHARS) {
    return { ok: false, contentText: '', meta: meta(kind, 0), gap: 'INGEST_HOSTILE' }
  }
  if (!contentText) {
    return { ok: false, contentText: '', meta: meta(kind, 0), gap: 'INGEST_EMPTY' }
  }
  return { ok: true, contentText, meta: meta(kind, contentText.length) }
}
