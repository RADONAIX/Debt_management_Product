"""Negotiation-ability metrics (CLAUDE.md §8).

``SR`` — share reaching a valid agreement within ``T_max``
``AT`` — mean turns across **all** dialogues, successful or not. Lower is better
``CR`` — ``mean over all N of (1 - dr) x success_indicator``
``CE`` — over **successful** dialogues only:
         ``(1 - dr) x ( pr/pd + (1 - pr)/(ip x 30) )``

The denominators differ between metrics on purpose. ``CR`` averages over every
dialogue, so a failure contributes a hard zero — an agent that only closes easy
cases cannot hide behind a high per-success discount. ``CE`` averages over
successes only, because recovery speed is undefined for a dialogue that never
settled.
"""

from __future__ import annotations

from collections.abc import Sequence

from eval.metrics.units import AgreementTerms
from eval.types import DialogueResult

_DAYS_PER_MONTH = 30


def success_rate(results: Sequence[DialogueResult]) -> float:
    """``SR``. Undefined on an empty set, reported as 0."""
    if not results:
        return 0.0
    return sum(1 for r in results if r.succeeded) / len(results)


def average_turns(results: Sequence[DialogueResult]) -> float:
    """``AT``. Over all dialogues — a fast failure is not a virtue, but a slow
    success is a real cost, and averaging over successes only would hide both."""
    if not results:
        return 0.0
    return sum(r.trajectory.turn_count for r in results) / len(results)


def collection_rate(results: Sequence[DialogueResult]) -> float:
    """``CR``. Failures contribute zero, so this is the headline money metric."""
    if not results:
        return 0.0
    total = 0.0
    for result in results:
        if result.succeeded and result.trajectory.agreement is not None:
            total += AgreementTerms(result.trajectory.agreement).settled_fraction
    return total / len(results)


def collection_efficiency(results: Sequence[DialogueResult]) -> float:
    """``CE``. Successful dialogues only."""
    successful = [
        r for r in results if r.succeeded and r.trajectory.agreement is not None
    ]
    if not successful:
        return 0.0

    total = 0.0
    for result in successful:
        assert result.trajectory.agreement is not None
        t = AgreementTerms(result.trajectory.agreement)
        upfront_speed = t.pr / t.pd
        remainder_speed = (1.0 - t.pr) / (t.ip * _DAYS_PER_MONTH)
        total += t.settled_fraction * (upfront_speed + remainder_speed)
    return total / len(successful)


def escalation_rate(results: Sequence[DialogueResult]) -> float:
    """``ER``. Share handed to a human.

    Not a §8 metric — added because without it SR and CR silently conflate two
    completely different things: an agent that could not close, and an agent
    that correctly stopped. On the first head-to-head the production agent
    escalated 8 of 16 and its CR read 0.087 against the baseline's 0.284, which
    looks like catastrophic underperformance until you know that half those
    dialogues were compliance working as designed.
    """
    if not results:
        return 0.0
    return sum(1 for r in results if r.escalated) / len(results)


def success_rate_engaged(results: Sequence[DialogueResult]) -> float:
    """``SR_eng``. Agreements over dialogues that were actually negotiable.

    Reported ALONGSIDE ``SR``, never instead of it. Excluding escalations from
    a denominator is exactly how an agent that hands off everything difficult
    could be made to look excellent, so the raw ``SR`` and ``ER`` stay on the
    same line as the honest counterweight.
    """
    engaged = [r for r in results if not r.escalated]
    if not engaged:
        return 0.0
    return sum(1 for r in engaged if r.succeeded) / len(engaged)
