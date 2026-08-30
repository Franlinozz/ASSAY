"""Consensus integration scenarios; requires configured GenLayer Studio/localnet."""

import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded


PUBLIC_README = "https://raw.githubusercontent.com/Franlinozz/ASSAY/main/README.md"


@pytest.fixture(scope="module")
def adjudicator():
    contract = get_contract_factory("AssayAdjudicator").deploy()
    assert contract.get_adjudication(args=["missing"]).call() == {}
    return contract


@pytest.mark.integration
def test_supported_public_evidence_reaches_consensus(adjudicator):
    receipt = adjudicator.adjudicate(
        args=[
            "integration-supported",
            "Assay exposes asy_verify as a free verification tool.",
            "COMPETENCY_DEMONSTRATION",
            "AS-1.1.0",
            [PUBLIC_README],
        ],
    ).transact(wait_interval=10_000, wait_retries=30)
    assert tx_execution_succeeded(receipt)
    stored = adjudicator.get_adjudication(args=["integration-supported"]).call()
    assert stored["verdict"] == "SUPPORTED"
    assert stored["sourceCount"] == 1


@pytest.mark.integration
def test_unrelated_claim_is_not_supported(adjudicator):
    receipt = adjudicator.adjudicate(
        args=[
            "integration-negative",
            "The Assay repository documents a crewed mission to Mars.",
            "ACTION_AND_OUTCOME",
            "AS-1.1.0",
            [PUBLIC_README],
        ],
    ).transact(wait_interval=10_000, wait_retries=30)
    assert tx_execution_succeeded(receipt)
    stored = adjudicator.get_adjudication(args=["integration-negative"]).call()
    assert stored["verdict"] in ("INSUFFICIENT", "CONTRADICTED")


@pytest.mark.integration
def test_consensus_result_remains_readable(adjudicator):
    receipt = adjudicator.adjudicate(
        args=[
            "integration-readable",
            "Assay uses X Layer to seal dossier integrity.",
            "ACTION_AND_OUTCOME",
            "AS-1.1.0",
            [PUBLIC_README],
        ],
    ).transact(wait_interval=10_000, wait_retries=30)
    assert tx_execution_succeeded(receipt)
    assert adjudicator.has_adjudication(args=["integration-readable"]).call() is True
    assert (
        adjudicator.get_adjudication(args=["integration-readable"]).call()["claimKey"]
        == "integration-readable"
    )
