"""What the harness carries around: one scored dialogue.

Kept separate from ``domain/`` because none of this is production vocabulary —
a ``Persona`` is attached here precisely because the eval harness is allowed to
see debtor ground truth and the collector is not.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from domain.account import Account
from domain.enums import Archetype, Outcome
from domain.persona import Persona
from domain.trajectory import Trajectory


class JudgeScores(BaseModel):
    """Interaction-experience scores, 1-10 (CLAUDE.md §8)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    user_satisfaction: float = Field(ge=1, le=10)
    emotional_support: float = Field(ge=1, le=10)
    communication_appropriateness: float = Field(ge=1, le=10)
    rationale: str = ""


class DialogueResult(BaseModel):
    """One persona run to completion against one collector agent."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    persona: Persona
    account: Account
    trajectory: Trajectory
    judge: JudgeScores | None = None

    @property
    def archetype(self) -> Archetype:
        return self.persona.archetype

    @property
    def escalated(self) -> bool:
        """Handed to a human. A terminal state, and often the correct one."""
        return self.trajectory.outcome is Outcome.ESCALATED

    @property
    def succeeded(self) -> bool:
        """A dialogue succeeds only on a complete, validated agreement."""
        return (
            self.trajectory.outcome is Outcome.AGREEMENT
            and self.trajectory.agreement is not None
        )
