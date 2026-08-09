"""Evidence extraction from a debtor's message (CLAUDE.md §5.1).

In the eval harness the simulator *declares* its evidence, because it holds its
own ground truth. Production has no such luxury: something has to read what a
real person said and decide what, if anything, it established.

Two defences, because this is the input that moves the offer envelope:

**Separation.** A distinct model role from ``COLLECTOR`` — the component
deciding what the debtor evidenced is not the component that benefits from a
looser envelope.

**A barrier that does not trust it.** Whatever this returns is passed through
:func:`policy.evidence_intake.filter_chat_claims`, which admits only soft
evidence. The extractor is prompted to stay in its lane, but the guarantee does
not rest on that — a fully compromised extractor naming every verified tier
still yields no discount. Law 2 applied to our own component.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from agent.prompts.loader import load
from domain.evidence import EvidenceEvent
from gateway.client import Gateway
from gateway.roles import ModelRole
from policy.evidence_intake import SOFT_EVIDENCE, filter_chat_claims

EXTRACTOR_SCHEMA = {
    "type": "object",
    "properties": {
        "evidence": {
            "type": "array",
            # Offered categories are limited here too, as a first filter. The
            # real guarantee is filter_chat_claims -- this only reduces noise.
            "items": {
                "type": "string",
                "enum": sorted(k.value for k in SOFT_EVIDENCE),
            },
        },
        "reasoning": {"type": "string"},
    },
    "required": ["evidence", "reasoning"],
    "additionalProperties": False,
}


class Extraction(BaseModel):
    """What the extractor found, after the barrier."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    events: tuple[EvidenceEvent, ...]
    reasoning: str
    prompt_version: str
    model: str
    rejected: tuple[str, ...] = ()
    """Categories the model offered that the barrier refused. Audited, because
    an extractor repeatedly reaching for verified tiers is a signal worth
    seeing."""


def extract(
    gateway: Gateway, message: str, history: str, *, turn_index: int
) -> Extraction:
    """Classify one debtor message."""
    system, prompt_version = load("extractor")

    response = gateway.complete(
        ModelRole.EXTRACTOR,
        [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": (
                    f"## CONVERSATION SO FAR\n{history or '(none)'}\n\n"
                    f"## DEBTOR'S LATEST MESSAGE\n{message}\n\n"
                    "Classify only this latest message."
                ),
            },
        ],
        schema=EXTRACTOR_SCHEMA,
        schema_name="evidence_extraction",
    )

    payload = response.parsed()
    offered = tuple(str(k) for k in payload.get("evidence", []))
    events = filter_chat_claims(offered, turn_index=turn_index)
    admitted = {e.kind.value for e in events}

    return Extraction(
        events=events,
        reasoning=str(payload.get("reasoning", "")),
        prompt_version=prompt_version,
        model=response.model,
        rejected=tuple(k for k in offered if k not in admitted),
    )
