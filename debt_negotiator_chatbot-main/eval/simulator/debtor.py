"""The debtor simulator (CLAUDE.md law 6, §9).

**Test infrastructure.** It scores the collector. It is never exposed to a real
counterparty and never reachable from a production route — enforced by
``tests/gateway/test_role_isolation.py``, not by convention.

Two things this has to get right or the whole harness is worthless:

**Playing low cognition.** Appendix B.1 again: the model's default is a rational,
financially literate interlocutor. A simulator that quietly plays every persona
as competent produces a benchmark where the collector never meets the hard
cases, and every metric comes out flattering.

**Not folding.** A simulated debtor that accepts the first offer makes the
collector look excellent. The prompt gives the debtor its own interests and,
for confrontational and avoidant archetypes, explicit instruction to resist.

----

**Evidence declaration — an architectural seam, flagged now.**

The simulator *declares* what it disclosed, because it knows its own ground
truth: it holds the persona and can say "I just evidenced documented hardship".
Production has no such luxury. Phase 3 needs an **evidence extractor** that
reads a real debtor's utterance and decides what, if anything, was actually
evidenced — and the concession ladder's guarantee is only ever as strong as that
extractor. Declaring here is correct for eval and wrong for production; the two
must not be confused.
"""

from __future__ import annotations

from domain.agreement import AgreementDelta
from domain.enums import Action, Archetype, DebtorStrategy, Speaker
from domain.evidence import EvidenceEvent, EvidenceKind
from domain.persona import Persona
from domain.trajectory import Trajectory
from domain.turn import Turn
from gateway.client import Gateway
from gateway.roles import ModelRole

DEBTOR_SCHEMA = {
    "type": "object",
    "properties": {
        "thoughts": {"type": "string"},
        "strategy": {
            "type": "string",
            "enum": [s.value for s in DebtorStrategy],
        },
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
        "evidence_disclosed": {
            "type": "array",
            "items": {"type": "string", "enum": [e.value for e in EvidenceKind]},
        },
    },
    "required": [
        "thoughts",
        "strategy",
        "action",
        "dialogue",
        "proposed",
        "evidence_disclosed",
    ],
    "additionalProperties": False,
}

ARCHETYPE_STANCE: dict[Archetype, str] = {
    Archetype.CONFRONTATIONAL: (
        "You are hostile about the TERMS. You accept the debt is yours — you "
        "are not claiming it is a mistake — but you think the amount they want "
        "is unreasonable and you intend to fight for a better deal. Push back "
        "hard, be blunt and impatient, demand a discount, and do NOT settle "
        "easily: make them work for every inch. If they concede something "
        "without you giving anything up, push for more.\n"
        "Do NOT dispute that you owe the money, do NOT demand documentary proof "
        "of the debt as a precondition, and do NOT threaten the ombudsman or a "
        "formal complaint. Those are real behaviours, but they end the call in "
        "a handoff, and this persona is here to test whether the collector can "
        "hold its position in a live negotiation."
    ),
    Archetype.AVOIDANT: (
        "You deflect rather than fight. Give vague non-answers, change the "
        "subject, say you'll 'look into it', avoid committing to numbers, and "
        "look for ways to end the call. Do not volunteer your real finances."
    ),
    Archetype.HELPLESS: (
        "You are overwhelmed. You struggle to follow the numbers, you may repeat "
        "yourself, and you feel stuck rather than strategic. You are not playing "
        "games — you genuinely cannot see a way through."
    ),
    Archetype.COOPERATIVE: (
        "You want this resolved. Answer honestly, ask practical questions, and "
        "commit only to what you could genuinely afford on your stated income."
    ),
}

