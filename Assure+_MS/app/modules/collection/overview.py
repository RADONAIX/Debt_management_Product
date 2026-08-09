"""Collections Dashboard — the collections book as a whole, for whoever is looking.

Deliberately not a second copy of the workspace's Dashboard tab. That one
answers "what shape is my case list in" (counts by state, queue, type). This
one answers "how is collection going": what is owed, what came in, whether
promises hold, whether the work is being done on time.

Every figure is scoped to the desk the signed-in user may see — a collector
sees their own book, a supervisor or manager sees the floor — and the scope is
resolved server-side by the caller before it reaches here.

"The book" means accounts that have a case. Portfolio-wide numbers belong to
the Portfolio Dashboard; this screen is about accounts under collection.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.collection import schemas
from app.modules.collection.casebook import (
    AWAITING_CLOSE, CASE_FROM, DUE_SOON, LIVE_CASE, NOT_MERGED, NOT_STARTED,
    PAST_SLA, PROMISE_RECENT, PROMISE_WINDOW_DAYS, UNASSIGNED,
)
from app.modules.collection.service import NAME, PERSON, _f

# Every case count on this screen comes from `casebook`, so the workspace and
# this dashboard can never disagree about what "open" or "past SLA" mean.
LIVE = LIVE_CASE

# Accounts under collection, for the desk in scope. CAST rather than `::`
# because asyncpg reads `:x::type` as the parameter :x followed by :type.
_DESK = "(CAST(:ag AS bigint) IS NULL OR dc.assigned_agent_id = CAST(:ag AS bigint))"

_SCOPE = f"""
    SELECT DISTINCT dc.account_id, dc.customer_id
    {CASE_FROM}
    WHERE {NOT_MERGED} AND dc.account_id IS NOT NULL AND {_DESK}
"""

# The same, narrowed to work still outstanding.
_OPEN_SCOPE = f"""
    SELECT DISTINCT dc.account_id, dc.customer_id
    {CASE_FROM}
    WHERE {NOT_MERGED} AND {LIVE_CASE} AND dc.account_id IS NOT NULL AND {_DESK}
