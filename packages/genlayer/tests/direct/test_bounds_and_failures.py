"""Fail-closed input, source, and model-output tests."""

import pytest

from tests.direct.conftest import STANDARD_VERSION, SUPPORTED_URL, adjudicate, mock_verdict


def call(
    adjudicator,
    *,
    key="claim-bounds",
    claim="A concrete claim.",
    criterion="ACTION_AND_OUTCOME",
    urls=None,
    version=STANDARD_VERSION,
):
    return adjudicator.adjudicate(
        key,
        claim,
        criterion,
        version,
        urls or [SUPPORTED_URL],
    )


def test_all_sources_unavailable_fails_without_a_verdict(direct_vm, adjudicator):
    mock_verdict(direct_vm, "INSUFFICIENT")

    with direct_vm.expect_revert("No public evidence source was available"):
        call(adjudicator, key="claim-unavailable")

    assert adjudicator.has_adjudication("claim-unavailable") is False


def test_non_https_url_is_rejected_before_nondeterminism(direct_vm, adjudicator):
    with direct_vm.expect_revert("must use HTTPS"):
        call(adjudicator, urls=["http://github.com/Franlinozz/ASSAY"])


def test_unapproved_host_is_rejected(direct_vm, adjudicator):
    with direct_vm.expect_revert("host is not approved"):
        call(adjudicator, urls=["https://example.com/evidence"])


def test_excessive_source_count_is_rejected(direct_vm, adjudicator):
    urls = [f"https://github.com/Franlinozz/ASSAY/issues/{i}" for i in range(4)]
    with direct_vm.expect_revert("between one and three"):
        call(adjudicator, urls=urls)


def test_oversized_claim_is_rejected(direct_vm, adjudicator):
    with direct_vm.expect_revert("Claim text length is invalid"):
        call(adjudicator, claim="x" * 801)


def test_unknown_criterion_is_rejected(direct_vm, adjudicator):
    with direct_vm.expect_revert("Unsupported adjudication criterion"):
        call(adjudicator, criterion="USER_SUPPLIED_PROMPT")


def test_wrong_standard_version_is_rejected(direct_vm, adjudicator):
    with direct_vm.expect_revert("Unsupported Assay Standard version"):
        call(adjudicator, version="AS-9.9.9")


def test_malformed_llm_result_does_not_commit(direct_vm, adjudicator):
    direct_vm.mock_web(r".*github.*", {"status": 200, "body": "Public evidence"})
    direct_vm.mock_llm(r".*ASSAY ADJUDICATOR.*", '{"answer":"maybe"}')

    with pytest.raises(Exception):
        adjudicate(adjudicator, key="claim-malformed")

    assert adjudicator.has_adjudication("claim-malformed") is False


def test_supported_criteria_are_contract_owned(adjudicator):
    criteria = adjudicator.get_supported_criteria()
    assert set(criteria) == {
        "ACTION_AND_OUTCOME",
        "QUANTIFIED_OUTCOME",
        "ROLE_AND_SCOPE",
        "COMPETENCY_DEMONSTRATION",
    }
