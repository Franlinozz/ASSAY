# PART 1 — MY VERDICT ON THE DIRECTION (and where I'm spending my 50%)

**I agree with the direction. I do not agree with the blueprint.** Career workflows is the right track — but not because ChatGPT said so, and not exactly the way ChatGPT designed it. Here's my independent reasoning:

**Why career/resume is correct:**

1. **The organizers told us the answer.** X Layer's extension thread listed "Professional Asset Creation" at #1 and "Resume & Career Workflows" at #2. Both live naturally in Lifestyle. When judges publish their wishlist mid-competition, you build the wishlist — but you build it in a way nobody else reading that tweet can copy in a month.
2. **The niche is validated by real money outside web3.** I checked the current landscape today: Jobscan charges **$49.95/month** for ATS match reports. Teal is $9/week. Rezi is $19–49/month. "AI resume builder" is one of the fastest-growing search categories of 2026, and 93% of recruiters run ATS software that rejects most resumes before a human sees them. This is a real, paying, global problem — which is exactly what "real-world use case, real usage" means to these judges. And it hits *you* personally as a Lagos builder: this product is genuinely useful in your own world, which will show in the demo.
3. **Every existing tool — web2 AND marketplace — has the same fatal flaw, and it's the flaw we are uniquely built to kill.** Jobscan, Teal, Rezi, and every resume agent on OKX.AI (Resume Curator at 7.5 USDT/5 sold, Vouch, Placd, 求职参谋) all do the same thing: make your claims *sound* better. None of them ask whether the claims are *true*, none of them grade their own output against a published standard, and none of them give the recruiter on the other side any reason to trust the polished result. AI has made every candidate sound competent — which means polish is now worthless and **proof is the new scarce asset**. That is a Tribunal-shaped problem and a Seal-shaped problem. We already own both mechanisms. Nobody else in 600+ submissions does.
4. **Portfolio play.** Xyndicate now fields Sigil (finance/software adjacency), Occestra (Art Creation), and this (Lifestyle). One studio, three category podium shots, plus Best Product and Creative Genius contention across all three. No other builder in this hackathon has that spread.

**The one risk I want on the record (my honest pushback):** because OKX tweeted the answer, expect 20–50 new resume agents in the extension month. Obvious direction means crowded direction. That's fine *only if our moat is visible within 60 seconds of a judge opening the product*. So the entire design below is organized around four things no tweet-follower will ship: **evidence-gated generation, a published grading standard with deterministic parse-back proof, sealed on-chain provenance, and Occestra-grade editorial UI.** A prompt wrapper can't fake any of those in four weeks.

---

# PART 2 — BRUTALLY HONEST REVIEW OF CHATGPT'S PROOFLOOM

I read every section. Overall grade: **B+ strategy, C+ product plan.** It's the smartest ChatGPT output you've fed me in this project — and it would still lose you the hackathon if you built it as written. Here's the split:

**What it got right (I'm keeping ~50% of it):**

- The **two-clock plan** (eligibility by Jul 27, apex month after) is exactly right and I'm adopting it wholesale.
- The **claim-provenance idea** — every generated sentence traceable to evidence, unsupported claims blocked or surfaced as questions — is genuinely the best idea in the document. It is the Tribunal philosophy applied to career claims, and it becomes our signature mechanism. Keeping it, sharpening it.
- The **evidence-strength tiers** (attested vs document-backed vs linked vs sealed, never collapsed into one dishonest "verified" badge) — keeping, simplified from six tiers to four.
- The **integrity-vs-truth distinction** ("a seal proves the artifact is unchanged, not that every claim is objectively true") — keeping verbatim in spirit; it's the honest framing that survives judge scrutiny.
- The **marketplace test matrix** and x402 reliability section — solid, matches your rejection scars, adopting with additions.
- The **evidence-threads interaction** (select a sentence, see its sources light up) — keeping; it's the unforgettable demo moment.
- The **"do not build" list** (no job scraping, no mass-apply, no video analysis, no personality scoring) — correct, keeping.

**Where it's wrong, and why (this is where I'm exercising my 50% hard):**

