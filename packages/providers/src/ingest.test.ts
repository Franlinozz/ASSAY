import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ingestDocument } from './ingest'

const fx = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)))

describe('ingestDocument', () => {
  it('ingests txt and strips control characters (keeping newlines)', async () => {
    const raw = 'Hello' + String.fromCharCode(0, 7) + 'World\nLine2' // NUL + BEL between the words
    const r = await ingestDocument('note.txt', new TextEncoder().encode(raw))
    expect(r.ok).toBe(true)
    expect(r.contentText).toBe('HelloWorld\nLine2')
    expect(r.meta.kind).toBe('txt')
  })

  it('ingests markdown', async () => {
    const r = await ingestDocument('readme.md', new TextEncoder().encode('# Title\n- item'))
    expect(r.ok).toBe(true)
    expect(r.meta.kind).toBe('md')
  })

  it('rejects unsupported file types', async () => {
    const r = await ingestDocument('malware.exe', new Uint8Array([1, 2, 3]))
    expect(r.ok).toBe(false)
    expect(r.gap).toBe('INGEST_UNSUPPORTED')
  })

  it('rejects oversize files (>8MB)', async () => {
    const r = await ingestDocument('big.txt', new Uint8Array(8 * 1024 * 1024 + 1))
    expect(r.gap).toBe('INGEST_TOO_LARGE')
  })

  it('reports empty when a file has no readable text', async () => {
    const r = await ingestDocument('empty.txt', new Uint8Array())
    expect(r.gap).toBe('INGEST_EMPTY')
  })

  it('ingests a fixture PDF via pdfjs', async () => {
    const r = await ingestDocument('sample.pdf', fx('sample.pdf'))
    expect(r.ok).toBe(true)
    expect(r.meta.kind).toBe('pdf')
    expect(r.contentText).toContain('Chidinma')
    expect(r.contentText).toContain('38')
  }, 30000) // pdfjs under full-suite CPU contention can exceed the default 5s

  it('ingests a fixture DOCX via mammoth', async () => {
    const r = await ingestDocument('sample.docx', fx('sample.docx'))
    expect(r.ok).toBe(true)
    expect(r.meta.kind).toBe('docx')
    expect(r.contentText).toContain('Chidinma')
  }, 30000)

  it('dispatches to an injected pdf parser (DI)', async () => {
    const r = await ingestDocument('x.pdf', new TextEncoder().encode('%PDF-1.4'), {
      parsePdf: async () => 'injected pdf text',
    })
    expect(r.ok).toBe(true)
    expect(r.contentText).toBe('injected pdf text')
  })
})
