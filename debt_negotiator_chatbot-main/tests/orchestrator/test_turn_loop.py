"""The §5 turn loop.

The behaviour under test is the one CLAUDE.md is most emphatic about: a turn
that fails policy or compliance is **never returned**. It is regenerated with
the violation fed back, and after two retries the session escalates to a human.

These use a scripted collector rather than a live model. What matters is that
the loop reacts correctly to bad output, and the reliable way to test that is to
guarantee bad output rather than hope a model produces some.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from agent.collector import Generation
from domain.account import Account
from domain.agreement import AgreementDelta
from domain.enums import Action, CollectorStrategy, DiscRatio, PmtRatio, Speaker
from domain.turn import Turn
from guardrails.triggers import EscalationTrigger
from orchestrator.loop import MAX_RETRIES, TurnRequest, run_turn

ACCOUNT = Account(
    account_id="a1",
    tenant_id="t1",
    jurisdiction="uk",
    product="loan",
    principal=Decimal("5000"),
    days_overdue=90,
)

COMPLIANT_OPENING = (
    "Hello, I'm calling from the collections team regarding your overdue "
    "loan account. I'd like to understand your situation and agree a way "
    "forward."
)


class ScriptedCollector:
    """Returns pre-written turns so the loop's reaction is what is tested."""

    name = "scripted"

    def __init__(self, script: list[tuple[str, AgreementDelta | None]]) -> None:
        self.script = script
        self.calls = 0
        self.feedback_seen: list[str] = []

    def generate(self, **kwargs: object) -> Generation:
        feedback = str(kwargs.get("violation_feedback", ""))
        self.feedback_seen.append(feedback)
        dialogue, proposed = self.script[min(self.calls, len(self.script) - 1)]
        self.calls += 1
        index = int(kwargs["index"])  # type: ignore[call-overload]
        return Generation(
            turn=Turn(
                index=index,
                speaker=Speaker.COLLECTOR,
                strategy=CollectorStrategy.REPAYMENT_NEGOTIATION,
                thoughts="",
                action=Action.ASK,
                dialogue=dialogue,
                proposed=proposed,
            ),
            model="scripted-model",
            prompt_version="collector_v1",
        )


class UnusedGateway:
    """Asserts the loop makes no model call at all.

    Used where a call would itself be the bug — an escalation trigger firing, or
    a jurisdiction that failed to load, must short-circuit before any spend.
    """

    def complete(self, *args: object, **kwargs: object) -> object:
        raise AssertionError("gateway should not have been called")


class StubExtractorGateway:
    """Returns a fixed extraction, so a debtor message can be processed without
    a live model. ``claims`` lets a test feed the loop adversarial output."""

    def __init__(self, claims: list[str] | None = None) -> None:
        self.claims = claims or []
        self.calls = 0

    def complete(self, *args: object, **kwargs: object) -> object:
        self.calls += 1
        import json

        from gateway.client import GatewayResponse
        from gateway.roles import ModelRole

        return GatewayResponse(
            role=ModelRole.EXTRACTOR,
            model="stub-extractor",
            text=json.dumps({"evidence": self.claims, "reasoning": "stub"}),
        )


# --------------------------------------------------------------------------
# policy enforcement in the loop
# --------------------------------------------------------------------------


def test_compliant_turn_is_returned_on_the_first_attempt() -> None:
    collector = ScriptedCollector([(COMPLIANT_OPENING, None)])
    outcome = run_turn(
        UnusedGateway(),
        collector,
        TurnRequest(account=ACCOUNT),  # type: ignore[arg-type]
    )

    assert outcome.escalated is False
    assert outcome.turn is not None
    assert len(outcome.attempts) == 1
    assert outcome.attempts[0].accepted is True


def test_offer_outside_the_envelope_is_rejected_and_regenerated() -> None:
    """The Figure 9 offer, at the loop level. It must never reach the caller."""
    over_conceding = AgreementDelta(
        disc_ratio=DiscRatio.THIRTY, pmt_ratio=PmtRatio.FIFTEEN
    )
    collector = ScriptedCollector(
        [
            (COMPLIANT_OPENING, over_conceding),  # rejected
            (COMPLIANT_OPENING, None),  # complies
        ]
    )
    outcome = run_turn(
        UnusedGateway(),
        collector,
        TurnRequest(account=ACCOUNT),  # type: ignore[arg-type]
    )

    assert outcome.escalated is False
    assert len(outcome.attempts) == 2
    assert outcome.attempts[0].accepted is False
    assert outcome.attempts[1].accepted is True
    # The returned turn is the compliant one, not the over-conceding one.
    assert outcome.turn is not None
    assert outcome.turn.proposed is None


