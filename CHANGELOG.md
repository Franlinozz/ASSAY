# Changelog

All notable changes to Assay are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added the GenLayer Network Doctrine and `docs/GENLAYER.md`, defining GenLayer as Assay's
  consensus-critical public-evidence adjudication layer while preserving the existing Assay
  claim gate/Tribunal, X Layer integrity seal, and OKX.AI/x402 settlement flows.
- Added a context-continuity protocol requiring constitution/doc re-reads at phase boundaries,
  source-dated SDK assumptions, diff/doc reconciliation, and measured checkpoint hand-offs.
- Added the development-only `AssayAdjudicator` Intelligent Contract. It fetches one to three
  allowlisted public HTTPS evidence sources inside GenLayer, applies a closed AS-1.1.0 criterion
  through contract-controlled LLM prompts, requires validators to independently re-fetch and
  reproduce the substantive decision, and persists only the consensus-accepted adjudication.
- Added 17 GenLayer direct-mode tests, three Studio/localnet integration scenarios, GenVM lint,
  deployment scaffolding, workspace scripts, and a dedicated CI job. No GenLayer wallet, external
  transaction, network deployment, frontend integration, or production claim is included yet.

### Changed

- Reconciled the README with the measured pre-GenLayer baseline: 374 Vitest + 57 Playwright + 4
  Foundry = 435 passing tests; full workspace typecheck is green.
- Ran the three authorized consensus scenarios against hosted GenLayer Studionet: positive public
  evidence, unrelated evidence, and persistent read-back all passed. Updated the integration tests
  to the current `genlayer-test` `.call()` / `.transact()` API and a shared module deployment after
  the first run exposed the obsolete convenience-call shape before any adjudication was submitted.
- Created the encrypted `assay-bradbury` deployer outside the repository and selected the official
  Testnet Bradbury profile. Its public address is documented in `docs/GENLAYER.md`; the wallet
  remains unfunded and no Bradbury transaction has been submitted.
- Updated only the docs workspace to Fumadocs 16.15.4, Fumadocs MDX 15.4.0, and Next 16.3.3 to
  remove newly disclosed transitive advisories while keeping the production web app on Next 15.
  Patched transitive overrides keep the current lockfile at zero known npm advisories. The docs
  generator now binds MCP schema introspection to the shipped Zod 3 instance so generated argument
  descriptions and types cannot be erased by Fumadocs' Zod 4 dependency.

### Fixed

- **A bare profile link no longer fails an entire dossier.** `CONTACT_VALIDITY` required a URL
  scheme, so `linkedin.com/in/jane` — the way people actually write a profile link on a résumé —
  was a `BAD_LINK` finding. Contact links are checked for every artifact, so that single finding
  failed **all nine** artifacts of an otherwise excellent dossier whose craft scores averaged
  86–91. A link is now accepted if it parses as-is or once a scheme is assumed; genuine junk
  (`not a link`, `javascript:` URLs, host-less text) is still a finding.
- **Labelled STAR stories are no longer reported as missing their action.** The detector required a
  first-person pronoun (`I built …`), so every story written in `Action: built …` form failed
  `STAR_COMPLETENESS`. Both formats are now recognised; a story with no action at all still fails.
- **Interview contradictions are matched by unit, not by position.** Any figure absent from the
  ledger was reported as a contradiction and paired with the claim's _first_ numeric fact — so an
  answer of "20 people" came back as _"your confirmed ledger says 840"_, matching a latency figure.
  Numbers are now compared only within the same unit, the contradiction names the fact that
  actually disagrees, and a figure the claim does not measure is left alone rather than
  misreported.
- **STAR completeness recognises a story in any voice.** The check demanded the literal words
  "situation"/"task" plus a first-person pronoun, so the third-person narrative the Forge actually
  writes — _"Facing slow provisioning across 13 teams, Marisol designed and shipped …"_ — was
  reported as missing its situation, task **and** action. Detection is now structural (a scene, an
  intent, a past-tense achievement verb with any subject, an outcome) and covers first-person,
  third-person and labelled forms. A bald claim with no story in it still fails.
