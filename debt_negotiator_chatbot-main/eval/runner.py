"""Running a dialogue to completion.

CLAUDE.md §8: *"Running a dialogue to completion against the simulator is the
test. Six of the nine metrics do not exist without it."*

The collector opens, the debtor replies, and it alternates until the two sides
converge on a complete agreement, the collector escalates, or ``T_MAX`` turns
elapse.

**On T_max.** CLAUDE.md does not specify it and I could not source it from the
paper, so 20 is our number, not theirs. It is recorded in every report because
``AT`` and ``SR`` are both meaningless to compare across different limits.

**On what counts as agreement.** Both sides must be proposing the same complete
four-field settlement, and the collector must have acted ``accept``. A
collector's own optimistic ``accept`` on a half-specified offer does not close a
dialogue — §3.1 requires all four fields, and treating a partial as terminal
would inflate SR for exactly the agents that are worst at closing properly.
"""

from __future__ import annotations

from decimal import Decimal

from domain.account import Account
from domain.agreement import Agreement, AgreementDelta
from domain.enums import Action, Archetype, Outcome, Speaker
from domain.persona import Persona
from domain.trajectory import Trajectory
from eval.agents.baseline import CollectorAgent
from eval.agents.production import DialogueEscalatedError
from eval.simulator import debtor
from eval.types import DialogueResult
from gateway.client import Gateway

T_MAX = 20


def account_from_persona(persona: Persona, *, jurisdiction: str = "uk") -> Account:
    """Project debtor ground truth down to what the institution actually knows.

    This is the only legitimate direction of travel between the two. The
    collector sees the debt, not the person behind it — no income, no assets, no
    cognition, no archetype. Leaking any of that into ``Account`` would let the
    agent read the answer key and quietly invalidate every metric.
    """
    return Account(
        account_id=f"acct-{persona.persona_id}",
        tenant_id="eval",
        jurisdiction=jurisdiction,
        product="unsecured_personal_loan",
        principal=Decimal(persona.background.overdue_amount),
        days_overdue=persona.background.days_overdue,
    )


def _settlement(counterparty_offer: AgreementDelta | None) -> Agreement | None:
    """What an ``accept`` actually closes.

    Accepting means taking the terms *the other side* put on the table — a party
    does not restate the offer it is agreeing to, so requiring both sides to
    independently propose identical deltas would mean no dialogue ever settles.

    It still only closes if that outstanding offer is complete. §3.1 requires
    all four fields, and treating a partial as terminal would inflate SR for
    precisely the agents worst at closing properly: "we agree in principle" is
    not a settlement.
    """
    if counterparty_offer is None:
        return None
    return counterparty_offer.to_agreement()


def run_dialogue(
    gateway: Gateway,
    agent: CollectorAgent,
    persona: Persona,
    *,
    t_max: int = T_MAX,
    jurisdiction: str = "uk",
) -> DialogueResult:
    """One persona, one collector, run to a terminal state."""
    account = account_from_persona(persona, jurisdiction=jurisdiction)
    trajectory = Trajectory(
        trajectory_id=f"traj-{persona.persona_id}", account_id=account.account_id
    )

    last_collector_offer: AgreementDelta | None = None
    last_debtor_offer: AgreementDelta | None = None
    outcome = Outcome.TURN_LIMIT
    agreement: Agreement | None = None

    for index in range(t_max):
        speaker = Speaker.COLLECTOR if index % 2 == 0 else Speaker.DEBTOR

        if speaker is Speaker.COLLECTOR:
            try:
                turn = agent.respond(account, trajectory, index=index)
            except DialogueEscalatedError as handoff:
                # A handoff is a terminal state, not a failure to close. It is
                # scored as ESCALATED rather than NO_AGREEMENT so the metrics
                # can distinguish "correctly stopped" from "could not settle".
                del handoff
                outcome = Outcome.ESCALATED
                break
            if turn.proposed is not None:
                last_collector_offer = (
                    turn.proposed
                    if last_collector_offer is None
                    else last_collector_offer.merged_with(turn.proposed)
                )
        else:
            turn = debtor.respond(gateway, persona, trajectory, index=index)
            if turn.proposed is not None:
                last_debtor_offer = (
                    turn.proposed
                    if last_debtor_offer is None
                    else last_debtor_offer.merged_with(turn.proposed)
                )

        trajectory = trajectory.model_copy(update={"turns": (*trajectory.turns, turn)})

        settled = None
        if turn.action is Action.ACCEPT:
            # You accept what the OTHER side offered, not your own position.
            settled = _settlement(
                last_debtor_offer
                if speaker is Speaker.COLLECTOR
                else last_collector_offer
            )
        elif last_collector_offer == last_debtor_offer:
            # Convergence without anyone saying the word. Both sides ended up
            # proposing identical complete terms — that is an agreement, and
            # requiring an explicit `accept` on top of it under-counts SR.
            # Two helpless dialogues in the first live run converged on
            # 30/5/14/24 and were scored as failures purely for want of a
            # label, which flattered the baseline on exactly the settlements
            # where it had conceded most.
            settled = _settlement(last_collector_offer)

        if settled is not None:
            agreement, outcome = settled, Outcome.AGREEMENT
            break

    # ESCALATED must survive: an escalation on the final turn is still a
    # handoff, not a failure to close within the limit.
    if outcome not in (Outcome.AGREEMENT, Outcome.ESCALATED) and (
        trajectory.turn_count >= t_max
    ):
        outcome = Outcome.TURN_LIMIT

    return DialogueResult(
        persona=persona,
        account=account,
        trajectory=trajectory.model_copy(
            update={"agreement": agreement, "outcome": outcome}
        ),
    )


def archetype_counts(results: list[DialogueResult]) -> dict[Archetype, int]:
    counts: dict[Archetype, int] = {}
    for result in results:
        counts[result.archetype] = counts.get(result.archetype, 0) + 1
    return counts