SYSTEM = """You are role-playing a DEBTOR in a debt-collection call. You are \
not an assistant. You have your own interests and you are under no obligation \
to be helpful, agreeable, or efficient.

CRITICAL — PLAY THE COGNITION LEVELS LITERALLY.
Your persona has four cognition levels from 1 to 5. These are not personality \
flavour, they are hard limits on what you are capable of.

- financial_literacy 1-2: you CANNOT do the arithmetic. If they say "25% \
upfront over 6 months" you do not know what that costs you per month. Ask them \
to explain, or agree to something you do not understand, or get it wrong.
- legal_awareness 1-2: you do not know what a CCJ is, what a default notice \
does, or what they are actually allowed to do. You may believe things that are \
untrue — that they can take your house tomorrow, or that ignoring it makes it \
disappear.
- responsibility 1-2: you do not accept this is your problem to solve.
- credit_awareness 1-2: you do not understand or care what this does to your \
credit file.

Do NOT reason like a competent adult and then add a disclaimer. If your level \
is low, actually fail to understand.

EVIDENCE. Report in `evidence_disclosed` ONLY what you genuinely put on the \
table in THIS turn, and only what your persona could actually substantiate:
- hardship_claimed: you SAID things are hard, without proof.
- hardship_documented: you referenced specific, checkable facts.
- severe_hardship_documented: documented job loss, medical event, or insolvency.
- income_verified: you offered a payslip, benefit award or bank statement.
- liquidity_constrained: you showed you genuinely cannot raise the upfront sum.
- assets_disclosed: you gave a full, consistent account of what you have.
- third_party_debt_confirmed: you confirmed other debts via an advice agency.
Merely complaining, getting angry, or repeating yourself is NOT evidence. Return \
an empty list in that case. Do not claim documentation your persona does not \
have.

`proposed` is your counter-offer if you are making one, else null. \
disc_ratio 0-30 in steps of 5; pmt_ratio 5-50 in steps of 5; pmt_days 1-14; \
inst_prds one of 3, 6, 9, 12, 18, 24.

ACTION — this one is binding, so be strict about it:
- 'accept' means you are AGREEING TO THE COLLECTOR'S EXACT REPAYMENT TERMS, \
here and now, as a final deal. Using it ENDS the negotiation and commits you to \
those payments.
- Do NOT use 'accept' for agreeing to think about it, to call back, to check \
your budget, to "try", or to acknowledge what they said. That is 'non'.
- 'ask' when you are asking a question, deflecting, arguing, or counter-offering.
Saying "yes, okay, I'll look into it" is 'non', NEVER 'accept'.

Speak naturally, in your persona's own register. One to four sentences."""


def _persona_brief(persona: Persona) -> str:
    c = persona.cognition
    return "\n".join(
        [
            "## YOU",
            f"Age {persona.background.age}, {persona.background.gender}.",
            f"You owe {persona.background.overdue_amount}, "
            f"{persona.background.days_overdue} days overdue.",
            f"Reason it went bad: {persona.background.overdue_reason}.",
            f"You bring in about {persona.background.daily_income} a day and have "
            f"roughly {persona.background.current_assets} you could get hold of.",
            "",
            f"Your story: {persona.scenario}",
            f"Traits: {', '.join(persona.personality.character_traits)}. "
            f"MBTI {persona.personality.mbti}.",
            f"How you talk: {persona.personality.linguistic_style}",
            f"Emotional resilience: {persona.personality.emotional_resilience}/5",
            f"Right now you feel: {persona.personality.emotions.model_dump()}",
            "",
            "## YOUR COGNITION — play these literally",
            f"legal_awareness {c.legal_awareness.level}/5: "
            f"{c.legal_awareness.description}",
            f"financial_literacy {c.financial_literacy.level}/5: "
            f"{c.financial_literacy.description}",
            f"responsibility {c.responsibility.level}/5: "
            f"{c.responsibility.description}",
            f"credit_awareness {c.credit_awareness.level}/5: "
            f"{c.credit_awareness.description}",
            "",
            "## YOUR STANCE",
            ARCHETYPE_STANCE[persona.archetype],
        ]
    )


def _history(trajectory: Trajectory) -> str:
    if not trajectory.turns:
        return "(the collector has not spoken yet)"
    return "\n".join(f"[{t.speaker.value}] {t.dialogue}" for t in trajectory.turns)


def respond(
    gateway: Gateway, persona: Persona, trajectory: Trajectory, *, index: int
) -> Turn:
    """Produce the debtor's next turn."""
    response = gateway.complete(
        ModelRole.SIMULATOR,
        [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": (
                    f"{_persona_brief(persona)}\n\n## CONVERSATION SO FAR\n"
                    f"{_history(trajectory)}\n\nRespond as the debtor."
                ),
            },
        ],
        schema=DEBTOR_SCHEMA,
        schema_name="debtor_turn",
    )
    payload = response.parsed()

    proposed = None
    raw_proposal = payload.get("proposed")
    if isinstance(raw_proposal, dict) and any(
        v is not None for v in raw_proposal.values()
    ):
        try:
            proposed = AgreementDelta(**raw_proposal)
        except ValueError:
            # An off-grid counter-offer is the debtor asking for something that
            # does not exist. Drop the numbers, keep the utterance — the policy
            # engine would reject it anyway and the dialogue should continue.
            proposed = None

    evidence = tuple(
        EvidenceEvent(kind=EvidenceKind(kind), turn_index=index)
        for kind in payload.get("evidence_disclosed", [])
        if kind in {e.value for e in EvidenceKind}
    )

    return Turn(
        index=index,
        speaker=Speaker.DEBTOR,
        strategy=DebtorStrategy(payload["strategy"]),
        thoughts=payload.get("thoughts", ""),
        action=Action(payload["action"]),
        dialogue=payload["dialogue"] or "...",
        proposed=proposed,
        evidence=evidence,
    )
