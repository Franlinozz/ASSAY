# ASSAY

### _Proof before polish._

Assay turns your scattered work history into an evidence-backed Career Dossier — every claim traced to proof, every document graded against a published standard, machine-verified to survive ATS parsing, and sealed with checkable provenance on X Layer — so in a world where AI makes everyone sound impressive, you're the one who can prove it.

An Agent Service Provider for the OKX.AI Genesis Hackathon (Lifestyle Companion track), by [Xyndicate](https://github.com/Franlinozz) — the studio behind Occestra and Sigil.

- **Live:** [assayed.xyz](https://assayed.xyz) · [The Standard](https://assayed.xyz/standard) · [How it grades](https://assayed.xyz/evaluation) · [Verify a seal](https://assayed.xyz/verify) · [For agents](https://assayed.xyz/agents) · [Docs](https://assayed.xyz/docs)
- **For agents:** MCP endpoint `https://api.assayed.xyz/mcp` · manifest [`/.well-known/assay.json`](https://api.assayed.xyz/.well-known/assay.json) · OKX.AI agent **#8599**
- **On-chain:** `AssayRegistry` on X Layer mainnet (`eip155:196`) at [`0x96f8b5f0bf…8ef4`](https://www.oklink.com/x-layer/address/0x96f8b5f0bfa06e065a861ac220bd86f5722b8ef4) — salted commitments only, zero personal data
- **The build constitution:** [`AGENTS.md`](./AGENTS.md)
- **The vision:** [`ASSAY.md`](./ASSAY.md)
- **What's shipped:** [`FEATURES.md`](./FEATURES.md) · [`CHANGELOG.md`](./CHANGELOG.md)

**Tests:** 260 vitest + 48 Playwright e2e + 4 foundry, all green. `npm test` · `npm run test:e2e` · `npm run sweep`

> The full README — hero, architecture diagram, quickstart, tool table, Standard link, and live numbers — lands in **Phase 15**. This is the scaffold.