def test_the_violation_is_fed_back_into_the_retry() -> None:
    """§5.6 says regenerate *with the violation fed back* — an uninformed
    re-roll would just produce the same offer again."""
    collector = ScriptedCollector(
        [
            (COMPLIANT_OPENING, AgreementDelta(disc_ratio=DiscRatio.THIRTY)),
            (COMPLIANT_OPENING, None),
        ]
    )
    run_turn(UnusedGateway(), collector, TurnRequest(account=ACCOUNT))  # type: ignore[arg-type]

    assert collector.feedback_seen[0] == ""  # first attempt has no feedback
    assert "disc_ratio" in collector.feedback_seen[1]
    assert "maximum discount is 0%" in collector.feedback_seen[1]


def test_persistent_violation_escalates_instead_of_returning_a_bad_turn() -> None:
    """The contract that matters: retry exhaustion produces a handoff, never a
    non-compliant turn that happens to be the least bad of three."""
    collector = ScriptedCollector(
        [(COMPLIANT_OPENING, AgreementDelta(disc_ratio=DiscRatio.THIRTY))]
    )
    outcome = run_turn(
        UnusedGateway(),
        collector,
        TurnRequest(account=ACCOUNT),  # type: ignore[arg-type]
    )

    assert outcome.escalated is True
    assert outcome.escalation_trigger is EscalationTrigger.RETRY_EXHAUSTED
    assert outcome.turn is None  # nothing is returned to the caller
    assert len(outcome.attempts) == MAX_RETRIES + 1
    assert all(a.accepted is False for a in outcome.attempts)


def test_every_attempt_is_recorded_including_rejected_ones() -> None:
    """§7. "The model tried to offer 30% and we stopped it" is exactly what an
    auditor needs, and it is invisible if only accepted output is kept."""
    collector = ScriptedCollector(
        [
            (COMPLIANT_OPENING, AgreementDelta(disc_ratio=DiscRatio.THIRTY)),
            (COMPLIANT_OPENING, None),
        ]
    )
    outcome = run_turn(
        UnusedGateway(),
        collector,
        TurnRequest(account=ACCOUNT),  # type: ignore[arg-type]
    )

    rejected = outcome.attempts[0]
    assert rejected.proposed == {
        "disc_ratio": 30,
        "pmt_ratio": None,
        "pmt_days": None,
        "inst_prds": None,
    }
    assert rejected.policy.approved is False
    assert rejected.model == "scripted-model"
    assert rejected.prompt_version == "collector_v1"


# --------------------------------------------------------------------------
# guardrails in the loop
# --------------------------------------------------------------------------


def test_non_compliant_language_is_rejected_and_regenerated() -> None:
    collector = ScriptedCollector(
        [
            ("We will take you to court if you don't pay today.", None),
            (COMPLIANT_OPENING, None),
        ]
    )
    outcome = run_turn(
        UnusedGateway(),
        collector,
        TurnRequest(account=ACCOUNT),  # type: ignore[arg-type]
    )

    assert outcome.attempts[0].compliance.passed is False
    assert outcome.attempts[1].accepted is True
    assert outcome.turn is not None
    assert "court" not in outcome.turn.dialogue.lower()


def test_opening_turn_must_disclose_identity() -> None:
    """§6: identity and purpose disclosed on turn one."""
    collector = ScriptedCollector(
        [("So how much can you pay this week?", None), (COMPLIANT_OPENING, None)]
    )
    outcome = run_turn(
        UnusedGateway(),
        collector,
        TurnRequest(account=ACCOUNT),  # type: ignore[arg-type]
    )

    codes = {f.code.value for f in outcome.attempts[0].compliance.findings}
    assert "identity_not_disclosed" in codes
    assert outcome.attempts[1].accepted is True


