"""Evidence: the only thing that moves the concession ladder.

The distinction that matters here is between a debtor *claiming* hardship and a
debtor *evidencing* it. Paper finding ② is that models concede to pressure, not
to facts; Figure 9 shows a model granting an unprompted 10% discount and settling
at 20% under nothing more than mild pushback. So claiming is worth exactly
nothing in this model, and only a recorded, verifiable evidence event can unlock
a rung — see :mod:`policy.ladder`.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class EvidenceKind(StrEnum):
    """Categories of evidence a debtor can put on the table.

    Each kind is spendable exactly once per negotiation (:mod:`policy.ladder`),
    so repeating the same disclosure cannot buy a second concession.
    """

    HARDSHIP_CLAIMED = "hardship_claimed"
    """Asserted, unverified. Deliberately unlocks nothing."""

    HARDSHIP_DOCUMENTED = "hardship_documented"
    """Specific, checkable facts about a change in circumstances."""

    SEVERE_HARDSHIP_DOCUMENTED = "severe_hardship_documented"
    """Job loss, medical event, insolvency proceedings — documented."""

    INCOME_VERIFIED = "income_verified"
    """Cash-flow evidence: payslip, benefit award, bank statement."""

    LIQUIDITY_CONSTRAINED = "liquidity_constrained"
    """Demonstrated inability to raise the upfront share, not reluctance."""

    ASSETS_DISCLOSED = "assets_disclosed"
    """A full and consistent account of realisable assets."""

    THIRD_PARTY_DEBT_CONFIRMED = "third_party_debt_confirmed"
    """Competing obligations confirmed, e.g. via a debt advice agency."""


class HardshipTier(StrEnum):
    """Strength of the hardship case. Ceilings the discount axis.

    Ordering is meaningful; use :data:`HARDSHIP_TIER_ORDER` to compare.
    """

    NONE = "none"
    CLAIMED = "claimed"
    EVIDENCED = "evidenced"
    SEVERE = "severe"


HARDSHIP_TIER_ORDER: dict[HardshipTier, int] = {
    HardshipTier.NONE: 0,
    HardshipTier.CLAIMED: 1,
    HardshipTier.EVIDENCED: 2,
    HardshipTier.SEVERE: 3,
}


class EvidenceEvent(BaseModel):
    """A single evidence disclosure, anchored to the turn that produced it.

    ``turn_index`` is state carried by the caller, never a clock read — this
    keeps :mod:`policy` pure per CLAUDE.md §12.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    kind: EvidenceKind
    turn_index: int = Field(ge=0)
    note: str = Field(
        default="",
        description="Free text for the audit record. Never parsed by policy.",
    )
