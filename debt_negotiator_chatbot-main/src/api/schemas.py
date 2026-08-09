"""Request and response models for the API."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from domain.enums import DiscRatio, InstPrds, PmtDays, PmtRatio
from domain.evidence import EvidenceKind


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: str
    tenant_id: str
    jurisdiction: str
    product: str
    principal: Decimal = Field(gt=0)
    days_overdue: int = Field(ge=0)


class ProposalPayload(BaseModel):
    """A debtor counter-offer. Enum-typed, so off-grid values are rejected at
    the edge rather than coerced (§3.1)."""

    model_config = ConfigDict(extra="forbid")

    disc_ratio: DiscRatio | None = None
    pmt_ratio: PmtRatio | None = None
    pmt_days: PmtDays | None = None
    inst_prds: InstPrds | None = None


class TurnRequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str | None = Field(
        default=None,
        description="What the debtor said. Omit to have the collector open.",
    )
    proposal: ProposalPayload | None = None


class EnvelopeView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_disc_ratio: int
    min_pmt_ratio: int
    max_pmt_days: int
    allowed_inst_prds: list[int]
    hardship_tier: str


class TurnResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    status: str

    escalated: bool = False
    escalation_trigger: str | None = None
    escalation_detail: str = ""

    strategy: str | None = None
    action: str | None = None
    dialogue: str = ""
    proposed: ProposalPayload | None = None

    envelope: EnvelopeView
    agreement: ProposalPayload | None = None

    evidence_admitted: list[str] = Field(default_factory=list)
    attempts: int = 0
    retries_used: int = 0


class VerifiedEvidenceRequest(BaseModel):
    """Out-of-band evidence.

    This is the *only* route by which documented hardship, verified income,
    confirmed third-party debt or insolvency can enter a negotiation. Chat
    cannot produce them at any confidence — see :mod:`policy.evidence_intake`.
    """

    model_config = ConfigDict(extra="forbid")

    kind: EvidenceKind
    verified_by: str = Field(
        min_length=1,
        description="Who checked the artefact. Required for the §7 audit trail.",
    )
    note: str = ""


class SessionView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    status: str
    account_id: str
    tenant_id: str
    jurisdiction: str
    principal: Decimal
    days_overdue: int
    turn_count: int
    envelope: EnvelopeView
    agreement: ProposalPayload | None = None
    evidence_on_file: list[str] = Field(default_factory=list)


class AuditEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    turn_index: int
    attempt: int
    model: str
    prompt_version: str
    strategy: str | None
    proposed: dict[str, int | None] | None
    envelope: dict[str, object]
    retrieved_refs: list[str]
    policy_approved: bool
    policy_violations: list[dict[str, object]]
    guardrail_passed: bool
    guardrail_findings: list[dict[str, object]]
    accepted: bool
    dialogue: str
    created_at: str


class CrmCaseSummaryView(BaseModel):
    """A real debt case, without direct identifiers."""

    model_config = ConfigDict(extra="forbid")

    case_code: str
    amount: Decimal
    dpd: int
    status: str
    behaviour_type: str | None = None


class CreateFromCaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_code: str
    jurisdiction: str = "uk"
    tenant_id: str = "assure"
