"""Collection Workspace & Case Management service.

The case itself is customer_schema.debt_case. This module adds the operational
layer around it — provenance, routing, workflow, notes, attachments, audit —
and assembles the 360° operational view by joining what already exists:

    customer / account / billing_account / company   who and what
    invoice / payment                                the money
    ptp / dispute                                    the promises and objections
    recovery_schema.placement / legal_case           agency and legal
    public.strategy                                  what is driving the account
    customer_schema.case_activity                    every contact ever made

Three rules hold throughout. Nothing about a customer is stored in the
collection schema. Every state change writes both an activity (what was done)
and an audit row (what changed). And a case is never silently duplicated —
the case type's duplicate policy decides what happens instead.
"""

from __future__ import annotations

import datetime as dt

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.collection import casebook, schemas

NAME = "COALESCE(co.name, c.full_name, c.customer_code)"
# Who the customer actually is, as distinct from the company they belong to.
PERSON = "COALESCE(c.full_name, co.name, c.customer_code)"


def _f(v) -> float:
    return float(v) if v is not None else 0.0


async def _customer_id(db: AsyncSession, code: str) -> int:
    cid = (await db.execute(text(
        "SELECT id FROM customer_schema.customer WHERE customer_code = :c"), {"c": code}
    )).scalar_one_or_none()
    if cid is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown customer {code}")
    return cid


async def _next_case_code(db: AsyncSession) -> str:
    """Case numbers come from the case table's own sequence, so they cannot collide."""
    n = (await db.execute(text(
        "SELECT nextval('customer_schema.debt_case_id_seq')"))).scalar_one()
    return f"CASE-{n:06d}"


async def _audit(db: AsyncSession, case_id: int, action: str, actor: int, *,
                 field: str | None = None, old: str | None = None, new: str | None = None,
                 role: str | None = None, reason: str | None = None) -> None:
    await db.execute(text("""
        INSERT INTO collection.case_audit
          (case_id, action, field_name, old_value, new_value, actor_id, actor_role, reason)
        VALUES (:c,:a,:f,:o,:n,:actor,:role,:reason)"""),
        dict(c=case_id, a=action, f=field, o=old, n=new, actor=actor, role=role, reason=reason))


async def _activity(db: AsyncSession, case_id: int, customer_id: int, actor: int,
                    subject: str, *, activity_type: str = "STATUS_CHANGE",
                    body: str | None = None, outcome: str | None = None,
                    account_id: int | None = None, automated: bool = False) -> None:
    """Work done goes on the shared timeline the whole product already reads."""
    await db.execute(text("""
        INSERT INTO customer_schema.case_activity
          (activity_type, customer_id, account_id, case_id, direction, subject, body,
           outcome, visibility, is_automated, agent_id, created_by)
        VALUES (:t,:cu,:ac,:case,'INTERNAL',:subj,:body,:out,'INTERNAL',:auto,:ag,:ag)"""),
        dict(t=activity_type, cu=customer_id, ac=account_id, case=case_id, subj=subject,
             body=body, out=outcome, auto=automated, ag=actor))
    await db.execute(text("""
        UPDATE customer_schema.debt_case
        SET last_activity_at = now(),
            first_response_at = COALESCE(first_response_at, now()),
            updated_at = now(), updated_by = :ag
        WHERE id = :i"""), {"i": case_id, "ag": actor})

    # "Assigned" means nobody has picked it up yet. The first real piece of
    # work moves the case on by itself, so an agent never has to remember to.
    # Status changes and system entries do not count as work.
    if activity_type not in ("STATUS_CHANGE", "SYSTEM"):
        await db.execute(text("""
            UPDATE collection.case_meta SET workflow_state = 'IN_PROGRESS', updated_at = now()
            WHERE case_id = :i AND workflow_state = 'ASSIGNED'"""), {"i": case_id})
        await db.execute(text("""
            UPDATE customer_schema.debt_case SET status = 'IN_PROGRESS'
            WHERE id = :i AND status = 'OPEN'"""), {"i": case_id})


# ==========================================================================
# Collection Workspace — the 360° operational row
# ==========================================================================
_WORKSPACE_SQL = f"""
SELECT
  c.customer_code, {NAME} AS customer_name, c.customer_type, co.name AS company_name,
  c.phone, c.email, c.credit_score, c.contactability,
  a.id AS account_id, a.account_code, ba.ban, a.contract_plan,
  a.outstanding, a.dpd, a.aging_bucket, a.status AS account_status,
  COALESCE(rp.overall_risk_score, a.risk_score) AS risk_score,
  COALESCE(rp.risk_band, a.risk_level)          AS risk_level,
  a.contact_attempts, a.last_contact_at, a.last_payment_at,
  u.id AS agent_id, u.full_name AS agent_name,
  s.name AS strategy_name,
  -- Open case (the one an agent would work), and how many there are
  oc.case_id, oc.case_code, oc.open_cases, oc.queue_code,
  -- Active promise
  p.promised_amount AS ptp_amount, p.promised_date AS ptp_due,
  -- Disputes still open
  d.dispute_count, d.disputed_amount,
  -- Legal and agency, from recovery_schema
  lc.stage AS legal_stage, lc.status AS legal_status,
  pl.status AS agency_status, ag.name AS agency_name,
  -- Recent money
  pay.last_amount, pay.payments_90d, pay.collected_90d
FROM customer_schema.account a
JOIN customer_schema.customer c ON c.id = a.customer_id
LEFT JOIN customer_schema.company co ON co.id = c.company_id
LEFT JOIN customer_schema.billing_account ba ON ba.id = a.billing_account_id
LEFT JOIN customer_schema.risk_profile rp ON rp.account_id = a.id
LEFT JOIN administration.app_user u ON u.id = c.assigned_agent_id
LEFT JOIN public.strategy s ON s.id = a.strategy_id
LEFT JOIN LATERAL (
  SELECT dc.id AS case_id, dc.case_code, m.queue_code,
         (SELECT count(*) FROM customer_schema.debt_case d2
           WHERE d2.customer_id = c.id AND d2.status <> 'CLOSED') AS open_cases
  FROM customer_schema.debt_case dc
  LEFT JOIN collection.case_meta m ON m.case_id = dc.id
  WHERE dc.customer_id = c.id AND dc.status <> 'CLOSED'
  ORDER BY CASE dc.priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1
                            WHEN 'Medium' THEN 2 ELSE 3 END, dc.opened_at
  LIMIT 1) oc ON TRUE
LEFT JOIN LATERAL (
  SELECT promised_amount, promised_date FROM customer_schema.ptp
  WHERE customer_id = c.id AND status = 'PENDING'
  ORDER BY promised_date LIMIT 1) p ON TRUE
LEFT JOIN LATERAL (
  SELECT count(*) AS dispute_count, COALESCE(sum(amount), 0) AS disputed_amount
  FROM customer_schema.dispute
  WHERE customer_id = c.id AND status NOT IN ('RESOLVED','REJECTED')) d ON TRUE
LEFT JOIN LATERAL (
  SELECT stage, status FROM recovery_schema.legal_case
  WHERE customer_id = c.id AND status = 'OPEN'
  ORDER BY claim_amount DESC LIMIT 1) lc ON TRUE
LEFT JOIN LATERAL (
  SELECT status, agency_id FROM recovery_schema.placement
  WHERE customer_id = c.id AND status IN ('ACTIVE','LEGAL')
  ORDER BY placed_amount DESC LIMIT 1) pl ON TRUE
LEFT JOIN recovery_schema.agency ag ON ag.id = pl.agency_id
LEFT JOIN LATERAL (
  SELECT (SELECT amount FROM customer_schema.payment
           WHERE account_id = a.id ORDER BY payment_date DESC LIMIT 1) AS last_amount,
         count(*) FILTER (WHERE payment_date >= CURRENT_DATE - 90) AS payments_90d,
         COALESCE(sum(amount) FILTER (WHERE payment_date >= CURRENT_DATE - 90), 0) AS collected_90d
  FROM customer_schema.payment WHERE account_id = a.id) pay ON TRUE
"""


def _next_action(r) -> tuple[str, str, int]:
    """What the collection operation should do next with this account."""
    dpd = r["dpd"] or 0
    out = _f(r["outstanding"])
    today = dt.date.today()

    # Order matters: the strongest signal decides, matching how a collections
    # floor actually triages.
    if r["dispute_count"]:
        return "Dispute open — resolve before collecting", "High", 85
    if r["legal_status"] == "OPEN":
        return f"With legal ({r['legal_stage']}) — monitor", "Critical", 75
    if r["agency_status"] in ("ACTIVE", "LEGAL"):
        return f"Placed with {r['agency_name']} — monitor", "Medium", 30
    if r["ptp_due"]:
        days = (r["ptp_due"] - today).days
        if days < 0:
            return "Promise overdue — chase payment", "Critical", 100
        if days == 0:
            return "Promise due today — confirm payment", "Critical", 95
        if days <= 2:
            return f"Promise due in {days}d — send reminder", "High", 70
        return f"Promise in place for {r['ptp_due']:%d %b}", "Low", 20
    if out <= 0:
        return "No balance — no action", "Low", 0
    if dpd >= 90:
        return "90+ days — negotiate or escalate", "Critical", 90
    if dpd >= 60:
        return "60+ days — call and negotiate", "High", 80
    if dpd >= 30:
        return "30+ days — follow up", "High", 65
    if dpd > 0:
        return "Recently overdue — send reminder", "Medium", 45
    return "Current — monitor", "Low", 10


def _collection_status(r) -> str:
    """Where this account sits in the collection lifecycle.

    Ordered latest-stage-first, so an account that has reached legal reads as
    Legal even though it is also still with an agency. This is the stage, not
    the next action — the two can differ, e.g. a disputed account at agency is
    stage "Agency" but its next action is to settle the dispute.
    """
    if r["legal_status"] == "OPEN":
        return "Legal"
    if r["agency_status"] in ("ACTIVE", "LEGAL"):
        return "Agency"
    if r["dispute_count"]:
        return "Disputed"
    if r["ptp_due"]:
        return "Promise To Pay"
    if r["open_cases"]:
        return "In Collection"
    if (r["dpd"] or 0) >= 60:
        return "Delinquent"
    if (r["dpd"] or 0) > 0:
        return "Overdue"
    return "Current"


def _workspace_row(r) -> schemas.WorkspaceRow:
    action, priority, score = _next_action(r)
    last_contact = r["last_contact_at"]
    if last_contact and last_contact.date() == dt.date.today():
        score = max(0, score - 25)
    return schemas.WorkspaceRow(
        customerId=r["customer_code"], customerName=r["customer_name"],
        customerType=r["customer_type"], companyName=r["company_name"],
        phone=r["phone"], email=r["email"],
        accountId=r["account_id"], accountCode=r["account_code"], ban=r["ban"],
        servicePlan=r["contract_plan"], outstanding=round(_f(r["outstanding"]), 2),
        dpd=r["dpd"] or 0, agingBucket=r["aging_bucket"], accountStatus=r["account_status"],
        riskScore=_f(r["risk_score"]), riskLevel=r["risk_level"],
        creditScore=r["credit_score"], contactability=_f(r["contactability"]),
        agentId=r["agent_id"], agentName=r["agent_name"],
        collectionStatus=_collection_status(r),
        openCases=r["open_cases"] or 0, openCaseCode=r["case_code"], openCaseId=r["case_id"],
        activePtp=r["ptp_due"] is not None,
        ptpAmount=_f(r["ptp_amount"]) if r["ptp_amount"] else None, ptpDueOn=r["ptp_due"],
        activeDisputes=r["dispute_count"] or 0,
        disputedAmount=round(_f(r["disputed_amount"]), 2),
        legalStatus=r["legal_status"], legalStage=r["legal_stage"],
        agencyStatus=r["agency_status"], agencyName=r["agency_name"],
        lastPaymentOn=r["last_payment_at"].date() if r["last_payment_at"] else None,
        lastPaymentAmount=_f(r["last_amount"]) if r["last_amount"] else None,
        payments90d=r["payments_90d"] or 0, collected90d=round(_f(r["collected_90d"]), 2),
        lastContactAt=r["last_contact_at"], contactAttempts=r["contact_attempts"] or 0,
        strategy=r["strategy_name"], queueCode=r["queue_code"],
        nextAction=action, priority=priority, priorityScore=score,
    )


async def workspace(
    db: AsyncSession, *, search: str | None = None, status_f: str | None = None,
    bucket: str | None = None, risk: str | None = None, queue: str | None = None,
    agent_id: int | None = None, unassigned: bool = False, limit: int = 300,
) -> list[schemas.WorkspaceRow]:
    where, params = ["a.outstanding > 0 OR a.dpd > 0"], {}
    if search:
        where.append(f"({NAME} ILIKE :q OR c.customer_code ILIKE :q OR a.account_code ILIKE :q "
                     "OR c.phone ILIKE :q OR ba.ban ILIKE :q)")
        params["q"] = f"%{search}%"
    if bucket:
        where.append("a.aging_bucket = :bucket")
        params["bucket"] = bucket
    if risk:
        where.append("COALESCE(rp.risk_band, a.risk_level) = :risk")
        params["risk"] = risk
    if agent_id:
        where.append("c.assigned_agent_id = :agent")
        params["agent"] = agent_id
    if unassigned:
        where.append("c.assigned_agent_id IS NULL")
    if queue:
        where.append("oc.queue_code = :queue")
        params["queue"] = queue

    sql = f"{_WORKSPACE_SQL} WHERE {' AND '.join(f'({w})' for w in where)} LIMIT {int(limit)}"
    rows = [_workspace_row(r) for r in (await db.execute(text(sql), params)).mappings().all()]
    if status_f:
        rows = [r for r in rows if r.collectionStatus == status_f]
    rows.sort(key=lambda r: (-r.priorityScore, -r.outstanding))
    return rows


async def workspace_summary(db: AsyncSession) -> schemas.WorkspaceSummary:
    r = (await db.execute(text("""
        SELECT
          count(*) AS accounts,
          count(DISTINCT a.customer_id) AS customers,
          COALESCE(sum(a.outstanding), 0) AS outstanding,
          count(*) FILTER (WHERE a.dpd > 0) AS needing_action,
          count(*) FILTER (WHERE c.assigned_agent_id IS NULL) AS unassigned
        FROM customer_schema.account a
        JOIN customer_schema.customer c ON c.id = a.customer_id
        WHERE a.outstanding > 0 OR a.dpd > 0"""))).mappings().one()
    extra = (await db.execute(text("""
        SELECT
          (SELECT count(DISTINCT customer_id) FROM customer_schema.ptp
            WHERE status = 'PENDING') AS with_ptp,
          (SELECT count(DISTINCT customer_id) FROM customer_schema.dispute
            WHERE status NOT IN ('RESOLVED','REJECTED')) AS in_dispute,
          (SELECT count(DISTINCT customer_id) FROM recovery_schema.placement
            WHERE status IN ('ACTIVE','LEGAL')) AS with_agency,
          (SELECT count(DISTINCT customer_id) FROM recovery_schema.legal_case
            WHERE status = 'OPEN') AS in_legal,
          (SELECT count(*) FROM customer_schema.debt_case
            WHERE status <> 'CLOSED') AS open_cases,
          (SELECT count(*) FROM customer_schema.debt_case
            WHERE status <> 'CLOSED' AND sla_deadline < now()) AS breached
        """))).mappings().one()
    return schemas.WorkspaceSummary(
        accounts=r["accounts"], customers=r["customers"],
        totalOutstanding=round(_f(r["outstanding"]), 2), needingAction=r["needing_action"],
        withActivePtp=extra["with_ptp"], inDispute=extra["in_dispute"],
        withAgency=extra["with_agency"], inLegal=extra["in_legal"],
        openCases=extra["open_cases"], slaBreached=extra["breached"],
        unassigned=r["unassigned"],
    )


async def customer_row(db: AsyncSession, code: str) -> schemas.WorkspaceRow:
    r = (await db.execute(text(f"{_WORKSPACE_SQL} WHERE c.customer_code = :code "
                               "ORDER BY a.outstanding DESC LIMIT 1"),
                          {"code": code})).mappings().first()
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown customer {code}")
    return _workspace_row(r)


