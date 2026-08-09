"""Judge calibration state (CLAUDE.md §8).

    "Validate the judge against human ratings before trusting it."

No human ratings exist and none can be manufactured, so US/ES/CA ship tagged
PROVISIONAL and this module holds the evidence that would remove the tag.

Spearman rank correlation rather than Pearson: the question is whether the judge
*orders* dialogues the way a human does, not whether it reproduces the exact
number. A judge that sits consistently two points high but ranks correctly is
useful; one that hits the mean while shuffling the order is not.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

RATINGS_PATH = Path("eval/calibrate/human_ratings.json")

MIN_RATINGS = 30
MIN_RHO = 0.6


class HumanRating(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    persona_id: str
    user_satisfaction: int = Field(ge=1, le=10)
    emotional_support: int = Field(ge=1, le=10)
    communication_appropriateness: int = Field(ge=1, le=10)


def load_ratings() -> list[HumanRating]:
    if not RATINGS_PATH.exists():
        return []
    raw = json.loads(RATINGS_PATH.read_text())
    return [HumanRating.model_validate(r) for r in raw]


def save_ratings(ratings: list[HumanRating]) -> None:
    RATINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RATINGS_PATH.write_text(json.dumps([r.model_dump() for r in ratings], indent=2))


def _rank(values: list[float]) -> list[float]:
    """Average ranks, so ties do not distort the correlation."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        shared = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = shared
        i = j + 1
    return ranks


def spearman(xs: list[float], ys: list[float]) -> float | None:
    """Rank correlation. ``None`` when it is not computable."""
    if len(xs) != len(ys) or len(xs) < 2:
        return None
    rx, ry = _rank(xs), _rank(ys)
    n = len(xs)
    mean_x, mean_y = sum(rx) / n, sum(ry) / n
    num = sum((a - mean_x) * (b - mean_y) for a, b in zip(rx, ry, strict=True))
    den_x = sum((a - mean_x) ** 2 for a in rx)
    den_y = sum((b - mean_y) ** 2 for b in ry)
    if den_x == 0 or den_y == 0:
        return None
    return num / (den_x * den_y) ** 0.5


def calibration_status() -> tuple[bool, int]:
    """``(calibrated, n_ratings)``.

    Conservative by design: anything short of enough ratings *and* a correlation
    that holds on all three dimensions leaves the judge uncalibrated. A metric
    nobody has checked should not look like one somebody has.
    """
    ratings = load_ratings()
    if len(ratings) < MIN_RATINGS:
        return False, len(ratings)

    judged = _load_judge_scores()
    paired = [(r, judged[r.persona_id]) for r in ratings if r.persona_id in judged]
    if len(paired) < MIN_RATINGS:
        return False, len(ratings)

    for dimension in (
        "user_satisfaction",
        "emotional_support",
        "communication_appropriateness",
    ):
        human = [float(getattr(h, dimension)) for h, _ in paired]
        model = [float(m[dimension]) for _, m in paired]
        rho = spearman(human, model)
        if rho is None or rho < MIN_RHO:
            return False, len(ratings)

    return True, len(ratings)


def _load_judge_scores() -> dict[str, dict[str, float]]:
    """Judge scores from the last run's persisted transcripts."""
    transcripts = Path("eval/transcripts")
    if not transcripts.exists():
        return {}

    scores: dict[str, dict[str, float]] = {}
    for path in transcripts.glob("*.json"):
        if path.name == "report.json":
            continue
        try:
            payload = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        judge = payload.get("judge")
        if judge:
            scores[payload["persona"]["persona_id"]] = judge
    return scores
