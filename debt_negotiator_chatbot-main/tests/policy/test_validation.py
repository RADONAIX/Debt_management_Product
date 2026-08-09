"""Phase 1 exit criterion, half two: no invalid agreement can be *approved*."""

from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st

from domain.agreement import Agreement, AgreementDelta
from policy.envelope import Envelope
from policy.validation import (
    ViolationCode,
    validate_agreement,
    validate_delta,
    validate_terminal,
)
from tests.strategies import agreements, envelopes


@given(raw=agreements, envelope=envelopes())
def test_approval_implies_within_envelope(
    raw: dict[str, int], envelope: Envelope
) -> None:
    """The exit criterion, stated as a property.

    If validation approves, every field is on-grid (guaranteed by construction)
    *and* inside the envelope. There is no approving path that skips a field.
    """
    agreement = Agreement(**raw)
    result = validate_agreement(agreement, envelope)

    if result.approved:
        assert agreement.disc_ratio <= envelope.max_disc_ratio
        assert agreement.pmt_ratio >= envelope.min_pmt_ratio
        assert agreement.pmt_days <= envelope.max_pmt_days
        assert agreement.inst_prds in envelope.allowed_inst_prds
        assert result.violations == ()


@given(raw=agreements, envelope=envelopes())
def test_rejection_names_every_offending_field(
    raw: dict[str, int], envelope: Envelope
) -> None:
    """The converse: anything outside the envelope is reported, not silently
    dropped. §5.6 regenerates against these violations, so a missing one would
    send the model back with incomplete feedback."""
    agreement = Agreement(**raw)
    result = validate_agreement(agreement, envelope)

    expected = set()
    if agreement.disc_ratio > envelope.max_disc_ratio:
        expected.add("disc_ratio")
    if agreement.pmt_ratio < envelope.min_pmt_ratio:
        expected.add("pmt_ratio")
    if agreement.pmt_days > envelope.max_pmt_days:
        expected.add("pmt_days")
    if agreement.inst_prds not in envelope.allowed_inst_prds:
        expected.add("inst_prds")

    assert {v.field for v in result.violations} == expected
    assert result.approved is (not expected)


@given(raw=agreements, envelope=envelopes())
def test_feedback_is_non_empty_exactly_when_rejected(
    raw: dict[str, int], envelope: Envelope
) -> None:
    result = validate_agreement(Agreement(**raw), envelope)
    assert bool(result.feedback()) is (not result.approved)


@given(
    raw=agreements,
    envelope=envelopes(),
    drop=st.sets(
        st.sampled_from(["disc_ratio", "pmt_ratio", "pmt_days", "inst_prds"]),
        min_size=1,
    ),
)
def test_incomplete_proposal_never_closes_a_negotiation(
    raw: dict[str, int], envelope: Envelope, drop: set[str]
) -> None:
    """§3.1: success requires all four fields specified."""
    partial = AgreementDelta(**{k: v for k, v in raw.items() if k not in drop})
    result = validate_terminal(partial, envelope)

    assert result.approved is False
    assert any(v.code is ViolationCode.INCOMPLETE_AGREEMENT for v in result.violations)


@given(raw=agreements, envelope=envelopes())
def test_unset_delta_fields_are_not_treated_as_concessions(
    raw: dict[str, int], envelope: Envelope
) -> None:
    """An omitted field is unagreed. It must not be scored against the envelope
    as if it were zero, which would fabricate a violation (or, worse for a
    ratio floor, fabricate an approval)."""
    empty = AgreementDelta()
    assert validate_delta(empty, envelope).approved is True

    single = AgreementDelta(disc_ratio=raw["disc_ratio"])
    result = validate_delta(single, envelope)
    assert {v.field for v in result.violations} <= {"disc_ratio"}
