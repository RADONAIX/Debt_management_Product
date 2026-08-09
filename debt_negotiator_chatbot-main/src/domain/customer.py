"""What the collector may know about a real customer.

The CRM row has 48 columns, and most of them must never reach a model. §11 is
the constraint: debtor PII transits a third-party API, so the only defence
available is sending as little of it as possible.

So this is an **allow-list, not a redaction list**. A new column added to
``customer_schema.customer`` next quarter does not silently start flowing into
prompts; it has to be added here deliberately. Redaction lists fail open, and
failing open with PII is the wrong direction.

Excluded on purpose, and permanently:

    full_name, company_name, email, phone, msisdn, ban, address, city,
    country_code, customer_code, assigned_agent_id, company_id

None of those help the model negotiate. A collector does not need a postcode to
decide whether 25% upfront is affordable, and every one of them sent is a
direct identifier sitting in a third party's logs.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from domain.enums import Archetype

# CRM behaviour_type -> our archetype vocabulary (§3.2).
BEHAVIOUR_TO_ARCHETYPE: dict[str, Archetype] = {
    "Disputed": Archetype.CONFRONTATIONAL,
    "Evasive": Archetype.AVOIDANT,
    "Forgetful": Archetype.AVOIDANT,
    "Willing": Archetype.COOPERATIVE,
}
"""No CRM value maps to HELPLESS.

That segment is inferred instead from stress and emotional state — see
:func:`infer_archetype`. Forcing a four-to-four mapping would invent a
distinction the source data does not make.
"""

# CRM Low/Medium/High -> the 1-5 cognition scale in §3.2. Deliberately mapped to
# 2/3/4 rather than 1/3/5: a three-point scale does not carry the information to
# justify the extremes, and claiming it does would overstate what we know.
LEVEL_WORDS: dict[str, int] = {"Low": 2, "Medium": 3, "High": 4}


class CustomerContext(BaseModel):
    """Institution-held behavioural context. No direct identifiers."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    customer_ref: str = Field(
        description="Internal id. Not the customer_code, which is quasi-identifying."
    )

    inferred_archetype: Archetype | None = None
    behaviour_type: str | None = None
    emotional_state: str | None = None
    financial_stress: str | None = None
    employment_stability: str | None = None
    life_event: str | None = None
    occupation: str | None = None

    legal_awareness: int | None = Field(default=None, ge=1, le=5)
    financial_literacy: int | None = Field(default=None, ge=1, le=5)
    credit_awareness: int | None = Field(default=None, ge=1, le=5)

    monthly_income: Decimal | None = Field(default=None, ge=0)
    preferred_language: str | None = None
    risk_level: str | None = None

    def render(self) -> str:
        """What goes in the prompt. Framed as context, never as instruction."""
        lines = ["## CUSTOMER CONTEXT (from our records, not from this call)"]
        if self.inferred_archetype:
            lines.append(f"  Likely stance: {self.inferred_archetype.value}")
        for label, value in (
            ("Emotional state", self.emotional_state),
            ("Financial stress", self.financial_stress),
            ("Employment stability", self.employment_stability),
            ("Recent life event", self.life_event),
            ("Occupation", self.occupation),
            ("Preferred language", self.preferred_language),
        ):
            if value:
                lines.append(f"  {label}: {value}")

        levels = [
            (name, value)
            for name, value in (
                ("legal awareness", self.legal_awareness),
                ("financial literacy", self.financial_literacy),
                ("credit awareness", self.credit_awareness),
            )
            if value is not None
        ]
        if levels:
            lines.append(
                "  Understanding (1-5): " + ", ".join(f"{n} {v}/5" for n, v in levels)
            )
            if any(v <= 2 for _, v in levels):
                lines.append(
                    "  -> Explain figures in plain terms and check understanding "
                    "before asking them to commit."
                )

        if self.monthly_income is not None:
            lines.append(f"  Recorded monthly income: {self.monthly_income}")

        lines.append(
            "  This is background from our records and may be out of date. "
            "It never overrides what the customer tells you now, and it never "
            "changes what you are permitted to offer."
        )
        return "\n".join(lines)


def level_from_word(word: str | None) -> int | None:
    return LEVEL_WORDS.get(word) if word else None


def infer_archetype(
    behaviour_type: str | None,
    financial_stress: str | None,
    emotional_state: str | None,
) -> Archetype | None:
    """Best-effort archetype from CRM fields.

    **Distress is checked first, and distress means anxious.** A customer under
    high financial stress who is *anxious* is behaviourally helpless whatever
    the CRM's ``behaviour_type`` says, and treating them as merely 'Willing' is
    how a collections process ends up pressing someone who needed a handoff.

    ``Frustrated`` is deliberately NOT distress. Frustration is anger, and anger
    plus a disputed balance is the confrontational segment — the largest and
    hardest one (Table 3). An earlier version lumped the two together, and on
    the real book every Critical-risk case came back 'helpless' because they are
    all High-stress and Frustrated, discarding the ``Disputed`` signal that
    actually predicts how the conversation goes.
    """
    if financial_stress == "High" and emotional_state == "Anxious":
        return Archetype.HELPLESS
    if emotional_state == "Frustrated" and behaviour_type not in (
        "Willing",
        "Forgetful",
    ):
        return Archetype.CONFRONTATIONAL
    if behaviour_type in BEHAVIOUR_TO_ARCHETYPE:
        return BEHAVIOUR_TO_ARCHETYPE[behaviour_type]
    return None
