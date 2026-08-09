"""Customer 360 read + profile maintenance."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationFailedError
from app.modules.customers import schemas
from app.modules.customers.models import Customer


def _f(value) -> float | None:
    return float(value) if value is not None else None


def _grade(value: str | None, what: str) -> str | None:
    """The graded attributes all share one Low / Medium / High scale."""
    if not value:
        return None
    match = next((g for g in schemas.GRADES if g.lower() == value.strip().lower()), None)
    if match is None:
        raise ValidationFailedError(f"{what} must be one of {', '.join(schemas.GRADES)}.")
    return match


def _pct(value: float | None, what: str) -> float | None:
    if value is None:
        return None
    if not 0 <= value <= 100:
        raise ValidationFailedError(f"{what} must be between 0 and 100.")
    return value


def to_row(c: Customer) -> schemas.CustomerRow:
    return schemas.CustomerRow(
        id=c.customer_code,
        name=c.display_name,
        customerType=c.customer_type,
        segment=c.segment_code,
        riskLevel=c.risk_level,
        status=c.status,
    )


def to_profile(c: Customer) -> schemas.CustomerProfile:
    return schemas.CustomerProfile(
        id=c.customer_code,
        name=c.display_name,
        customerType=c.customer_type,
        email=c.email,
        phone=c.phone,
        msisdn=c.msisdn,
        ban=c.ban,
        segment=c.segment_code,
        region=c.region_code,
        country=c.country_code,
        city=c.city,
        address=c.address,
        creditScore=c.credit_score,
        riskScore=float(c.risk_score),
        riskLevel=c.risk_level,
        contactability=float(c.contactability),
        bestContactTime=c.best_contact_time,
        bestChannel=c.best_channel_code,
        status=c.status,
        onboardedOn=c.onboarded_on,
        behaviourType=c.behaviour_type,
        preferredLanguage=c.preferred_language,
        communicationPreference=c.communication_preference,
        occupation=c.occupation,
        monthlyIncome=_f(c.monthly_income),
        financialStress=c.financial_stress,
        legalAwareness=c.legal_awareness,
        financialLiteracy=c.financial_literacy,
        responsibilityScore=_f(c.responsibility_score),
        creditAwareness=c.credit_awareness,
        riskAppetite=c.risk_appetite,
        emotionalState=c.emotional_state,
        lifeEvent=c.life_event,
        employmentStability=c.employment_stability,
        cooperationScore=_f(c.cooperation_score),
        preferredContactTime=c.preferred_contact_time,
    )


# The subscriber line and its enterprise hierarchy, in one pass. Kept as SQL
# because it spans six tables that have no ORM models in this module.
_LINE_SQL = text("""
    SELECT a.subscriber_no, co.company_code, co.name AS company_name, b.name AS branch,
           d.name AS department, ba.ban, a.service_type, a.contract_plan,
           a.status AS account_status, a.activation_date, a.outstanding, a.dpd,
           a.aging_bucket, s.name AS strategy_name,
           u.full_name AS agent_name,
           a.last_payment_at::date AS last_payment_date,
           a.last_contact_at::date AS last_contact_date,
           a.next_followup_date,
           COALESCE(gi.invoice_no, ii.invoice_no)     AS invoice_no,
           COALESCE(gi.invoice_type, ii.invoice_type) AS invoice_type
      FROM customer_schema.account a
      LEFT JOIN customer_schema.billing_account ba ON ba.id = a.billing_account_id
      LEFT JOIN customer_schema.company_branch b   ON b.id = a.branch_id
      LEFT JOIN customer_schema.company co         ON co.id = b.company_id
      LEFT JOIN customer_schema.department d       ON d.id = a.department_id
      LEFT JOIN public.strategy s                  ON s.id = a.strategy_id
      LEFT JOIN administration.app_user u          ON u.id = a.assigned_agent_id
      LEFT JOIN customer_schema.invoice_group_member m ON m.account_id = a.id
      LEFT JOIN customer_schema.invoice gi ON gi.id = m.invoice_id
      LEFT JOIN customer_schema.invoice ii ON ii.account_id = a.id
                                          AND ii.invoice_type = 'INDIVIDUAL'
     WHERE a.customer_id = ANY(:ids)
     ORDER BY a.id
     LIMIT 1
