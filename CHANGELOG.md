# Changelog

All notable changes to Assay are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
