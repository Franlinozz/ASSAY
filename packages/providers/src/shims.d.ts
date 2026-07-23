// pdfjs-dist's legacy Node build has no bundled types at this subpath. Minimal declaration of
// what parseback/ingest use for deterministic text extraction (no canvas / rendering).
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  interface TextItem {
    str?: string
  }
  interface PdfPage {
    getTextContent(): Promise<{ items: TextItem[] }>
  }
  interface PdfDoc {
    numPages: number
    getPage(pageNumber: number): Promise<PdfPage>
    destroy(): Promise<void>
  }
  export function getDocument(src: {
    data: Uint8Array
    useSystemFonts?: boolean
    verbosity?: number
  }): { promise: Promise<PdfDoc> }
}
