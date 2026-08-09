"""The nine-metric report, always sliced by archetype (CLAUDE.md §8).

    "Report all nine metrics sliced by archetype, never aggregate only.
     Aggregate scores hide the confrontational-segment collapse that is the
     point of this benchmark."

So the aggregate is reported *alongside* the slices, never instead of them, and
the confrontational slice is printed first because Table 3 makes it the largest
and hardest segment rather than an edge case.
"""

from __future__ import annotations

from collections.abc import Sequence

from pydantic import BaseModel, ConfigDict, Field

from domain.enums import Archetype
from eval.metrics.ability import (
    average_turns,
    collection_efficiency,
    collection_rate,
    escalation_rate,
    success_rate,
    success_rate_engaged,
)
from eval.metrics.rationality import (
    long_term_sustainability_rate,
    short_term_affordability_rate,
)
from eval.types import DialogueResult

# Confrontational first: largest segment (38%) and the hardest.
SLICE_ORDER: tuple[Archetype, ...] = (
    Archetype.CONFRONTATIONAL,
    Archetype.AVOIDANT,
    Archetype.HELPLESS,
    Archetype.COOPERATIVE,
)

MIN_SLICE_FOR_STABLE_MEAN = 5


class MetricSet(BaseModel):
    """The nine metrics over one set of dialogues."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    n: int
    sr: float
    er: float = 0.0
    sr_eng: float = 0.0
    at: float
    cr: float
    ce: float
    sa: float
    ls: float
    us: float | None = None
    es: float | None = None
    ca: float | None = None
    judged: int = 0

    @property
    def underpowered(self) -> bool:
        """Too few dialogues for the mean to mean much."""
        return self.n < MIN_SLICE_FOR_STABLE_MEAN


def _mean(values: Sequence[float]) -> float | None:
    return sum(values) / len(values) if values else None


def compute(results: Sequence[DialogueResult]) -> MetricSet:
    judged = [r for r in results if r.judge is not None]
    return MetricSet(
        n=len(results),
        sr=success_rate(results),
        er=escalation_rate(results),
        sr_eng=success_rate_engaged(results),
        at=average_turns(results),
        cr=collection_rate(results),
        ce=collection_efficiency(results),
        sa=short_term_affordability_rate(results),
        ls=long_term_sustainability_rate(results),
        us=_mean([r.judge.user_satisfaction for r in judged if r.judge]),
        es=_mean([r.judge.emotional_support for r in judged if r.judge]),
        ca=_mean([r.judge.communication_appropriateness for r in judged if r.judge]),
        judged=len(judged),
    )


class Report(BaseModel):
    """Aggregate plus per-archetype slices."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    agent_name: str
    t_max: int
    models: dict[str, str] = Field(default_factory=dict)
    usage: dict[str, int] = Field(default_factory=dict)
    judge_calibrated: bool = False
    human_ratings: int = 0

    overall: MetricSet
    by_archetype: dict[str, MetricSet]

    def render(self) -> str:
        lines: list[str] = []
        add = lines.append

        add("=" * 84)
        add(f"NEGOTIATION EVALUATION — agent: {self.agent_name}")
        add("=" * 84)
        add(f"T_max: {self.t_max} turns")
        for role, model in sorted(self.models.items()):
            add(f"  {role:<10} {model}")
        add("")

        header = (
            f"{'slice':<18}{'n':>4}{'SR':>7}{'ER':>7}{'SRe':>7}{'AT':>7}{'CR':>8}{'CE':>9}"
            f"{'SA':>8}{'LS':>8}{'US':>7}{'ES':>7}{'CA':>7}"
        )

        add("-" * 84)
        add(header)
        add("-" * 84)

        # Slices first, aggregate last — the aggregate is the least informative
        # line in the table and should not be read as the headline.
        for archetype in SLICE_ORDER:
            metrics = self.by_archetype.get(archetype.value)
            if metrics is None:
                continue
            add(self._row(archetype.value, metrics))
            if metrics.underpowered:
                add(f"{'':<18}  ^ n={metrics.n}: too few dialogues for a stable mean")

        add("-" * 84)
        add(self._row("ALL", self.overall))
        add("-" * 84)
        add("")

        if not self.judge_calibrated:
            add(
                f"US/ES/CA are PROVISIONAL — judge not validated against human "
                f"ratings ({self.human_ratings} collected, 30 needed)."
            )
            add("  Collect ratings with: uv run python -m eval.calibrate")
        add(
            "ER = escalation rate (handed to a human). SRe = success rate over "
            "dialogues that were negotiable at all."
        )
        add(
            f"Spend: {self.usage.get('calls', 0)} calls, "
            f"{self.usage.get('total_tokens', 0):,} tokens"
        )
        return "\n".join(lines)

    @staticmethod
    def _row(label: str, m: MetricSet) -> str:
        def fmt(value: float | None, width: int, places: int = 3) -> str:
            return f"{'—':>{width}}" if value is None else f"{value:>{width}.{places}f}"

        return (
            f"{label:<18}{m.n:>4}"
            f"{fmt(m.sr, 7)}{fmt(m.er, 7)}{fmt(m.sr_eng, 7)}"
            f"{fmt(m.at, 7, 1)}{fmt(m.cr, 8)}{fmt(m.ce, 9, 4)}"
            f"{fmt(m.sa, 8)}{fmt(m.ls, 8)}"
            f"{fmt(m.us, 7, 1)}{fmt(m.es, 7, 1)}{fmt(m.ca, 7, 1)}"
        )


def build(
    results: Sequence[DialogueResult],
    *,
    agent_name: str,
    t_max: int,
    models: dict[str, str] | None = None,
    usage: dict[str, int] | None = None,
    judge_calibrated: bool = False,
    human_ratings: int = 0,
) -> Report:
    by_archetype: dict[str, MetricSet] = {}
    for archetype in SLICE_ORDER:
        sliced = [r for r in results if r.archetype is archetype]
        if sliced:
            by_archetype[archetype.value] = compute(sliced)

    return Report(
        agent_name=agent_name,
        t_max=t_max,
        models=models or {},
        usage=usage or {},
        judge_calibrated=judge_calibrated,
        human_ratings=human_ratings,
        overall=compute(results),
        by_archetype=by_archetype,
    )
