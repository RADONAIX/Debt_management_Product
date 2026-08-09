"""Agent Workspace service — the collector's day, end to end.

Reuses the existing collections tables and adds no storage of its own:

    customer / account        who is on the desk and what they owe
    debt_case                 the case, its SLA clock and its owner
    case_activity             every contact, note, reminder and status change
    ptp                       promises taken, kept and broken
    dispute                   disputes raised and resolved
    payment                   money received, including against a promise

Two rules hold everything together. Every action an agent takes writes a
``case_activity`` row, so the case timeline is the complete record of what
happened. And a promise is settled from the payment table rather than by hand,
so "kept" always means money actually arrived.
"""

from __future__ import annotations

import datetime as dt

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.agent import schemas
# Case counts are defined once, in the collections casebook, so every screen
# that shows one is reading the same rule.
from app.modules.collection.casebook import (
    CASE_FROM, LIVE_CASE, NOT_MERGED, PAST_SLA,
)

_NAME = "COALESCE(co.name, c.full_name, c.customer_code)"


async def _next_code(db: AsyncSession, prefix: str, sequence: str) -> str:
    """A unique business code taken from the table's own id sequence.

    Deriving it from MAX(code) is fragile — the existing book mixes formats
    (CASE-100119 and CASE-R00125), so a digits-only scan can collide. The
    sequence cannot.
    """
    n = (await db.execute(text(f"SELECT nextval('customer_schema.{sequence}')"))).scalar_one()
    return f"{prefix}-{n:06d}"
_CUST_JOIN = """
JOIN customer_schema.customer c ON c.id = {alias}.customer_id
LEFT JOIN customer_schema.company co ON co.id = c.company_id
"""

# Hours before the next action falls due, by priority. The clock restarts
# every time the case is worked — it measures neglect, not total case age.
SLA_HOURS = {"Critical": 4, "High": 8, "Medium": 24, "Low": 48}

REMINDER_TEMPLATES = [
    schemas.ReminderTemplate(
        key="due_soon", label="Payment due soon", channel="SMS",
        subject="Your payment is due",
        body="Hi {name}, a balance of {amount} is due on your account {account}. "
             "Pay now: {link}"),
    schemas.ReminderTemplate(
        key="overdue", label="Overdue notice", channel="SMS",
        subject="Overdue balance",
        body="Hi {name}, your account {account} is {dpd} days past due with {amount} "
             "outstanding. Please settle to avoid service restrictions."),
    schemas.ReminderTemplate(
        key="ptp_reminder", label="Promise reminder", channel="WhatsApp",
        subject="Reminder of your payment arrangement",
        body="Hi {name}, this is a reminder of your arrangement to pay {amount} "
             "by {date}. Thank you."),
    schemas.ReminderTemplate(
        key="broken_ptp", label="Missed arrangement", channel="Email",
        subject="Missed payment arrangement",
        body="Hi {name}, we did not receive the {amount} you arranged to pay. "
             "Please call us so we can find a workable plan."),
    schemas.ReminderTemplate(
        key="final_notice", label="Final notice", channel="Email",
        subject="Final notice before escalation",
        body="Hi {name}, your account {account} remains {dpd} days past due with "
             "{amount} outstanding. Without payment this will be escalated."),
]


def _f(v) -> float:
    return float(v) if v is not None else 0.0


async def _customer_id(db: AsyncSession, code: str) -> int:
    cid = (await db.execute(text(
        "SELECT id FROM customer_schema.customer WHERE customer_code = :c"), {"c": code}
    )).scalar_one_or_none()
    if cid is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown customer {code}")
    return cid


async def log_activity(
    db: AsyncSession,
    *,
    customer_id: int,
    agent_id: int,
    subject: str,
    activity_type: str = "NOTE",
    account_id: int | None = None,
    case_id: int | None = None,
    dispute_id: int | None = None,
    channel: str | None = None,
    direction: str = "INTERNAL",
    body: str | None = None,
    outcome: str | None = None,
    visibility: str = "INTERNAL",
    automated: bool = False,
) -> int:
    """Every action leaves a trace, and touching a case starts its response clock."""
    aid = (await db.execute(text("""
        INSERT INTO customer_schema.case_activity
          (activity_type, customer_id, account_id, case_id, dispute_id, channel_code,
           direction, subject, body, outcome, visibility, is_automated, agent_id, created_by)
        VALUES (:t,:cu,:ac,:case,:disp,:ch,:dir,:subj,:body,:out,:vis,:auto,:ag,:ag)
        RETURNING id"""),
        dict(t=activity_type, cu=customer_id, ac=account_id, case=case_id, disp=dispute_id,
             ch=channel, dir=direction, subj=subject, body=body, out=outcome,
             vis=visibility, auto=automated, ag=agent_id))).scalar_one()
    if case_id:
        # Working a case resets its clock: the SLA here is "next action due",
        # not time-to-resolve, which is how a collections desk actually runs.
        await db.execute(text("""
            UPDATE customer_schema.debt_case dc
            SET last_activity_at = now(),
                first_response_at = COALESCE(first_response_at, now()),
                sla_deadline = CASE WHEN dc.status = 'CLOSED' THEN dc.sla_deadline
                     ELSE now() + make_interval(hours => CASE dc.priority
                         WHEN 'Critical' THEN 4 WHEN 'High' THEN 8
                         WHEN 'Medium' THEN 24 ELSE 48 END) END,
                sla_breached = FALSE,
                updated_at = now(), updated_by = :ag
            WHERE dc.id = :i"""), {"i": case_id, "ag": agent_id})
    return aid


