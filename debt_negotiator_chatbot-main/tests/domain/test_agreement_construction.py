"""Phase 1 exit criterion, half one: no invalid agreement can be *constructed*.

CLAUDE.md §3.1: "Enum-constrained. Reject off-grid values — no rounding, no
coercion."
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from domain.agreement import Agreement, AgreementDelta
from domain.enums import DiscRatio, InstPrds, PmtDays, PmtRatio

GRIDS = {
    "disc_ratio": {int(v) for v in DiscRatio},
    "pmt_ratio": {int(v) for v in PmtRatio},
    "pmt_days": {int(v) for v in PmtDays},
    "inst_prds": {int(v) for v in InstPrds},
}


@given(
    disc_ratio=st.integers(min_value=-50, max_value=150),
    pmt_ratio=st.integers(min_value=-50, max_value=150),
    pmt_days=st.integers(min_value=-50, max_value=150),
    inst_prds=st.integers(min_value=-50, max_value=150),
)
def test_agreement_constructible_iff_every_field_on_grid(
    disc_ratio: int, pmt_ratio: int, pmt_days: int, inst_prds: int
) -> None:
    raw = {
        "disc_ratio": disc_ratio,
        "pmt_ratio": pmt_ratio,
        "pmt_days": pmt_days,
        "inst_prds": inst_prds,
    }
    on_grid = all(v in GRIDS[k] for k, v in raw.items())

    if on_grid:
        agreement = Agreement(**raw)
        # And nothing was silently altered on the way in.
        assert {k: int(getattr(agreement, k)) for k in raw} == raw
    else:
        with pytest.raises(ValidationError):
            Agreement(**raw)


@given(st.floats(min_value=0, max_value=30).filter(lambda f: f % 1 != 0))
def test_fractional_values_are_rejected_not_rounded(value: float) -> None:
    with pytest.raises(ValidationError):
        Agreement(disc_ratio=value, pmt_ratio=25, pmt_days=7, inst_prds=6)


def test_delta_does_not_become_an_agreement_by_omission() -> None:
    """An unspecified term is unagreed, not zero."""
    delta = AgreementDelta(disc_ratio=DiscRatio.ZERO, pmt_ratio=PmtRatio.TWENTY_FIVE)
    assert delta.to_agreement() is None


def test_delta_promotes_only_when_complete() -> None:
    delta = AgreementDelta(
        disc_ratio=DiscRatio.ZERO,
        pmt_ratio=PmtRatio.TWENTY_FIVE,
        pmt_days=PmtDays.D7,
        inst_prds=InstPrds.M6,
    )
    agreement = delta.to_agreement()
    assert agreement == Agreement(
        disc_ratio=DiscRatio.ZERO,
        pmt_ratio=PmtRatio.TWENTY_FIVE,
        pmt_days=PmtDays.D7,
        inst_prds=InstPrds.M6,
    )


def test_agreement_is_frozen() -> None:
    agreement = Agreement(
        disc_ratio=DiscRatio.ZERO,
        pmt_ratio=PmtRatio.TWENTY_FIVE,
        pmt_days=PmtDays.D7,
        inst_prds=InstPrds.M6,
    )
    with pytest.raises(ValidationError):
        agreement.disc_ratio = DiscRatio.THIRTY  # type: ignore[misc]


def test_collector_turn_must_carry_a_strategy() -> None:
    """Law 4: an unlabelled collector turn is a bug."""
    from domain.enums import Action, Speaker
    from domain.turn import Turn

    with pytest.raises(ValidationError):
        Turn(
            index=0,
            speaker=Speaker.COLLECTOR,
            strategy=None,
            thoughts="",
            action=Action.ASK,
            dialogue="...",
        )


def test_real_debtor_turn_may_have_no_strategy() -> None:
    """§3.3 makes the eight debtor strategies simulator-only. A live debtor has
    no label, and inventing one would put fiction in the audit record."""
    from domain.enums import Action, Speaker
    from domain.turn import Turn

    turn = Turn(
        index=1,
        speaker=Speaker.DEBTOR,
        strategy=None,
        thoughts="",
        action=Action.ASK,
        dialogue="I can't pay that.",
    )
    assert turn.strategy is None