""")


async def get(db: AsyncSession, code: str) -> Customer:
    customer = (
        await db.execute(select(Customer).where(Customer.customer_code == code))
    ).scalar_one_or_none()
    if customer is None:
        raise NotFoundError(f"Customer '{code}' does not exist.")
    return customer


# The graded attributes on Subscriber 360 come from the rule bands, so editing
# a threshold changes what the screen says. Each maps to its scored column.
_GRADED_FROM_RULES = {
    "financialStress": ("financial_stress", "financial_stress_score"),
    "legalAwareness": ("legal_awareness", "legal_awareness_score"),
    "financialLiteracy": ("financial_literacy", "financial_literacy_score"),
    "creditAwareness": ("credit_awareness", "credit_awareness_score"),
    "employmentStability": ("employment_stability", "employment_stability_score"),
}


async def _apply_rule_grades(db: AsyncSession, profile: schemas.CustomerProfile, cid: int) -> None:
    """Replace the stored grades with the band value the score actually lands in."""
    row = (
        await db.execute(
            text(
                "SELECT * FROM customer_schema.subscriber_risk_profile"
                " WHERE subscriber_id = :cid"
            ),
            {"cid": cid},
        )
    ).mappings().first()
    if row is None:
        return

    from app.modules.risk.service import band_values, grade_for

    bands = await band_values(db)
    for field, (code, column) in _GRADED_FROM_RULES.items():
        score = row[column]
        grade = grade_for(bands.get(code, []), float(score) if score is not None else None)
        if grade:
            setattr(profile, field, grade)
    # The two numeric scores come from the same run, so they agree with the grades.
    if row["responsibility_score"] is not None:
        profile.responsibilityScore = float(row["responsibility_score"])
    if row["cooperation_score"] is not None:
        profile.cooperationScore = float(row["cooperation_score"])


async def profile_with_line(db: AsyncSession, code: str) -> schemas.CustomerProfile:
    """The 360 view: the customer record plus its subscriber line."""
    customer = await get(db, code)
    profile = to_profile(customer)
    line = (await db.execute(_LINE_SQL, {"ids": [customer.id]})).mappings().first()
    # Header figures cover every line the customer holds, not just the first.
    totals = (
        await db.execute(
            text(
                "SELECT COALESCE(sum(outstanding),0) AS total, COALESCE(max(dpd),0) AS dpd,"
                " count(*) AS lines, max(currency_code) AS currency"
                " FROM customer_schema.account WHERE customer_id = ANY(:ids)"
            ),
            {"ids": [customer.id]},
        )
    ).mappings().first()
    await _apply_rule_grades(db, profile, customer.id)
    if totals:
        profile.totalOutstanding = _f(totals["total"])
        profile.lineCount = int(totals["lines"] or 1)
        profile.currency = totals["currency"] or "USD"
    if line:
        profile.subscriberNo = line["subscriber_no"]
        profile.companyCode = line["company_code"]
        profile.companyName = line["company_name"]
        profile.branch = line["branch"]
        profile.department = line["department"]
        profile.billingAccountNumber = line["ban"]
        profile.invoiceNumber = line["invoice_no"]
        profile.invoiceType = line["invoice_type"]
        profile.serviceType = line["service_type"]
        profile.plan = line["contract_plan"]
        profile.accountStatus = line["account_status"]
        profile.activationDate = line["activation_date"]
        profile.outstanding = _f(line["outstanding"])
        profile.currentDpd = int(totals["dpd"]) if totals else line["dpd"]
        profile.agingBucket = line["aging_bucket"]
        profile.assignedStrategy = line["strategy_name"]
        profile.assignedAgent = line["agent_name"]
        profile.lastPaymentDate = line["last_payment_date"]
        profile.lastContactDate = line["last_contact_date"]
        profile.nextFollowupDate = line["next_followup_date"]
    return profile


_HISTORY_SQL = text("""
    SELECT to_char(h.as_of_month, 'Mon') AS month, h.risk_score
      FROM customer_schema.risk_history h
      JOIN customer_schema.account a ON a.id = h.account_id
     WHERE a.customer_id = ANY(:ids)
     ORDER BY h.as_of_month
""")

_PAYMENTS_SQL = text("""
    -- Always six buckets: a month with no payment must plot as zero rather than
    -- vanish, otherwise a single bar looks like the customer's whole history.
    WITH months AS (
        SELECT generate_series(
                 date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
                 date_trunc('month', CURRENT_DATE),
                 INTERVAL '1 month') AS m
    )
    SELECT to_char(months.m, 'Mon') AS month,
           COALESCE(sum(p.amount), 0) AS amount,
           CASE WHEN COALESCE(sum(p.amount), 0) = 0 THEN 'MISSED'
                ELSE COALESCE(max(p.status), 'COMPLETED') END AS status
      FROM months
      LEFT JOIN customer_schema.payment p
             ON date_trunc('month', p.payment_date) = months.m
            AND p.customer_id = ANY(:ids)
     GROUP BY months.m
     ORDER BY months.m
