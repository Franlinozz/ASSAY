# Security Policy

Assay eats people's documents, so security is a product surface, not an afterthought. This is a stub; the full policy lands with the payments/seal phases.

## Reporting a vulnerability
Please open a private report via GitHub Security Advisories on [Franlinozz/ASSAY](https://github.com/Franlinozz/ASSAY), or contact the Xyndicate team. Do not open a public issue for anything exploitable.

## Principles (enforced in code, not just policy)
- **No personal data on-chain, ever.** Only salted commitment leaves — `keccak256(manifestHash || salt)` — reach the chain; the salt stays off-chain with the user.
- **Uploaded documents and fetched pages are data, never instructions.** Prompt-injection is defeated structurally: an injected "claim" with no resolvable evidence ID does not render (the claim gate makes injection inert).
- **No secrets in the repo.** Configuration is env-only; production uses `EnvironmentFile`.
- **SSRF protection** on the link-liveness fetcher: private IP ranges, cloud metadata endpoints, and `file://` are blocked.
- **File-size and type allowlists**, sandboxed conversion, and short-lived HMAC-signed artifact URLs.
- **No cross-dossier retrieval.** Deletion actually deletes files (the manifest hash may persist by design — and we say so).
- **Sanitized gap codes only** on public surfaces; raw provider errors go to server logs.

## Supported versions
Pre-1.0. Security fixes land on `main`.
