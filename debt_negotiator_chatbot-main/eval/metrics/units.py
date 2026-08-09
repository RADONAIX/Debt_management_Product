"""The one place percentages become fractions.

The domain enums store percentages as integers — ``disc_ratio=20`` means 20%.
Every formula in CLAUDE.md §8 wants fractions — ``dr=0.20``. A factor-of-100
slip here would corrupt all six computed metrics *while still producing
plausible-looking numbers*, which is the worst kind of bug: nothing crashes, the
report looks fine, and every decision made from it is wrong.

So the conversion happens exactly once, here, and is pinned by property tests.
"""

from __future__ import annotations

from decimal import Decimal

from domain.agreement import Agreement


class AgreementTerms:
    """An agreement's four fields as the §8 formulas expect them.

    ``dr`` and ``pr`` are fractions in [0, 1]; ``pd`` is days; ``ip`` is months.
    """

    __slots__ = ("dr", "ip", "pd", "pr")

    def __init__(self, agreement: Agreement) -> None:
        self.dr: float = int(agreement.disc_ratio) / 100.0
        self.pr: float = int(agreement.pmt_ratio) / 100.0
        self.pd: int = int(agreement.pmt_days)
        self.ip: int = int(agreement.inst_prds)

    @property
    def settled_fraction(self) -> float:
        """``1 - dr`` — the share of principal actually being collected."""
        return 1.0 - self.dr

    def settled_amount(self, principal: Decimal) -> float:
        return float(principal) * self.settled_fraction

    def __repr__(self) -> str:
        return f"AgreementTerms(dr={self.dr}, pr={self.pr}, pd={self.pd}, ip={self.ip})"
