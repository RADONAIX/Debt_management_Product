"""Portfolio Dashboard — the whole book, and the whole application on top of it.

This is the landing screen, so it answers the widest questions: how much is
owed across every account, how much of that has gone bad, how much of the bad
is actually being worked, and where the rest of it sits — disputed, promised,
placed with an agency, or in court.

Care has been taken not to repeat the other dashboards. The Collections
Dashboard measures the collections desk (its book, its 30-day cash, its SLA and
promise rates); this one measures the portfolio those desks are drawn from and
the coverage between the two. Where a figure would have overlapped, the
portfolio-level equivalent is used instead: cash collection ratio rather than
collected-in-30-days, delinquency and coverage rather than desk exposure.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.portfolio import schemas


def _f(v) -> float:
    return float(v) if v is not None else 0.0


def _pct(part: float, whole: float) -> float | None:
    return round(part / whole * 100, 1) if whole else None


async def overview(db: AsyncSession) -> schemas.PortfolioOverview:
    # --- The book ----------------------------------------------------------
    book = (await db.execute(text("""
        SELECT count(*)                                                   AS accounts,
               COALESCE(sum(a.outstanding), 0)                            AS receivables,
               COALESCE(sum(a.prior_outstanding), 0)                      AS prior,
               count(*) FILTER (WHERE a.dpd > 0)                          AS delinquent_accounts,
               COALESCE(sum(a.outstanding) FILTER (WHERE a.dpd > 0), 0)   AS delinquent,
               COALESCE(sum(a.outstanding) FILTER (WHERE a.dpd > 90), 0)  AS severe,
               count(*) FILTER (WHERE a.risk_level IN ('High', 'Critical')) AS risky_accounts,
               COALESCE(sum(a.outstanding)
                        FILTER (WHERE a.risk_level IN ('High', 'Critical')), 0) AS risky_value,
               count(*) FILTER (WHERE a.strategy_id IS NOT NULL)          AS on_strategy,
               count(DISTINCT a.customer_id)                              AS customers
        FROM customer_schema.account a"""))).mappings().one()

    people = (await db.execute(text("""
        SELECT count(*)                                              AS customers,
               count(*) FILTER (WHERE customer_type = 'ENTERPRISE')  AS enterprise,
               count(DISTINCT company_id)                            AS companies
        FROM customer_schema.customer"""))).mappings().one()

    # --- Cash: what was billed against what was paid ------------------------
    # The cash collection ratio is the portfolio's own measure — receipts
    # against billing — and says something the collections desk's recovery rate
    # does not.
    cash = (await db.execute(text("""
        SELECT COALESCE((SELECT sum(i.amount) FROM customer_schema.invoice i
                          WHERE i.issue_date >= date_trunc('month', CURRENT_DATE)), 0) AS billed,
               COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                          WHERE p.status = 'COMPLETED'
                            AND p.payment_date >= date_trunc('month', CURRENT_DATE)), 0) AS collected,
               COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                          WHERE p.status = 'COMPLETED'
                            AND p.payment_date >= date_trunc('month', CURRENT_DATE - interval '1 month')
                            AND p.payment_date <  date_trunc('month', CURRENT_DATE)), 0) AS prior_collected
        """))).mappings().one()

    # --- Where the delinquent balance sits ----------------------------------
    # A true partition: every delinquent account lands in exactly one bucket,
    # so these add up to the delinquent balance and nothing is counted twice.
    # Precedence runs from the most committed state backwards — an account in
    # court is reported as in court even if it also has an old promise on it.
    split = (await db.execute(text("""
        WITH d AS (
            SELECT a.id, a.outstanding,
                   -- A legal matter reaches an account either through the
                   -- placement it came from, or — when it was raised straight
                   -- from case management — through the customer.
                   EXISTS (SELECT 1 FROM recovery_schema.legal_case l
                            LEFT JOIN recovery_schema.placement lp ON lp.id = l.placement_id
                            WHERE l.status = 'OPEN'
                              AND (lp.account_id = a.id
                                   OR (l.placement_id IS NULL
                                       AND l.customer_id = a.customer_id)))       AS legal,
                   EXISTS (SELECT 1 FROM recovery_schema.placement pl
                            WHERE pl.account_id = a.id
                              AND pl.status IN ('ACTIVE', 'LEGAL'))               AS agency,
                   EXISTS (SELECT 1 FROM customer_schema.dispute di
                            WHERE di.account_id = a.id
                              AND di.status NOT IN ('RESOLVED', 'REJECTED'))      AS disputed,
                   EXISTS (SELECT 1 FROM customer_schema.ptp t
                            WHERE t.account_id = a.id AND t.status = 'PENDING')   AS promised,
                   EXISTS (SELECT 1 FROM customer_schema.debt_case dc
                            JOIN collection.case_meta m ON m.case_id = dc.id
                            WHERE dc.account_id = a.id AND dc.status <> 'CLOSED'
                              AND m.merged_into_case_id IS NULL)                  AS in_case
            FROM customer_schema.account a WHERE a.dpd > 0
        )
        SELECT CASE WHEN legal    THEN 'In legal'
                    WHEN agency   THEN 'With an agency'
                    WHEN disputed THEN 'In dispute'
                    WHEN promised THEN 'Promise to pay'
                    WHEN in_case  THEN 'In collection'
                    ELSE 'No case yet' END                AS stage,
               count(*) AS accounts, COALESCE(sum(outstanding), 0) AS balance
        FROM d GROUP BY 1"""))).mappings().all()

    STAGE_ORDER = ["In collection", "Promise to pay", "In dispute", "With an agency",
                   "In legal", "No case yet"]
    stages = sorted(
        [schemas.StageLine(stage=r["stage"], accounts=r["accounts"], balance=_f(r["balance"]))
         for r in split],
        key=lambda s: STAGE_ORDER.index(s.stage) if s.stage in STAGE_ORDER else len(STAGE_ORDER))

    # Commitments and cash movements. These are deliberately kept apart from the
    # split above: a promise is a future undertaking, a placement's face value is
    # what it was worth on the day it went out, and recoveries are cash received
    # over the life of the book. None of them is a slice of today's balance.
    flows = (await db.execute(text("""
        SELECT
          COALESCE((SELECT sum(t.promised_amount) FROM customer_schema.ptp t
                     WHERE t.status = 'PENDING'), 0)                              AS promised,
          COALESCE((SELECT sum(d.amount) FROM customer_schema.dispute d
                     WHERE d.status NOT IN ('RESOLVED', 'REJECTED')), 0)          AS disputed,
          COALESCE((SELECT sum(pl.placed_amount) FROM recovery_schema.placement pl
                     WHERE pl.status IN ('ACTIVE', 'LEGAL')), 0)                  AS placed,
          COALESCE((SELECT sum(l.claim_amount) FROM recovery_schema.legal_case l
                     WHERE l.status = 'OPEN'), 0)                                 AS claimed,
          COALESCE((SELECT sum(pl.recovered_amount) FROM recovery_schema.placement pl), 0)
                                                                                  AS agency_recovered
        """))).mappings().one()

    # --- Six months of billing against receipts ------------------------------
    trend = [
        schemas.MonthPoint(month=r["m"], billed=_f(r["billed"]), collected=_f(r["collected"]))
        for r in (await db.execute(text("""
            WITH months AS (
                SELECT generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months',
                                       date_trunc('month', CURRENT_DATE),
                                       interval '1 month')::date AS m
            )
            SELECT months.m,
                   COALESCE((SELECT sum(i.amount) FROM customer_schema.invoice i
                              WHERE i.issue_date >= months.m
                                AND i.issue_date < months.m + interval '1 month'), 0) AS billed,
                   COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                              WHERE p.status = 'COMPLETED' AND p.payment_date >= months.m
                                AND p.payment_date < months.m + interval '1 month'), 0) AS collected
            FROM months ORDER BY months.m"""))).mappings().all()]

    # --- The book by product, which is how the business is organised ---------
    products = [
        schemas.SegmentLine(
            name=r["product_code"], accounts=r["accounts"], balance=_f(r["balance"]),
            delinquent=_f(r["delinquent"]),
            delinquentPct=_pct(_f(r["delinquent"]), _f(r["balance"])))
        for r in (await db.execute(text("""
            SELECT a.product_code, count(*) AS accounts,
                   COALESCE(sum(a.outstanding), 0) AS balance,
                   COALESCE(sum(a.outstanding) FILTER (WHERE a.dpd > 0), 0) AS delinquent
            FROM customer_schema.account a
            GROUP BY 1 ORDER BY 3 DESC"""))).mappings().all()]

    ageing = [
        schemas.AgeingLine(bucket=r["bucket"], accounts=r["accounts"], balance=_f(r["balance"]))
        for r in (await db.execute(text("""
            SELECT COALESCE(a.aging_bucket, 'Current') AS bucket, count(*) AS accounts,
                   COALESCE(sum(a.outstanding), 0) AS balance
            FROM customer_schema.account a GROUP BY 1"""))).mappings().all()]
    ORDER = ["Current", "1-30", "31-60", "61-90", "90+"]
    ageing.sort(key=lambda r: ORDER.index(r.bucket) if r.bucket in ORDER else len(ORDER))

    # --- Which journeys are driving the book ---------------------------------
    strategies = [
        schemas.StrategyLine(
            code=r["strategy_code"], name=r["name"], status=r["status"].capitalize(),
            version=r["current_version"], accounts=r["accounts"], balance=_f(r["balance"]),
            successRate=_f(r["success_rate"]) if r["success_rate"] is not None else None)
        for r in (await db.execute(text("""
            SELECT s.strategy_code, s.name, s.status, s.current_version, s.success_rate,
                   count(a.id) AS accounts, COALESCE(sum(a.outstanding), 0) AS balance
            FROM public.strategy s
            LEFT JOIN customer_schema.account a ON a.strategy_id = s.id
            GROUP BY s.id, s.strategy_code, s.name, s.status, s.current_version, s.success_rate
            ORDER BY 7 DESC"""))).mappings().all()]

    # --- Who is running it ----------------------------------------------------
    team = (await db.execute(text("""
        SELECT count(*) AS users,
               count(*) FILTER (WHERE r.code = 'AGENT') AS agents,
               count(DISTINCT r.id) AS roles
        FROM administration.app_user u
        JOIN administration.role r ON r.id = u.role_id
        WHERE u.status = 'ACTIVE'"""))).mappings().one()

    work = (await db.execute(text("""
        SELECT count(*) FILTER (WHERE dc.status <> 'CLOSED'
                                  AND m.workflow_state NOT IN ('RESOLVED', 'CLOSED')) AS open_cases,
               count(*) FILTER (WHERE dc.closed_at >= date_trunc('month', CURRENT_DATE))
                                                                                      AS closed_mtd
        FROM customer_schema.debt_case dc
        JOIN collection.case_meta m ON m.case_id = dc.id
        WHERE m.merged_into_case_id IS NULL"""))).mappings().one()

    receivables = _f(book["receivables"])
    delinquent = _f(book["delinquent"])
    # Coverage is about whether a case exists, which is not the same question
    # as which stage the balance is in: an account can carry a promise made
    # months ago and still have nothing open on it today.
    under_case = _f((await db.execute(text("""
        SELECT COALESCE(sum(a.outstanding), 0) FROM customer_schema.account a
        WHERE a.dpd > 0 AND EXISTS (
            SELECT 1 FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE dc.account_id = a.id AND dc.status <> 'CLOSED'
              AND m.merged_into_case_id IS NULL)"""))).scalar_one())
    billed, collected = _f(cash["billed"]), _f(cash["collected"])

    return schemas.PortfolioOverview(
        # The book itself.
        receivables=round(receivables, 2), accounts=book["accounts"],
        customers=people["customers"], enterpriseCustomers=people["enterprise"],
        companies=people["companies"],
        receivablesDeltaPct=(round((receivables - _f(book["prior"])) / _f(book["prior"]) * 100, 1)
                             if _f(book["prior"]) else None),
        # How much of it has gone bad.
        delinquent=round(delinquent, 2), delinquentAccounts=book["delinquent_accounts"],
        delinquentPct=_pct(delinquent, receivables),
        severe=round(_f(book["severe"]), 2), severePct=_pct(_f(book["severe"]), delinquent),
        # How much of the bad is being worked — the join between this screen and
        # the collections floor, and the number nothing else reports.
        underCase=round(under_case, 2), coveragePct=_pct(under_case, delinquent),
        uncovered=round(max(delinquent - under_case, 0), 2), openCases=work["open_cases"],
        closedThisMonth=work["closed_mtd"],
        # Cash: receipts against billing.
        billedThisMonth=round(billed, 2), collectedThisMonth=round(collected, 2),
        cashCollectionPct=_pct(collected, billed),
        collectedDeltaPct=(round((collected - _f(cash["prior_collected"]))
                                 / _f(cash["prior_collected"]) * 100, 1)
                           if _f(cash["prior_collected"]) else None),
        # The delinquent balance split by where it sits — these add up to it.
        stages=stages,
        # Commitments and cash, which are not slices of that balance.
        promised=round(_f(flows["promised"]), 2),
        disputed=round(_f(flows["disputed"]), 2),
        placedFaceValue=round(_f(flows["placed"]), 2),
        claimed=round(_f(flows["claimed"]), 2),
        agencyRecovered=round(_f(flows["agency_recovered"]), 2),
        # Risk, strategy coverage and the team running it.
        riskyAccounts=book["risky_accounts"], riskyValue=round(_f(book["risky_value"]), 2),
        accountsOnStrategy=book["on_strategy"],
        accountsOffStrategy=book["accounts"] - book["on_strategy"],
        activeUsers=team["users"], agents=team["agents"], roles=team["roles"],
        trend=trend, ageing=ageing, products=products, strategies=strategies,
    )
