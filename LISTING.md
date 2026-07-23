# Assay — OKX.AI marketplace listing (use verbatim)

**Name:** Assay
**Category (primary):** LIFESTYLE
**One-liner:** Proof before polish — evidence-backed career dossiers, graded and sealed.
**Endpoint:** `https://api.assayed.xyz/mcp` (transport: streamable-HTTP)
**Payment:** x402 on X Layer (`eip155:196`), USDT
**Standard:** AS-1.0.0 · **Registry:** `0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4` (X Layer mainnet)

## Description

**Assay turns scattered work history into a Career Dossier where every claim traces to proof.** It is a career studio for job seekers — and for other agents, over A2MCP — built on one non-negotiable promise: *Assay will not write a sentence it cannot trace.*

The loop: **Evidence → Brief → Forge → Tribunal → Seal → Share.** You bring a résumé and a target role; Assay extracts grounded claims, maps them against the job, writes only what the evidence supports, grades every document against a published Standard, and seals the result on-chain.

**Four moats:**

1. **The claim gate.** No sentence renders without evidence behind it. Unsupported statements become questions, never prose — so nothing Assay produces can be caught out in an interview.
2. **A published Standard (AS-1.0.0).** Every document is graded against a rubric that is generated from the same code that grades — published equals shipped. 12 deterministic checks + a craft critic.
3. **ATS parse-back.** The ATS résumé is machine-verified by actually re-parsing the rendered PDF and diffing it field-by-field against the source — not a simulation of any specific vendor.
4. **On-chain provenance.** The finished dossier is sealed with EIP-712 and a salted commitment on X Layer. Anyone can verify a seal for free, forever. **No personal data ever touches the chain.**

## Tools & prices (USDT, x402 on eip155:196)

| Tool | Price | What you get |
|---|---:|---|
| `asy_ats_scan` | 0.05 | Re-parse your résumé like an ATS: format-law findings + (with a JD) honest keyword coverage |
| `asy_claim_audit` | 0.05 | Every bullet graded SUPPORTED / UNSUPPORTED_NUMBER / VAGUE + a repair brief |
| `asy_fit_brief` | 0.10 | A job description mapped to your evidence: strong / partial / confirm / missing |
| `asy_cover_letter` | 0.15 | A cover letter where every sentence cites a confirmed claim |
| `asy_story_bank` | 0.20 | 2–4 STAR interview stories, each grounded in evidence |
| `asy_tailor_resume` | 0.30 | Résumé bullets tailored to a JD, evidence-constrained and format-clean |
| `asy_create_dossier_job` | 2.00 | The full pipeline → ATS + designed résumé, cover letter, story bank, fit map, portfolio, all graded and sealed |
| `asy_job_status` | free | Poll a dossier job |
| `asy_job_result` | free | Fetch a finished dossier (signed links + tribunal summary + seal) |
| `asy_verify` | **free forever** | Verify any dossier's on-chain seal |

The Standard: https://assayed.xyz/standard · Repo: https://github.com/Franlinozz/ASSAY
