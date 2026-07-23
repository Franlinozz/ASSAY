# ASSAY — the vision

### *Proof before polish.*

> Assay turns your scattered work history into an evidence-backed **Career Dossier** — every claim traced to proof, every document graded against a published standard, machine-verified to survive ATS parsing, and sealed with checkable provenance on X Layer — so in a world where AI makes everyone sound impressive, **you're the one who can prove it.**

An *assay* is the test performed on precious metal **before** it earns its hallmark stamp. That is literally this product: your career claims are tested before they're sealed. It sits in the Xyndicate family — **Sigil** seals transactions, **Occestra** stages moments, **Assay** proves careers.

---

## The problem, stated the way we state it publicly

Hiring is drowning in AI polish. Every applicant now sounds identical because every applicant runs the same prompt. Meanwhile **93% of recruiters run ATS software** that silently rejects most resumes on formatting and parsing before a human ever reads them — and the tools that fix this (Jobscan at **$49.95/month**, Teal, Rezi) charge to keyword-stuff harder, which makes the noise problem *worse*.

Two failures, same root: **nobody in the pipeline can distinguish claims from proof.** Candidates can't organize their evidence; recruiters can't trust the prose.

Assay fixes the pipe. It won't write a sentence it can't trace. It grades its own output against a standard anyone can read. It *machine-verifies* that the document survives ATS parsing — not "ATS-friendly" as a vibe, but **actually re-parsed and diffed**. And it seals the finished dossier so the other side can check integrity without trusting us.

---

## The core loop (the whole product in six words)

**EVIDENCE → BRIEF → FORGE → TRIBUNAL → SEAL → SHARE**

1. **EVIDENCE (the Ledger).** Drop in whatever you have: old resume, project docs, certificates, GitHub/portfolio links, performance notes, or just typed answers. Assay extracts experiences, achievements, skills, and *claims*, and files each claim with an evidence-strength tier. Ambiguities come back as questions, never as inventions.
2. **BRIEF (the Role Lab).** Paste a job description (or a promotion goal, or a client brief). Assay decomposes it into requirements and maps them against the ledger — not a fake "87% match" but an honest coverage report: *strong / partial / missing / needs-your-confirmation*, each line pointing at its strongest proof. Missing means missing; we tell you what **not** to claim.
3. **FORGE (the Studio).** Generates the Career Dossier: tailored resume (designed PDF + ATS-safe PDF + .docx), cover letter, requirement-coverage fit map, STAR interview story bank, gap & risk brief, a hosted portfolio one-pager, and a machine-readable JSON manifest for other agents. **Every sentence carries hidden claim IDs.** A sentence with no supporting claim doesn't render — it becomes a question back to you. This is the anti-hallucination gate, enforced in code, not in a prompt.
4. **TRIBUNAL.** Every artifact is graded against the published **Assay Standard (AS v1.0.0)**: deterministic hard checks plus Claude-critic craft axes, repair loop max twice, full report ships in every dossier, pass or fail. The rubric page is generated from the same code that runs it.
5. **SEAL.** The dossier manifest is canonically hashed, EIP-712-signed, and anchored on X Layer mainnet via an `AssayRegistry` contract — per-leaf, salted commitments. **Zero personal data on-chain, ever** — hash, timestamp, issuer, status only. Public verify page with live "Verify on X Layer."
6. **SHARE (the recruiter portal).** A controlled share link where the *other side* of the market sees the resume with **evidence threads**: hover any bullet and thin lines light up connecting it to its proof, each tagged with its strength tier, plus the seal status and Tribunal grade. The candidate controls exactly which evidence is exposed, whether links expire, and can revoke.

---

## The four moats (visible within 60 seconds of opening the product)

1. **The claim gate** — evidence-gated generation. An unsupported sentence physically cannot render; it becomes a question. Enforced in `assay-core`, not in a system prompt a competitor can copy.
2. **The published Standard with parse-back proof** — the grading rubric is generated from the same code that grades, and the ATS check *re-parses the rendered PDF and diffs it*. This is the career-domain equivalent of Sigil's simulate step, and it is what Jobscan sells for $50/month, done honestly, at agent prices.
3. **The on-chain seal** — canonical hash, EIP-712 signature, salted commitment anchored on X Layer. Anyone can verify the artifact is unchanged without trusting Assay or seeing any personal data.
4. **The recruiter share portal with evidence threads** — no resume tool on Earth serves the recruiter side. It makes the moat visible in one screenshot.

A prompt wrapper cannot fake any of these in four weeks.

---

## Evidence-strength tiers

Every claim earns exactly one tier — and we never collapse them into a single dishonest "verified" badge:

- **Attested** — you said it. Your word, on the record.
- **Documented** — a file you supplied supports it.
- **Linked** — a live external source supports it, and *we actually fetched the URL to confirm it resolves*. A dead link never earns "Linked."
- **Sealed** — the dossier containing it has been integrity-anchored on X Layer.

## The integrity-vs-truth line (our honesty guarantee)

> **A seal proves the artifact is unchanged — not that a claim is objectively true.** We say exactly which tier each claim earned, and we never imply more than that.

This distinction is the framing that survives judge scrutiny. Assay does not certify that you did the thing; it certifies *what kind of proof stands behind each statement*, and that the sealed document has not been altered since. Honest scope, stated out loud, is itself a moat.

---

## Who it serves

Job seekers, career changers, and working professionals who need to turn a pile of evidence into an executive-grade dossier — **and** other agents, which call Assay's `asy_*` tools over A2MCP and pay per call in USDT via x402 on X Layer. One product, both sides of the market: the human in the Studio, the agent at the endpoint.
