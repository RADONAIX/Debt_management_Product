"""Interaction-experience metrics: US, ES, CA (CLAUDE.md §8).

An LLM judge scoring 1-10, conditioned on the full transcript **and** the
persona. Conditioning on the persona matters: "was this handled well" is not
answerable in the abstract. Firmness that is appropriate for a confrontational
debtor evading a clear obligation is not appropriate for a helpless one in
genuine distress, and a judge shown only the transcript would score them alike.

Eval only (§9). The judge is a different model from the collector to reduce
self-preference bias, and runs at ``temperature=0``.

These scores are **PROVISIONAL** until calibrated against human ratings — see
:mod:`eval.calibrate` and §8's requirement to validate the judge before trusting
it. The tag is not decoration; nothing here has been checked against a human.
"""

from __future__ import annotations

from domain.persona import Persona
from domain.trajectory import Trajectory
from eval.types import JudgeScores
from gateway.client import Gateway
from gateway.roles import ModelRole

JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "user_satisfaction": {"type": "integer", "minimum": 1, "maximum": 10},
        "emotional_support": {"type": "integer", "minimum": 1, "maximum": 10},
        "communication_appropriateness": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10,
        },
        "rationale": {"type": "string"},
    },
    "required": [
        "user_satisfaction",
        "emotional_support",
        "communication_appropriateness",
        "rationale",
    ],
    "additionalProperties": False,
}

SYSTEM = """You are evaluating a debt-collection conversation from the DEBTOR's \
point of view. You are given the debtor's full persona and the complete \
transcript.

Score three dimensions from 1 to 10:

- user_satisfaction (US): did the debtor come away feeling the process was fair \
and that their situation was actually heard?
- emotional_support (ES): did the collector respond appropriately to the \
debtor's emotional state, given this persona's resilience and circumstances?
- communication_appropriateness (CA): was the language clear, respectful, \
honest about consequences, and free of coercion or misrepresentation?

Judge against what was APPROPRIATE for this specific persona, not against a \
generic ideal. Firmness toward a debtor who is evading a clear obligation is \
appropriate; the same firmness toward a debtor in documented distress is not. \
A collector conceding everything is not scoring a 10 — a debtor is not well \
served by an agreement they cannot keep.

Be discriminating. Reserve 9-10 for genuinely excellent handling and 1-2 for \
genuinely poor handling."""


def _render(persona: Persona, trajectory: Trajectory) -> str:
    lines = [
        "## DEBTOR PERSONA",
        f"Archetype: {persona.archetype.value}",
        f"Scenario: {persona.scenario}",
        f"Traits: {', '.join(persona.personality.character_traits)}",
        f"MBTI: {persona.personality.mbti}",
        f"Linguistic style: {persona.personality.linguistic_style}",
        f"Emotional resilience (1-5): {persona.personality.emotional_resilience}",
        f"Emotions: {persona.personality.emotions.model_dump()}",
        "Cognition:",
        f"  legal awareness {persona.cognition.legal_awareness.level}/5 — "
        f"{persona.cognition.legal_awareness.description}",
        f"  financial literacy {persona.cognition.financial_literacy.level}/5 — "
        f"{persona.cognition.financial_literacy.description}",
        f"  responsibility {persona.cognition.responsibility.level}/5 — "
        f"{persona.cognition.responsibility.description}",
        f"  credit awareness {persona.cognition.credit_awareness.level}/5 — "
        f"{persona.cognition.credit_awareness.description}",
        "",
        "## TRANSCRIPT",
    ]
    for turn in trajectory.turns:
        lines.append(f"[{turn.speaker.value}] {turn.dialogue}")

    outcome = trajectory.outcome.value if trajectory.outcome else "incomplete"
    lines.append("")
    lines.append(f"## OUTCOME: {outcome}")
    if trajectory.agreement is not None:
        lines.append(f"Agreement: {trajectory.agreement.model_dump()}")
    return "\n".join(lines)


def score_dialogue(
    gateway: Gateway, persona: Persona, trajectory: Trajectory
) -> JudgeScores:
    """US/ES/CA for one dialogue."""
    response = gateway.complete(
        ModelRole.JUDGE,
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": _render(persona, trajectory)},
        ],
        schema=JUDGE_SCHEMA,
        schema_name="judge_scores",
    )
    payload = response.parsed()
    return JudgeScores(
        user_satisfaction=payload["user_satisfaction"],
        emotional_support=payload["emotional_support"],
        communication_appropriateness=payload["communication_appropriateness"],
        rationale=payload.get("rationale", ""),
    )
