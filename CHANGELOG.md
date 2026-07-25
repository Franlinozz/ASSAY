# Changelog

All notable changes to Assay are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.13.0] — 2026-07-24

### Added — Trust-layer depth and AS 1.1 (Phase 13)

- **Pre-share redaction:** each evidence item has an owner-only editor for profile fields, exact text ranges, and drawn document regions. Public share responses receive cleaned text only; source fragments, range offsets, and region coordinates never leave the server.
- **Version lineage:** every re-forge creates `vN+1`, keeps its own salt, seal, leaf, reports, and artifact snapshot, and exposes an artifact/Tribunal comparison against the preceding version. `asy_verify` accepts `DSR-…@vN` and returns the available lineage.
- **Privacy-shaped access logs:** creators can opt in per share link. The log contains only a count and UTC timestamps rounded to the hour; no IP field is stored or displayed.
- **Credential import:** certificates become Documented evidence with extracted credential name, issuer, and issue month. The product explicitly states that independent issuer confirmation is outside v1.
- **AS-1.1.0, published and shipped together:** deterministic checks now route through per-artifact profiles; prose artifacts no longer inherit PDF-only `FORMAT_LAW` clauses, story banks gain `STAR_COMPLETENESS`, and portfolio pages gain Chromium screenshot-sampled `PORTFOLIO_CONTRAST`.
- **Honest gallery re-grade:** all three sealed AS-1.0 artifact sets now show a separate AS-1.1 result of **7/8 PASS**. Each old story bank fails the new STAR profile; each rendered portfolio measures **15.42:1** and passes. Original seals and reports remain unchanged.
- Added 16 focused trust-layer tests plus AS 1.1 routing, PII leak, STAR, contrast, and generated-standard snapshot coverage.

## [0.12.0] — 2026-07-24

### Added — Interview Room and dossier variants (Phase 12)

- **Interview Room** is a first-class Studio stage and Forge artifact family: questions are generated from confirmed claims plus honest `missing` coverage rows; typed answers receive one bounded critic call for STAR structure/relevance and a deterministic ledger-number check. A planted “team of 12” answer against a confirmed “team of 8” ledger is blocked with a correction path.
- **Promotion case** mode adds a review date range and forges a performance-review narrative, promotion memo, and manager one-pager from the same claim set; `XARTIFACT_CONSISTENCY` guards figures across all three.
- **Client brief** mode forges a capability statement, selected project case studies, and proposal letter. Its share preset exposes work samples only.
- **A2MCP breadth:** `asy_interview_prep` is priced at 0.20 USDT; `asy_create_dossier_job` accepts `variant=job|promotion|freelance` at the existing 2.00 USDT price. Tool schemas, generated site/docs, and manifest all read the same source.
- Added 15 focused Phase-12 tests covering question generation, missing-row probes, STAR evaluation, planted contradictions, promotion consistency, freelance selection, and variant manifests.
- **One real promotion run:** `DSR-1VM1N6P5` (live providers, real Chromium) produced the three promotion documents plus manifest. Honest AS 1.0 result: **1/4 final PASS** (manifest passed; all three prose artifacts failed the critic and remain visibly failed). Signed commitment leaf `0x977ad11b10ec4fe70bf44d4efe23faa2e45fc5dc620816238f3dd5fbde8d298d` is pending rather than falsely described as anchored.

### Fixed

- Repaired the P11 typecheck regression in the placeholder taxonomy test by awaiting the async-capable hard-check contract.
- Live DeepSeek returned `experience.location: null`; extraction now safely omits null optional locations instead of rejecting the entire profile. The failed first operator attempt is retained in the phase record; the corrected run above is the successful checkpoint.

## [0.10.1] — 2026-07-24

### Audit — the surfacing pass (Phase 11, guardrail #10: nothing exists invisibly)

