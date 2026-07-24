# HANDOFF — Assay (for Codex / the next session)

_Last updated: 2026-07-24, after Phase 10 (judge mode + sealed gallery personas) and Phase 11 (the surfacing audit). Both shipped, committed, pushed, and deployed to assayed.xyz._

Read [`AGENTS.md`](./AGENTS.md) first — it is the constitution. This file is the operational map so you don't get stuck.

## Where things stand

- **Branch `main`**, pushed to `Franlinozz/ASSAY`. Working tree clean.
- **Tests green:** 210 vitest + 4 foundry + 47 Playwright e2e. Route sweep green.
- **Live:** https://assayed.xyz (web) · https://assayed.xyz/docs · https://api.assayed.xyz/mcp. Listed on OKX.AI as ASP **#8599** (approvalStatus 2, under `archonaudit@gmail.com`).
- **Phases done:** P0–P11. P10 = judge mode + 3 sealed gallery personas. P11 = surfacing audit (zero ORPHANED capabilities).

## Two machines, don't confuse them

- **`/root/assay`** = the dev/working checkout (where you build + test).
- **`/opt/assay`** = the **prod deploy checkout** that the systemd services run from. Deploy = `cd /opt/assay && git pull`, rebuild, restart the service.
- This box **is** the shared VPS (`vmi3297534` / 62.171.182.75), also running Occestra + Sigil. Be additive; never take ports 8402 (Sigil), 3100/3101/8422 (Assay prod).

## Deploy runbook (after a green build on `main`)

```bash
# 1. push from /root/assay
cd /root/assay && git push origin main
# 2. pull + build + restart on the prod checkout
cd /opt/assay && git pull origin main
cd /opt/assay/apps/web && npm run build        # prebuild runs gen-standard
sudo systemctl restart assay-web.service        # :3100 behind Caddy
# docs (only if apps/docs changed):
cd /opt/assay/apps/docs && npm run build && sudo systemctl restart assay-docs.service   # :3101
# mcp-server (only if packages/mcp-server or a package it bundles changed):
cd /opt/assay && node packages/mcp-server/scripts/bundle.mjs && sudo systemctl restart assay-mcp.service   # :8422
```

Smoke: `curl -s -o /dev/null -w '%{http_code}\n' https://assayed.xyz/gallery` (expect 200).

## Secrets & env

- `/etc/assay/env` (chmod 600) — the prod EnvironmentFile: `ASY_SEALER_KEY`, `ASY_REGISTRY`, `ASY_CHAIN_ID=196`, `ASY_SIGNING_SECRET`, OKX keys, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`. Source it for any on-chain or live-provider script: `set -a && . /etc/assay/env && set +a`.
- `/root/.assay/secrets.env` — the operator copy. Never commit or echo secrets.

## THE ONE OUTSTANDING OPTIONAL STEP (P10) — live-LLM persona re-run

The 3 gallery personas ship with **fake-mode** pipeline output: the pipeline is fully real (extract → gate → coverage → forge → tribunal repair loop → chromium PDF → parse-back), only the LLM adapter is deterministic. This was deliberate (operator's weekly-limit + reproducible/zero-spend). The seals are **real on mainnet**. The phase's optional "one live LLM run each" headline is a ready operator step:

```bash
cd /root/assay/apps/web
set -a && . /etc/assay/env && set +a
ASY_PROVIDER_MODE=live node scripts/gen-personas.mjs     # 3 live runs — real spend
node scripts/gen-fixtures.mjs                             # keep fixture pages in sync
node scripts/seal-personas.mjs                            # anchors NEW leaves on mainnet (idempotent)
npm run build && # then deploy per runbook; salts land in gitignored apps/web/.persona-salts.json
```

Then commit `apps/web/lib/personas.generated.json` (+ any fixture changes) and update the seal tx in AGENTS.md. Current mainnet seal batch tx: `0xae83407122efebea92e422921f91dd319ad504c611388fe15196274dc92b923e` (chainId 196). Dossier IDs: Adaeze `DSR-WC0Q7NZ7`, Tomás `DSR-DFGF2A21`, Mei-Lin `DSR-31MV2EHX`.

## Key scripts

| Command (in `apps/web` unless noted) | What it does |
| --- | --- |
| `npm run gen:personas` | Run the pipeline per persona → `lib/personas.generated.json` (fake=default, `ASY_PROVIDER_MODE=live` for real). Launches chromium; NOT a prebuild step. |
| `npm run gen:fixtures` | Emit the live `/fixtures/*.html` pages LINK_LIVENESS checks. |
| `npm run seal:personas` | Anchor persona leaves on X Layer mainnet (needs `ASY_SEALER_KEY`). |
| `npm run sweep` (repo root) | Route sweep: hits every route + validates a real PDF download + forged-token 403. |
| `npm test` (repo root) | 210 vitest. |
| `npm run test:e2e` (repo root) | 47 Playwright (boots the fake stack: `e2e/stack.mjs`, ports 8455/3400). |

## Architecture quick-map

- **Personas** single source of truth: `packages/providers/src/fake/personas.ts` (résumé text + grounded fake extraction + live links + JD). The fake extractor (`packages/providers/src/fake/index.ts`) is **persona-aware** (matches the leading name; default Chidinma).
- **Judge tour:** `apps/web/app/judge/JudgeTour.tsx` — 14 beats, ~89s, pausable/skippable, driven only by the featured persona's stored data; verify beat = single ref-guarded fetch + cached fallback (survives provider outage).
- **Gallery:** `/gallery` (featured + others), `/gallery/[slug]` (full dossier + fictional tag). Loader: `apps/web/lib/personas.ts`.
- **Surfacing audit:** findings table in `FEATURES.md`; `/docs/api` documents machine endpoints; `scripts/route-sweep.mjs` guards against invisible capabilities; bug-taxonomy defenses in `packages/mcp-server/src/taxonomy.test.ts`.

## Gotchas that bit this session

- `exactOptionalPropertyTypes` is on — spread optional props conditionally (`{...(x ? {x} : {})}`).
- Regenerating personas uses a random salt → leaves change. **Generate → seal → commit in that order; don't regenerate after sealing** or the on-chain leaves won't match.
- After changing any package that the mcp-server bundles (providers, tribunal, …), rebuild `packages/mcp-server/dist/main.js` before the e2e stack will see it: `node packages/mcp-server/scripts/bundle.mjs`.
- The e2e stack serves the **built** `apps/web/.next`, so rebuild web before running e2e after a UI change.

## What P11 explicitly did NOT cover (not blocking; noted for completeness)

- Docs-link liveness is covered by the docs build (broken MDX links fail the build), not a live-crawl e2e.
- External explorer (oklink) links are not fetched in e2e (offline test discipline); they're the standard X Layer explorer templates.

## Suggested next work (P12+ is unwritten — ask the operator)

- The optional live-LLM persona re-run above (real spend).
- A hero README (AGENTS.md notes a "Phase 15" full README; the current one is a scaffold).
- Marketplace-mediated self-test + public-price check remain gated on OKX listing approval (P7 note).
