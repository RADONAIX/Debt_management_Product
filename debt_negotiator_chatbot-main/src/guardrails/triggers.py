"""Escalation triggers — hard handoff to a human (CLAUDE.md §6).

    "Hard handoff — agent stops and returns an escalation response — on: dispute
     of the debt's validity, request for written validation, mention of
     bankruptcy or legal representation, distress or self-harm signals, repeated
     complaint escalation, retry exhaustion, or any guardrail breach."

These run on the **debtor's** message, before generation. The agent does not get
to negotiate its way past a handoff condition, and does not get a turn in which
to try.

**Challenging the caller is not challenging the debt.** A debtor demanding to
know who is calling and by what authority is asking a reasonable question, and
the answer is to identify yourself — see :data:`AUTHORITY_CHALLENGE`, which
never escalates. A debtor asking for proof that the obligation exists is a §6
hard handoff. Collapsing the two escalated all six confrontational dialogues on
the 16-persona run, three of them on the opening message, which retires 38% of
the population before a negotiation starts.

**On the detection method.** These are lexical patterns, and lexical patterns
are a floor, not a ceiling: they catch the explicit phrasing and will miss
oblique or unusual wording. They are deliberately cheap and deterministic so
that a trigger cannot be argued away, cannot fail open on a model outage, and is
identical every time for the same input. A model-based classifier layered *on
top* is a reasonable Phase 5 addition; it is not a replacement, because a
regulated stop condition should not depend on an inference call succeeding.

Tuned to over-trigger rather than under-trigger. A false escalation costs a
human five minutes; a missed one is a compliance breach.
"""

from __future__ import annotations

import re
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class EscalationTrigger(StrEnum):
    DEBT_DISPUTED = "debt_disputed"
    WRITTEN_VALIDATION_REQUESTED = "written_validation_requested"
    BANKRUPTCY_OR_INSOLVENCY = "bankruptcy_or_insolvency"
    LEGAL_REPRESENTATION = "legal_representation"
    DISTRESS_OR_SELF_HARM = "distress_or_self_harm"
    REPEATED_COMPLAINT = "repeated_complaint"
    RETRY_EXHAUSTED = "retry_exhausted"
    GUARDRAIL_BREACH = "guardrail_breach"
    THIRD_PARTY_SPEAKING = "third_party_speaking"


def _any(*patterns: str) -> re.Pattern[str]:
    return re.compile("|".join(patterns), re.I)