# --------------------------------------------------------------------------
# Desk
# --------------------------------------------------------------------------
async def list_agents(db: AsyncSession) -> list[schemas.AgentRow]:
    rows = (await db.execute(text("""
        SELECT u.id, u.full_name, u.email, r.code AS role,
               ap.availability_status, ap.max_caseload,
               (SELECT count(*) FROM customer_schema.debt_case dc
                 WHERE dc.assigned_agent_id = u.id AND dc.status <> 'CLOSED')   AS open_cases,
               (SELECT count(*) FROM customer_schema.customer c
                 WHERE c.assigned_agent_id = u.id)                              AS customers,
               (SELECT count(*) FROM customer_schema.ptp p
                 WHERE p.created_by = u.id AND p.status = 'PENDING')            AS ptps,
               (SELECT count(*) FROM customer_schema.dispute d
                 WHERE d.assigned_agent_id = u.id AND d.status <> 'RESOLVED')   AS disputes
        FROM administration.app_user u
        LEFT JOIN administration.role r ON r.id = u.role_id
        LEFT JOIN public.agent_profile ap ON ap.user_id = u.id
        WHERE u.status = 'ACTIVE'
        ORDER BY customers DESC, u.full_name"""))).mappings().all()
    return [schemas.AgentRow(
        id=r["id"], name=r["full_name"], email=r["email"], role=r["role"],
        openCases=r["open_cases"], customers=r["customers"],
        pendingPtps=r["ptps"], openDisputes=r["disputes"],
        availability=r["availability_status"], maxCaseload=r["max_caseload"]) for r in rows]


async def desk_summary(db: AsyncSession, agent_id: int | None) -> schemas.DeskSummary:
    """One desk, or the whole floor when agent_id is None.

    ``:a IS NULL`` widens every scoped subquery to "any agent", so a single
    statement serves both without a second code path that could disagree.
    """
    r = (await db.execute(text(f"""
        SELECT
          (SELECT full_name FROM administration.app_user WHERE id = :a) AS agent_name,
          ap.employee_code, ap.skill_group, ap.expertise, ap.languages, ap.specializations,
          ap.availability_status, ap.max_caseload, ap.monthly_target, ap.performance_rating,
          (SELECT count(*) FROM customer_schema.customer c
            WHERE (:a IS NULL OR c.assigned_agent_id = :a)) AS customers,
          (SELECT COALESCE(SUM(acc.outstanding), 0) FROM customer_schema.account acc
            JOIN customer_schema.customer c ON c.id = acc.customer_id
           WHERE (:a IS NULL OR c.assigned_agent_id = :a)) AS portfolio,
          -- Case counts use the shared casebook predicates so this desk header,
          -- the workspace counters and the Collections Dashboard all agree.
          (SELECT count(*) {CASE_FROM}
            WHERE (:a IS NULL OR dc.assigned_agent_id = :a)
              AND {NOT_MERGED} AND {LIVE_CASE}) AS open_cases,
          (SELECT count(*) {CASE_FROM}
            WHERE (:a IS NULL OR dc.assigned_agent_id = :a)
              AND {NOT_MERGED} AND {PAST_SLA}) AS breached,
          (SELECT count(*) {CASE_FROM}
            WHERE (:a IS NULL OR dc.assigned_agent_id = :a)
              AND {NOT_MERGED} AND {LIVE_CASE}
              AND dc.sla_deadline::date = CURRENT_DATE) AS due_today,
          -- The book actually under collection, as opposed to every account the
          -- desk owns: the number the Collections Dashboard calls open exposure.
          (SELECT count(DISTINCT dc.customer_id) {CASE_FROM}
            WHERE (:a IS NULL OR dc.assigned_agent_id = :a)
              AND {NOT_MERGED} AND {LIVE_CASE}) AS book_customers,
          (SELECT COALESCE(SUM(acc.outstanding), 0) FROM customer_schema.account acc
            WHERE acc.id IN (SELECT dc.account_id {CASE_FROM}
                              WHERE (:a IS NULL OR dc.assigned_agent_id = :a)
                                AND {NOT_MERGED} AND {LIVE_CASE}
                                AND dc.account_id IS NOT NULL)) AS book_exposure,
          (SELECT count(*) FROM customer_schema.ptp p
            WHERE (:a IS NULL OR p.created_by = :a) AND p.status = 'PENDING') AS pending_ptps,
          (SELECT COALESCE(SUM(p.promised_amount - p.kept_amount), 0) FROM customer_schema.ptp p
            WHERE (:a IS NULL OR p.created_by = :a) AND p.status = 'PENDING') AS ptp_value,
          (SELECT count(*) FROM customer_schema.ptp p
            WHERE (:a IS NULL OR p.created_by = :a) AND p.status = 'PENDING'
              AND p.promised_date = CURRENT_DATE) AS ptp_today,
          (SELECT count(*) FROM customer_schema.ptp p
            WHERE (:a IS NULL OR p.created_by = :a) AND p.status IN ('KEPT','BROKEN')) AS decided,
          (SELECT count(*) FROM customer_schema.ptp p
            WHERE (:a IS NULL OR p.created_by = :a) AND p.status = 'KEPT') AS kept,
          (SELECT count(*) FROM customer_schema.dispute d
            WHERE (:a IS NULL OR d.assigned_agent_id = :a) AND d.status <> 'RESOLVED') AS disputes,
          (SELECT count(*) FROM customer_schema.case_activity ca
            WHERE (:a IS NULL OR ca.agent_id = :a) AND ca.occurred_at::date = CURRENT_DATE
              AND ca.direction <> 'INTERNAL') AS contacts_today,
          (SELECT COALESCE(SUM(pay.amount), 0) FROM customer_schema.payment pay
            JOIN customer_schema.customer c ON c.id = pay.customer_id
           WHERE (:a IS NULL OR c.assigned_agent_id = :a)
             AND pay.payment_date >= date_trunc('month', CURRENT_DATE)) AS collected,
          (SELECT COALESCE(SUM(p.promised_amount), 0) FROM customer_schema.ptp p
            WHERE (:a IS NULL OR p.created_by = :a)
              AND p.created_at >= date_trunc('month', CURRENT_DATE)) AS promised
        FROM (SELECT 1) _
        LEFT JOIN public.agent_profile ap ON ap.user_id = :a
        """), {"a": agent_id})).mappings().one()
    decided = r["decided"] or 0
    target = _f(r["monthly_target"])
    collected = _f(r["collected"])
    return schemas.DeskSummary(
        agentId=agent_id or 0,
        agentName=r["agent_name"] or ("All agents" if agent_id is None else "Agent"),
        employeeCode=r["employee_code"], skillGroup=r["skill_group"],
        expertise=r["expertise"], languages=list(r["languages"] or []),
        specializations=list(r["specializations"] or []),
        availability=r["availability_status"], maxCaseload=r["max_caseload"],
        monthlyTarget=round(target, 2) if target else None,
        performanceRating=_f(r["performance_rating"]) if r["performance_rating"] else None,
        targetProgress=round(collected / target * 100, 1) if target else None,
        caseloadPct=round(r["open_cases"] / r["max_caseload"] * 100, 1)
                    if r["max_caseload"] else None,
        customers=r["customers"], portfolioValue=round(_f(r["portfolio"]), 2),
        bookCustomers=r["book_customers"],
        bookExposure=round(_f(r["book_exposure"]), 2),
        openCases=r["open_cases"], slaBreached=r["breached"], dueToday=r["due_today"],
        pendingPtps=r["pending_ptps"], ptpValue=round(_f(r["ptp_value"]), 2),
        ptpsDueToday=r["ptp_today"],
        keptRate=round(r["kept"] / decided * 100, 1) if decided else 0.0,
        openDisputes=r["disputes"], contactsToday=r["contacts_today"],
        collectedMtd=round(_f(r["collected"]), 2), promisedMtd=round(_f(r["promised"]), 2),
    )


