"""Dunning strategy ORM model — ``public.strategy`` from database_setup.sql."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import ARRAY, BigInteger, Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Strategy(Base):
    __tablename__ = "strategy"
    __table_args__ = {"schema": "public"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # Business key the API and UI address strategies by.
    strategy_code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # FK'd to master_data (SEGMENT, code) through a generated category column.
    segment_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # Multi-select: a strategy can suit several buckets / bands at once.
    aging_bucket: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    risk_level: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)
    current_version: Mapped[str] = mapped_column(String(10), default="v1.0", nullable=False)
    workflow_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    target_audience: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    ab_test_config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    # Designer Configuration panel: dialer defaults and similar strategy-level settings.
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Suitability profile — who this journey is written for.
    behaviour_type: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    emotion_type: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    minimum_income: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    maximum_income: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    minimum_loan: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    maximum_loan: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    # Outcome metrics.
    average_collection: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    average_turns: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    uplift_pct: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    success_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("administration.app_user.id"), nullable=True
    )
    updated_by: Mapped[int | None] = mapped_column(
        ForeignKey("administration.app_user.id"), nullable=True
    )
