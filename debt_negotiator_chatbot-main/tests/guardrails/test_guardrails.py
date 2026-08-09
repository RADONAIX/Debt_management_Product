"""Guardrails: compliance checks and escalation triggers (CLAUDE.md §6)."""

from __future__ import annotations

import pytest

from guardrails.compliance import ComplianceCode, check
from guardrails.triggers import (
    COMPLAINT_ESCALATION_THRESHOLD,
    EscalationTrigger,
    is_authority_challenge,
    scan_conversation,
    scan_message,
)

CLEAN_OPENING = (
    "Hello, I'm calling from the collections team about your overdue loan "
    "account. I'd like to understand your circumstances."
)


# --------------------------------------------------------------------------
# compliance on the collector's own words
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("utterance", "code"),
    [
        (
            "We will take you to court if this isn't paid.",
            ComplianceCode.UNLAWFUL_THREAT,
        ),
        ("Bailiffs will be sent to your home.", ComplianceCode.UNLAWFUL_THREAT),
        (
            "This is your final warning before we act.",
            ComplianceCode.MISREPRESENTED_CONSEQUENCE,
        ),
        (
            "This will permanently destroy your credit.",
            ComplianceCode.MISREPRESENTED_CONSEQUENCE,
        ),
        (
            "We'll speak to your employer about this.",
            ComplianceCode.THIRD_PARTY_DISCLOSURE,
        ),
        (
            "Could you borrow from a family member to clear it?",
            ComplianceCode.PRESSURE_TO_BORROW,
        ),
        ("Stop making excuses and pay.", ComplianceCode.ABUSIVE_LANGUAGE),
    ],
)
def test_non_compliant_utterances_are_caught(
    utterance: str, code: ComplianceCode
) -> None:
    result = check(utterance, turn_index=3)
    assert result.passed is False
    assert code in {f.code for f in result.findings}


def test_accurate_description_of_consequences_is_permitted() -> None:
    """§6 forbids threatening what will not happen — not explaining what could.

    Getting this wrong in the other direction would make `legal_deterrent`
    unusable, and it is one of the nine strategies.
    """
    result = check(
        "If we can't agree an arrangement, the account may be passed to our "
        "recoveries team, and court action is one possible outcome. I'd much "
        "rather we avoided that.",
        turn_index=4,
    )
    assert result.passed is True


def test_identity_required_on_the_opening_turn_only() -> None:
    bare = "So, how much can you pay this week?"
    assert check(bare, turn_index=0).passed is False
    assert check(bare, turn_index=1).passed is True

    assert check(CLEAN_OPENING, turn_index=0).passed is True


def test_findings_are_structured_for_regeneration_feedback() -> None:
    """§5.6 feeds these back into the retry, so they must be specific enough to
    act on rather than a generic refusal."""
    result = check("We will take you to court today.", turn_index=2)
    feedback = result.feedback()
    assert "unlawful_threat" in feedback
    assert "court" in feedback


# --------------------------------------------------------------------------
# escalation triggers on the debtor's words
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("message", "trigger"),
    [
        (
            "Send me proof that I owe this.",
            EscalationTrigger.WRITTEN_VALIDATION_REQUESTED,
        ),
        ("Prove I owe this money.", EscalationTrigger.WRITTEN_VALIDATION_REQUESTED),
        (
            "I want a full statement of account before I pay anything.",
            EscalationTrigger.WRITTEN_VALIDATION_REQUESTED,
        ),
        (
            "Send me a copy of the credit agreement.",
            EscalationTrigger.WRITTEN_VALIDATION_REQUESTED,
        ),
        (
            "Where's the proof I ever signed for this?",
            EscalationTrigger.WRITTEN_VALIDATION_REQUESTED,
        ),
        ("I never took out this loan.", EscalationTrigger.DEBT_DISPUTED),
        ("You've got the wrong person.", EscalationTrigger.DEBT_DISPUTED),
        ("I already paid this off months ago.", EscalationTrigger.DEBT_DISPUTED),
        ("I'm starting an IVA.", EscalationTrigger.BANKRUPTCY_OR_INSOLVENCY),
        ("I've been declared bankrupt.", EscalationTrigger.BANKRUPTCY_OR_INSOLVENCY),
        ("StepChange are handling my debts.", EscalationTrigger.LEGAL_REPRESENTATION),
        ("Talk to my solicitor.", EscalationTrigger.LEGAL_REPRESENTATION),
        ("I can't take this any more.", EscalationTrigger.DISTRESS_OR_SELF_HARM),
        ("I've thought about self-harm.", EscalationTrigger.DISTRESS_OR_SELF_HARM),
        ("He's not here, I'm his wife.", EscalationTrigger.THIRD_PARTY_SPEAKING),
    ],
)
def test_escalation_triggers_fire(message: str, trigger: EscalationTrigger) -> None:
    assert trigger in {h.trigger for h in scan_message(message)}


