"""Hardship tiers and the discount ceiling each one buys.

CLAUDE.md §3.1: discount defaults to 0 and moves "only on evidenced hardship".
The mapping below is the operative reading of that sentence — *claiming*
hardship is worth zero, because a rule that yields to assertion is not a rule.
"""

from __future__ import annotations

from domain.enums import DiscRatio
from domain.evidence import HARDSHIP_TIER_ORDER, EvidenceKind, HardshipTier

MAX_DISCOUNT_BY_TIER: dict[HardshipTier, DiscRatio] = {
    HardshipTier.NONE: DiscRatio.ZERO,
    HardshipTier.CLAIMED: DiscRatio.ZERO,
    HardshipTier.EVIDENCED: DiscRatio.TEN,
    HardshipTier.SEVERE: DiscRatio.THIRTY,
}

_TIER_BY_EVIDENCE: dict[EvidenceKind, HardshipTier] = {
    EvidenceKind.HARDSHIP_CLAIMED: HardshipTier.CLAIMED,
    EvidenceKind.HARDSHIP_DOCUMENTED: HardshipTier.EVIDENCED,
    EvidenceKind.SEVERE_HARDSHIP_DOCUMENTED: HardshipTier.SEVERE,
}


def max_discount_for(tier: HardshipTier) -> DiscRatio:
    """The highest discount this tier can ever justify."""
    return MAX_DISCOUNT_BY_TIER[tier]


def tier_from_evidence(evidence: frozenset[EvidenceKind]) -> HardshipTier:
    """The strongest tier supported by the evidence on record.

    Strongest, not cumulative: three separate claims do not add up to a document.
    """
    tiers = [_TIER_BY_EVIDENCE[k] for k in evidence if k in _TIER_BY_EVIDENCE]
    if not tiers:
        return HardshipTier.NONE
    return max(tiers, key=lambda t: HARDSHIP_TIER_ORDER[t])