- **A failing grade always states why.** The critic can score an artifact under the bar without
  emitting a per-axis finding, which produced reports that failed with an empty findings list —
  unactionable for a human and indistinguishable from a broken grader for an agent. A craft failure
  now names the axes below the floor, or the weighted mean against the pass mark.
- **Requirement coverage reads the evidence behind a claim.** Scoring used only the claim sentence
  and its tags, so a requirement naming a toolchain was reported `missing` even when the cited
  evidence listed that exact stack. The claim remains the unit of coverage — status still depends on
  a confirmed claim — but its cited evidence is now part of its vocabulary. `computeCoverage` takes
  evidence as an optional third argument, so callers that pass none behave exactly as before.

- **An empty document can no longer pass the Tribunal — the worst bug this project has shipped.** A
  paid Career Dossier delivered nine blank artifacts (0 claims, 0 sentences) and graded them
  **9/9 PASS**. Cause: `proseBearing` was derived from `sentences.length > 0`, so a prose artifact
  that rendered _empty_ was misclassified as a structured artifact (docx/json/table), which is
  decided by hard checks alone and passed vacuously. Any prose-kind artifact rendering with zero
  sentences is now graded `not_delivered` — excluded from the pass rate, never counted as a pass —
  with the reason stated plainly. `PROSE_ARTIFACT_KINDS` lives in `standard.ts` beside the rest of
  the published Standard, so every consumer of the grader sees the same verdict.
