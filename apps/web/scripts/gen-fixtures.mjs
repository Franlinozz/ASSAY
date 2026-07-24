import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

// Emits the live fixture pages the personas' evidence links point at, into apps/web/public/fixtures/.
// These are what tribunal LINK_LIVENESS fetch-checks (gotcha #11: a referenced link must resolve
// live). Every page is a clearly-labeled FICTIONAL demonstration (guardrail #7). Generated from
// lib/personas.generated.json so the link set is a single source of truth. Committed + deployed so
// the URLs resolve on assayed.xyz before any live run.

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const outDir = resolve(webRoot, 'public/fixtures')
mkdirSync(outDir, { recursive: true })

const doc = JSON.parse(readFileSync(resolve(webRoot, 'lib/personas.generated.json'), 'utf8'))

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function page(persona, link) {
  const backed = link.backsClaims
    ? link.backsClaims.map((i) => persona.claims[i]).filter(Boolean)
    : persona.claims.filter((c) => c.evidenceIds?.includes(link.id))
  const items = backed
    .map((c) => `      <li>${esc(c.text)}</li>`)
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${esc(link.label)} — ${esc(persona.name)} (fictional demonstration)</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 44rem; margin: 3rem auto; padding: 0 1.2rem;
         background: #FBF9F3; color: #1B1F2A; line-height: 1.55; }
  @media (prefers-color-scheme: dark) { body { background: #131519; color: #EDE8DC; } .tag { border-color:#2A2E37; } }
  .tag { display:inline-block; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:#7E7A6E;
         border:1px solid #E6E0D2; border-radius:999px; padding:.25rem .7rem; margin-bottom:1.2rem; }
  h1 { font-size:1.6rem; margin:.2rem 0; }
  .muted { color:#7E7A6E; }
  a { color:#205C4C; }
  ul { padding-left:1.1rem; }
  hr { border:0; border-top:1px solid #E6E0D2; margin:2rem 0; }
</style>
</head>
<body>
  <span class="tag">Fictional persona — demonstration</span>
  <h1>${esc(link.label)}</h1>
  <p class="muted">${esc(persona.name)} · ${esc(persona.headline)}</p>
  <p>This page exists so Assay's link-liveness check has a real, resolving source to verify. ${esc(persona.name)}
     is a <strong>fictional persona</strong> used to demonstrate the Assay pipeline end-to-end; nothing here
     describes a real person.</p>
  <hr />
  <h2>What this source backs</h2>
  <ul>
${items || '      <li class="muted">General portfolio evidence.</li>'}
  </ul>
  <hr />
  <p class="muted">Part of the Assay gallery. See the sealed dossier at
     <a href="https://assayed.xyz/gallery/${esc(persona.slug)}">assayed.xyz/gallery/${esc(persona.slug)}</a>.</p>
</body>
</html>
`
}

// Rebuild link→backsClaims from the persona fixtures via evidence ids on claims.
let count = 0
for (const persona of doc.personas) {
  const links = persona.evidence.filter((e) => e.kind === 'link')
  for (const ev of links) {
    const link = {
      label: ev.label,
      backsClaims: null,
      id: ev.id,
    }
    const file = basename(new URL(ev.url).pathname)
    writeFileSync(resolve(outDir, file), page(persona, link))
    count++
  }
}
console.log(`[fixtures] wrote ${count} fixture pages → ${outDir}`)
