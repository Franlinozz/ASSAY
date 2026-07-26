# Security Policy

Assay processes career documents, contact details, evidence links, and payment proofs. Security and
privacy are therefore product behavior, not a disclaimer.

## Supported versions

Security fixes land on `main` and the latest tagged release. The first supported release is
`v1.1.0`; older development snapshots receive no separate backports.

## Report a vulnerability

Please use a [private GitHub Security Advisory](https://github.com/Franlinozz/ASSAY/security/advisories/new)
or email `archonaudit@gmail.com` with the subject `Assay security report`.

Include the affected route or package, impact, reproduction steps, and any proof-of-concept that is
safe to share. Do not include somebody else’s résumé or credentials. We aim to acknowledge a valid
report within 72 hours and will coordinate disclosure after a fix is available. Do not open a
public issue for an exploitable finding.

## Trust boundaries and enforced controls

### Uploaded documents and prompt injection

- PDF, DOCX, TXT, and pasted text are treated as untrusted **data**, never model instructions.
- Provider prompts wrap source material in an explicit data frame.
- Extracted claims are checked against the supplied source. Unsupported claims are dropped;
  unsupported numbers become confirmation questions.
- The claim gate runs again at render time: every artifact sentence must resolve to confirmed claim
  IDs and existing evidence IDs.
- Upload type and size limits are enforced before extraction. PDF page/object expansion, DOCX ZIP
  expansion, embedded macro markers, extracted-text growth, and parser time are bounded. Suspicious
  containers return `INGEST_HOSTILE`.
- Public errors contain stable, sanitized gap codes; raw provider errors stay in server logs.

These controls make document-borne prompt injection unable to create a renderable career claim.
They do not make arbitrary third-party document formats safe outside Assay’s supported parsers.

### Evidence links and SSRF

`packages/providers/src/fetcher.ts` applies the same guarded fetch path to evidence links and
Tribunal link-liveness checks:

- only `http:` and `https:` are accepted;
- DNS is resolved before each request;
- loopback, private, link-local, cloud-metadata, CGNAT, multicast, and reserved ranges are blocked
  for IPv4 and IPv6;
- every redirect is resolved and checked again, with at most three redirects;
- requests time out after five seconds;
- responses are capped at 1 MB and restricted to HTML/plain-text content types.
- profile/contact URLs are validated through this boundary before Forge; placeholder, malformed,
  and non-resolving links are quarantined instead of being copied into every generated artifact.

The regression suite covers IP literals, DNS rebinding, redirects, metadata ranges, and forbidden
schemes.

### PII, redaction, and sharing

- Raw evidence and document binaries stay off-chain.
- Creator-side text, field, and document-region redactions are applied before a share response is
  assembled. Redacted fragments, numeric metadata, and redaction coordinates are excluded from the
  public bundle.
- Recruiter portals expose only the creator-selected claims and artifacts.
- Share links are revocable and may expire. Optional access logs store a count and UTC timestamps
  rounded to the hour; Assay does not display or persist viewer IP addresses for this feature.
- Public recent-seal and dossier-summary endpoints return coarse, PII-sanitized shapes rather than
  artifact prose or contact details.

### Capability URLs and files

Assay v1 has no account system. The Studio owner URL contains an HMAC capability token and **is the
credential**; anyone who receives it can operate that dossier. Keep it private and revoke any
derived share links when they are no longer needed.

Artifact downloads use HMAC-signed URLs with a 24-hour default lifetime. Missing, altered, or
expired file tokens are rejected. Runtime SQLite databases, uploads, generated files, environment
files, and persona salts are excluded from version control.

Tokens use HMAC-SHA256, constant-time comparison, and resource binding. The hardening suite covers
mutation, expiry, cross-resource replay, operational ID entropy, and deleted-file reconciliation.

### Chain and seals

Only `keccak256(manifestHash || salt)` commitment leaves and timestamps reach
`AssayRegistry.sol` on X Layer. The salt remains off-chain. A seal proves that a canonical artifact
set has not changed since anchoring; it does **not** prove that a career claim is objectively true.
Evidence tiers communicate the separate strength question.

Seals are per dossier version. Re-forging creates a new version and does not mutate the old seal or
Tribunal report.

### Payments and secrets

- Policy checks run before payment handling, so refused requests are not charged.
- Paid MCP and concrete marketplace-resource calls use the OKX x402 facilitator on X Layer.
  Successful calls are idempotent by the provided key or payment-proof hash. Explicit keys are
  bound to the canonical tool arguments: identical retries can recover a cached result without
  resending the payment header, while different input under the same key is rejected with 409.
- Provider keys, payment credentials, the sealer key, signing secrets, and database paths are read
  from environment variables. Production loads them from a permission-restricted systemd
  `EnvironmentFile`; no secret belongs in the repository.
- Logs and public error bodies must never contain private keys, payment signatures, uploaded
  documents, or raw provider responses.
- CI/phase release checks run the repository/history secret scanner without printing matched
  values. The Phase 16 dependency sweep records a zero-advisory lockfile.

### Availability and failure semantics

- Writer failure completes the dossier with sanitized coverage notes and explicit not-delivered
  artifacts; it does not leave broken download links.
- Critic failure produces `UNGRADED`, never an inferred PASS. Ungraded and unavailable artifacts
  are excluded from pass-rate math and counted separately.
- Deterministic source blockers such as a dead link or unreadable evidence file stop the bounded
  repair loop immediately; Assay does not spend provider calls pretending prose can fix plumbing.
- Running jobs are requeued after process restart. SQLite uses WAL plus a bounded busy timeout;
  lock exhaustion maps to a sanitized retryable response.
- `/health` reports pending-seal age and low-disk upload readiness. New upload-bearing calls are
  refused before payment when the configured disk reserve is breached.
- HSTS, CSP, frame-ancestor, MIME-sniffing, referrer, and permissions headers are applied at Caddy.

The full executed drill table and performance measurements are in
[`docs/HARDENING-DRILLS.md`](docs/HARDENING-DRILLS.md).

## Honest scope

Assay does not independently contact employers, schools, or credential issuers in v1. A
certificate upload earns the **Documented** tier, not issuer verification. The system cannot
prevent a user from voluntarily sharing a capability URL or exported artifact, and it cannot
guarantee the security or retention behavior of external LLM providers, X Layer RPC services, or
sites linked as evidence. Those boundaries are disclosed rather than hidden.
