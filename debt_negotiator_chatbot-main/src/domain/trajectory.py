"""A completed or in-flight negotiation (CLAUDE.md §3.4)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator

from domain.agreement import Agreement
from domain.enums import Outcome, Speaker
from domain.evidence import EvidenceEvent
from domain.turn import Turn


class Trajectory(BaseModel):
    """Ordered turns plus the terminal agreement and outcome."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    trajectory_id: str
    account_id: str
    turns: tuple[Turn, ...] = ()
    agreement: Agreement | None = None
    outcome: Outcome | None = Field(
        default=None, description="None while the dialogue is still in flight."
    )

    @model_validator(mode="after")
    def _consistent(self) -> Trajectory:
        for position, turn in enumerate(self.turns):
            if turn.index != position:
                raise ValueError(
                    f"turn at position {position} carries index {turn.index}"
                )
        if self.outcome is Outcome.AGREEMENT and self.agreement is None:
            raise ValueError("outcome is AGREEMENT but no agreement is attached")
        if self.agreement is not None and self.outcome not in (
            None,
            Outcome.AGREEMENT,
        ):
            raise ValueError(f"agreement attached to a {self.outcome} trajectory")
        return self

    @property
    def turn_count(self) -> int:
        """Total turns, both speakers. ``AT`` in the harness counts these."""
        return len(self.turns)

    @property
    def collector_turns(self) -> tuple[Turn, ...]:
        return tuple(t for t in self.turns if t.speaker is Speaker.COLLECTOR)

    def evidence_so_far(self) -> tuple[EvidenceEvent, ...]:
        """Every evidence event disclosed, in order.

        This is the input the policy ladder consumes; nothing else in the
        transcript can move the offer envelope.
        """
        return tuple(e for turn in self.turns for e in turn.evidence)
