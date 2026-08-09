"""Configurable risk scoring: one definition per score, with a threshold ladder."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

SCHEMA = "administration"


class RiskScoreDefinition(Base):
    __tablename__ = "risk_score_definition"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # RULE = evaluate the bands below; ML = defer to the model service.
    mode: Mapped[str] = mapped_column(String(10), default="RULE", nullable=False)
    driver_field: Mapped[str | None] = mapped_column(String(60), nullable=True)
    weight_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    direction: Mapped[str] = mapped_column(String(20), default="HIGHER_WORSE", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    bands: Mapped[list[RiskScoreBand]] = relationship(
        back_populates="definition", cascade="all, delete-orphan", lazy="selectin",
        order_by="RiskScoreBand.sort_order",
    )


class RiskScoreBand(Base):
    """One rung: `driver_field >= min_value → score`. NULL min_value is the catch-all."""

    __tablename__ = "risk_score_band"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    definition_id: Mapped[int] = mapped_column(
        ForeignKey(f"{SCHEMA}.risk_score_definition.id", ondelete="CASCADE"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    min_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    score: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    label: Mapped[str | None] = mapped_column(String(80), nullable=True)
    band_value: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    definition: Mapped[RiskScoreDefinition] = relationship(back_populates="bands")