- **FEATURES.md reconciliation**: walked every MCP tool, HTTP route, Next route, and store table and classified each SURFACED / API-ONLY (documented) / ORPHANED. Findings table added to FEATURES.md. **Zero ORPHANED remain.**
- **Fixed an invisible capability**: `asy_create_dossier_job` created the public portfolio page (`/p/:slug`) but `asy_job_result` never returned its URL — it existed but nothing could reach it. Now surfaced as an absolute `portfolio` URL in the job result.
- **New `/docs/api` page** documents the machine-facing endpoints (`/health`, `/.well-known/assay.json`, `/d-api`, `/d-api/:id`, `/p/:slug`, `/f/:id`); the two previously-undocumented API-only routes now have a home.
- **Route sweep** (`scripts/route-sweep.mjs`, `npm run sweep`): boots the fake stack and hits every Next page + API + mcp-server public HTTP endpoint, asserting healthy status, zero raw-error leaks, a **real downloadable PDF** (`%PDF` magic bytes), and that a **forged file token is refused (403)**. Fails loudly if any capability goes invisible again.
- **Consistency sweep**: prices trace to one constant (`TOOL_PRICES` → `priceOf` → generated site/docs/listing), verified by test; test-count claims reconciled to reality (**210 vitest + 47 Playwright e2e + 4 foundry**).
- **Bug-taxonomy defenses** — each past bug class reproduced and pinned (`packages/mcp-server/src/taxonomy.test.ts` + Studio expiry test):
  - **asset-referenced-but-missing** (broken-image-PASS): a missing-file document is a hard FAIL, and `summarize` excludes a failed artifact from the pass-rate — never a broken artifact wearing a PASS badge.
  - **timezone** (the UTC bug): an instant near UTC midnight renders on the correct day in `Asia/Tokyo` (UTC+9), and `DATE_SANITY` evaluates in the dossier timezone.
  - **placeholder leak**: a `[BRACKET]` placeholder is a hard FAIL.
  - **raw provider error leak**: `sanitizeGap` returns only `{code, message}` — no stack, host, or raw error.
  - **stale price display**: `priceOf()` equals `TOOL_PRICES` for every tool; the free set is exactly `asy_verify`/`asy_job_status`/`asy_job_result`.
  - **share expiry actually expires** (clock injection): `getShareView` takes an injectable clock; a 7-day share is live now and `expired` (leaking no content) eight days later; revocation is immediate.
- **Full-product e2e** (`e2e/product.spec.ts`): theme toggle persists across navigation; mobile nav opens and navigates; the `/agents` copy button copies the MCP config; persona fixture pages are live + labeled fictional; persona live-source chips point at real `/fixtures` pages.

## [0.10.0] — 2026-07-24

### Added — Judge mode + the sealed gallery personas (Phase 10)

