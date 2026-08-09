"""The terminal state of a negotiation (CLAUDE.md §3.1, paper Appendix A.2).

Two distinct types, deliberately:

``Agreement``
    Complete and on-grid *by construction*. If one exists, all four fields are
    specified and in range — there is no such thing as a half-valid agreement.

``AgreementDelta``
    The partial proposal a turn may carry mid-dialogue (§3.4). A delta is not an
    agreement and never silently becomes one; promotion goes through
    :meth:`AgreementDelta.to_agreement`, which returns ``None`` unless all four
    fields are set.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from domain.enums import DiscRatio, InstPrds, PmtDays, PmtRatio

_HUNDRED = Decimal(100)


class Agreement(BaseModel):
    """A complete, on-grid settlement. Frozen."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    disc_ratio: DiscRatio
    pmt_ratio: PmtRatio
    pmt_days: PmtDays
    inst_prds: InstPrds

    def settled_amount(self, principal: Decimal) -> Decimal:
        """Principal after the discount."""
        return principal * (_HUNDRED - Decimal(self.disc_ratio)) / _HUNDRED

    def upfront_amount(self, principal: Decimal) -> Decimal:
        """The share due within ``pmt_days``."""
        return self.settled_amount(principal) * Decimal(self.pmt_ratio) / _HUNDRED

    def installment_amount(self, principal: Decimal) -> Decimal:
        """Per-month payment on the remainder."""
        remainder = self.settled_amount(principal) - self.upfront_amount(principal)
        return remainder / Decimal(self.inst_prds)


class AgreementDelta(BaseModel):
    """A partial proposal. Any subset of the four fields may be present."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    disc_ratio: DiscRatio | None = None
    pmt_ratio: PmtRatio | None = None
    pmt_days: PmtDays | None = None
    inst_prds: InstPrds | None = None

    @property
    def is_empty(self) -> bool:
        return self.to_agreement() is None and not any(
            v is not None for v in self.model_dump().values()
        )

    def to_agreement(self) -> Agreement | None:
        """Promote to a complete agreement, or ``None`` if any field is unset.

        Never fills a default. An unspecified term is unagreed, not zero.
        """
        if (
            self.disc_ratio is None
            or self.pmt_ratio is None
            or self.pmt_days is None
            or self.inst_prds is None
        ):
            return None
        return Agreement(
            disc_ratio=self.disc_ratio,
            pmt_ratio=self.pmt_ratio,
            pmt_days=self.pmt_days,
            inst_prds=self.inst_prds,
        )

    def merged_with(self, other: AgreementDelta) -> AgreementDelta:
        """Overlay ``other`` on this delta; set fields in ``other`` win."""
        overlay = {k: v for k, v in other.model_dump().items() if v is not None}
        return self.model_copy(update=overlay)

    @classmethod
    def from_agreement(cls, agreement: Agreement) -> AgreementDelta:
        return cls(**agreement.model_dump())
