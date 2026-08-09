"""Persona generation (CLAUDE.md §3.2, paper §3.1 / Appendix B.1).

``SYNTHESIS`` role, offline batch. Output is validated through
:class:`domain.persona.Persona`, so a malformed persona cannot enter the set.

**Division of labour.** The background — age, income, debt, days overdue, reason
— comes from :mod:`eval.personas.spec`, deterministically. The model writes only
the personality, the cognition profile, and the scenario that ties the given
numbers to a life. Letting the model invent backgrounds produced 3 distinct ages
and 2 dominant reasons across 40 personas; see the note in ``spec.py``.

**The hard part** is Appendix B.1's warning, which is a modelling problem rather
than a matter of prompt style:

    "Simulator note: models default to being rational and financially literate.
     Low-cognition personas require active suppression of that default, not
     prompt flavour."

A model asked for "financial literacy 1/5" will happily emit a level of 1 and
then describe someone who budgets carefully and understands compound interest.
So the schema asks for the second-person description *before* the number, and
the result is screened.

**Honest limitation of that screen.** It is lexical, so it catches blatant
contradictions and nothing subtle. It is a net, not a proof. The real check is
the persona-consistency suite.
"""

from __future__ import annotations

from decimal import Decimal

from domain.enums import Archetype
from domain.persona import Background, Persona
from eval.personas.spec import PersonaSpec
from gateway.client import Gateway
from gateway.roles import ModelRole

ARCHETYPE_GUIDANCE: dict[Archetype, str] = {
    Archetype.CONFRONTATIONAL: (
        "Hostile and combative. Challenges the debt's validity, questions the "
        "collector's authority, threatens complaints or legal action, and treats "
        "the call as an attack to be repelled. Anger high, fear low."
    ),
    Archetype.AVOIDANT: (
        "Evasive rather than aggressive. Deflects, gives vague non-answers, "
        "promises to 'sort it out' without committing to anything specific, and "
        "looks for reasons to end the call. Fear moderate to high, anger low."
    ),
    Archetype.HELPLESS: (
        "Overwhelmed and low-agency. Genuinely distressed, struggles to engage "
        "with numbers or options, may be tearful or resigned. Sadness and fear "
        "high, emotional resilience low. Not manipulative — actually stuck."
    ),
    Archetype.COOPERATIVE: (
        "Engages honestly and wants the matter resolved. Discloses circumstances "
        "readily, asks practical questions, and will commit to what they can "
        "genuinely afford. Rare in this population (6%)."
    ),
}

_COGNITION_DIMENSIONS = (
    "legal_awareness",
    "financial_literacy",
    "responsibility",
    "credit_awareness",
)

PERSONA_SCHEMA = {
    "type": "object",
    "properties": {
        "personality": {
            "type": "object",
            "properties": {
                "character_traits": {"type": "array", "items": {"type": "string"}},
                "emotions": {
                    "type": "object",
                    "properties": {
                        e: {"type": "integer"}
                        for e in (
                            "happiness",
                            "sadness",
                            "disgust",
                            "fear",
                            "surprise",
                            "anger",
                        )
                    },
                    "required": [
                        "happiness",
                        "sadness",
                        "disgust",
                        "fear",
                        "surprise",
                        "anger",
                    ],
                    "additionalProperties": False,
                },
                "emotional_resilience": {"type": "integer"},
                "linguistic_style": {"type": "string"},
            },
            "required": [
                "character_traits",
                "emotions",
                "emotional_resilience",
                "linguistic_style",
            ],
            "additionalProperties": False,
        },
        "cognition": {
            "type": "object",
            "properties": {
                dim: {
                    "type": "object",
                    "properties": {
                        # description BEFORE level: the model has to commit to
                        # the behaviour before it picks a number, which stops it
                        # attaching "1/5" to a description of a capable person.
                        "description": {"type": "string"},
                        "level": {"type": "integer"},
                    },
                    "required": ["description", "level"],
                    "additionalProperties": False,
                }
                for dim in _COGNITION_DIMENSIONS
            },
            "required": list(_COGNITION_DIMENSIONS),
            "additionalProperties": False,
        },
        "scenario": {"type": "string"},
    },
    "required": ["personality", "cognition", "scenario"],
    "additionalProperties": False,
}

