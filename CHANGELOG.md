# Changelog

All notable changes to Assay are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
