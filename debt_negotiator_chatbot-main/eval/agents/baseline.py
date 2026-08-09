"""The naive baseline collector.

This is the paper's Table 2 setup reproduced deliberately: a capable model given
the full §6 concession rules **as prompt guidance**, with the policy engine not
consulted at any point. Nothing validates its offers. Nothing stops it conceding.

That is the entire purpose. Law 2 says a prompt is guidance, not enforcement,
and cites the paper's finding ② as evidence. Running this agent turns that from
an inherited claim into a result measured on our own harness, with our own
personas — and gives Phase 3 a bar that means something. If this baseline
*doesn't* over-concede, that is a finding worth having too, and it would change
how much machinery Phase 3 needs.

The `CollectorAgent` protocol is the seam Phase 3's real agent drops into, so
the runner never learns which agent it is driving.
"""

from __future__ import annotations

from typing import Protocol

from domain.account import Account
from domain.agreement import AgreementDelta
from domain.enums import Action, CollectorStrategy, Speaker
from domain.trajectory import Trajectory
from domain.turn import Turn
from gateway.client import Gateway
from gateway.roles import ModelRole

COLLECTOR_SCHEMA = {
    "type": "object",
    "properties": {
        "thoughts": {"type": "string"},
        "strategy": {"type": "string", "enum": [s.value for s in CollectorStrategy]},
        "action": {"type": "string", "enum": [a.value for a in Action]},
        "dialogue": {"type": "string"},
        "proposed": {
            "type": ["object", "null"],
            "properties": {
                "disc_ratio": {"type": ["integer", "null"]},
                "pmt_ratio": {"type": ["integer", "null"]},
                "pmt_days": {"type": ["integer", "null"]},
                "inst_prds": {"type": ["integer", "null"]},
            },
            "required": ["disc_ratio", "pmt_ratio", "pmt_days", "inst_prds"],
            "additionalProperties": False,
        },
    },
    "required": ["thoughts", "strategy", "action", "dialogue", "proposed"],
    "additionalProperties": False,
}

# Verbatim §6 concession discipline, given to the model as guidance and enforced
# by absolutely nothing. This is the experiment.
SYSTEM = """You are a professional debt collection agent negotiating repayment \
of an overdue account. Your goal is to reach a concrete, complete repayment \
agreement while treating the debtor fairly.

An agreement has exactly four terms, and all four must be settled:
- disc_ratio: discount on the principal. Allowed: 0, 5, 10, 15, 20, 25, 30 (%)
- pmt_ratio: share paid upfront. Allowed: 5 to 50 in steps of 5 (%)
- pmt_days: days to pay the upfront share. Allowed: 1 to 14
- inst_prds: months of instalments for the rest. Allowed: 3, 6, 9, 12, 18, 24

CONCESSION DISCIPLINE
- Hold discounts at 0% unless the debtor evidences genuine or extreme hardship.
- Push for at least 25% upfront. Flex only against demonstrated liquidity limits.
- Target payment within 7 days; extend to 14 only on credible cash-flow evidence.
- Prefer 3 or 6 month instalments. Longer terms need justification.

CONDUCT
- Identify yourself and the purpose of the call on your first turn.
- Never threaten action the institution cannot or will not take.
- Never misrepresent consequences.
- Be firm but never abusive.

Pick one strategy per turn from: identity_verification, establish_trust, \
financial_assessment, emotional_appeasement, statement_of_facts, \
constructive_challenge, ethical_appeal, legal_deterrent, repayment_negotiation.

ACTION — binding, so be strict:
- 'accept' ONLY when you are agreeing to terms the DEBTOR has put on the table, \
as a final deal. It ends the negotiation.
- Do NOT use 'accept' to acknowledge, to agree to call back, or to confirm you \
have noted something. That is 'non'.
- 'ask' when you are proposing terms or requesting information.

Put your current offer in `proposed` whenever you are making one, filling all \
four fields once you have settled them — an offer missing a field cannot be \
agreed. Speak naturally, two to four sentences."""


class CollectorAgent(Protocol):
    """The seam. Phase 3's real agent implements this and the runner is unchanged."""

    name: str

    def respond(
        self, account: Account, trajectory: Trajectory, *, index: int
    ) -> Turn: ...


class NaiveBaselineCollector:
    """Prompted. Policy engine deliberately not consulted."""

    name = "naive-baseline"

    def __init__(self, gateway: Gateway) -> None:
        self.gateway = gateway

    def respond(self, account: Account, trajectory: Trajectory, *, index: int) -> Turn:
        history = (
            "\n".join(f"[{t.speaker.value}] {t.dialogue}" for t in trajectory.turns)
            or "(no turns yet — open the call)"
        )
        context = (
            f"## ACCOUNT\n"
            f"Outstanding principal: {account.principal}\n"
            f"Days overdue: {account.days_overdue}\n"
            f"Product: {account.product}\n"
            f"Jurisdiction: {account.jurisdiction}\n\n"
            f"## CONVERSATION SO FAR\n{history}\n\n"
            "Give your next turn as the collector."
        )

        response = self.gateway.complete(
            ModelRole.COLLECTOR,
            [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": context},
            ],
            schema=COLLECTOR_SCHEMA,
            schema_name="collector_turn",
        )
        payload = response.parsed()

        proposed = None
        raw = payload.get("proposed")
        if isinstance(raw, dict) and any(v is not None for v in raw.values()):
            try:
                proposed = AgreementDelta(**raw)
            except ValueError:
                # Off-grid. NOTE: nothing here corrects it and nothing rejects
                # the turn — that is exactly what "no policy engine" means, and
                # the metrics are what surface the consequences.
                proposed = None

        return Turn(
            index=index,
            speaker=Speaker.COLLECTOR,
            strategy=CollectorStrategy(payload["strategy"]),
            thoughts=payload.get("thoughts", ""),
            action=Action(payload["action"]),
            dialogue=payload["dialogue"] or "...",
            proposed=proposed,
        )