- **The dossier job no longer forges from nothing.** If extraction confirms zero claims, the job
  fails with an actionable reason ("supply a résumé with concrete, dated achievements, or build the
  ledger in the Studio") instead of producing empty documents and reporting "ready — 9 artifacts".
  A dossier of blank files announced as ready is exactly the unearned confidence Assay exists to
  refuse.
- The dead-link sweep recognises the concrete `/x402/:service[/schema]` resources and signed
  `/f/:id` · `/p/:slug` URLs, so documenting real endpoints no longer fails the gate.

- **Marketplace intake (OKX.AI listing review).** A paid call could previously settle and then
  return a refusal — an ATS scan with no résumé, a cover letter with no evidence, a 2.00 USDT
  dossier job whose background run then failed on an empty ingest — and a payload that named a key
  `resume` instead of `resumeText` was refused outright. Both read, correctly, as a service whose
  results do not match its description. Two defences now stand in front of every capability:
  - **Preflight before settlement.** A deterministic, model-free check runs ahead of the x402 gate.
    A request that cannot produce the advertised capability gets `400 invalid_request` naming what
    is missing, which keys satisfy it, and a runnable example — and is never charged (`charged:
false`). An _unpaid_ probe of a paid resource still receives the standard 402 first, so
    marketplace validators see the challenge they expect.
  - **Tolerant intake.** Obvious synonyms map onto the published schema before anything else reads
    the request (`resume`/`cv`/`documentText` → `resumeText`, `jobDescription`/`role` → `jd`, a
    single claims string → the declared array, a `data:` URI → raw base64, `type: "promotion
review"` → `variant: "promotion"`). A canonical key always beats a synonym, and a chat-style
    message is never mistaken for a résumé. Marketplace service names resolve wherever a tool name
    or route slug is expected (`/x402/ats-resume-scan`, `tools/call { name: "ATS Resume Scan" }`).
- `asy_claim_audit` no longer returns an empty audit when a caller supplies short claim strings the
  extractor cannot segment: the supplied statements are audited directly, and with no source
  document behind a bare claim a figure in it is reported `UNSUPPORTED_NUMBER` rather than waved
  through.
- A paid run that throws after settlement now returns a sanitized `502` telling the buyer to retry
  with the same payment proof (the result is deliberately not cached, so the retry re-runs free)
  instead of an opaque provider error.
- The dead-link sweep resolves static assets under `apps/web/public`, so the editorial imagery no
  longer fails the gate as unknown site routes.

- **Delivery within the test window (OKX automated re-test).** The platform's tester treats the HTTP
  response as the deliverable, but `asy_create_dossier_job` returned only a `jobId` — so a paid
  Career Dossier looked like a non-delivery to any caller that does not poll, and the six test
  dossiers commissioned on 2026-07-26 then failed in the background on an empty ingest. The paid
  dossier call now waits a bounded moment (`ASY_INLINE_JOB_WAIT_MS`, default 240s, inside the 300s
  `maxTimeout` every challenge advertises; a measured live-provider dossier takes ~112–117s) and returns the
  finished dossier — artifacts, tribunal, seal, portfolio — in the response, flagged
  `deliveredInline`. A run that outlasts the budget falls back to the documented `jobId` contract
  unchanged, and a run that fails inside the budget reports the failure instead of handing back a
  job id that will never produce anything.

- **`GET /mcp` now answers with the standard x402 challenge instead of a 200 document.** A
  marketplace buyer's client validates a service endpoint by probing it, and a 200 reads as "not an
  x402 service" — the purchase is refused before any payment. `/mcp` is the registered endpoint of
  the 0.05 USDT ATS scan, and the challenge is priced at exactly that service. **MCP negotiation is
  unaffected**: `initialize`, `tools/list` and notifications are POSTs and remain free, verified
  with a real MCP SDK client that connects and lists every tool against this build. Free
  machine-readable discovery remains at `/.well-known/assay.json`. A GET still never settles a
  payment and never runs a capability — both pinned by tests and by the route sweep.

### Added

- **Capability access log.** Every `/mcp` and `/x402` request records surface, tool, method, status,
  paid-or-not, and duration as a `capability_call` event — no bodies, no résumé text, no headers, no
  payment proofs, no IPs. The review could not be diagnosed from this box because nothing recorded a
  request; now it can be, without holding any personal data.
- `GET /x402/:service/schema` and `GET /x402` — the free, unauthenticated input contract for every
  marketplace service: tool, price, arguments generated from the shipped zod schemas, server-bound
  defaults, and a working example. A buyer can learn exactly what to send before spending anything.
- The x402 payment challenge now describes the specific capability being sold rather than a generic
  house line, so a service card and its 402 agree.

- Added a coherent eight-image editorial photography system across the Claim Gate, recruiter
  portal, closing CTA, Standard, Studio onboarding, Tribunal, Verify, and Gallery surfaces. Each
  placement has its own theme-aware mask, crop, and mobile composition, with meaningful alt text
  and reduced-motion-safe loading.
- Added browser regression coverage proving every editorial image loads in both themes and all
  affected routes remain free of horizontal overflow at 390px and 430px.
- Added the operator-supplied horizontal Assay mark and custom wordmark as transparent,
  theme-aware lockups in the web and docs chrome, plus a matching browser/app icon and the
  evidence-flow brand banner in the GitHub exhibit. The high-resolution originals remain
  untouched.
- Added four current product captures to the README: the interactive proof hero, fictional sealed
  gallery, honest Tribunal repair loop, and live X Layer verification.
- Added paste-ready, judge-optimized OKX.AI Genesis submission answers with a shorter fallback,
  field-by-field operator placeholders, and explicit alignment to the published judging criteria.

### Changed

- Made the site header substantially more transparent with stronger glass blur, replaced the
  conventional sun/moon toggle with a quieter dawn/orbit control, and made desktop Studio a
  viewport workspace with independently scrolling dossier-flow, stage, and run-monitor panes.
- README capture automation now renders the Tribunal and Gallery exhibits in dark mode while
  retaining the landing and verification exhibits in light mode.
- Rebuilt the Studio around a three-column working desk: persistent vertical dossier flow,
  focused stage workspace, and a sticky run monitor with artifact progress, current role/action,
  elapsed time, retained event history, and safe-return guidance.
- Gave the designed résumé a more distinctive Assay Office editorial system—registration masthead,
  numbered sections, role/date hierarchy, evidence-tier chips, skill pills, credential blocks, and
  a proof footer—without changing the ATS-safe résumé.
- Strengthened visible motion on the landing proof graph and active Forge/Tribunal states while
  preserving the existing reduced-motion fallback and server-rendered landing budget.
- Reordered primary navigation to lead with Gallery and end with Verify then Docs.
- Removed the vertical green scan overlay from the landing proof card; its evidence interaction
  now carries the motion without an ornamental glow sweep.

### Fixed

- Fixed `asy_interview_prep` for direct agent-supplied claims: literal numbers now become ledger
  numeric facts before evaluation, so a typed “team of 12” answer against a confirmed “team of 8”
  claim populates the structured `contradictions[]` verdict as well as the human feedback.
- Stopped the web app from prefetching the separately deployed Docs Next.js application as if it
  were a web-app route. Docs links now perform a clean document navigation, eliminating background
  wrong-build chunk requests and their strict-MIME console errors.
- Added 13 concrete OKX.AI service resources under `/x402/<service>`. Paid offer probes now receive
  their service-specific 402 immediately without breaking free `/mcp` negotiation; promotion and
  freelancer routes server-bind the correct dossier variant, and the three free follow-up tools
  return results without payment.
- Fixed paid-response recovery: the server now checks a completed, body-bound
  `Idempotency-Key` before asking for another credential. An identical retry without its payment
  header returns the cached result; reuse with different arguments returns
  `409 idempotency_conflict`.
- Renamed ATS “JD coverage” to **JD keyword presence** and labels it as distinct from the Fit
  Brief’s stricter evidence-backed requirement coverage, removing the misleading appearance that
  keywords alone prove candidate fit.
- Corrected the MCP x402 boundary after OKX review: `GET /mcp`, `initialize`, `tools/list`,
  notifications, and invalid transport requests no longer initiate payment. A 402 challenge is now
  possible only at JSON-RPC `tools/call` for a paid Assay service; free tools remain free.
- Fixed a real long-run reconciliation bug: the browser stopped polling after four minutes, so a
  completed Forge could remain visually stuck until reload. Studio now follows the canonical
  server stage for up to 30 minutes, refreshes on completion events, and advances to Report.
- Quarantined placeholder, invalid, and dead profile links before they can enter Forge. This
  prevents one bad contact URL from failing every otherwise-valid artifact.
- Repair loops now stop before spending writer/critic calls on deterministic source blockers that
  prose rewriting cannot fix. Report separates those blockers from genuine claim/craft findings,
  presents the final verdict first, and keeps earlier drafts collapsed but auditable.
- Rechecked Agent #8599 without another mutation: all 13 service records remain intact and the
  x402 validator reports `valid:true`; the public identity currently reads “not listed · Listing
  under review” with “AI quality review suggested pass” after the avatar-triggered re-review.
- Migrated the ten mutable Agent #8599 service records from the generic MCP URL to their concrete
  `/x402/<service>` resources in identity transaction `0x037d27b6…e6df17`. OKX rejected endpoint
  edits for the three original, already-used records (ATS Resume Scan, Job Fit Brief, Career
  Dossier) with `service in use, only name/description can be modified`; those require an
  OKX-support migration rather than duplicate replacement services.
- Fixed mobile chrome alignment so the theme and menu controls stay anchored to the right of the
  supplied Assay lockup, and clipped Studio-only horizontal paint overflow so sticky navigation
  cannot drift sideways while scrolling.

## [1.1.0] — 2026-07-25

### Added — Submission lockdown (Phase 17)

- Added an exact 90-second operator storyboard covering the real sealed Adaeze run from messy
  evidence through ledger, honest gap, blocked claim, first-draft failure, repair, parse-back,
  recruiter proof portal, X Layer verification, and the proven x402 settlement.
- Added an honest six-post launch thread, pinned submission fields and deadline, twelve-item
  verify-day runbook, and a fixes-only post-release freeze.
- Added a thumbnail-safe 768×768 OKX marketplace avatar derived from the operator’s committed
  Assay mark; the original high-resolution artwork remains intact. The derivative was uploaded
  through OKX and applied to Agent #8599 in identity tx `0x46b94488…b4b8`.
- Captured the now-public Agent #8599 listing across both service pages and fail-closed verified all
  13 buyer-facing service names and prices.

### Changed

- Added restrained Assay Office motion across the landing page, gallery, and Studio: entrance and
  flow cues, state transitions, progress feedback, and tactile card interactions. Reduced-motion
  users receive effectively static transitions, and the landing route gains no animation bundle.
- Reframed Studio as the actual five-stage process—Ledger, Brief, Interview, Forge, Report &
  Seal—with corrected stage numbering, an animated progress rail, and clearer busy state.
- Added Docs to primary and mobile navigation and made the private-by-default gallery boundary
  explicit: Studio dossiers do not silently publish to the curated fictional demonstration gallery.
- Replaced the generic half-disc theme control with an Assay Office moon/sun pair: viridian
  night-switching in light mode, brass daylight-switching in dark mode, with clear labels, focus
  treatment, restrained state animation, and mobile parity.
- Explained the marketplace projection on the site and README: Assay has 11 canonical MCP tools
  and 13 buyer-facing offers because the one dossier-job tool has job, promotion, and freelancer
  entry points.
- Moved the README architecture below the product, proofs, quickstart, and repository guide so a
  cold reader reaches the problem and runnable path first.
- Promoted all workspace versions and production defaults to v1.1.0 while preserving AS-1.1.0 as
  the published grading standard.

### Fixed

- Corrected stale Studio labels that still called Forge “Stage 3” and Report “Stage 4” after
  Interview Room became a first-class stage.
- Corrected the Studio seal moment’s stale AS-1.0.0 label.
- Fixed marketplace screenshot validation to traverse both OKX service pages instead of assuming
  all 13 offers render on the first page.

### Added — Hardening drills (Phase 16)

- Added an executed failure-drill suite covering writer/critic loss, deleted artifacts, a two-hour
  anchor outage and recovery, hostile uploads, a 120-request burst, restart recovery, SQLite lock
  contention, disk exhaustion, five payment replays, and share-expiry boundary skew.
- Writer outages now complete with sanitized coverage notes and explicit not-delivered artifacts.
  Critic outages ship `UNGRADED`; no provider-loss path can manufacture PASS.
- Artifact availability is reconciled against disk on every owner-state read. Missing files lose
  their download and are excluded from pass-rate math with a visible not-delivered reason.
- Added restart recovery for interrupted jobs, a 2 s SQLite busy timeout, a 256 MB default disk
  reserve, 507 pre-payment upload refusal, and detailed storage/seal state in `/health`.
- Added PDF/DOCX expansion and macro guards, parse/extracted-text bounds, a Git-history secret
  scanner, HMAC/ID entropy regressions, and Caddy CSP/HSTS/anti-framing headers.
- Patched the dependency graph to **0 npm advisories** and recorded every drill plus honest limits
  in `docs/HARDENING-DRILLS.md`.
- Performance budgets passed again after the interaction pass: `/health` 6 ms p95, fake-provider
  `asy_ats_scan` 74 ms p95, and mobile Fast-3G LCP 932 ms.

## [1.0.0] — 2026-07-25

### Added — Judged-artifact repository (Phase 15)

- Replaced the scaffold README with the definitive cold-reader exhibit: product thesis, five-band
  architecture, six-step loop, four defensibility moats, all 11 tool prices, executable fake-mode
  quickstart, real mainnet verification evidence, test provenance, and explicit proof limitations.
- Added the hand-crafted `assets/architecture.svg`. It uses only repository design tokens and
  embedded SVG primitives, includes no external font/image/script dependency, and fixes its paper
  background so GitHub light and dark render identically.
- Documentation now generates one page per MCP tool directly from the zod-backed tool
  specification, alongside the code-generated Assay Standard mirror and three fictional-tagged
  sealed-persona case studies.
- Added a repository judge gate that verifies README headings, release version, Standard version,
  agent/registry/dossier identifiers, tool prices, and dynamically counted Vitest, Playwright, and
  Foundry totals.
- Added a dead-link sweep over README, security/listing exhibits, generated docs, and site source.
  CI now regenerates the Standard/tool/case-study pages, rejects diffs, runs the repository judge,
  checks links, and executes all **314 tests** (262 Vitest + 48 Playwright + 4 Foundry).
- Added `npm run dossier` and `npm run studio:dev` as the deterministic, keyless five-minute
  evaluation path.

### Changed

- Promoted every workspace package to `1.0.0` and made the production MCP default
  `https://api.assayed.xyz`.
- Updated the holding-page and Open Graph Standard labels to AS-1.1.0.
- Replaced the security stub with concrete disclosure, SSRF, prompt-injection, PII/redaction,
  capability-URL, seal, payment, secret, and honest-scope documentation.

### Fixed — x402 listing remediation

- **OKX.AI ASP #8599 x402 discovery compatibility:** `GET /mcp`, bare unpaid POSTs, and MCP `initialize` / `tools/list` probes now receive an x402-v2 `402 PAYMENT-REQUIRED` challenge before content-type or SSE negotiation can reject them. The generic discovery price is **0.05 USD₮0** (`50000` atomic units) on `eip155:196`, paid to the configured treasury.
- Paid MCP discovery replays no longer fail the SDK's dual-`Accept` transport check: the server normalizes that internal transport requirement while preserving a plain JSON response. GET discovery is idempotent and returns its settlement proof.
- The payment resource URL is sourced from `ASY_BASE_URL`, so reverse-proxied challenges advertise `https://api.assayed.xyz/mcp` rather than an internal `http://` URL.
- DevGate now mirrors the current v2 challenge shape and the official X Layer USD₮0 asset address. Four focused regressions bring the repository total to **260 Vitest**.
- Deployed the remediation and verified GET, bare POST, `initialize`, and `tools/list` against the public endpoint; OKX's `x402-check` reports `valid:true`.
- Public gallery dossier IDs now resolve through `asy_verify` even though those sealed exhibits are
  generated outside the mutable production SQLite store. A regression cross-checks all three
  public ID→leaf mappings against the committed gallery data; raw-leaf verification remains the
  trustless fallback.
- The hosted e2e gate now builds the bundled MCP server and production web app explicitly. The
  first Phase 15 CI run exposed that local warm artifacts had previously masked this clean-checkout
  prerequisite.

## [0.14.0] — 2026-07-25

### Added — Marketplace depth and agent-consumer polish (Phase 14)

- `/agents` now carries a copyable consumer smoke: register Assay, call free `asy_verify`, then show and approve one 0.05 USD₮0 `asy_ats_scan` payment before returning its receipt.
- The dossier `manifest_json` artifact is documented as the agent-to-agent hand-off contract: confirmed claims with evidence strength, coverage counts, named risks, Standard version, and an integrity digest—without uploaded source files, redaction geometry, or salts.
- Added a fail-closed manifest/docs/pricing consistency script and GitHub Actions gate. All 11 tool names, prices, marketplace summaries, and generated descriptions trace to the same server source.
- Added an operator-only outreach kit: three non-transactional DM drafts and two build-in-public drafts backed by real mainnet seal and honest AS-1.1 re-grade screenshots.
- Added a public marketplace screenshot script that refuses to create proof until all 13 registered services and exact prices appear on the public listing.

### Changed

- Every paid tool description carries a concrete invocation example; the five capabilities genuinely included in the dossier pipeline now state that they are also runnable through `asy_create_dossier_job`.
- `/pricing` renders the generated tool collection directly, fixing the missing `asy_interview_prep` row copy and preventing another hand-maintained projection from drifting.
- OKX.AI ASP #8599 gained ten API services in tx `0xcf0a3f61e15e142d63e9931be3e27c8a48f32bf1e95af93588ee8f3c66e9e423`: Interview Prep, Promotion Dossier, Freelancer Proof Pack, Claim Audit, Cover Letter, Story Bank, Tailor Resume, Verify Seal, Job Status, and Job Result.

### Fixed

- `/agents` no longer says “ten tools” after Phase 12 added the eleventh.
- The gallery persona seal receipt now uses a one-column proof layout with wrapping hashes and an explicit fictional-demonstration label; this was found while capturing the outreach proof.
- The new scrollable consumer script is keyboard-focusable; the first Playwright run found the accessibility issue and the complete 48-case rerun passed.
- The route sweep still expected the pre-remediation `GET /mcp` 405. It now requires the corrected 402 and validates the generic x402-v2 challenge network and amount.
- Docs typechecking now generates Fumadocs source types first, so the new CI gate also works from a clean checkout rather than relying on a developer’s existing `.source` cache.
- CI installs Foundry before Vitest, allowing the registry client’s local Anvil integration tests to run on clean runners, and executes the four Solidity tests directly as a separate gate.

### Decision

- Did not register an agent-to-agent service. Current OKX guidance expects trained multi-round negotiation, delivery/revision rules, and 10–20 scenario simulations; Assay proves its API/background-job path today but does not yet prove that negotiation agent.
- The three original marketplace services remain unchanged. OKX rejected a full-record update because those services are already in use; the additions-only update succeeded without disturbing their history.

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
