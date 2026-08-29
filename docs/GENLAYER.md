# GenLayer architecture

> **Status:** Studionet consensus checkpoint. `AssayAdjudicator` is implemented, GenVM-lint clean,
> and covered by 17 passing direct-mode tests plus 3 passing hosted-Studionet consensus tests.
> Assay has not deployed to Testnet Bradbury or changed the production Studio. The Bradbury
> deployer `0x8163f5e43c8d5f067d3ea23f5795ac8510a5b120` exists as an encrypted external keystore and is
> currently unfunded. The existing X Layer and OKX.AI/x402 systems remain live and unchanged.

Assay will use GenLayer for one narrowly defined decision that should not depend on Assay's server
alone:

> Given a bounded professional claim, an explicit Assay Standard criterion, and user-approved
> public evidence, does that evidence support the claim under the stated criterion?

The answer is a consensus adjudication, not a declaration of absolute truth, identity, employment,
or issuer authenticity.

## Trust stack

| Layer                         | Authoritative responsibility                                                                                          | What it does not claim                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| GenLayer                      | Consensus-critical semantic adjudication of approved public evidence against a stated criterion                       | Absolute truth, identity, employment, issuer verification, or dossier integrity |
| Assay claim gate and Tribunal | Deterministic evidence linkage, numeric-fact enforcement, format laws, parse-back, policy, and the published Standard | Independent validator consensus                                                 |
| X Layer                       | EIP-712 dossier provenance and salted commitment anchoring; OKX.AI/x402 settlement                                    | Semantic truth of career claims                                                 |
| Assay backend                 | Private ingestion, extraction, generation, rendering, storage, and application-level composition                      | A substitute for GenLayer consensus                                             |

The resulting product sequence is:

```text
EVIDENCE → BRIEF → FORGE → TRIBUNAL → CONSENSUS → SEAL → SHARE
                                      GenLayer     X Layer
```

GenLayer adjudication must finish before the final X Layer seal. The accepted GenLayer receipt can
then become part of the canonical dossier manifest, and X Layer can commit to that exact dossier
version without changing the meaning of `sealed`.

## AssayAdjudicator

The Intelligent Contract is `AssayAdjudicator`. Its state transition is meaningful:
after validators accept a decision, the contract stores the accepted adjudication for the bounded
claim key. Assay must never compute a verdict off-chain and ask GenLayer merely to store it.

### Bounded public input

The implemented write method accepts:

- a stable claim key of at most 96 restricted characters;
- sanitized claim text of at most 800 characters;
- one of four contract-owned criterion IDs;
- exactly the supported `AS-1.1.0` Standard version; and
- one to three unique, user-approved HTTPS URLs of at most 400 characters on the explicit public
  evidence host allowlist.

The input must not contain résumé or certificate binaries, email addresses, phone numbers, private
supervisor letters, unpublished employer material, unrestricted prompts, or private evidence.
Claim text itself can be identifying, so the consent screen must show the exact text and URLs that
will become public before the wallet signs.

### Structured result

The consensus-critical output is deliberately small:

```json
{
  "verdict": "SUPPORTED",
  "reasonCode": "EVIDENCE_SUPPORTS_CLAIM",
  "sourceCount": 2,
  "shortReason": "The public implementation and benchmark support the stated intervention and outcome."
}
```

Allowed verdicts are `SUPPORTED`, `PARTIAL`, `INSUFFICIENT`, and `CONTRADICTED`. Each maps
deterministically to a closed reason code. There is no 0–100 truth score. `shortReason` is bounded
to 240 characters of explanatory prose; it is not required to match word-for-word across
validators.

## Consensus design

All web and LLM operations occur inside a GenLayer non-deterministic block. The intended custom
`run_nondet_unsafe` pattern is:

1. The leader independently fetches the approved evidence from inside the Intelligent Contract.
2. The leader extracts bounded, decision-relevant content and asks an LLM for schema-constrained
   JSON under a contract-controlled prompt.
3. Each validator independently fetches and evaluates the same sources under the same criterion.
4. Validators compare substantive, stable decision fields—not raw page bytes or prose style.
5. Only an accepted result may update contract state. Disagreement or an undetermined transaction
   must not create a supported adjudication.

The validator requires exact agreement on `verdict`, its deterministically derived `reasonCode`,
`sourceCount`, and `unavailableCount`; bounded explanatory prose may differ. Direct tests prove
that shape-valid substantive disagreement is rejected while equivalent decisions with different
prose are accepted. Shape checks are necessary input/output validation, but shape-only validation
is prohibited because it does not verify the decision.

Web content is untrusted data. Contract-built prompts must explicitly state that instructions found
inside evidence cannot change the task. Inputs and outputs are allowlisted and length-bounded.
External failures must be classified separately from evidence-based negative verdicts: a network or
source failure cannot silently become `SUPPORTED`, `INSUFFICIENT`, or `CONTRADICTED` unless the
published criterion explicitly defines that behavior.

