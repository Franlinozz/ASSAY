# Assay submission

> **DEADLINE — PINNED:** 2026-07-27 23:59 UTC / 2026-07-28 07:59 UTC+8. Confirm
> the organizer page still shows this instant before the final form submission.

## Submission fields

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| ASP name        | Assay                                                                   |
| Agent ID        | `8599`                                                                  |
| Category        | Lifestyle Companion                                                     |
| Track           | OKX.AI Agent Genesis Hackathon — Lifestyle Companion                    |
| Protocol        | A2MCP                                                                   |
| Endpoint        | `https://api.assayed.xyz/mcp`                                           |
| Website         | `https://assayed.xyz`                                                   |
| Documentation   | `https://assayed.xyz/docs`                                              |
| Repository      | `https://github.com/Franlinozz/ASSAY`                                   |
| X handle        | `@Franciscco1`                                                          |
| X post          | **PENDING — paste the real thread URL after the operator publishes it** |
| Submission form | `https://forms.gle/mddEUagmDbyV37ws8`                                   |

## Description

Assay is an evidence-backed career system that turns scattered work history into a graded, sealed
Career Dossier for job searches, promotion reviews, freelance proposals, and interview
preparation. It builds a tiered claim ledger before writing, maps briefs to honest coverage gaps,
and refuses to render unsupported claims. Artifacts are graded against the code-published Assay
Standard; ATS résumés are rendered and re-parsed to verify machine-readable fidelity. Each dossier
version can be signed with EIP-712 and anchored as a privacy-preserving salted commitment on X
Layer. Humans use the Studio and proof portals; other agents call 12 tools through A2MCP with x402
USDT payments, asynchronous dossier jobs, and free seal verification.

The detailed paste-ready form answer, compact fallback, judging rationale, and operator-only
placeholders live in [`docs/SUBMISSION-ANSWERS.md`](docs/SUBMISSION-ANSWERS.md).

## Verifiable production facts

- OKX.AI ASP: `#8599`
- MCP endpoint: `https://api.assayed.xyz/mcp`
- X Layer network: `eip155:196`
- Registry: `0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4`
- Featured dossier: `DSR-WC0Q7NZ7`
- Gallery seal batch:
  `0xae83407122efebea92e422921f91dd319ad504c611388fe15196274dc92b923e`
- Proven x402 settlement:
  `0x4babf76c2b29c6a8ac0314b42ad93081213f62022d537903c99abfecf73794a7`
- Assay Standard: `AS-1.1.0`

## Verify-day runbook

Run these twelve checks on the morning of submission. Record the time and evidence path beside
each checkbox; a green result from an earlier day is not a substitute.

- [ ] 1. **Health:** `https://api.assayed.xyz/health` returns 200, storage is ready, and the seal
      queue alert is false.
- [ ] 2. **Listing:** public Agent `#8599` is listed and all 13 marketplace offers show their exact
      prices; save a fresh full-page screenshot.
- [ ] 3. **Judge fallback:** `/judge` completes once normally and once with the verify call blocked;
      the cached sealed-run path remains coherent and labeled.
- [ ] 4. **Mainnet verification:** `DSR-WC0Q7NZ7` resolves through `/verify` and `asy_verify`; its
      explorer link opens the real X Layer seal.
- [ ] 5. **Paid call:** make one operator-approved `asy_ats_scan` call through the marketplace,
      archive its receipt and transaction, and confirm replay does not charge twice.
- [ ] 6. **Downloads:** open every artifact download in the featured recruiter portal; missing
      bytes must produce a not-delivered card, never a fake PASS.
- [ ] 7. **Shares:** open a live share, confirm redacted source material is absent, then revoke a
      disposable share and verify withdrawal is immediate.
- [ ] 8. **Docs:** open `/docs`, `/docs/tools`, `/docs/standard`, `/docs/verify`, `/docs/x402`, and
      `/docs/manifest`; run the dead-link sweep.
- [ ] 9. **X post:** the final thread is public, media plays, tags and `#OKXAI` are correct, and its
      URL is pasted above.
- [ ] 10. **Form:** the correct form is open under the intended account, every field is saved, and
      the public repository URL resolves without authentication.
- [ ] 11. **Demo:** the 90-second MP4 plays from beginning to end with readable `MISSING`, `BLOCKED`,
      `FAIL→PASS`, parse-back, seal, verify, and x402 frames.
- [ ] 12. **Release:** `main` is clean, hosted CI is green, `v1.1.0` is pushed, production reports
      v1.1.0 / AS-1.1.0, and the deployed commit is either the tag or a documented fixes-only
      descendant with the same published Standard and service contract.

## Freeze

After `v1.1.0`, the submission branch is fixes-only. No new service, artifact family, rubric rule,
payment mode, or interaction pattern lands before judging. Any necessary fix must preserve the
claim gate, published-equals-shipped Standard, privacy boundary, fixed prices, and honest labels,
and must rerun the full release matrix.