# --------------------------------------------------------------------------
# Worklist
# --------------------------------------------------------------------------
_WORKLIST_SQL = f"""
SELECT c.customer_code, {_NAME} AS customer_name, c.customer_type, c.risk_level,
       c.risk_score, c.contactability, c.best_channel_code, c.best_contact_time,
       c.phone, c.email,
       acc.id AS account_id, acc.account_code, acc.outstanding, acc.dpd, acc.aging_bucket,
       s.name AS strategy,
       (SELECT count(*) FROM customer_schema.debt_case dc
         WHERE dc.customer_id = c.id AND dc.status <> 'CLOSED') AS open_cases,
       (SELECT dc.case_code FROM customer_schema.debt_case dc
         WHERE dc.customer_id = c.id AND dc.status <> 'CLOSED'
         ORDER BY dc.priority, dc.opened_at LIMIT 1) AS open_case_code,
       -- The id too, so the queue can open the case without a second lookup.
       (SELECT dc.id FROM customer_schema.debt_case dc
         WHERE dc.customer_id = c.id AND dc.status <> 'CLOSED'
         ORDER BY dc.priority, dc.opened_at LIMIT 1) AS open_case_id,
       (SELECT p.promised_date FROM customer_schema.ptp p
         WHERE p.customer_id = c.id AND p.status = 'PENDING'
         ORDER BY p.promised_date LIMIT 1) AS ptp_due,
       (SELECT MAX(ca.occurred_at) FROM customer_schema.case_activity ca
         WHERE ca.customer_id = c.id AND ca.direction <> 'INTERNAL') AS last_contact,
       (SELECT MAX(pay.payment_date) FROM customer_schema.payment pay
         WHERE pay.customer_id = c.id) AS last_payment,
       ag.full_name AS agent_name
FROM customer_schema.customer c
LEFT JOIN customer_schema.company co ON co.id = c.company_id
LEFT JOIN LATERAL (
  SELECT a.id, a.account_code, a.outstanding, a.dpd, a.aging_bucket, a.strategy_id
  FROM customer_schema.account a
  WHERE a.customer_id = c.id
  ORDER BY a.outstanding DESC, a.dpd DESC LIMIT 1) acc ON TRUE
LEFT JOIN public.strategy s ON s.id = acc.strategy_id
LEFT JOIN administration.app_user ag ON ag.id = c.assigned_agent_id
-- NULL widens this to the whole floor, for a supervisor or admin.
WHERE (CAST(:agent AS bigint) IS NULL OR c.assigned_agent_id = :agent)
"""


def _next_action(r) -> tuple[str, str, int]:
    """What to do next, how urgent, and the score that orders the queue.

    Ranked the way a collector would: a promise landing today outranks an
    ageing balance, a broken promise outranks a first call, and someone
    already contacted today drops down the list.
    """
    dpd = r["dpd"] or 0
    out = _f(r["outstanding"])
    score = 0
    action = "Review account"

    ptp_due = r["ptp_due"]
    today = dt.date.today()
    last_contact = r["last_contact"]

    if ptp_due:
        days = (ptp_due - today).days
        if days < 0:
            action, score = "Promise overdue — chase payment", 100
        elif days == 0:
            action, score = "Promise due today — confirm payment", 95
        elif days <= 2:
            action, score = f"Promise due in {days}d — send reminder", 70
        else:
            action, score = f"Promise in place for {ptp_due:%d %b}", 25
    elif dpd >= 90:
        action, score = "Severely overdue — call and negotiate", 90
    elif dpd >= 60:
        action, score = "Call to arrange payment", 80
    elif dpd >= 30:
        action, score = "Follow up on overdue balance", 60
    elif dpd > 0:
        action, score = "Send payment reminder", 40
    elif out > 0:
        action, score = "Monitor — current", 10
    else:
        action, score = "No action needed", 0

    if r["open_cases"]:
        score += 10
    # Weight by exposure so a big balance surfaces above a small one.
    score += min(15, int(out / 500))
    # Already spoken to today: let it rest.
    if last_contact and last_contact.date() == today:
        score -= 30
        action = "Contacted today — awaiting response"

    priority = ("Critical" if score >= 90 else "High" if score >= 65
                else "Medium" if score >= 35 else "Low")
    return action, priority, max(0, score)


def _work_item(r) -> schemas.WorkItem:
    action, priority, score = _next_action(r)
    return schemas.WorkItem(
        customerId=r["customer_code"], customerName=r["customer_name"],
        customerType=r["customer_type"], accountId=r["account_id"],
        accountCode=r["account_code"], outstanding=round(_f(r["outstanding"]), 2),
        dpd=r["dpd"] or 0, agingBucket=r["aging_bucket"], riskLevel=r["risk_level"],
        riskScore=_f(r["risk_score"]), contactability=_f(r["contactability"]),
        bestChannel=r["best_channel_code"], bestContactTime=r["best_contact_time"],
        phone=r["phone"], email=r["email"], strategy=r["strategy"],
        openCases=r["open_cases"], openCaseCode=r["open_case_code"],
        openCaseId=r["open_case_id"],
        pendingPtp=r["ptp_due"] is not None, ptpDueOn=r["ptp_due"],
        lastContact=r["last_contact"], lastPayment=r["last_payment"],
        nextAction=action, priority=priority, priorityScore=score,
        agentName=r["agent_name"],
    )


