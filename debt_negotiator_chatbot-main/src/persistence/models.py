"""Persistence models (CLAUDE.md §7, §12).

SQLAlchemy 2.x, Postgres, confined to the ``chatbot`` schema.

> The target database is **shared**. It already carries ``collection``,
> ``customer_schema``, ``recovery_schema``, ``ml_predictions``,
> ``administration`` and ``ml_test``. Every table here is bound to ``chatbot``
> via ``MetaData(schema=...)``, so ``create_all`` physically cannot reach
> another schema's tables even by accident.

Law 7 is the reason the audit table looks over-specified: *"Collections is
regulated; the transcript is the evidence."* An audit row has to answer, months
later and to someone hostile, which prompt version and which model produced a
given sentence, what the envelope was at the time, what was rejected before this
turn was accepted, and which retrieved documents were in context.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    DECIMAL,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

SCHEMA = "chatbot"


class Base(DeclarativeBase):
    """All tables live in ``chatbot``. Nothing here can touch another schema."""

    metadata = MetaData(schema=SCHEMA)


class Session(Base):
    """One negotiation against one account."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    account_id: Mapped[str] = mapped_column(String(64), index=True)
    jurisdiction: Mapped[str] = mapped_column(String(16))
    product: Mapped[str] = mapped_column(String(64))
    principal: Mapped[Decimal] = mapped_column(DECIMAL(14, 2))
    days_overdue: Mapped[int] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    """open | agreed | escalated | closed."""

    inferred_archetype: Mapped[str | None] = mapped_column(String(24), nullable=True)

    # The concession ledger, serialised. Rebuilt into a ConcessionLedger on load,
    # so the envelope is always recomputed from evidence rather than stored --
    # a stored envelope could drift from the rules that produced it.
    ledger: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    agreement: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    turns: Mapped[list[Turn]] = relationship(
        back_populates="session", order_by="Turn.index"
    )
    audit_records: Mapped[list[AuditRecord]] = relationship(back_populates="session")
    evidence: Mapped[list[EvidenceRecord]] = relationship(back_populates="session")


class Turn(Base):
    """One utterance, either side."""

    __tablename__ = "turns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.sessions.id"), index=True
    )
    index: Mapped[int] = mapped_column(Integer)

    speaker: Mapped[str] = mapped_column(String(16))
    strategy: Mapped[str | None] = mapped_column(String(48), nullable=True)
    """Null only for debtor input we did not label. Law 4: a collector turn
    without a strategy is a bug, enforced in the domain model."""

    action: Mapped[str] = mapped_column(String(16))
    dialogue: Mapped[str] = mapped_column(Text)
    thoughts: Mapped[str] = mapped_column(Text, default="")
    proposed: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped[Session] = relationship(back_populates="turns")


class EvidenceRecord(Base):
    """An evidence event and — critically — where it came from.

    ``source`` is the security-relevant column. Soft evidence may be inferred
    from chat by the extractor; the tiers that unlock a discount may only ever
    arrive verified, out of band, with a ``verified_by`` identity attached.
    Storing the provenance means an auditor can ask "what evidence moved this
    envelope, and who stood behind it" and get a real answer.
    """

    __tablename__ = "evidence_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.sessions.id"), index=True
    )
    turn_index: Mapped[int] = mapped_column(Integer)

    kind: Mapped[str] = mapped_column(String(48))
    source: Mapped[str] = mapped_column(String(24))
    """chat_extraction | verified_upload."""

    verified_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped[Session] = relationship(back_populates="evidence")


class AuditRecord(Base):
    """The §7 full turn audit. Append-only.

    One row per *generation attempt*, not per accepted turn — a turn that was
    rejected by policy and regenerated leaves its rejected attempt here on
    purpose. "The model tried to offer 30% and we stopped it" is exactly the
    thing a regulator will want to see, and it is invisible if only the accepted
    output is kept.
    """

    __tablename__ = "audit_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.sessions.id"), index=True
    )
    turn_index: Mapped[int] = mapped_column(Integer)
    attempt: Mapped[int] = mapped_column(Integer, default=0)

    model: Mapped[str] = mapped_column(String(64))
    prompt_version: Mapped[str] = mapped_column(String(32))

    envelope: Mapped[dict[str, Any]] = mapped_column(JSONB)
    ledger: Mapped[dict[str, Any]] = mapped_column(JSONB)
    strategy: Mapped[str | None] = mapped_column(String(48), nullable=True)
    proposed: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    retrieved_refs: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    """Which retrieved chunks were in context (§7: cite in the audit record)."""

    policy_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    policy_violations: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    guardrail_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    guardrail_findings: Mapped[list[Any]] = mapped_column(JSONB, default=list)

    accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    dialogue: Mapped[str] = mapped_column(Text, default="")

    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped[Session] = relationship(back_populates="audit_records")


class Escalation(Base):
    """A hard handoff to a human (§6)."""

    __tablename__ = "escalations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey(f"{SCHEMA}.sessions.id"), index=True
    )
    turn_index: Mapped[int] = mapped_column(Integer)
    trigger: Mapped[str] = mapped_column(String(48))
    detail: Mapped[str] = mapped_column(Text, default="")

    # 0 = waiting for an Assure+ agent, 1 = accepted/in progress, 2 = resolved.
    status: Mapped[int] = mapped_column(Integer, default=0, index=True)
    assigned_to: Mapped[int | None] = mapped_column(Integer, nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