""")

_ENGAGEMENT_SQL = text("""
    SELECT
      (SELECT p.amount FROM customer_schema.payment p
        WHERE p.customer_id = ANY(:ids) ORDER BY p.payment_date DESC LIMIT 1) AS last_amount,
      (SELECT count(*) FROM customer_schema.dispute d
        WHERE d.customer_id = ANY(:ids)) AS disputes,
      (SELECT count(*) FROM customer_schema.ptp t
        WHERE t.customer_id = ANY(:ids)) AS ptp_total,
      (SELECT count(*) FROM customer_schema.ptp t
        WHERE t.customer_id = ANY(:ids) AND t.status IN ('KEPT','FULFILLED')) AS ptp_kept,
      (SELECT t.status FROM customer_schema.ptp t
        WHERE t.customer_id = ANY(:ids) ORDER BY t.promised_date DESC LIMIT 1) AS ptp_status,
      (SELECT count(*) FROM customer_schema.case_activity ca
         JOIN customer_schema.debt_case dc ON dc.id = ca.case_id
        WHERE dc.customer_id = ANY(:ids)) AS communications,
      (SELECT dc.case_code FROM customer_schema.debt_case dc
        WHERE dc.customer_id = ANY(:ids) ORDER BY dc.opened_at DESC LIMIT 1) AS case_code,
      (SELECT dc.status FROM customer_schema.debt_case dc
        WHERE dc.customer_id = ANY(:ids) ORDER BY dc.opened_at DESC LIMIT 1) AS case_status,
      (SELECT a.dunning_stage FROM customer_schema.account a
        WHERE a.customer_id = ANY(:ids) ORDER BY a.id LIMIT 1) AS dunning_stage,
      (SELECT count(*) FROM customer_schema.invoice i
        WHERE i.customer_id = ANY(:ids) AND i.status IN ('OVERDUE','PARTIAL')) AS overdue_invoices
