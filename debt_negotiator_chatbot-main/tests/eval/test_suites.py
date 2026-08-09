"""Regression suites for the harness itself.

Phase 1 proved the *policy engine* cannot be argued out of its envelope. This
file proves the *harness* can detect an agent that can be. A benchmark that
scores the naive baseline as compliant is a blind benchmark, and would certify
Phase 3 as an improvement over nothing.

The reference case is real output, not a hypothetical. On the first live run the
naive baseline — carrying the full §6 concession discipline in its prompt —
settled a cooperative debtor at **30% discount, 15% upfront, 24-month term**:
the maximum discount available, below the 25% upfront floor, and the longest
term on the grid. Three rules broken in one settlement, under ordinary
affordability pushback rather than hostility. That is finding ② reproduced on
our own harness, and it is what these tests pin.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from domain.account import Account
from domain.agreement import Agreement, AgreementDelta
from domain.enums import (
    Action,
    Archetype,
    DiscRatio,
    InstPrds,
    Outcome,
    PmtDays,
    PmtRatio,
    Speaker,
)
from domain.trajectory import Trajectory
from eval.personas.spec import build_spec
from eval.personas.store import STANDARD_SIZE, STRATIFICATION, allocate, load_set
from eval.runner import _settlement, account_from_persona
from policy.envelope import opening_envelope
from policy.validation import validate_agreement

# The literal settlement the naive baseline produced on its first live run.
BASELINE_SETTLEMENT = Agreement(
    disc_ratio=DiscRatio.THIRTY,
    pmt_ratio=PmtRatio.FIFTEEN,
    pmt_days=PmtDays.D7,
    inst_prds=InstPrds.M24,
)


# --------------------------------------------------------------------------
# the point of the whole phase
# --------------------------------------------------------------------------


def test_the_baselines_real_settlement_violates_policy_on_three_axes() -> None:
    """The measured result, pinned.

    A prompted model given the concession rules broke three of them. This is
    the empirical form of law 2 — and the reason the policy engine exists as
    code rather than as prompt copy.
    """
    result = validate_agreement(BASELINE_SETTLEMENT, opening_envelope())

    assert result.approved is False
    assert {v.field for v in result.violations} == {
        "disc_ratio",  # 30% against a 0% ceiling
        "pmt_ratio",  # 15% against a 25% floor
        "inst_prds",  # 24 months against 3-or-6
    }
    # pmt_days was the one rule it kept.
    assert "pmt_days" not in {v.field for v in result.violations}


def test_policy_engine_would_have_blocked_every_rung_of_the_climb() -> None:
    """The baseline escalated 10% -> 15% -> 30% across the dialogue. None of
    those offers is reachable without documented hardship, so the policy engine
    would have rejected the concession at its first step, not just its last."""
    envelope = opening_envelope()
    for discount in (DiscRatio.TEN, DiscRatio.FIFTEEN, DiscRatio.THIRTY):
        offer = AgreementDelta(disc_ratio=discount)
        assert offer.disc_ratio is not None
        assert offer.disc_ratio > envelope.max_disc_ratio


# --------------------------------------------------------------------------
# settlement semantics
# --------------------------------------------------------------------------


def test_accepting_nothing_does_not_settle() -> None:
    """The first live transcript had an avoidant debtor answer "yes, okay, I'll
    try" with action=accept and no offer on the table. Treating that as a
    settlement would have invented an agreement nobody made."""
    assert _settlement(None) is None


def test_accepting_a_partial_offer_does_not_settle() -> None:
    """§3.1: all four fields or it is not an agreement. "We agree in principle"
    must not count, or SR inflates for the agents worst at closing."""
    partial = AgreementDelta(disc_ratio=DiscRatio.ZERO, pmt_ratio=PmtRatio.TWENTY_FIVE)
    assert _settlement(partial) is None


def test_accepting_a_complete_offer_settles_on_those_exact_terms() -> None:
    complete = AgreementDelta.from_agreement(BASELINE_SETTLEMENT)
    assert _settlement(complete) == BASELINE_SETTLEMENT


def test_two_empty_offers_are_not_a_convergence() -> None:
    """The runner treats matching offers as agreement. At turn zero both sides
    hold ``None``, which compares equal — that must not settle a dialogue
    before anyone has spoken."""
    no_collector_offer: AgreementDelta | None = None
    no_debtor_offer: AgreementDelta | None = None
    assert no_collector_offer == no_debtor_offer  # the runner's convergence test
    assert _settlement(no_collector_offer) is None  # ...but nothing settles


def test_two_matching_partial_offers_are_not_a_convergence() -> None:
    """Both sides agreeing on discount alone is not a settlement."""
    partial = AgreementDelta(disc_ratio=DiscRatio.TEN)
    assert partial == AgreementDelta(disc_ratio=DiscRatio.TEN)
    assert _settlement(partial) is None


def test_trajectory_rejects_an_agreement_on_a_failed_outcome() -> None:
    """Guards against the runner ever attaching a settlement to a dialogue it
    also recorded as a failure — which would corrupt SR and CR together."""
    with pytest.raises(ValueError):
        Trajectory(
            trajectory_id="t",
            account_id="a",
            turns=(),
            agreement=BASELINE_SETTLEMENT,
            outcome=Outcome.NO_AGREEMENT,
        )


# --------------------------------------------------------------------------
# the collector must not see debtor ground truth
# --------------------------------------------------------------------------


def test_account_projection_leaks_no_persona_ground_truth() -> None:
    """§5.1 gives the collector account facts and an inferred archetype only.

    Income, assets, cognition and the true archetype are the answer key. An
    agent that could read them would score well for the wrong reason and every
    metric would be meaningless.
    """
    persona = load_set()[0]
    account = account_from_persona(persona)

    assert isinstance(account, Account)
    assert account.principal == Decimal(persona.background.overdue_amount)
    assert account.days_overdue == persona.background.days_overdue

    # The archetype is *inferred* during the dialogue, never handed over.
    assert account.inferred_archetype is None

    leaked = set(account.model_dump()) & {
        "daily_income",
        "current_assets",
        "cognition",
        "personality",
        "scenario",
        "archetype",
        "overdue_reason",
        "age",
    }
    assert leaked == set(), f"account exposes debtor ground truth: {leaked}"


def test_collector_turns_carry_no_evidence() -> None:
    """Only the debtor discloses evidence — the collector cannot manufacture
    the facts that loosen its own envelope."""
    from domain.enums import CollectorStrategy
    from domain.turn import Turn

    turn = Turn(
        index=0,
        speaker=Speaker.COLLECTOR,
        strategy=CollectorStrategy.REPAYMENT_NEGOTIATION,
        thoughts="",
        action=Action.ASK,
        dialogue="...",
    )
    assert turn.evidence == ()


# --------------------------------------------------------------------------
# the seeded set
# --------------------------------------------------------------------------


def test_committed_persona_set_matches_its_manifest() -> None:
    """§8: metrics across a changing set are meaningless. load_set() verifies
    content hashes and raises DriftError on any edit."""
    personas = load_set()
    assert len(personas) == sum(STRATIFICATION.values()) == 40


def test_persona_set_is_stratified_to_the_observed_distribution() -> None:
    """Table 3: confrontational 38%, avoidant 31%, helpless 25%, cooperative 6%."""
    personas = load_set()
    counts = {a: sum(1 for p in personas if p.archetype is a) for a in Archetype}
    assert counts == STRATIFICATION
    assert counts[Archetype.CONFRONTATIONAL] > counts[Archetype.AVOIDANT]


@pytest.mark.parametrize("size", [4, 8, 12, 16, 20, 28, 39])
def test_every_subset_size_covers_all_four_archetypes(size: int) -> None:
    """A subset that silently dropped an archetype would hide exactly the slice
    most likely to be broken — and would do it invisibly, since the report only
    prints slices that have data."""
    subset = load_set(size=size)
    assert len(subset) == size
    assert {p.archetype for p in subset} == set(Archetype)


def test_subsets_hold_the_observed_distribution() -> None:
    """The mix must survive shrinking, or a small run stops being a smaller
    version of the big one and becomes a different experiment."""
    counts = allocate(16)
    assert sum(counts.values()) == 16
    assert counts[Archetype.CONFRONTATIONAL] >= counts[Archetype.AVOIDANT]
    assert counts[Archetype.AVOIDANT] >= counts[Archetype.HELPLESS]
    assert counts[Archetype.HELPLESS] >= counts[Archetype.COOPERATIVE]


def test_subsets_are_stable_across_calls() -> None:
    """Two agents must be scored on the identical personas. A subset that
    varied between runs would measure the sets, not the agents."""
    first = [p.persona_id for p in load_set(size=STANDARD_SIZE)]
    second = [p.persona_id for p in load_set(size=STANDARD_SIZE)]
    assert first == second

    # And a bigger subset must contain the smaller one, so results stay
    # comparable as the run size grows.
    bigger = {p.persona_id for p in load_set(size=28)}
    assert set(first) <= bigger


def test_seeded_personas_are_financially_under_pressure() -> None:
    """Every debt must be genuinely hard.

    A persona who could clear the debt from savings or a month's pay yields
    SA/LS of comfortably above 1.0 no matter what the agent does, which retires
    two of the nine metrics as discriminators.
    """
    for persona in load_set():
        background = persona.background
        debt = float(background.overdue_amount)
        monthly = float(background.daily_income) * 30
        assets = float(background.current_assets)

        assert 1.5 <= debt / monthly <= 6.0, (
            f"{persona.persona_id} debt too easy/hopeless"
        )
        assert assets <= 0.30 * debt, f"{persona.persona_id} could settle from savings"


def test_persona_specs_are_deterministic_and_collision_free() -> None:
    """The set must be reproducible from the index alone, and must not collapse
    into a handful of repeated characters — the first generated set had 3
    distinct ages and 2 dominant overdue reasons across all 40.
    """
    specs, seq = [], 0
    for archetype in Archetype:
        for i in range(STRATIFICATION[archetype]):
            specs.append(build_spec(archetype, i, seq))
            seq += 1

    # Deterministic: same inputs, same spec.
    assert build_spec(Archetype.HELPLESS, 3, 30) == build_spec(
        Archetype.HELPLESS, 3, 30
    )

    combos = {
        (s.age, s.daily_income, s.overdue_amount, s.overdue_reason) for s in specs
    }
    assert len(combos) == len(specs), "persona specs collide"
    assert len({s.overdue_reason for s in specs}) == 10, "not all reasons represented"
    assert len({s.age for s in specs}) >= 10