async def worklist(
    db: AsyncSession, agent_id: int | None, *, search: str | None = None,
    priority: str | None = None, bucket: str | None = None, risk: str | None = None,
) -> list[schemas.WorkItem]:
    sql, params = _WORKLIST_SQL, {"agent": agent_id}
    if search:
        sql += f" AND ({_NAME} ILIKE :q OR c.customer_code ILIKE :q OR c.phone ILIKE :q)"
        params["q"] = f"%{search}%"
    if bucket:
        sql += " AND acc.aging_bucket = :bucket"
        params["bucket"] = bucket
    if risk:
        sql += " AND c.risk_level = :risk"
        params["risk"] = risk
    rows = (await db.execute(text(sql), params)).mappings().all()
    items = [_work_item(r) for r in rows]
    if priority:
        items = [i for i in items if i.priority == priority]
    items.sort(key=lambda i: (-i.priorityScore, -i.outstanding))
    return items


async def customer_item(db: AsyncSession, agent_id: int | None, code: str) -> schemas.WorkItem:
    r = (await db.execute(text(_WORKLIST_SQL.replace(
        "WHERE (CAST(:agent AS bigint) IS NULL OR c.assigned_agent_id = :agent)",
        "WHERE c.customer_code = :code")),
                          {"code": code, "agent": agent_id})).mappings().first()
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown customer {code}")
    return _work_item(r)


# --------------------------------------------------------------------------
# Cases
# --------------------------------------------------------------------------
_CASE_SQL = f"""
SELECT dc.id, dc.case_code, dc.case_type_code, dc.summary, dc.status, dc.priority,
       dc.risk_level, dc.amount, dc.dpd, dc.dunning_stage, dc.assigned_agent_id,
       dc.opened_at, dc.sla_deadline, dc.sla_breached, dc.first_response_at,
       dc.last_activity_at, dc.closed_at, dc.resolution_code,
       c.customer_code, {_NAME} AS customer_name,
       acc.account_code, s.name AS strategy, u.full_name AS agent_name,
       (SELECT count(*) FROM customer_schema.case_activity ca WHERE ca.case_id = dc.id) AS activity_n
FROM customer_schema.debt_case dc
{_CUST_JOIN.format(alias="dc")}
LEFT JOIN customer_schema.account acc ON acc.id = dc.account_id
LEFT JOIN public.strategy s ON s.id = dc.strategy_id
LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
"""


def _case_row(r) -> schemas.CaseRow:
    hours = None
    if r["sla_deadline"] and not r["closed_at"]:
        hours = round((r["sla_deadline"] - dt.datetime.now(dt.timezone.utc)).total_seconds() / 3600, 1)
    return schemas.CaseRow(
        id=r["id"], code=r["case_code"], customerId=r["customer_code"],
        customerName=r["customer_name"], accountCode=r["account_code"],
        type=r["case_type_code"], summary=r["summary"], status=r["status"],
        priority=r["priority"], riskLevel=r["risk_level"], amount=round(_f(r["amount"]), 2),
        dpd=r["dpd"], strategy=r["strategy"], dunningStage=r["dunning_stage"],
        agentId=r["assigned_agent_id"], agentName=r["agent_name"], openedAt=r["opened_at"],
        slaDeadline=r["sla_deadline"],
        slaBreached=bool(r["sla_breached"]) or (hours is not None and hours < 0),
        firstResponseAt=r["first_response_at"], lastActivityAt=r["last_activity_at"],
        closedAt=r["closed_at"], resolution=r["resolution_code"],
        activityCount=r["activity_n"], hoursToSla=hours,
    )


async def list_cases(
    db: AsyncSession, agent_id: int | None, *, status_f: str | None = None,
    priority: str | None = None, search: str | None = None, breached: bool = False,
) -> list[schemas.CaseRow]:
    sql, params = _CASE_SQL + " WHERE 1=1", {}
    if agent_id:
        sql += " AND dc.assigned_agent_id = :agent"
        params["agent"] = agent_id
    if status_f == "OPEN":
        sql += " AND dc.status <> 'CLOSED'"
    elif status_f:
        sql += " AND dc.status = :st"
        params["st"] = status_f
    if priority:
        sql += " AND dc.priority = :pri"
        params["pri"] = priority
    if breached:
        sql += " AND dc.status <> 'CLOSED' AND dc.sla_deadline < now()"
    if search:
        sql += f" AND ({_NAME} ILIKE :q OR dc.case_code ILIKE :q OR dc.summary ILIKE :q)"
        params["q"] = f"%{search}%"
    sql += """ ORDER BY dc.status = 'CLOSED',
               CASE dc.priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1
                                WHEN 'Medium' THEN 2 ELSE 3 END,
               dc.sla_deadline NULLS LAST"""
    return [_case_row(r) for r in (await db.execute(text(sql), params)).mappings().all()]


async def case_detail(db: AsyncSession, case_id: int, agent_id: int) -> schemas.CaseDetail:
    r = (await db.execute(text(_CASE_SQL + " WHERE dc.id = :i"), {"i": case_id})).mappings().first()
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    row = _case_row(r)
    acts = (await db.execute(text("""
        SELECT ca.id, ca.activity_type, ca.channel_code, ca.direction, ca.subject, ca.body,
               ca.outcome, ca.visibility, ca.is_automated, ca.occurred_at, u.full_name AS agent
        FROM customer_schema.case_activity ca
        LEFT JOIN administration.app_user u ON u.id = ca.agent_id
        WHERE ca.case_id = :i ORDER BY ca.occurred_at DESC, ca.id DESC"""),
        {"i": case_id})).mappings().all()
    cid = await _customer_id(db, row.customerId)
    return schemas.CaseDetail(
        case=row,
        customer=await customer_item(db, agent_id, row.customerId),
        activities=[schemas.ActivityRow(
            id=a["id"], type=a["activity_type"], channel=a["channel_code"],
            direction=a["direction"], subject=a["subject"], body=a["body"],
            outcome=a["outcome"], visibility=a["visibility"], isAutomated=a["is_automated"],
            agent=a["agent"], occurredAt=a["occurred_at"]) for a in acts],
        ptps=await list_ptps(db, None, customer_id=cid),
        disputes=await list_disputes(db, None, customer_id=cid),
        payments=await customer_payments(db, cid),
    )


