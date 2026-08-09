"""The offer envelope: the limits the model proposes *within* and never defines.

Architectural law 1. The opening envelope is CLAUDE.md §6's concession
discipline expressed as code — discount 0, upfront at least 25%, payment within
7 days, installments of 3 or 6 months. Each rung taken on an axis loosens that
axis by exactly one documented step, and the discount axis is additionally
ceilinged by the hardship tier no matter how many rungs were earned.

Pure: no I/O, no clock, no LLM (CLAUDE.md §12).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from domain.account import Account
from domain.enums import DiscRatio, InstPrds, PmtDays, PmtRatio
from domain.evidence import HardshipTier
from policy.hardship import max_discount_for, tier_from_evidence
from policy.ladder import ConcessionAxis, ConcessionLedger

UPFRONT_STEPS: tuple[PmtRatio, ...] = (
    PmtRatio.TWENTY_FIVE,
    PmtRatio.TWENTY,
    PmtRatio.FIFTEEN,
    PmtRatio.TEN,
    PmtRatio.FIVE,
)
"""Floor on ``pmt_ratio``. Rung 0 is §6's "push for at least 25%"."""

PAY_WINDOW_STEPS: tuple[PmtDays, ...] = (PmtDays.D7, PmtDays.D10, PmtDays.D14)
"""Ceiling on ``pmt_days``. §6 targets 7 and extends to 14 only on cash-flow
evidence; 10 is the intermediate step so the full extension costs two rungs."""

INSTALLMENT_STEPS: tuple[frozenset[InstPrds], ...] = (
    frozenset({InstPrds.M3, InstPrds.M6}),
    frozenset({InstPrds.M3, InstPrds.M6, InstPrds.M9}),
    frozenset({InstPrds.M3, InstPrds.M6, InstPrds.M9, InstPrds.M12}),
    frozenset({InstPrds.M3, InstPrds.M6, InstPrds.M9, InstPrds.M12, InstPrds.M18}),
    frozenset(InstPrds),
)
"""Permitted ``inst_prds`` sets. Rung 0 is §6's "prefer 3 or 6"."""


class Envelope(BaseModel):
    """The bounds a proposed agreement must satisfy to be returnable."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    max_disc_ratio: DiscRatio
    min_pmt_ratio: PmtRatio
    max_pmt_days: PmtDays
    allowed_inst_prds: frozenset[InstPrds]
    hardship_tier: HardshipTier

    def permits(self, *, field: str, value: int) -> bool:
        match field:
            case "disc_ratio":
                return value <= self.max_disc_ratio
            case "pmt_ratio":
                return value >= self.min_pmt_ratio
            case "pmt_days":
                return value <= self.max_pmt_days
            case "inst_prds":
                return value in {int(p) for p in self.allowed_inst_prds}
            case _:
                raise ValueError(f"not an agreement field: {field}")


def opening_envelope() -> Envelope:
    """The envelope before any evidence has been produced. CLAUDE.md §6."""
    return Envelope(
        max_disc_ratio=DiscRatio.ZERO,
        min_pmt_ratio=UPFRONT_STEPS[0],
        max_pmt_days=PAY_WINDOW_STEPS[0],
        allowed_inst_prds=INSTALLMENT_STEPS[0],
        hardship_tier=HardshipTier.NONE,
    )


def compute_envelope(account: Account, ledger: ConcessionLedger) -> Envelope:
    """The current envelope, given what evidence has been earned.

    ``account`` is the seam for per-product and per-jurisdiction limits. It is
    unused in phase 1 — but the value must still come from code when it arrives.
    §7: retrieved documents may explain a rule, never define an enforceable one.
    """
    del account  # phase 1: no per-account overrides yet.

    tier = tier_from_evidence(ledger.spent_evidence)

    # The discount axis is governed by the hardship tier rather than by rung
    # count, because §3.1 ties it to hardship specifically and nothing else.
    # The tier is itself evidence-gated and one-shot — it is a function of the
    # *set* of spent evidence — so the ladder's guarantee still holds here: no
    # amount of pressure raises it, and restating a claim cannot raise it twice.
    # The DISCOUNT rung is still recorded, so the audit shows *when* the axis
    # unlocked; the tier decides *how far*.
    max_discount = max_discount_for(tier)

    upfront_rung = min(ledger.rungs_on(ConcessionAxis.UPFRONT), len(UPFRONT_STEPS) - 1)
    window_rung = min(
        ledger.rungs_on(ConcessionAxis.PAY_WINDOW), len(PAY_WINDOW_STEPS) - 1
    )
    installment_rung = min(
        ledger.rungs_on(ConcessionAxis.INSTALLMENTS), len(INSTALLMENT_STEPS) - 1
    )

    return Envelope(
        max_disc_ratio=max_discount,
        min_pmt_ratio=UPFRONT_STEPS[upfront_rung],
        max_pmt_days=PAY_WINDOW_STEPS[window_rung],
        allowed_inst_prds=INSTALLMENT_STEPS[installment_rung],
        hardship_tier=tier,
    )