def test_challenging_the_caller_is_not_challenging_the_debt() -> None:
    """The distinction that rescued the confrontational segment.

    Verbatim from a Phase 2 transcript. An earlier version escalated this as a
    written-validation request, which meant every confrontational dialogue was
    handed to a human on turn one — all six of them on the 16-persona run, three
    on the debtor's opening message. Read in full it is plainly a challenge to
    the CALLER's legitimacy, not a request to validate the DEBT, and the correct
    response is to identify yourself.
    """
    message = (
        "No, I'm not handing over my details just because you say a company "
        "name. Put it in writing and send proof."
    )
    assert scan_message(message) == ()
    assert is_authority_challenge(message) is True


@pytest.mark.parametrize(
    "message",
    [
        "Who exactly are you and who gave you my number?",
        "What company is this? I'm not confirming anything on a cold call.",
        "What authority do you have to contact me? Put it in writing.",
        "How do I know you're legitimate?",
    ],
)
def test_authority_challenges_do_not_escalate(message: str) -> None:
    """A debtor asking who is calling is exercising an ordinary right. Handing
    that to a queue treats a reasonable question as a terminal event — and this
    is the confrontational archetype's standard opening move, 38% of the book."""
    assert scan_message(message) == ()
    assert is_authority_challenge(message) is True


@pytest.mark.parametrize(
    "message",
    [
        "Prove I owe this debt.",
        "Send me proof that I owe anything.",
        "I want a copy of the credit agreement.",
        "Give me a full statement of account.",
    ],
)
def test_debt_validation_still_escalates(message: str) -> None:
    """Narrowing the trigger must not blunt it. Once the debtor asks for proof
    the obligation exists, §6's hard handoff applies regardless of how the
    message opened."""
    assert EscalationTrigger.WRITTEN_VALIDATION_REQUESTED in {
        h.trigger for h in scan_message(message)
    }


def test_a_validation_request_escalates_even_inside_an_authority_challenge() -> None:
    """The two are not mutually exclusive, and the handoff must win."""
    message = (
        "Who even are you? What company is this? And prove I owe this debt "
        "before you call again."
    )
    assert is_authority_challenge(message) is True
    assert EscalationTrigger.WRITTEN_VALIDATION_REQUESTED in {
        h.trigger for h in scan_message(message)
    }


@pytest.mark.parametrize(
    "message",
    [
        "This is ridiculous, I'm not paying that.",
        "I already told you I can't afford it.",
        "Why are you calling me again?",
        "I'll think about it and call you back.",
        "That's still too much for me right now.",
    ],
)
def test_ordinary_hostility_does_not_escalate(message: str) -> None:
    """Confrontational debtors are 38% of the population. If routine pushback
    escalated, the agent would hand off the largest segment on turn one and the
    product would be pointless."""
    assert scan_message(message) == ()


def test_repeated_complaints_escalate_but_a_single_one_does_not() -> None:
    """§6 says *repeated* complaint escalation. One angry mention of the
    ombudsman is ordinary in this population."""
    first = "I'm going to complain about this."
    assert scan_conversation(first, []) == ()

    hits = scan_conversation("I'm reporting you to the ombudsman.", [first])
    assert EscalationTrigger.REPEATED_COMPLAINT in {h.trigger for h in hits}
    assert COMPLAINT_ESCALATION_THRESHOLD == 2
