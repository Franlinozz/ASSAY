// The Assay Office visual language, inlined (no external fonts/assets — CSP-safe, print-safe).
// Fonts self-host later; here we use self-contained stacks so nothing is fetched at render time.

export type Theme = 'light' | 'dark'

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Georgia, 'Times New Roman', serif"
const SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"

// Strict ATS CSS: single column, one sans family, black on white, standard headings. No color,
// tables, images, or columns — exactly what the FORMAT_LAW check enforces and ATS parsers expect.
export function atsCss(): string {
  return `
    @page { size: A4; margin: 16mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: ${SANS}; color: #000; background: #fff; font-size: 10.5pt; line-height: 1.4; margin: 0; }
    h1 { font-size: 16pt; margin: 0 0 2pt; }
    .headline { font-size: 11pt; margin: 0 0 2pt; }
    .contact { font-size: 9.5pt; margin: 0 0 10pt; }
    h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #000; padding-bottom: 2pt; margin: 12pt 0 6pt; }
    .role { font-weight: 600; }
    .dates { font-size: 9.5pt; }
    ul { margin: 3pt 0 8pt; padding-left: 16pt; }
    li { margin: 2pt 0; }
    p { margin: 3pt 0; }
  `
}

// The Assay Office CSS for designed / portfolio / document artifacts, theme-aware.
export function officeCss(theme: Theme): string {
  const light = {
    paper: '#FBF9F3',
    panel: '#F4F0E6',
    ink: '#1B1F2A',
    viridian: '#205C4C',
    vermilion: '#C63D21',
    hairline: '#E6E0D2',
    graphite: '#7E7A6E',
    chip: '#EDE8D8',
    brass: '#9A7B3D',
  }
  const dark = {
    paper: '#131519',
    panel: '#1C1F26',
    ink: '#EDE8DC',
    viridian: '#2E7A66',
    vermilion: '#D8532F',
    hairline: '#2A2E37',
    graphite: '#9A978C',
    chip: '#242832',
    brass: '#B3894D',
  }
  const t = theme === 'dark' ? dark : light
  return `
    @page { size: A4; margin: 14mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: ${SANS}; color: ${t.ink}; background: ${t.paper}; font-size: 10.5pt; line-height: 1.5; margin: 0; }
    .resume-mast { position: relative; padding: 9pt 12pt 13pt; margin: -3pt -3pt 13pt; overflow: hidden; border: 1px solid ${t.hairline}; background: linear-gradient(135deg, ${t.panel}, ${t.paper}); }
    .resume-mast::after { content: ""; position: absolute; width: 110pt; height: 110pt; right: -50pt; top: -62pt; border: 1px solid ${t.viridian}; border-radius: 46% 54% 48% 52%; opacity: .22; box-shadow: 0 0 0 8pt transparent, 0 0 0 9pt ${t.viridian}; }
    .registration { font-family: ${MONO}; font-size: 6.5pt; letter-spacing: .16em; color: ${t.graphite}; margin-bottom: 8pt; }
    .wordmark { font-family: ${SERIF}; font-size: 22pt; letter-spacing: 0.02em; margin: 0; }
    .headline { font-family: ${SERIF}; font-style: italic; color: ${t.viridian}; margin: 0 0 4pt; }
    .contact { font-family: ${MONO}; font-size: 8.5pt; color: ${t.graphite}; }
    .rule { height: 1px; background: ${t.hairline}; margin: 10pt 0; }
    .mast-rule { position: relative; height: 3px; margin-top: 10pt; background: ${t.hairline}; overflow: hidden; }
    .mast-rule span { display: block; width: 34%; height: 100%; background: ${t.viridian}; }
    .resume-section { display: grid; grid-template-columns: 28pt 1fr; gap: 9pt; padding: 2pt 0 8pt; border-bottom: 1px solid ${t.hairline}; break-inside: avoid; }
    .resume-section + .resume-section { margin-top: 7pt; }
    .section-index { font-family: ${MONO}; font-size: 7pt; letter-spacing: .1em; color: ${t.graphite}; padding-top: 2pt; }
    .section-body { min-width: 0; }
    h2 { font-family: ${SANS}; font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.14em; color: ${t.viridian}; margin: 12pt 0 6pt; }
    .resume-section h2 { margin-top: 0; }
    .experience-entry { break-inside: avoid; padding: 5pt 0 7pt; }
    .experience-entry + .experience-entry { border-top: 1px solid ${t.hairline}; padding-top: 8pt; }
    .role-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10pt; }
    .role { font-weight: 600; color: ${t.ink}; }
    .role span { font-weight: 450; color: ${t.graphite}; }
    .dates { font-family: ${MONO}; font-size: 8.5pt; color: ${t.graphite}; }
    ul { margin: 3pt 0 8pt; padding-left: 14pt; }
    li { margin: 3pt 0; }
    .experience-entry li { display: grid; grid-template-columns: 1fr auto; gap: 5pt; align-items: start; }
    .bullet-copy { min-width: 0; }
    .chip { display: inline-block; font-family: ${MONO}; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: ${t.graphite}; background: ${t.chip}; border: 1px solid ${t.hairline}; border-radius: 2px; padding: 1px 5px; margin-left: 6px; }
    .skill-list { display: flex; flex-wrap: wrap; gap: 4pt; }
    .skill-list span { font-size: 8.5pt; border: 1px solid ${t.hairline}; background: ${t.panel}; padding: 2pt 6pt; border-radius: 999px; }
    .credential-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5pt 12pt; }
    .credential { display: flex; flex-direction: column; padding: 4pt 0; }
    .credential span { color: ${t.graphite}; font-size: 8.5pt; }
    .resume-foot { display: flex; justify-content: space-between; gap: 10pt; margin-top: 11pt; font-family: ${MONO}; font-size: 6.5pt; letter-spacing: .09em; color: ${t.graphite}; }
    .resume-foot span:first-child { color: ${t.viridian}; }
    .card { border: 1px solid ${t.hairline}; background: ${t.panel}; padding: 10pt 12pt; margin: 8pt 0; }
    table.coverage { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    table.coverage th, table.coverage td { text-align: left; border-bottom: 1px solid ${t.hairline}; padding: 4pt 6pt; }
    .mark-strong { color: ${t.viridian}; font-weight: 600; }
    .mark-partial { color: ${t.brass}; }
    .mark-missing { color: ${t.graphite}; }
    .mark-confirm { color: ${t.viridian}; }
    .seal { color: ${t.vermilion}; font-family: ${MONO}; }
  `
}

export function htmlDoc(opts: { title: string; css: string; body: string; theme?: Theme }): string {
  const themeAttr = opts.theme ? ` data-theme="${opts.theme}"` : ''
  return `<!doctype html>
<html lang="en"${themeAttr}>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(opts.title)}</title>
<style>${opts.css}</style></head>
<body>${opts.body}</body>
</html>`
}
