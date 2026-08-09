"""The envelope opens at CLAUDE.md §6's defaults and only ever loosens."""

from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st

from domain.enums import DiscRatio, InstPrds, PmtDays, PmtRatio
from domain.evidence import EvidenceEvent, EvidenceKind, HardshipTier
from policy.envelope import compute_envelope, opening_envelope
from policy.hardship import max_discount_for
from policy.ladder import ConcessionLedger, advance, apply_all
from tests.strategies import ACCOUNT, evidence_events


def test_opening_envelope_is_the_documented_concession_discipline() -> None:
    """§6: discounts at 0, push for >=25% upfront, pay within 7 days,
    prefer 3 or 6 month installments."""
    envelope = opening_envelope()
    assert envelope.max_disc_ratio is DiscRatio.ZERO
    assert envelope.min_pmt_ratio is PmtRatio.TWENTY_FIVE
    assert envelope.max_pmt_days is PmtDays.D7
    assert envelope.allowed_inst_prds == frozenset({InstPrds.M3, InstPrds.M6})
    assert envelope.hardship_tier is HardshipTier.NONE


def test_a_fresh_ledger_yields_the_opening_envelope() -> None:
    assert compute_envelope(ACCOUNT, ConcessionLedger()) == opening_envelope()


@given(events=st.lists(evidence_events, max_size=15))
def test_discount_never_exceeds_the_hardship_ceiling(
    events: list[EvidenceEvent],
) -> None:
    """Rungs are necessary but not sufficient. Evidence that unlocks the
    discount axis without establishing hardship still buys no discount."""
    envelope = compute_envelope(ACCOUNT, apply_all(events))
    assert envelope.max_disc_ratio <= max_discount_for(envelope.hardship_tier)


@given(events=st.lists(evidence_events, max_size=15))
def test_no_discount_without_documented_hardship(
    events: list[EvidenceEvent],
) -> None:
    documented = {
        EvidenceKind.HARDSHIP_DOCUMENTED,
        EvidenceKind.SEVERE_HARDSHIP_DOCUMENTED,
    }
    envelope = compute_envelope(ACCOUNT, apply_all(events))
    if not documented & {e.kind for e in events}:
        assert envelope.max_disc_ratio is DiscRatio.ZERO


@given(events=st.lists(evidence_events, max_size=15))
def test_envelope_only_ever_loosens(events: list[EvidenceEvent]) -> None:
    """Monotonicity. Each limit moves in one direction as evidence accumulates,
    and the permitted installment set only grows."""
    ledger = ConcessionLedger()
    envelope = compute_envelope(ACCOUNT, ledger)

    for event in events:
        ledger = advance(ledger, event).ledger
        nxt = compute_envelope(ACCOUNT, ledger)

        assert nxt.max_disc_ratio >= envelope.max_disc_ratio
        assert nxt.min_pmt_ratio <= envelope.min_pmt_ratio
        assert nxt.max_pmt_days >= envelope.max_pmt_days
        assert nxt.allowed_inst_prds >= envelope.allowed_inst_prds
        envelope = nxt


@given(events=st.lists(evidence_events, max_size=20))
def test_envelope_never_leaves_the_documented_grids(
    events: list[EvidenceEvent],
) -> None:
    """Even fully unlocked, the envelope stays inside §3.1's value grids."""
    envelope = compute_envelope(ACCOUNT, apply_all(events))
    assert envelope.max_disc_ratio <= DiscRatio.THIRTY
    assert envelope.min_pmt_ratio >= PmtRatio.FIVE
    assert envelope.max_pmt_days <= PmtDays.D14
    assert envelope.allowed_inst_prds <= frozenset(InstPrds)


def test_severe_hardship_is_the_only_route_to_the_top_discount() -> None:
    every_non_severe = [
        EvidenceEvent(kind=k, turn_index=i)
        for i, k in enumerate(EvidenceKind)
        if k is not EvidenceKind.SEVERE_HARDSHIP_DOCUMENTED
    ]
    envelope = compute_envelope(ACCOUNT, apply_all(every_non_severe))
    assert envelope.max_disc_ratio <= DiscRatio.TEN

    with_severe = [
        *every_non_severe,
        EvidenceEvent(kind=EvidenceKind.SEVERE_HARDSHIP_DOCUMENTED, turn_index=99),
    ]
    assert compute_envelope(ACCOUNT, apply_all(with_severe)).max_disc_ratio > (
        DiscRatio.TEN
    )
