# OKX.AI Genesis Hackathon — paste-ready submission answers

> **Status 2026-07-28.** Agent **#8599 (Assay)** is **listed and active** on OKX.AI. Every factual
> claim below is verifiable from a public URL or an X Layer transaction hash — nothing here rests on
> the reader taking our word for it. Fields are marked **[PASTE]** (copy verbatim into the form) or
> **[OPERATOR]** (only you can supply it).

---

## [PASTE] ASP Name

Assay

## [PASTE] Agent ID

8599

## [PASTE] ASP Type

A2MCP

## [OPERATOR] X Account Handle

@Franciscco1

## [OPERATOR] X Participation Post

**PENDING — paste the public `x.com/.../status/...` URL after publishing.** Copy and media
checklist: [`X-POST.md`](./X-POST.md).

## [OPERATOR] Telegram Handle

**MUST FILL — the Telegram account the organizers can reliably reach.**

---

## [PASTE] ASP Description — recommended full answer

Assay is an evidence-backed career system built around one promise: **it will not write a sentence
it cannot trace.**

Most AI career tools turn whatever a user types into confident prose. Assay does the opposite. It
turns scattered résumés, project documents, certificates, work links, and guided answers into a
structured **Career Dossier** where every claim is bound to its evidence, graded at the strength
that evidence earns, and carried consistently into every output. Unsupported details become visible
questions or honest gaps — never invented achievements.

**The claim gate is demonstrable, not rhetorical.** In a real paid call on 2026-07-27, the same
résumé and the same job description were run through two Assay services. The ATS scan reported
**50% of must-have keywords present** — and explicitly labelled that as word presence, not fit. The
Fit Brief, which only counts a requirement as covered when a *confirmed claim* backs it, returned
**2 strong and 5 missing** for the identical inputs, marking databases, AWS, Docker and team
leadership as *"No evidence covers this yet — do not claim it."* The cover letter that followed
contained four sentences, each carrying a claim ID, and mentioned none of the five missing
requirements. That gap between "keywords present" and "evidence-backed" is the product.

**The human workflow is a five-room Studio.**

1. **Ledger** — extracts experiences and claims, preserves evidence links, and requires the
   candidate to confirm or set aside uncertain facts.
2. **Brief** — decomposes a job, promotion, or client brief requirement by requirement and reports
   honest strong / partial / confirm / missing coverage.
3. **Interview Room** — generates evidence-grounded behavioural and gap questions, checks typed
   answers for STAR completeness, and catches contradictions such as claiming "led 12 people" when
   the confirmed ledger says 8.
4. **Forge** — produces an ATS résumé, designed résumé, DOCX, cover letter, story bank, fit map, gap
   brief, portfolio page, and machine-readable manifest. The same engine produces promotion review
   packs and freelancer proof packs.
5. **Report & Seal** — grades every draft, re-parses the rendered ATS PDF field by field, preserves
   failed drafts instead of hiding them, and lets the owner seal and selectively share the result.

**Quality is published, not asserted.** The **Assay Standard AS-1.1.0** is a code-generated rubric
with artifact-specific profiles, 15 deterministic hard checks, and six craft axes. The page a user
reads, the docs an agent reads, and the code that grades all originate from one source — published
equals shipped. A bounded repair loop may improve a failing draft twice, but the bar never moves,
and no unavailable critic path can manufacture a PASS. Assay publishes its own failures: the
demonstration gallery ships runs where the first draft **failed** the Standard and was repaired.

**Provenance without exposure.** Each dossier version carries a canonical manifest and an EIP-712
receipt. Assay anchors only a **salted commitment** to `AssayRegistry` on X Layer (`eip155:196`), so
anyone can verify a dossier is unchanged while **no name, résumé, contact detail, career claim,
document, or salt ever touches the chain.** Share portals are private by default, revocable,
expirable, selectively redactable, and can expose evidence threads so a recruiter sees proof rather
than polish. Seal verification is **free forever** — for candidates, recruiters, and other agents.

**Assay is an agent-native business, not just a website.** Other agents hire **11 canonical A2MCP
tools** — surfaced as 13 marketplace offers, because the one dossier tool serves Career, Promotion
and Freelancer modes without duplicating the API contract. Calls settle in USDT via **x402 on X
Layer**; long dossier work runs on async create/status/result job rails and returns the finished
dossier in-band when it completes inside the payment window; verification stays free.

**Two commercial ethics we enforce in code, and you can test both without spending anything:**

- **A refusal never costs money.** A request that cannot produce the advertised capability is
  rejected with `400 invalid_request` **before the payment gate** — naming the missing input, the
  keys that satisfy it, and a runnable example, with `charged: false`. Assay would rather return
  nothing and take nothing than bill for an apology.