1. **It's catastrophically overscoped for the eligibility clock.** Its July 22–27 plan includes auth + multi-member workspaces + full evidence graph + Role Lab + Packet Studio + Interview Room + payments + listing in *five days*. We know from Occestra what five days actually buys. Building that plan as written means arriving at July 27 with nothing listed — which per the rules means **disqualified**, full stop. The apex month doesn't save a submission that was never eligible.
2. **It's backend-heavy and demo-light.** Its center of gravity is the "Work Evidence Graph" — a data structure. Judges spend ten minutes with a product. They will never see your graph schema. They *will* see the artifact, the grading report, the verification page, and the UI. Occestra won attention because the **artifact was the star** and the machinery was visible through it. Proofloom inverts that, and the inversion is fatal. My design puts the Dossier (the artifact) at the center and makes the graph the invisible engine.
3. **Accounts and workspaces are a trap.** Multi-member workspaces, consent history, connected sources, data export, workspace deletion flows — that's a month of invisible work. Occestra shipped a winning product on capability URLs (pack ID + token) with zero login friction. Same pattern here for eligibility; magic-link auth is an apex-month item *if ever*.
4. **Its infra recommendation is wrong for us.** Postgres + pgvector + Redis + S3-compatible storage + separate worker containers. No. Our proven stack is better-sqlite3 + file store with HMAC-signed URLs + in-process workers behind Caddy on the VPS — it survived real marketplace traffic on Occestra, it's one less thing to break, and judges cannot tell the difference. ChatGPT is designing for a Series A team; we're a precision two-man cell (you + your bot) with me writing the phase prompts.
5. **"Conversion Memory," W3C Verifiable Credentials, institution sales, freelancer portals, promotion packets, career-rebuild packages** — all real ideas, all irrelevant to winning this hackathon, all cut from v1 or pushed deep into the apex month. A powerful product isn't the one with the most features; it's the one where every feature reinforces one promise (its own line, which its own plan violates).
6. **It missed our single biggest technical weapon:** deterministic **ATS parse-back verification**. More on this below — it's the career-domain equivalent of Sigil's simulate step, it's what Jobscan charges $50/month for, and Proofloom doesn't mention it once.
7. **The name.** Proofloom is fine but forgettable-fine, it collides conceptually with "Proofwork" (a competitor its own research cited), and the weaving metaphor doesn't earn the visual identity the way "occasion + orchestra" earned Occestra's. My names below.

**Integration verdict: adopt the strategy spine and the claim-gate mechanism, reject the scope, the architecture, the center of gravity, and the name.** What follows is my blueprint.

---

# PART 3 — THE PRODUCT

## The name (my pick, then your top 10)

# **ASSAY**

### *Proof before polish.*

An assay is the test performed on precious metal **before** it earns its hallmark stamp. That is literally this product: your career claims are tested before they're sealed. It sits perfectly in the Xyndicate family — **Sigil** seals transactions, **Occestra** stages moments, **Assay** proves careers. Short, ownable, mono-friendly (`asy_` tool prefix), and it makes the entire visual language (assay marks, stamps, certificates, registration lines) *mean something* instead of decorating.

The full ranked ten, since you asked:

