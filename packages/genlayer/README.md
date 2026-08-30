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

The reviewed contract is deployed to GenLayer Testnet Bradbury at
[`0xa0A37DEf…1B96E`](https://explorer-bradbury.genlayer.com/address/0xa0A37DEf61d5C621FDeF43b604D8059779D1B96E).
See [`docs/GENLAYER-BRADBURY.md`](../../docs/GENLAYER-BRADBURY.md) for the source hash, deployment
transaction, accepted adjudications, failed-closed fixture, and measured testnet cost. Never put a
private key in this directory, a command argument, committed config, or logs.
