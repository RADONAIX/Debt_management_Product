"""The ladder is evidence-gated and one-shot."""

from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st

from domain.evidence import EvidenceEvent, EvidenceKind, HardshipTier
from policy.envelope import compute_envelope, opening_envelope
from policy.ladder import (
    EVIDENCE_UNLOCKS,
    MAX_RUNGS,
    ConcessionAxis,
    ConcessionLedger,
    LadderReason,
    advance,
    apply_all,
)
from tests.strategies import ACCOUNT, evidence_events


@given(events=st.lists(evidence_events, max_size=15))
def test_ledger_depends_only_on_the_set_of_evidence_kinds(
    events: list[EvidenceEvent],
) -> None:
    """Order-independent and repeat-immune.

    Replaying, reordering, or padding the transcript cannot change the ledger —
    only which distinct kinds of evidence appeared at all.
    """
    shuffled = list(reversed(events)) + events  # reordered *and* duplicated
    assert apply_all(events) == apply_all(shuffled)


@given(event=evidence_events)
def test_replaying_spent_evidence_is_a_no_op(event: EvidenceEvent) -> None:
    first = advance(ConcessionLedger(), event)
    second = advance(first.ledger, event)

    assert second.ledger == first.ledger
    assert second.reason is LadderReason.EVIDENCE_ALREADY_SPENT


@given(ledger=st.builds(apply_all, st.lists(evidence_events, max_size=8)))
def test_no_evidence_moves_nothing(ledger: ConcessionLedger) -> None:
    """The debtor pushes back but discloses nothing new."""
    result = advance(ledger, None)
    assert result.ledger == ledger
    assert result.reason is LadderReason.NO_NEW_EVIDENCE
    assert result.axes_moved == frozenset()


def test_claiming_hardship_unlocks_nothing() -> None:
    """Finding ②: models concede to pressure. Assertion is not evidence."""
    result = advance(
        ConcessionLedger(),
        EvidenceEvent(kind=EvidenceKind.HARDSHIP_CLAIMED, turn_index=2),
    )

    assert result.reason is LadderReason.UNLOCKS_NOTHING
    assert result.axes_moved == frozenset()
    # Recorded, so the audit shows it was heard and it cannot be spent twice.
    assert EvidenceKind.HARDSHIP_CLAIMED in result.ledger.spent_evidence

    # The tier moves to CLAIMED for the audit record; not one limit moves with it.
    envelope = compute_envelope(ACCOUNT, result.ledger)
    opening = opening_envelope()
    assert envelope.hardship_tier is HardshipTier.CLAIMED
    assert envelope.model_dump(exclude={"hardship_tier"}) == opening.model_dump(
        exclude={"hardship_tier"}
    )


@given(events=st.lists(evidence_events, max_size=15))
def test_rungs_never_exceed_their_cap(events: list[EvidenceEvent]) -> None:
    ledger = apply_all(events)
    for axis in ConcessionAxis:
        assert 0 <= ledger.rungs_on(axis) <= MAX_RUNGS[axis]


@given(events=st.lists(evidence_events, max_size=15))
def test_a_rung_is_only_ever_bought_by_evidence_that_unlocks_it(
    events: list[EvidenceEvent],
) -> None:
    """No axis can advance further than the distinct evidence supporting it."""
    ledger = apply_all(events)
    kinds = {e.kind for e in events}
    for axis in ConcessionAxis:
        supporting = sum(1 for k in kinds if axis in EVIDENCE_UNLOCKS[k])
        assert ledger.rungs_on(axis) <= min(supporting, MAX_RUNGS[axis])


@given(events=st.lists(evidence_events, max_size=15))
def test_ladder_is_monotonic(events: list[EvidenceEvent]) -> None:
    """Rungs and spent evidence only ever grow. A concession is not retracted
    by the arrival of further evidence."""
    ledger = ConcessionLedger()
    for event in events:
        nxt = advance(ledger, event).ledger
        assert nxt.spent_evidence >= ledger.spent_evidence
        for axis in ConcessionAxis:
            assert nxt.rungs_on(axis) >= ledger.rungs_on(axis)
        ledger = nxt
