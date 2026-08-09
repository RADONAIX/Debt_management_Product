"""Deterministic background specs for the persona set.

The first attempt let the model invent the whole persona. Across 40 generations
it produced 3 distinct ages, 7 distinct debts, and two overdue reasons covering
37 of the 40 — textbook mode collapse. A set like that is not a benchmark; it is
one persona with forty name tags, and every metric computed over it describes a
single narrow case.

So the *background* is constructed here, deterministically, spread across the
space by design. The model is left to write what it is actually good at: the
personality, the cognition profile, and a scenario that makes the given numbers
hang together as a life.

This also makes the financial tension structural rather than screened — the
debt-to-income ratio is chosen, not checked afterwards — and makes the whole set
reproducible from the index alone, which is what §8's "fixed, seeded" asks for.
"""

from __future__ import annotations

from dataclasses import dataclass

from domain.enums import Archetype

OVERDUE_REASONS = (
    "reduced_hours",
    "job_loss",
    "medical_event",
    "business_failure",
    "relationship_breakdown",
    "overcommitment",
    "bereavement",
    "caring_responsibilities",
    "dispute_with_creditor",
    "financial_mismanagement",
)

# Ages spread across a working-age adult population, deliberately including the
# tails — a 22-year-old and a 68-year-old negotiate very differently.
AGES = (22, 26, 29, 33, 37, 41, 45, 49, 53, 58, 62, 68)

# Daily income, wide spread: gig-economy marginal through comfortable
# professional. All figures GBP-equivalent and synthetic (§11).
DAILY_INCOMES = (18, 24, 31, 38, 45, 52, 60, 72, 85, 96, 110, 128, 145, 170)

# Debt as a multiple of monthly income. Below ~1.5 there is no negotiation to
# have; above ~6 the debtor is insolvent rather than merely stuck.
DEBT_RATIOS = (1.6, 2.1, 2.7, 3.2, 3.8, 4.3, 4.9, 5.4)

# Assets as a share of the debt. Never enough to settle outright.
ASSET_SHARES = (0.0, 0.03, 0.07, 0.12, 0.18, 0.25)

DAYS_OVERDUE = (34, 47, 61, 78, 95, 118, 142, 176, 215, 260, 310, 420)

# MBTI pools that plausibly fit each archetype, rotated for spread.
MBTI_BY_ARCHETYPE: dict[Archetype, tuple[str, ...]] = {
    Archetype.CONFRONTATIONAL: ("ESTJ", "ENTJ", "ISTP", "ESTP", "ENTP"),
    Archetype.AVOIDANT: ("INFP", "ISFP", "INTP", "INFJ", "ISTJ"),
    Archetype.HELPLESS: ("ISFJ", "INFP", "ISFP", "INFJ"),
    Archetype.COOPERATIVE: ("ESFJ", "ENFJ", "ISFJ"),
}

GENDERS = ("female", "male", "male", "female", "non-binary")


@dataclass(frozen=True)
class PersonaSpec:
    """The fixed facts a generated persona must be built around."""

    archetype: Archetype
    index: int
    seq: int
    age: int
    gender: str
    overdue_amount: int
    days_overdue: int
    overdue_reason: str
    daily_income: int
    current_assets: int
    mbti: str

    @property
    def persona_id(self) -> str:
        return f"{self.archetype.value}-{self.index:02d}"

    @property
    def monthly_income(self) -> int:
        return self.daily_income * 30

    @property
    def debt_to_monthly_income(self) -> float:
        return self.overdue_amount / self.monthly_income

    def brief(self) -> str:
        return (
            f"age {self.age}, {self.gender}; owes {self.overdue_amount:,} "
            f"({self.days_overdue} days overdue) after {self.overdue_reason}; "
            f"earns {self.daily_income}/day (~{self.monthly_income:,}/month); "
            f"has {self.current_assets:,} realisable. The debt is "
            f"{self.debt_to_monthly_income:.1f}x monthly income."
        )


# Co-prime strides against each table length so the cycles do not resynchronise
# and collapse back into a handful of repeated combinations.
_STRIDES = {
    "age": 5,
    "income": 5,
    "ratio": 3,
    "assets": 5,
    "days": 7,
    "reason": 3,
    "gender": 2,
}


def build_spec(archetype: Archetype, index: int, seq: int) -> PersonaSpec:
    """Deterministic spec for the ``index``-th persona of an archetype.

    ``seq`` is the position across the whole set, so two archetypes never draw
    the same combination just because they share an index.
    """
    daily_income = DAILY_INCOMES[(seq * _STRIDES["income"]) % len(DAILY_INCOMES)]
    ratio = DEBT_RATIOS[(seq * _STRIDES["ratio"]) % len(DEBT_RATIOS)]
    overdue_amount = int(round(daily_income * 30 * ratio / 50) * 50)
    asset_share = ASSET_SHARES[(seq * _STRIDES["assets"]) % len(ASSET_SHARES)]
    mbti_pool = MBTI_BY_ARCHETYPE[archetype]

    return PersonaSpec(
        archetype=archetype,
        index=index,
        seq=seq,
        age=AGES[(seq * _STRIDES["age"]) % len(AGES)],
        gender=GENDERS[(seq * _STRIDES["gender"]) % len(GENDERS)],
        overdue_amount=overdue_amount,
        days_overdue=DAYS_OVERDUE[(seq * _STRIDES["days"]) % len(DAYS_OVERDUE)],
        overdue_reason=OVERDUE_REASONS[
            (seq * _STRIDES["reason"]) % len(OVERDUE_REASONS)
        ],
        daily_income=daily_income,
        current_assets=int(round(overdue_amount * asset_share / 10) * 10),
        mbti=mbti_pool[seq % len(mbti_pool)],
    )