- **Free means free.** Seal verification, job status, and job result are never gated, and every
  service publishes its full input contract at `GET /x402/:service/schema` — price, arguments, and a
  working example — so a buyer can learn exactly what to send before spending a cent.

The product is live at **https://assayed.xyz**, its generated documentation at
**https://assayed.xyz/docs**, and its full source at **https://github.com/Franlinozz/ASSAY**. The
repository is itself an exhibit: **376 passing tests** (315 Vitest, 57 Playwright, 4 Foundry),
clean-checkout CI, a published security model, failure drills, generated tool documentation, a real
mainnet registry, real sealed demonstration dossiers, and a free public verifier. Gallery personas
are explicitly labelled fictional; their pipeline runs, Chromium PDF rendering, parse-back reports,
and mainnet seals are real.

Assay belongs in **Lifestyle Companion** because a career is not a one-off document. It is an
ongoing personal system: collect proof as the work happens, prepare for interviews, build a
promotion case, win freelance work, re-forge a new version, and carry trustworthy career context
between humans and agents. In a market where generative fluency is becoming free, Assay makes
**credibility portable**.

**ASSAY — Proof before polish.**

---

## [PASTE] ASP Description — compact fallback (if the field is length-capped)

Assay is an evidence-backed career system that turns scattered résumés, project files, certificates,
links, and guided answers into a graded, sealed Career Dossier. Its claim gate will not render a
sentence unless it traces to confirmed evidence — unsupported details become questions or honest
gaps. Proof, not rhetoric: on identical inputs its ATS scan reported 50% keyword presence while its
Fit Brief returned 2 strong / 5 missing, because keywords are not evidence. A five-room Studio
builds the claim ledger, maps job/promotion/client briefs, checks interview answers against STAR and
the ledger, forges artifact packs, and grades them against the published, code-generated Assay
Standard AS-1.1.0. ATS résumés are rendered and actually re-parsed field by field. Each version gets
an EIP-712 receipt and anchors a privacy-preserving salted commitment on X Layer — no personal data
on-chain. Agents hire 11 canonical tools via A2MCP with x402 USDT settlement and async job rails; a
request that cannot be served is rejected before payment (`charged: false`); seal verification is
free forever. Live: https://assayed.xyz · Docs: https://assayed.xyz/docs · Source:
https://github.com/Franlinozz/ASSAY · Agent #8599.

---

## Verify every claim in this submission — 60 seconds, no payment, no account

> Include this block if the form offers an "additional details / links" field. It is the single
> strongest thing we can give a judge: **checkable claims**.

```bash
# 1. The service is alive, and reports its own version + standard + payment mode
curl -s https://api.assayed.xyz/health

# 2. Machine discovery: every tool, price, network, registry — free, no auth
curl -s https://api.assayed.xyz/.well-known/assay.json

# 3. The published input contract for any service — price, arguments, working example
curl -s https://api.assayed.xyz/x402/asy_fit_brief/schema

# 4. A real x402 challenge on X Layer (402 + PAYMENT-REQUIRED header, USD₮0, eip155:196)
curl -si -X POST https://api.assayed.xyz/x402/asy_create_dossier_job \
  -H 'content-type: application/json' -d '{}' | head -20

# 5. "A refusal never costs money" — presenting payment with an unserviceable request
#    returns 400 with charged:false, BEFORE the payment gate
curl -s -X POST https://api.assayed.xyz/x402/asy_ats_scan \
  -H 'content-type: application/json' -H 'PAYMENT-SIG: probe' -d '{}'

# 6. Free-forever on-chain verification of a real sealed dossier
curl -s -X POST https://api.assayed.xyz/x402/asy_verify \
  -H 'content-type: application/json' -d '{"dossierId":"DSR-WC0Q7NZ7"}'
```

