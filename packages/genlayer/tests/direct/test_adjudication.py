"""Direct-mode verdict, persistence, and substantive-validator tests."""

from tests.direct.conftest import (
    SECOND_URL,
    SUPPORTED_URL,
    adjudicate,
    mock_source,
    mock_verdict,
)


def test_supported_result_is_persisted(direct_vm, adjudicator):
    mock_source(direct_vm)
    mock_verdict(direct_vm, "SUPPORTED")

    result = adjudicate(adjudicator)

    assert result["verdict"] == "SUPPORTED"
    assert result["reasonCode"] == "EVIDENCE_SUPPORTS_CLAIM"
    assert result["sourceCount"] == 1
    assert result["unavailableCount"] == 0
    assert adjudicator.get_adjudication("claim-001")["verdict"] == "SUPPORTED"
    assert adjudicator.has_adjudication("claim-001") is True


def test_partial_numeric_claim_is_not_upgraded(direct_vm, adjudicator):
    mock_source(
        direct_vm,
        body="The change introduced PostgreSQL connection pooling but publishes no benchmark.",
    )
    mock_verdict(direct_vm, "PARTIAL", "The intervention is shown but the 38% is not.")

    result = adjudicate(adjudicator, key="claim-partial")

    assert result["verdict"] == "PARTIAL"
    assert result["reasonCode"] == "EVIDENCE_PARTIALLY_SUPPORTS_CLAIM"


def test_unrelated_evidence_is_insufficient(direct_vm, adjudicator):
    mock_source(direct_vm, body="This page documents the repository license and brand colors.")
    mock_verdict(direct_vm, "INSUFFICIENT", "The source does not address the claim.")

    result = adjudicate(adjudicator, key="claim-insufficient")

    assert result["verdict"] == "INSUFFICIENT"
    assert result["reasonCode"] == "EVIDENCE_INSUFFICIENT"


def test_contradicting_evidence_is_preserved(direct_vm, adjudicator):
    mock_source(
        direct_vm,
        body="The benchmark reports latency increased by 12 percent after pooling was enabled.",
    )
    mock_verdict(direct_vm, "CONTRADICTED", "The published result conflicts with the claim.")

    result = adjudicate(adjudicator, key="claim-contradicted")

    assert result["verdict"] == "CONTRADICTED"
    assert result["reasonCode"] == "EVIDENCE_CONTRADICTS_CLAIM"


def test_one_unavailable_source_is_counted_not_hidden(direct_vm, adjudicator):
    mock_source(direct_vm, SUPPORTED_URL)
    mock_verdict(direct_vm, "SUPPORTED")

    result = adjudicate(
        adjudicator,
        key="claim-one-unavailable",
        urls=[SUPPORTED_URL, SECOND_URL],
    )

    assert result["sourceCount"] == 1
    assert result["unavailableCount"] == 1


def test_validator_independently_disagrees_on_substance(direct_vm, adjudicator):
    mock_source(direct_vm)
    mock_verdict(direct_vm, "SUPPORTED")
    adjudicate(adjudicator, key="claim-validator")

    direct_vm.clear_mocks()
    mock_source(direct_vm)
    mock_verdict(direct_vm, "PARTIAL", "The metric is not independently substantiated.")

    assert direct_vm.run_validator() is False


def test_validator_accepts_same_decision_with_different_prose(direct_vm, adjudicator):
    mock_source(direct_vm)
    mock_verdict(direct_vm, "SUPPORTED", "Leader wording.")
    adjudicate(adjudicator, key="claim-validator-prose")

    direct_vm.clear_mocks()
    mock_source(direct_vm)
    mock_verdict(direct_vm, "SUPPORTED", "Validator wording can differ.")

    assert direct_vm.run_validator() is True


def test_duplicate_claim_key_cannot_overwrite_consensus(direct_vm, adjudicator):
    mock_source(direct_vm)
    mock_verdict(direct_vm, "SUPPORTED")
    adjudicate(adjudicator, key="claim-duplicate")

    with direct_vm.expect_revert("Adjudication already exists"):
        adjudicate(adjudicator, key="claim-duplicate")