""")


def _risk_drivers(p: schemas.Customer360) -> list[str]:
    """Plain-language reasons behind the score, from the record itself."""
    drivers: list[str] = []
    if (p.currentDpd or 0) > 60:
        drivers.append(f"{p.currentDpd} days past due")
    elif (p.currentDpd or 0) > 0:
        drivers.append(f"In the {p.agingBucket} ageing bucket")
    if p.creditScore is not None and p.creditScore < 600:
        drivers.append(f"Low credit score ({p.creditScore})")
    if p.contactability < 50:
        drivers.append(f"Hard to reach ({round(p.contactability)}% contactability)")
    if p.financialStress == "High":
        drivers.append("High financial stress")
    if p.employmentStability == "Low":
        drivers.append("Unstable employment")
    if p.disputeRate > 0:
        drivers.append(f"{int(p.disputeRate)} open or past dispute(s)")
    return drivers or ["No material risk drivers"]


async def build_360(db: AsyncSession, code: str) -> schemas.Customer360:
    """Everything the Customer 360 screen renders, straight from the tables."""
    profile = await profile_with_line(db, code)
    customer = await get(db, code)
    data = schemas.Customer360(**profile.model_dump())
    params = {"ids": [customer.id]}

    data.riskTrend = [
        schemas.TrendPoint(month=r["month"], score=float(r["risk_score"]))
        for r in (await db.execute(_HISTORY_SQL, params)).mappings()
    ]
    data.paymentHistory = [
        schemas.PaymentPoint(
            month=r["month"], amount=float(r["amount"]), status=r["status"] or "POSTED"
        )
        for r in (await db.execute(_PAYMENTS_SQL, params)).mappings()
    ]

    e = (await db.execute(_ENGAGEMENT_SQL, params)).mappings().first()
    if e:
        data.lastPaymentAmount = _f(e["last_amount"])
        data.disputeRate = float(e["disputes"] or 0)
        data.ptpSuccess = round(100 * (e["ptp_kept"] or 0) / (e["ptp_total"] or 1), 1)
        data.ptpStatus = e["ptp_status"]
        data.communications = int(e["communications"] or 0)
        data.caseId = e["case_code"]
        data.caseStatus = e["case_status"]
        data.dunningStage = int(e["dunning_stage"] or 0)
        overdue = int(e["overdue_invoices"] or 0)
        # The next action follows from where the account sits, not from a guess.
        dpd = data.currentDpd or 0
        data.nextAction = (
            "Legal escalation review" if dpd > 90
            else "Field visit / final notice" if dpd > 60
            else "Collection call" if dpd > 30
            else "Scheduled reminder" if dpd > 0 or overdue
            else "Monitor"
        )
    data.contactability = float(customer.contactability)
    data.riskDrivers = _risk_drivers(data)
    return data


async def list_all(
    db: AsyncSession,
    *,
    search: str | None,
    limit: int,
    offset: int,
    customer_type: str | None = None,
) -> list[schemas.CustomerRow]:
    stmt = select(Customer).order_by(Customer.customer_code)
    if customer_type:
        # Organisations are picked from the company list instead, so the
        # customer picker can ask for individuals only.
        stmt = stmt.where(func.upper(Customer.customer_type) == customer_type.upper())
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Customer.customer_code).like(like),
                func.lower(func.coalesce(Customer.full_name, "")).like(like),
                func.lower(func.coalesce(Customer.company_name, "")).like(like),
                func.lower(func.coalesce(Customer.email, "")).like(like),
            )
        )
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return [to_row(c) for c in rows]


async def update_profile(
    db: AsyncSession, code: str, payload: schemas.CustomerProfileUpdate
) -> Customer:
    c = await get(db, code)
    graded = {
        "financialStress": "financial_stress",
        "legalAwareness": "legal_awareness",
        "financialLiteracy": "financial_literacy",
        "creditAwareness": "credit_awareness",
        "riskAppetite": "risk_appetite",
        "employmentStability": "employment_stability",
    }
    plain = {
        "behaviourType": "behaviour_type",
        "preferredLanguage": "preferred_language",
        "communicationPreference": "communication_preference",
        "occupation": "occupation",
        "emotionalState": "emotional_state",
        "lifeEvent": "life_event",
        "preferredContactTime": "preferred_contact_time",
    }
    for api_name, column in graded.items():
        value = getattr(payload, api_name)
        if value is not None:
            setattr(c, column, _grade(value, api_name))
    for api_name, column in plain.items():
        value = getattr(payload, api_name)
        if value is not None:
            setattr(c, column, value)
    if payload.monthlyIncome is not None:
        if payload.monthlyIncome < 0:
            raise ValidationFailedError("Monthly income cannot be negative.")
        c.monthly_income = payload.monthlyIncome
    if payload.responsibilityScore is not None:
        c.responsibility_score = _pct(payload.responsibilityScore, "Responsibility score")
    if payload.cooperationScore is not None:
        c.cooperation_score = _pct(payload.cooperationScore, "Cooperation score")
    await db.flush()
    await db.refresh(c)
    return c


# --- Borrower 360 tabs ------------------------------------------------------
_INVOICES_SQL = text("""
    -- A line's own invoices, plus its share of any consolidated invoice it sits
    -- on, so the list always adds up to what the customer actually owes.
    SELECT i.invoice_no, a.service_type AS product, i.due_date,
           i.amount + i.tax_amount AS amount, i.paid_amount, i.status, i.invoice_type
      FROM customer_schema.invoice i
      LEFT JOIN customer_schema.account a ON a.id = i.account_id
     WHERE i.customer_id = ANY(:ids) AND i.invoice_type = 'INDIVIDUAL'

    UNION ALL

    SELECT i.invoice_no,
           a.service_type || ' (shared)' AS product,
           i.due_date,
           round((i.amount + i.tax_amount) * m.share_amount / NULLIF(tot.total_share, 0), 2) AS amount,
           round(i.paid_amount * m.share_amount / NULLIF(tot.total_share, 0), 2) AS paid_amount,
           i.status, i.invoice_type
      FROM customer_schema.invoice_group_member m
      JOIN customer_schema.invoice i ON i.id = m.invoice_id
      JOIN customer_schema.account a ON a.id = m.account_id
      JOIN (SELECT invoice_id, sum(share_amount) AS total_share
              FROM customer_schema.invoice_group_member GROUP BY invoice_id) tot
        ON tot.invoice_id = m.invoice_id
     WHERE a.customer_id = ANY(:ids)

     ORDER BY due_date DESC
     LIMIT 120
""")

_PAYMENT_ROWS_SQL = text("""
    SELECT p.payment_ref, p.payment_date, p.amount, p.method_code, p.status,
           i.invoice_no
      FROM customer_schema.payment p
      LEFT JOIN customer_schema.invoice i ON i.id = p.invoice_id
     WHERE p.customer_id = ANY(:ids)
     ORDER BY p.payment_date DESC
     LIMIT 120
