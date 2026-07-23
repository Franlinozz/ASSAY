# FEATURES — the capability matrix

> Guardrail #10: this table stays current **every phase**. No capability may exist without a row. Every row names the package that implements it, the route/tool it is reached through, the UI surface it appears on, and the test that proves it.

| Capability | Package | Route / Tool | UI surface | Test |
|---|---|---|---|---|
| Domain contracts — Evidence/Claim/Experience/Profile/Brief/Coverage/Sentence/Artifact/Dossier (zod + inferred types) | `@xyndicate/assay-core` | internal (`schemas.ts`) | — (engine) | `packages/assay-core/src/schemas.test.ts` |
| Claim gate — `assertRenderable` / `toQuestions` (4 finding classes incl. number-in-evidence) | `@xyndicate/assay-core` | internal (`claimGate.ts`) | Forge drawer (P3) | `packages/assay-core/src/claimGate.test.ts` |
| Evidence-strength tiers — `computeStrength` / `tierExplanation` (dead-link demotion) | `@xyndicate/assay-core` | internal (`strength.ts`) | Ledger badges (P3) | `packages/assay-core/src/strength.test.ts` |
| Canonical manifest + hashing — `buildManifest` / `manifestHash` (no personal prose on-chain) | `@xyndicate/assay-core` | internal (`canonical.ts`) | Verify (P5) | `packages/assay-core/src/canonical.test.ts` |
| PolicyGate — `policyGate` (impersonation / discrimination / deception / fabricated-credential) | `@xyndicate/assay-core` | pre-payment gate (P6) | — (engine) | `packages/assay-core/src/policy.test.ts` |
| Facts block — `buildFactsBlock` (writer-prompt injection, gotcha #14) | `@xyndicate/assay-core` | internal (`facts.ts`) | Forge (P3) | `packages/assay-core/src/facts.test.ts` |
| Timezone-correct dates — `ymInTz` / `tenureMonths` / `isFutureYm` | `@xyndicate/assay-core` | internal (`time.ts`) | all timestamps | `packages/assay-core/src/time.test.ts` |
| Model router — fake-first, JSON-repair, timeout→fallback→degrade, cost governor | `@xyndicate/providers` | internal `createRouter` | — (engine) | `packages/providers/src/router.test.ts` |
| Document ingestion — pdf (pdfjs) / docx (mammoth) / txt / md, size+type limits, control-char strip | `@xyndicate/providers` | internal `ingestDocument` | Ledger upload (P3) | `packages/providers/src/ingest.test.ts` |
| SSRF-guarded link fetcher — private-range / scheme / DNS-rebinding blocks, 1h cache | `@xyndicate/providers` | internal `createFetcher` | Tribunal LINK_LIVENESS (P3) | `packages/providers/src/fetcher.test.ts` |
| Evidence extraction + groundedness post-check — drops ungrounded claims, marks needs_confirmation | `@xyndicate/providers` | internal `extractProfile` | Ledger (P3) | `packages/providers/src/extract.test.ts` |
| JD decomposition — must/nice + normalized keywords | `@xyndicate/providers` | internal `decomposeJd` | Brief (P3) | `packages/providers/src/decompose.test.ts` |
| Deterministic coverage mapper — strong / partial / missing / confirm (no LLM) | `@xyndicate/providers` | internal `computeCoverage` | Brief coverage map (P3) | `packages/providers/src/coverage.test.ts` |
| Prompt injection framing — uploaded docs wrapped as DATA (guardrail #8) | `@xyndicate/providers` | internal `wrapDocuments` | — (engine) | `packages/providers/src/prompts.test.ts` |
| Gap sanitizer — stable codes, raw errors to logs only (guardrail #9) | `@xyndicate/providers` | internal `sanitizeGap` | all public surfaces | `packages/providers/src/gaps.test.ts` |
| Assay Standard v1.0.0 + self-publishing rubric (guardrail #2) | `@xyndicate/tribunal` | `renderStandardMarkdown` → `/standard` (P7) | The Standard page | `packages/tribunal/src/standard.test.ts` |
| 12 deterministic hard checks — claim coverage, evidence resolves, link liveness, placeholder, date sanity, cross-artifact consistency, format law, docx integrity, ATS parse-back (pending→P4), contact validity, PII hygiene, JD coverage (info) | `@xyndicate/tribunal` | internal (`hard/checks.ts`) | Report | `packages/tribunal/src/hard/checks.test.ts` |
| Craft critic (Claude, 6 weighted axes + repair brief) | `@xyndicate/tribunal` | internal `gradeCraft` | Report | `packages/tribunal/src/loop.test.ts` |
| Pass rule (all hard pass ∧ craft mean ≥72 ∧ no axis <60; craft only for prose artifacts) + repair loop ≤2 (reports always ship) | `@xyndicate/tribunal` | internal `passRule` / `gradeWithRepair` | Evaluation page (P7) | `packages/tribunal/src/standard.test.ts`, `packages/tribunal/src/loop.test.ts` |
| Evidence-gated writer — claim gate BEFORE render, one auto-tighten, remainder → questions (guardrail #1) | `@xyndicate/renderers` | internal `writeArtifact` | Forge drawer | `packages/renderers/src/writer.test.ts` |
| Assay Office templates — ATS (strict) / designed / cover letter / story bank / fit map / gap brief / portfolio, both themes | `@xyndicate/renderers` | internal `renderArtifactHtml` | Forge / Share | `packages/renderers/src/render.test.ts` |
| PDF (Playwright chromium) + DOCX (mirrors ATS headings) | `@xyndicate/renderers` | internal `htmlToPdf` / `buildResumeDocx` | Forge | `packages/renderers/src/forge.test.ts` |
| **ATS parse-back engine** — pdfjs reconstruction + field diff, honest label; flips tribunal `ATS_PARSE_BACK` live | `@xyndicate/renderers` | internal `parseBackFromBuffer` | Report "parse fidelity" badge | `packages/renderers/src/render.test.ts`, `packages/renderers/src/forge.test.ts` |
| Manifest assembly + machine-readable agent manifest | `@xyndicate/renderers` | internal `buildAgentManifest` | For Agents | `packages/renderers/src/render.test.ts` |
| Forge orchestrator (all artifacts, gated) + typographic SVG cover (no image model) | `@xyndicate/renderers` | internal `forgeDossier` | Forge | `packages/renderers/src/forge.test.ts` |
| EIP-712 dossier seal — sign / recover / verify (domain-bound) | `@xyndicate/receipts` | internal `signSeal` / `verifySeal` | Verify page (P7) | `packages/receipts/src/eip712.test.ts` |
| Salted commitment leaf + public verify bundle (no salt / no PII on-chain or public) | `@xyndicate/receipts` | internal `commitmentLeaf` / `buildVerifyBundle` | Verify page (P7) | `packages/receipts/src/commitment.test.ts` |
| `AssayRegistry.sol` — onlySealer, idempotent `sealBatch`, zero personal data | `@xyndicate/contracts` | X Layer contract | on-chain seal | `packages/contracts/solidity/test/AssayRegistry.t.sol` |
| RegistryClient (viem) — `sealBatch` / `anchoredAt` + deploy script (testnet 1952 / mainnet 196) | `@xyndicate/contracts` | internal `RegistryClient` | anchor worker (P6) | `packages/contracts/src/client.test.ts` |

<!--
Row template:
| asy_ats_scan — parse-back + format-law + keyword coverage | @xyndicate/tribunal | POST /mcp asy_ats_scan | Studio → Report | packages/tribunal/src/atsScan.test.ts |
-->