SYSTEM = """You write realistic debtor personas for a debt-collection \
negotiation benchmark. These are synthetic test fixtures, not real people.

You are GIVEN the debtor's factual background. Do not contradict it. Your job is \
the inner life: personality, cognition, and the scenario that makes those facts \
cohere.

RULES

1. Cognition descriptions are written in the SECOND PERSON ("You have never...").
2. Levels are 1-5. A LOW level must describe genuine incapacity, not modesty \
about capacity:
   - financial_literacy 1-2: you cannot work out what a monthly instalment costs \
you, you confuse interest with fees, you could not say what you owe in total.
   - legal_awareness 1-2: you do not know what a court judgment is, or what a \
collector is and is not allowed to do. You may believe things that are false.
   - responsibility 1-2: you do not accept this is yours to solve.
   - credit_awareness 1-2: you do not understand or care what this does to your \
credit file.
   Do NOT write a competent person and label them 1/5. That is the single most \
common failure in this task and it makes the fixture worthless.
3. The four dimensions are INDEPENDENT. Someone can be legally naive and \
financially shrewd, or highly responsible and totally illiterate about credit.
4. emotional_resilience is 1-5. Emotions are each 0-10 and should reflect how \
this person feels RIGHT NOW, at the start of a collections call.
5. Give 2-4 character traits and a distinctive linguistic_style (register, \
verbosity, tics) — the simulator speaks in this voice.
6. The scenario is 2-4 sentences of life narrative. It must explain the given \
numbers: why this debt, why this long, why they cannot simply pay it.
7. No real names, employers, or identifying detail (these are synthetic)."""

_COMPETENCE_MARKERS = (
    "budget carefully",
    "budgets carefully",
    "well-organised",
    "well organized",
    "financially savvy",
    "financially literate",
    "understand compound",
    "understands compound",
    "keep detailed records",
    "keeps detailed records",
    "sophisticated understanding",
    "strong grasp",
    "good grasp",
    "fully aware of your rights",
    "know your rights well",
)


class PersonaQualityError(ValueError):
    """A generated persona contradicted itself and was rejected."""


def _screen_low_cognition(persona: Persona) -> None:
    """Reject a low level attached to a description of a competent person."""
    dimensions = {
        "legal_awareness": persona.cognition.legal_awareness,
        "financial_literacy": persona.cognition.financial_literacy,
        "responsibility": persona.cognition.responsibility,
        "credit_awareness": persona.cognition.credit_awareness,
    }
    for name, dimension in dimensions.items():
        if dimension.level > 2:
            continue
        lowered = dimension.description.lower()
        hit = next((m for m in _COMPETENCE_MARKERS if m in lowered), None)
        if hit is not None:
            raise PersonaQualityError(
                f"{name} is level {dimension.level} but the description reads as "
                f"competent ({hit!r}) — Appendix B.1 default not suppressed"
            )


def generate_persona(
    gateway: Gateway, spec: PersonaSpec, *, max_attempts: int = 3
) -> Persona:
    """Generate the inner life for a fixed background."""
    prompt = (
        f"Write the persona for this debtor.\n\n"
        f"BEHAVIOURAL ARCHETYPE: {spec.archetype.value}\n"
        f"{ARCHETYPE_GUIDANCE[spec.archetype]}\n\n"
        f"FIXED BACKGROUND (do not contradict):\n  {spec.brief()}\n"
        f"  MBTI: {spec.mbti}\n\n"
        "At least one cognition dimension should sit at level 1 or 2 unless "
        "that would contradict the archetype. Vary the profile — do not make "
        "all four the same."
    )

    last: Exception | None = None
    for attempt in range(max_attempts):
        response = gateway.complete(
            ModelRole.SYNTHESIS,
            [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"{prompt}\n\n(variation {attempt})"},
            ],
            schema=PERSONA_SCHEMA,
            schema_name="persona",
        )
        payload = response.parsed()
        try:
            persona = Persona(
                persona_id=spec.persona_id,
                archetype=spec.archetype,
                background=Background(
                    age=spec.age,
                    gender=spec.gender,
                    overdue_amount=Decimal(spec.overdue_amount),
                    days_overdue=spec.days_overdue,
                    overdue_reason=spec.overdue_reason,
                    daily_income=Decimal(spec.daily_income),
                    current_assets=Decimal(spec.current_assets),
                ),
                personality={**payload["personality"], "mbti": spec.mbti},
                cognition=payload["cognition"],
                scenario=payload["scenario"],
            )
            _screen_low_cognition(persona)
        except (ValueError, KeyError) as exc:
            last = exc
            continue
        return persona

    raise PersonaQualityError(
        f"could not generate a valid persona for {spec.persona_id} after "
        f"{max_attempts} attempts: {last}"
    )