# --------------------------------------------------------------------------
# escalation triggers run before generation
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        (
            "Prove I owe this debt before you call me again.",
            EscalationTrigger.WRITTEN_VALIDATION_REQUESTED,
        ),
        ("I don't owe this, it's not my debt.", EscalationTrigger.DEBT_DISPUTED),
        (
            "I'm filing for bankruptcy next month.",
            EscalationTrigger.BANKRUPTCY_OR_INSOLVENCY,
        ),
        (
            "You'll have to speak to my solicitor from now on.",
            EscalationTrigger.LEGAL_REPRESENTATION,
        ),
        (
            "I honestly can't cope any more, I've thought about ending it all.",
            EscalationTrigger.DISTRESS_OR_SELF_HARM,
        ),
    ],
)
def test_trigger_escalates_without_generating_a_turn(
    message: str, expected: EscalationTrigger
) -> None:
    """The agent does not get a turn in which to argue with a handoff condition.

    The written-validation case is the one the naive baseline missed entirely in
    the Phase 2 transcripts — it kept negotiating for another sixteen turns.
    Note this is a request to validate the DEBT; merely challenging who is
    calling is handled without a handoff (see test_guardrails.py).
    """
    collector = ScriptedCollector([(COMPLIANT_OPENING, None)])
    outcome = run_turn(
        UnusedGateway(),  # type: ignore[arg-type]
        collector,
        TurnRequest(account=ACCOUNT, debtor_message=message),
    )

    assert outcome.escalated is True
    assert outcome.escalation_trigger is expected
    assert outcome.turn is None
    assert collector.calls == 0, "the collector was asked to generate anyway"


def test_ordinary_pushback_does_not_escalate() -> None:
    """Escalation is tuned to over-trigger, but not so far that normal
    hostility ends every confrontational conversation on turn one — that
    segment is 38% of the population."""
    collector = ScriptedCollector([(COMPLIANT_OPENING, None)])
    outcome = run_turn(
        StubExtractorGateway(),  # type: ignore[arg-type]
        collector,
        TurnRequest(
            account=ACCOUNT,
            debtor_message="This is ridiculous. I'm not paying that much.",
        ),
    )
    assert outcome.escalated is False
    assert outcome.turn is not None


def test_a_compromised_extractor_cannot_widen_the_envelope() -> None:
    """End-to-end form of the evidence barrier.

    The extractor claims every verified tier at once — a prompt-injected or
    simply broken extractor. The envelope handed to the collector still permits
    no discount whatsoever.
    """
    from domain.evidence import EvidenceKind

    collector = ScriptedCollector([(COMPLIANT_OPENING, None)])
    outcome = run_turn(
        StubExtractorGateway([k.value for k in EvidenceKind]),  # type: ignore[arg-type]
        collector,
        TurnRequest(
            account=ACCOUNT,
            debtor_message="I lost my job, I have the letter right here.",
        ),
    )

    assert outcome.envelope.max_disc_ratio == 0
    assert all(
        e.kind
        in {
            EvidenceKind.HARDSHIP_CLAIMED,
            EvidenceKind.LIQUIDITY_CONSTRAINED,
            EvidenceKind.ASSETS_DISCLOSED,
        }
        for e in outcome.evidence_admitted
    )
    assert outcome.evidence_rejected, "verified tiers should be recorded as refused"


# --------------------------------------------------------------------------
# fail closed
# --------------------------------------------------------------------------


def test_unknown_jurisdiction_escalates_rather_than_negotiating() -> None:
    """§7: "Never negotiate without knowing the rules of the jurisdiction."

    A soft degrade here is the single failure mode the spec names outright.
    """
    collector = ScriptedCollector([(COMPLIANT_OPENING, None)])
    outcome = run_turn(
        UnusedGateway(),  # type: ignore[arg-type]
        collector,
        TurnRequest(account=ACCOUNT.model_copy(update={"jurisdiction": "atlantis"})),
    )

    assert outcome.escalated is True
    assert outcome.escalation_trigger is EscalationTrigger.GUARDRAIL_BREACH
    assert "atlantis" in outcome.escalation_detail
    assert collector.calls == 0


def test_retrieved_refs_are_captured_for_the_audit() -> None:
    """§7: "Cite in the audit record." Which pack version produced this offer
    must be answerable."""
    collector = ScriptedCollector([(COMPLIANT_OPENING, None)])
    outcome = run_turn(
        UnusedGateway(),
        collector,
        TurnRequest(account=ACCOUNT),  # type: ignore[arg-type]
    )

    assert outcome.retrieved_refs
    assert all(ref.startswith("uk/") for ref in outcome.retrieved_refs)
