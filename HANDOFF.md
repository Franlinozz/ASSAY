# HANDOFF — Assay (for Codex / the next session)

_Last updated: 2026-07-26, during the post-release submission-experience correction._

Read [`AGENTS.md`](./AGENTS.md) first — it is the constitution. This file is the operational map so you don't get stuck.

## Where things stand

- **Release:** every workspace and the production health default are **v1.1.0**; the published
  grader remains **AS-1.1.0**. Resolve the final tagged commit with `git rev-list -n1 v1.1.0`.
- **Release matrix:** 309 Vitest + 4 Foundry + 57 Playwright e2e = **370 tests**. Production builds,
  full typecheck, judged-artifact, generated-doc, marketplace-consistency, npm audit, secret scan,
  and dead-link gates are green.
- **Hosted CI:** use the `v1.1.0` tag / latest `main` run as the clean-runner record. Do not rely on
  the older Phase-15 run after the release tag exists.
- **Live:** https://assayed.xyz (web) · https://assayed.xyz/docs ·
  https://api.assayed.xyz/mcp deploy from `main`; all three systemd services must be active.
  Health must report v1.1.0 / AS-1.1.0 / OKX payment mode. ASP **#8599** retains all 13 registered
  offers (12 canonical tools; recovery-only order collection is not an offer, and the dossier job
  has three marketplace entry points). Ten mutable
  records now point to concrete `/x402/:service` resources after tx `0x037d27b6…e6df17`; the three
  original in-use records remain locked to `/mcp` and require OKX support to migrate. The
  post-update readback is **not listed · Listing under review**, with “AI quality review suggested
  pass.” Concrete `x402-check` reports `valid:true`.
- **Listing review:** the first OKX review REJECTED #8599 ("results don't match the description").
  Root cause and fix are logged in `AGENTS.md` (POST-REVIEW 2026-07-27) and `LISTING.md`: paid calls
  used to settle and then refuse an under-specified payload, and rigid argument names refused
  reasonable ones. `packages/mcp-server/src/intake.ts` now preflights before settlement (free 400
  with the exact payload to send) and maps synonyms onto the published schema. Unpaid probes still
  get the standard 402 first — do not reorder that. Resubmission copy is at the top of `LISTING.md`.
- **Phases done:** P0–P17. After v1.1.0 this branch is fixes-only. Operator-only work that cannot be
  fabricated by code remains: record/upload the real video, publish the X thread, paste its URL
  into `SUBMISSION.md`, and submit the organizer form.

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

