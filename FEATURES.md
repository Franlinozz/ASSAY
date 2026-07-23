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

<!--
Row template:
| asy_ats_scan — parse-back + format-law + keyword coverage | @xyndicate/tribunal | POST /mcp asy_ats_scan | Studio → Report | packages/tribunal/src/atsScan.test.ts |
-->