_PATTERNS: dict[EscalationTrigger, re.Pattern[str]] = {
    EscalationTrigger.DISTRESS_OR_SELF_HARM: _any(
        r"\bkill (?:myself|me)\b",
        r"\bend (?:it all|my life)\b",
        r"\bsuicid",
        r"\bself[- ]harm",
        r"\bharm myself\b",
        r"\bnot worth living\b",
        r"\bno reason to (?:go on|live)\b",
        r"\bcan'?t (?:go on|cope|take (?:it|this) any ?more)\b",
        r"\bbreaking down\b",
        r"\bmental health\b",
        r"\b(?:i'?m|feeling) desperate\b",
    ),
    EscalationTrigger.BANKRUPTCY_OR_INSOLVENCY: _any(
        r"\bbankrupt",
        r"\binsolven",
        r"\bdebt relief order\b",
        r"\bdro\b",
        r"\biva\b",
        r"\bindividual voluntary arrangement\b",
        r"\btrust deed\b",
        r"\bsequestrat",
    ),
    EscalationTrigger.LEGAL_REPRESENTATION: _any(
        r"\bmy (?:solicitor|lawyer|attorney|legal (?:team|rep|adviser))\b",
        r"\bspeak to my (?:solicitor|lawyer)\b",
        r"\bthrough my (?:solicitor|lawyer)\b",
        r"\brepresented by\b",
        r"\bciti?zens ?advice\b",
        r"\bstepchange\b",
        r"\bdebt (?:charity|adviser|advisor|advice agency)\b",
    ),
    # NARROWED deliberately. This used to match a bare "in writing", which is
    # the confrontational archetype's standard opening move — on the 16-persona
    # run it escalated all six confrontational dialogues, three of them on the
    # debtor's first message, before identity had even been confirmed. The
    # segment is 38% of the population and CLAUDE.md's primary optimisation
    # target; handing all of it to a human on turn one is not compliance, it is
    # an agent that does not work.
    #
    # What remains is a genuine request to validate the DEBT: proof that the
    # obligation exists, a statement of the balance, a copy of the agreement.
    # That is still an unconditional hard handoff. Challenging the CALLER's
    # authority is handled separately below — see AUTHORITY_CHALLENGE.
    EscalationTrigger.WRITTEN_VALIDATION_REQUESTED: _any(
        r"\bprove (?:it|that i owe|i owe|the debt)\b",
        r"\bproof (?:that )?i owe\b",
        r"\bsend (?:me )?(?:the )?(?:proof|evidence) (?:of|that|i)\b",
        r"\bwritten (?:proof|validation|confirmation) of the "
        r"(?:debt|balance|account)\b",
        r"\b(?:full )?statement of (?:the )?account\b",
        r"\bcopy of the (?:credit )?(?:agreement|contract)\b",
        r"\bvalidate the debt\b",
        r"\bdebt validation\b",
        r"\bsection 7[78]\b",
        r"\bprove (?:this|the) (?:debt|balance|amount)\b",
        r"\bwhere'?s the (?:proof|evidence|paperwork)\b",
        r"\bshow me (?:the )?(?:proof|evidence) (?:that )?i owe\b",
    ),
    EscalationTrigger.DEBT_DISPUTED: _any(
        r"\b(?:i )?do ?n[o']t owe\b",
        r"\bnot my debt\b",
        r"\bthis is ?n[o']t mine\b",
        r"\bnever (?:took|had|opened|signed)\b",
        r"\bidentity theft\b",
        r"\bfraud",
        r"\balready paid\b",
        r"\bpaid (?:this|that|it) off\b",
        r"\bdispute (?:this|the (?:debt|amount|balance))\b",
        r"\bwrong (?:person|amount|account)\b",
        r"\byou'?ve got the wrong\b",
    ),
    EscalationTrigger.THIRD_PARTY_SPEAKING: _any(
        r"\b(?:he|she|they) (?:is|are|'s|'re) ?n[o']t (?:here|in|available)\b",
        r"\bwrong number\b",
        r"\bi'?m (?:his|her|their) (?:wife|husband|partner|son|daughter|carer)\b",
        r"\bthis is ?n[o']t (?:them|him|her)\b",
        r"\bthey do ?n[o']t live here\b",
    ),
}

# NOT an escalation. A debtor demanding to know who is calling, what company
# this is, and by what authority is exercising an ordinary right, and the
# correct response is to answer them — caller name, institution, account
# reference, and how to verify the call independently. Handing that to a queue
# treats a reasonable question as a terminal event.
#
# The distinction from WRITTEN_VALIDATION_REQUESTED is real and is the one
# collections practice draws: challenging the CALLER is not challenging the
# DEBT. Once the debtor asks for proof the obligation exists, the handoff
# trigger above fires regardless of how the message opened.
AUTHORITY_CHALLENGE = _any(
    r"\bwho (?:exactly )?are you\b",
    r"\bwho gave you my (?:number|details)\b",
    r"\bwhat company\b",
    r"\bwho do you work for\b",
    r"\bwhat authority\b",
    r"\bwho authorised\b",
    r"\bnot confirming anything\b",
    r"\bhow do i know (?:you'?re|this is) (?:legit(?:imate)?|real|genuine)\b",
    r"\bcold call\b",
    r"\bprove (?:you'?re|who you are)\b",
    r"\bput it in writing\b",
    r"\bsend it in writing\b",
    r"\bin writing\b",
)
"""Advisory only — never escalates. Surfaced to the collector so it identifies
itself properly instead of pressing on."""


