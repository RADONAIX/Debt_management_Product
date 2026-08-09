"""Customer ORM model — ``customer_schema.customer`` from database_setup.sql."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, Numeric, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

SCHEMA = "customer_schema"


class Customer(Base):
    __tablename__ = "customer"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    customer_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    customer_type: Mapped[str] = mapped_column(String(20), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    msisdn: Mapped[str | None] = mapped_column(String(30), nullable=True)
    ban: Mapped[str | None] = mapped_column(String(30), nullable=True)
    segment_code: Mapped[str] = mapped_column(String(60), nullable=False)
    region_code: Mapped[str] = mapped_column(String(60), nullable=False)
    country_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credit_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    risk_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False, default="Low")
    contactability: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    best_contact_time: Mapped[str | None] = mapped_column(String(40), nullable=True)
    best_channel_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    onboarded_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- Subscriber 360 profile ---
    behaviour_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    preferred_language: Mapped[str | None] = mapped_column(String(40), nullable=True)
    communication_preference: Mapped[str | None] = mapped_column(String(40), nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(80), nullable=True)
    monthly_income: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    financial_stress: Mapped[str | None] = mapped_column(String(20), nullable=True)
    legal_awareness: Mapped[str | None] = mapped_column(String(20), nullable=True)
    financial_literacy: Mapped[str | None] = mapped_column(String(20), nullable=True)
    responsibility_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    credit_awareness: Mapped[str | None] = mapped_column(String(20), nullable=True)
    risk_appetite: Mapped[str | None] = mapped_column(String(20), nullable=True)
    emotional_state: Mapped[str | None] = mapped_column(String(40), nullable=True)
    life_event: Mapped[str | None] = mapped_column(String(80), nullable=True)
    employment_stability: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cooperation_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    preferred_contact_time: Mapped[str | None] = mapped_column(String(40), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    @property
    def display_name(self) -> str:
        return self.full_name or self.company_name or self.customer_code