async def customer_timeline(db: AsyncSession, code: str, limit: int = 120
                            ) -> list[schemas.TimelineEntry]:
    """One chronological story from every table that records something happening."""
    cid = await _customer_id(db, code)
    rows = (await db.execute(text("""
        SELECT occurred_at, kind, title, detail, actor, amount FROM (
          SELECT ca.occurred_at, 'CONTACT' AS kind,
                 ca.activity_type || COALESCE(' · ' || ca.channel_code, '') AS title,
                 ca.subject AS detail, u.full_name AS actor, NULL::numeric AS amount
            FROM customer_schema.case_activity ca
            LEFT JOIN administration.app_user u ON u.id = ca.agent_id
           WHERE ca.customer_id = :cid
          UNION ALL
          SELECT p.payment_date::timestamptz, 'PAYMENT', 'Payment ' || p.method_code,
                 p.payment_ref, NULL, p.amount
            FROM customer_schema.payment p WHERE p.customer_id = :cid
          UNION ALL
          SELECT i.issue_date::timestamptz, 'INVOICE', 'Invoice ' || i.status,
                 i.invoice_no, NULL, i.amount + i.tax_amount
            FROM customer_schema.invoice i WHERE i.customer_id = :cid
          UNION ALL
          SELECT t.created_at, 'PTP', 'Promise ' || t.status,
                 t.ptp_code || ' due ' || to_char(t.promised_date, 'DD Mon YYYY'),
                 u.full_name, t.promised_amount
            FROM customer_schema.ptp t
            LEFT JOIN administration.app_user u ON u.id = t.created_by
           WHERE t.customer_id = :cid
          UNION ALL
          SELECT d.filed_at, 'DISPUTE', 'Dispute ' || d.status, d.dispute_code, NULL, d.amount
            FROM customer_schema.dispute d WHERE d.customer_id = :cid
          UNION ALL
          SELECT dc.opened_at, 'CASE', 'Case ' || dc.status,
                 dc.case_code || ' · ' || dc.case_type_code, u.full_name, dc.amount
            FROM customer_schema.debt_case dc
            LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
           WHERE dc.customer_id = :cid
          UNION ALL
          SELECT pl.created_at, 'AGENCY', 'Placement ' || pl.status,
                 pl.placement_code || ' · ' || ag.name, NULL, pl.placed_amount
            FROM recovery_schema.placement pl
            JOIN recovery_schema.agency ag ON ag.id = pl.agency_id
           WHERE pl.customer_id = :cid
          UNION ALL
          SELECT lc.created_at, 'LEGAL', 'Legal ' || lc.stage,
                 lc.case_code || COALESCE(' · ' || lc.law_firm, ''), lc.attorney, lc.claim_amount
            FROM recovery_schema.legal_case lc WHERE lc.customer_id = :cid
        ) t ORDER BY occurred_at DESC LIMIT :lim"""),
        {"cid": cid, "lim": limit})).mappings().all()
    return [schemas.TimelineEntry(
        at=r["occurred_at"], kind=r["kind"], title=r["title"], detail=r["detail"],
        actor=r["actor"], amount=_f(r["amount"]) if r["amount"] is not None else None)
        for r in rows]


# ==========================================================================
# Cases
# ==========================================================================
_CASE_SQL = f"""
SELECT dc.id, dc.case_code, dc.status, dc.case_type_code, dc.priority, dc.summary,
       dc.amount, dc.dpd, dc.assigned_agent_id, dc.opened_at, dc.sla_deadline,
       dc.sla_breached, dc.first_response_at, dc.last_activity_at, dc.closed_at,
       dc.resolution_code,
       m.source_code, m.trigger_detail, m.queue_code, m.workflow_code, m.workflow_state,
       m.due_date, m.parent_case_id, m.merged_into_case_id, m.reopen_count,
       m.sla_paused_at, m.created_by_user,
       c.customer_code, {NAME} AS customer_name, c.customer_type,
       COALESCE(rp.overall_risk_score, acc.risk_score, 0) AS risk_score,
       COALESCE(rp.risk_band, acc.risk_level, 'Low')      AS risk_level,
       COALESCE(acc.outstanding, 0) AS outstanding, acc.account_code,
       u.full_name AS agent_name, cb.full_name AS created_by_name,
       ct.name AS type_name, cs.name AS source_name, q.name AS queue_name,
       ws.category AS state_category,
       s.name AS strategy_name,
       pc.case_code AS parent_case_number, mc.case_code AS merged_into_number,
       (SELECT count(*) FROM customer_schema.case_activity ca WHERE ca.case_id = dc.id) AS activity_n,
       (SELECT count(*) FROM collection.case_note n WHERE n.case_id = dc.id) AS note_n,
       (SELECT count(*) FROM collection.case_attachment at WHERE at.case_id = dc.id) AS attach_n,
       (SELECT count(*) FROM collection.case_meta cm WHERE cm.parent_case_id = dc.id) AS child_n
FROM customer_schema.debt_case dc
LEFT JOIN collection.case_meta m ON m.case_id = dc.id
JOIN customer_schema.customer c ON c.id = dc.customer_id
LEFT JOIN customer_schema.company co ON co.id = c.company_id
LEFT JOIN customer_schema.account acc ON acc.id = dc.account_id
LEFT JOIN customer_schema.risk_profile rp ON rp.account_id = acc.id
LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
LEFT JOIN administration.app_user cb ON cb.id = m.created_by_user
LEFT JOIN collection.case_type ct ON ct.code = dc.case_type_code
LEFT JOIN collection.case_source cs ON cs.code = m.source_code
LEFT JOIN collection.case_queue q ON q.code = m.queue_code
LEFT JOIN collection.workflow_state ws
       ON ws.workflow_code = m.workflow_code AND ws.code = m.workflow_state
LEFT JOIN public.strategy s ON s.id = m.strategy_id
LEFT JOIN customer_schema.debt_case pc ON pc.id = m.parent_case_id
LEFT JOIN customer_schema.debt_case mc ON mc.id = m.merged_into_case_id
"""


def _case_row(r) -> schemas.CaseRow:
    hours = None
    if r["sla_deadline"] and not r["closed_at"]:
        hours = round((r["sla_deadline"] - dt.datetime.now(dt.timezone.utc)).total_seconds() / 3600, 1)
    paused = r["sla_paused_at"] is not None
    return schemas.CaseRow(
        id=r["id"], caseNumber=r["case_code"], status=r["status"],
        workflowState=r["workflow_state"] or "NEW", stateCategory=r["state_category"],
        source=r["source_code"] or "SYSTEM_WORKFLOW", sourceName=r["source_name"],
        type=r["case_type_code"], typeName=r["type_name"], priority=r["priority"],
        queueCode=r["queue_code"], queueName=r["queue_name"], summary=r["summary"],
        customerId=r["customer_code"], customerName=r["customer_name"],
        customerType=r["customer_type"], accountCode=r["account_code"],
        outstanding=round(_f(r["outstanding"]), 2), dpd=r["dpd"],
        riskScore=_f(r["risk_score"]), riskLevel=r["risk_level"],
        amount=round(_f(r["amount"]), 2),
        agentId=r["assigned_agent_id"], agentName=r["agent_name"],
        openedAt=r["opened_at"], dueDate=r["due_date"], slaDeadline=r["sla_deadline"],
        slaBreached=(not paused and hours is not None and hours < 0),
        hoursToSla=hours, slaPaused=paused,
        firstResponseAt=r["first_response_at"], lastActivityAt=r["last_activity_at"],
        closedAt=r["closed_at"], resolution=r["resolution_code"],
        parentCaseId=r["parent_case_id"], parentCaseNumber=r["parent_case_number"],
        childCount=r["child_n"] or 0, mergedIntoCaseId=r["merged_into_case_id"],
        mergedIntoNumber=r["merged_into_number"], reopenCount=r["reopen_count"] or 0,
        strategy=r["strategy_name"], activityCount=r["activity_n"] or 0,
        noteCount=r["note_n"] or 0, attachmentCount=r["attach_n"] or 0,
        createdByName=r["created_by_name"], triggerDetail=r["trigger_detail"],
    )


async def list_cases(
    db: AsyncSession, *, search: str | None = None, state: str | None = None,
    category: str | None = None, queue: str | None = None, source: str | None = None,
    type_code: str | None = None, priority: str | None = None,
    agent_id: int | None = None, unassigned: bool = False, breached: bool = False,
    include_merged: bool = False, limit: int = 300,
) -> list[schemas.CaseRow]:
    where, params = ["TRUE"], {}
    if not include_merged:
        where.append("m.merged_into_case_id IS NULL")
    if state:
        where.append("m.workflow_state = :state")
        params["state"] = state
    if category == "OPEN":
        where.append("dc.status <> 'CLOSED'")
    elif category:
        where.append("ws.category = :category")
        params["category"] = category
    if queue:
        where.append("m.queue_code = :queue")
        params["queue"] = queue
    if source:
        where.append("m.source_code = :source")
        params["source"] = source
    if type_code:
        where.append("dc.case_type_code = :type")
        params["type"] = type_code
    if priority:
        where.append("dc.priority = :priority")
        params["priority"] = priority
    if agent_id:
        where.append("dc.assigned_agent_id = :agent")
        params["agent"] = agent_id
    if unassigned:
        where.append("dc.assigned_agent_id IS NULL")
    if breached:
        where.append("dc.status <> 'CLOSED' AND dc.sla_deadline < now() "
                     "AND m.sla_paused_at IS NULL")
    if search:
        where.append(f"({NAME} ILIKE :q OR dc.case_code ILIKE :q OR dc.summary ILIKE :q "
                     "OR c.customer_code ILIKE :q)")
        params["q"] = f"%{search}%"
    sql = (f"{_CASE_SQL} WHERE {' AND '.join(where)} "
           "ORDER BY dc.status = 'CLOSED', "
           "CASE dc.priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 "
           "WHEN 'Medium' THEN 2 ELSE 3 END, dc.sla_deadline NULLS LAST "
           f"LIMIT {int(limit)}")
    return [_case_row(r) for r in (await db.execute(text(sql), params)).mappings().all()]


async def case_timeline(db: AsyncSession, case_id: int) -> list[schemas.TimelineEntry]:
    """What has happened *on this case* — not the customer's wider history.

    A case nobody has worked has an empty timeline. The customer's invoices,
    payments and past promises belong to the customer and are shown separately;
    mixing them in made a fresh case look worked.
    """
    rows = (await db.execute(text("""
        SELECT occurred_at, kind, title, detail, actor, amount FROM (
          SELECT ca.occurred_at, 'CONTACT' AS kind,
                 ca.activity_type || COALESCE(' · ' || ca.channel_code, '') AS title,
                 ca.subject AS detail, u.full_name AS actor, NULL::numeric AS amount
            FROM customer_schema.case_activity ca
            LEFT JOIN administration.app_user u ON u.id = ca.agent_id
           WHERE ca.case_id = :i
          UNION ALL
          -- Only promises and disputes raised against this case.
          SELECT p.created_at, 'PTP', 'Promise ' || p.status,
                 p.ptp_code || ' due ' || to_char(p.promised_date, 'DD Mon YYYY'),
                 u.full_name, p.promised_amount
            FROM customer_schema.ptp p
            LEFT JOIN administration.app_user u ON u.id = p.created_by
           WHERE p.case_id = :i
          UNION ALL
          SELECT d.filed_at, 'DISPUTE', 'Dispute ' || d.status, d.dispute_code, NULL, d.amount
            FROM customer_schema.dispute d WHERE d.case_id = :i
          UNION ALL
          SELECT e.raised_at, 'ESCALATION', 'Escalated to ' || e.escalate_to,
                 e.reason, u.full_name, NULL::numeric
            FROM collection.case_escalation e
            LEFT JOIN administration.app_user u ON u.id = e.raised_by
           WHERE e.case_id = :i
          UNION ALL
          SELECT n.created_at, 'NOTE', 'Note · ' || n.note_type, n.body, u.full_name, NULL::numeric
            FROM collection.case_note n
            LEFT JOIN administration.app_user u ON u.id = n.author_id
           WHERE n.case_id = :i
          UNION ALL
          SELECT a.uploaded_at, 'DOCUMENT', 'Document uploaded', a.file_name,
                 u.full_name, NULL::numeric
            FROM collection.case_attachment a
            LEFT JOIN administration.app_user u ON u.id = a.uploaded_by
           WHERE a.case_id = :i
        ) t ORDER BY occurred_at DESC LIMIT 100"""), {"i": case_id})).mappings().all()
    return [schemas.TimelineEntry(
        at=r["occurred_at"], kind=r["kind"], title=r["title"], detail=r["detail"],
        actor=r["actor"], amount=_f(r["amount"]) if r["amount"] is not None else None)
        for r in rows]


async def case_detail(db: AsyncSession, case_id: int, perms: dict) -> schemas.CaseDetail:
    r = (await db.execute(text(f"{_CASE_SQL} WHERE dc.id = :i"), {"i": case_id})).mappings().first()
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    row = _case_row(r)
    cid = await _customer_id(db, row.customerId)

    trans = (await db.execute(text("""
        SELECT from_state, to_state, label, required_permission, requires_note, requires_approval
        FROM collection.workflow_transition
        WHERE workflow_code = :w AND from_state = :s ORDER BY sort_order"""),
        {"w": r["workflow_code"] or "STANDARD", "s": row.workflowState})).mappings().all()

    notes = (await db.execute(text("""
        SELECT n.*, u.full_name AS author FROM collection.case_note n
        LEFT JOIN administration.app_user u ON u.id = n.author_id
        WHERE n.case_id = :i ORDER BY n.is_pinned DESC, n.created_at DESC"""),
        {"i": case_id})).mappings().all()
    atts = (await db.execute(text("""
        SELECT a.*, u.full_name AS uploader FROM collection.case_attachment a
        LEFT JOIN administration.app_user u ON u.id = a.uploaded_by
        WHERE a.case_id = :i ORDER BY a.uploaded_at DESC"""), {"i": case_id})).mappings().all()
    audit = (await db.execute(text("""
        SELECT a.*, u.full_name AS actor FROM collection.case_audit a
        LEFT JOIN administration.app_user u ON u.id = a.actor_id
        WHERE a.case_id = :i ORDER BY a.occurred_at DESC LIMIT 100"""),
        {"i": case_id})).mappings().all()
    assigns = (await db.execute(text("""
        SELECT a.*, u.full_name AS agent_name, b.full_name AS by_name
        FROM collection.case_assignment a
        LEFT JOIN administration.app_user u ON u.id = a.agent_id
        LEFT JOIN administration.app_user b ON b.id = a.assigned_by
        WHERE a.case_id = :i ORDER BY a.assigned_at DESC"""), {"i": case_id})).mappings().all()
    comms = (await db.execute(text("""
        SELECT ca.id, ca.activity_type, ca.channel_code, ca.direction, ca.subject,
               ca.outcome, ca.occurred_at, u.full_name AS agent
        FROM customer_schema.case_activity ca
        LEFT JOIN administration.app_user u ON u.id = ca.agent_id
        WHERE ca.case_id = :i ORDER BY ca.occurred_at DESC LIMIT 100"""),
        {"i": case_id})).mappings().all()
    ptps = (await db.execute(text("""
        SELECT id, ptp_code, promised_amount, promised_date, kept_amount, status,
               instalment_count FROM customer_schema.ptp
        WHERE case_id = :i OR customer_id = :cu ORDER BY promised_date DESC LIMIT 20"""),
        {"i": case_id, "cu": cid})).mappings().all()
    disputes = (await db.execute(text("""
        SELECT id, dispute_code, reason_code, amount, status, filed_at
        FROM customer_schema.dispute WHERE case_id = :i OR customer_id = :cu
        ORDER BY filed_at DESC LIMIT 20"""), {"i": case_id, "cu": cid})).mappings().all()
    payments = (await db.execute(text("""
        SELECT payment_ref, payment_date, amount, method_code, status
        FROM customer_schema.payment WHERE customer_id = :cu
        ORDER BY payment_date DESC LIMIT 20"""), {"cu": cid})).mappings().all()
    legal = (await db.execute(text("""
        SELECT id, case_code, stage, status, claim_amount, next_hearing
        FROM recovery_schema.legal_case WHERE customer_id = :cu
        ORDER BY created_at DESC LIMIT 10"""), {"cu": cid})).mappings().all()
    placements = (await db.execute(text("""
        SELECT p.id, p.placement_code, ag.name AS agency_name, p.placed_amount,
               p.recovered_amount, p.status
        FROM recovery_schema.placement p
        JOIN recovery_schema.agency ag ON ag.id = p.agency_id
        WHERE p.customer_id = :cu ORDER BY p.placed_on DESC LIMIT 10"""),
        {"cu": cid})).mappings().all()
    children = (await db.execute(text(f"{_CASE_SQL} WHERE m.parent_case_id = :i"),
                                 {"i": case_id})).mappings().all()

    return schemas.CaseDetail(
        case=row,
        customer=await customer_row(db, row.customerId),
        transitions=[schemas.TransitionRow(
            fromState=t["from_state"], toState=t["to_state"], label=t["label"],
            requiredPermission=t["required_permission"], requiresNote=t["requires_note"],
            requiresApproval=t["requires_approval"],
            # Greyed out rather than hidden, so the workflow stays legible.
            allowed=not t["required_permission"]
                    or bool(perms.get(t["required_permission"], {}).get("edit")))
            for t in trans],
        timeline=await case_timeline(db, case_id),
        customerHistory=await customer_timeline(db, row.customerId, 60),
        communications=[schemas.RelatedCommunication(
            id=c["id"], type=c["activity_type"], channel=c["channel_code"],
            direction=c["direction"], subject=c["subject"], outcome=c["outcome"],
            agent=c["agent"], occurredAt=c["occurred_at"]) for c in comms],
        notes=[schemas.NoteRow(
            id=n["id"], body=n["body"], noteType=n["note_type"], visibility=n["visibility"],
            isPinned=n["is_pinned"], author=n["author"], createdAt=n["created_at"]) for n in notes],
        attachments=[schemas.AttachmentRow(
            id=a["id"], fileName=a["file_name"], fileType=a["file_type"],
            fileSizeBytes=a["file_size_bytes"], storageUri=a["storage_uri"],
            documentType=a["document_type"], uploadedBy=a["uploader"],
            uploadedAt=a["uploaded_at"]) for a in atts],
        audit=[schemas.AuditRow(
            id=a["id"], action=a["action"], fieldName=a["field_name"],
            oldValue=a["old_value"], newValue=a["new_value"], actor=a["actor"],
            actorRole=a["actor_role"], reason=a["reason"], occurredAt=a["occurred_at"])
            for a in audit],
        assignments=[schemas.AssignmentRow(
            id=a["id"], agentName=a["agent_name"], queueCode=a["queue_code"],
            assignedByName=a["by_name"], assignmentType=a["assignment_type"],
            reason=a["reason"], assignedAt=a["assigned_at"], releasedAt=a["released_at"])
            for a in assigns],
        ptps=[schemas.RelatedPtp(
            id=p["id"], code=p["ptp_code"], promisedAmount=_f(p["promised_amount"]),
            promisedDate=p["promised_date"], keptAmount=_f(p["kept_amount"]),
            status=p["status"], instalments=p["instalment_count"]) for p in ptps],
        disputes=[schemas.RelatedDispute(
            id=d["id"], code=d["dispute_code"], reason=d["reason_code"],
            amount=_f(d["amount"]), status=d["status"], filedAt=d["filed_at"]) for d in disputes],
        payments=[schemas.RelatedPayment(
            reference=p["payment_ref"], date=p["payment_date"], amount=_f(p["amount"]),
            method=p["method_code"], status=p["status"]) for p in payments],
        legal=[schemas.RelatedLegal(
            id=l["id"], code=l["case_code"], stage=l["stage"], status=l["status"],
            claimAmount=_f(l["claim_amount"]), nextHearing=l["next_hearing"]) for l in legal],
        placements=[schemas.RelatedPlacement(
            id=p["id"], code=p["placement_code"], agencyName=p["agency_name"],
            placedAmount=_f(p["placed_amount"]), recoveredAmount=_f(p["recovered_amount"]),
            status=p["status"]) for p in placements],
        children=[_case_row(c) for c in children],
    )