""")

_INTERACTIONS_SQL = text("""
    SELECT ca.occurred_at, ca.activity_type, ca.channel_code, ca.direction,
           ca.subject, ca.outcome, ca.is_automated, u.full_name AS agent
      FROM customer_schema.case_activity ca
      LEFT JOIN administration.app_user u ON u.id = ca.agent_id
     WHERE ca.customer_id = ANY(:ids)
     ORDER BY ca.occurred_at DESC
     LIMIT 30
""")

_DISPUTES_SQL = text("""
    SELECT d.dispute_code, d.reason_code, d.description, d.amount, d.status,
           d.priority, d.filed_at, d.sla_deadline
      FROM customer_schema.dispute d
     WHERE d.customer_id = ANY(:ids)
     ORDER BY d.filed_at DESC
""")

_MILESTONES_SQL = text("""
    SELECT a.activation_date, a.last_payment_at::date AS last_payment,
           a.last_contact_at::date AS last_contact, a.next_followup_date,
           a.dpd, a.dunning_stage,
           (SELECT min(t.promised_date) FROM customer_schema.ptp t
             WHERE t.account_id = a.id) AS first_promise,
           (SELECT min(dc.opened_at)::date FROM customer_schema.debt_case dc
             WHERE dc.account_id = a.id) AS case_opened
      FROM customer_schema.account a
     WHERE a.customer_id = ANY(:ids)
     ORDER BY a.id LIMIT 1
""")


async def borrower_file(db: AsyncSession, code: str) -> schemas.BorrowerFile:
    """The five Borrower 360 tabs, all from the customer's own records."""
    customer = await get(db, code)
    return await _borrower_for(db, [customer.id])


async def _borrower_for(db: AsyncSession, ids: list[int]) -> schemas.BorrowerFile:
    params = {"ids": ids}
    out = schemas.BorrowerFile()

    out.invoices = [
        schemas.InvoiceRow(
            invoiceNo=r["invoice_no"], product=r["product"], dueDate=r["due_date"],
            amount=float(r["amount"]), paid=float(r["paid_amount"]),
            status=r["status"], invoiceType=r["invoice_type"],
        )
        for r in (await db.execute(_INVOICES_SQL, params)).mappings()
    ]
    out.payments = [
        schemas.PaymentRow(
            reference=r["payment_ref"], date=r["payment_date"], amount=float(r["amount"]),
            method=r["method_code"], status=r["status"], invoiceNo=r["invoice_no"],
        )
        for r in (await db.execute(_PAYMENT_ROWS_SQL, params)).mappings()
    ]
    out.interactions = [
        schemas.InteractionRow(
            occurredAt=r["occurred_at"], type=r["activity_type"], channel=r["channel_code"],
            direction=r["direction"], subject=r["subject"], outcome=r["outcome"],
            agent=r["agent"], automated=bool(r["is_automated"]),
        )
        for r in (await db.execute(_INTERACTIONS_SQL, params)).mappings()
    ]
    out.disputes = [
        schemas.DisputeRow(
            disputeCode=r["dispute_code"], reason=r["reason_code"].replace("_", " ").title(),
            description=r["description"], amount=float(r["amount"]), status=r["status"],
            priority=r["priority"], filedAt=r["filed_at"], slaDeadline=r["sla_deadline"],
        )
        for r in (await db.execute(_DISPUTES_SQL, params)).mappings()
    ]

    m = (await db.execute(_MILESTONES_SQL, params)).mappings().first()
    if m:
        out.milestones = [
            schemas.MilestoneRow(label="Service activated", date=m["activation_date"],
                                 status="DONE", detail="Line activated on the network"),
            schemas.MilestoneRow(label="Last payment received", date=m["last_payment"],
                                 status="DONE" if m["last_payment"] else "PENDING"),
            schemas.MilestoneRow(label="Case opened", date=m["case_opened"],
                                 status="DONE" if m["case_opened"] else "NOT_APPLICABLE",
                                 detail="Collections case raised" if m["case_opened"] else "No case"),
            schemas.MilestoneRow(label="Promise to pay", date=m["first_promise"],
                                 status="DONE" if m["first_promise"] else "NOT_APPLICABLE"),
            schemas.MilestoneRow(label="Last contact", date=m["last_contact"],
                                 status="DONE" if m["last_contact"] else "PENDING"),
            schemas.MilestoneRow(label="Next follow-up", date=m["next_followup_date"],
                                 status="PENDING",
                                 detail=f"Dunning stage {m['dunning_stage']}"),
        ]
    return out


