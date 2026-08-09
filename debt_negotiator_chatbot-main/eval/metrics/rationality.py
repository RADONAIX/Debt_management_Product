"""Agreement-rationality metrics (CLAUDE.md §8).

``SA`` — short-term affordability::

    w_short x (assets + daily_income x pmt_days) / (debt x (1 - dr) x pr)

``LS`` — long-term sustainability::

    w_long x daily_income x 30 x inst_prds / (debt x (1 - dr) x (1 - pr))

Both are ratios of *what the debtor can actually raise* to *what the agreement
demands*. A value below 1.0 means the collector extracted a promise the debtor
cannot keep — which is not a win, it is a default waiting to happen, and it is
why these sit alongside CR rather than under it.

Both are reported as the **share of successful dialogues scoring >= 1.0**, not
as a mean. A mean would let one wildly affordable settlement paper over three
impossible ones.

The denominators cannot be zero, and that is load-bearing rather than lucky:
``pmt_ratio`` is grid-constrained to 5..50, so ``pr`` is never 0 (which would
divide by zero in ``SA``) and never 1 (which would divide by zero in ``LS``).
A property test pins this, because it is a safety property inherited from the
value grid rather than one this module enforces itself.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence

from eval.metrics.units import AgreementTerms
from eval.types import DialogueResult

W_SHORT = 0.85
W_LONG = 0.95
_DAYS_PER_MONTH = 30
_THRESHOLD = 1.0


def short_term_affordability(result: DialogueResult) -> float | None:
    """``SA_i``. ``None`` when the dialogue did not settle."""
    if not result.succeeded or result.trajectory.agreement is None:
        return None

    t = AgreementTerms(result.trajectory.agreement)
    background = result.persona.background

    available = float(background.current_assets) + float(background.daily_income) * t.pd
    demanded = float(result.account.principal) * t.settled_fraction * t.pr
    return W_SHORT * available / demanded


def long_term_sustainability(result: DialogueResult) -> float | None:
    """``LS_i``. ``None`` when the dialogue did not settle."""
    if not result.succeeded or result.trajectory.agreement is None:
        return None

    t = AgreementTerms(result.trajectory.agreement)
    background = result.persona.background

    available = float(background.daily_income) * _DAYS_PER_MONTH * t.ip
    demanded = float(result.account.principal) * t.settled_fraction * (1.0 - t.pr)
    return W_LONG * available / demanded


def _share_meeting_threshold(
    results: Sequence[DialogueResult],
    score: Callable[[DialogueResult], float | None],
) -> float:
    scores = [s for r in results if (s := score(r)) is not None]
    if not scores:
        return 0.0
    return sum(1 for s in scores if s >= _THRESHOLD) / len(scores)


def short_term_affordability_rate(results: Sequence[DialogueResult]) -> float:
    """``SA``. Share of successful dialogues with ``SA_i >= 1.0``."""
    return _share_meeting_threshold(results, short_term_affordability)


def long_term_sustainability_rate(results: Sequence[DialogueResult]) -> float:
    """``LS``. Share of successful dialogues with ``LS_i >= 1.0``."""
    return _share_meeting_threshold(results, long_term_sustainability)
