"""Read-only access to the customer CRM (``customer_schema``).

**This module never writes.** The negotiator owns ``chatbot`` and nothing else;
``customer_schema`` belongs to another system and is shared. Every statement
here is a SELECT, the columns are named explicitly rather than ``select *``, and
``tests/persistence/test_crm_readonly.py`` walks the AST to prove no INSERT,
UPDATE, DELETE or DDL appears in this file.

Naming the columns is not style. ``select *`` would mean a column added upstream
starts arriving here automatically, and the whole point of
:class:`domain.customer.CustomerContext` is that new PII cannot reach a prompt
without someone deciding it should.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.orm import Session as OrmSession

from domain.account import Account
from domain.customer import CustomerContext, infer_archetype, level_from_word

# Explicit allow-list. Direct identifiers (full_name, email, phone, msisdn, ban,
# address, city) are deliberately absent and must stay absent.
_CASE_SQL = text(
    """
    select
        d.id                    as case_id,
        d.case_code             as case_code,
        d.amount                as amount,
        d.dpd                   as dpd,
        d.status                as case_status,
        d.risk_level            as case_risk_level,
        cu.id                   as customer_id,
        cu.segment_code         as segment_code,
        cu.region_code          as region_code,
        cu.behaviour_type       as behaviour_type,
        cu.emotional_state      as emotional_state,
        cu.financial_stress     as financial_stress,
        cu.employment_stability as employment_stability,
        cu.life_event           as life_event,
        cu.occupation           as occupation,
        cu.legal_awareness      as legal_awareness,
        cu.financial_literacy   as financial_literacy,
        cu.credit_awareness     as credit_awareness,
        cu.monthly_income       as monthly_income,
        cu.preferred_language   as preferred_language,
        cu.risk_level           as risk_level
    from customer_schema.debt_case d
    join customer_schema.customer cu on cu.id = d.customer_id
    where d.case_code = :case_code
    """
)

_LIST_SQL = text(
    """
    select d.case_code, d.amount, d.dpd, d.status, cu.behaviour_type
    from customer_schema.debt_case d
    join customer_schema.customer cu on cu.id = d.customer_id
    where (:only_open = false or d.status <> 'CLOSED')
      and d.amount > 0
    order by d.dpd desc
    limit :limit
    """
)


class CrmCaseNotFoundError(LookupError):
    """No such debt case. Fail rather than invent an account."""


class CrmCaseSummary(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    case_code: str
    amount: Decimal
    dpd: int
    status: str
    behaviour_type: str | None


class CrmCase(BaseModel):
    """A real debt case, projected to what the negotiator is allowed to use."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    account: Account
    context: CustomerContext


def list_cases(
    db: OrmSession, *, limit: int = 25, only_open: bool = True
) -> list[CrmCaseSummary]:
    rows = db.execute(_LIST_SQL, {"limit": limit, "only_open": only_open}).mappings()
    return [
        CrmCaseSummary(
            case_code=r["case_code"],
            amount=Decimal(r["amount"]),
            dpd=int(r["dpd"] or 0),
            status=r["status"],
            behaviour_type=r["behaviour_type"],
        )
        for r in rows
    ]


def load_case(
    db: OrmSession,
    case_code: str,
    *,
    jurisdiction: str = "uk",
    tenant_id: str = "assure",
    currency: str = "AED",
) -> CrmCase:
    """Project one real debt case into an ``Account`` plus behavioural context."""
    row = db.execute(_CASE_SQL, {"case_code": case_code}).mappings().first()
    if row is None:
        raise CrmCaseNotFoundError(f"no debt case '{case_code}'")

    amount = Decimal(row["amount"] or 0)
    if amount <= 0:
        # Account.principal is constrained to > 0, and a settled or zero-balance
        # case has nothing to negotiate. Better to refuse than to open a session
        # that cannot produce a valid agreement.
        raise CrmCaseNotFoundError(
            f"debt case '{case_code}' has no outstanding balance ({amount})"
        )

    context = CustomerContext(
        customer_ref=str(row["customer_id"]),
        inferred_archetype=infer_archetype(
            row["behaviour_type"], row["financial_stress"], row["emotional_state"]
        ),
        behaviour_type=row["behaviour_type"],
        emotional_state=row["emotional_state"],
        financial_stress=row["financial_stress"],
        employment_stability=row["employment_stability"],
        life_event=row["life_event"],
        occupation=row["occupation"],
        legal_awareness=level_from_word(row["legal_awareness"]),
        financial_literacy=level_from_word(row["financial_literacy"]),
        credit_awareness=level_from_word(row["credit_awareness"]),
        monthly_income=(
            Decimal(row["monthly_income"])
            if row["monthly_income"] is not None
            else None
        ),
        preferred_language=row["preferred_language"],
        risk_level=row["risk_level"],
    )

    account = Account(
        account_id=str(row["case_code"]),
        tenant_id=tenant_id,
        jurisdiction=jurisdiction,
        product=str(row["segment_code"] or "unsecured_personal_loan"),
        principal=amount,
        currency=currency,
        days_overdue=int(row["dpd"] or 0),
        inferred_archetype=context.inferred_archetype,
    )
    return CrmCase(account=account, context=context)