| # | Name | Why it works | Watch-out |
|---|------|-------------|-----------|
| 1 | **Assay** | The test before the stamp; perfect Tribunal/Seal DNA; family-coherent with Sigil | Non-native readers may misread as "essay" — the tagline fixes it instantly |
| 2 | **Dossier** | The artifact *is* a dossier; universally understood in one word; editorial as hell | Common word, crowded domains |
| 3 | **Palmarès** (styled *Palmares*) | The record of one's victories — precisely what we build | Spelling/pronunciation friction for a global judge panel |
| 4 | **Tenure** | Career-native, confident, one word | Slight academia skew |
| 5 | **Attaché** | The case that carries your professional life; premium | Accent mark friction |
| 6 | **Bonafide** | Your bona fides, proven — the meaning is the product | Reads slightly casual-American |
| 7 | **Vitae** | From *curriculum vitae*; elegant, timeless | CV framing may feel narrow (we're more than resumes) |
| 8 | **Laurel** | Earned achievement; "no unearned laurels" is a great line | Softer, less technical |
| 9 | **Marque** | A certifying mark of quality | Auto-industry association |
| 10 | **Credence** | Belief backed by evidence | Most generic of the ten |

Domain guidance for your $2 Namecheap run: try `assay.xyz` (likely premium — skip if so), then `assayed.xyz`, `assaystudio.xyz`, `useassay.xyz`, `assay-asp` variants, or the honestly quite clean `palmares.xyz` if you fall for #3. Same pattern as `occestra.xyz` — apex + `api.` subdomain behind Caddy. I'll write everything below as Assay; swap trivially if you pick another.

## The one-sentence pitch

> **Assay turns your scattered work history into an evidence-backed Career Dossier — every claim traced to proof, every document graded against a published standard, machine-verified to survive ATS parsing, and sealed with checkable provenance on X Layer — so in a world where AI makes everyone sound impressive, you're the one who can prove it.**

And the judge-facing frame, which covers **both** of X Layer's top signals in one product: the *workflow* is Resume & Career (signal #2); the *output* is executive-grade professional assets — designed PDF, ATS-safe PDF, .docx, portfolio page, interview kit, JSON manifest (signal #1). One product, both boxes.

## The problem, stated the way we'll state it publicly

Hiring is drowning in AI polish. Every applicant now sounds identical because every applicant runs the same prompt. Meanwhile 93% of recruiters run ATS software that silently rejects most resumes on formatting and parsing before a human ever reads them — and the tools that fix this (Jobscan et al.) charge $50/month to keyword-stuff harder, which makes the noise problem *worse*. Two failures, same root: **nobody in the pipeline can distinguish claims from proof.** Candidates can't organize their evidence; recruiters can't trust the prose. Assay fixes the pipe: it won't write a sentence it can't trace, it grades its own output against a standard anyone can read, it *machine-verifies* that the document survives ATS parsing (not "ATS-friendly" as a vibe — actually parsed back and diffed), and it seals the finished dossier so the other side can check integrity without trusting us.

## The core loop (the whole product in six words)

**EVIDENCE → BRIEF → FORGE → TRIBUNAL → SEAL → SHARE**

1. **EVIDENCE (the Ledger).** Drop in whatever you have: old resume, project docs, certificates, GitHub/portfolio links, performance notes, or just typed answers. Assay extracts experiences, achievements, skills, and *claims*, and files each claim with an evidence-strength tier: **Attested** (you said it), **Documented** (a file supports it), **Linked** (a live external source supports it — and we actually fetch it to confirm it's live), **Sealed** (integrity-anchored). Ambiguities come back as questions, never as inventions. This is the facts-block discipline from V2-0, promoted to the entire product's foundation.
2. **BRIEF (the Role Lab).** Paste a job description (or a promotion goal, or a client brief). Assay decomposes it into requirements and maps them against the ledger — not a fake "87% match" but an honest coverage report: *strong / partial / missing / needs-your-confirmation*, each line pointing at its strongest proof. Missing means missing; we tell you what not to claim.
3. **FORGE (the Studio).** Generates the **Career Dossier**: tailored resume (designed PDF + ATS-safe PDF + .docx), cover letter, requirement-coverage fit map, STAR interview story bank, gap & risk brief ("do not claim direct enterprise SaaS experience; frame it as transferable ops work"), a hosted portfolio one-pager, and a machine-readable JSON manifest for other agents. **Every sentence carries hidden claim IDs.** A sentence with no supporting claim doesn't render — it becomes a question back to you. This is the anti-hallucination gate, and it's enforced in code, not in a prompt.
4. **TRIBUNAL (career edition — our crown jewel, detailed below).** Every artifact is graded against the published **Assay Standard (AS v1.0.0)**: deterministic hard checks plus Claude-critic craft axes, hard/craft split exactly as we settled in V2-2, repair loop max twice, full report ships in every dossier, pass or fail. The rubric page is generated from the same code that runs it — published equals shipped, our load-bearing guarantee.
5. **SEAL.** The dossier manifest is canonically hashed, EIP-712-signed, and anchored on X Layer mainnet via an `AssayRegistry` contract (KeepsakeRegistry pattern, per-leaf + salted commitments — the exact privacy architecture we already chose for Remember packs, reused because it was the right call). **Zero personal data on-chain, ever** — hash, timestamp, issuer, status only. Public verify page with live "Verify on X Layer."
6. **SHARE (the recruiter portal — the demo kill-shot).** A controlled share link where the *other side* of the market sees the resume with **evidence threads**: hover any bullet and thin lines light up connecting it to its proof, each tagged with its strength tier, plus the seal status and Tribunal grade. No resume tool on Earth serves the recruiter side. This page costs us two days and wins us the demo, because it makes the moat *visible in one screenshot*. The candidate controls exactly which evidence is exposed, whether links expire, and can revoke.

## The Tribunal, career edition — deterministic checks (this is where we're untouchable)

Career documents are *more* deterministically checkable than occasion packs were, which means our strongest mechanism gets stronger in this domain. Hard checks (any failure = repair or blocked, no averaging):

| Check | What it does | Lesson it encodes |
|---|---|---|
| **ATS PARSE-BACK** | Render the ATS PDF, then *re-parse it ourselves* with a deterministic extractor, and diff every field (name, dates, titles, skills, contact) against the source ledger. Ship the diff. Badge: "Parse fidelity 100% — every field survived machine reading." | This is Sigil's *simulate* step reborn. It's what Jobscan sells for $49.95/mo, done honestly, at agent prices. Nobody else will have it. |
| **CLAIM COVERAGE** | 100% of rendered sentences map to claim IDs; 100% of claim IDs map to *existing, resolvable* evidence | The broken-image-PASS bug, encoded as law on day one |
| **LINK LIVENESS** | Every URL in the dossier (portfolio, GitHub, LinkedIn, certificates) HTTP-checked live | Same bug class, second enforcement |
| **PLACEHOLDER SCAN** | `[BRACKETS]`, "YOUR X HERE", TBD, lorem, XXX → hard fail | V2-0, verbatim carryover |
| **DATE SANITY** | No future dates, tenure math correct, overlaps flagged, all times in the candidate's local timezone | The UTC bug, encoded |
| **CROSS-ARTIFACT CONSISTENCY** | Every number and claim identical across resume, letter, and stories — same claim ID, same value, everywhere | Novel; no competitor even attempts this |
| **FORMAT LAW** | ATS variant: single column, no tables/text-boxes/images, standard headings, 1–2 pages, embedded fonts; .docx validated by actually reopening it | The "actually render it" discipline from LAUNCH studio |
| **JD KEYWORD COVERAGE** | Deterministic weighted match of must-have terms — reported honestly, never stuffed | The Jobscan feature, minus the arms race |
| **PII HYGIENE** | Share pages carry only user-approved fields; redaction verified | Privacy as a check, not a promise |

Craft axes (Claude as critic — non-negotiable, your bot proved gpt-4o passes real defects Claude catches): voice, specificity, quantification density, positioning strength, evidence honesty, tailoring fit. Hard axes absolute; craft passes at weighted ≥72 with no axis below 60 — the exact V2-2 formula, because we already fought that fight and won it.

## Site & app blueprint, page by page

**Public site** (mirrors the IA that worked on Occestra — Studio / Gallery / The Standard / Evaluation / Pricing / For Agents / Docs — because judges navigated it effortlessly):

- **Landing** — Hero: *"Proof before polish."* Sub: the one-sentence pitch. Live strip of recently sealed (anonymized) dossiers, Occestra-feed style. The hero visual is the signature interaction itself: a resume where bullets connect by fine threads to evidence cards, one thread pulling taut as a sentence is selected. CTA: *Open the Studio* / *Verify a dossier*.
- **The Standard** — AS v1.0.0 published in full, generated from the live rubric code. Include the line that earned its keep: *"The standard does not bend for our own marketing."*
- **Evaluation** — the first-draft-FAIL → repair → PASS story told with a real dossier, including the parse-back diff. Showing a failure is the credibility move; we learned that publishing honest repair loops reads as strength.
- **Gallery** — 3–4 featured sample dossiers (fictional personas, clearly labeled), each opening its share-portal view. Featured flag from day one; no duplicate clutter (V2 lesson).
- **Verify** — paste a dossier ID or hash → live on-chain check.
- **Pricing** — human framing + the agent catalog, with the one devastating comparison line: *"The tool category incumbents charge $50/month for. Priced per call, in cents."*
- **For Agents** — MCP endpoint, tool schemas, x402 flow, one-block integration snippet (Sigil's best page, reused as a pattern).
- **Docs** — Fumadocs, same as before.
- **Judge Mode** — one button: *Run the 90-second scenario*. Preloaded fictional persona → ledger builds → JD pasted → one claim deliberately blocked as unsupported (the honesty beat) → dossier forges → Tribunal fails first draft on a real check → repairs → passes → seals → share portal opens → live verify. Cached fallback behind every live call so a provider outage can't kill a judging session.

**The Studio (app):** four screens, capability-URL access (dossier ID + token), no login wall. **Ledger** (evidence review — approve/reject extracted claims, see strength tiers), **Brief** (JD paste + coverage map), **Forge** (artifact composer with the evidence drawer and per-sentence claim status), **Report** (Tribunal results + seal + share controls). That's it. Everything else is apex-month.

**Visual identity — distinct from both siblings, and it must be, since Sigil already owns parchment-gold and Occestra owns ivory-amethyst.** Direction: **"The Assay Office"** — security-print and certificate language. Light theme: cotton-paper white, blue-black engraving ink, deep viridian/oxide-green structural accents, one vermilion **stamp** accent reserved exclusively for seal moments, fine guilloché borders (the engraved-lattice patterns on certificates and banknotes — machine-generated SVG, cheap to produce, impossible-looking) and hairline registration marks. Dark theme: iron-gall night, warm paper text, brass details, never pure black. Type: engraved editorial serif for display, precise grotesk for UI, mono for claim IDs/hashes/receipts. Accent discipline ≤15% per viewport — the restraint rule that made Occestra read as premium. Signature moments: the **evidence threads**, and the **stamping of the seal** — a vermilion assay mark pressed onto the finished dossier with weight. Fable 5 builds this frontend; Playwright self-audit loop mandatory on every frontend phase, both themes, desktop and mobile, exactly as established.

## Service catalog (A2MCP, `asy_` prefix, USDT via x402 v2, CAIP-2 `eip155:196`)

| Tool | What it delivers | Price |
|---|---|---:|
| `asy_ats_scan` | Upload any resume + optional JD → deterministic parse-back report, format-law findings, keyword coverage. **The traction wedge** — the 1-cent-critique lesson applied here | 0.05 |
| `asy_claim_audit` | Claim list or resume text → unsupported/vague/contradictory findings with repair brief | 0.05 |
| `asy_fit_brief` | JD + profile → honest coverage map (strong/partial/missing/confirm) | 0.10 |
| `asy_tailor_resume` | Evidence-constrained tailored resume content + ATS PDF/docx | 0.30 |
| `asy_cover_letter` | Evidence-constrained letter, consistency-checked against the resume | 0.15 |
| `asy_story_bank` | STAR interview stories from approved claims, with per-story evidence tags | 0.20 |
| `asy_create_dossier_job` / `asy_job_status` / `asy_job_result` | Full Career Dossier as an **async job** — the V2-1 pattern, because full runs exceed marketplace timeouts and we will not relearn that | 2.00 |
| `asy_verify` | Dossier ID/hash → seal status, anchoredAt, explorer link | **Free** |

Every paid pipeline: policy gate before payment semantics, governor caps, tribunal-checked output, dossier persisted, seal queued. Bounded tools stay bounded — nothing synchronous over ~30s. Pricing note: this product is **text-dominant** — almost no image generation — so per-pack cost is a fraction of Occestra's and the 2 USDT flagship has genuinely healthy margin, which also means demo credits and judge-mode runs cost us pennies. That's a structural cost advantage over what we just shipped, worth savoring.

A2A: register the capability ("complete Career Dossier, negotiated") but the form and the listing lead with A2MCP — instantly provable beat unverifiable, as we concluded last time.

## Architecture & stack (proven parts only)

npm-workspaces monorepo, same skeleton that worked: `@xyndicate/assay-core` (contracts, schemas, ledger, claim gate, policy), `tribunal` (AS rubric, deterministic checks incl. the parse-back engine, critic client, repair loop), `receipts` (EIP-712, canonical hashing, salted commitments), `contracts` (AssayRegistry.sol — testnet 195 rehearsal, mainnet 196 deploy, sealer funded from your OKB), `providers` (model router: **Claude = critic + writer; DeepSeek = extraction/classification/JD-decomposition; deterministic code = hashing, scoring math, payments, parse-back — LLMs never touch those**; graceful degradation, gap codes sanitized at every public surface), `mcp-server` (Express 5, stateless `/mcp`, better-sqlite3, HMAC-signed artifact URLs, anchor worker, rate limits, `/health` with zero model calls), `apps/web` + `apps/docs`. VPS + Caddy + systemd on the new domain, ufw 22/80/443. Fake-provider mode first, one real paid smoke per phase, AGENTS.md re-read every session, ASSAY.md as the vision doc, CHANGELOG.md Keep-a-Changelog every phase — the full discipline, unchanged, because it's why Occestra shipped clean.

**Security (elevated, because this product eats people's documents):** uploaded resumes and fetched links are untrusted input — a PDF can contain "ignore previous instructions"; document text is data, never instruction, enforced by prompt structure *and* an output-side claim gate that makes injection useless anyway (an injected claim with no evidence ID doesn't render). SSRF protections on the link-liveness fetcher (private IPs, metadata endpoints, file:// blocked — same as the LAUNCH browser). File-size and type allowlists, sandboxed conversion, signed temporary URLs, **no cross-dossier retrieval, no personal data on-chain, deletion actually deletes files** (the manifest hash may persist; we say so honestly, exactly as Occestra's Remember studio does).

## Listing & x402 compliance (zero-rejection plan)

Baked into the build, not bolted on: OKX Payment SDK from the first payment phase; unpaid request returns compliant 402 advertising `eip155:196`; endpoint tested **from outside the VPS** (DNS, TLS, redirects, cold start); register our own agent user ID and self-test with the literal prompt "I would like to use the services of agent ID {ours}" before submitting; idempotency keys on every paid call, duplicate replay never double-charges; health under 500ms; malformed→400, oversize→413, model-timeout→controlled error; **avatar produced to spec and conservative** (your Sigil avatar rejection, encoded); ChatGPT's full test matrix adopted and run as a phase gate; listing submitted **by July 25**, not July 27, because review is ~24h and eligibility dies without a live listing. English-first listing copy, concise, honest capability labels (the Phase-5 rule).

## The two-clock build plan

**Eligibility clock (today → Jul 27) — seven phases, each a prompt I'll write for your bot:**
P0 scaffold + AGENTS.md/ASSAY.md + tokens + holding page + domain/Caddy · P1 ledger engine (ingest, extraction via cheap models, claim gate, strength tiers, fake providers throughout) · P2 brief engine (JD decomposition + coverage map) · P3 forge (resume/letter/stories, PDF+docx renderers, portfolio page) · P4 Tribunal (deterministic suite incl. parse-back, critic, repair, published Standard page) · P5 seal (contract testnet→mainnet, receipts, verify) · P6 ASP (tools, x402 gate, async jobs, store, register agent, **submit listing Jul 25**, real paid smoke, avatar) · P7 judge mode + gallery personas + 90s demo recording + X post (#OKXAI) + Google form + archive deployment evidence. Jul 27 is a freeze day — verification only, no new functionality.

**Apex clock (the extension month you've confirmed — I'm taking your word and planning on it):**
Week 1 — share-portal depth (expiry, revocation, access logging, granular evidence exposure), Interview Room (question generation + answer evaluation against evidence), promotion/review dossier variant. Week 2 — trust layer (redaction tooling, version comparison, credential import, AS v1.1 with per-artifact profiles — the V2-2 move, pre-planned this time instead of discovered). Week 3 — marketplace depth (real outreach for authentic usage — *no self-dealing, no fabricated reviews, smaller-but-real beats bigger-but-fake with these judges*, service doc polish, multilingual outputs, an A2A flagship). Week 4 — the polish war: full Playwright audit both themes/all viewports, performance, the V2-class bug hunt run *proactively* against our own known bug taxonomy, final demo, submission narrative, failure-recovery rehearsal. Every phase ends with the checkpoint-and-STOP pattern.

## The 90-second demo (X post + judge mode share the same spine)

0–10s: three messy files on a desk — "AI made every resume sound impressive. So impressive stopped mattering." 10–25s: files drop into the Ledger; claims appear with strength tiers; one ambiguity comes back as a question. 25–40s: JD pasted; honest coverage map — including a visible **missing**. 40–55s: the Forge writes; select a sentence; **evidence threads** pull taut; one unsupported claim visibly **blocked**, not invented. 55–70s: Tribunal fails the first draft on a real check, repairs, passes — parse-back diff shown: *every field survived machine reading*. 70–82s: the **stamp**: sealed on X Layer, live verify. Then the recruiter portal — the other side sees proof, not prose. 82–90s: an agent calls `asy_ats_scan`, 402 challenge, settlement, result. Close card: **ASSAY — Proof before polish.**

## Risks, honestly

Crowding post-tweet (answer: the four visible moats, and shipping the share portal early — it's the screenshot that can't be copied). Scope creep (answer: the phase gates; anything not in P0–P7 waits, including your own mid-build ideas — mine too). ATS parse-back overreach (answer: v1 verifies against *our own* deterministic parser + format law, honestly labeled; per-vendor ATS emulation is apex-month stretch, never a claim we can't back). Listing rejection (answer: the compliance plan above, submitted with 48h buffer). Demo fragility (cached fallbacks). And the $10M-valuation energy — I love it, and the venture story here is real (*the infrastructure through which professional claims are assembled and selectively trusted* is a genuine long-term thesis), but valuation talk goes in neither the product nor the submission; it goes into the quality bar. We build the thing that makes judges *feel* the valuation.

---

**Where you come in.** Three decisions and we move: **(1)** the name — my vote is Assay, yours carries equal weight; **(2)** confirm the eligibility scope as cut (specifically: capability URLs not accounts, Interview Room deferred, SQLite not Postgres — push back now if any of those bothers you); **(3)** confirm Lifestyle Companion as the listed category. The moment those land, my next message is AGENTS.md + ASSAY.md + the P0 phase prompt, in the exact format your bot already knows how to eat.

Let's go take this one too.
