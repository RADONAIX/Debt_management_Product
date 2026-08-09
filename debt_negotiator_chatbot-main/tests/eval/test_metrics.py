"""The nine metrics (CLAUDE.md §8).

Worth testing hard: every one of these is a number someone will make a decision
from, and five of the six computed ones fail *silently* if the percent/fraction
boundary slips. Nothing crashes — the report just becomes wrong.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from hypothesis import given
from hypothesis import strategies as st

from domain.account import Account
from domain.agreement import Agreement
from domain.enums import (
    Action,
    Archetype,
    CollectorStrategy,
    DebtorStrategy,
    DiscRatio,
    InstPrds,
    Outcome,
    PmtDays,
    PmtRatio,
    Speaker,
)
from domain.persona import (
    Background,
    Cognition,
    CognitionDimension,
    EmotionVector,
    Persona,
    Personality,
)
from domain.trajectory import Trajectory
from domain.turn import Turn
from eval.metrics import ability, rationality, report
from eval.metrics.units import AgreementTerms
from eval.types import DialogueResult, JudgeScores
from tests.strategies import agreements


def make_persona(
    archetype: Archetype = Archetype.CONFRONTATIONAL,
    *,
    daily_income: str = "40",
    assets: str = "500",
    persona_id: str = "p1",
) -> Persona:
    dim = CognitionDimension(level=3, description="You understand the basics.")
    return Persona(
        persona_id=persona_id,
        archetype=archetype,
        background=Background(
            age=34,
            gender="unspecified",
            overdue_amount=Decimal("4200"),
            days_overdue=95,
            overdue_reason="reduced_hours",
            daily_income=Decimal(daily_income),
            current_assets=Decimal(assets),
        ),
        personality=Personality(
            character_traits=("guarded",),
            mbti="ISTJ",
            emotions=EmotionVector(
                happiness=2, sadness=5, disgust=3, fear=4, surprise=1, anger=7
            ),
            emotional_resilience=3,
            linguistic_style="clipped",
        ),
        cognition=Cognition(
            legal_awareness=dim,
            financial_literacy=dim,
            responsibility=dim,
            credit_awareness=dim,
        ),
        scenario="Hours cut at work; behind on an unsecured loan.",
    )


def make_account(principal: str = "4200") -> Account:
    return Account(
        account_id="a1",
        tenant_id="t1",
        jurisdiction="uk",
        product="loan",
        principal=Decimal(principal),
        days_overdue=95,
    )


def make_result(
    *,
    agreement: Agreement | None,
    turns: int = 6,
    archetype: Archetype = Archetype.CONFRONTATIONAL,
    persona: Persona | None = None,
    account: Account | None = None,
    judge: JudgeScores | None = None,
) -> DialogueResult:
    built = []
    for i in range(turns):
        collector = i % 2 == 0
        built.append(
            Turn(
                index=i,
                speaker=Speaker.COLLECTOR if collector else Speaker.DEBTOR,
                strategy=(
                    CollectorStrategy.REPAYMENT_NEGOTIATION
                    if collector
                    else DebtorStrategy.VAGUE_RESPONSE
                ),
                thoughts="",
                action=Action.ASK,
                dialogue="...",
            )
        )
    return DialogueResult(
        persona=persona or make_persona(archetype),
        account=account or make_account(),
        trajectory=Trajectory(
            trajectory_id="t",
            account_id="a1",
            turns=tuple(built),
            agreement=agreement,
            outcome=Outcome.AGREEMENT if agreement else Outcome.NO_AGREEMENT,
        ),
        judge=judge,
    )


SETTLED = Agreement(
    disc_ratio=DiscRatio.ZERO,
    pmt_ratio=PmtRatio.TWENTY_FIVE,
    pmt_days=PmtDays.D7,
    inst_prds=InstPrds.M6,
)


# --------------------------------------------------------------------------
# units boundary
# --------------------------------------------------------------------------


@given(raw=agreements)
def test_percent_to_fraction_conversion_is_exact(raw: dict[str, int]) -> None:
    """The factor-of-100 boundary, pinned.

    If this slips, five metrics silently return wrong numbers that still look
    like plausible metrics.
    """
    terms = AgreementTerms(Agreement(**raw))
    assert terms.dr == pytest.approx(raw["disc_ratio"] / 100)
    assert terms.pr == pytest.approx(raw["pmt_ratio"] / 100)
    assert 0.0 <= terms.dr <= 0.30
    assert 0.05 <= terms.pr <= 0.50
    # Days and months stay in their natural units — they are not percentages.
    assert terms.pd == raw["pmt_days"]
    assert terms.ip == raw["inst_prds"]


@given(raw=agreements)
def test_metric_denominators_can_never_be_zero(raw: dict[str, int]) -> None:
    """A safety property inherited from the value grid, not from the metrics.

    ``SA`` divides by ``pr``; ``LS`` divides by ``(1 - pr)``. The grid pins
    ``pmt_ratio`` to 5..50, so neither can be zero. If someone ever widens the
    grid to include 0 or 100, this test is what tells them they just introduced
    a division by zero in the harness.
    """
    terms = AgreementTerms(Agreement(**raw))
    assert terms.pr > 0.0
    assert (1.0 - terms.pr) > 0.0
    assert terms.settled_fraction > 0.0


# --------------------------------------------------------------------------
# negotiation ability
# --------------------------------------------------------------------------


def test_sr_and_cr_count_failures_in_the_denominator() -> None:
    """CR averages over ALL dialogues, so a failure is a hard zero. An agent
    that closes only the easy half cannot hide behind a clean per-success
    discount."""
    results = [make_result(agreement=SETTLED), make_result(agreement=None)]

    assert ability.success_rate(results) == 0.5
    # one success at (1 - 0.0) = 1.0, one failure at 0.0
    assert ability.collection_rate(results) == pytest.approx(0.5)


def test_cr_is_reduced_by_discounting() -> None:
    full = make_result(agreement=SETTLED)
    discounted = make_result(
        agreement=Agreement(
            disc_ratio=DiscRatio.THIRTY,
            pmt_ratio=PmtRatio.TWENTY_FIVE,
            pmt_days=PmtDays.D7,
            inst_prds=InstPrds.M6,
        )
    )
    assert ability.collection_rate([full]) == pytest.approx(1.0)
    assert ability.collection_rate([discounted]) == pytest.approx(0.7)


def test_at_averages_over_all_dialogues_not_just_successes() -> None:
    results = [
        make_result(agreement=SETTLED, turns=4),
        make_result(agreement=None, turns=20),
    ]
    assert ability.average_turns(results) == 12.0


def test_ce_is_computed_over_successes_only() -> None:
    """Recovery speed is undefined for a dialogue that never settled, so adding
    a failure must not dilute CE the way it dilutes CR."""
    only_success = [make_result(agreement=SETTLED)]
    with_failure = [*only_success, make_result(agreement=None)]

    assert ability.collection_efficiency(with_failure) == pytest.approx(
        ability.collection_efficiency(only_success)
    )
    assert ability.collection_rate(with_failure) < ability.collection_rate(only_success)


def test_ce_matches_the_paper_formula() -> None:
    """(1 - dr) x ( pr/pd + (1 - pr)/(ip x 30) ), computed by hand."""
    result = make_result(agreement=SETTLED)  # dr=0, pr=0.25, pd=7, ip=6
    expected = 1.0 * (0.25 / 7 + 0.75 / 180)
    assert ability.collection_efficiency([result]) == pytest.approx(expected)


@given(results_spec=st.lists(st.booleans(), min_size=1, max_size=12))
def test_ability_metrics_stay_in_range(results_spec: list[bool]) -> None:
    results = [make_result(agreement=SETTLED if ok else None) for ok in results_spec]
    assert 0.0 <= ability.success_rate(results) <= 1.0
    assert 0.0 <= ability.collection_rate(results) <= 1.0
    assert ability.collection_rate(results) <= ability.success_rate(results)


def test_empty_set_does_not_divide_by_zero() -> None:
    for fn in (
        ability.success_rate,
        ability.average_turns,
        ability.collection_rate,
        ability.collection_efficiency,
        rationality.short_term_affordability_rate,
        rationality.long_term_sustainability_rate,
    ):
        assert fn([]) == 0.0


# --------------------------------------------------------------------------
# agreement rationality
# --------------------------------------------------------------------------


def test_sa_matches_the_paper_formula() -> None:
    """0.85 x (assets + daily_income x pmt_days) / (debt x (1 - dr) x pr)."""
    result = make_result(agreement=SETTLED)  # assets 500, income 40/day, pd 7
    expected = 0.85 * (500 + 40 * 7) / (4200 * 1.0 * 0.25)
    assert rationality.short_term_affordability(result) == pytest.approx(expected)


def test_ls_matches_the_paper_formula() -> None:
    """0.95 x daily_income x 30 x inst_prds / (debt x (1 - dr) x (1 - pr))."""
    result = make_result(agreement=SETTLED)  # income 40/day, ip 6
    expected = 0.95 * 40 * 30 * 6 / (4200 * 1.0 * 0.75)
    assert rationality.long_term_sustainability(result) == pytest.approx(expected)


def test_rationality_is_none_for_unsettled_dialogues() -> None:
    unsettled = make_result(agreement=None)
    assert rationality.short_term_affordability(unsettled) is None
    assert rationality.long_term_sustainability(unsettled) is None


def test_rationality_reports_a_share_not_a_mean() -> None:
    """One wildly affordable settlement must not paper over impossible ones.

    A mean would; a share of dialogues clearing the 1.0 threshold will not.
    """
    rich = make_result(
        agreement=SETTLED,
        persona=make_persona(daily_income="5000", assets="900000", persona_id="rich"),
    )
    broke = make_result(
        agreement=SETTLED,
        persona=make_persona(daily_income="1", assets="0", persona_id="broke"),
    )

    assert rationality.short_term_affordability(rich) > 1.0
    assert rationality.short_term_affordability(broke) < 1.0
    assert rationality.short_term_affordability_rate([rich, broke]) == 0.5


def test_an_unaffordable_settlement_is_not_scored_as_a_win() -> None:
    """The point of SA/LS: extracting a promise the debtor cannot keep is a
    default waiting to happen, not a collection."""
    broke = make_result(
        agreement=SETTLED,
        persona=make_persona(daily_income="1", assets="0", persona_id="broke"),
    )
    assert ability.collection_rate([broke]) == pytest.approx(1.0)  # looks perfect
    assert rationality.short_term_affordability_rate([broke]) == 0.0  # is not
    assert rationality.long_term_sustainability_rate([broke]) == 0.0


# --------------------------------------------------------------------------
# reporting
# --------------------------------------------------------------------------


def test_report_slices_by_archetype_and_never_only_aggregates() -> None:
    """§8: aggregate scores hide the confrontational collapse."""
    results = [
        *[
            make_result(agreement=None, archetype=Archetype.CONFRONTATIONAL)
            for _ in range(6)
        ],
        *[
            make_result(agreement=SETTLED, archetype=Archetype.COOPERATIVE)
            for _ in range(6)
        ],
    ]
    built = report.build(results, agent_name="test", t_max=20)

    assert built.overall.sr == 0.5  # the misleading headline
    assert built.by_archetype["confrontational"].sr == 0.0  # the actual finding
    assert built.by_archetype["cooperative"].sr == 1.0

    rendered = built.render()
    assert "confrontational" in rendered
    # Confrontational is printed before the aggregate, and before the easy slice.
    assert rendered.index("confrontational") < rendered.index("cooperative")
    assert rendered.index("confrontational") < rendered.index("ALL")


def test_report_flags_underpowered_slices() -> None:
    """Cooperative is only 6% of the distribution — n=3 in the seeded set. The
    report must say so rather than print a confident-looking mean."""
    results = [
        make_result(agreement=SETTLED, archetype=Archetype.COOPERATIVE)
        for _ in range(3)
    ]
    built = report.build(results, agent_name="test", t_max=20)

    assert built.by_archetype["cooperative"].underpowered is True
    assert "too few dialogues" in built.render()


def test_report_marks_judge_scores_provisional_until_calibrated() -> None:
    """§8 requires validating the judge against human ratings. Until that has
    happened the number must not be presented as trustworthy."""
    judged = make_result(
        agreement=SETTLED,
        judge=JudgeScores(
            user_satisfaction=8,
            emotional_support=7,
            communication_appropriateness=9,
        ),
    )
    built = report.build([judged], agent_name="test", t_max=20, judge_calibrated=False)

    assert built.overall.us == 8.0
    assert "PROVISIONAL" in built.render()

    calibrated = report.build(
        [judged], agent_name="test", t_max=20, judge_calibrated=True
    )
    assert "PROVISIONAL" not in calibrated.render()


def test_unjudged_dialogues_render_as_absent_not_zero() -> None:
    """A missing judge score is unknown, not a score of zero — averaging it in
    as 0 would make an unjudged run look catastrophic."""
    built = report.build([make_result(agreement=SETTLED)], agent_name="t", t_max=20)
    assert built.overall.us is None
    assert built.overall.judged == 0
    assert "—" in built.render()