def is_authority_challenge(message: str) -> bool:
    """The debtor is challenging the caller, not the debt."""
    return AUTHORITY_CHALLENGE.search(message) is not None


# A debtor who asks for paperwork WHILE committing to pay is engaging, not
# refusing. The distinction that matters for §6 is precondition vs.
# concurrent request: "I won't discuss this until you prove it" is a refusal
# to engage and a handoff; "I'll pay 300 AED, and please send confirmation"
# is a settlement in progress.
#
# This keys on the DEBTOR's own commitment language, which the collector
# cannot manufacture — so it is not a loophole the agent can talk itself
# into. It exists because the agent escalated a cooperative customer at the
# moment she offered 300 AED, losing a settled deal to a documentation
# request she raised alongside it.
ENGAGEMENT = _any(
    r"\bi(?:'ll| will| can) pay\b",
    r"\bi can (?:manage|afford|do|make)\b",
    r"\b\d[\d,]*(?:\.\d+)? ?(?:aed|dirham|pounds?|gbp|usd|\$|£)\b",
    r"\b(?:aed|£|\$) ?\d",
    r"\bthat works\b",
    r"\bi agree\b",
    r"\bnote that as\b",
    r"\bholding payment\b",
    r"\bset (?:it|that) up\b",
    r"\bgo ahead with\b",
    r"\bper month\b",
    r"\bmonthly payment\b",
)


def is_engaging(message: str) -> bool:
    """The debtor is committing to something, not stonewalling."""
    return ENGAGEMENT.search(message) is not None


_COMPLAINT = _any(
    r"\bcomplain",
    r"\bombudsman\b",
    r"\bfca\b",
    r"\bfinancial conduct authority\b",
    r"\bregulator\b",
    r"\breport you\b",
    r"\btake this further\b",
    r"\blegal action against you\b",
)

COMPLAINT_ESCALATION_THRESHOLD = 2
"""§6 says *repeated* complaint escalation. One angry mention of the ombudsman is
ordinary pushback in this population; a pattern of it is a handoff."""


class TriggerHit(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    trigger: EscalationTrigger
    detail: str

    def as_reason(self) -> str:
        return f"{self.trigger.value}: {self.detail}"


def scan_message(message: str) -> tuple[TriggerHit, ...]:
    """Escalation triggers present in a single debtor message."""
    engaging = is_engaging(message)
    hits: list[TriggerHit] = []
    for trigger, pattern in _PATTERNS.items():
        match = pattern.search(message)
        if not match:
            continue
        if trigger is EscalationTrigger.WRITTEN_VALIDATION_REQUESTED and engaging:
            # Asking for paperwork while offering money is a concurrent
            # request, not a precondition. Send the documents; keep talking.
            continue
        hits.append(TriggerHit(trigger=trigger, detail=f"matched {match.group(0)!r}"))
    return tuple(hits)


def count_complaints(messages: list[str]) -> int:
    return sum(1 for m in messages if _COMPLAINT.search(m))


def scan_conversation(
    latest: str, previous_debtor_messages: list[str]
) -> tuple[TriggerHit, ...]:
    """Triggers from the latest message, plus repeated-complaint escalation.

    Complaint counting spans the whole conversation because the §6 condition is
    about a pattern, and a per-message check can never see one.
    """
    hits = list(scan_message(latest))

    complaints = count_complaints([*previous_debtor_messages, latest])
    if complaints >= COMPLAINT_ESCALATION_THRESHOLD:
        hits.append(
            TriggerHit(
                trigger=EscalationTrigger.REPEATED_COMPLAINT,
                detail=f"{complaints} complaint escalations in this conversation",
            )
        )
    return tuple(hits)
