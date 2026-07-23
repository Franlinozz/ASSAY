# Changelog

All notable changes to Assay are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
