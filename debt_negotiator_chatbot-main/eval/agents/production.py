"""Adapter running the real production agent through the eval harness.

Implements the same ``CollectorAgent`` protocol as the naive baseline, so the
runner does not learn which agent it is driving and both are scored on identical
personas with identical metrics.

**It drives the real turn loop**, not a simplified copy: retrieval fail-closed,
escalation triggers, the evidence extractor, policy validation, guardrails, and
retry-and-escalate. Reimplementing a lighter version here would benchmark
something we do not ship.

One consequence worth stating plainly: this agent runs its own extractor over
the debtor's utterance rather than trusting the simulator's declared evidence.
That is deliberate — production has no declared evidence, and testing against
the simulator's self-report would measure a path that does not exist.
"""

from __future__ import annotations

from agent.collector import ProductionCollector
from domain.account import Account
from domain.enums import Speaker
from domain.trajectory import Trajectory
from domain.turn import Turn
from gateway.client import Gateway
from guardrails.triggers import EscalationTrigger
from orchestrator.loop import TurnRequest, run_turn
from persistence.repository import last_collector_offer
from policy.ladder import ConcessionLedger, apply_all


class DialogueEscalatedError(RuntimeError):
    """The agent handed off. The dialogue ends — it is not a failure to close,
    it is the correct outcome for the condition that fired."""

    def __init__(self, trigger: EscalationTrigger, detail: str) -> None:
        super().__init__(f"{trigger.value}: {detail}")
        self.trigger = trigger
        self.detail = detail


class ProductionCollectorAgent:
    """The shipped negotiator, wrapped for the harness."""

    name = "negotiator"

    def __init__(self, gateway: Gateway) -> None:
        self.gateway = gateway
        self.collector = ProductionCollector(gateway)

    def respond(self, account: Account, trajectory: Trajectory, *, index: int) -> Turn:
        turns = trajectory.turns

        # The loop re-appends the debtor turn it is given, so hand it the
        # history *before* that turn plus the message itself.
        debtor_message: str | None = None
        if turns and turns[-1].speaker is Speaker.DEBTOR:
            debtor_message = turns[-1].dialogue
            turns = turns[:-1]

        outcome = run_turn(
            self.gateway,
            self.collector,
            TurnRequest(
                account=account,
                turns=turns,
                ledger=self._ledger(trajectory),
                debtor_message=debtor_message,
                debtor_proposal=(
                    trajectory.turns[-1].proposed if trajectory.turns else None
                ),
                last_collector_offer=last_collector_offer(trajectory.turns),
            ),
        )

        if outcome.escalated or outcome.turn is None:
            raise DialogueEscalatedError(
                outcome.escalation_trigger or EscalationTrigger.GUARDRAIL_BREACH,
                outcome.escalation_detail,
            )

        return outcome.turn.model_copy(update={"index": index})

    @staticmethod
    def _ledger(trajectory: Trajectory) -> ConcessionLedger:
        """Rebuilt from the evidence on record, exactly as the API does.

        Note this uses the evidence the *extractor* admitted on previous turns,
        which the loop wrote back onto the debtor turns — not anything the
        simulator declared about itself.
        """
        return apply_all(trajectory.evidence_so_far())