Public pages: [assayed.xyz](https://assayed.xyz) · [/judge](https://assayed.xyz/judge) (90-second
replay of a real sealed run) · [/gallery](https://assayed.xyz/gallery) ·
[/standard](https://assayed.xyz/standard) · [/verify](https://assayed.xyz/verify) ·
[/pricing](https://assayed.xyz/pricing) · [/agents](https://assayed.xyz/agents) ·
[/docs](https://assayed.xyz/docs)

---

## On-chain record — real commerce, independently checkable

Every hash below is on X Layer mainnet (`eip155:196`) and resolves on
[oklink](https://www.oklink.com/x-layer). Nothing is staged.

| What | Transaction |
|---|---|
| **AssayRegistry** (contract) | [`0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4`](https://www.oklink.com/x-layer/address/0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4) |
| First real x402 settlement — paid `asy_ats_scan`, 0.05 USD₮0 | `0x4babf76c2b29c6a8ac0314b42ad93081213f62022d537903c99abfecf73794a7` |
| Sealed 3 demonstration dossiers in one batch | `0xae83407122efebea92e422921f91dd319ad504c611388fe15196274dc92b923e` |
| **Marketplace purchase 1** — ATS Resume Scan, 0.05 USD₮0 (paid → delivered → complete) | pay `0xe63ee4880f489ab0848fcd12ad0964f5da8bcc4abb2a09350e80506f7c3a9e8a` · complete `0x274af255b8cd1466209261565b3e26b758387fd756e13517b8213b18139e4e81` |
| **Marketplace purchase 2** — Job Fit Brief, 0.10 USD₮0 | pay `0x187c7edd52c11fb8a4a863ac3609faeff392872b925142c880c1ac3066e19959` · complete `0x6a02216f3c2b131deafc7a21246d5d8bf49dec41542b6e959a8081755ec81316` |
| **Marketplace purchase 3** — Cover Letter, 0.15 USD₮0 | pay `0x194d57dda8e755927ee69f0e411aa8d6e47f670c5869b339ee902667302cdffe` · complete `0x8fa47993f9d3d1156f54de9e9a489cfefccdc32d37af5e0551d859e1c7b9ccf4` |
| **Career Dossier purchase** — 2.00 USD₮0, 9 artifacts sealed | `0x12fa7c013686ce9a29a493ebef9605c09c0906e0f010c2e973c30f75838a782e` |

All three marketplace purchases were commissioned **through the OKX.AI task marketplace** by a
separate buyer agent, settled via the OKX Agent Payments Protocol (x402 v2, scheme `exact`, gasless
EIP-3009), delivered, and closed to on-chain status **`complete`**. This is not a demo harness
calling itself — it is the platform's own buyer flow, end to end.

---

## How this maps to the published judging criteria

Official criteria: product experience · service completeness · user value · creativity · approved
and live on OKX.AI. Source: <https://web3.okx.com/xlayer/build-x-series?i5lsj=7>.

| Criterion | What Assay puts on the table |
|---|---|
| **Approved & live** | Agent #8599 listed and active; endpoint live with a valid, correctly-priced x402 challenge on all 13 offers |
| **Product experience** | Five-room Studio with an observable pipeline, a recruiter share portal, a free public verifier, a 90-second `/judge` replay of a real sealed run, light/dark theming, and axe-clean accessibility on every public page |
| **Service completeness** | 11 canonical tools + 13 marketplace offers; async job rails; generated docs; version lineage; redaction; share expiry and revocation; capability-token access; disk, rate and payload guards; failure drills |
| **User value** | Solves a real and expensive problem — unverifiable career claims. Repeat use across job search, promotion, and freelance, not a one-shot generator |
| **Creativity** | A generator that refuses to generate; a public standard that grades its own maker and ships its failures; machine parse-back of the rendered PDF; contradiction-checking against the ledger; privacy-preserving on-chain provenance; a paywall that refuses to charge for what it cannot deliver |
| **Agent economy** | Native A2MCP + x402 on X Layer, free verification tier, background job rail, machine-readable manifest, published per-service input contracts |

---

## What we deliberately do *not* claim

Judges reward calibration and punish overreach. Keep these lines if an "limitations" or "roadmap"
field exists — they cost nothing and buy credibility.

- The three Gallery personas are **fictional**, labelled as such on every page. Their pipeline runs,
  PDF rendering, parse-back and mainnet seals are real; the people are not.
- Assay has **no production user base yet**. Its commerce record is real but small and mostly
  self-commissioned through the marketplace; we present transaction hashes, not adoption numbers.
- Craft scoring is an LLM critic and is the least deterministic part of the system. That is why the
  hard checks are deterministic, why craft findings are shown rather than hidden, and why a
  degraded critic yields `UNGRADED` — never `PASS`.
- A2A negotiated delivery is **not** shipped. Assay proves A2MCP and background jobs today; we did
  not register an A2A offering we could not back with a trained negotiation agent.

---

## Operator checklist before pressing submit

1. Confirm `curl -s https://api.assayed.xyz/health` returns `ok:true`, `v1.1.0`, `AS-1.1.0`,
   `paymentMode: okx`.
2. Confirm all three systemd units are active (`assay-mcp`, `assay-web`, `assay-docs`).
3. Confirm #8599 still reads **listed / active** in the marketplace.
4. Publish the X post, paste its URL into the field above and into this file.
5. Fill the Telegram handle.
6. Record the ≤90-second video per [`DEMO-KIT.md`](./DEMO-KIT.md) — it is a real screen recording of
   real pages, with no invented terminal output, fake reviews, or staged payments.
7. Paste the **full** ASP description; fall back to the compact version only if the field truncates.
