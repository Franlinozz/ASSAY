import type { Dossier } from '@xyndicate/assay-core'
import { esc } from './templates/theme'

// One typographic dossier cover per dossier, composed as SVG (no image-model calls — this product
// spends ~zero on image generation). A hairline lattice + registration frame in Assay Office ink.
export function renderCoverSvg(dossier: Dossier): string {
  const p = dossier.profile
  const lattice: string[] = []
  for (let x = 0; x <= 1200; x += 24) lattice.push(`<line x1="${x}" y1="0" x2="${x}" y2="630" stroke="#E6E0D2" stroke-width="0.5"/>`)
  for (let y = 0; y <= 630; y += 24) lattice.push(`<line x1="0" y1="${y}" x2="1200" y2="${y}" stroke="#E6E0D2" stroke-width="0.5"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FBF9F3"/>
  ${lattice.join('')}
  <rect x="40" y="40" width="1120" height="550" fill="none" stroke="#205C4C" stroke-width="1.5"/>
  <rect x="48" y="48" width="1104" height="534" fill="none" stroke="#E6E0D2" stroke-width="1"/>
  <text x="80" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="72" fill="#1B1F2A" font-weight="600">${esc(p.fullName)}</text>
  <text x="82" y="348" font-family="Georgia, serif" font-size="28" fill="#205C4C" font-style="italic">${esc(p.headline ?? '')}</text>
  <text x="80" y="560" font-family="monospace" font-size="18" fill="#7E7A6E" letter-spacing="3">ASSAY · PROOF BEFORE POLISH</text>
</svg>`
}
