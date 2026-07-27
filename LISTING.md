# Assay — OKX.AI marketplace listing (use verbatim)

**Name:** Assay
**Category (primary):** LIFESTYLE
**One-liner:** Proof before polish — evidence-backed career dossiers, graded and sealed.
**Endpoint:** `https://api.assayed.xyz/mcp` (transport: streamable-HTTP)
**Payment:** x402 on X Layer (`eip155:196`), USDT
**Standard:** AS-1.1.0 · **Registry:** `0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4` (X Layer mainnet)

## Current review state — 2026-07-27 (rejection answered)

OKX rejected the #8599 listing: _"the results returned by your service in actual calls don't match
the capabilities stated in your service description."_ The cause was reproduced against the live
server and fixed in the service, not in the copy — the descriptions below stand as written.

**What a platform tester hit.** A paid call carrying an under-specified payload settled and then
returned a refusal instead of the advertised capability:

| Call                                                   | Before                                                 | Now                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| ATS Resume Scan, empty or chat-style payload           | paid 0.05 → "Could not read that résumé"               | `400 invalid_request` naming `resumeText`/`resumeB64`, **not charged** |
| Career Dossier, no résumé                              | paid 2.00 → job queued → `ingest failed: INGEST_EMPTY` | `400` before settlement, with a runnable example                       |
| Cover Letter / Story Bank / Tailor Resume, no evidence | paid → "I won't write from thin air"                   | `400 EVIDENCE_REQUIRED`, **not charged**                               |
| Payload using `resume` / `jobDescription`              | refused as unreadable                                  | mapped onto `resumeText` / `jd` — the service runs                     |
| Claim Audit with `claims` as a string                  | raw provider error                                     | coerced to the declared array; verdicts + repair brief delivered       |
| `tools/call { name: "ATS Resume Scan" }`               | `Tool not found`                                       | resolves to `asy_ats_scan`                                             |

**What is unchanged and must stay so:** an _unpaid_ probe of a paid resource still returns the
standard x402 v2 402 first (`eip155:196`, USD₮0, configured treasury) — validators check for it, so
preflight only pre-empts a caller that is presenting payment. All 13 service records, prices, and
endpoints are untouched; no identity or avatar mutation was made.

**Second review message — "did not deliver within the 30-minute test window" (2026-07-27).** The
production order table identifies the tester's wallet (`0xbc59eb75…`) and both runs:

- **2026-07-26 19:02–19:03 UTC** — 60 paid calls: 16 returned refusals, and all 6 paid Career
  Dossier calls queued background jobs that then failed on an empty ingest. Nothing was ever
  delivered for those six; a 30-minute wait would indeed have expired.
- **2026-07-27 08:45–08:46 UTC**, nine minutes after the intake fix deployed — the same wallet's
  next run **delivered 4 of 4** (three ATS scans and a fit brief, real results, `success:true`).

The remaining delivery gap is now closed too: a paid Career Dossier used to hand back only a
`jobId`, which reads as a non-delivery to any caller that treats the HTTP response as the
deliverable. The paid call now waits up to 240 seconds — inside the 300s window every payment challenge
advertises — and returns the finished dossier — artifacts, tribunal grades, seal, portfolio — in the response itself,
falling back to the documented `jobId` contract only when a run genuinely outlasts the budget.

Note on the flow: for x402/A2MCP the ASP has **no on-chain action** — `next-action` returns "no
ASP-side action" and the endpoint response _is_ the delivery. Agent #8599 is online, and every call
is now recorded (`capability_call`: surface, tool, status, duration — no personal data), so a future
test can be diagnosed in minutes rather than reconstructed.

**New, free, no payment:** `GET /x402/:service/schema` and `GET /x402` publish each service's
arguments, price, defaults, and a working example, so a buyer can learn the exact payload before
spending anything.

**Resubmission note to OKX (paste with the resubmission):**

> The service now rejects an under-specified request with HTTP 400 before any payment is taken, and
> accepts the common argument spellings (`resume`/`jobDescription` as well as `resumeText`/`jd`).
> A test call that previously paid and received a refusal now either receives the described result
> or a free, itemised 400 explaining exactly what to send. `GET /x402/:service/schema` publishes the
> input contract for every service, and unpaid probes still return the standard x402 402 challenge.

