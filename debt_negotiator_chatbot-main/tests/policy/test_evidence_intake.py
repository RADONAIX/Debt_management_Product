"""The evidence barrier — the security property of Phase 3.

Phase 1 proved the policy engine cannot be argued out of its envelope. That is
worth nothing if the thing feeding it evidence can be talked into inventing
some. These tests are the other half.
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from domain.evidence import EvidenceKind, HardshipTier
from policy.envelope import compute_envelope
from policy.evidence_intake import (
    SOFT_EVIDENCE,
    VERIFIED_ONLY_EVIDENCE,
    EvidenceIntakeError,
    EvidenceSource,
    EvidenceSubmission,
    accept,
    filter_chat_claims,
)
from policy.hardship import max_discount_for
from policy.ladder import apply_all
from tests.strategies import ACCOUNT


@pytest.mark.parametrize("kind", sorted(VERIFIED_ONLY_EVIDENCE))
def test_chat_can_never_assert_verified_evidence(kind: EvidenceKind) -> None:
    """The core barrier. An LLM reading a sentence has not seen a document."""
    with pytest.raises(EvidenceIntakeError):
        accept(
            EvidenceSubmission(
                kind=kind, source=EvidenceSource.CHAT_EXTRACTION, turn_index=3
            )
        )


@pytest.mark.parametrize("kind", sorted(SOFT_EVIDENCE))
def test_chat_may_assert_soft_evidence(kind: EvidenceKind) -> None:
    event = accept(
        EvidenceSubmission(
            kind=kind, source=EvidenceSource.CHAT_EXTRACTION, turn_index=3
        )
    )
    assert event.kind is kind


def test_verified_evidence_requires_a_verifier_identity() -> None:
    """Unattributed verification is indistinguishable from an assertion, and §7
    requires the audit to answer who stood behind it."""
    for verifier in (None, "", "   "):
        with pytest.raises(EvidenceIntakeError):
            accept(
                EvidenceSubmission(
                    kind=EvidenceKind.SEVERE_HARDSHIP_DOCUMENTED,
                    source=EvidenceSource.VERIFIED_UPLOAD,
                    turn_index=1,
                    verified_by=verifier,
                )
            )

    admitted = accept(
        EvidenceSubmission(
            kind=EvidenceKind.SEVERE_HARDSHIP_DOCUMENTED,
            source=EvidenceSource.VERIFIED_UPLOAD,
            turn_index=1,
            verified_by="ops-4471",
        )
    )
    assert admitted.kind is EvidenceKind.SEVERE_HARDSHIP_DOCUMENTED


def test_new_evidence_kinds_default_to_verified_only() -> None:
    """VERIFIED_ONLY is derived by subtraction, so forgetting to classify a new
    kind fails closed — a refused disclosure, never a free discount."""
    assert frozenset(EvidenceKind) == SOFT_EVIDENCE | VERIFIED_ONLY_EVIDENCE
    assert frozenset() == SOFT_EVIDENCE & VERIFIED_ONLY_EVIDENCE


# --------------------------------------------------------------------------
# the extractor's output is untrusted input
# --------------------------------------------------------------------------


@given(
    claims=st.lists(
        st.one_of(
            st.sampled_from([e.value for e in EvidenceKind]),
            st.text(max_size=30),
        ),
        max_size=12,
    )
)
def test_extractor_output_can_never_produce_a_discount(claims: list[str]) -> None:
    """The property that matters.

    Whatever the extractor returns — every verified tier at once, junk strings,
    a prompt-injected list — the resulting envelope still permits a 0% discount
    and nothing more. The debtor cannot talk their way to a discount, and
    neither can a compromised extractor.
    """
    events = filter_chat_claims(claims, turn_index=2)
    envelope = compute_envelope(ACCOUNT, apply_all(events))

    assert envelope.max_disc_ratio == 0
    assert envelope.hardship_tier in (HardshipTier.NONE, HardshipTier.CLAIMED)
    assert envelope.max_disc_ratio <= max_discount_for(envelope.hardship_tier)


@given(claims=st.lists(st.text(max_size=40), max_size=10))
def test_extractor_junk_is_dropped_not_raised(claims: list[str]) -> None:
    """A model naming a tier it may not assert is expected, not exceptional. It
    must not be able to abort a live turn by saying the wrong word."""
    events = filter_chat_claims(claims, turn_index=0)
    assert all(e.kind in SOFT_EVIDENCE for e in events)


def test_extractor_claiming_every_verified_tier_yields_nothing() -> None:
    """The explicit adversarial case."""
    events = filter_chat_claims([k.value for k in VERIFIED_ONLY_EVIDENCE], turn_index=1)
    assert events == ()


def test_soft_evidence_still_loosens_the_non_discount_axes() -> None:
    """The barrier is not a blanket refusal — behavioural evidence legitimately
    moves upfront and the payment window. It just never moves the discount."""
    events = filter_chat_claims(
        [EvidenceKind.LIQUIDITY_CONSTRAINED.value], turn_index=1
    )
    envelope = compute_envelope(ACCOUNT, apply_all(events))

    assert envelope.max_disc_ratio == 0
    assert envelope.min_pmt_ratio < 25  # upfront did move
