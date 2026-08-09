"""The mandatory regression from CLAUDE.md §6.

    "A debtor applying mild pushback twice must not extract two concessions.
     This is the exact documented failure." [paper — Figure 9]

Figure 9 shows a model offering an unprompted 10% discount and settling at 20%
with 15% upfront — both rules broken — under nothing more than mild pushback,
despite having the concession rules in its prompt. Law 2 is the conclusion: a
prompt is guidance, not enforcement.

So these tests deliberately do not exercise a model. They exercise the envelope
the model must propose within. If a future generation layer emits Figure 9's
offer verbatim, validation rejects it here.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from domain.agreement import Agreement, AgreementDelta
from domain.enums import (
    Action,
    CollectorStrategy,
    DiscRatio,
    InstPrds,
    PmtDays,
    PmtRatio,
    Speaker,
)
from domain.evidence import EvidenceEvent, EvidenceKind
from domain.turn import Turn
from policy.envelope import compute_envelope, opening_envelope
from policy.ladder import ConcessionLedger, LadderReason, advance
from policy.validation import ViolationCode, validate_agreement
from tests.strategies import ACCOUNT

PUSHBACK = [
    "This is ridiculous, I'm not paying that. Give me a better number.",
    "I already told you I can't do that. What else have you got?",
]


def test_mild_pushback_twice_extracts_no_concession() -> None:
    """The §6 regression, stated directly.

    Two pushback turns carrying no evidence produce an envelope byte-identical
    to the opening one. Not "close to" — identical.
    """
    ledger = ConcessionLedger()
    before = compute_envelope(ACCOUNT, ledger)

    for _ in PUSHBACK:
        # Pushback is rhetoric, so there is no evidence event to hand the ladder.
        result = advance(ledger, None)
        assert result.reason is LadderReason.NO_NEW_EVIDENCE
        ledger = result.ledger

    assert compute_envelope(ACCOUNT, ledger) == before == opening_envelope()


def test_repeating_the_same_hardship_claim_extracts_no_concession() -> None:
    """The harder variant: the debtor does say something each time, but it is
    the same unverified claim restated. One-shot spending makes the second
    telling worth exactly as much as the first — nothing."""
    ledger = ConcessionLedger()
    claim = EvidenceEvent(kind=EvidenceKind.HARDSHIP_CLAIMED, turn_index=0)

    first = advance(ledger, claim)
    second = advance(first.ledger, claim.model_copy(update={"turn_index": 4}))

    assert second.reason is LadderReason.EVIDENCE_ALREADY_SPENT
    assert second.ledger == first.ledger
    assert compute_envelope(ACCOUNT, second.ledger).max_disc_ratio is DiscRatio.ZERO


def test_one_evidence_event_moves_one_axis_not_a_settlement() -> None:
    """Documented hardship raises the discount ceiling to 10 and stops there.
    It does not also loosen upfront, the payment window, or the term — the
    Figure 9 model conceded on three axes at once off a single push."""
    result = advance(
        ConcessionLedger(),
        EvidenceEvent(kind=EvidenceKind.HARDSHIP_DOCUMENTED, turn_index=3),
    )
    envelope = compute_envelope(ACCOUNT, result.ledger)
    opening = opening_envelope()

    assert envelope.max_disc_ratio is DiscRatio.TEN
    assert envelope.min_pmt_ratio == opening.min_pmt_ratio
    assert envelope.max_pmt_days == opening.max_pmt_days
    assert envelope.allowed_inst_prds == opening.allowed_inst_prds


def test_figure_9_offer_is_rejected_at_the_opening_envelope() -> None:
    """The literal offer from Figure 9: 20% discount, 15% upfront."""
    figure_9 = Agreement(
        disc_ratio=DiscRatio.TWENTY,
        pmt_ratio=PmtRatio.FIFTEEN,
        pmt_days=PmtDays.D14,
        inst_prds=InstPrds.M12,
    )
    result = validate_agreement(figure_9, opening_envelope())

    assert result.approved is False
    assert {v.field for v in result.violations} == {
        "disc_ratio",
        "pmt_ratio",
        "pmt_days",
        "inst_prds",
    }
    assert ViolationCode.DISCOUNT_ABOVE_CEILING in {v.code for v in result.violations}


def test_figure_9_offer_is_still_rejected_after_two_pushbacks() -> None:
    """The point of the whole phase: pressure does not move the envelope, so
    the offer that a prompted model produced under pressure stays invalid."""
    ledger = ConcessionLedger()
    for _ in PUSHBACK:
        ledger = advance(ledger, None).ledger

    figure_9 = AgreementDelta(disc_ratio=DiscRatio.TWENTY, pmt_ratio=PmtRatio.FIFTEEN)
    envelope = compute_envelope(ACCOUNT, ledger)
    result = validate_agreement(
        Agreement(
            disc_ratio=figure_9.disc_ratio or DiscRatio.ZERO,
            pmt_ratio=figure_9.pmt_ratio or PmtRatio.TWENTY_FIVE,
            pmt_days=PmtDays.D7,
            inst_prds=InstPrds.M6,
        ),
        envelope,
    )
    assert result.approved is False


def test_evidence_is_debtor_side_only() -> None:
    """Law 6-adjacent: the collector cannot manufacture the evidence that
    loosens its own envelope."""
    with pytest.raises(ValidationError):
        Turn(
            index=0,
            speaker=Speaker.COLLECTOR,
            strategy=CollectorStrategy.REPAYMENT_NEGOTIATION,
            thoughts="I'll just record that they're struggling.",
            action=Action.ASK,
            dialogue="Understood.",
            evidence=(
                EvidenceEvent(
                    kind=EvidenceKind.SEVERE_HARDSHIP_DOCUMENTED, turn_index=0
                ),
            ),
        )