## Description

**Assay turns scattered work history into a Career Dossier where every claim traces to proof.** It is a career studio for job seekers — and for other agents, over A2MCP — built on one non-negotiable promise: _Assay will not write a sentence it cannot trace._

The loop: **Evidence → Brief → Forge → Tribunal → Seal → Share.** You bring a résumé and a target role; Assay extracts grounded claims, maps them against the job, writes only what the evidence supports, grades every document against a published Standard, and seals the result on-chain.

**Four moats:**

1. **The claim gate.** No sentence renders without evidence behind it. Unsupported statements become questions, never prose — so nothing Assay produces can be caught out in an interview.
2. **A published Standard (AS-1.1.0).** Every document is graded against a rubric that is generated from the same code that grades — published equals shipped. Per-artifact deterministic profiles + a craft critic.
3. **ATS parse-back.** The ATS résumé is machine-verified by actually re-parsing the rendered PDF and diffing it field-by-field against the source — not a simulation of any specific vendor.
4. **On-chain provenance.** The finished dossier is sealed with EIP-712 and a salted commitment on X Layer. Anyone can verify a seal for free, forever. **No personal data ever touches the chain.**

## Tools & prices (USDT, x402 on eip155:196)

| Tool                     |            Price | What you get                                                                                |
| ------------------------ | ---------------: | ------------------------------------------------------------------------------------------- |
| `asy_ats_scan`           |             0.05 | Re-parse your résumé like an ATS: format-law findings + (with a JD) honest keyword coverage |
| `asy_claim_audit`        |             0.05 | Every bullet graded SUPPORTED / UNSUPPORTED_NUMBER / VAGUE + a repair brief                 |
| `asy_fit_brief`          |             0.10 | A job description mapped to your evidence: strong / partial / confirm / missing             |
| `asy_cover_letter`       |             0.15 | A cover letter where every sentence cites a confirmed claim                                 |
| `asy_story_bank`         |             0.20 | 2–4 STAR interview stories, each grounded in evidence                                       |
| `asy_interview_prep`     |             0.20 | Evidence-grounded questions + typed-answer STAR and ledger-contradiction checks             |
| `asy_tailor_resume`      |             0.30 | Résumé bullets tailored to a JD, evidence-constrained and format-clean                      |
| `asy_create_dossier_job` |             2.00 | Job, promotion, or freelance dossier → variant-specific artifacts, all graded and sealed    |
| `asy_job_status`         |             free | Poll a dossier job                                                                          |
| `asy_job_result`         |             free | Fetch a finished dossier (signed links + tribunal summary + seal)                           |
| `asy_verify`             | **free forever** | Verify any dossier's on-chain seal                                                          |

The Standard: https://assayed.xyz/standard · Repo: https://github.com/Franlinozz/ASSAY

## Phase 14 listing delta for #8599

Keep the existing identity, avatar, endpoint, and prices. The intended refresh gave the three
existing services stronger three-part copy and surfaced the remaining ten API capabilities as
separate services. The platform preserves in-use records, so the original three ultimately stayed
unchanged while all ten additions landed:

### ATS Resume Scan — 0.05 USDT

1. Re-parses an existing résumé, flags ATS format-law failures, and reports honest job-description coverage for job seekers.
2. Provide résumé text or a PDF and, optionally, the target job description.
3. Delivers structured parser findings and coverage gaps; no copy-trading.

### Job Fit Brief — 0.10 USDT

1. Maps a job description requirement-by-requirement to confirmed evidence as strong, partial, confirm, or missing.
2. Provide the job description plus profile details or evidence claims.
3. Delivers a structured coverage map that keeps missing requirements visible; no copy-trading.

### Career Dossier — 2.00 USDT

1. Builds a graded and sealed job, promotion, or freelance dossier using only evidence-backed claims.
2. Provide résumé text or PDF, the desired variant, and the relevant job, review, or client brief.
3. Delivers a background job with signed artifacts, Tribunal reports, an agent manifest, and an X Layer seal; no copy-trading.

### Interview Prep — 0.20 USDT

1. Generates behavioral and gap-probing questions, then evaluates typed answers for STAR structure and ledger contradictions.
2. Provide a dossier ID or confirmed claims and evidence, with an optional job description and typed answer.
3. Delivers structured questions and a graded answer report; it evaluates and never impersonates an interviewer.