# ==========================================================================
# Case creation — duplicate policy, routing, assignment
# ==========================================================================
async def check_duplicate(db: AsyncSession, customer_code: str, type_code: str,
                          account_id: int | None = None) -> schemas.DuplicateCheck:
    """Is this same issue already on a card?

    A customer may hold several cases at once — one per issue. A dispute and a
    broken promise are two pieces of work and belong on two cards. What is a
    duplicate is a *second card of the same type* on the same account: one
    dispute is one dispute however many times it is reported.
    """
    cid = await _customer_id(db, customer_code)
    existing = (await db.execute(text("""
        SELECT dc.id, dc.case_code, dc.opened_at, dc.case_type_code, m.workflow_state
        FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id
        WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
          AND dc.case_type_code = :t
          AND (dc.account_id = CAST(:acc AS bigint)
               OR (CAST(:acc AS bigint) IS NULL AND dc.customer_id = :cu))
        ORDER BY dc.opened_at DESC LIMIT 1"""),
        {"cu": cid, "t": type_code, "acc": account_id})).mappings().first()
    if existing is None:
        return schemas.DuplicateCheck(hasDuplicate=False, policy="CREATE_NEW",
                                      options=["CREATE_NEW"])
    return schemas.DuplicateCheck(
        hasDuplicate=True, policy="OPEN_EXISTING",
        existingCaseId=existing["id"], existingCaseNumber=existing["case_code"],
        existingState=existing["workflow_state"], existingOpenedAt=existing["opened_at"],
        existingType=existing["case_type_code"],
        message=(f"{existing['case_code']} is already open on this account as a "
                 f"{type_code} case. Raising another would be the same issue twice."),
        options=["OPEN_EXISTING", "CREATE_NEW"],
    )


async def _route(db: AsyncSession, *, type_code: str, source_code: str, dpd: int,
                 amount: float, risk: str, customer_type: str) -> dict:
    """First matching assignment rule decides the queue, priority and agent."""
    rule = (await db.execute(text("""
        SELECT * FROM collection.assignment_rule
        WHERE is_active
          AND (case_type_code IS NULL OR case_type_code = :t)
          AND (source_code IS NULL OR source_code = :s)
          AND (dpd_min IS NULL OR :dpd >= dpd_min)
          AND (dpd_max IS NULL OR :dpd <= dpd_max)
          AND (amount_min IS NULL OR :amt >= amount_min)
          AND (amount_max IS NULL OR :amt <= amount_max)
          AND (cardinality(risk_levels) = 0 OR :risk = ANY(risk_levels))
          AND (cardinality(customer_types) = 0 OR :ctype = ANY(customer_types))
        ORDER BY priority LIMIT 1"""),
        dict(t=type_code, s=source_code, dpd=dpd, amt=amount, risk=risk, ctype=customer_type)
    )).mappings().first()
    return dict(rule) if rule else {}


async def _pick_agent(db: AsyncSession, queue_code: str | None) -> int | None:
    """Hand the case to whoever the queue's mode says should get it."""
    if not queue_code:
        return None
    q = (await db.execute(text(
        "SELECT assignment_mode, max_per_agent FROM collection.case_queue WHERE code = :c"),
        {"c": queue_code})).mappings().first()
    if not q or q["assignment_mode"] == "MANUAL":
        return None
    # Least-loaded is the sane default for both ROUND_ROBIN and LEAST_LOADED at
    # this scale; SKILL_BASED prefers agents already holding that queue's work.
    order = ("load ASC" if q["assignment_mode"] != "SKILL_BASED"
             else "queue_familiarity DESC, load ASC")
    row = (await db.execute(text(f"""
        SELECT u.id,
               (SELECT count(*) FROM customer_schema.debt_case dc
                 WHERE dc.assigned_agent_id = u.id AND dc.status <> 'CLOSED') AS load,
               (SELECT count(*) FROM customer_schema.debt_case dc
                  JOIN collection.case_meta m ON m.case_id = dc.id
                 WHERE dc.assigned_agent_id = u.id AND m.queue_code = :q) AS queue_familiarity
        FROM administration.app_user u
        JOIN administration.role r ON r.id = u.role_id
        WHERE u.status = 'ACTIVE' AND r.code IN ('AGENT','SUPERVISOR','COLLECTION_MANAGER')
        ORDER BY {order} LIMIT 1"""), {"q": queue_code})).mappings().first()
    if row and q["max_per_agent"] and row["load"] >= q["max_per_agent"]:
        return None            # queue is saturated; leave it unassigned for a supervisor
    return row["id"] if row else None


async def create_case(db: AsyncSession, p: schemas.CaseCreate, actor: int,
                      actor_role: str | None = None) -> schemas.CaseCreated:
    cid = await _customer_id(db, p.customerId)
    acc = (await db.execute(text("""
        SELECT a.id, a.outstanding, a.dpd, a.risk_level, a.strategy_id, c.customer_type,
               COALESCE(rp.risk_band, a.risk_level) AS risk_band
        FROM customer_schema.account a
        JOIN customer_schema.customer c ON c.id = a.customer_id
        LEFT JOIN customer_schema.risk_profile rp ON rp.account_id = a.id
        WHERE a.id = COALESCE(:acc, (SELECT id FROM customer_schema.account
                                     WHERE customer_id = :cu ORDER BY outstanding DESC LIMIT 1))"""),
        {"acc": p.accountId, "cu": cid})).mappings().first()

    ctype = (await db.execute(text(
        "SELECT * FROM collection.case_type WHERE code = :t"), {"t": p.typeCode})).mappings().first()
    if ctype is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown case type {p.typeCode}")
    # Every case says why it exists; a blank one is unworkable for whoever
    # picks it up next.
    description = (p.reason or "").strip()
    if not description:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "A case needs a description saying why it is being raised.")

    # --- Same issue, already on a card? -------------------------------------
    # A customer can hold several cases at once — one per issue. Only a second
    # card of the same type on the same account is duplication.
    dup = await check_duplicate(db, p.customerId, p.typeCode, acc["id"] if acc else None)
    if dup.hasDuplicate and (p.duplicateAction or "OPEN_EXISTING") == "OPEN_EXISTING":
        await _audit(db, dup.existingCaseId, "DUPLICATE_SUPPRESSED", actor, role=actor_role,
                     reason=f"Another {p.typeCode} case was requested from {p.sourceCode}; "
                            "the one already open was used instead.")
        await db.commit()
        return schemas.CaseCreated(
            id=dup.existingCaseId, caseNumber=dup.existingCaseNumber, action="OPEN_EXISTING",
            message=(f"{dup.existingCaseNumber} is already open on this account as a "
                     f"{p.typeCode} case — opened it instead."))

    # --- Routing ------------------------------------------------------------
    dpd = acc["dpd"] if acc else 0
    # The case is worth what the account owes — the figure Subscriber 360
    # shows. A separate number would drift the moment a payment landed.
    amount = _f(acc["outstanding"]) if acc else _f(p.amount)
    risk = acc["risk_band"] if acc else "Low"
    ctype_customer = acc["customer_type"] if acc else "CONSUMER"
    rule = await _route(db, type_code=p.typeCode, source_code=p.sourceCode, dpd=dpd,
                        amount=amount, risk=risk, customer_type=ctype_customer)
    queue = p.queueCode or rule.get("target_queue") or ctype["default_queue"]
    priority = p.priority or rule.get("set_priority") or ctype["default_priority"]

    # Ownership follows the customer, not the case.
    #
    # A customer already being worked keeps the same agent for every new case —
    # they know the history and the customer knows them. A customer nobody is
    # working is left unassigned so any agent can claim them from the pool.
    # An explicitly named agent always wins over both.
    owner = (await db.execute(text("""
        SELECT dc.assigned_agent_id FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id
        WHERE dc.customer_id = :cu AND dc.status <> 'CLOSED'
          AND dc.assigned_agent_id IS NOT NULL
          AND m.merged_into_case_id IS NULL
        ORDER BY dc.opened_at DESC LIMIT 1"""), {"cu": cid})).scalar_one_or_none()

    if p.assignToPool:
        # The agent explicitly chose to leave it in the pool, which overrides
        # the rule that a customer's cases follow their existing owner.
        agent, assign_why = None, "Left unassigned on purpose — anyone may claim it."
    elif p.agentId:
        agent, assign_why = p.agentId, "Directed to a specific agent."
    elif owner:
        agent, assign_why = owner, "Customer is already being worked by this agent."
    elif rule.get("target_agent_id"):
        agent, assign_why = rule["target_agent_id"], rule.get("name") or "Assignment rule."
    else:
        agent, assign_why = None, f"Left in the {queue or 'unassigned'} pool for an agent to claim."

    sla_hours = (await db.execute(text(
        "SELECT sla_hours FROM collection.case_priority WHERE code = :p"), {"p": priority}
    )).scalar_one_or_none() or ctype["sla_hours"]

    code = await _next_case_code(db)

    case_id = (await db.execute(text("""
        INSERT INTO customer_schema.debt_case
          (case_code, customer_id, account_id, case_type_code, summary, status, priority,
           risk_level, amount, dpd, strategy_id, assigned_agent_id, opened_at, sla_deadline,
           created_by, updated_by)
        VALUES (:code,:cu,:ac,:type,:sum,'OPEN',:pri,:risk,:amt,:dpd,:strat,:ag,now(),
                now() + make_interval(hours => :h), :actor, :actor)
        RETURNING id"""),
        dict(code=code, cu=cid, ac=acc["id"] if acc else None, type=p.typeCode,
             sum=description, pri=priority, risk=risk, amt=amount, dpd=dpd,
             strat=acc["strategy_id"] if acc else None, ag=agent, h=sla_hours, actor=actor))
    ).scalar_one()

    await db.execute(text("""
        INSERT INTO collection.case_meta
          (case_id, source_code, trigger_detail, created_by_user, created_by_role,
           queue_code, workflow_code, workflow_state, due_date, invoice_id, ptp_id,
           dispute_id, strategy_id, external_ref)
        VALUES (:i,:src,:trig,:by,:role,:q,'STANDARD',:state,:due,:inv,:ptp,:disp,:strat,:ext)"""),
        dict(i=case_id, src=p.sourceCode, trig=p.triggerDetail or p.reason, by=actor,
             role=actor_role, q=queue, state="ASSIGNED",
             due=p.dueDate, inv=p.invoiceId, ptp=p.ptpId, disp=p.disputeId,
             strat=acc["strategy_id"] if acc else None, ext=p.externalRef))

    if agent:
        await db.execute(text("""
            INSERT INTO collection.case_assignment
              (case_id, agent_id, queue_code, assigned_by, assignment_type, reason)
            VALUES (:i,:a,:q,:by,:t,:r)"""),
            dict(i=case_id, a=agent, q=queue, by=actor,
                 t="MANUAL" if p.agentId else "AUTO", r=assign_why))
    else:
        # Queued for the pool — recorded so the audit trail shows why nobody holds it.
        await db.execute(text("""
            INSERT INTO collection.case_assignment
              (case_id, agent_id, queue_code, assigned_by, assignment_type, reason)
            VALUES (:i, NULL, :q, :by, 'QUEUE', :r)"""),
            dict(i=case_id, q=queue, by=actor, r=assign_why))

    if p.notes:
        await db.execute(text("""
            INSERT INTO collection.case_note (case_id, author_id, body, note_type)
            VALUES (:i,:a,:b,'GENERAL')"""), dict(i=case_id, a=actor, b=p.notes))

    await _audit(db, case_id, "CASE_CREATED", actor, role=actor_role,
                 new=f"{code} · {p.typeCode} · {priority}",
                 reason=f"Source: {p.sourceCode}. {p.triggerDetail or p.reason or ''}".strip())
    await _audit(db, case_id, "CASE_ASSIGNED" if agent else "CASE_QUEUED", actor,
                 field="assigned_agent", new=str(agent) if agent else "Pool",
                 role=actor_role, reason=assign_why)
    # Deliberately no activity row: an untouched case must show an empty feed,
    # otherwise "Assigned" cases look like somebody has already worked them.
    # The creation itself is on collection.case_audit above.
    await db.commit()
    agent_name = (await db.execute(text(
        "SELECT full_name FROM administration.app_user WHERE id = :i"), {"i": agent}
    )).scalar_one_or_none() if agent else None
    return schemas.CaseCreated(
        id=case_id, caseNumber=code,
        action="CREATE_NEW", queueCode=queue,
        agentName=agent_name,
        message=(f"{code} created in {queue or 'no queue'}"
                 + (f", assigned to {agent_name}" if agent_name
                    else " — unassigned, any agent can claim it")),
    )


# ==========================================================================
# Workflow transitions
# ==========================================================================
# The legacy debt_case.status vocabulary each workflow state maps onto, so the
# Agent Workspace and every existing report keep working unchanged.
# The four states a case may hold, mapped onto the legacy status column that
# the rest of the product still reads.
_LEGACY_STATUS = {
    "ASSIGNED": "OPEN",
    "IN_PROGRESS": "IN_PROGRESS",
    "RESOLVED": "IN_PROGRESS",
    "CLOSED": "CLOSED",
}