- **Three fictional gallery personas** (`@xyndicate/providers` `fake/personas.ts`, single source of truth), each a REAL run of the same pipeline the server runs (guardrail #7 — real pipeline output on clearly-labeled fictional personas):
  - **Adaeze Okonkwo — Product Operations, Lagos** (career-ladder case): mixed evidence tiers, one ambiguity claim that stays a question (an unsupported figure), a real FAIL→repair→PASS arc.
  - **Tomás Rivera — Frontend Engineer, Buenos Aires** (tech case): evidence that is live and checkable; every backing link is fetch-checked to earn the Linked tier.
  - **Mei-Lin Chao — Pharmacist → Health-Ops, Singapore** (career-changer): exercises the transferable-skills gap brief; the coverage map shows the real gaps rather than papering over them.
  - Each carries a visible **"Fictional persona — demonstration"** tag on every surface.
- **`/gallery`** now features the career-ladder case and lists the others beneath — no duplicates, no invented grades. **`/gallery/[slug]`** renders each persona's full dossier: the evidence ledger (tier per claim), the held-back/unsupported claims, the live fetch-checked sources, the coverage map (gaps named), a forged artifact with per-sentence claim refs, the tribunal repair story, the parse-back diff, and the seal receipt with an on-chain verify link.
- **Persona generation + real mainnet seal**: `scripts/gen-personas.mjs` runs the pipeline per persona (`ASY_PROVIDER_MODE=fake` = deterministic/zero-spend for layout+tests; `=live` = one real LLM run each). `scripts/seal-personas.mjs` anchors all three commitment leaves in **one `sealBatch` on X Layer mainnet** (salts kept in a gitignored sidecar, guardrail #3). `scripts/gen-fixtures.mjs` emits the live `/fixtures/*` pages that `LINK_LIVENESS` fetch-checks (gotcha #11). **All three seals verify on `/verify` against mainnet** (tx `0xae83407122efebea92e422921f91dd319ad504c611388fe15196274dc92b923e`, chainId 196).
- **`/judge` — the 90-second run**: a scripted, pausable, skippable replay of the featured persona's SEALED dossier. 14 beats — ledger builds (claims confirm) → an ambiguity question → JD pastes → coverage shows a 'missing' → forge runs → a sentence pulls its evidence thread → **ONE claim visibly BLOCKED as unsupported** (the honesty beat) → tribunal FAILS the first draft on a real check → repair → PASS → parse-back "100% fields survived" → SEAL stamp → share portal → on-chain verify. Every beat is driven by real stored data; the only live call (verify) has a **cached fallback**, so the tour survives a total provider outage; a standing "replaying a sealed run" caption keeps it honest. The landing gains a **"Watch the 90-second run"** secondary CTA.

### Tests

- New **`e2e/judge.spec.ts`**: gallery lists every persona with exactly one featured card (no duplicates); every persona page carries the fictional tag + its real dossier id + on-chain leaf; the featured persona shows a held-back claim; **all three seals verify against mainnet** through `/verify`; the judge tour is skippable and reaches the blocked, seal, and verify beats; the verify beat confirms live (with the cached fallback proven). `/gallery/[slug]` and `/judge` added to the axe + raw-gap sweeps. **Repo total: 201 vitest + 4 foundry + Playwright (web + studio + judge).**
- Persona runs bake the deterministic repair loop (`resetFakeRepairDemo()` per persona) so the sealed judge data contains a genuine FAIL→repair→PASS arc offline.

## [0.9.0] — 2026-07-24

### Added — the Studio + the recruiter Share Portal

- **Studio API** (`@xyndicate/mcp-server`): the interactive, browser-driven dossier flow, reusing the SAME engine the paid MCP tools use (ingest, extract, decompose, coverage, forge, tribunal repair loop, receipts). Access model = **capability URLs**: `POST /studio/dossier` mints an HMAC token; every mutation and the owner state read require `?t=<token>` or a **403** follows. No accounts (magic-link auth is a logged future item). Endpoints: `GET /d-state/:id`, `POST /d/:id/ingest` (job), `POST /d/:id/claims/:claimId`, `POST /d/:id/brief`, `POST /d/:id/forge` (job), `GET /d/:id/job/:jobId`, `GET /d/:id/events`, `POST /d/:id/seal`, `POST /d/:id/share[/revoke]`, and the public `GET /s-api/:shareId`.
  - **Live "role · action" feed** — a structured per-dossier event log ("Extractor · reading resume.pdf", "Tribunal · grading cover letter", "Sealer · anchoring to X Layer"), never generic noise.
  - **Ingest** handles pdf/docx/txt uploads, pasted text, pasted links (fetched live — a dead link earns no Linked tier), and guided answers; merges into the evolving dossier.
  - **Forge job** runs the evidence-gated writers + the tribunal **repair loop** with parse-back wired on real PDFs; persists artifacts, per-draft reports, and a signed-download set.
  - **Seal** computes the salted commitment + EIP-712 signature, sets the seal, enqueues the anchor.
  - **Share** stores exposure config (exposed claims, contact toggle, expiry) and a revoke flag; the recruiter view enforces PII exposure server-side and pre-builds the evidence-thread graph (claim ids never leave the server).
- **Studio UI** (`@xyndicate/web`): `/studio` start (name · timezone · optional email → capability URL), and `/d/:id` — a four-stage flow with a persistent stage rail:
  - **Ledger** — drag-drop upload + paste/links/answers tabs, a live event feed, claim review cards (tier chip + explanation, highlighted figures, Confirm/Edit/Reject), needs_confirmation cards asking their specific question, and a confirmed-claims progress meter. Nothing advances to Forge unconfirmed.
  - **Brief** — JD paste (+ General-purpose preset), the coverage map (strong/partial/confirm/missing, each pointing at its strongest claim; missing rows show the "we will not claim this" line inline).
  - **Forge** — artifact selector, live pipeline feed, and **the evidence drawer**: click any forged sentence and its claims + evidence light up via threads (the hero component, running for real).
  - **Report** — draft-by-draft Tribunal cards (findings, craft bars, repair briefs), the honest rollup, the parse-back field-diff table, **the seal moment** (a weighted vermilion stamp, ≈400ms, no confetti → receipt), download buttons for every file, and the share controls.
  - **`/s/:shareId`** — the recruiter portal: read-only, the résumé with hoverable evidence threads + tier chips, the Tribunal grade badge, live "Verify on X Layer", and a dignified "withdrawn by candidate" page on revoke.
  - **`/judge`** — route stub (Phase 10).
- **Same-origin proxy** `/api/asy/[...path]` forwards only the Studio + recruiter paths to the MCP server (no CORS surface; the capability token rides the query string).
- **Store** gains idempotent Studio columns (safe for the live prod DB): dossier `stage`/`email`, share `config`/`revoked`/`expires_at`; structured studio events with a cursor; rich share create/read/revoke.

### Tests

- Full-flow **Playwright e2e** on the fake-mode stack: create → ingest fixture résumé → confirm claims (incl. answering a needs_confirmation) → paste JD → see one honest 'missing' → forge → open the evidence drawer → tribunal report **incl. a first-draft fail** → seal → open the share link → verify → revoke → withdrawn page; plus token-security (mutation without token → 403). Server-side `studio.test.ts` covers the pipeline directly. **Repo total: 201 vitest + 25 Playwright e2e + 4 foundry.**
- The fake pipeline can exercise the repair loop deterministically via `ASY_FAKE_REPAIR_DEMO=1` (set only by the e2e stack; fails the cover letter's first draft, passes the repair) — never touches prod or unit tests. The Studio's ATS parse-back runs on real chromium PDFs (`ASY_STUDIO_REAL_PDF=1` in e2e; always on in prod).

## [0.8.0] — 2026-07-24

### Added

- `@xyndicate/web`: **the public Assay Office** on assayed.xyz (Next 15, port 3100, replaces the holding page). Both themes first-class (pre-paint boot script + toggle, no flash, no layout shift); self-hosted variable fonts (Fraunces / Inter / JetBrains Mono, ~240KB total); guilloché SVG lattice bands + rosette + registration marks as the signature graphic language; vermilion strictly reserved for seal states.
  - **`/` Landing** — the hero IS the signature interaction: a live evidence-threads component (SVG hairlines + framer-motion springs; hover a résumé bullet → taut threads to its evidence cards with tier chips), reused later by the Studio drawer and share portal. Plus: live anonymized recent-seals strip, the six-step loop as a hairline diagram (horizontal + mobile-vertical), four moat sections rendering **real product output** (forge sentences with claim refs, the parse-back diff, the live mainnet registry receipt, a share-portal preview), and the integrity-vs-truth line verbatim.
  - **`/standard`** — rendered from `renderStandardMarkdown`'s source module, regenerated on every build (guardrail #2): all 12 hard checks with plain-English law glosses, craft axes + weights, the exact pass rule, repair policy. "The standard does not bend for our own marketing."
  - **`/evaluation`** — a REAL dossier run (fictional persona, live Claude critic + DeepSeek extraction): first-draft **FAIL cards with real findings**, repair briefs verbatim, PASS cards, one honest final fail, the honest 4/8-first-draft rollup, and the full parse-back field diff (100% fidelity, 10/10 fields survived).
  - **`/pricing`** — human framing + the full generated tool table (same source as the paywall) + the comparison line: "The incumbents charge $50/month to keyword-stuff. Assay charges cents per call to prove."
  - **`/agents`** — endpoint, copyable MCP config, the x402 meter explained in four steps, and a tool reference **generated from the server's own zod schemas**.
  - **`/verify`** — live on-chain check via the real free `asy_verify` MCP call (server-proxied, zero wallet), with honest sealed / pending / not-found / unavailable states.
  - **`/gallery`** — grid wired to real dossier data with featured-flag support; honest awaiting-assay slots until the Phase-10 persona set.
  - Global: OG images chromium-rendered from a certificate template (verified by eye), sitemap, robots, favicon, `/api/verify` + `/api/recent-seals` proxies with sanitized-gap degradation.
- `@xyndicate/docs`: **Fumadocs skeleton** (v15 line, Tailwind v4, basePath `/docs`, port 3101): quickstart, **tools reference generated from `toolspec.ts`**, **standard mirror generated via `renderStandardMarkdown`**, verify guide, x402 notes. Search, sidebar, dark/light built in.
- `@xyndicate/mcp-server`: `toolspec.ts` — tool titles/descriptions/zod schemas extracted to one table consumed by the server, the site, and the docs (published schemas = shipped schemas); `GET /d-api` — anonymized recent-seals strip (truncated id + status + day only).
- **E2e suite** (Playwright on the fake-mode stack, seeded through the real pipeline): both themes, hero-threads interaction, live strip, `/standard`-vs-`renderStandardMarkdown` content equality, verify round-trip (honest `pending` without a sealer key) + bogus-ref honesty, **axe a11y zero serious/critical on all 7 pages**, raw-gap/placeholder HTML sweep. **22 e2e + 193 vitest + 4 foundry.**
- Visual self-audit loop tooling (`scripts/audit.mjs`): every page × 1440px/390px × both themes, screenshots reviewed by the executor; defects found were fixed and re-shot (thread geometry, axis-bar rendering, loop-caption clipping, AA contrast).

### Fixed (found by this phase's one real-provider run — the run exists to catch exactly these)

- **ClaudeAdapter**: the Anthropic API now rejects `temperature` for claude-sonnet-5 (400) — every Claude call silently fell back to OpenAI. Temperature dropped; Claude is critic+writer again per the cost policy.
- **Claim-gate unit canon**: live extraction writes descriptive units ("percent", "requests per second") that the suffix-only number matcher could never match, so every honest figure became a question. Units now canonicalize (`percent`→`%`, descriptive→value-only) with the embellishment protection intact (a wrong value still never passes).
- **Extraction robustness**: live models sometimes emit `numericFacts.unit: null` — coerced to schema-legal shapes instead of failing the dossier.
- **Critic robustness**: live critics sometimes emit findings as bare strings — coerced to `{axis, detail}`; no more `[craft:undefined]` lines in repair briefs.

### Changed

- Light-theme graphite/brass darkened to AA-contrast text grades and text-safe viridian/vermilion variables added in both themes (axe zero-serious is a hard requirement; decorative marks keep the AGENTS.md token values).

## [0.7.0] — 2026-07-24

### Added

- `@xyndicate/mcp-server`: **the sellable ASP** — a stateless MCP server exposing all **10 Assay tools** over `POST /mcp` (streamable-HTTP, JSON responses), a fresh `McpServer` + transport per request (gotcha #1).
  - **10 tools, prices exact per the AGENTS.md table**: `asy_ats_scan` (0.05, the traction wedge: ingest → parse-back on PDFs → format-law findings → honest JD keyword coverage), `asy_claim_audit` (0.05), `asy_fit_brief` (0.10), `asy_cover_letter` (0.15), `asy_story_bank` (0.20), `asy_tailor_resume` (0.30, evidence-constrained writers that refuse to fabricate — guardrail #1), `asy_create_dossier_job` (2.00, full extract→grade→seal as an async job), `asy_job_status`/`asy_job_result` (free), `asy_verify` (**FREE FOREVER**).
  - **x402 PaymentGate**: `DevGate` implements the documented OKX seller-SDK shape offline (402 + base64 `PAYMENT-REQUIRED` advertising `eip155:196`/USDT → `PAYMENT-SIG` replay → 200 + `PAYMENT-RESPONSE`); `OkxGate` wires the real `@okxweb3/x402-*` SDK + Facilitator (live-verified in P7). Free tools ungated, **PolicyGate before payment**, **idempotent replay** (a duplicate never re-charges or re-runs).
  - **better-sqlite3 store** (sync repo, gotcha #4): dossiers, evidence files (binaries with 24h HMAC signed-URL tokens at `GET /f/:id?tok=`), orders, jobs, seals_pending, shares, append-only per-dossier event log.
  - **Async job worker** (in-process dossier pipeline) + **anchor worker** (drains `seals_pending` → `RegistryClient.sealBatch`, retries with attempt tracking, surfaces queue age as a `/health` alert, never crashes the server).
  - **HTTP surface** (express 5): `/health` (<100ms, zero model calls), `/.well-known/assay.json` manifest, `/d-api/:id` PII-sanitized dossier JSON, `/p/:slug` portfolio, `/f/:id` signed files; per-IP 60/min token bucket; 400/402/405/413/415 mapping; sanitized gap codes only (guardrail #9).
- **Runnable dist**: mcp-server bundles from source with esbuild into one self-contained `dist/main.js` (externalizing npm deps) — resolves the cross-package `paths→src` nesting that left sibling `dist/index.js` pointers dangling (the "bundling strategy finalized at P6" deferred in the P2 deviation).
- 33 new mcp-server vitest tests (10-tool listing via the SDK `Client`+`InMemoryTransport`; sabotage-fixture FORMAT_LAW findings; honest `missing` coverage; dossier job queued→done with tribunal summary; seal round-trip; live-server matrix: 402 challenge shape, dev-gate 200, free-tool bypass, idempotent replay, rate limit, signed-URL rejection, health SLA, 405/415/400). **Repo total: 183 vitest + 4 foundry.**

### Verified

- **Live dev-mode smoke** (`node dist/main.js`): manifest + `tools/list` (10) + unpaid `asy_ats_scan` → 402 (decoded challenge = documented shape) → `PAYMENT-SIG` replay → 200 + `PAYMENT-RESPONSE` (7 real format findings) → idempotent replay returned the original result unchanged.

### Doc shapes (gotcha #8, re-confirmed 2026-07-24)

- OKX x402 packages resolve and are implemented-to: `@okxweb3/x402-express@0.1.1`, `@okxweb3/x402-core@0.1.0`, `@okxweb3/x402-evm@0.2.1`. Core exposes `x402HTTPResourceServer` (DynamicPrice per request, `onProtectedRequest` grant/abort hook, `processHTTPRequest`/`processSettlement`) + `OKXFacilitatorClient` + `registerExactEvmScheme` — the OkxGate is wired to these.

## [0.6.0] — 2026-07-23

### Added

- `@xyndicate/receipts`: **EIP-712 dossier seal** (`signSeal` / `recoverSealer` / `verifySeal`, domain-bound to chainId + registry) and **salted commitments** (`commitmentLeaf` = keccak256(manifestHash ‖ salt); `buildVerifyBundle` → a public, salt-free bundle, honestly `unsigned` when no sealer key is set).
- `@xyndicate/contracts`: **`AssayRegistry.sol`** (Solidity ^0.8.24, no imports) — immutable sealer, `mapping(bytes32 => uint256) anchoredAt`, idempotent `sealBatch` (onlySealer, `Sealed` event); **zero personal data by construction**. Built + tested with foundry (4 Solidity tests: onlySealer revert, idempotent re-seal, seal+read, batch-of-50 gas-sane).
- `RegistryClient` (viem: `sealBatch` / `anchoredAt` / `sealer`) + `scripts/deploy.ts` for X Layer testnet (1952) / mainnet (196).
- 13 offline TS tests (EIP-712 round-trip + tamper/domain rejection; commitment determinism; salt-absence assertions; RegistryClient against a local anvil node). Repo total: 153 vitest + 4 foundry.

### On-chain

- **Testnet rehearsal complete**: `AssayRegistry` deployed to X Layer testnet (chainId **1952**) at `0x355c324eed9347ec90d098d6dcde1438e6c89a7f`; 3 fixture leaves anchored and read back on-chain.

### Fixed

- Recorded that X Layer testnet chainId is **1952**, not 195 as some docs (and the plan) state.

## [0.5.0] — 2026-07-23

### Added

- `@xyndicate/renderers`: the **Forge** — evidence-gated generation, Assay Office templates, PDF/DOCX, and the live ATS parse-back engine.
- **Evidence-gated writer** (`writeArtifact`): the claim gate runs BEFORE any render; one auto-tightening reprompt; whatever still fails becomes a user question, never prose (guardrail #1).
- **Templates**: strict ATS resume, designed resume, cover letter, STAR story bank (evidence-tier chips), fit map, gap brief, and a standalone portfolio page — in both light/dark themes, inlined CSS (no external assets).
- **PDF** via headless chromium (`htmlToPdf`) and **.docx** (`buildResumeDocx`) mirroring the ATS section headings.
- **ATS parse-back engine** (`parseBackFromBuffer`): re-extracts the rendered ATS PDF (pdfjs, y-row reconstruction), rebuilds the structured fields, and diffs them against the source profile → `{fidelityPct, fieldDiffs}`. **This flips the tribunal `ATS_PARSE_BACK` check live.** Honest label: "verified against Assay's deterministic parser and ATS format law — not a simulation of any specific vendor."
- **Manifest** assembly + a machine-readable **agent manifest** (coverage rollup, approved claims, risks, integrity hash).
- **Forge orchestrator** (`forgeDossier`) + a typographic SVG dossier cover (no image-model calls).
- `scripts/run-dossier.mjs` (full extract→coverage→forge→tribunal-with-live-parse-back→manifest). Verified: parse-back **100% fidelity** in both fake and real (DeepSeek + Claude) runs.
- 17 renderer tests incl. a real chromium render→PDF→parse-back round-trip (repo total: 140).

### Fixed

- `extractNumbers` no longer reads digits glued to letters (p95, h2, v4) as claimed quantities.
- `FORMAT_LAW` scans only `<h2>`/`<h3>` section headings (the `<h1>` name is the résumé title).

## [0.4.0] — 2026-07-23

### Added

- `@xyndicate/tribunal`: the **Assay Standard v1.0.0** — deterministic hard checks + Claude critic craft axes + a bounded repair loop + a rubric that publishes itself.
- **12 hard checks**: `CLAIM_COVERAGE`, `EVIDENCE_RESOLVES`, `LINK_LIVENESS`, `PLACEHOLDER_TEXT`, `DATE_SANITY`, `XARTIFACT_CONSISTENCY`, `FORMAT_LAW`, `DOCX_INTEGRITY`, `ATS_PARSE_BACK` (registered, returns `pending` until P4 wires the engine), `CONTACT_VALIDITY`, `PII_HYGIENE`, `JD_COVERAGE` (report-only, never fails).
- **Craft critic** (`gradeCraft`, Claude): 6 weighted axes (voice, specificity, quantification, positioning, tailoring, evidence honesty). On degrade it does not fabricate a passing grade.
- **Pass rule** (exact): all hard checks pass **and** craft weighted mean ≥ 72 **and** no axis < 60.
- **Repair loop** (`gradeWithRepair`): at most 2 repairs; **every draft's report ships** in the dossier, including failing first drafts; `summarize` reports an honest post-repair pass rate.
- **`renderStandardMarkdown`** generates the `/standard` page and docs rubric from the same registry the grader runs (guardrail #2).
- 36 offline tribunal tests (repo total: 123).

## [0.3.0] — 2026-07-23

### Added

- `@xyndicate/providers`: every touchpoint with the outside world, always degradable, fake-first.
- **Model router** (`createRouter`): role→provider preference (extractor/decomposer/utility→DeepSeek, writer/critic→Claude, OpenAI fallback), strict-JSON with one repair retry, per-role timeout→fallback→graceful degrade, and a per-dossier token/cost **governor**.
- **Fakes are the default** (`ASY_PROVIDER_MODE=fake`): deterministic offline adapters + `FakeFetcher`, zero spend.
- **Document ingestion** (`ingestDocument`): pdf (pdfjs-dist), docx (mammoth), txt/md; 8MB limit, type allowlist, control-char strip.
- **SSRF-guarded fetcher** (`createFetcher`): DNS-first resolution, blocks private/reserved/loopback/link-local (incl. 169.254.169.254) + non-http(s) schemes + DNS-rebinding, ≤3 re-validated redirects, 1MB cap, content-type allowlist, 1h cache.
- **Extraction** (`extractProfile`): evidence linkage + a deterministic groundedness post-check that drops any claim whose text isn't in the source (logged as a gap), and marks quantified-without-source claims `needs_confirmation`.
- **JD decomposition** (`decomposeJd`) + **deterministic coverage mapper** (`computeCoverage`, no LLM): strong / partial / missing / confirm.
- **Injection framing** (`wrapDocuments`, guardrail #8) and **gap sanitizer** (`sanitizeGap`, guardrail #9).
- `scripts/smoke-cheap.mjs` (extract→decompose→coverage on the bundled persona) and committed pdf/docx/txt fixtures.
- 30 offline provider tests incl. the full SSRF matrix (repo total: 88).

### Changed

- Live LLM adapters call provider REST endpoints via `fetch` (no SDK dependency → no version drift).
- Internal packages resolve to TS source in tests/typecheck (Vitest alias + tsconfig paths).

## [0.2.0] — 2026-07-23

### Added

- `@xyndicate/assay-core`: the pure domain heart (zero network, zero LLM) — zod schemas + inferred types for Evidence, Claim, Experience, Profile, Brief, Requirement, Coverage, Sentence, Artifact, Dossier (plus provisional Seal / TribunalReport).
- **Claim gate** (`assertRenderable` / `toQuestions`): flags `UNSUPPORTED_SENTENCE`, `UNCONFIRMED_CLAIM`, `DANGLING_EVIDENCE`, and `NUMBER_NOT_IN_EVIDENCE` — numbers in prose must appear in a cited claim's `numericFacts` — and turns violations into user-facing questions.
- **Evidence-strength tiers** (`computeStrength` / `tierExplanation`): attested / documented / linked / sealed, with dead-link demotion (a link earns "linked" only when `fetchedOk === true`).
- **Canonical manifest** (`canonicalize`, `buildManifest`, `hashManifest`, sha256/keccak256 helpers): deterministic, key-order-independent serialization; the manifest carries only ids, kinds, tiers, and hex digests — **no raw personal prose** (asserted by test).
- **PolicyGate** (`policyGate`): deterministic refusals for impersonation, discrimination, deception, and fabricated credentials.
- **Facts block** (`buildFactsBlock`, gotcha #14) and **timezone-correct date utilities** (`ymInTz`, `tenureMonths`, …).
- 51 offline unit tests for `assay-core` (repo total: 59).

## [0.1.0] — 2026-07-23

### Added

- Monorepo scaffold: npm workspaces, Node 22, TypeScript strict everywhere (incl. `exactOptionalPropertyTypes`).
- Workspaces: `packages/assay-core`, `packages/providers`, `packages/tribunal`, `packages/renderers`, `packages/receipts`, `packages/contracts`, `packages/mcp-server`, `apps/web` (Next.js 15 app router), `apps/docs` (Fumadocs, placeholder).
- Build constitution `AGENTS.md` (hard guardrails, price table, design tokens, gotchas, deviations log).
- Vision doc `ASSAY.md` (six-step loop, four moats, evidence tiers, integrity-vs-truth honesty line).
- Project docs: `FEATURES.md` capability matrix, `SECURITY.md`, `CHANGELOG.md`, `README.md` stub, `LICENSE` (MIT).
- Tooling: Vitest unit runner (one passing placeholder test per workspace), Playwright e2e wiring, `.env.example` covering every `ASY_*` variable.
- `apps/web` holding page in the "Assay Office" visual language (both light/dark themes).

[Unreleased]: https://github.com/Franlinozz/ASSAY/commits/main