### Claim Audit — 0.05 USDT

1. Audits résumé bullets and career claims for unsupported figures, vagueness, and contradictions before an application or interview.
2. Provide résumé text or a document, or submit a list of claims to examine against the supplied source material.
3. Delivers supported, vague, and unsupported-number verdicts with a concrete repair brief; no copy-trading.

### Cover Letter — 0.15 USDT

1. Creates a role-specific cover letter for job seekers where every sentence traces to a confirmed career claim instead of invented experience.
2. Provide confirmed claims and supporting evidence or an existing dossier ID, plus the target job description when available.
3. Delivers an evidence-cited cover letter, open clarification questions, and a Tribunal evaluation; no copy-trading.

### Story Bank — 0.20 USDT

1. Builds evidence-grounded STAR interview stories for job seekers who need clear, credible examples of their experience and impact.
2. Provide confirmed career claims and supporting evidence or an existing dossier ID, with an optional target job description.
3. Delivers two to four cited STAR stories with a Tribunal grade and visible evidence links; no copy-trading.

### Tailor Resume — 0.30 USDT

1. Tailors résumé achievement bullets to a target role while keeping every statement within the limits of the candidate’s confirmed evidence.
2. Provide confirmed claims and supporting evidence or an existing dossier ID, plus the target job description.
3. Delivers evidence-cited, ATS-format-clean résumé content with a Tribunal evaluation and unresolved questions; no copy-trading.

### Verify Seal — 0 USDT

1. Verifies Assay dossier seals and version lineage against the live X Layer registry for candidates, recruiters, and other agents.
2. Provide a dossier ID, version reference, or raw commitment leaf.
3. Delivers seal status, commitment leaf, anchor time, explorer link, and available version lineage; no copy-trading.

### Job Status — 0 USDT

1. Checks the progress of an Assay background dossier job for agents and users waiting on longer-running career artifacts.
2. Provide the job ID returned when the dossier was created.
3. Delivers the current queued, running, completed, or failed status without another charge; no copy-trading.

### Job Result — 0 USDT

1. Retrieves a completed Assay dossier package for agents and users after the paid background job finishes.
2. Provide the completed job ID returned when the dossier was created.
3. Delivers signed artifact links, portfolio URL, Tribunal summary, open questions, and seal details without another charge; no copy-trading.

### Refresh result

- Quality validation: passed with zero findings across all proposed changes.
- Existing services `#36629` / `#36630` / `#36631` are already in use. The platform rejected a
  combined full-record modification (`81001`), so they remain unchanged rather than risking their
  service history.
- Ten additions were written successfully in tx
  `0xcf0a3f61e15e142d63e9931be3e27c8a48f32bf1e95af93588ee8f3c66e9e423`.
- **Public listing was live before the later avatar update.** Agent #8599 was eligible for task
  recommendations, showed the registered endpoint, and reported 13 service offers across two
  paginated screens. The current re-review state is recorded above.
- The 13 offers are a marketplace projection of **11 canonical MCP tools**, not 13 API methods:
  `asy_create_dossier_job` is deliberately presented as Career Dossier, Promotion Dossier, and
  Freelancer Proof Pack so each repeat-use case is discoverable while retaining one schema and one
  fixed 2.00 USDT price.

## A2A decision — skip for Phase 14

The current A2A guide positions agent-to-agent listings as custom, multi-round negotiated delivery
and recommends 10–20 scenario simulations, negotiation practice, delivery review, and boundary
testing before registration. Assay has a proven API/job pipeline, but it does not yet ship a
trained negotiation-and-revision agent or that simulation record. Adding “Complete Career Dossier,
negotiated” now would be less provable than the live A2MCP service and could put the refreshed
listing at risk. Keep A2MCP as the only marketplace claim; revisit A2A after the negotiation agent
and delivery acceptance suite exist.

## Screenshot proof

Run:

```bash
node scripts/capture-marketplace.mjs
```

The script traverses both public service pages and refuses to create proof unless all 13 service
names and current prices are present. The verified captures are committed at
`assets/marketplace/assay-8599-prices-page-1.png` and
`assets/marketplace/assay-8599-prices-page-2.png`.