async def transition(db: AsyncSession, case_id: int, req: schemas.TransitionRequest,
                     actor: int, perms: dict, actor_role: str | None = None) -> None:
    cur = (await db.execute(text("""
        SELECT dc.customer_id, dc.account_id, dc.priority, dc.opened_at,
               m.workflow_code, m.workflow_state, m.sla_paused_at, m.sla_paused_seconds,
               m.reopen_count
        FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id
        WHERE dc.id = :i"""), {"i": case_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    from_state = cur["workflow_state"] or "NEW"

    t = (await db.execute(text("""
        SELECT * FROM collection.workflow_transition
        WHERE workflow_code = :w AND from_state = :f AND to_state = :t"""),
        {"w": cur["workflow_code"] or "STANDARD", "f": from_state, "t": req.toState}
    )).mappings().first()
    if t is None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"{from_state} → {req.toState} is not a permitted move.")
    if t["required_permission"] and not perms.get(t["required_permission"], {}).get("edit"):
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            f"'{t['label']}' requires the {t['required_permission']} permission.")
    if t["requires_note"] and not (req.note or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"'{t['label']}' requires a note explaining the change.")

    new_state = (await db.execute(text("""
        SELECT * FROM collection.workflow_state
        WHERE workflow_code = :w AND code = :c"""),
        {"w": cur["workflow_code"] or "STANDARD", "c": req.toState})).mappings().one()

    # SLA accounting: a pausing state banks the elapsed time; leaving one
    # restarts the clock so the pause never counts against the agent.
    sets = ["workflow_state = :state", "updated_at = now()"]
    params = {"i": case_id, "state": req.toState}
    was_paused = cur["sla_paused_at"] is not None
    if new_state["pauses_sla"] and not was_paused:
        sets.append("sla_paused_at = now()")
    elif not new_state["pauses_sla"] and was_paused:
        sets.append("sla_paused_at = NULL")
        sets.append("sla_paused_seconds = sla_paused_seconds + "
                    "EXTRACT(EPOCH FROM (now() - sla_paused_at))::int")
    if req.toState == "REOPENED":
        sets.append("reopen_count = reopen_count + 1")
        sets.append("last_reopened_at = now()")
    await db.execute(text(
        f"UPDATE collection.case_meta SET {', '.join(sets)} WHERE case_id = :i"), params)

    # Keep the legacy status column in step, and push the SLA deadline out when
    # the clock resumes.
    legacy = _LEGACY_STATUS.get(req.toState, "IN_PROGRESS")
    dc_sets = ["status = :st", "updated_at = now()", "updated_by = :ag"]
    dc_params = {"i": case_id, "st": legacy, "ag": actor}
    if new_state["is_terminal"] or req.toState == "RESOLVED":
        dc_sets += ["closed_at = now()", "resolution_code = :res",
                    "resolution_hours = EXTRACT(EPOCH FROM (now() - opened_at)) / 3600"]
        dc_params["res"] = req.resolution or new_state["name"]
    elif from_state in ("RESOLVED", "CLOSED", "CANCELLED"):
        dc_sets += ["closed_at = NULL", "resolution_code = NULL"]
    if not new_state["pauses_sla"] and was_paused:
        dc_sets.append("sla_deadline = now() + make_interval(hours => "
                       "(SELECT sla_hours FROM collection.case_priority WHERE code = :pri))")
        dc_params["pri"] = cur["priority"]
    await db.execute(text(
        f"UPDATE customer_schema.debt_case SET {', '.join(dc_sets)} WHERE id = :i"), dc_params)

    await _audit(db, case_id, "STATE_CHANGED", actor, field="workflow_state",
                 old=from_state, new=req.toState, role=actor_role, reason=req.note)
    await _activity(db, case_id, cur["customer_id"], actor,
                    f"{t['label']}: {from_state} → {req.toState}",
                    body=req.note, outcome=req.resolution, account_id=cur["account_id"])
    await db.commit()


async def patch_case(db: AsyncSession, case_id: int, p: schemas.CasePatch, actor: int,
                     actor_role: str | None = None) -> None:
    """Edit a case in place — most importantly, re-type it.

    A case carries one type at a time, and it changes as the situation does:
    the broken promise that goes to legal becomes a Legal Follow-up case rather
    than spawning one beside it. Re-typing re-routes the queue and re-cuts the
    SLA, because a legal matter is not worked to a payment reminder's clock.
    """
    cur = (await db.execute(text("""
        SELECT dc.customer_id, dc.account_id, dc.case_type_code, dc.priority, dc.summary,
               m.queue_code
        FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id
        WHERE dc.id = :i"""), {"i": case_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    sets, params = ["updated_at = now()", "updated_by = :ag"], {"i": case_id, "ag": actor}
    told: list[str] = []

    if p.typeCode and p.typeCode != cur["case_type_code"]:
        nt = (await db.execute(text(
            "SELECT * FROM collection.case_type WHERE code = :t AND is_active"),
            {"t": p.typeCode})).mappings().first()
        if nt is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                f"{p.typeCode} is not a case type in use.")
        # The account may already have a card of the type this is moving to,
        # and two of those would be the same issue twice.
        clash = (await db.execute(text("""
            SELECT dc.case_code FROM customer_schema.debt_case dc
            LEFT JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE dc.id <> :i AND dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
              AND dc.case_type_code = :t AND dc.account_id = :acc
            LIMIT 1"""),
            {"i": case_id, "t": p.typeCode, "acc": cur["account_id"]})).scalar_one_or_none()
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"{clash} is already open on this account as a {p.typeCode} "
                                "case. Merge into it rather than making a second one.")
        sets.append("case_type_code = :type")
        params["type"] = p.typeCode
        sets.append("sla_deadline = now() + make_interval(hours => :sla)")
        params["sla"] = nt["sla_hours"]
        if nt["default_queue"] and nt["default_queue"] != cur["queue_code"]:
            await db.execute(text("""
                UPDATE collection.case_meta SET queue_code = :q, updated_at = now()
                WHERE case_id = :i"""), {"q": nt["default_queue"], "i": case_id})
        await _audit(db, case_id, "TYPE_CHANGED", actor, field="case_type",
                     old=cur["case_type_code"], new=p.typeCode, role=actor_role,
                     reason=p.reason)
        await _activity(db, case_id, cur["customer_id"], actor,
                        f"Case re-typed: {cur['case_type_code']} → {nt['name']}",
                        body=p.reason,
                        outcome=(f"Now in the {nt['default_queue']} queue"
                                 if nt["default_queue"] else None),
                        account_id=cur["account_id"])
        told.append("type")

    if p.priority and p.priority != cur["priority"]:
        sets.append("priority = :pri")
        params["pri"] = p.priority
        await _audit(db, case_id, "PRIORITY_CHANGED", actor, field="priority",
                     old=cur["priority"], new=p.priority, role=actor_role, reason=p.reason)
        told.append("priority")

    if p.summary is not None and p.summary.strip() and p.summary != cur["summary"]:
        sets.append("summary = :sum")
        params["sum"] = p.summary.strip()
        await _audit(db, case_id, "EDITED", actor, field="summary",
                     old=cur["summary"], new=p.summary.strip(), role=actor_role)
        told.append("description")

    if not told:
        return
    await db.execute(text(
        f"UPDATE customer_schema.debt_case SET {', '.join(sets)} WHERE id = :i"), params)
    await db.commit()


async def assign(db: AsyncSession, case_id: int, req: schemas.AssignRequest, actor: int,
                 actor_role: str | None = None) -> None:
    cur = (await db.execute(text("""
        SELECT dc.assigned_agent_id, dc.customer_id, dc.account_id, m.queue_code,
               m.workflow_state, u.full_name AS current_agent
        FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id
        LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
        WHERE dc.id = :i"""), {"i": case_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    agent = req.agentId
    queue = req.queueCode or cur["queue_code"]
    if agent is None and req.queueCode:
        agent = await _pick_agent(db, req.queueCode)   # routed to a queue, not a person
    if agent is not None and agent == cur["assigned_agent_id"] and queue == cur["queue_code"]:
        return

    new_name = (await db.execute(text(
        "SELECT full_name FROM administration.app_user WHERE id = :i"), {"i": agent}
    )).scalar_one_or_none() if agent else None

    await db.execute(text("""
        UPDATE collection.case_assignment SET released_at = now()
        WHERE case_id = :i AND released_at IS NULL"""), {"i": case_id})
    await db.execute(text("""
        INSERT INTO collection.case_assignment
          (case_id, agent_id, queue_code, assigned_by, assignment_type, reason)
        VALUES (:i,:a,:q,:by,:t,:r)"""),
        dict(i=case_id, a=agent, q=queue, by=actor, t=req.assignmentType, r=req.reason))
    await db.execute(text("""
        UPDATE customer_schema.debt_case
        SET assigned_agent_id = :a, updated_at = now(), updated_by = :by WHERE id = :i"""),
        {"a": agent, "by": actor, "i": case_id})
    await db.execute(text("""
        UPDATE collection.case_meta
        SET queue_code = :q,
            workflow_state = CASE WHEN workflow_state = 'NEW'
                                   AND CAST(:a AS bigint) IS NOT NULL
                                  THEN 'ASSIGNED' ELSE workflow_state END,
            updated_at = now()
        WHERE case_id = :i"""), {"q": queue, "a": agent, "i": case_id})

    action = "CASE_TRANSFERRED" if cur["assigned_agent_id"] else "CASE_ASSIGNED"
    await _audit(db, case_id, action, actor, field="assigned_agent",
                 old=cur["current_agent"], new=new_name or "Unassigned",
                 role=actor_role, reason=req.reason)
    await _activity(db, case_id, cur["customer_id"], actor,
                    f"Case {'transferred to' if cur['assigned_agent_id'] else 'assigned to'} "
                    f"{new_name or 'the ' + (queue or 'unassigned') + ' queue'}",
                    body=req.reason, account_id=cur["account_id"])
    await db.commit()


async def claim(db: AsyncSession, case_id: int, actor: int,
                actor_role: str | None = None) -> None:
    """An agent takes an unclaimed case out of the pool.

    Claiming one case claims the customer: any other unassigned case for them
    goes to the same agent, so ownership stays whole from the first pick-up.
    """
    cur = (await db.execute(text("""
        SELECT dc.customer_id, dc.assigned_agent_id, u.full_name
        FROM customer_schema.debt_case dc
        LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
        WHERE dc.id = :i"""), {"i": case_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    if cur["assigned_agent_id"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{cur['full_name']} already holds this case. Ask a supervisor to transfer it.")

    siblings = [r[0] for r in (await db.execute(text("""
        SELECT dc.id FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id
        WHERE dc.customer_id = :cu AND dc.status <> 'CLOSED'
          AND dc.assigned_agent_id IS NULL AND m.merged_into_case_id IS NULL"""),
        {"cu": cur["customer_id"]})).all()]

    for cid in siblings:
        await assign(db, cid, schemas.AssignRequest(
            agentId=actor, assignmentType="MANUAL",
            reason="Claimed from the pool" if cid == case_id
                   else "Claimed with the customer's other case"), actor, actor_role)


async def merge_cases(db: AsyncSession, case_id: int, req: schemas.MergeRequest, actor: int,
                      actor_role: str | None = None) -> None:
    """Fold this case into another. The source closes; its history is preserved."""
    if case_id == req.targetCaseId:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A case cannot be merged into itself.")
    src = (await db.execute(text("""
        SELECT dc.case_code, dc.customer_id, dc.account_id, m.merged_into_case_id
        FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id WHERE dc.id = :i"""),
        {"i": case_id})).mappings().first()
    tgt = (await db.execute(text("""
        SELECT dc.case_code, dc.customer_id, dc.status FROM customer_schema.debt_case dc
        WHERE dc.id = :i"""), {"i": req.targetCaseId})).mappings().first()
    if src is None or tgt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    if src["merged_into_case_id"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "That case has already been merged.")
    if src["customer_id"] != tgt["customer_id"]:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Cases for different customers cannot be merged.")
    if tgt["status"] == "CLOSED":
        raise HTTPException(status.HTTP_409_CONFLICT, "The target case is closed.")

    await db.execute(text("""
        UPDATE collection.case_meta
        SET merged_into_case_id = :t, merged_at = now(), workflow_state = 'CLOSED',
            updated_at = now()
        WHERE case_id = :i"""), {"t": req.targetCaseId, "i": case_id})
    await db.execute(text("""
        UPDATE customer_schema.debt_case
        SET status = 'CLOSED', closed_at = now(), resolution_code = :r,
            updated_at = now(), updated_by = :ag
        WHERE id = :i"""),
        {"r": f"Merged into {tgt['case_code']}", "i": case_id, "ag": actor})
    # Notes and attachments follow the work, so nothing is stranded on a
    # closed case.
    await db.execute(text(
        "UPDATE collection.case_note SET case_id = :t WHERE case_id = :i"),
        {"t": req.targetCaseId, "i": case_id})
    await db.execute(text(
        "UPDATE collection.case_attachment SET case_id = :t WHERE case_id = :i"),
        {"t": req.targetCaseId, "i": case_id})

    await _audit(db, case_id, "CASE_MERGED", actor, field="merged_into",
                 old=src["case_code"], new=tgt["case_code"], role=actor_role, reason=req.reason)
    await _audit(db, req.targetCaseId, "CASE_MERGED_IN", actor,
                 new=src["case_code"], role=actor_role, reason=req.reason)
    await _activity(db, req.targetCaseId, tgt["customer_id"], actor,
                    f"{src['case_code']} was merged into this case",
                    body=req.reason, account_id=src["account_id"])
    await db.commit()


# ==========================================================================
# Notes, attachments
# ==========================================================================
async def add_note(db: AsyncSession, case_id: int, p: schemas.NoteCreate, actor: int,
                   actor_role: str | None = None) -> int:
    cur = (await db.execute(text(
        "SELECT customer_id, account_id FROM customer_schema.debt_case WHERE id = :i"),
        {"i": case_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    nid = (await db.execute(text("""
        INSERT INTO collection.case_note (case_id, author_id, body, note_type, visibility, is_pinned)
        VALUES (:i,:a,:b,:t,:v,:p) RETURNING id"""),
        dict(i=case_id, a=actor, b=p.body, t=p.noteType, v=p.visibility, p=p.isPinned))
    ).scalar_one()
    await _audit(db, case_id, "NOTE_ADDED", actor, role=actor_role, new=p.noteType)
    await _activity(db, case_id, cur["customer_id"], actor, "Note added",
                    activity_type="NOTE", body=p.body, account_id=cur["account_id"])
    await db.commit()
    return nid


async def add_attachment(db: AsyncSession, case_id: int, p: schemas.AttachmentCreate,
                         actor: int, actor_role: str | None = None) -> int:
    cur = (await db.execute(text(
        "SELECT customer_id, account_id FROM customer_schema.debt_case WHERE id = :i"),
        {"i": case_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    aid = (await db.execute(text("""
        INSERT INTO collection.case_attachment
          (case_id, file_name, file_type, file_size_bytes, storage_uri, document_type, uploaded_by)
        VALUES (:i,:n,:t,:s,:u,:d,:a) RETURNING id"""),
        dict(i=case_id, n=p.fileName, t=p.fileType, s=p.fileSizeBytes, u=p.storageUri,
             d=p.documentType, a=actor))).scalar_one()
    await _audit(db, case_id, "DOCUMENT_UPLOADED", actor, role=actor_role,
                 new=f"{p.documentType}: {p.fileName}")
    await _activity(db, case_id, cur["customer_id"], actor,
                    f"Document uploaded: {p.fileName}", activity_type="NOTE",
                    account_id=cur["account_id"])
    await db.commit()
    return aid


# ==========================================================================
# Dashboard and configuration
# ==========================================================================
async def dashboard(db: AsyncSession, agent_id: int | None = None) -> schemas.CaseDashboard:
    # NULL widens the scope to the whole floor; an id narrows it to one desk.
    scope = " AND dc.assigned_agent_id = :agent" if agent_id else ""
    args = {"agent": agent_id} if agent_id else {}
    base = f"""
        FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id
        WHERE m.merged_into_case_id IS NULL{scope}"""
    k = (await db.execute(text(f"""
        SELECT
          count(*) FILTER (WHERE dc.status <> 'CLOSED')                       AS total_open,
          count(*) FILTER (WHERE dc.status <> 'CLOSED'
                             AND dc.assigned_agent_id IS NULL)                AS unassigned,
          count(*) FILTER (WHERE dc.status <> 'CLOSED' AND dc.sla_deadline < now()
                             AND m.sla_paused_at IS NULL)                     AS breached,
          count(*) FILTER (WHERE dc.status <> 'CLOSED'
                             AND dc.sla_deadline::date = CURRENT_DATE)        AS due_today,
          count(*) FILTER (WHERE dc.opened_at::date = CURRENT_DATE)           AS created_today,
          count(*) FILTER (WHERE dc.closed_at::date = CURRENT_DATE)           AS closed_today,
          COALESCE(sum(m.reopen_count), 0)                                    AS reopened,
          COALESCE(sum(dc.amount) FILTER (WHERE dc.status <> 'CLOSED'), 0)    AS total_value,
          avg(dc.resolution_hours) FILTER (WHERE dc.resolution_hours IS NOT NULL) AS avg_hours
        {base}"""), args)).mappings().one()

    async def group(expr: str, label: str, extra: str = "") -> list[dict]:
        rows = (await db.execute(text(f"""
            SELECT {expr} AS key, count(*) AS n,
                   COALESCE(sum(dc.amount), 0) AS value
            {base} AND dc.status <> 'CLOSED' {extra}
            GROUP BY 1 ORDER BY n DESC"""), args)).mappings().all()
        return [{label: r["key"] or "Unassigned", "count": r["n"],
                 "value": round(_f(r["value"]), 2)} for r in rows]

    ageing = (await db.execute(text(f"""
        SELECT CASE
                 WHEN now() - dc.opened_at < INTERVAL '1 day'  THEN 'Under 1 day'
                 WHEN now() - dc.opened_at < INTERVAL '3 days' THEN '1-3 days'
                 WHEN now() - dc.opened_at < INTERVAL '7 days' THEN '3-7 days'
                 WHEN now() - dc.opened_at < INTERVAL '30 days' THEN '7-30 days'
                 ELSE 'Over 30 days' END AS bucket,
               count(*) AS n
        {base} AND dc.status <> 'CLOSED'
        GROUP BY 1"""), args)).mappings().all()
    order = ["Under 1 day", "1-3 days", "3-7 days", "7-30 days", "Over 30 days"]
    by_age = sorted(({"bucket": r["bucket"], "count": r["n"]} for r in ageing),
                    key=lambda x: order.index(x["bucket"]))

    agent_rows = (await db.execute(text(f"""
        SELECT u.full_name AS key, count(*) AS n,
               count(*) FILTER (WHERE dc.sla_deadline < now() AND m.sla_paused_at IS NULL) AS breached,
               COALESCE(sum(dc.amount), 0) AS value
        FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id
        JOIN administration.app_user u ON u.id = dc.assigned_agent_id
        WHERE m.merged_into_case_id IS NULL AND dc.status <> 'CLOSED'{scope}
        GROUP BY 1 ORDER BY n DESC"""), args)).mappings().all()

    return schemas.CaseDashboard(
        totalOpen=k["total_open"], unassigned=k["unassigned"], slaBreached=k["breached"],
        dueToday=k["due_today"], createdToday=k["created_today"],
        closedToday=k["closed_today"], reopened=int(k["reopened"] or 0),
        totalValue=round(_f(k["total_value"]), 2),
        avgResolutionHours=round(_f(k["avg_hours"]), 1) if k["avg_hours"] else None,
        byState=await group("m.workflow_state", "state"),
        byQueue=await group("m.queue_code", "queue"),
        bySource=await group("m.source_code", "source"),
        byPriority=await group("dc.priority", "priority"),
        byType=await group("dc.case_type_code", "type"),
        byAgent=[{"agent": r["key"], "count": r["n"], "breached": r["breached"],
                  "value": round(_f(r["value"]), 2)} for r in agent_rows],
        ageing=by_age,
    )


async def config(db: AsyncSession) -> schemas.Config:
    types = (await db.execute(text(
        "SELECT * FROM collection.case_type ORDER BY sort_order"))).mappings().all()
    sources = (await db.execute(text(
        "SELECT * FROM collection.case_source ORDER BY sort_order"))).mappings().all()
    queues = (await db.execute(text("""
        SELECT q.*,
               (SELECT count(*) FROM collection.case_meta m
                  JOIN customer_schema.debt_case dc ON dc.id = m.case_id
                 WHERE m.queue_code = q.code AND dc.status <> 'CLOSED') AS open_cases,
               (SELECT count(*) FROM collection.case_meta m
                  JOIN customer_schema.debt_case dc ON dc.id = m.case_id
                 WHERE m.queue_code = q.code AND dc.status <> 'CLOSED'
                   AND dc.sla_deadline < now() AND m.sla_paused_at IS NULL) AS breached,
               (SELECT COALESCE(sum(dc.amount), 0) FROM collection.case_meta m
                  JOIN customer_schema.debt_case dc ON dc.id = m.case_id
                 WHERE m.queue_code = q.code AND dc.status <> 'CLOSED') AS total_value,
               (SELECT count(DISTINCT dc.assigned_agent_id) FROM collection.case_meta m
                  JOIN customer_schema.debt_case dc ON dc.id = m.case_id
                 WHERE m.queue_code = q.code AND dc.status <> 'CLOSED') AS agents
        FROM collection.case_queue q ORDER BY q.sort_order"""))).mappings().all()
    priorities = (await db.execute(text(
        "SELECT code, name, rank, sla_hours, colour FROM collection.case_priority ORDER BY rank"
    ))).mappings().all()
    states = (await db.execute(text("""
        SELECT s.*, (SELECT count(*) FROM collection.case_meta m
                      JOIN customer_schema.debt_case dc ON dc.id = m.case_id
                     WHERE m.workflow_state = s.code AND dc.status <> 'CLOSED') AS n
        FROM collection.workflow_state s WHERE s.workflow_code = 'STANDARD'
        ORDER BY s.sort_order"""))).mappings().all()
    trans = (await db.execute(text("""
        SELECT * FROM collection.workflow_transition WHERE workflow_code = 'STANDARD'
        ORDER BY sort_order"""))).mappings().all()
    rules = (await db.execute(text(
        "SELECT * FROM collection.assignment_rule ORDER BY priority"))).mappings().all()
    agents = (await db.execute(text("""
        SELECT u.id, u.full_name AS name, r.code AS role,
               (SELECT count(*) FROM customer_schema.debt_case dc
                 WHERE dc.assigned_agent_id = u.id AND dc.status <> 'CLOSED') AS open_cases
        FROM administration.app_user u
        JOIN administration.role r ON r.id = u.role_id
        WHERE u.status = 'ACTIVE'
          AND r.code IN ('AGENT','SUPERVISOR','COLLECTION_MANAGER','LEGAL_OFFICER')
        ORDER BY u.full_name"""))).mappings().all()

    return schemas.Config(
        types=[schemas.CaseTypeRow(
            code=t["code"], name=t["name"], description=t["description"],
            defaultPriority=t["default_priority"], defaultQueue=t["default_queue"],
            slaHours=t["sla_hours"], duplicatePolicy=t["duplicate_policy"],
            requiresApproval=t["requires_approval"], autoCloseOnPay=t["auto_close_on_pay"],
            isActive=t["is_active"]) for t in types],
        sources=[schemas.CaseSourceRow(
            code=s["code"], name=s["name"], description=s["description"],
            isAutomated=s["is_automated"], isActive=s["is_active"]) for s in sources],
        queues=[schemas.QueueRow(
            code=q["code"], name=q["name"], description=q["description"],
            dpdMin=q["dpd_min"], dpdMax=q["dpd_max"],
            amountMin=_f(q["amount_min"]) if q["amount_min"] is not None else None,
            amountMax=_f(q["amount_max"]) if q["amount_max"] is not None else None,
            riskLevels=list(q["risk_levels"] or []),
            customerTypes=list(q["customer_types"] or []),
            assignmentMode=q["assignment_mode"], maxPerAgent=q["max_per_agent"],
            isActive=q["is_active"], openCases=q["open_cases"], slaBreached=q["breached"],
            totalValue=round(_f(q["total_value"]), 2), agents=q["agents"]) for q in queues],
        priorities=[dict(r) for r in priorities],
        states=[schemas.WorkflowStateRow(
            code=s["code"], name=s["name"], category=s["category"], isInitial=s["is_initial"],
            isTerminal=s["is_terminal"], pausesSla=s["pauses_sla"], colour=s["colour"],
            caseCount=s["n"]) for s in states],
        transitions=[schemas.TransitionRow(
            fromState=t["from_state"], toState=t["to_state"], label=t["label"],
            requiredPermission=t["required_permission"], requiresNote=t["requires_note"],
            requiresApproval=t["requires_approval"]) for t in trans],
        rules=[schemas.AssignmentRuleRow(
            id=r["id"], name=r["name"], description=r["description"], priority=r["priority"],
            isActive=r["is_active"], caseTypeCode=r["case_type_code"],
            sourceCode=r["source_code"], dpdMin=r["dpd_min"], dpdMax=r["dpd_max"],
            amountMin=_f(r["amount_min"]) if r["amount_min"] is not None else None,
            amountMax=_f(r["amount_max"]) if r["amount_max"] is not None else None,
            riskLevels=list(r["risk_levels"] or []),
            customerTypes=list(r["customer_types"] or []),
            targetQueue=r["target_queue"], targetAgentId=r["target_agent_id"],
            setPriority=r["set_priority"]) for r in rules],
        agents=[dict(a) for a in agents],
    )


async def save_queue(db: AsyncSession, p: schemas.QueueWrite, actor: int) -> None:
    await db.execute(text("""
        INSERT INTO collection.case_queue
          (code, name, description, dpd_min, dpd_max, amount_min, amount_max,
           risk_levels, customer_types, assignment_mode, max_per_agent, is_active)
        VALUES (:c,:n,:d,:dmin,:dmax,:amin,:amax,:risks,:ctypes,:mode,:mx,:act)
        ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
          dpd_min=EXCLUDED.dpd_min, dpd_max=EXCLUDED.dpd_max, amount_min=EXCLUDED.amount_min,
          amount_max=EXCLUDED.amount_max, risk_levels=EXCLUDED.risk_levels,
          customer_types=EXCLUDED.customer_types, assignment_mode=EXCLUDED.assignment_mode,
          max_per_agent=EXCLUDED.max_per_agent, is_active=EXCLUDED.is_active"""),
        dict(c=p.code, n=p.name, d=p.description, dmin=p.dpdMin, dmax=p.dpdMax,
             amin=p.amountMin, amax=p.amountMax, risks=p.riskLevels, ctypes=p.customerTypes,
             mode=p.assignmentMode, mx=p.maxPerAgent, act=p.isActive))
    await db.commit()


async def save_case_type(db: AsyncSession, p: schemas.CaseTypeWrite, actor: int) -> None:
    await db.execute(text("""
        INSERT INTO collection.case_type
          (code, name, description, default_priority, default_queue, sla_hours,
           duplicate_policy, requires_approval, auto_close_on_pay, is_active)
        VALUES (:c,:n,:d,:p,:q,:sla,:dup,:appr,:auto,:act)
        ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
          default_priority=EXCLUDED.default_priority, default_queue=EXCLUDED.default_queue,
          sla_hours=EXCLUDED.sla_hours, duplicate_policy=EXCLUDED.duplicate_policy,
          requires_approval=EXCLUDED.requires_approval,
          auto_close_on_pay=EXCLUDED.auto_close_on_pay, is_active=EXCLUDED.is_active"""),
        dict(c=p.code, n=p.name, d=p.description, p=p.defaultPriority, q=p.defaultQueue,
             sla=p.slaHours, dup=p.duplicatePolicy, appr=p.requiresApproval,
             auto=p.autoCloseOnPay, act=p.isActive))
    await db.commit()


# ==========================================================================
# Case candidates — who has defaulted and has nobody working it
# ==========================================================================
# Each trigger says why an account needs a case, what type to raise and how
# urgent it is. Ordered strongest first; the first match wins, so an account
# with a broken promise is never merely "overdue".
TRIGGERS = [
    ("UNCLAIMED_CASE", "Unclaimed case",    "Collection",     "High",     92),
    ("BROKEN_PTP",    "Broken promise",     "Broken PTP",     "High",     95),
    ("PTP_OVERDUE",   "Promise overdue",    "Broken PTP",     "High",     90),
    ("DISPUTE_OPEN",  "Dispute unattended", "Dispute",        "High",     85),
    ("DPD_90",        "90+ days past due",  "High DPD",       "Critical", 100),
    ("DPD_60",        "60+ days past due",  "High DPD",       "High",     80),
    ("DPD_30",        "30+ days past due",  "Collection",     "Medium",   60),
    ("HIGH_RISK",     "High risk exposure", "Collection",     "High",     70),
    ("DPD_EARLY",     "Recently overdue",   "Collection",     "Medium",   40),
    ("NO_PAYMENT",    "No payment in 90 days", "Collection",  "Medium",   50),
]

_CANDIDATE_SQL = f"""
SELECT
  c.customer_code, {NAME} AS customer_name, c.customer_type, co.name AS company_name,
  c.credit_score, c.assigned_agent_id, u.full_name AS agent_name,
  a.id AS account_id, a.account_code, ba.ban,
  a.outstanding, a.dpd, a.aging_bucket,
  COALESCE(rp.overall_risk_score, a.risk_score) AS risk_score,
  COALESCE(rp.risk_band, a.risk_level)          AS risk_level,
  a.last_payment_at, a.last_contact_at, s.name AS strategy_name,
  bp.ptp_code AS broken_ptp_code, bp.promised_amount AS broken_ptp_amount,
  bp.promised_date AS broken_ptp_date,
  od.promised_date AS overdue_ptp_date, od.ptp_code AS overdue_ptp_code,
  COALESCE(dsp.n, 0) AS open_disputes,
  -- A case with no agent is unworked, whatever its state says.
  (SELECT dc.case_code FROM customer_schema.debt_case dc
    WHERE dc.customer_id = c.id AND dc.status <> 'CLOSED'
      AND dc.assigned_agent_id IS NULL LIMIT 1) AS unclaimed_case,
  (SELECT count(*) FROM customer_schema.payment p
    WHERE p.account_id = a.id AND p.payment_date >= CURRENT_DATE - 90) AS payments_90d
FROM customer_schema.account a
JOIN customer_schema.customer c ON c.id = a.customer_id
LEFT JOIN customer_schema.company co ON co.id = c.company_id
LEFT JOIN customer_schema.billing_account ba ON ba.id = a.billing_account_id
LEFT JOIN customer_schema.risk_profile rp ON rp.account_id = a.id
LEFT JOIN administration.app_user u ON u.id = c.assigned_agent_id
LEFT JOIN public.strategy s ON s.id = a.strategy_id
LEFT JOIN LATERAL (
  SELECT ptp_code, promised_amount, promised_date FROM customer_schema.ptp
  WHERE customer_id = c.id AND status = 'BROKEN'
  ORDER BY promised_date DESC LIMIT 1) bp ON TRUE
LEFT JOIN LATERAL (
  SELECT ptp_code, promised_date FROM customer_schema.ptp
  WHERE customer_id = c.id AND status = 'PENDING' AND promised_date < CURRENT_DATE
  ORDER BY promised_date LIMIT 1) od ON TRUE
LEFT JOIN LATERAL (
  SELECT count(*) AS n FROM customer_schema.dispute
  WHERE customer_id = c.id AND status NOT IN ('RESOLVED','REJECTED')) dsp ON TRUE
WHERE a.outstanding > 0
  -- Either nothing is open on this account at all, or something is open with
  -- nobody on it. A case sitting unclaimed still needs picking up even when
  -- the customer's other cases are being worked.
  AND (
        NOT EXISTS (SELECT 1 FROM customer_schema.debt_case dc
                     WHERE dc.customer_id = c.id AND dc.status <> 'CLOSED')
     OR EXISTS (SELECT 1 FROM customer_schema.debt_case dc
                 WHERE dc.customer_id = c.id AND dc.status <> 'CLOSED'
                   AND dc.assigned_agent_id IS NULL)
      )
"""


def _classify(r) -> tuple[str, str, str, str, int, str] | None:
    """Strongest reason this account needs a case, or None if it does not."""
    dpd = r["dpd"] or 0
    out = _f(r["outstanding"])

    if r.get("unclaimed_case"):
        code = "UNCLAIMED_CASE"
        detail = (f"Case {r['unclaimed_case']} is open with no agent on it "
                  f"— {out:,.2f} outstanding.")
        return code, "Unclaimed case", "Collection", "High", 92, detail
    if r["broken_ptp_code"]:
        code = "BROKEN_PTP"
        detail = (f"Promise {r['broken_ptp_code']} for "
                  f"${_f(r['broken_ptp_amount']):,.2f} was broken "
                  f"(due {r['broken_ptp_date']:%d %b %Y}).")
    elif r["overdue_ptp_date"]:
        code = "PTP_OVERDUE"
        days = (dt.date.today() - r["overdue_ptp_date"]).days
        detail = (f"Promise {r['overdue_ptp_code']} was due "
                  f"{r['overdue_ptp_date']:%d %b %Y} — {days} days ago, still unpaid.")
    elif r["open_disputes"]:
        code = "DISPUTE_OPEN"
        detail = f"{r['open_disputes']} open dispute with no case attached to it."
    elif dpd >= 90:
        code, detail = "DPD_90", f"{dpd} days past due with ${out:,.2f} outstanding."
    elif dpd >= 60:
        code, detail = "DPD_60", f"{dpd} days past due with ${out:,.2f} outstanding."
    elif dpd >= 30:
        code, detail = "DPD_30", f"{dpd} days past due with ${out:,.2f} outstanding."
    elif r["risk_level"] in ("High", "Critical") and dpd > 0:
        code = "HIGH_RISK"
        detail = f"{r['risk_level']} risk at {dpd} days past due."
    elif dpd > 0:
        code, detail = "DPD_EARLY", f"{dpd} days past due with ${out:,.2f} outstanding."
    elif not r["payments_90d"] and out > 0:
        code = "NO_PAYMENT"
        detail = f"No payment in 90 days with ${out:,.2f} still owing."
    else:
        return None

    t = next(x for x in TRIGGERS if x[0] == code)
    urgency = t[4]
    # A big balance deserves attention sooner than a small one at the same age.
    urgency += min(10, int(out / 500))
    if r["risk_level"] == "Critical":
        urgency += 5
    return code, t[1], t[2], t[3], urgency, detail


async def candidates(
    db: AsyncSession, *, agent_id: int | None = None, search: str | None = None,
    trigger: str | None = None, min_dpd: int | None = None, limit: int = 300,
) -> list[schemas.CandidateRow]:
    sql, params = _CANDIDATE_SQL, {}
    if agent_id:
        sql += " AND c.assigned_agent_id = :agent"
        params["agent"] = agent_id
    if min_dpd is not None:
        sql += " AND a.dpd >= :dpd"
        params["dpd"] = min_dpd
    if search:
        sql += (f" AND ({NAME} ILIKE :q OR c.customer_code ILIKE :q "
                "OR a.account_code ILIKE :q OR ba.ban ILIKE :q)")
        params["q"] = f"%{search}%"
    sql += f" ORDER BY a.dpd DESC, a.outstanding DESC LIMIT {int(limit)}"

    types = {t["code"]: t for t in (await db.execute(text(
        "SELECT code, name, default_queue FROM collection.case_type"))).mappings().all()}

    out: list[schemas.CandidateRow] = []
    for r in (await db.execute(text(sql), params)).mappings().all():
        hit = _classify(r)
        if hit is None:
            continue
        code, label, type_code, priority, urgency, detail = hit
        if trigger and trigger != code:
            continue
        t = types.get(type_code, {})
        out.append(schemas.CandidateRow(
            customerId=r["customer_code"], customerName=r["customer_name"],
            customerType=r["customer_type"], companyName=r["company_name"],
            accountId=r["account_id"], accountCode=r["account_code"], ban=r["ban"],
            outstanding=round(_f(r["outstanding"]), 2), dpd=r["dpd"] or 0,
            agingBucket=r["aging_bucket"], riskLevel=r["risk_level"],
            riskScore=_f(r["risk_score"]), creditScore=r["credit_score"],
            agentId=r["assigned_agent_id"], agentName=r["agent_name"],
            lastPaymentOn=r["last_payment_at"].date() if r["last_payment_at"] else None,
            lastContactAt=r["last_contact_at"], strategy=r["strategy_name"],
            triggerCode=code, triggerLabel=label, triggerDetail=detail,
            suggestedType=type_code, suggestedTypeName=t.get("name", type_code),
            suggestedPriority=priority, suggestedQueue=t.get("default_queue"),
            urgency=urgency,
            brokenPtpCode=r["broken_ptp_code"],
            brokenPtpAmount=_f(r["broken_ptp_amount"]) if r["broken_ptp_amount"] else None,
            overduePtpDate=r["overdue_ptp_date"], openDisputes=r["open_disputes"],
        ))
    out.sort(key=lambda x: (-x.urgency, -x.outstanding))
    return out


async def search_customers(db: AsyncSession, q: str, limit: int = 25) -> list[dict]:
    """Any customer, for raising a case by hand — not just those in default."""
    rows = (await db.execute(text(f"""
        SELECT c.customer_code, {PERSON} AS name, co.name AS company_name,
               c.customer_type, c.phone, c.email,
               acc.id AS account_id, acc.account_code,
               COALESCE(acc.outstanding, 0) AS outstanding, COALESCE(acc.dpd, 0) AS dpd,
               COALESCE(rp.risk_band, acc.risk_level, c.risk_level) AS risk_level,
               u.full_name AS owner_name,
               (SELECT count(*) FROM customer_schema.debt_case dc
                 WHERE dc.customer_id = c.id AND dc.status <> 'CLOSED') AS open_cases
        FROM customer_schema.customer c
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        LEFT JOIN administration.app_user u ON u.id = c.assigned_agent_id
        LEFT JOIN LATERAL (
          SELECT a.id, a.account_code, a.outstanding, a.dpd, a.risk_level
          FROM customer_schema.account a WHERE a.customer_id = c.id
          ORDER BY a.outstanding DESC LIMIT 1) acc ON TRUE
        LEFT JOIN customer_schema.risk_profile rp ON rp.account_id = acc.id
        WHERE {PERSON} ILIKE :q OR co.name ILIKE :q OR c.customer_code ILIKE :q
           OR acc.account_code ILIKE :q OR c.phone ILIKE :q OR c.email ILIKE :q
        ORDER BY acc.outstanding DESC NULLS LAST
        LIMIT :n"""), {"q": f"%{q}%", "n": limit})).mappings().all()
    return [{
        "customerId": r["customer_code"], "name": r["name"],
        "companyName": r["company_name"], "customerType": r["customer_type"],
        "phone": r["phone"], "email": r["email"], "accountId": r["account_id"],
        "accountCode": r["account_code"], "outstanding": round(_f(r["outstanding"]), 2),
        "dpd": r["dpd"], "riskLevel": r["risk_level"], "ownerName": r["owner_name"],
        "openCases": r["open_cases"],
    } for r in rows]


async def candidate_summary(db: AsyncSession, agent_id: int | None) -> schemas.CandidateSummary:
    everyone = await candidates(db, limit=1000)
    mine = [c for c in everyone if c.agentId == agent_id] if agent_id else []
    counts: dict[str, dict] = {}
    for c in everyone:
        e = counts.setdefault(c.triggerCode, {"trigger": c.triggerCode, "label": c.triggerLabel,
                                              "count": 0, "value": 0.0})
        e["count"] += 1
        e["value"] = round(e["value"] + c.outstanding, 2)
    return schemas.CandidateSummary(
        total=len(everyone),
        totalValue=round(sum(c.outstanding for c in everyone), 2),
        mine=len(mine),
        byTrigger=sorted(counts.values(), key=lambda x: -x["count"]),
    )


async def bulk_create(db: AsyncSession, req: schemas.BulkCaseRequest, actor: int,
                      actor_role: str | None = None) -> schemas.BulkCaseResult:
    """Raise a case for each candidate, using its own suggested type and priority."""
    pool = {c.accountId: c for c in await candidates(db, limit=1000)}
    created, skipped, cases, messages = 0, 0, [], []

    for account_id in req.accountIds:
        cand = pool.get(account_id)
        if cand is None:
            skipped += 1
            messages.append(f"Account {account_id} is no longer a candidate — skipped.")
            continue
        payload = schemas.CaseCreate(
            customerId=cand.customerId,
            accountId=cand.accountId,
            typeCode=req.overrideType or cand.suggestedType,
            sourceCode="AGENT_MANUAL" if not cand.triggerCode.startswith(("DPD", "BROKEN", "PTP"))
                       else {"BROKEN_PTP": "BROKEN_PTP", "PTP_OVERDUE": "BROKEN_PTP",
                             "DPD_90": "HIGH_DPD", "DPD_60": "HIGH_DPD", "DPD_30": "HIGH_DPD",
                             "DPD_EARLY": "HIGH_DPD"}.get(cand.triggerCode, "AGENT_MANUAL"),
            reason=cand.triggerDetail,
            triggerDetail=f"{cand.triggerLabel}: {cand.triggerDetail}",
            priority=req.overridePriority or cand.suggestedPriority,
            agentId=req.agentId or (actor if req.assignToMe else None),
            notes=req.note,
            duplicateAction="CREATE_NEW",
        )
        try:
            res = await create_case(db, payload, actor, actor_role)
            created += 1
            cases.append({"accountId": account_id, "caseId": res.id,
                          "caseNumber": res.caseNumber, "customer": cand.customerName})
        except HTTPException as e:
            skipped += 1
            messages.append(f"{cand.customerName}: {e.detail}")

    return schemas.BulkCaseResult(created=created, skipped=skipped, cases=cases,
                                  messages=messages)


# ==========================================================================
# Ticketing — board, dynamic grouping, tasks, escalation, bulk
# ==========================================================================
# Every dimension the board can group by, and the SQL that produces its key.
# Adding one here is all it takes for it to appear in the Group By selector.
GROUP_BY = {
    "CUSTOMER":   ("Customer",    "c.customer_code"),
    "COMPANY":    ("Company",     "COALESCE(co.company_code, c.customer_code)"),
    "STATUS":     ("Status",      "m.workflow_state"),
    "CASE_TYPE":  ("Case type",   "dc.case_type_code"),
    "PRIORITY":   ("Priority",    "dc.priority"),
    "RISK":       ("Risk",        "COALESCE(rp.risk_band, acc.risk_level, 'Low')"),
    "COLLECTOR":  ("Collector",   "COALESCE(u.full_name, 'Unassigned')"),
    "QUEUE":      ("Queue",       "COALESCE(m.queue_code, 'None')"),
    "DPD_BUCKET": ("DPD bucket",  "COALESCE(acc.aging_bucket, 'Current')"),
    "PRODUCT":    ("Product",     "COALESCE(acc.product_code, 'Unknown')"),
    "STRATEGY":   ("Strategy",    "COALESCE(s.name, 'Unassigned')"),
    "REGION":     ("Region",      "COALESCE(c.region_code, 'Unknown')"),
    "BRANCH":     ("Branch",      "COALESCE(b.name, 'None')"),
    "PORTFOLIO":  ("Portfolio",   "COALESCE(c.segment_code, 'Unknown')"),
    "ASSIGNMENT": ("Assignment",  "CASE WHEN dc.assigned_agent_id IS NULL "
                                  "THEN 'Unassigned' ELSE 'Assigned' END"),
    "SOURCE":     ("Source",      "m.source_code"),
    "PTP":        ("Promise",     "CASE WHEN EXISTS (SELECT 1 FROM customer_schema.ptp p "
                                  "WHERE p.customer_id = c.id AND p.status = 'PENDING') "
                                  "THEN 'Has open promise' WHEN EXISTS (SELECT 1 FROM customer_schema.ptp p "
                                  "WHERE p.customer_id = c.id AND p.status = 'BROKEN') "
                                  "THEN 'Has broken promise' ELSE 'No promise' END"),
    "DISPUTE":    ("Dispute",     "CASE WHEN EXISTS (SELECT 1 FROM customer_schema.dispute d "
                                  "WHERE d.customer_id = c.id AND d.status NOT IN "
                                  "('RESOLVED','REJECTED')) THEN 'Has open dispute' ELSE 'No dispute' END"),
    "LEGAL":      ("Legal matter",       "CASE WHEN EXISTS (SELECT 1 FROM recovery_schema.legal_case l "
                                  "WHERE l.customer_id = c.id AND l.status = 'OPEN') "
                                  "THEN 'Has legal matter' ELSE 'No legal matter' END"),
    "AGENCY":     ("Agency placement",      "CASE WHEN EXISTS (SELECT 1 FROM recovery_schema.placement pl "
                                  "WHERE pl.customer_id = c.id AND pl.status IN ('ACTIVE','LEGAL')) "
                                  "THEN 'Placed with agency' ELSE 'Not placed' END"),
    "SKIP_TRACE": ("Skip trace",  "CASE WHEN EXISTS (SELECT 1 FROM collection.case_tag t "
                                  "WHERE t.case_id = dc.id AND t.tag_code = 'SKIP_TRACE') "
                                  "THEN 'Skip trace' ELSE 'Traceable' END"),
    "NONE":       ("Ungrouped",   "'All tickets'"),
}

# Where the grouping key is a code, the column is headed by something a person
# reads instead: a customer column says "Emily Carter", not "CUST-CON-116".
GROUP_LABEL = {
    "CUSTOMER":  PERSON,
    "COMPANY":   "COALESCE(co.name, c.full_name, c.customer_code)",
    "STATUS":    "COALESCE(ws.name, m.workflow_state)",
}

SORT_BY = {
    "PRIORITY": "CASE dc.priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 "
                "WHEN 'Medium' THEN 2 ELSE 3 END, dc.sla_deadline NULLS LAST",
    "RISK": "COALESCE(rp.overall_risk_score, acc.risk_score, 0) DESC",
    "OUTSTANDING": "COALESCE(acc.outstanding, 0) DESC",
    "DPD": "dc.dpd DESC",
    "CREATED": "dc.opened_at DESC",
    "MODIFIED": "dc.updated_at DESC",
    "COLLECTOR": "u.full_name NULLS LAST",
    "FOLLOW_UP": "m.due_date NULLS LAST",
    "CUSTOMER": "customer_name_sort",
    "SLA": "dc.sla_deadline NULLS LAST",
}

_TICKET_SQL = f"""
SELECT dc.id, dc.case_code, dc.case_type_code, dc.priority, dc.amount, dc.dpd,
       dc.assigned_agent_id, dc.opened_at, dc.sla_deadline, dc.status,
       m.workflow_state, m.queue_code, m.source_code, m.due_date, m.sla_paused_at,
       ws.category AS state_category,
       c.customer_code, {PERSON} AS customer_name, co.name AS company_name,
       c.customer_type, c.region_code, c.segment_code,
       acc.account_code, COALESCE(acc.outstanding, 0) AS outstanding,
       acc.aging_bucket, acc.product_code,
       COALESCE(rp.overall_risk_score, acc.risk_score, 0) AS risk_score,
       COALESCE(rp.risk_band, acc.risk_level, 'Low')      AS risk_level,
       u.full_name AS agent_name, s.name AS strategy_name,
       q.name AS queue_name, ct.name AS type_name, b.name AS branch_name,
       (SELECT count(*) FROM customer_schema.case_activity ca WHERE ca.case_id = dc.id) AS activity_n,
       (SELECT count(*) FROM collection.case_note n WHERE n.case_id = dc.id) AS note_n,
       (SELECT count(*) FROM collection.case_attachment a WHERE a.case_id = dc.id) AS attach_n,
       (SELECT count(*) FROM collection.case_task t
         WHERE t.case_id = dc.id AND t.status = 'OPEN') AS task_n,
       (SELECT min(t.due_date) FROM collection.case_task t
         WHERE t.case_id = dc.id AND t.status = 'OPEN') AS next_follow_up,
       (SELECT array_agg(t.tag_code) FROM collection.case_tag t WHERE t.case_id = dc.id) AS tags,
       EXISTS (SELECT 1 FROM customer_schema.ptp p
                WHERE p.customer_id = c.id AND p.status = 'PENDING')  AS has_ptp,
       EXISTS (SELECT 1 FROM customer_schema.ptp p
                WHERE p.customer_id = c.id AND p.status = 'BROKEN')   AS ptp_broken,
       EXISTS (SELECT 1 FROM customer_schema.dispute d
                WHERE d.customer_id = c.id
                  AND d.status NOT IN ('RESOLVED','REJECTED'))        AS has_dispute,
       EXISTS (SELECT 1 FROM collection.case_escalation e
                WHERE e.case_id = dc.id AND e.status = 'OPEN')        AS escalated,
       EXISTS (SELECT 1 FROM recovery_schema.legal_case l
                WHERE l.customer_id = c.id AND l.status = 'OPEN')     AS in_legal,
       EXISTS (SELECT 1 FROM recovery_schema.placement pl
                WHERE pl.customer_id = c.id AND pl.status IN ('ACTIVE','LEGAL')) AS in_agency
       /*GROUP_KEY*/
FROM customer_schema.debt_case dc
LEFT JOIN collection.case_meta m ON m.case_id = dc.id
JOIN customer_schema.customer c ON c.id = dc.customer_id
LEFT JOIN customer_schema.company co ON co.id = c.company_id
LEFT JOIN customer_schema.account acc ON acc.id = dc.account_id
LEFT JOIN customer_schema.risk_profile rp ON rp.account_id = acc.id
LEFT JOIN customer_schema.company_branch b ON b.id = acc.branch_id
LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
LEFT JOIN public.strategy s ON s.id = m.strategy_id
LEFT JOIN collection.case_queue q ON q.code = m.queue_code
LEFT JOIN collection.case_type ct ON ct.code = dc.case_type_code
LEFT JOIN collection.workflow_state ws
       ON ws.workflow_code = COALESCE(m.workflow_code, 'STANDARD') AND ws.code = m.workflow_state
"""


def _sla_colour(r) -> tuple[str, float | None, bool]:
    """Traffic light, hours remaining, and whether it has already breached."""
    if r["status"] == "CLOSED":
        return "DONE", None, False
    if r["sla_paused_at"]:
        return "PAUSED", None, False
    if not r["sla_deadline"]:
        return "GREEN", None, False
    hours = (r["sla_deadline"] - dt.datetime.now(dt.timezone.utc)).total_seconds() / 3600
    if hours < 0:
        return "RED", round(hours, 1), True
    if hours <= 4:
        return "AMBER", round(hours, 1), False
    return "GREEN", round(hours, 1), False


def _card(r, watched: set[int]) -> schemas.TicketCard:
    colour, hours, breached = _sla_colour(r)
    return schemas.TicketCard(
        id=r["id"], caseNumber=r["case_code"], customerId=r["customer_code"],
        customerName=r["customer_name"], companyName=r["company_name"],
        customerType=r["customer_type"],
        accountCode=r["account_code"], outstanding=round(_f(r["outstanding"]), 2),
        amount=round(_f(r["amount"]), 2), dpd=r["dpd"], dpdBucket=r["aging_bucket"],
        priority=r["priority"], riskLevel=r["risk_level"], riskScore=_f(r["risk_score"]),
        type=r["case_type_code"], typeName=r["type_name"],
        source=r["source_code"] or "SYSTEM_WORKFLOW",
        workflowState=r["workflow_state"] or "NEW", stateCategory=r["state_category"],
        queueCode=r["queue_code"], queueName=r["queue_name"],
        agentId=r["assigned_agent_id"], agentName=r["agent_name"],
        strategy=r["strategy_name"], region=r["region_code"], branch=r["branch_name"],
        product=r["product_code"], openedAt=r["opened_at"], dueDate=r["due_date"],
        slaDeadline=r["sla_deadline"], slaBreached=breached,
        slaPaused=r["sla_paused_at"] is not None, hoursToSla=hours, slaColour=colour,
        nextFollowUp=r["next_follow_up"], hasPtp=r["has_ptp"], ptpBroken=r["ptp_broken"],
        hasDispute=r["has_dispute"], isEscalated=r["escalated"], inLegal=r["in_legal"],
        inAgency=r["in_agency"], isWatched=r["id"] in watched,
        activityCount=r["activity_n"], noteCount=r["note_n"],
        attachmentCount=r["attach_n"], taskCount=r["task_n"],
        tags=list(r["tags"] or []),
    )


def _ticket_filters(f: dict) -> tuple[list[str], dict]:
    """The advanced filter bar, compiled once and shared by board and list."""
    where, params = ["m.merged_into_case_id IS NULL"], {}
    simple = {
        "state": "m.workflow_state = :state", "queue": "m.queue_code = :queue",
        "source": "m.source_code = :source", "typeCode": "dc.case_type_code = :typeCode",
        "priority": "dc.priority = :priority", "agentId": "dc.assigned_agent_id = :agentId",
        "region": "c.region_code = :region", "product": "acc.product_code = :product",
        "portfolio": "c.segment_code = :portfolio",
        "risk": "COALESCE(rp.risk_band, acc.risk_level) = :risk",
        "bucket": "acc.aging_bucket = :bucket",
    }
    for key, clause in simple.items():
        if f.get(key) is not None:
            where.append(clause)
            params[key] = f[key]
    if f.get("category") == "OPEN":
        where.append("dc.status <> 'CLOSED'")
    elif f.get("category"):
        where.append("ws.category = :category")
        params["category"] = f["category"]
    if f.get("unassigned"):
        where.append("dc.assigned_agent_id IS NULL")
    if f.get("breached"):
        where.append("dc.status <> 'CLOSED' AND dc.sla_deadline < now() "
                     "AND m.sla_paused_at IS NULL")
    if f.get("hasPtp"):
        where.append("EXISTS (SELECT 1 FROM customer_schema.ptp p "
                     "WHERE p.customer_id = c.id AND p.status = 'PENDING')")
    if f.get("hasDispute"):
        where.append("EXISTS (SELECT 1 FROM customer_schema.dispute d "
                     "WHERE d.customer_id = c.id AND d.status NOT IN ('RESOLVED','REJECTED'))")
    if f.get("inLegal"):
        where.append("EXISTS (SELECT 1 FROM recovery_schema.legal_case l "
                     "WHERE l.customer_id = c.id AND l.status = 'OPEN')")
    if f.get("inAgency"):
        where.append("EXISTS (SELECT 1 FROM recovery_schema.placement pl "
                     "WHERE pl.customer_id = c.id AND pl.status IN ('ACTIVE','LEGAL'))")
    if f.get("minOutstanding") is not None:
        where.append("COALESCE(acc.outstanding, 0) >= :minOut")
        params["minOut"] = f["minOutstanding"]
    if f.get("minDpd") is not None:
        where.append("dc.dpd >= :minDpd")
        params["minDpd"] = f["minDpd"]
    if f.get("tags"):
        where.append("EXISTS (SELECT 1 FROM collection.case_tag t "
                     "WHERE t.case_id = dc.id AND t.tag_code = ANY(:tags))")
        params["tags"] = f["tags"]
    if f.get("createdFrom"):
        where.append("dc.opened_at >= :createdFrom")
        params["createdFrom"] = f["createdFrom"]
    if f.get("createdTo"):
        where.append("dc.opened_at <= :createdTo")
        params["createdTo"] = f["createdTo"]
    if f.get("search"):
        # Global search spans the customer record, not just the case.
        where.append(f"""({NAME} ILIKE :q OR dc.case_code ILIKE :q OR dc.summary ILIKE :q
            OR c.customer_code ILIKE :q OR acc.account_code ILIKE :q
            OR c.phone ILIKE :q OR c.email ILIKE :q OR c.msisdn ILIKE :q OR c.ban ILIKE :q
            OR EXISTS (SELECT 1 FROM customer_schema.ptp p
                        WHERE p.customer_id = c.id AND p.ptp_code ILIKE :q)
            OR EXISTS (SELECT 1 FROM customer_schema.dispute d
                        WHERE d.customer_id = c.id AND d.dispute_code ILIKE :q))""")
        params["q"] = f"%{f['search']}%"
    return where, params


async def board(db: AsyncSession, actor: int, *, group_by: str = "STATUS",
                sort_by: str = "PRIORITY", limit: int = 500, **f) -> schemas.BoardResponse:
    """Every ticket, bucketed by whichever dimension is being grouped on."""
    group_by = group_by.upper()
    if group_by not in GROUP_BY:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot group by {group_by}")
    label, expr = GROUP_BY[group_by]
    where, params = _ticket_filters(f)
    order = SORT_BY.get(sort_by.upper(), SORT_BY["PRIORITY"])

    label_expr = GROUP_LABEL.get(group_by, expr)
    sql = (_TICKET_SQL.replace(
               "/*GROUP_KEY*/",
               f", {expr} AS group_key, {label_expr} AS group_label, "
               f"{NAME} AS customer_name_sort")
           + f" WHERE {' AND '.join(where)} ORDER BY {order} LIMIT {int(limit)}")
    rows = (await db.execute(text(sql), params)).mappings().all()

    watched = {r[0] for r in (await db.execute(text(
        "SELECT case_id FROM collection.case_watcher WHERE user_id = :u"), {"u": actor})).all()}

    # Board columns follow the configured workflow order when grouping by
    # status, so the board reads left to right like the lifecycle.
    order_hint: dict[str, int] = {}
    colours: dict[str, str] = {}
    labels: dict[str, str] = {}
    if group_by == "STATUS":
        for s in (await db.execute(text("""
            SELECT code, name, colour, sort_order FROM collection.workflow_state
            WHERE workflow_code = 'STANDARD' ORDER BY sort_order"""))).mappings().all():
            order_hint[s["code"]] = s["sort_order"]
            colours[s["code"]] = s["colour"] or "muted"
            labels[s["code"]] = s["name"]

    buckets: dict[str, list] = {}
    for r in rows:
        key = str(r["group_key"] or "—")
        buckets.setdefault(key, []).append(r)
        labels.setdefault(key, str(r["group_label"] or key))

    if group_by == "STATUS":
        # Show the whole lifecycle, so an empty column reads as "nothing here"
        # rather than the status having quietly disappeared.
        for code in order_hint:
            buckets.setdefault(code, [])

    columns = [
        schemas.BoardColumn(
            key=k, label=labels.get(k, k), colour=colours.get(k),
            count=len(v), value=round(sum(_f(x["amount"]) for x in v), 2),
            cards=[_card(x, watched) for x in v])
        for k, v in buckets.items()
    ]
    columns.sort(key=lambda c: (order_hint.get(c.key, 999), -c.count))

    # Customer and company groupings carry a summary header card.
    groups: list[schemas.CustomerGroup] = []
    if group_by == "COMPANY":
        for col in columns:
            first = col.cards[0]
            # Everything the company owns, across every subscriber under it.
            extra = (await db.execute(text("""
                WITH members AS (
                    SELECT c.id
                    FROM customer_schema.customer c
                    LEFT JOIN customer_schema.company co ON co.id = c.company_id
                    WHERE COALESCE(co.company_code, c.customer_code) = :key
                )
                SELECT (SELECT count(*) FROM members)                                AS people,
                       (SELECT count(*) FROM customer_schema.account a
                         WHERE a.customer_id IN (SELECT id FROM members))            AS accounts,
                       (SELECT COALESCE(sum(a.outstanding), 0) FROM customer_schema.account a
                         WHERE a.customer_id IN (SELECT id FROM members))            AS exposure,
                       (SELECT count(*) FROM customer_schema.ptp p
                         WHERE p.customer_id IN (SELECT id FROM members)
                           AND p.status = 'PENDING')                                AS ptps,
                       (SELECT count(*) FROM customer_schema.dispute d
                         WHERE d.customer_id IN (SELECT id FROM members)
                           AND d.status NOT IN ('RESOLVED','REJECTED'))              AS disputes
                """),
                {"key": col.key})).mappings().first() or {}
            worst = min(col.cards, key=lambda x: ["Critical", "High", "Medium", "Low"]
                        .index(x.priority) if x.priority in
                        ["Critical", "High", "Medium", "Low"] else 9).priority
            # The header names the company; the tickets underneath name the people.
            display = first.companyName or first.customerName
            groups.append(schemas.CustomerGroup(
                key=col.key, customerId=col.key, customerName=display,
                customerType=first.customerType,
                totalOutstanding=round(sum(x.outstanding for x in col.cards), 2),
                accounts=int(extra.get("accounts") or 0),
                people=int(extra.get("people") or 0),
                cases=len(col.cards),
                openPtps=int(extra.get("ptps") or 0),
                disputes=int(extra.get("disputes") or 0),
                totalExposure=round(_f(extra.get("exposure")), 2),
                worstPriority=worst, riskLevel=first.riskLevel,
                agentName=next((x.agentName for x in col.cards if x.agentName), None),
                unassigned=sum(1 for x in col.cards if not x.agentId),
                breached=sum(1 for x in col.cards if x.slaBreached),
                tickets=col.cards))
        groups.sort(key=lambda g: (["Critical", "High", "Medium", "Low"].index(g.worstPriority)
                                   if g.worstPriority in ["Critical", "High", "Medium", "Low"] else 9,
                                   -g.breached, -g.totalExposure))
    elif group_by == "CUSTOMER":
        for col in columns:
            first = col.cards[0]
            extra = (await db.execute(text("""
                SELECT (SELECT count(*) FROM customer_schema.account a
                         WHERE a.customer_id = c.id) AS accounts,
                       (SELECT COALESCE(sum(a.outstanding), 0) FROM customer_schema.account a
                         WHERE a.customer_id = c.id) AS exposure,
                       (SELECT count(*) FROM customer_schema.ptp p
                         WHERE p.customer_id = c.id AND p.status = 'PENDING') AS ptps,
                       (SELECT count(*) FROM customer_schema.dispute d
                         WHERE d.customer_id = c.id
                           AND d.status NOT IN ('RESOLVED','REJECTED')) AS disputes
                FROM customer_schema.customer c WHERE c.customer_code = :code"""),
                {"code": first.customerId})).mappings().one()
            worst = min(col.cards, key=lambda x: ["Critical", "High", "Medium", "Low"]
                        .index(x.priority) if x.priority in
                        ["Critical", "High", "Medium", "Low"] else 9).priority
            groups.append(schemas.CustomerGroup(
                key=col.key, customerId=first.customerId, customerName=first.customerName,
                customerType=first.customerType,
                totalOutstanding=max(x.outstanding for x in col.cards),
                accounts=extra["accounts"], cases=len(col.cards),
                openPtps=extra["ptps"], disputes=extra["disputes"],
                totalExposure=round(_f(extra["exposure"]), 2), worstPriority=worst,
                riskLevel=first.riskLevel,
                agentName=next((x.agentName for x in col.cards if x.agentName), None),
                unassigned=sum(1 for x in col.cards if not x.agentId),
                breached=sum(1 for x in col.cards if x.slaBreached),
                tickets=col.cards))
        groups.sort(key=lambda g: (["Critical", "High", "Medium", "Low"].index(g.worstPriority)
                                   if g.worstPriority in ["Critical", "High", "Medium", "Low"] else 9,
                                   -g.breached, -g.totalOutstanding))

    return schemas.BoardResponse(
        groupBy=group_by, columns=columns, customerGroups=groups,
        total=len(rows), totalValue=round(sum(_f(r["amount"]) for r in rows), 2))


async def group_options(db: AsyncSession) -> list[dict]:
    return [{"key": k, "label": v[0]} for k, v in GROUP_BY.items()]


# --------------------------------------------------------------------------
# Tasks — the day-by-day follow-up diary
# --------------------------------------------------------------------------
_TASK_SQL = f"""
SELECT t.*, dc.case_code, {NAME} AS customer_name, c.customer_code,
       u.full_name AS assigned_name,
       COALESCE(acc.outstanding, 0) AS outstanding, COALESCE(acc.dpd, 0) AS dpd
FROM collection.case_task t
JOIN customer_schema.customer c ON c.id = t.customer_id
LEFT JOIN customer_schema.company co ON co.id = c.company_id
LEFT JOIN customer_schema.debt_case dc ON dc.id = t.case_id
LEFT JOIN customer_schema.account acc ON acc.id = dc.account_id
LEFT JOIN administration.app_user u ON u.id = t.assigned_to
"""


def _task_row(r) -> schemas.TaskRow:
    return schemas.TaskRow(
        id=r["id"], caseId=r["case_id"], caseNumber=r["case_code"],
        customerId=r["customer_code"], customerName=r["customer_name"],
        title=r["title"], detail=r["detail"], taskType=r["task_type"],
        dueDate=r["due_date"], dueTime=r["due_time"], assignedTo=r["assigned_to"],
        assignedToName=r["assigned_name"], status=r["status"], priority=r["priority"],
        outcome=r["outcome"], completedAt=r["completed_at"],
        outstanding=round(_f(r["outstanding"]), 2), dpd=r["dpd"],
        overdue=bool(r["status"] == "OPEN" and r["due_date"] < dt.date.today()))


async def task_board(db: AsyncSession, *, agent_id: int | None = None,
                     task_type: str | None = None, include_done: bool = False,
                     days_ahead: int = 30) -> schemas.TaskBoard:
    """Follow-ups laid out day by day, the way a collector plans their week."""
    where, params = ["t.due_date <= CURRENT_DATE + CAST(:ahead AS int)"], {"ahead": days_ahead}
    if agent_id:
        where.append("t.assigned_to = :agent")
        params["agent"] = agent_id
    if task_type:
        where.append("t.task_type = :ttype")
        params["ttype"] = task_type
    if not include_done:
        where.append("t.status = 'OPEN'")
    rows = (await db.execute(text(
        f"{_TASK_SQL} WHERE {' AND '.join(where)} "
        "ORDER BY t.due_date, t.due_time NULLS LAST, "
        "CASE t.priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 "
        "WHEN 'Medium' THEN 2 ELSE 3 END"), params)).mappings().all()

    today = dt.date.today()
    by_day: dict[dt.date, list] = {}
    for r in rows:
        by_day.setdefault(r["due_date"], []).append(r)

    def describe(d: dt.date) -> tuple[str, str]:
        delta = (d - today).days
        if delta < 0:
            return f"Overdue · {d:%a %d %b}", f"{-delta}d overdue"
        if delta == 0:
            return f"Today · {d:%a %d %b}", "today"
        if delta == 1:
            return f"Tomorrow · {d:%a %d %b}", "tomorrow"
        if delta <= 7:
            return f"{d:%A} · {d:%d %b}", f"in {delta}d"
        return f"{d:%a %d %b %Y}", f"in {delta}d"

    days = []
    for d in sorted(by_day):
        label, rel = describe(d)
        items = by_day[d]
        days.append(schemas.TaskDay(
            date=d, label=label, relative=rel, isToday=d == today, isOverdue=d < today,
            total=len(items), open=sum(1 for x in items if x["status"] == "OPEN"),
            value=round(sum(_f(x["outstanding"]) for x in items), 2),
            tasks=[_task_row(x) for x in items]))

    counts = (await db.execute(text(f"""
        SELECT count(*) FILTER (WHERE t.due_date < CURRENT_DATE) AS overdue,
               count(*) FILTER (WHERE t.due_date = CURRENT_DATE) AS today,
               count(*) FILTER (WHERE t.due_date = CURRENT_DATE + 1) AS tomorrow,
               count(*) FILTER (WHERE t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS week,
               count(*) AS total
        FROM collection.case_task t
        WHERE t.status = 'OPEN' {'AND t.assigned_to = :agent' if agent_id else ''}"""),
        {"agent": agent_id} if agent_id else {})).mappings().one()
    by_type = (await db.execute(text(f"""
        SELECT t.task_type AS key, count(*) AS n FROM collection.case_task t
        WHERE t.status = 'OPEN' {'AND t.assigned_to = :agent' if agent_id else ''}
        GROUP BY 1 ORDER BY 2 DESC"""),
        {"agent": agent_id} if agent_id else {})).mappings().all()

    return schemas.TaskBoard(
        days=days, totalOpen=counts["total"], overdue=counts["overdue"],
        today=counts["today"], tomorrow=counts["tomorrow"], thisWeek=counts["week"],
        byType=[{"type": r["key"], "count": r["n"]} for r in by_type])


async def create_task(db: AsyncSession, p: schemas.TaskCreate, actor: int) -> int:
    cid = None
    if p.caseId:
        cid = (await db.execute(text(
            "SELECT customer_id FROM customer_schema.debt_case WHERE id = :i"),
            {"i": p.caseId})).scalar_one_or_none()
    if cid is None and p.customerId:
        cid = await _customer_id(db, p.customerId)
    if cid is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "A task needs either a case or a customer.")
    tid = (await db.execute(text("""
        INSERT INTO collection.case_task
          (case_id, customer_id, title, detail, task_type, due_date, due_time,
           assigned_to, priority, created_by)
        VALUES (:case,:cu,:t,:d,:ty,:due,:time,:ag,:pri,:by) RETURNING id"""),
        dict(case=p.caseId, cu=cid, t=p.title, d=p.detail, ty=p.taskType, due=p.dueDate,
             time=p.dueTime, ag=p.assignedTo or actor, pri=p.priority, by=actor))).scalar_one()
    if p.caseId:
        await _audit(db, p.caseId, "TASK_CREATED", actor, new=f"{p.taskType}: {p.title}",
                     reason=f"Due {p.dueDate:%d %b %Y}")
        await _activity(db, p.caseId, cid, actor, f"Task scheduled: {p.title}",
                        activity_type="NOTE", body=p.detail,
                        outcome=f"Due {p.dueDate:%d %b %Y}")
    await db.commit()
    return tid


async def patch_task(db: AsyncSession, task_id: int, p: schemas.TaskPatch, actor: int) -> None:
    cur = (await db.execute(text(
        "SELECT case_id, customer_id, title, status FROM collection.case_task WHERE id = :i"),
        {"i": task_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    sets, params = [], {"i": task_id}
    if p.status and p.status != cur["status"]:
        sets.append("status = :st")
        params["st"] = p.status
        if p.status == "DONE":
            sets += ["completed_at = now()", "completed_by = :actor"]
            params["actor"] = actor
        else:
            sets += ["completed_at = NULL", "completed_by = NULL"]
    for field, col in [("outcome", "outcome"), ("dueDate", "due_date"),
                       ("assignedTo", "assigned_to"), ("priority", "priority")]:
        v = getattr(p, field)
        if v is not None:
            sets.append(f"{col} = :{field}")
            params[field] = v
    if not sets:
        return
    await db.execute(text(
        f"UPDATE collection.case_task SET {', '.join(sets)}, updated_at = now() WHERE id = :i"),
        params)
    if cur["case_id"] and p.status:
        await _activity(db, cur["case_id"], cur["customer_id"], actor,
                        f"Task {p.status.lower()}: {cur['title']}",
                        activity_type="NOTE", body=p.outcome)
    await db.commit()


# --------------------------------------------------------------------------
# Escalation
# --------------------------------------------------------------------------
# Where each escalation target sends the case, so routing is data not code.
# Escalating moves the case to the queue that owns the work. The status stays
# In Progress — escalation is recorded on case_escalation and shown by the
# queue, rather than fragmenting the status vocabulary.
ESCALATION_ROUTES = {
    "LEGAL": ("IN_PROGRESS", "LEGAL"),
    "RECOVERY_AGENCY": ("IN_PROGRESS", "AGENCY"),
    "SUPERVISOR": ("IN_PROGRESS", None),
    "FRAUD_TEAM": ("IN_PROGRESS", None),
    "INVESTIGATION": ("IN_PROGRESS", None),
    "COLLECTIONS_MANAGER": ("IN_PROGRESS", None),
    "RISK_TEAM": ("IN_PROGRESS", "HIGH_RISK"),
    "COMPLIANCE": ("IN_PROGRESS", None),
}


async def escalate(db: AsyncSession, case_id: int, p: schemas.EscalationRequest,
                   actor: int, perms: dict, actor_role: str | None = None) -> None:
    """Escalate a case, and land it in the queue that owns that kind of work."""
    if p.escalateTo not in ESCALATION_ROUTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown target {p.escalateTo}")
    if not perms.get("caseEscalate", {}).get("edit"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Escalating requires caseEscalate.")
    cur = (await db.execute(text("""
        SELECT dc.customer_id, dc.account_id, dc.amount, m.workflow_state, m.queue_code
        FROM customer_schema.debt_case dc
        LEFT JOIN collection.case_meta m ON m.case_id = dc.id WHERE dc.id = :i"""),
        {"i": case_id})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    to_state, to_queue = ESCALATION_ROUTES[p.escalateTo]
    to_queue = p.queueCode or to_queue or cur["queue_code"]

    legal_id = placement_id = None
    # Legal and agency escalations create the real record in the system that
    # owns them, so the case shows up on those dashboards rather than being a
    # status change that means nothing downstream.
    if p.escalateTo == "LEGAL":
        code = (await db.execute(text("""
            SELECT 'LC-' || (COALESCE(MAX(SUBSTRING(case_code FROM 4)::int), 2026000) + 1)::text
            FROM recovery_schema.legal_case"""))).scalar_one()
        legal_id = (await db.execute(text("""
            INSERT INTO recovery_schema.legal_case
              (case_code, customer_id, claim_amount, stage, status, notes)
            VALUES (:code,:cu,:amt,'Pre-Legal','OPEN',:note) RETURNING id"""),
            dict(code=code, cu=cur["customer_id"], amt=_f(cur["amount"]) or 1,
                 note=f"Escalated from case management. {p.reason}"))).scalar_one()

    await db.execute(text("""
        INSERT INTO collection.case_escalation
          (case_id, escalate_to, reason, from_state, to_state, from_queue, to_queue,
           raised_by, assigned_to, legal_case_id, placement_id)
        VALUES (:i,:to,:reason,:fs,:ts,:fq,:tq,:by,:assign,:legal,:place)"""),
        dict(i=case_id, to=p.escalateTo, reason=p.reason, fs=cur["workflow_state"],
             ts=to_state, fq=cur["queue_code"], tq=to_queue, by=actor,
             assign=p.assignedTo, legal=legal_id, place=placement_id))

    await db.execute(text("""
        UPDATE collection.case_meta SET workflow_state = :st, queue_code = :q, updated_at = now()
        WHERE case_id = :i"""), {"st": to_state, "q": to_queue, "i": case_id})
    await db.execute(text("""
        UPDATE customer_schema.debt_case
        SET status = :legacy, assigned_agent_id = COALESCE(:assign, assigned_agent_id),
            updated_at = now(), updated_by = :by
        WHERE id = :i"""),
        {"legacy": _LEGACY_STATUS.get(to_state, "ESCALATED"), "assign": p.assignedTo,
         "by": actor, "i": case_id})

    await _audit(db, case_id, "CASE_ESCALATED", actor, field="escalated_to",
                 old=cur["workflow_state"], new=p.escalateTo, role=actor_role, reason=p.reason)
    await _activity(db, case_id, cur["customer_id"], actor,
                    f"Escalated to {p.escalateTo.replace('_', ' ').title()}",
                    activity_type="ESCALATION", body=p.reason,
                    outcome=f"Now in {to_queue or 'no'} queue", account_id=cur["account_id"])

    # Tell the people who care.
    watchers = [r[0] for r in (await db.execute(text(
        "SELECT user_id FROM collection.case_watcher WHERE case_id = :i"), {"i": case_id})).all()]
    for uid in set(watchers + ([p.assignedTo] if p.assignedTo else [])):
        await db.execute(text("""
            INSERT INTO collection.case_notification
              (user_id, case_id, event, title, detail, actor_id)
            VALUES (:u,:i,'ESCALATION',:t,:d,:a)"""),
            dict(u=uid, i=case_id, t=f"Case escalated to {p.escalateTo}", d=p.reason, a=actor))
    await db.commit()


async def escalations(db: AsyncSession, target: str | None = None,
                      status_f: str | None = None, agent_id: int | None = None
                      ) -> list[schemas.EscalationRow]:
    where, params = ["TRUE"], {}
    if agent_id:
        where.append("(dc.assigned_agent_id = :agent OR e.raised_by = :agent "
                     "OR e.assigned_to = :agent)")
        params["agent"] = agent_id
    if target:
        where.append("e.escalate_to = :t")
        params["t"] = target
    if status_f:
        where.append("e.status = :s")
        params["s"] = status_f
    rows = (await db.execute(text(f"""
        SELECT e.*, dc.case_code, {NAME} AS customer_name,
               r.full_name AS raised_name, a.full_name AS assigned_name
        FROM collection.case_escalation e
        JOIN customer_schema.debt_case dc ON dc.id = e.case_id
        JOIN customer_schema.customer c ON c.id = dc.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        LEFT JOIN administration.app_user r ON r.id = e.raised_by
        LEFT JOIN administration.app_user a ON a.id = e.assigned_to
        WHERE {' AND '.join(where)} ORDER BY e.raised_at DESC LIMIT 200"""),
        params)).mappings().all()
    return [schemas.EscalationRow(
        id=r["id"], caseId=r["case_id"], caseNumber=r["case_code"],
        customerName=r["customer_name"], escalateTo=r["escalate_to"], reason=r["reason"],
        fromState=r["from_state"], toState=r["to_state"], raisedByName=r["raised_name"],
        assignedToName=r["assigned_name"], status=r["status"], raisedAt=r["raised_at"],
        resolvedAt=r["resolved_at"]) for r in rows]


# --------------------------------------------------------------------------
# Bulk operations, tags, watchers, counters
# --------------------------------------------------------------------------
async def bulk(db: AsyncSession, req: schemas.BulkRequest, actor: int, perms: dict,
               actor_role: str | None = None) -> schemas.BulkResult:
    ok, failed, messages = 0, 0, []
    for case_id in req.caseIds:
        try:
            if req.action == "ASSIGN":
                await assign(db, case_id, schemas.AssignRequest(
                    agentId=req.agentId, queueCode=req.queueCode,
                    reason=req.reason or "Bulk assignment"), actor, actor_role)
            elif req.action == "QUEUE":
                await assign(db, case_id, schemas.AssignRequest(
                    queueCode=req.queueCode, assignmentType="QUEUE",
                    reason=req.reason or "Bulk queue change"), actor, actor_role)
            elif req.action == "STATUS":
                await transition(db, case_id, schemas.TransitionRequest(
                    toState=req.toState, note=req.reason or "Bulk status change"),
                    actor, perms, actor_role)
            elif req.action == "CLOSE":
                await transition(db, case_id, schemas.TransitionRequest(
                    toState="CLOSED", note=req.reason or "Bulk close",
                    resolution=req.reason or "Closed in bulk"), actor, perms, actor_role)
            elif req.action == "PRIORITY":
                await patch_case(db, case_id, schemas.CasePatch(priority=req.priority),
                                 actor, actor_role)
            elif req.action == "ESCALATE":
                await escalate(db, case_id, schemas.EscalationRequest(
                    escalateTo=req.escalateTo or "SUPERVISOR",
                    reason=req.reason or "Bulk escalation", assignedTo=req.agentId),
                    actor, perms, actor_role)
            elif req.action == "TAG":
                for tag in req.tags:
                    await db.execute(text("""
                        INSERT INTO collection.case_tag (case_id, tag_code, tagged_by)
                        VALUES (:i,:t,:u) ON CONFLICT DO NOTHING"""),
                        {"i": case_id, "t": tag, "u": actor})
                await _audit(db, case_id, "TAGGED", actor, new=", ".join(req.tags),
                             role=actor_role)
                await db.commit()
            elif req.action == "FOLLOW_UP":
                await db.execute(text(
                    "UPDATE collection.case_meta SET due_date = :d, updated_at = now() "
                    "WHERE case_id = :i"), {"d": req.followUpDate, "i": case_id})
                await _audit(db, case_id, "FOLLOW_UP_SET", actor,
                             new=str(req.followUpDate), role=actor_role)
                await db.commit()
            else:
                raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                    f"Unknown bulk action {req.action}")
            ok += 1
        except HTTPException as e:
            failed += 1
            messages.append(f"Case {case_id}: {e.detail}")
    return schemas.BulkResult(ok=ok, failed=failed, messages=messages)


async def tags(db: AsyncSession) -> list[schemas.TagRow]:
    rows = (await db.execute(text(
        "SELECT * FROM collection.tag WHERE is_active ORDER BY sort_order"))).mappings().all()
    return [schemas.TagRow(code=r["code"], label=r["label"], colour=r["colour"],
                           description=r["description"]) for r in rows]


async def set_tags(db: AsyncSession, case_id: int, codes: list[str], actor: int) -> None:
    await db.execute(text("DELETE FROM collection.case_tag WHERE case_id = :i"), {"i": case_id})
    for c in codes:
        await db.execute(text("""
            INSERT INTO collection.case_tag (case_id, tag_code, tagged_by)
            VALUES (:i,:t,:u) ON CONFLICT DO NOTHING"""), {"i": case_id, "t": c, "u": actor})
    await _audit(db, case_id, "TAGGED", actor, new=", ".join(codes) or "none")
    await db.commit()


async def watch(db: AsyncSession, case_id: int, actor: int, on: bool) -> None:
    if on:
        await db.execute(text("""
            INSERT INTO collection.case_watcher (case_id, user_id) VALUES (:i,:u)
            ON CONFLICT DO NOTHING"""), {"i": case_id, "u": actor})
    else:
        await db.execute(text(
            "DELETE FROM collection.case_watcher WHERE case_id = :i AND user_id = :u"),
            {"i": case_id, "u": actor})
    await db.commit()


async def counters(db: AsyncSession, agent_id: int | None = None) -> schemas.TicketCounters:
    """The workspace's headline counts.

    Case counts come from ``casebook``, the same predicates the Collections
    Dashboard reads, so the two screens cannot report different numbers for
    "open cases" or "past SLA".
    """
    cand = await candidate_summary(db, agent_id)
    scope = " AND dc.assigned_agent_id = :agent" if agent_id else ""
    args = {"agent": agent_id} if agent_id else {}
    r = (await db.execute(text(f"""
        SELECT
          count(*) FILTER (WHERE {casebook.LIVE_CASE})                         AS open_cases,
          count(*) FILTER (WHERE m.workflow_state = 'IN_PROGRESS')             AS in_progress,
          count(*) FILTER (WHERE m.workflow_state = 'PENDING_CUSTOMER')        AS waiting,
          count(*) FILTER (WHERE m.workflow_state IN ('BROKEN_PROMISE'))       AS broken,
          count(*) FILTER (WHERE {casebook.AWAITING_CLOSE})                    AS awaiting_close,
          count(*) FILTER (WHERE {casebook.PAST_SLA})                          AS over_sla,
          count(*) FILTER (WHERE dc.closed_at::date = CURRENT_DATE)            AS resolved_today
        {casebook.CASE_FROM}
        WHERE {casebook.NOT_MERGED}{scope}"""), args)).mappings().one()
    # Promise, dispute and payment counts follow the same desk, through the
    # customers that desk owns.
    owner = ("""
        AND customer_id IN (SELECT id FROM customer_schema.customer
                             WHERE assigned_agent_id = :agent)""" if agent_id else "")
    extra = (await db.execute(text(f"""
        SELECT
          (SELECT count(*) FROM customer_schema.ptp
            WHERE status = 'PENDING' AND promised_date = CURRENT_DATE {owner}) AS ptp_today,
          -- Bounded to the same window as every other promise-keeping figure,
          -- so a broken promise from two years ago stops counting against today.
          (SELECT count(*) FROM customer_schema.ptp t
            WHERE t.status = 'BROKEN' AND {casebook.PROMISE_RECENT}
              {owner.replace("AND customer_id", "AND t.customer_id")})         AS ptp_broken,
          (SELECT count(*) FROM customer_schema.dispute
            WHERE status NOT IN ('RESOLVED','REJECTED') {owner})               AS disputes,
          -- Legal and agency work is held in the recovery registers, not in a
          -- case workflow state: a case can be closed while the legal case runs
          -- on. Reading the registers is what makes this agree with the
          -- Legal and Agency Escalations reports.
          (SELECT count(*) FROM recovery_schema.legal_case
            WHERE status = 'OPEN' {owner})                                     AS legal_open,
          (SELECT count(*) FROM recovery_schema.placement
            WHERE status IN ('ACTIVE','LEGAL') {owner})                        AS agency_open,
          -- Only money that actually settled; a pending or failed payment is
          -- not cash in.
          (SELECT COALESCE(sum(amount), 0) FROM customer_schema.payment
            WHERE payment_date = CURRENT_DATE AND status = 'COMPLETED' {owner})
                                                                               AS collected_today,
          (SELECT COALESCE(sum(recovered_amount), 0)
             FROM recovery_schema.placement)                                   AS recovered
        """), args)).mappings().one()
    return schemas.TicketCounters(
        needsCase=cand.total, openCases=r["open_cases"], inProgress=r["in_progress"],
        waitingCustomer=r["waiting"], promiseDueToday=extra["ptp_today"],
        brokenPromises=max(r["broken"], extra["ptp_broken"]), disputes=extra["disputes"],
        legalCases=extra["legal_open"], agencyCases=extra["agency_open"],
        overSla=r["over_sla"], awaitingClose=r["awaiting_close"],
        resolvedToday=r["resolved_today"],
        collectedToday=round(_f(extra["collected_today"]), 2),
        recoveredAmount=round(_f(extra["recovered"]), 2))
