# AssayAdjudicator

`AssayAdjudicator` is Assay's GenLayer Intelligent Contract for consensus adjudication of bounded
professional claims against user-approved public evidence. It does not ingest private documents,
replace the deterministic Assay Tribunal, change X Layer sealing, or alter OKX.AI/x402 payments.

## Local checks

Prerequisites: Python 3.12 and the current GenLayer CLI.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
. .venv/bin/activate
npm run lint:contract
npm run test:direct
```

Integration tests require a configured GenLayer Studio/localnet:

```bash
npm run test:integration
```

## Deployment

Deployment is intentionally not part of the contract phase. After review and explicit approval,
select the target network with the current CLI and run `npm run deploy`. Never put a private key in
this directory, a command argument, committed config, or logs.