async def create_case(db: AsyncSession, p: schemas.CaseCreate, agent_id: int) -> int:
    cid = await _customer_id(db, p.customerId)
    acc = (await db.execute(text("""
        SELECT id, outstanding, dpd, risk_level, strategy_id FROM customer_schema.account
        WHERE id = COALESCE(:a, (SELECT id FROM customer_schema.account
                                 WHERE customer_id = :c ORDER BY outstanding DESC LIMIT 1))"""),
        {"a": p.accountId, "c": cid})).mappings().first()
    code = await _next_code(db, "CASE", "debt_case_id_seq")
    hours = SLA_HOURS.get(p.priority, 24)
    case_id = (await db.execute(text("""
        INSERT INTO customer_schema.debt_case
          (case_code, customer_id, account_id, case_type_code, summary, status, priority,
           risk_level, amount, dpd, strategy_id, assigned_agent_id, opened_at, sla_deadline,
           created_by, updated_by)
        VALUES (:code,:cu,:ac,:type,:sum,'OPEN',:pri,:risk,:amt,:dpd,:strat,:ag,now(),
                now() + make_interval(hours => :h), :ag, :ag)
        RETURNING id"""),
        dict(code=code, cu=cid, ac=acc["id"] if acc else None, type=p.type, sum=p.summary,
             pri=p.priority, risk=acc["risk_level"] if acc else "Low",
             amt=p.amount if p.amount is not None else (_f(acc["outstanding"]) if acc else 0),
             dpd=acc["dpd"] if acc else 0, strat=acc["strategy_id"] if acc else None,
             ag=agent_id, h=hours))).scalar_one()
    await log_activity(db, customer_id=cid, agent_id=agent_id, case_id=case_id,
                       account_id=acc["id"] if acc else None, activity_type="STATUS_CHANGE",
                       subject=f"Case {code} opened",
                       body=p.summary, outcome=f"{p.priority} priority, {hours}h SLA")
    await db.commit()
    return case_id


