# GenLayer Testnet Bradbury deployment

> Status: `AssayAdjudicator` is deployed on Testnet Bradbury with two distinct persisted decisions:
> `SUPPORTED` and `INSUFFICIENT`. A third contradiction fixture finalized as a consensus `TIMEOUT`
> after three rounds and correctly committed no state. All statuses and state were re-read on
> 2026-08-30; no retry was sent during this audit.

## Deployment record

| Field                  | Value                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| Network                | GenLayer Testnet Bradbury                                            |
| Chain ID               | `4221`                                                               |
| Contract               | `0xa0A37DEf61d5C621FDeF43b604D8059779D1B96E`                         |
| Deployment transaction | `0x49547349ddc6ef6c49bd822b55f43d3da647915cefcc5e20f8ab7363382b85ba` |
| UTC accepted time      | `2026-08-29T23:06:02Z`                                               |
| Source commit          | `d9377523cf62d9658061837a8b25b733d26f73e7`                           |
| Contract SHA-256       | `3cbe85049363c90d21d28a139aa0fbbe933577c139f8635f40615e8c1efd11d9`   |
| CLI                    | npm `genlayer@0.39.2`                                                |
| Deployment result      | `ACCEPTED` · `AGREE` · `FINISHED_WITH_RETURN`                        |

- [Bradbury contract](https://explorer-bradbury.genlayer.com/address/0xa0A37DEf61d5C621FDeF43b604D8059779D1B96E)
- [Deployment transaction](https://explorer-bradbury.genlayer.com/tx/0x49547349ddc6ef6c49bd822b55f43d3da647915cefcc5e20f8ab7363382b85ba)

The executable deployment command was:

```bash
npx --yes genlayer@0.39.2 deploy --contract contracts/assay_adjudicator.py
```

The CLI used the named encrypted `assay-bradbury` keystore. Its decryption secret was supplied
through the masked prompt from outside the repository; it was not placed in source, committed
environment, or logs.

The deployed schema exposes one write method (`adjudicate`) and three view methods
(`get_adjudication`, `has_adjudication`, and `get_supported_criteria`). A post-deployment `code`
read returned the reviewed contract source.

## Accepted public-evidence smoke

The fixture contains no résumé, private document, contact data, or other PII.

| Field         | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Claim key     | `bradbury-smoke-aa49ac6`                                             |
| Claim         | `Assay exposes asy_verify as a free verification tool.`              |
| Criterion     | `COMPETENCY_DEMONSTRATION`                                           |
| Standard      | `AS-1.1.0`                                                           |
| Public source | Assay's public README                                                |
| Transaction   | `0xce27f6f78412c5cb4d4575760d2a92ad708d7d3bd8113dbd4fed5705f72f59b5` |
| Result        | `ACCEPTED` · `AGREE` · `FINISHED_WITH_RETURN`                        |
| Verdict       | `SUPPORTED`                                                          |
| Reason code   | `EVIDENCE_SUPPORTS_CLAIM`                                            |

[Accepted smoke transaction](https://explorer-bradbury.genlayer.com/tx/0xce27f6f78412c5cb4d4575760d2a92ad708d7d3bd8113dbd4fed5705f72f59b5)

Five validators participated: three agreed and two timed out. Reading the contract afterward
returned the persisted structured adjudication with one available source and zero unavailable
sources.

## Accepted insufficient-evidence adjudication

| Field         | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Claim key     | `bradbury-insufficient-aa49ac6`                                      |
| Claim         | `The Assay repository documents a crewed mission to Mars.`           |
| Criterion     | `ACTION_AND_OUTCOME`                                                 |
| Standard      | `AS-1.1.0`                                                           |
| Public source | `AssayRegistry.sol` in the public Assay repository                   |
| Transaction   | `0x7456fff2aae9f82814066bcfc30f3326ef8a81180aa93d112837a88f1cdcc6be` |
| Result        | `FINALIZED` · `AGREE` · `FINISHED_WITH_RETURN`                       |
| Verdict       | `INSUFFICIENT`                                                       |
| Reason code   | `EVIDENCE_INSUFFICIENT`                                              |

[Insufficient-evidence transaction](https://explorer-bradbury.genlayer.com/tx/0x7456fff2aae9f82814066bcfc30f3326ef8a81180aa93d112837a88f1cdcc6be)

The stored reason states that the contract source describes commitment anchoring and contains no
support for a crewed Mars mission. This is a real consensus-critical negative decision, not a
verdict computed by Assay and written as data.

## Failed-closed liveness evidence

Failures are not verdicts and are not counted as completed adjudications.

1. The first supported smoke attempt
   (`0xe12c2b2cc44ecd017ffd6d46166fb1c4c6d3a94e7bc807083c3748ee2a3f89af`)
   reached `LEADER_TIMEOUT` with no votes. `has_adjudication` remained `false` and
   `get_adjudication` returned `{}` before the controlled retry.
2. The first unrelated Mars transaction
   (`0x523cdd35b53851bb4e992f72cf413144f3a1f3e513ad1e18be7dde57a304c964`)
   initially timed out. It later finalized `AGREE`, as did the one controlled smaller-source retry
   above. Both use the same immutable claim key, so the contract exposes one record, whose reason
   specifically describes the smaller `AssayRegistry.sol` source. Assay counts that shared state
   transition once and cites the transaction whose evidence matches the stored reason; it does not
   inflate the result into two adjudications.
3. The false-price contradiction fixture
   (`0xe989b5eadc20538c69ae69b6877b25e812997dd131937b468402173959de5588`)
   finalized after three rounds with transaction status `FINALIZED` but consensus result `TIMEOUT`.
   Its last round contained only `TIMEOUT` and `DETERMINISTIC_VIOLATION` votes. Direct state reads
   returned `has_adjudication = false` and `{}`. A finalized transaction status alone is therefore
   not an accepted adjudication; clients must also check the consensus result and persisted state.

This behavior is material product evidence: Assay must surface timeout/undetermined states and may
never translate them into `SUPPORTED` or seal them as an accepted consensus receipt.

## Cost and balance

The deployer was funded with 11 test GEN. Measured balance deltas were:

- deployment: `0.00102437539031955 GEN`;
- first failed-closed smoke: `0.0001262654741205 GEN`;
- accepted supported smoke: `0.0001280259822993 GEN`.

The balance re-read on 2026-08-30 is `10.99833390073344545 GEN`; total testnet spend since funding
is `0.00166609926655455 GEN`. Testnet GEN is not revenue.

## Remaining Prompt 2 gate

Prompt 2 asks for three accepted Bradbury adjudications showing different decisions. Two distinct
records are persisted. The contradiction fixture is valuable failed-closed evidence but does not
satisfy the third accepted-decision requirement. Do not count it or send an automatic retry.
