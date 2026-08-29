"""Shared direct-mode fixtures for AssayAdjudicator."""

import json
from pathlib import Path

import pytest


CONTRACT_PATH = Path(__file__).resolve().parents[2] / "contracts/assay_adjudicator.py"
STANDARD_VERSION = "AS-1.1.0"
SUPPORTED_URL = "https://github.com/Franlinozz/ASSAY/pull/184"
SECOND_URL = "https://raw.githubusercontent.com/Franlinozz/ASSAY/main/README.md"


@pytest.fixture
def adjudicator(direct_deploy):
    return direct_deploy(CONTRACT_PATH)


def mock_source(vm, url=SUPPORTED_URL, body=None):
    text = body or (
        "Pull request 184 introduced PostgreSQL connection pooling. "
        "The attached benchmark records API p95 latency falling by 38 percent."
    )
    pattern = url.replace(".", r"\.").replace("/", r"\/")
    vm.mock_web(pattern, {"status": 200, "body": text})


def mock_verdict(vm, verdict, reason="The evidence matches the stated claim."):
    vm.mock_llm(
        r".*ASSAY ADJUDICATOR.*",
        json.dumps({"verdict": verdict, "shortReason": reason}),
    )


def adjudicate(contract, key="claim-001", urls=None):
    return contract.adjudicate(
        key,
        "Reduced API p95 latency by 38% by introducing PostgreSQL connection pooling.",
        "QUANTIFIED_OUTCOME",
        STANDARD_VERSION,
        urls or [SUPPORTED_URL],
    )