| Command (in `apps/web` unless noted)    | What it does                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run gen:personas`                  | Run the pipeline per persona → `lib/personas.generated.json` (fake=default, `ASY_PROVIDER_MODE=live` for real). Launches chromium; NOT a prebuild step. |
| `npm run gen:fixtures`                  | Emit the live `/fixtures/*.html` pages LINK_LIVENESS checks.                                                                                            |
| `npm run seal:personas`                 | Anchor persona leaves on X Layer mainnet (needs `ASY_SEALER_KEY`).                                                                                      |
| `npm run regrade:personas`              | Re-grade the sealed persona artifact sets against the current Standard using Chromium screenshot sampling.                                              |
| `npm run sweep` (repo root)             | Route sweep: hits every route + validates a real PDF download + forged-token 403.                                                                       |
| `npm test` (repo root)                  | 288 Vitest.                                                                                                                                             |
| `npm run test:e2e` (repo root)          | 53 Playwright (boots the fake stack: `e2e/stack.mjs`, ports 8455/3400).                                                                                 |
| `npm run check:marketplace` (repo root) | Regenerates and proves machine manifest = docs = pricing for all 12 tools.                                                                              |
| `npm run check:judge` (repo root)       | Regenerates public facts, verifies README/test counts, and checks local + public links.                                                                 |
| `npm run dossier` (repo root)           | Runs a deterministic dossier through real Chromium render + parse-back; no provider key required.                                                       |
| `npm run studio:dev` (repo root)        | Starts the fake-provider MCP/API and local Studio on ports 8455/3400.                                                                                   |

## Architecture quick-map

- **Personas** single source of truth: `packages/providers/src/fake/personas.ts` (résumé text + grounded fake extraction + live links + JD). The fake extractor (`packages/providers/src/fake/index.ts`) is **persona-aware** (matches the leading name; default Chidinma).
- **Judge tour:** `apps/web/app/judge/JudgeTour.tsx` — 14 beats, ~89s, pausable/skippable, driven only by the featured persona's stored data; verify beat = single ref-guarded fetch + cached fallback (survives provider outage).
- **Gallery:** `/gallery` (featured + others), `/gallery/[slug]` (full dossier + fictional tag). Loader: `apps/web/lib/personas.ts`.
- **Surfacing audit:** findings table in `FEATURES.md`; `/docs/api` documents machine endpoints; `scripts/route-sweep.mjs` guards against invisible capabilities; bug-taxonomy defenses in `packages/mcp-server/src/taxonomy.test.ts`.
- **P12 apex:** `packages/renderers/src/interview.ts`, variant writers in `forge.ts`, Studio Interview tab + Brief modes, and `asy_interview_prep`.
- **P13 trust:** additive SQLite tables `dossier_versions`, `evidence_redactions`, `share_views`; owner controls in Studio Ledger/Report/Share; version-aware `asy_verify`; AS profile router in `packages/tribunal/src/hard/index.ts`; gallery re-grade script/data.
- **ASP #8599 payment boundary:** `/mcp` serves GET discovery, `initialize`, and `tools/list` without payment. Only a paid JSON-RPC `tools/call` may return the x402 challenge there. Fourteen concrete `/x402/:service` resources exist: 13 OKX.AI offer cards plus recovery-only `asy_order_result`; paid routes challenge immediately and free status/result/order-result/verify routes return 200. Completed explicit idempotency keys recover their body-bound cached response even without the original payment header. Re-run the platform payment checks, concrete-route probes, and explicit initialize/list/call probes after every payment-layer deploy.
- **P14 listing refresh:** ten services added successfully in tx `0xcf0a3f61e15e142d63e9931be3e27c8a48f32bf1e95af93588ee8f3c66e9e423`. Those ten now use their concrete x402 resources after tx `0x037d27b6bce4c174b7deb456d8f0e12fca45638c1fc59d9a13a0c4a8a9e6df17`. The three original services remain on `/mcp` because OKX blocks endpoint changes once a service is in use; do not create duplicates—request a support-side endpoint migration. The two-page public capture proved all 13 names/prices before the later review; `node scripts/capture-marketplace.mjs` fails closed unless that public state is available.
- **P17 avatar refresh:** the approved 768×768 derivative is live on Agent #8599’s identity in tx
  `0x46b94488ce8b5e7435229d22a0cab33559f8833dc92c571714ef6a065e30b4b8`. The identity API
  returned `SUCCESS`, then the public listing temporarily returned 404 while re-indexing. Do not
  mutate the identity again; rerun the fail-closed marketplace capture once OKX republishes it.
- **Post-release Studio correction:** owner pages now reconcile a long Forge from server state
  instead of ending their poll after four minutes. The Run monitor shows artifact-level progress
  and auto-advances to Report. Placeholder/dead contact links are quarantined before Forge, and
  deterministic source blockers no longer consume two impossible prose repairs.
- **Brand pack:** the ten operator-supplied high-resolution originals live in `deploy/avatar/`.
  Lightweight theme-aware web marks live in `apps/web/public/brand/`; the favicon/app icon uses the
  same mark, and `assets/brand/github-banner.webp` is the repository banner.
- **P14 A2A decision:** skipped. Current docs expect a trained, multi-round negotiation/delivery agent and 10–20 scenario simulations; Assay proves A2MCP/background jobs today but not that negotiation suite.

## Gotchas that bit this session

- `exactOptionalPropertyTypes` is on — spread optional props conditionally (`{...(x ? {x} : {})}`).
- Regenerating personas uses a random salt → leaves change. **Generate → seal → commit in that order; don't regenerate after sealing** or the on-chain leaves won't match.
- After changing any package that the mcp-server bundles (providers, tribunal, …), rebuild `packages/mcp-server/dist/main.js` before the e2e stack will see it: `node packages/mcp-server/scripts/bundle.mjs`.
- The e2e stack serves the **built** `apps/web/.next`, so rebuild web before running e2e after a UI change.

## What P11 explicitly did NOT cover (not blocking; noted for completeness)

- Docs-link liveness is covered by the docs build (broken MDX links fail the build), not a live-crawl e2e.
- External explorer (oklink) links are not fetched in e2e (offline test discipline); they're the standard X Layer explorer templates.

## Suggested next work

- Submission morning: execute all twelve checks in `SUBMISSION.md`, record the real video from
  `docs/DEMO-KIT.md`, publish `docs/X-POST.md`, paste the post URL, and submit the form.
- The optional live-LLM persona re-run above (real spend).
- Recheck the public #8599 URL after the avatar-triggered re-index; once it returns, rerun the
  fail-closed two-page marketplace capture to refresh the visual proof.