# --- Enterprise hierarchy ---------------------------------------------------
_COMPANIES_SQL = text("""
    SELECT co.company_code, co.name, co.industry, co.hq_city,
           (SELECT count(*) FROM customer_schema.company_branch b
             WHERE b.company_id = co.id) AS branches,
           (SELECT count(*) FROM customer_schema.account a
              JOIN customer_schema.company_branch b2 ON b2.id = a.branch_id
             WHERE b2.company_id = co.id) AS subscribers,
           (SELECT COALESCE(sum(a.outstanding), 0) FROM customer_schema.account a
              JOIN customer_schema.company_branch b3 ON b3.id = a.branch_id
             WHERE b3.company_id = co.id) AS outstanding,
           (SELECT array_agg(ba.ban ORDER BY ba.ban) FROM customer_schema.billing_account ba
             WHERE ba.company_id = co.id) AS bans
      FROM customer_schema.company co
     ORDER BY co.company_code
""")

_BRANCHES_SQL = text("""
    SELECT b.branch_code, b.name, b.city, b.is_head_office,
           count(a.id) AS subscribers,
           COALESCE(sum(a.outstanding), 0) AS outstanding
      FROM customer_schema.company_branch b
      JOIN customer_schema.company co ON co.id = b.company_id
      LEFT JOIN customer_schema.account a ON a.branch_id = b.id
     WHERE co.company_code = :code
     GROUP BY b.id, b.branch_code, b.name, b.city, b.is_head_office
     ORDER BY b.is_head_office DESC, b.branch_code
""")

_BRANCH_SUBS_SQL = text("""
    SELECT b.branch_code, c.customer_code,
           COALESCE(c.full_name, c.company_name, c.customer_code) AS name, a.subscriber_no,
           a.service_type, a.contract_plan, ba.ban, a.outstanding, a.dpd,
           a.risk_level, a.status
      FROM customer_schema.account a
      JOIN customer_schema.company_branch b ON b.id = a.branch_id
      JOIN customer_schema.company co ON co.id = b.company_id
      JOIN customer_schema.customer c ON c.id = a.customer_id
      LEFT JOIN customer_schema.billing_account ba ON ba.id = a.billing_account_id
     WHERE co.company_code = :code
     ORDER BY b.branch_code, c.full_name
""")


async def list_companies(db: AsyncSession) -> list[schemas.CompanyRow]:
    return [
        schemas.CompanyRow(
            id=r["company_code"], name=r["name"], industry=r["industry"], hqCity=r["hq_city"],
            branches=r["branches"], subscribers=r["subscribers"],
            bans=list(r["bans"] or []), outstanding=float(r["outstanding"]),
        )
        for r in (await db.execute(_COMPANIES_SQL)).mappings()
    ]


async def company_detail(db: AsyncSession, code: str) -> schemas.CompanyDetail:
    """A company with its branches, each branch listing its subscribers."""
    companies = [c for c in await list_companies(db) if c.id == code]
    if not companies:
        raise NotFoundError(f"Company '{code}' does not exist.")
    detail = schemas.CompanyDetail(**companies[0].model_dump())

    subs: dict[str, list[schemas.SubscriberRow]] = {}
    for r in (await db.execute(_BRANCH_SUBS_SQL, {"code": code})).mappings():
        subs.setdefault(r["branch_code"], []).append(
            schemas.SubscriberRow(
                id=r["customer_code"], name=r["name"], subscriberNo=r["subscriber_no"],
                servicePlan=f"{r['service_type']} · {r['contract_plan']}",
                ban=r["ban"], outstanding=float(r["outstanding"]), dpd=r["dpd"],
                riskLevel=r["risk_level"], status=r["status"],
            )
        )

    detail.branchList = [
        schemas.BranchRow(
            id=r["branch_code"], name=r["name"], city=r["city"],
            isHeadOffice=r["is_head_office"], subscribers=r["subscribers"],
            outstanding=float(r["outstanding"]), subscriberList=subs.get(r["branch_code"], []),
        )
        for r in (await db.execute(_BRANCHES_SQL, {"code": code})).mappings()
    ]
    return detail


