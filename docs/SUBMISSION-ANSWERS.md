# OKX.AI Genesis Hackathon — paste-ready submission answers

> Verified against the official organizer page on 2026-07-26. Deadline: **2026-07-27 23:59
> UTC**. Do not submit until Agent #8599 is publicly live again after the avatar-triggered review,
> because the rules require the ASP to be approved and live.

## ASP Name

Assay

## Agent ID

8599

## ASP Description — recommended full answer

Assay is an evidence-backed career system built around one promise: **it will not write a sentence
it cannot trace**.

Most AI career tools make plausible prose from whatever a user types. Assay takes the opposite
approach. It turns scattered résumés, project documents, certificates, work links, and guided
answers into a structured Career Dossier where each claim is tied to evidence, graded at the
strength that evidence earns, and carried consistently across every output. Unsupported details
become visible questions or gaps—not invented achievements.

The human workflow is a five-room Studio:

1. **Ledger** extracts experiences and claims, preserves their evidence links, and requires the
   candidate to confirm or set aside uncertain facts.
2. **Brief** decomposes a job, promotion, or client brief requirement by requirement and reports
   honest strong, partial, confirm, and missing coverage.
3. **Interview Room** generates evidence-grounded behavioral and gap questions, checks typed
   answers for STAR completeness, and catches contradictions such as saying “led 12 people” when
   the confirmed ledger says 8.
4. **Forge** produces an ATS résumé, designed résumé, DOCX, cover letter, story bank, fit map, gap
   brief, portfolio page, and machine-readable manifest. The same system also produces promotion
   review packs and freelancer proof packs for repeat use beyond job hunting.
5. **Report & Seal** grades every draft, actually re-parses the rendered ATS PDF field by field,
   preserves failed drafts instead of hiding them, and lets the owner seal and selectively share
   the finished version.

Quality is not a private marketing claim. **Assay Standard AS-1.1.0** is a published,
code-generated rubric with artifact-specific profiles, 15 deterministic checks, and six craft
axes. The page users read, the documentation agents read, and the code that grades all originate
from the same source. A bounded repair loop can improve a failing draft twice, but the bar never
moves and no unavailable critic path can manufacture PASS.

Each dossier version has a canonical manifest and EIP-712 receipt. Assay anchors only a salted
commitment to `AssayRegistry` on X Layer (`eip155:196`), so anyone can verify that a dossier is
unchanged without placing a name, résumé, contact detail, career claim, document, or salt on-chain.
Share portals are private by default, revocable, expirable, selectively redacted, and can expose
evidence threads so a recruiter sees proof—not merely polished prose.

Assay is also an agent-native business, not only a website. Other agents can hire **11 canonical
A2MCP tools** through one stateless MCP endpoint. Calls settle in USDT through x402 on X Layer;
long dossier work runs asynchronously through create/status/result job rails; and seal
verification is free forever. The 11 tools are projected as 13 clear marketplace offers because
the one full-dossier tool supports Career Dossier, Promotion Dossier, and Freelancer Proof Pack
modes without duplicating the API contract.

The product is live at `https://assayed.xyz`, its generated documentation is at
`https://assayed.xyz/docs`, and its public source is at
`https://github.com/Franlinozz/ASSAY`. The repository is itself a verifiable exhibit: **344 passing
tests** (287 Vitest, 53 Playwright, 4 Foundry), clean-checkout CI, a published security model,
failure drills, generated tool documentation, a real X Layer registry, real sealed demonstration
dossiers, and a free public verifier. The Gallery personas are explicitly fictional; their
pipeline runs, Chromium PDF generation, parse-back reports, and mainnet seals are real.

Assay belongs in Lifestyle Companion because careers are not one-off documents. They are an
ongoing personal system: collect proof as work happens, prepare for interviews, build a promotion
case, win freelance work, re-forge a new version, and carry trustworthy career context between
humans and agents. In a market where generative fluency is becoming abundant, Assay makes
credibility portable.

**ASSAY — Proof before polish.**

## ASP Description — compact fallback

Assay is an evidence-backed career system that turns scattered résumés, project files,
certificates, links, and guided answers into a graded, sealed Career Dossier. Its claim gate will
not render a sentence unless it traces to confirmed evidence; unsupported details become questions
or honest gaps. The five-room Studio builds a claim ledger, maps job/promotion/client briefs,
checks interview answers against STAR and the ledger, forges job/promotion/freelance artifact
packs, and grades them against the published, code-generated Assay Standard AS-1.1.0. ATS résumés
are rendered and actually re-parsed field by field. Each version gets an EIP-712 receipt and can
anchor a privacy-preserving salted commitment on X Layer—no personal data goes on-chain. Other
agents can hire 11 canonical tools via A2MCP with x402 USDT settlement and async job rails; seal
verification is free forever. Live product: https://assayed.xyz · Docs:
https://assayed.xyz/docs · Public source: https://github.com/Franlinozz/ASSAY · Agent #8599.

## ASP Type

A2MCP

## X Account Handle

@Franciscco1

## X Participation Post

**PENDING — paste the public `x.com/.../status/...` URL after publishing the final post with the
real ≤90-second demo.**

Use the prepared copy and media checklist in [`X-POST.md`](./X-POST.md).

## Telegram Handle

**OPERATOR MUST FILL — use the Telegram account the organizers can reliably contact.**

## Why the recommended description is judge-complete

This section is an operator note; do not paste it into the form unless a separate “additional
details” field appears.

- **Clear real-world value:** replaces unverifiable résumé generation with a repeat-use career
  evidence system.
- **Product experience:** five-room human workflow, observable pipeline, recruiter portal, public
  verifier, three dossier modes.
- **Service completeness:** browser Studio plus 11 paid/free A2MCP tools, async jobs, generated
  docs, versioning, redaction, access logs, and recovery behavior.
- **Creativity:** claim-gated generation, contradiction-checking interview answers, a public
  standard that grades its own maker, machine parse-back, and privacy-preserving provenance.
- **Agent economy:** x402 USDT settlement on X Layer, free verification, background job rail, and a
  machine-readable manifest.
- **Proof instead of hype:** public repository, exact test matrix, real mainnet seals, honest
  fictional labels, explicit limitations, and no fabricated adoption or reviews.

Official criteria emphasize product experience, service completeness, user value, creativity, and
being approved/live on OKX.AI. Source:
<https://web3.okx.com/xlayer/build-x-series?i5lsj=7>.
