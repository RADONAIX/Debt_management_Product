"""A single conversational turn (CLAUDE.md §3.4, paper Figure 17)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from domain.agreement import AgreementDelta
from domain.enums import Action, CollectorStrategy, DebtorStrategy, Speaker
from domain.evidence import EvidenceEvent


class Turn(BaseModel):
    """One utterance plus the reasoning and machinery behind it.

    ``strategy`` is required and drawn from a closed set. Law 4: an unlabelled
    turn is a bug, so the type system refuses to represent one.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    index: int = Field(ge=0)
    speaker: Speaker
    strategy: CollectorStrategy | DebtorStrategy | None = None
    """Required on a collector turn (law 4), optional on a debtor one.

    Not a weakening of law 4 — the asymmetry is real. §3.3 makes the eight
    debtor strategies **simulator-only**: they are how we drive a synthetic
    counterparty, not a taxonomy we impose on a real person mid-call. A live
    debtor's message therefore has no strategy label and inventing one would put
    fiction in the audit record. A collector turn without a label is still a bug,
    and is still rejected below.
    """

    thoughts: str
    action: Action
    dialogue: str = Field(min_length=1)

    proposed: AgreementDelta | None = Field(
        default=None,
        description="The agreement delta this turn puts on the table, if any.",
    )
    evidence: tuple[EvidenceEvent, ...] = Field(
        default=(),
        description="Evidence surfaced by this turn. Debtor turns only.",
    )

    @model_validator(mode="before")
    @classmethod
    def _resolve_strategy_by_speaker(cls, data: Any) -> Any:
        """Bind a raw strategy string to the enum its speaker owns.

        Both strategy sets contain ``repayment_negotiation``. Left to the union,
        pydantic would resolve that string to whichever member matches first,
        which is a coin-flip on a debtor turn. The speaker decides.
        """
        if not isinstance(data, dict):
            return data
        speaker, strategy = data.get("speaker"), data.get("strategy")
        if speaker is None or strategy is None or not isinstance(strategy, str):
            return data
        owner = (
            CollectorStrategy
            if Speaker(speaker) is Speaker.COLLECTOR
            else DebtorStrategy
        )
        return {**data, "strategy": owner(strategy)}

    @model_validator(mode="after")
    def _strategy_belongs_to_speaker(self) -> Turn:
        if self.speaker is Speaker.COLLECTOR and self.strategy is None:
            # Law 4: an unlabelled collector turn is a bug.
            raise ValueError("collector turn has no strategy label")

        if self.strategy is not None:
            expected = (
                CollectorStrategy
                if self.speaker is Speaker.COLLECTOR
                else DebtorStrategy
            )
            if not isinstance(self.strategy, expected):
                raise ValueError(
                    f"{self.speaker.value} turn carries a "
                    f"{type(self.strategy).__name__}"
                )
        if self.speaker is Speaker.COLLECTOR and self.evidence:
            raise ValueError("evidence is disclosed by the debtor, not the collector")
        return self