"""


def _pct(part: float, whole: float) -> float | None:
    """A rate is meaningless without a denominator; say so rather than show 0%."""
    return round(part / whole * 100, 1) if whole else None


def _delta(now: float, before: float) -> float | None:
    return round((now - before) / before * 100, 1) if before else None


async def overview(db: AsyncSession, agent_id: int | None, *, weeks: int = 8
                   ) -> schemas.CollectionsOverview:
    p = {"ag": agent_id}

    # --- What is owed, and by how many ------------------------------------
    book = (await db.execute(text(f"""
        WITH s AS ({_OPEN_SCOPE})
        SELECT COALESCE(sum(a.outstanding), 0)                     AS exposure,
               count(*)                                            AS accounts,
               count(DISTINCT a.customer_id)                       AS customers,
               COALESCE(sum(a.outstanding) FILTER (WHERE a.dpd > 90), 0) AS over_90,
               -- Part of the book is not late yet. The Portfolio Dashboard
               -- counts only delinquent balances as "under collection", so
               -- this is the difference between the two screens.
               COALESCE(sum(a.outstanding) FILTER (WHERE a.dpd = 0), 0)  AS not_yet_due
        FROM customer_schema.account a
        WHERE a.id IN (SELECT account_id FROM s)"""), p)).mappings().one()

    cases = (await db.execute(text(f"""
        SELECT count(*) FILTER (WHERE {LIVE_CASE})              AS open_cases,
               count(*) FILTER (WHERE {NOT_STARTED})            AS untouched,
               count(*) FILTER (WHERE {UNASSIGNED})             AS unassigned,
               count(*) FILTER (WHERE {AWAITING_CLOSE})         AS awaiting_close,
               count(*) FILTER (WHERE {PAST_SLA})               AS breached,
               count(*) FILTER (WHERE {DUE_SOON})               AS due_soon,
               count(*) FILTER (WHERE dc.closed_at >= date_trunc('month', CURRENT_DATE))
                                                                AS closed_mtd,
               avg(dc.resolution_hours) FILTER (
                   WHERE dc.closed_at >= CURRENT_DATE - interval '90 days')     AS avg_hours
        {CASE_FROM}
        WHERE {NOT_MERGED} AND {_DESK}"""), p)).mappings().one()

    # --- What came in ------------------------------------------------------
    # A rolling 30 days against the 30 before it. Month-to-date would compare a
    # part-month against a whole one and read as a wild swing on the 2nd.
    money = (await db.execute(text(f"""
        WITH s AS ({_SCOPE})
        SELECT COALESCE(sum(pm.amount) FILTER (
                   WHERE pm.payment_date > CURRENT_DATE - 30), 0)                 AS recent,
               count(*) FILTER (WHERE pm.payment_date > CURRENT_DATE - 30)        AS recent_count,
               COALESCE(sum(pm.amount) FILTER (
                   WHERE pm.payment_date > CURRENT_DATE - 60
                     AND pm.payment_date <= CURRENT_DATE - 30), 0)                AS prior,
               COALESCE(sum(pm.amount) FILTER (
                   WHERE pm.payment_date = CURRENT_DATE), 0)                      AS today
        FROM customer_schema.payment pm
        WHERE pm.status = 'COMPLETED' AND pm.account_id IN (SELECT account_id FROM s)"""),
        p)).mappings().one()

    # --- Do promises hold? -------------------------------------------------
    promises = (await db.execute(text(f"""
        WITH s AS ({_SCOPE})
        SELECT count(*) FILTER (WHERE t.status = 'KEPT'   AND {PROMISE_RECENT}) AS kept,
               count(*) FILTER (WHERE t.status = 'BROKEN' AND {PROMISE_RECENT}) AS broken,
               count(*) FILTER (WHERE t.status = 'PENDING')                            AS open_ptps,
               COALESCE(sum(t.promised_amount) FILTER (WHERE t.status = 'PENDING'), 0)  AS open_value,
               count(*) FILTER (WHERE t.status = 'PENDING'
                                  AND t.promised_date = CURRENT_DATE)                  AS due_today,
               COALESCE(sum(t.promised_amount) FILTER (
                   WHERE t.status = 'PENDING' AND t.promised_date = CURRENT_DATE), 0)   AS due_today_value,
               count(*) FILTER (WHERE t.status = 'PENDING'
                                  AND t.promised_date BETWEEN CURRENT_DATE
                                      AND CURRENT_DATE + 7)                            AS due_week,
               count(*) FILTER (WHERE t.status = 'PENDING'
                                  AND t.promised_date < CURRENT_DATE)                  AS overdue
        FROM customer_schema.ptp t
        WHERE t.account_id IN (SELECT account_id FROM s)"""), p)).mappings().one()

    # --- Eight weeks of flow ------------------------------------------------
    trend = (await db.execute(text(f"""
        WITH s AS ({_SCOPE}),
        weeks AS (
            SELECT generate_series(
                date_trunc('week', CURRENT_DATE) - make_interval(weeks => :wk - 1),
                date_trunc('week', CURRENT_DATE), interval '1 week')::date AS wk_start
        )
        SELECT w.wk_start,
               COALESCE((SELECT sum(pm.amount) FROM customer_schema.payment pm
                          WHERE pm.status = 'COMPLETED'
                            AND pm.account_id IN (SELECT account_id FROM s)
                            AND pm.payment_date >= w.wk_start
                            AND pm.payment_date < w.wk_start + 7), 0)          AS collected,
               COALESCE((SELECT sum(t.promised_amount) FROM customer_schema.ptp t
                          WHERE t.account_id IN (SELECT account_id FROM s)
                            AND t.promised_date >= w.wk_start
                            AND t.promised_date < w.wk_start + 7), 0)          AS promised,
               (SELECT count(*) FROM customer_schema.debt_case dc
                 LEFT JOIN collection.case_meta m ON m.case_id = dc.id
                 WHERE {NOT_MERGED}
                   AND (CAST(:ag AS bigint) IS NULL
                        OR dc.assigned_agent_id = CAST(:ag AS bigint))
                   AND dc.opened_at >= w.wk_start
                   AND dc.opened_at < w.wk_start + 7)                          AS opened,
               (SELECT count(*) FROM customer_schema.debt_case dc
                 LEFT JOIN collection.case_meta m ON m.case_id = dc.id
                 WHERE {NOT_MERGED}
                   AND (CAST(:ag AS bigint) IS NULL
                        OR dc.assigned_agent_id = CAST(:ag AS bigint))
                   AND dc.closed_at >= w.wk_start
                   AND dc.closed_at < w.wk_start + 7)                          AS closed
        FROM weeks w ORDER BY w.wk_start"""), {**p, "wk": weeks})).mappings().all()

    # --- Where the money sits -----------------------------------------------
    ageing = (await db.execute(text(f"""
        WITH s AS ({_OPEN_SCOPE})
        SELECT COALESCE(a.aging_bucket, 'Current') AS bucket,
               count(*) AS accounts, COALESCE(sum(a.outstanding), 0) AS exposure
        FROM customer_schema.account a
        WHERE a.id IN (SELECT account_id FROM s)
        GROUP BY 1"""), p)).mappings().all()
    ORDER = ["Current", "1-30", "31-60", "61-90", "90+"]
    ageing = sorted(ageing, key=lambda r: ORDER.index(r["bucket"])
                    if r["bucket"] in ORDER else len(ORDER))

    # --- Who is carrying what (only when the desk scope is the whole floor) --
    collectors: list[schemas.CollectorLine] = []
    if agent_id is None:
        collectors = [
            schemas.CollectorLine(
                agentId=r["id"], agentName=r["full_name"], openCases=r["open_cases"],
                exposure=_f(r["exposure"]), breached=r["breached"],
                collected30d=_f(r["collected"]),
                keptRate=_pct(_f(r["kept"]), _f(r["kept"]) + _f(r["broken"])))
            for r in (await db.execute(text(f"""
                WITH desk AS (
                    SELECT dc.assigned_agent_id AS agent_id, dc.id AS case_id,
                           dc.account_id, dc.sla_deadline, m.sla_paused_at
                    {CASE_FROM}
                    WHERE {NOT_MERGED} AND {LIVE_CASE}
                      AND dc.assigned_agent_id IS NOT NULL
                )
                SELECT u.id, u.full_name,
                       count(d.case_id)                                          AS open_cases,
                       count(d.case_id) FILTER (WHERE d.sla_deadline < now()
                                                  AND d.sla_paused_at IS NULL)   AS breached,
                       -- Summed over distinct accounts: two accounts owing the
                       -- same amount are two balances, not one.
                       COALESCE((SELECT sum(a.outstanding) FROM customer_schema.account a
                                  WHERE a.id IN (SELECT d2.account_id FROM desk d2
                                                  WHERE d2.agent_id = u.id)), 0) AS exposure,
                       COALESCE((SELECT sum(pm.amount) FROM customer_schema.payment pm
                                  WHERE pm.status = 'COMPLETED'
                                    AND pm.payment_date > CURRENT_DATE - 30
                                    AND pm.account_id IN (SELECT d3.account_id FROM desk d3
                                                           WHERE d3.agent_id = u.id)), 0)
                                                                                 AS collected,
                       (SELECT count(*) FROM customer_schema.ptp t
                         WHERE t.status = 'KEPT' AND {PROMISE_RECENT}
                           AND t.account_id IN (SELECT d4.account_id FROM desk d4
                                                 WHERE d4.agent_id = u.id))      AS kept,
                       (SELECT count(*) FROM customer_schema.ptp t
                         WHERE t.status = 'BROKEN' AND {PROMISE_RECENT}
                           AND t.account_id IN (SELECT d5.account_id FROM desk d5
                                                 WHERE d5.agent_id = u.id))      AS broken
                FROM administration.app_user u
                JOIN desk d ON d.agent_id = u.id
                WHERE u.status = 'ACTIVE'
                GROUP BY u.id, u.full_name
                ORDER BY 5 DESC"""))).mappings().all()]

    # --- The accounts worth a call today ------------------------------------
    # One row per account, not per case. An account with a dispute and a broken
    # promise owes its balance once, and listing it twice would double what the
    # panel appears to be worth.
    top = [
        schemas.ExposureLine(
            caseId=r["case_id"], caseNumber=r["case_code"], caseCount=r["case_count"],
            customerId=r["customer_code"], customerName=r["who"], companyName=r["company"],
            accountCode=r["account_code"], outstanding=_f(r["outstanding"]), dpd=r["dpd"],
            riskLevel=r["risk_level"], caseType=r["case_type"], agentName=r["agent_name"])
        for r in (await db.execute(text(f"""
            SELECT a.account_code, a.outstanding, a.risk_level, a.dpd,
                   c.customer_code, {PERSON} AS who, co.name AS company,
                   count(*) AS case_count,
                   -- The case to open first: whatever is closest to its deadline.
                   (array_agg(dc.id ORDER BY dc.sla_deadline NULLS LAST))[1]           AS case_id,
                   (array_agg(dc.case_code ORDER BY dc.sla_deadline NULLS LAST))[1]    AS case_code,
                   (array_agg(dc.case_type_code ORDER BY dc.sla_deadline NULLS LAST))[1] AS case_type,
                   (array_agg(u.full_name ORDER BY dc.sla_deadline NULLS LAST))[1]     AS agent_name
            FROM customer_schema.debt_case dc
            LEFT JOIN collection.case_meta m ON m.case_id = dc.id
            JOIN customer_schema.account a ON a.id = dc.account_id
            JOIN customer_schema.customer c ON c.id = dc.customer_id
            LEFT JOIN customer_schema.company co ON co.id = c.company_id
            LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
            WHERE {NOT_MERGED} AND {LIVE_CASE}
              AND (CAST(:ag AS bigint) IS NULL OR dc.assigned_agent_id = CAST(:ag AS bigint))
            GROUP BY a.id, a.account_code, a.outstanding, a.risk_level, a.dpd,
                     c.customer_code, c.full_name, co.name
            ORDER BY a.outstanding DESC LIMIT 8"""), p)).mappings().all()]

    # --- What will breach first ----------------------------------------------
    at_risk = [
        schemas.SlaLine(
            caseId=r["case_id"], caseNumber=r["case_code"], customerId=r["customer_code"],
            customerName=r["who"], priority=r["priority"], caseType=r["case_type_code"],
            outstanding=_f(r["outstanding"]), hoursToSla=_f(r["hrs"]),
            agentName=r["agent_name"])
        for r in (await db.execute(text(f"""
            SELECT dc.id AS case_id, dc.case_code, dc.case_type_code, dc.priority,
                   dc.amount AS outstanding, c.customer_code, {NAME} AS who,
                   u.full_name AS agent_name,
                   EXTRACT(EPOCH FROM (dc.sla_deadline - now())) / 3600 AS hrs
            FROM customer_schema.debt_case dc
            LEFT JOIN collection.case_meta m ON m.case_id = dc.id
            JOIN customer_schema.customer c ON c.id = dc.customer_id
            LEFT JOIN customer_schema.company co ON co.id = c.company_id
            LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
            WHERE {NOT_MERGED} AND {LIVE_CASE}
              AND m.sla_paused_at IS NULL AND dc.sla_deadline IS NOT NULL
              AND (CAST(:ag AS bigint) IS NULL OR dc.assigned_agent_id = CAST(:ag AS bigint))
            ORDER BY dc.sla_deadline LIMIT 8"""), p)).mappings().all()]

    exposure = _f(book["exposure"])
    collected = _f(money["recent"])
    kept, broken = _f(promises["kept"]), _f(promises["broken"])
    open_cases = cases["open_cases"]

    return schemas.CollectionsOverview(
        scope="MY_DESK" if agent_id else "ALL_COLLECTIONS",
        # Money owed on the accounts being worked.
        openExposure=round(exposure, 2),
        accounts=book["accounts"], customers=book["customers"],
        notYetDue=round(_f(book["not_yet_due"]), 2),
        openCases=open_cases, untouched=cases["untouched"],
        unassigned=cases["unassigned"], awaitingClose=cases["awaiting_close"],
        over90Exposure=round(_f(book["over_90"]), 2),
        # Money received against them over the last 30 days.
        collected30d=round(collected, 2), collectedToday=round(_f(money["today"]), 2),
        collectedPayments=money["recent_count"],
        collectedDeltaPct=_delta(collected, _f(money["prior"])),
        # Of everything that was collectable, the share actually collected.
        recoveryRatePct=_pct(collected, collected + exposure),
        # Whether what customers agree to actually happens.
        promiseKeptRatePct=_pct(kept, kept + broken),
        promisesKept=int(kept), promisesBroken=int(broken),
        openPromises=promises["open_ptps"], openPromiseValue=_f(promises["open_value"]),
        promisesDueToday=promises["due_today"],
        promisesDueTodayValue=_f(promises["due_today_value"]),
        promisesDueWeek=promises["due_week"], promisesOverdue=promises["overdue"],
        # Whether the work is being done when it was meant to be.
        slaCompliancePct=_pct(open_cases - cases["breached"], open_cases),
        slaBreached=cases["breached"], slaDueSoon=cases["due_soon"],
        # How long a case takes from opening to close.
        avgDaysToClose=round(_f(cases["avg_hours"]) / 24, 1) if cases["avg_hours"] else None,
        closedMtd=cases["closed_mtd"],
        trend=[schemas.TrendPoint(
            weekStart=r["wk_start"], collected=_f(r["collected"]),
            promised=_f(r["promised"]), opened=r["opened"], closed=r["closed"])
            for r in trend],
        ageing=[schemas.AgeingLine(bucket=r["bucket"], accounts=r["accounts"],
                                   exposure=_f(r["exposure"])) for r in ageing],
        collectors=collectors, topExposure=top, atRisk=at_risk,
    )