## Evidence and privacy policy

GenLayer v1 is opt-in and public-evidence-only.

- Eligibility requires an approved claim plus public or explicitly released HTTPS evidence.
- Assay shows the exact claim, criterion, Standard version, URLs, network, and contract before
  signature.
- Private documents and PII are excluded by default and are never inferred to be safe merely
  because a user uploaded them to Assay.
- Existing `Attested`, `Documented`, `Linked`, and `Sealed` tiers remain unchanged.
- `GenLayer Adjudicated` is a separate dimension carrying verdict, reason code, network, contract,
  transaction, status, source digest, and Standard version.
- A URL resolving is not adjudication; adjudication means validators agreed that the reviewed
  public evidence supports or does not support the claim under the stated criterion.

## Application composition

The first integration is application-level composition, not a bridge:

```text
GenLayer accepted/finalized transaction
        ↓
Assay reads and records the receipt and adjudication
        ↓
canonical dossier manifest includes the GenLayer reference
        ↓
existing X Layer seal commits to that manifest version
```

No cross-chain bridge is planned for v1. The existing `AssayRegistry.sol`, anchor worker,
`asy_verify`, service prices, PolicyGate, OKX facilitator integration, and marketplace records must
not be removed or semantically rewritten.

## Studio lifecycle

The existing insertion point is in `ReportStage`, after Tribunal reports and ATS parse-back and
before `SealMoment`. Browser writes must use the user's wallet through current `genlayer-js`; the
Assay backend must not impersonate a user transaction.

The UI must represent the real lifecycle rather than an instant success animation:

```text
eligible → review public input → connect wallet → switch to Testnet Bradbury
→ awaiting signature → submitted → proposing/committing/revealing
→ accepted → finalized
```

It must also preserve wallet refusal, wrong-network, canceled, failed, timeout, RPC-unavailable,
and `UNDETERMINED` states. Every accepted/finalized result exposes the network, contract address,
transaction hash, and explorer link. Refreshing a pending transaction must resume tracking rather
than submit a duplicate.

## Network and development progression

The target public network is **GenLayer Testnet Bradbury**, never “GenLayer mainnet.” The current
official progression is:

1. Localnet for controlled development and debugging.
2. Studionet for shared validation.
3. Testnet Bradbury for production-like tests with real AI/LLM workloads.

The three Studionet consensus scenarios ran green on 2026-08-29. Bradbury deployment remains gated
on sufficient test GEN and a final preflight; operator authorization has been granted. The
encrypted deployer is stored outside the repository, and neither its key nor password is logged or
committed.

## Implementation phases and likely files

The exact diff will be kept narrow, but implementation is expected to touch:

1. **Contract and tests — implemented; consensus-node scenarios passing**
   - `packages/genlayer/contracts/assay_adjudicator.py`
   - `packages/genlayer/tests/direct/*`
   - `packages/genlayer/tests/integration/*`
   - `packages/genlayer/deploy/deployScript.ts`
   - `packages/genlayer/gltest.config.yaml`, dependency/config files, and package documentation
   - root workspace scripts only where needed to include GenLayer lint/tests without disturbing npm
2. **Domain and persistence**
   - `packages/assay-core/src/schemas.ts` and focused canonical-manifest tests
   - MCP store/Studio state routes needed to persist receipt linkage and enforce seal ordering
3. **Browser integration**
   - `apps/web/lib/genlayer/*`
   - `apps/web/components/genlayer/*`
   - `apps/web/components/studio/ReportStage.tsx`
   - `apps/web/components/studio/SealMoment.tsx` only if it must enforce/display pre-seal consensus
   - focused component tests and Playwright lifecycle coverage
4. **Truthful product/docs surfaces after capability exists**
   - `FEATURES.md`, `SECURITY.md`, `README.md`, `CHANGELOG.md`
   - site constants, homepage/footer, Studio copy, architecture asset, and generated docs as required
5. **Deployment evidence after explicit approval**
   - `docs/GENLAYER-BRADBURY.md` with address, transaction, explorer, version, UTC time, exact command,
     and reproducible public fixtures

Unrelated X Layer, OKX.AI/x402, provider, renderer, Tribunal, or visual-system refactors are out of
scope.

## Test gates

Before deployment, the integration must have zero existing regressions plus:

- GenVM lint with zero errors;
- at least eight direct tests covering verdicts, bounds, malformed output, source failure, and
  validator disagreement;
- at least three integration scenarios against Studio/local consensus;
- proof that disagreement/undetermined execution cannot commit state;
- browser tests for the complete mocked lifecycle and every failure state;
- a separate, minimal real-network smoke only after deployment is authorized; and
- docs/manifest/security consistency, dead-link, and secret-scan gates.

