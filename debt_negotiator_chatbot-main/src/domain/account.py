"""The collector-side view of a debt.

Deliberately separate from :class:`domain.persona.Persona`. CLAUDE.md §5.1 lets
the orchestrator assemble "history, account facts, current offer envelope,
inferred archetype" — and nothing else. The persona is debtor ground truth held
by the simulator; routing it into the collector would let the production agent
read the answer key, and would make every eval result meaningless.

The eval harness derives an ``Account`` from a ``Persona`` (phase 2). That
projection is the only legitimate direction of travel.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from domain.enums import Archetype


class Account(BaseModel):
    """Facts the institution holds about the debt."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    account_id: str
    tenant_id: str = Field(description="Retrieval is scoped per tenant (§7).")
    jurisdiction: str = Field(description="Selects the compliance pack (§7).")
    product: str
    currency: str = Field(
        default="AED",
        min_length=3,
        max_length=3,
        description="ISO code. Stated explicitly because a model with no "
        "currency in context will invent one, and it invented GBP for an "
        "AED book on the first live demo.",
    )

    principal: Decimal = Field(gt=0, description="Outstanding principal.")
    days_overdue: int = Field(ge=0)

    inferred_archetype: Archetype | None = Field(
        default=None,
        description="Inferred from the dialogue so far; never read from a persona.",
    )
