# Phase 15 fresh-clone quickstart transcript

**Executed:** 2026-07-25T17:44:29+02:00

**Source commit:** `d8dee25199c1bad326c747e8f6b236df93a8f262`

**Environment:** Linux x86-64 · Node.js 24.15.0 · npm 11.12.1

This is the release operator’s transcript, not an illustrative session. The checkout was created
with `git clone --no-local` into a new temporary directory. No `node_modules`, build output, runtime
database, environment file, or artifact was copied from the development checkout.

## 1. Clone

```console
$ git clone --no-local file:///root/assay /tmp/assay-phase15-fresh.MjZfPz/ASSAY
Cloning into '/tmp/assay-phase15-fresh.MjZfPz/ASSAY'...
```

The local transport was used because the repository was still private during release preparation;
it creates a real Git clone of the committed object rather than copying the working tree.

## 2. Locked install

```console
$ npm ci
npm error process terminated
npm error signal SIGTERM
```

The execution controller terminated the first attempt while npm was querying the registry audit
API. No package-resolution or build error occurred. The exact command was repeated in the same
fresh clone; `npm ci` removed the partial install before reifying the lockfile:

```console
$ npm ci
added 496 packages, and audited 506 packages in 2m
```

## 3. Chromium

```console
$ npx playwright install chromium
# exit 0; the pinned Chromium was present after verification
```

## 4. Deterministic dossier

```console
$ export ASY_PROVIDER_MODE=fake
$ npm run dossier
[run-dossier] mode=fake
candidate: Chidinma Eze
artifacts: 9
ATS parse-back fidelity: 100%
Tribunal: 8/9 final PASS
```

The one honest failure was `story_bank`: AS-1.1.0’s deterministic `STAR_COMPLETENESS` profile
rejected the fake fixture’s incomplete story. The command still emitted the report instead of
concealing or relabeling the failure.

Generated files:

```text
cover.svg                 6,775 bytes
cover_letter.pdf         30,327 bytes
fit_map.pdf              38,939 bytes
gap_brief.pdf            35,894 bytes
manifest_json.json          849 bytes
portfolio_page.html       3,211 bytes
resume_ats.pdf            28,424 bytes
resume_designed.pdf       47,855 bytes
resume_designed.png       51,881 bytes
resume_docx.docx           8,927 bytes
story_bank.pdf            39,537 bytes
```

## 5. Studio

```console
$ npm run studio:dev
[assay-dev] Studio  http://127.0.0.1:3400/studio
[assay-dev] API     http://127.0.0.1:8455/health
[assay-dev] Fake providers + dev payment gate; no API keys or funds required.
✓ Ready

$ curl http://127.0.0.1:8455/health
{"ok":true,"service":"assay-mcp","version":"1.0.0","standardVersion":"AS-1.1.0",
"paymentMode":"dev","seals":{"pending":0,"oldestAgeMs":0,"alert":false}}

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3400/studio
200
```

The stack was then stopped cleanly; the MCP process logged `shutting down…`.

## Result

**PASS.** A fresh clone installs, renders a real Chromium PDF, parses it back at 100%, preserves an
honest AS-1.1 failure, emits the complete local artifact family, and serves the fake-mode Studio
without provider credentials, a wallet, or funds.
