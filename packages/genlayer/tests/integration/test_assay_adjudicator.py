"""Consensus integration scenarios; requires configured GenLayer Studio/localnet."""

import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.helpers import load_fixture


PUBLIC_README = "https://raw.githubusercontent.com/Franlinozz/ASSAY/main/README.md"


@pytest.mark.integration
def deploy_adjudicator():
    contract = get_contract_factory("AssayAdjudicator").deploy()
    assert contract.get_adjudication(args=["missing"]) == {}
    return contract


@pytest.mark.integration
def test_supported_public_evidence_reaches_consensus():
    contract = load_fixture(deploy_adjudicator)
    receipt = contract.adjudicate(
        args=[
            "integration-supported",
            "Assay exposes asy_verify as a free verification tool.",
            "COMPETENCY_DEMONSTRATION",
            "AS-1.1.0",
            [PUBLIC_README],
        ],
        wait_interval=10_000,
        wait_retries=30,
    )
    assert tx_execution_succeeded(receipt)
    stored = contract.get_adjudication(args=["integration-supported"])
    assert stored["verdict"] == "SUPPORTED"
    assert stored["sourceCount"] == 1


@pytest.mark.integration
def test_unrelated_claim_is_not_supported():
    contract = load_fixture(deploy_adjudicator)
    receipt = contract.adjudicate(
        args=[
            "integration-negative",
            "The Assay repository documents a crewed mission to Mars.",
            "ACTION_AND_OUTCOME",
            "AS-1.1.0",
            [PUBLIC_README],
        ],
        wait_interval=10_000,
        wait_retries=30,
    )
    assert tx_execution_succeeded(receipt)
    stored = contract.get_adjudication(args=["integration-negative"])
    assert stored["verdict"] in ("INSUFFICIENT", "CONTRADICTED")


@pytest.mark.integration
def test_consensus_result_remains_readable():
    contract = load_fixture(deploy_adjudicator)
    receipt = contract.adjudicate(
        args=[
            "integration-readable",
            "Assay uses X Layer to seal dossier integrity.",
            "ACTION_AND_OUTCOME",
            "AS-1.1.0",
            [PUBLIC_README],
        ],
        wait_interval=10_000,
        wait_retries=30,
    )
    assert tx_execution_succeeded(receipt)
    assert contract.has_adjudication(args=["integration-readable"]) is True
    assert (
        contract.get_adjudication(args=["integration-readable"])["claimKey"]
        == "integration-readable"
    )
