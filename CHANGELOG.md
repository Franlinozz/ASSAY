# Changelog

All notable changes to Assay are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
