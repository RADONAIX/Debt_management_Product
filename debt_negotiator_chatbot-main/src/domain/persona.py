"""The counterparty model (CLAUDE.md §3.2, paper §3.1 / Appendix B.1).

``Persona = (Background, Personality, Cognition, Scenario)``

This is debtor-side ground truth. It belongs to the simulator and the persona
factory. The collector never receives it — see :mod:`domain.account` for what
the production path is allowed to see.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from domain.enums import Archetype


class Background(BaseModel):
    """Situational facts."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    age: int = Field(ge=18, le=100)
    gender: str
    overdue_amount: Decimal = Field(gt=0)
    days_overdue: int = Field(ge=0)
    overdue_reason: str
    daily_income: Decimal = Field(ge=0)
    current_assets: Decimal = Field(ge=0)


class EmotionVector(BaseModel):
    """Six-emotion vector, each 0-10."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    happiness: int = Field(ge=0, le=10)
    sadness: int = Field(ge=0, le=10)
    disgust: int = Field(ge=0, le=10)
    fear: int = Field(ge=0, le=10)
    surprise: int = Field(ge=0, le=10)
    anger: int = Field(ge=0, le=10)


class Personality(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    character_traits: tuple[str, ...]
    mbti: str = Field(min_length=4, max_length=4)
    emotions: EmotionVector
    emotional_resilience: int = Field(ge=1, le=5, description="5 levels, 1 = brittle")
    linguistic_style: str


class CognitionDimension(BaseModel):
    """A cognition axis: a 1-5 level *and* the second-person description that
    the simulator is prompted with.

    The description is not decoration. Appendix B.1 notes that models default to
    being rational and financially literate; a low level has to be actively
    described in second person to be played convincingly, not merely numbered.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    level: int = Field(ge=1, le=5)
    description: str = Field(min_length=1)


class Cognition(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    legal_awareness: CognitionDimension
    financial_literacy: CognitionDimension
    responsibility: CognitionDimension
    credit_awareness: CognitionDimension


class Persona(BaseModel):
    """A debtor. ``scenario`` is the life narrative unifying the other three."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    persona_id: str
    archetype: Archetype
    background: Background
    personality: Personality
    cognition: Cognition
    scenario: str = Field(min_length=1)
