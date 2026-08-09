"""Agent Performance — one collector's month, and how it compares.

Everything here derives from the same facts the rest of the product uses: cash
from `customer_schema.payment`, work from `case_activity`, `ptp`, `dispute`,
`debt_case` and `collection.case_task`. `public.agent_performance` holds the
monthly roll-up, rebuilt from those same sources, so a figure on this screen
can always be traced to a row somewhere else.

Attribution follows the application's one rule: a payment belongs to the agent
who owns the customer, and the customer's owner is whoever holds the live case.
scripts/verify_consistency.py enforces both.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.engagement.contacts import _ANSWERABLE, _REACHED
from app.modules.operations import schemas


def _f(v) -> float:
    return float(v) if v is not None else 0.0


def _pct(part: float, whole: float) -> float | None:
    return round(part / whole * 100, 1) if whole else None


async def performance(db: AsyncSession, agent_id: int) -> schemas.AgentPerformance:
    who = (await db.execute(text("""
        SELECT u.id, u.full_name, u.email, r.code AS role,
               ap.employee_code, ap.skill_group, ap.expertise, ap.languages,
               ap.specializations, ap.availability_status, ap.max_caseload,
               ap.monthly_target, ap.performance_rating, ap.years_experience, ap.hired_on
        FROM administration.app_user u
        JOIN administration.role r ON r.id = u.role_id
        LEFT JOIN public.agent_profile ap ON ap.user_id = u.id
        WHERE u.id = :a"""), {"a": agent_id})).mappings().first()
    if who is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such agent.")

    # --- This month, from the ledger ---------------------------------------
    month = (await db.execute(text("""
        SELECT
          COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                     JOIN customer_schema.account a ON a.id = p.account_id
                     JOIN customer_schema.customer c ON c.id = a.customer_id
                    WHERE c.assigned_agent_id = :a AND p.status = 'COMPLETED'
                      AND p.payment_date >= date_trunc('month', CURRENT_DATE)), 0) AS collected,
          COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                     JOIN customer_schema.account a ON a.id = p.account_id
                     JOIN customer_schema.customer c ON c.id = a.customer_id
                    WHERE c.assigned_agent_id = :a AND p.status = 'COMPLETED'
                      AND p.payment_date = CURRENT_DATE), 0)                       AS collected_today,
          COALESCE((SELECT count(*) FROM customer_schema.payment p
                     JOIN customer_schema.account a ON a.id = p.account_id
                     JOIN customer_schema.customer c ON c.id = a.customer_id
                    WHERE c.assigned_agent_id = :a AND p.status = 'COMPLETED'
                      AND p.payment_date >= date_trunc('month', CURRENT_DATE)), 0)  AS payments,
          COALESCE((SELECT ap.target_amount FROM public.agent_performance ap
                    WHERE ap.agent_id = :a
                      AND ap.period_month = date_trunc('month', CURRENT_DATE)), 0)  AS target
        """), {"a": agent_id})).mappings().one()

    # --- The book this agent carries ----------------------------------------
    book = (await db.execute(text("""
        SELECT count(DISTINCT c.id)                                    AS customers,
               count(DISTINCT a.id)                                    AS accounts,
               COALESCE(sum(DISTINCT a.outstanding), 0)                AS _unused,
               COALESCE((SELECT sum(a2.outstanding) FROM customer_schema.account a2
                          JOIN customer_schema.customer c2 ON c2.id = a2.customer_id
                         WHERE c2.assigned_agent_id = :a), 0)          AS portfolio
        FROM customer_schema.customer c
        LEFT JOIN customer_schema.account a ON a.customer_id = c.id
        WHERE c.assigned_agent_id = :a"""), {"a": agent_id})).mappings().one()

    cases = (await db.execute(text("""
        SELECT count(*) FILTER (WHERE dc.status <> 'CLOSED'
                                  AND m.workflow_state NOT IN ('RESOLVED','CLOSED')) AS open_cases,
               count(*) FILTER (WHERE m.workflow_state = 'ASSIGNED'
                                  AND dc.status <> 'CLOSED')                         AS not_started,
               count(*) FILTER (WHERE dc.status <> 'CLOSED'
                                  AND m.workflow_state NOT IN ('RESOLVED','CLOSED')
                                  AND dc.sla_deadline < now()
                                  AND m.sla_paused_at IS NULL)                       AS breached,
               count(*) FILTER (WHERE dc.status <> 'CLOSED'
                                  AND m.sla_paused_at IS NULL
                                  AND dc.sla_deadline BETWEEN now()
                                      AND now() + interval '24 hours')               AS due_soon,
               count(*) FILTER (WHERE dc.closed_at >= date_trunc('month', CURRENT_DATE))
                                                                                     AS closed_mtd,
               avg(dc.resolution_hours) FILTER (
                   WHERE dc.closed_at >= CURRENT_DATE - interval '90 days')          AS avg_hours
        FROM customer_schema.debt_case dc
        JOIN collection.case_meta m ON m.case_id = dc.id
        WHERE dc.assigned_agent_id = :a AND m.merged_into_case_id IS NULL"""),
        {"a": agent_id})).mappings().one()

    promises = (await db.execute(text("""
        SELECT count(*) FILTER (WHERE t.status = 'PENDING')                       AS open_ptps,
               COALESCE(sum(t.promised_amount) FILTER (WHERE t.status = 'PENDING'), 0)
                                                                                  AS open_value,
               count(*) FILTER (WHERE t.status = 'KEPT'
                                  AND t.promised_date >= CURRENT_DATE - 90)       AS kept,
               count(*) FILTER (WHERE t.status = 'BROKEN'
                                  AND t.promised_date >= CURRENT_DATE - 90)       AS broken,
               count(*) FILTER (WHERE t.status = 'PENDING'
                                  AND t.promised_date = CURRENT_DATE)             AS due_today
        FROM customer_schema.ptp t
        JOIN customer_schema.account a ON a.id = t.account_id
        JOIN customer_schema.customer c ON c.id = a.customer_id
        WHERE c.assigned_agent_id = :a"""), {"a": agent_id})).mappings().one()

    # "Reached" means the same thing here as it does on the Engagement Center:
    # a no-answer is not a connection, and a delivery receipt on a message is
    # not a conversation. Both screens share one classifier so they cannot
    # report different reach rates for the same work.
    contact = (await db.execute(text(f"""
        SELECT count(*) FILTER (WHERE ca.occurred_at >= date_trunc('month', CURRENT_DATE))
                                                                                  AS attempts,
               count(*) FILTER (WHERE ca.occurred_at >= date_trunc('month', CURRENT_DATE)
                                  AND {_REACHED})                                 AS reached,
               count(*) FILTER (WHERE ca.occurred_at >= date_trunc('month', CURRENT_DATE)
                                  AND {_ANSWERABLE})                              AS answerable,
               count(*) FILTER (WHERE ca.occurred_at::date = CURRENT_DATE)        AS today
        FROM customer_schema.case_activity ca
        WHERE ca.agent_id = :a AND ca.direction <> 'INTERNAL'"""),
        {"a": agent_id})).mappings().one()

    tasks = (await db.execute(text("""
        SELECT count(*)                                                          AS total,
               count(*) FILTER (WHERE t.status = 'DONE')                         AS done,
               count(*) FILTER (WHERE t.status <> 'DONE' AND t.due_date < CURRENT_DATE)
                                                                                 AS overdue,
               count(*) FILTER (WHERE t.status <> 'DONE' AND t.due_date = CURRENT_DATE)
                                                                                 AS due_today
        FROM collection.case_task t WHERE t.assigned_to = :a"""),
        {"a": agent_id})).mappings().one()

    disputes = (await db.execute(text("""
        SELECT count(*) FILTER (WHERE d.status NOT IN ('RESOLVED','REJECTED')) AS open_disputes,
               count(*) FILTER (WHERE d.status IN ('RESOLVED','REJECTED')
                                  AND d.updated_at >= date_trunc('month', CURRENT_DATE))
                                                                               AS settled_mtd
        FROM customer_schema.dispute d WHERE d.assigned_agent_id = :a"""),
        {"a": agent_id})).mappings().one()

    # --- Six months of history, from the roll-up ----------------------------
    history = [
        schemas.PerfMonth(
            month=r["period_month"], collected=_f(r["collected_amount"]),
            target=_f(r["target_amount"]),
            attainment=_pct(_f(r["collected_amount"]), _f(r["target_amount"])),
            casesAssigned=r["cases_assigned"], casesResolved=r["cases_resolved"],
            ptpCreated=r["ptp_created"], ptpKept=r["ptp_kept"],
            contacts=r["contact_attempts"], slaBreaches=r["sla_breaches"])
        for r in (await db.execute(text("""
            SELECT * FROM public.agent_performance
            WHERE agent_id = :a ORDER BY period_month"""), {"a": agent_id})).mappings().all()]

    # --- Where this agent stands on the floor --------------------------------
    board = [
        schemas.PeerLine(
            agentId=r["id"], agentName=r["full_name"], collected=_f(r["collected"]),
            target=_f(r["target"]),
            attainment=_pct(_f(r["collected"]), _f(r["target"])),
            openCases=r["open_cases"], breached=r["breached"], isMe=r["id"] == agent_id)
        for r in (await db.execute(text("""
            SELECT u.id, u.full_name,
                   COALESCE(ap.collected_amount, 0) AS collected,
                   COALESCE(ap.target_amount, 0) AS target,
                   (SELECT count(*) FROM customer_schema.debt_case dc
                     JOIN collection.case_meta m ON m.case_id = dc.id
                    WHERE dc.assigned_agent_id = u.id AND dc.status <> 'CLOSED'
                      AND m.merged_into_case_id IS NULL
                      AND m.workflow_state NOT IN ('RESOLVED','CLOSED')) AS open_cases,
                   (SELECT count(*) FROM customer_schema.debt_case dc
                     JOIN collection.case_meta m ON m.case_id = dc.id
                    WHERE dc.assigned_agent_id = u.id AND dc.status <> 'CLOSED'
                      AND dc.sla_deadline < now() AND m.sla_paused_at IS NULL) AS breached
            FROM administration.app_user u
            JOIN administration.role r ON r.id = u.role_id
            LEFT JOIN public.agent_performance ap
                   ON ap.agent_id = u.id
                  AND ap.period_month = date_trunc('month', CURRENT_DATE)
            WHERE r.code = 'AGENT' AND u.status = 'ACTIVE'
            ORDER BY collected DESC"""))).mappings().all()]

    # --- The work in front of them right now ---------------------------------
    next_up = [
        schemas.NextAction(
            caseId=r["case_id"], caseNumber=r["case_code"], customerId=r["customer_code"],
            customerName=r["who"], caseType=r["case_type_code"], priority=r["priority"],
            outstanding=_f(r["amount"]), hoursToSla=_f(r["hrs"]), reason=r["reason"])
        for r in (await db.execute(text("""
            SELECT dc.id AS case_id, dc.case_code, dc.case_type_code, dc.priority, dc.amount,
                   c.customer_code, COALESCE(c.full_name, co.name, c.customer_code) AS who,
                   EXTRACT(EPOCH FROM (dc.sla_deadline - now())) / 3600 AS hrs,
                   CASE WHEN dc.sla_deadline < now() THEN 'Past its next-action time'
                        WHEN m.workflow_state = 'ASSIGNED' THEN 'Not picked up yet'
                        ELSE 'Due within the day' END AS reason
            FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            JOIN customer_schema.customer c ON c.id = dc.customer_id
            LEFT JOIN customer_schema.company co ON co.id = c.company_id
            WHERE dc.assigned_agent_id = :a AND dc.status <> 'CLOSED'
              AND m.merged_into_case_id IS NULL
              AND m.workflow_state NOT IN ('RESOLVED','CLOSED')
              AND m.sla_paused_at IS NULL
            ORDER BY dc.sla_deadline NULLS LAST LIMIT 8"""),
            {"a": agent_id})).mappings().all()]

    collected = _f(month["collected"])
    target = _f(month["target"]) or _f(who["monthly_target"])
    kept, broken = _f(promises["kept"]), _f(promises["broken"])
    open_cases = cases["open_cases"]
    ranked = [p for p in board if p.collected > 0 or p.agentId == agent_id]
    rank = next((i + 1 for i, p in enumerate(board) if p.agentId == agent_id), None)

    return schemas.AgentPerformance(
        agentId=agent_id, agentName=who["full_name"], email=who["email"],
        employeeCode=who["employee_code"], skillGroup=who["skill_group"],
        expertise=who["expertise"], languages=list(who["languages"] or []),
        specializations=list(who["specializations"] or []),
        availability=who["availability_status"], hiredOn=who["hired_on"],
        yearsExperience=who["years_experience"],
        rating=_f(who["performance_rating"]) if who["performance_rating"] else None,

        collectedMtd=round(collected, 2), collectedToday=round(_f(month["collected_today"]), 2),
        target=round(target, 2), attainment=_pct(collected, target),
        payments=month["payments"],

        portfolio=round(_f(book["portfolio"]), 2), customers=book["customers"],
        accounts=book["accounts"],
        openCases=open_cases, notStarted=cases["not_started"],
        closedThisMonth=cases["closed_mtd"],
        maxCaseload=who["max_caseload"],
        caseloadPct=_pct(open_cases, _f(who["max_caseload"])),
        slaBreached=cases["breached"], slaDueSoon=cases["due_soon"],
        slaCompliance=_pct(open_cases - cases["breached"], open_cases),
        avgDaysToClose=round(_f(cases["avg_hours"]) / 24, 1) if cases["avg_hours"] else None,

        openPromises=promises["open_ptps"], openPromiseValue=_f(promises["open_value"]),
        promisesDueToday=promises["due_today"], promisesKept=int(kept),
        promisesBroken=int(broken), keptRate=_pct(kept, kept + broken),

        contactsMtd=contact["attempts"], contactsToday=contact["today"],
        contactsReached=contact["reached"],
        reachRate=_pct(_f(contact["reached"]), _f(contact["answerable"])),

        tasksTotal=tasks["total"], tasksDone=tasks["done"], tasksOverdue=tasks["overdue"],
        tasksDueToday=tasks["due_today"],
        taskCompletion=_pct(_f(tasks["done"]), _f(tasks["total"])),

        openDisputes=disputes["open_disputes"], disputesSettledMtd=disputes["settled_mtd"],

        rank=rank, ofAgents=len(ranked), history=history, floor=board, nextUp=next_up,
    )