# --- Company-level 360 ------------------------------------------------------
async def _company_customer_ids(db: AsyncSession, code: str) -> tuple[int, list[int]]:
    """The company row id and every customer holding a line under it."""
    row = (
        await db.execute(
            text("SELECT id, name FROM customer_schema.company WHERE company_code = :code"),
            {"code": code},
        )
    ).mappings().first()
    if row is None:
        raise NotFoundError(f"Company '{code}' does not exist.")
    ids = [
        r[0]
        for r in (
            await db.execute(
                text(
                    "SELECT DISTINCT a.customer_id"
                    "  FROM customer_schema.account a"
                    "  JOIN customer_schema.company_branch b ON b.id = a.branch_id"
                    " WHERE b.company_id = :cid"
                ),
                {"cid": row["id"]},
            )
        ).all()
    ]
    return row["id"], ids


_COMPANY_SUMMARY_SQL = text("""
    SELECT COALESCE(sum(a.outstanding), 0) AS outstanding,
           COALESCE(max(a.dpd), 0)         AS dpd,
           count(a.id)                     AS lines,
           COALESCE(round(avg(a.risk_score), 2), 0) AS risk_score,
           COALESCE(round(avg(a.contactability), 2), 0) AS contactability,
           max(a.last_payment_at)::date    AS last_payment,
           max(a.last_contact_at)::date    AS last_contact,
           min(a.next_followup_date)       AS next_followup,
           min(a.activation_date)          AS activation,
           COALESCE(max(a.dunning_stage), 0) AS dunning_stage,
           string_agg(DISTINCT a.service_type, ', ')  AS services,
           max(a.currency_code)            AS currency
      FROM customer_schema.account a
      JOIN customer_schema.company_branch b ON b.id = a.branch_id
     WHERE b.company_id = :cid
""")


async def build_company_360(db: AsyncSession, code: str) -> schemas.Customer360:
    """The same 360 record as a subscriber, rolled up over a whole company."""
    company_id, ids = await _company_customer_ids(db, code)
    company = (
        await db.execute(
            text(
                "SELECT company_code, name, industry, hq_city, country_code, status"
                "  FROM customer_schema.company WHERE id = :cid"
            ),
            {"cid": company_id},
        )
    ).mappings().first()
    s = (await db.execute(_COMPANY_SUMMARY_SQL, {"cid": company_id})).mappings().first()
    params = {"ids": ids or [-1]}

    risk = float(s["risk_score"])
    data = schemas.Customer360(
        id=company["company_code"],
        name=company["name"],
        customerType="ENTERPRISE",
        segment="Enterprise",
        region=company["hq_city"] or "—",
        city=company["hq_city"],
        country=company["country_code"],
        status=company["status"],
        riskScore=risk,
        riskLevel=("Critical" if risk >= 75 else "High" if risk >= 55
                   else "Medium" if risk >= 30 else "Low"),
        contactability=float(s["contactability"]),
        companyCode=company["company_code"],
        companyName=company["name"],
        serviceType=s["services"],
        plan=f"{s['lines']} subscriber lines",
        accountStatus="DELINQUENT" if s["dpd"] > 0 else "CURRENT",
        activationDate=s["activation"],
        outstanding=_f(s["outstanding"]),
        totalOutstanding=_f(s["outstanding"]),
        lineCount=int(s["lines"]),
        currency=s["currency"] or "USD",
        currentDpd=int(s["dpd"]),
        agingBucket=("90+" if s["dpd"] > 90 else "61-90" if s["dpd"] > 60
                     else "31-60" if s["dpd"] > 30 else "1-30" if s["dpd"] > 0 else "Current"),
        lastPaymentDate=s["last_payment"],
        lastContactDate=s["last_contact"],
        nextFollowupDate=s["next_followup"],
        dunningStage=int(s["dunning_stage"]),
        occupation=company["industry"],
        createdAt=datetime.now(UTC),
        updatedAt=datetime.now(UTC),
    )

    # Billing account numbers and the branch mix belong on the header.
    bans = [
        r[0]
        for r in (
            await db.execute(
                text(
                    "SELECT ban FROM customer_schema.billing_account"
                    " WHERE company_id = :cid ORDER BY ban"
                ),
                {"cid": company_id},
            )
        ).all()
    ]
    data.billingAccountNumber = ", ".join(bans) if bans else None
    data.branch = (
        await db.execute(
            text(
                "SELECT count(*)::text || ' branches' FROM customer_schema.company_branch"
                " WHERE company_id = :cid"
            ),
            {"cid": company_id},
        )
    ).scalar_one()

    # Risk trend: the company's average score per month.
    trend = (
        await db.execute(
            text("""
                SELECT to_char(h.as_of_month, 'Mon') AS month,
                       round(avg(h.risk_score), 2) AS risk_score
                  FROM customer_schema.risk_history h
                  JOIN customer_schema.account a ON a.id = h.account_id
                  JOIN customer_schema.company_branch b ON b.id = a.branch_id
                 WHERE b.company_id = :cid
                 GROUP BY h.as_of_month
                 ORDER BY h.as_of_month
            """),
            {"cid": company_id},
        )
    ).mappings()
    data.riskTrend = [
        schemas.TrendPoint(month=r["month"], score=float(r["risk_score"])) for r in trend
    ]
    data.paymentHistory = [
        schemas.PaymentPoint(
            month=r["month"], amount=float(r["amount"]), status=r["status"] or "COMPLETED"
        )
        for r in (await db.execute(_PAYMENTS_SQL, params)).mappings()
    ]

    e = (await db.execute(_ENGAGEMENT_SQL, params)).mappings().first()
    if e:
        data.lastPaymentAmount = _f(e["last_amount"])
        data.disputeRate = float(e["disputes"] or 0)
        data.ptpSuccess = round(100 * (e["ptp_kept"] or 0) / (e["ptp_total"] or 1), 1)
        data.ptpStatus = e["ptp_status"]
        data.communications = int(e["communications"] or 0)
        data.caseId = e["case_code"]
        data.caseStatus = e["case_status"]
    dpd = data.currentDpd or 0
    data.nextAction = (
        "Legal escalation review" if dpd > 90
        else "Field visit / final notice" if dpd > 60
        else "Collection call" if dpd > 30
        else "Scheduled reminder" if dpd > 0
        else "Monitor"
    )
    data.riskDrivers = _risk_drivers(data)
    return data


