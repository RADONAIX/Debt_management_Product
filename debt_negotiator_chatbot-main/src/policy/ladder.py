"""The concession ladder: evidence-gated, one-shot.

CLAUDE.md names the ladder but does not define what advances a rung. This is the
operative definition:

    A rung advances only on a *new* evidence event, and each evidence kind is
    spendable exactly once per negotiation.

That single rule is what makes the §6 mandatory regression structural rather
than behavioural. A debtor who pushes back twice without disclosing anything new
calls :func:`advance` with no event, or replays a kind already spent; both are
no-ops. There is no argument, no tone, and no persistence that moves the
envelope — only facts that were not previously on the table. This is the exact
failure in paper Figure 9, and it is unreachable through this API.

Pure: no I/O, no clock, no LLM (CLAUDE.md §12). Every function returns a new
ledger; nothing here mutates.
"""

from __future__ import annotations

from collections.abc import Iterable
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from domain.evidence import EvidenceEvent, EvidenceKind


class ConcessionAxis(StrEnum):
    """The four things that can be conceded — one per agreement field."""

    DISCOUNT = "discount"
    UPFRONT = "upfront"
    PAY_WINDOW = "pay_window"
    INSTALLMENTS = "installments"


EVIDENCE_UNLOCKS: dict[EvidenceKind, frozenset[ConcessionAxis]] = {
    # Deliberately empty. An assertion of hardship buys nothing; it is recorded
    # so the audit trail shows it was heard, and so it can never be spent twice.
    EvidenceKind.HARDSHIP_CLAIMED: frozenset(),
    EvidenceKind.HARDSHIP_DOCUMENTED: frozenset({ConcessionAxis.DISCOUNT}),
    EvidenceKind.SEVERE_HARDSHIP_DOCUMENTED: frozenset(
        {ConcessionAxis.DISCOUNT, ConcessionAxis.UPFRONT, ConcessionAxis.INSTALLMENTS}
    ),
    EvidenceKind.INCOME_VERIFIED: frozenset(
        {ConcessionAxis.PAY_WINDOW, ConcessionAxis.INSTALLMENTS}
    ),
    EvidenceKind.LIQUIDITY_CONSTRAINED: frozenset(
        {ConcessionAxis.UPFRONT, ConcessionAxis.PAY_WINDOW}
    ),
    EvidenceKind.ASSETS_DISCLOSED: frozenset({ConcessionAxis.UPFRONT}),
    EvidenceKind.THIRD_PARTY_DEBT_CONFIRMED: frozenset({ConcessionAxis.INSTALLMENTS}),
}

MAX_RUNGS: dict[ConcessionAxis, int] = {
    ConcessionAxis.DISCOUNT: 6,
    ConcessionAxis.UPFRONT: 4,
    ConcessionAxis.PAY_WINDOW: 2,
    ConcessionAxis.INSTALLMENTS: 4,
}


class LadderReason(StrEnum):
    """Why :func:`advance` did or did not move. Goes in the audit record."""

    MOVED = "moved"
    NO_NEW_EVIDENCE = "no_new_evidence"
    EVIDENCE_ALREADY_SPENT = "evidence_already_spent"
    UNLOCKS_NOTHING = "unlocks_nothing"
    AXES_EXHAUSTED = "axes_exhausted"


class ConcessionLedger(BaseModel):
    """What has been conceded so far, and what has already been paid for.

    Rungs are separate fields rather than a mapping so the ledger is genuinely
    immutable — a frozen model holding a dict still hands out a mutable dict.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    spent_evidence: frozenset[EvidenceKind] = frozenset()
    discount_rungs: int = Field(default=0, ge=0)
    upfront_rungs: int = Field(default=0, ge=0)
    pay_window_rungs: int = Field(default=0, ge=0)
    installment_rungs: int = Field(default=0, ge=0)

    def rungs_on(self, axis: ConcessionAxis) -> int:
        match axis:
            case ConcessionAxis.DISCOUNT:
                return self.discount_rungs
            case ConcessionAxis.UPFRONT:
                return self.upfront_rungs
            case ConcessionAxis.PAY_WINDOW:
                return self.pay_window_rungs
            case ConcessionAxis.INSTALLMENTS:
                return self.installment_rungs

    def with_rungs(self, axes: frozenset[ConcessionAxis]) -> ConcessionLedger:
        bump = {axis: 1 if axis in axes else 0 for axis in ConcessionAxis}
        return self.model_copy(
            update={
                "discount_rungs": min(
                    self.discount_rungs + bump[ConcessionAxis.DISCOUNT],
                    MAX_RUNGS[ConcessionAxis.DISCOUNT],
                ),
                "upfront_rungs": min(
                    self.upfront_rungs + bump[ConcessionAxis.UPFRONT],
                    MAX_RUNGS[ConcessionAxis.UPFRONT],
                ),
                "pay_window_rungs": min(
                    self.pay_window_rungs + bump[ConcessionAxis.PAY_WINDOW],
                    MAX_RUNGS[ConcessionAxis.PAY_WINDOW],
                ),
                "installment_rungs": min(
                    self.installment_rungs + bump[ConcessionAxis.INSTALLMENTS],
                    MAX_RUNGS[ConcessionAxis.INSTALLMENTS],
                ),
            }
        )


class LadderResult(BaseModel):
    """The outcome of one attempt to advance the ladder."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    ledger: ConcessionLedger
    reason: LadderReason
    axes_moved: frozenset[ConcessionAxis] = frozenset()


def advance(
    ledger: ConcessionLedger, event: EvidenceEvent | None = None
) -> LadderResult:
    """Attempt to move the ladder on the strength of one evidence event.

    ``event=None`` models the common case: the debtor pushed back, complained,
    or restated their position without putting anything new on the table. The
    ledger comes back untouched.
    """
    if event is None:
        return LadderResult(ledger=ledger, reason=LadderReason.NO_NEW_EVIDENCE)

    if event.kind in ledger.spent_evidence:
        return LadderResult(ledger=ledger, reason=LadderReason.EVIDENCE_ALREADY_SPENT)

    spent = ConcessionLedger(
        spent_evidence=ledger.spent_evidence | {event.kind},
        discount_rungs=ledger.discount_rungs,
        upfront_rungs=ledger.upfront_rungs,
        pay_window_rungs=ledger.pay_window_rungs,
        installment_rungs=ledger.installment_rungs,
    )

    unlocks = EVIDENCE_UNLOCKS[event.kind]
    if not unlocks:
        return LadderResult(ledger=spent, reason=LadderReason.UNLOCKS_NOTHING)

    movable = frozenset(a for a in unlocks if spent.rungs_on(a) < MAX_RUNGS[a])
    if not movable:
        return LadderResult(ledger=spent, reason=LadderReason.AXES_EXHAUSTED)

    return LadderResult(
        ledger=spent.with_rungs(movable),
        reason=LadderReason.MOVED,
        axes_moved=movable,
    )


def apply_all(
    events: Iterable[EvidenceEvent],
    ledger: ConcessionLedger | None = None,
) -> ConcessionLedger:
    """Fold a whole transcript's evidence into a ledger.

    Order-independent and repeat-immune by construction: the result depends only
    on the *set* of distinct evidence kinds present.
    """
    current = ledger if ledger is not None else ConcessionLedger()
    for event in events:
        current = advance(current, event).ledger
    return current