async def patch_case(db: AsyncSession, case_id: int, p: schemas.CasePatch, agent_id: int) -> None:
    cur = (await db.execute(text("""
        SELECT customer_id, account_id, status, priority, assigned_agent_id, opened_at, sla_deadline
        FROM customer_schema.debt_case WHERE id = :i"""), {"i": case_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    sets, params, notes = [], {"i": case_id, "ag": agent_id}, []
    if p.priority and p.priority != cur["priority"]:
        sets.append("priority = :pri")
        params["pri"] = p.priority
        # Re-cut the SLA from the original open time on the new priority.
        sets.append("sla_deadline = COALESCE(last_activity_at, opened_at) "
                    "+ make_interval(hours => :h)")
        params["h"] = SLA_HOURS.get(p.priority, 24)
        notes.append(f"Priority {cur['priority']} → {p.priority}")
    if p.summary is not None:
        sets.append("summary = :sum")
        params["sum"] = p.summary
    if p.agentId and p.agentId != cur["assigned_agent_id"]:
        sets.append("assigned_agent_id = :new_ag")
        params["new_ag"] = p.agentId
        who = (await db.execute(text("SELECT full_name FROM administration.app_user WHERE id=:i"),
                                {"i": p.agentId})).scalar_one_or_none()
        notes.append(f"Reassigned to {who or p.agentId}")
    if p.status and p.status != cur["status"]:
        sets.append("status = :st")
        params["st"] = p.status
        if p.status == "CLOSED":
            sets.append("closed_at = now()")
            sets.append("resolution_code = :res")
            params["res"] = p.resolution or "Resolved"
            sets.append("resolution_hours = EXTRACT(EPOCH FROM (now() - opened_at)) / 3600")
            # Breach is judged on when it actually closed.
            sets.append("sla_breached = (sla_deadline IS NOT NULL AND now() > sla_deadline)")
        else:
            sets.append("closed_at = NULL")
            sets.append("resolution_code = NULL")
        notes.append(f"Status {cur['status']} → {p.status}")
    if not sets:
        return
    await db.execute(text(
        f"UPDATE customer_schema.debt_case SET {', '.join(sets)}, updated_at = now(), "
        "updated_by = :ag WHERE id = :i"), params)
    await log_activity(db, customer_id=cur["customer_id"], agent_id=agent_id, case_id=case_id,
                       account_id=cur["account_id"], activity_type="STATUS_CHANGE",
                       subject="; ".join(notes) or "Case updated", outcome=p.resolution)
    await db.commit()


async def add_activity(
    db: AsyncSession, case_id: int, p: schemas.ActivityCreate, agent_id: int
) -> None:
    cur = (await db.execute(text(
        "SELECT customer_id, account_id FROM customer_schema.debt_case WHERE id = :i"),
        {"i": case_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    await log_activity(
        db, customer_id=cur["customer_id"], agent_id=agent_id, case_id=case_id,
        account_id=cur["account_id"], activity_type=p.type, channel=p.channel,
        direction=p.direction, subject=p.subject, body=p.body, outcome=p.outcome,
        visibility=p.visibility)
    await db.commit()


# --------------------------------------------------------------------------
# Promises to pay
# --------------------------------------------------------------------------
_PTP_SQL = f"""
SELECT p.id, p.ptp_code, p.promised_amount, p.promised_date, p.instalment_count,
       p.kept_amount, p.status, p.channel_code, p.ai_probability, p.fulfilled_at,
       p.notes, p.created_at,
       c.customer_code, {_NAME} AS customer_name,
       acc.account_code, COALESCE(acc.outstanding, 0) AS outstanding,
       dc.case_code, u.full_name AS agent_name
FROM customer_schema.ptp p
{_CUST_JOIN.format(alias="p")}
LEFT JOIN customer_schema.account acc ON acc.id = p.account_id
LEFT JOIN customer_schema.debt_case dc ON dc.id = p.case_id
LEFT JOIN administration.app_user u ON u.id = p.created_by
"""


def _ptp_row(r) -> schemas.PtpRow:
    days = (r["promised_date"] - dt.date.today()).days if r["promised_date"] else None
    return schemas.PtpRow(
        id=r["id"], code=r["ptp_code"], customerId=r["customer_code"],
        customerName=r["customer_name"], accountCode=r["account_code"],
        caseCode=r["case_code"], promisedAmount=round(_f(r["promised_amount"]), 2),
        promisedDate=r["promised_date"], instalments=r["instalment_count"],
        keptAmount=round(_f(r["kept_amount"]), 2),
        outstandingOnPromise=round(_f(r["outstanding"]), 2), status=r["status"],
        channel=r["channel_code"],
        aiProbability=_f(r["ai_probability"]) if r["ai_probability"] is not None else None,
        fulfilledAt=r["fulfilled_at"], notes=r["notes"], agentName=r["agent_name"],
        createdAt=r["created_at"], daysToDue=days,
        overdue=bool(r["status"] == "PENDING" and days is not None and days < 0),
    )


async def list_ptps(
    db: AsyncSession, agent_id: int | None, *, status_f: str | None = None,
    customer_id: int | None = None, search: str | None = None,
) -> list[schemas.PtpRow]:
    sql, params = _PTP_SQL + " WHERE 1=1", {}
    if agent_id:
        sql += " AND p.created_by = :agent"
        params["agent"] = agent_id
    if customer_id:
        sql += " AND p.customer_id = :cu"
        params["cu"] = customer_id
    if status_f:
        sql += " AND p.status = :st"
        params["st"] = status_f
    if search:
        sql += f" AND ({_NAME} ILIKE :q OR p.ptp_code ILIKE :q)"
        params["q"] = f"%{search}%"
    sql += " ORDER BY p.status <> 'PENDING', p.promised_date"
    return [_ptp_row(r) for r in (await db.execute(text(sql), params)).mappings().all()]


async def create_ptp(db: AsyncSession, p: schemas.PtpCreate, agent_id: int) -> int:
    cid = await _customer_id(db, p.customerId)
    acc_id = p.accountId
    if acc_id is None:
        acc_id = (await db.execute(text("""
            SELECT id FROM customer_schema.account WHERE customer_id = :c
            ORDER BY outstanding DESC LIMIT 1"""), {"c": cid})).scalar_one_or_none()
    if p.promisedDate < dt.date.today():
        raise HTTPException(status.HTTP_409_CONFLICT, "A promise cannot be dated in the past.")
    open_ptp = (await db.execute(text("""
        SELECT ptp_code FROM customer_schema.ptp
        WHERE customer_id = :c AND status = 'PENDING'"""), {"c": cid})).scalar_one_or_none()
    if open_ptp:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This customer already has an open promise ({open_ptp}). Settle or cancel it first.")
    balance = _f((await db.execute(text(
        "SELECT COALESCE(SUM(outstanding), 0) FROM customer_schema.account WHERE customer_id = :c"),
        {"c": cid})).scalar_one())
    if p.promisedAmount > balance + 0.01:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"The promise exceeds the {balance:,.2f} owed.")

    # A likelihood the agent can see before committing: how this customer has
    # behaved on past promises, tempered by how reachable they are.
    hist = (await db.execute(text("""
        SELECT count(*) FILTER (WHERE status = 'KEPT') AS kept,
               count(*) FILTER (WHERE status IN ('KEPT','BROKEN')) AS decided
        FROM customer_schema.ptp WHERE customer_id = :c"""), {"c": cid})).mappings().one()
    reach = _f((await db.execute(text(
        "SELECT contactability FROM customer_schema.customer WHERE id = :c"), {"c": cid})).scalar_one())
    base = (hist["kept"] / hist["decided"] * 100) if hist["decided"] else 55.0
    probability = round(max(5.0, min(95.0, base * 0.7 + reach * 0.3)), 2)

    code = await _next_code(db, "PTP", "ptp_id_seq")
    ptp_id = (await db.execute(text("""
        INSERT INTO customer_schema.ptp
          (ptp_code, customer_id, account_id, case_id, promised_amount, promised_date,
           instalment_count, status, channel_code, ai_probability, notes, created_by, updated_by)
        VALUES (:code,:cu,:ac,:case,:amt,:date,:inst,'PENDING',:ch,:prob,:note,:ag,:ag)
        RETURNING id"""),
        dict(code=code, cu=cid, ac=acc_id, case=p.caseId, amt=p.promisedAmount,
             date=p.promisedDate, inst=p.instalments, ch=p.channel, prob=probability,
             note=p.notes, ag=agent_id))).scalar_one()
    await log_activity(
        db, customer_id=cid, agent_id=agent_id, case_id=p.caseId, account_id=acc_id,
        activity_type="PTP", channel=p.channel, direction="OUTBOUND",
        subject=f"Promise to pay {p.promisedAmount:,.2f} by {p.promisedDate:%d %b %Y}",
        body=p.notes, outcome=f"{code} · {probability}% likely to be kept",
        visibility="CUSTOMER_FACING")
    await db.commit()
    return ptp_id


async def patch_ptp(db: AsyncSession, ptp_id: int, p: schemas.PtpPatch, agent_id: int) -> None:
    cur = (await db.execute(text("""
        SELECT ptp_code, customer_id, account_id, case_id, status, promised_amount
        FROM customer_schema.ptp WHERE id = :i"""), {"i": ptp_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Promise not found")
    sets, params, notes = [], {"i": ptp_id, "ag": agent_id}, []
    if p.promisedDate:
        sets.append("promised_date = :d")
        params["d"] = p.promisedDate
        notes.append(f"Re-dated to {p.promisedDate:%d %b %Y}")
    if p.promisedAmount:
        sets.append("promised_amount = :amt")
        params["amt"] = p.promisedAmount
        notes.append(f"Amount changed to {p.promisedAmount:,.2f}")
    if p.keptAmount is not None:
        sets.append("kept_amount = :kept")
        params["kept"] = p.keptAmount
    if p.notes is not None:
        sets.append("notes = :note")
        params["note"] = p.notes
    if p.status and p.status != cur["status"]:
        if p.status not in ("PENDING", "KEPT", "BROKEN", "CANCELLED"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown status {p.status}")
        sets.append("status = :st")
        params["st"] = p.status
        sets.append("fulfilled_at = " + ("now()" if p.status == "KEPT" else "NULL"))
        notes.append(f"Promise marked {p.status.lower()}")
    if not sets:
        return
    await db.execute(text(
        f"UPDATE customer_schema.ptp SET {', '.join(sets)}, updated_at = now(), "
        "updated_by = :ag WHERE id = :i"), params)
    await log_activity(
        db, customer_id=cur["customer_id"], agent_id=agent_id, case_id=cur["case_id"],
        account_id=cur["account_id"], activity_type="PTP",
        subject=f"{cur['ptp_code']}: " + ("; ".join(notes) or "updated"), body=p.notes)
    await db.commit()


async def settle_promises(db: AsyncSession, agent_id: int | None = None) -> dict:
    """Decide pending promises from the payment record, not by hand.

    Kept once enough has arrived by the promised date; broken once that date
    has passed without it. Run on opening the workspace so the queue reflects
    what the billing system already knows.
    """
    scope = "AND p.created_by = :a" if agent_id else ""
    params = {"a": agent_id} if agent_id else {}
    actor = agent_id or 0
    rows = (await db.execute(text(f"""
        UPDATE customer_schema.ptp p
        SET kept_amount = t.paid,
            status = CASE WHEN t.paid >= p.promised_amount - 0.01 THEN 'KEPT'
                          WHEN p.promised_date < CURRENT_DATE THEN 'BROKEN'
                          ELSE 'PENDING' END,
            fulfilled_at = CASE WHEN t.paid >= p.promised_amount - 0.01
                                THEN t.last_paid::timestamptz ELSE NULL END,
            updated_at = now()
        FROM (
          SELECT p2.id, COALESCE(SUM(pay.amount), 0) AS paid, MAX(pay.payment_date) AS last_paid
          FROM customer_schema.ptp p2
          LEFT JOIN customer_schema.payment pay
                 ON pay.customer_id = p2.customer_id
                AND pay.payment_date BETWEEN p2.created_at::date AND p2.promised_date
          WHERE p2.status = 'PENDING'
          GROUP BY p2.id) t
        WHERE p.id = t.id AND p.status = 'PENDING' {scope}
        RETURNING p.id, p.status, p.customer_id, p.case_id, p.account_id, p.ptp_code"""),
        params)).mappings().all()
    settled = [r for r in rows if r["status"] in ("KEPT", "BROKEN")]
    for r in settled:
        await log_activity(
            db, customer_id=r["customer_id"], agent_id=actor, case_id=r["case_id"],
            account_id=r["account_id"], activity_type="PTP",
            subject=f"{r['ptp_code']} automatically marked {r['status'].lower()}",
            outcome="Settled from the payment record", automated=True)
    await db.commit()
    return {"kept": sum(1 for r in settled if r["status"] == "KEPT"),
            "broken": sum(1 for r in settled if r["status"] == "BROKEN")}


# --------------------------------------------------------------------------
# Reminders, disputes, payments
# --------------------------------------------------------------------------
async def send_reminder(db: AsyncSession, p: schemas.ReminderRequest, agent_id: int) -> str:
    cid = await _customer_id(db, p.customerId)
    ctx = (await db.execute(text(f"""
        SELECT {_NAME} AS name, c.phone, c.email,
               acc.account_code, COALESCE(acc.outstanding, 0) AS outstanding,
               COALESCE(acc.dpd, 0) AS dpd, acc.id AS account_id,
               (SELECT p2.promised_amount FROM customer_schema.ptp p2
                 WHERE p2.customer_id = c.id AND p2.status = 'PENDING'
                 ORDER BY p2.promised_date LIMIT 1) AS promised,
               (SELECT p2.promised_date FROM customer_schema.ptp p2
                 WHERE p2.customer_id = c.id AND p2.status = 'PENDING'
                 ORDER BY p2.promised_date LIMIT 1) AS promised_date
        FROM customer_schema.customer c
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        LEFT JOIN LATERAL (SELECT a.id, a.account_code, a.outstanding, a.dpd
                           FROM customer_schema.account a
                           WHERE a.customer_id = c.id
                             AND (CAST(:acc AS bigint) IS NULL OR a.id = CAST(:acc AS bigint))
                           ORDER BY a.outstanding DESC LIMIT 1) acc ON TRUE
        WHERE c.id = :cu"""), {"cu": cid, "acc": p.accountId})).mappings().one()

    tpl = next((t for t in REMINDER_TEMPLATES if t.key == p.template), None)
    if p.message:
        message = p.message
        subject = tpl.subject if tpl else "Payment reminder"
    elif tpl:
        subject = tpl.subject
        amount = _f(ctx["promised"]) if "date" in tpl.body else _f(ctx["outstanding"])
        message = tpl.body.format(
            name=ctx["name"], amount=f"${amount:,.2f}",
            account=ctx["account_code"] or "your account", dpd=ctx["dpd"],
            date=f"{ctx['promised_date']:%d %b %Y}" if ctx["promised_date"] else "the agreed date",
            link="pay.radonaix.io/x")
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown reminder template")

    # Reachability check — a reminder with nowhere to go is not "sent".
    if p.channel in ("SMS", "WhatsApp", "IVR", "Dialer") and not ctx["phone"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "No phone number on record for this customer.")
    if p.channel == "Email" and not ctx["email"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "No email address on record for this customer.")

    await log_activity(
        db, customer_id=cid, agent_id=agent_id, case_id=p.caseId,
        account_id=p.accountId or ctx["account_id"],
        activity_type=p.channel.upper() if p.channel.upper() in
        ("SMS", "EMAIL", "WHATSAPP", "CALL", "IVR", "CHAT") else "SMS",
        channel=p.channel, direction="OUTBOUND", subject=subject, body=message,
        outcome="Reminder sent", visibility="CUSTOMER_FACING")
    await db.commit()
    return message


async def list_disputes(
    db: AsyncSession, agent_id: int | None, *, customer_id: int | None = None,
    status_f: str | None = None,
) -> list[schemas.DisputeRow]:
    sql, params = f"""
        SELECT d.id, d.dispute_code, d.reason_code, d.description, d.amount, d.status,
               d.priority, d.filed_at, d.sla_deadline, d.resolved_at, d.resolution_note,
               c.customer_code, {_NAME} AS customer_name, dc.case_code,
               u.full_name AS agent_name
        FROM customer_schema.dispute d
        {_CUST_JOIN.format(alias="d")}
        LEFT JOIN customer_schema.debt_case dc ON dc.id = d.case_id
        LEFT JOIN administration.app_user u ON u.id = d.assigned_agent_id
        WHERE 1=1""", {}
    if agent_id:
        sql += " AND d.assigned_agent_id = :a"
        params["a"] = agent_id
    if customer_id:
        sql += " AND d.customer_id = :cu"
        params["cu"] = customer_id
    if status_f:
        sql += " AND d.status = :st"
        params["st"] = status_f
    sql += " ORDER BY d.resolved_at IS NOT NULL, d.sla_deadline NULLS LAST"
    rows = (await db.execute(text(sql), params)).mappings().all()
    return [schemas.DisputeRow(
        id=r["id"], code=r["dispute_code"], customerId=r["customer_code"],
        customerName=r["customer_name"], reason=r["reason_code"], description=r["description"],
        amount=round(_f(r["amount"]), 2), status=r["status"], priority=r["priority"],
        filedAt=r["filed_at"], slaDeadline=r["sla_deadline"], resolvedAt=r["resolved_at"],
        resolutionNote=r["resolution_note"], caseCode=r["case_code"],
        agentName=r["agent_name"]) for r in rows]


async def create_dispute(db: AsyncSession, p: schemas.DisputeCreate, agent_id: int) -> int:
    cid = await _customer_id(db, p.customerId)
    code = await _next_code(db, "DSP", "dispute_id_seq")
    did = (await db.execute(text("""
        INSERT INTO customer_schema.dispute
          (dispute_code, customer_id, account_id, case_id, reason_code, description, amount,
           status, priority, assigned_agent_id, filed_at, sla_deadline, created_by, updated_by)
        VALUES (:code,:cu,:ac,:case,:reason,:desc,:amt,'OPEN',:pri,:ag,now(),
                now() + INTERVAL '48 hours', :ag, :ag)
        RETURNING id"""),
        dict(code=code, cu=cid, ac=p.accountId, case=p.caseId, reason=p.reason,
             desc=p.description, amt=p.amount, pri=p.priority, ag=agent_id))).scalar_one()
    await log_activity(db, customer_id=cid, agent_id=agent_id, case_id=p.caseId,
                       account_id=p.accountId, dispute_id=did, activity_type="DISPUTE",
                       direction="INBOUND", subject=f"Dispute {code} raised — {p.reason}",
                       body=p.description, outcome=f"${p.amount:,.2f} disputed")
    await db.commit()
    return did


async def patch_dispute(db: AsyncSession, did: int, p: schemas.DisputePatch, agent_id: int) -> None:
    cur = (await db.execute(text("""
        SELECT dispute_code, customer_id, account_id, case_id, status
        FROM customer_schema.dispute WHERE id = :i"""), {"i": did})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dispute not found")
    sets, params = [], {"i": did, "ag": agent_id}
    if p.priority:
        sets.append("priority = :pri")
        params["pri"] = p.priority
    if p.resolutionNote is not None:
        sets.append("resolution_note = :note")
        params["note"] = p.resolutionNote
    if p.status and p.status != cur["status"]:
        sets.append("status = :st")
        params["st"] = p.status
        sets.append("resolved_at = " + ("now()" if p.status == "RESOLVED" else "NULL"))
    if not sets:
        return
    await db.execute(text(
        f"UPDATE customer_schema.dispute SET {', '.join(sets)}, updated_at = now(), "
        "updated_by = :ag WHERE id = :i"), params)
    await log_activity(db, customer_id=cur["customer_id"], agent_id=agent_id,
                       case_id=cur["case_id"], account_id=cur["account_id"], dispute_id=did,
                       activity_type="DISPUTE",
                       subject=f"{cur['dispute_code']} marked {(p.status or 'updated').lower()}",
                       body=p.resolutionNote)
    await db.commit()


async def customer_payments(db: AsyncSession, customer_id: int) -> list[schemas.PaymentRow]:
    rows = (await db.execute(text("""
        SELECT p.payment_ref, p.payment_date, p.amount, p.method_code, p.status,
               p.notes, i.invoice_no
        FROM customer_schema.payment p
        LEFT JOIN customer_schema.invoice i ON i.id = p.invoice_id
        WHERE p.customer_id = :c ORDER BY p.payment_date DESC LIMIT 40"""),
        {"c": customer_id})).mappings().all()
    return [schemas.PaymentRow(
        reference=r["payment_ref"], date=r["payment_date"], amount=round(_f(r["amount"]), 2),
        method=r["method_code"], status=r["status"], invoiceNo=r["invoice_no"],
        notes=r["notes"]) for r in rows]


async def log_payment(db: AsyncSession, p: schemas.LogPaymentRequest, agent_id: int) -> None:
    """Record money the agent secured, against the account and any open promise."""
    cid = await _customer_id(db, p.customerId)
    ref = p.reference or await _next_code(db, "PAY-A", "payment_id_seq")
    await db.execute(text("""
        INSERT INTO customer_schema.payment
          (payment_ref, customer_id, account_id, ptp_id, amount, payment_date, method_code,
           status, notes, created_by)
        VALUES (:ref,:cu,:ac,:ptp,:amt,COALESCE(:on, CURRENT_DATE),:m,'COMPLETED',:note,:ag)"""),
        dict(ref=ref, cu=cid, ac=p.accountId, ptp=p.ptpId, amt=p.amount, on=p.paidOn,
             m=p.method, note=p.note or "Payment taken by agent", ag=agent_id))
    # The balance and the last-payment marker both move, so 360 stays in step.
    await db.execute(text("""
        UPDATE customer_schema.account
        SET outstanding = GREATEST(0, outstanding - :amt),
            last_payment_at = GREATEST(COALESCE(last_payment_at, '-infinity'::timestamptz),
                                       COALESCE(:on, CURRENT_DATE)::timestamptz),
            updated_at = now()
        WHERE id = :i"""), {"amt": p.amount, "i": p.accountId, "on": p.paidOn})
    case_id = (await db.execute(text("""
        SELECT id FROM customer_schema.debt_case
        WHERE customer_id = :c AND status <> 'CLOSED' ORDER BY opened_at DESC LIMIT 1"""),
        {"c": cid})).scalar_one_or_none()
    await log_activity(db, customer_id=cid, agent_id=agent_id, case_id=case_id,
                       account_id=p.accountId, activity_type="PAYMENT", direction="INBOUND",
                       subject=f"Payment of ${p.amount:,.2f} received", body=p.note,
                       outcome=f"{p.method} · {ref}")
    await db.commit()
    # A promise is only kept when the money is in, so re-evaluate straight away.
    await settle_promises(db, agent_id)


def reminder_templates() -> list[schemas.ReminderTemplate]:
    return REMINDER_TEMPLATES