async def company_borrower_file(db: AsyncSession, code: str) -> schemas.BorrowerFile:
    """Invoices, payments, interactions and disputes across the whole company."""
    _, ids = await _company_customer_ids(db, code)
    return await _borrower_for(db, ids or [-1])


# --- Behavioural signals ----------------------------------------------------
# subscriber_risk_profile is keyed by subscriber_id = account.id, but carries
# more than one row for some lines, so the newest calculation wins.
# subscriber_risk_profile is keyed by customer id (see its foreign key), one
# row per customer across all their lines.
_SIGNALS_SQL = text("""
    SELECT DISTINCT ON (s.subscriber_id) s.*
      FROM customer_schema.subscriber_risk_profile s
     WHERE s.subscriber_id = ANY(:ids)
     ORDER BY s.subscriber_id, s.last_calculated DESC NULLS LAST, s.id DESC
""")


async def subscriber_signals(db: AsyncSession, code: str) -> schemas.SubscriberSignals | None:
    customer = await get(db, code)
    r = (await db.execute(_SIGNALS_SQL, {"ids": [customer.id]})).mappings().first()
    if r is None:
        return None

    billed = r["invoices_last_12m"] or 0
    on_time = r["invoices_paid_on_time"] or 0
    return schemas.SubscriberSignals(
        behaviourType=r["behaviour_type"],
        riskBand=(r["risk_band"] or "").title() or None,
        recommendedStrategy=r["recommended_strategy"],
        accountAgeMonths=r["account_age_months"],
        invoicesLast12m=billed or None,
        invoicesPaidOnTime=on_time or None,
        # Capped: the source occasionally records more settled than billed.
        onTimePct=round(min(100.0, 100 * on_time / billed), 1) if billed else None,
        avgPaymentDelayDays=_f(r["avg_payment_delay_days"]),
        ptpCount=r["ptp_count"], ptpHonoured=r["ptp_honoured"], ptpBroken=r["ptp_broken"],
        disputesRaised=r["disputes_raised"], complaintsRaised=r["complaints_raised"],
        successfulContacts=r["successful_contacts"], failedContacts=r["failed_contacts"],
        smsResponseRate=_f(r["sms_response_rate"]),
        emailResponseRate=_f(r["email_response_rate"]),
        callAnswerRate=_f(r["call_answer_rate"]),
        legalNotices=r["legal_notices"], settlements=r["settlements"], writeoffs=r["writeoffs"],
        financialStressScore=_f(r["financial_stress_score"]),
        responsibilityScore=_f(r["responsibility_score"]),
        cooperationScore=_f(r["cooperation_score"]),
        creditAwarenessScore=_f(r["credit_awareness_score"]),
        legalAwarenessScore=_f(r["legal_awareness_score"]),
        financialLiteracyScore=_f(r["financial_literacy_score"]),
        employmentStabilityScore=_f(r["employment_stability_score"]),
        overallRiskScore=_f(r["overall_risk_score"]),
        lastCalculated=r["last_calculated"],
    )