The untouched baseline measured on 2026-08-29 is 374 Vitest + 57 Playwright + 4 Foundry = **435
passing tests**, with full workspace typecheck green. Prompt 1 adds 17 passing direct-mode tests
and a clean GenVM lint result. The three hosted-Studionet integration scenarios now pass, bringing
the measured total across all suites to **455**.

## Prompt 1 implementation checkpoint

Implemented files are confined to `packages/genlayer`, root workspace/CI wiring, the Network
Doctrine and synchronized documentation, plus a docs-only dependency security update required to
restore the repository's zero-advisory CI gate. `AssayRegistry.sol`, the anchor worker, OKX.AI/x402
gate, pricing, and production Studio behavior are untouched.

The direct suite covers all four verdicts, persistent reads, duplicate-key protection, partial
source availability, all-sources-unavailable failure, HTTPS/host/source-count/size bounds, unknown
criteria, wrong Standard version, malformed model output, validator disagreement, and equivalent
decisions with different prose. The GenLayer testing suite's direct mode exposes validator
acceptance separately from leader execution, so the disagreement test asserts validator rejection.
The three hosted-Studionet tests prove positive support, a negative unrelated-evidence verdict, and
accepted state read-back under real consensus; they do not artificially force public validators
into an `UNDETERMINED` result.

## Studionet consensus checkpoint

On 2026-08-29, the authorized hosted-Studionet run passed 3/3 scenarios in 80.84 seconds using one
shared temporary deployment. The first attempt deployed three temporary fixtures but submitted no
adjudications because the tests used an obsolete convenience-call API; the current
`genlayer-test` contract interface requires `.call()` and `.transact()`. The corrected tests use a
module-scoped deployment to avoid redeploying for every scenario.

The Bradbury preflight uses the current official profile:

- RPC host: `rpc-bradbury.genlayer.com` over HTTPS (JSON-RPC `POST`)
- chain ID: `4221`
- currency: test GEN
- explorer: `https://explorer-bradbury.genlayer.com/`
- deployer: `0x8163f5e43c8d5f067d3ea23f5795ac8510a5b120`
- balance at checkpoint: `0 GEN`

The locally installed CLI is npm `genlayer@0.39.2`, while the generated official CLI reference
still labels itself 0.39.1. Its `estimate-fees` command currently calls an SDK method absent from
the published `genlayer-js@1.1.8`, so live fee estimation fails before submission. Deployment must
therefore retain a conservative funding buffer and record the actual receipt cost afterward.

## Current-document compatibility notes

Reviewed 2026-08-29:

- The committed build guide says `Studionet → Localnet → Bradbury`; current official network docs
  recommend `Localnet → Studionet → TestnetBradbury`. This document follows the official order.
- The current Calling LLMs page includes examples that validate only JSON shape/range and says to
  prefer structural validity over exact equality. The current Equivalence Principle page explicitly
  says leader-output-only shape/enum/range validation is **not consensus**. Assay follows the
  stricter substantive independent-verification requirement.
- The official boilerplate at commit `e685f1f12c4c357787d48390692a654baf576f03` uses
  `strict_eq` around an LLM-produced football result. Current Equivalence Principle and Calling LLMs
  guidance say strict equality is unsuitable for non-deterministic LLM output unless the result is
  genuinely reproducible/canonicalized. Assay will copy the boilerplate's structure and test
  workflow, not that consensus shortcut.
- Current boilerplate dependencies are `genlayer-py` v0.18, `genlayer-test` v0.29,
  `genlayer-js` ^1.1.8, and `genvm-linter` from `main`. Versions and APIs must be rechecked when the
  contract phase starts rather than frozen from this design checkpoint.
- The current network page still says Bradbury configuration details “will be available when the
  network goes live” while also documenting the live `testnet-bradbury` CLI profile and faucet.
  Network names/endpoints must therefore come from the installed current CLI/network profile, not
  copied prose or hardcoded assumptions.

## Official sources

Accessed 2026-08-29:

- [When to Use GenLayer](https://docs.genlayer.com/developers/intelligent-contracts/when-to-use-genlayer)
- [The Equivalence Principle](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
- [Web Access](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access)
- [Calling LLMs](https://docs.genlayer.com/developers/intelligent-contracts/features/calling-llms)
- [Prompt & Data Techniques](https://docs.genlayer.com/developers/intelligent-contracts/crafting-prompts)
- [Prompt Injection](https://docs.genlayer.com/developers/intelligent-contracts/security-and-best-practices/prompt-injection)
- [Writing to Intelligent Contracts with GenLayerJS](https://docs.genlayer.com/developers/decentralized-applications/writing-data)
- [GenLayerJS transaction methods](https://docs.genlayer.com/api-references/genlayer-js/transactions)
- [Network configuration](https://docs.genlayer.com/developers/intelligent-contracts/deploying/network-configuration)
- [Official project boilerplate](https://github.com/genlayerlabs/genlayer-project-boilerplate/tree/e685f1f12c4c357787d48390692a654baf576f03)
