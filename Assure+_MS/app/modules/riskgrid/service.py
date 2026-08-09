"""Risk Grid Analysis — every widget aggregates the same filtered fact view."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.riskgrid import schemas

VIEW = "customer_schema.risk_grid_account_view"


def _where(f: schemas.Filters) -> tuple[str, dict]:
    """Translate the filter bar into one WHERE clause shared by every query."""
    clauses: list[str] = []
    params: dict = {}
    if f.customerType:
        clauses.append("v.customer_type = :customer_type")
        params["customer_type"] = f.customerType.upper()
    if f.riskLevel:
        clauses.append("v.risk_level = :risk_level")
        params["risk_level"] = f.riskLevel
    if f.dpdBucket:
        clauses.append("v.dpd_bucket = :dpd_bucket")
        params["dpd_bucket"] = f.dpdBucket
    if f.region:
        clauses.append("v.region = :region")
        params["region"] = f.region
    if f.accountStatus:
        clauses.append("v.account_status = :account_status")
        params["account_status"] = f.accountStatus
    if f.strategy:
        clauses.append("COALESCE(v.strategy_name, 'Unassigned') = :strategy")
        params["strategy"] = f.strategy
    if f.behaviour:
        clauses.append("v.behaviour_profile = :behaviour")
        params["behaviour"] = f.behaviour
    # The date range applies to activity, not to the account itself: a line is
    # in scope if it was contacted, paid or fell due inside the window.
    if f.dateFrom:
        clauses.append("(v.last_contact_at >= :date_from OR v.last_payment_at >= :date_from)")
        params["date_from"] = f.dateFrom
    if f.dateTo:
        clauses.append("(v.last_contact_at <= :date_to OR v.last_payment_at <= :date_to)")
        params["date_to"] = f.dateTo
    return (" AND ".join(clauses) or "TRUE"), params


async def summary(db: AsyncSession, f: schemas.Filters) -> schemas.KpiSummary:
    where, params = _where(f)
    row = (
        await db.execute(
            text(f"""
            SELECT
              count(*)                                        AS accounts,
              count(DISTINCT v.customer_id)                   AS customers,
              COALESCE(sum(v.outstanding), 0)                 AS outstanding,
              COALESCE(sum(v.outstanding) FILTER (WHERE v.customer_type = 'CONSUMER'), 0)
                                                              AS consumer_outstanding,
              COALESCE(sum(v.outstanding) FILTER (WHERE v.customer_type <> 'CONSUMER'), 0)
                                                              AS enterprise_outstanding,
              -- Expected recovery: each balance weighted by its own probability.
              COALESCE(sum(v.outstanding * v.recovery_probability / 100), 0)
                                                              AS expected_recovery,
              COALESCE(avg(v.recovery_probability), 0)        AS avg_recovery,
              count(*) FILTER (WHERE v.risk_level IN ('High','Critical')) AS high_risk,
              COALESCE(sum(v.outstanding) FILTER (WHERE v.risk_level IN ('High','Critical')), 0)
                                                              AS high_risk_outstanding,
              -- Portfolio health, 0-100: how current the book is, whether we can
              -- reach people, and how collectable the balance looks.
              COALESCE(avg(
                  0.40 * GREATEST(0, 100 - LEAST(180, v.dpd) * 100.0 / 180)
                + 0.25 * v.contactability
                + 0.20 * v.recovery_probability
                + 0.15 * (100 - v.risk_score)
              ), 0)                                           AS health,
              -- Same measure a month ago, from the risk history snapshot.
              COALESCE((
                SELECT avg(0.40 * GREATEST(0, 100 - LEAST(180, h.dpd) * 100.0 / 180)
                         + 0.60 * (100 - h.risk_score))
                  FROM customer_schema.risk_history h
                 WHERE h.as_of_month = date_trunc('month', CURRENT_DATE)::date
                       - INTERVAL '1 month'
              ), 0)                                           AS health_prev
              FROM {VIEW} v
             WHERE {where}
            """),
            params,
        )
    ).mappings().first()

    health = float(row["health"] or 0)
    prev = float(row["health_prev"] or 0)
    outstanding = float(row["outstanding"] or 0)
    expected = float(row["expected_recovery"] or 0)
    return schemas.KpiSummary(
        portfolioHealth=round(health, 1),
        portfolioHealthTrend=round(health - prev, 1) if prev else 0.0,
        totalOutstanding=round(outstanding, 2),
        consumerOutstanding=round(float(row["consumer_outstanding"] or 0), 2),
        enterpriseOutstanding=round(float(row["enterprise_outstanding"] or 0), 2),
        expectedRecovery30d=round(expected, 2),
        expectedRecoveryPct=round(100 * expected / outstanding, 1) if outstanding else 0.0,
        highRiskAccounts=int(row["high_risk"] or 0),
        highRiskOutstanding=round(float(row["high_risk_outstanding"] or 0), 2),
        avgRecoveryProbability=round(float(row["avg_recovery"] or 0), 1),
        totalAccounts=int(row["accounts"] or 0),
        totalCustomers=int(row["customers"] or 0),
    )


async def matrix(db: AsyncSession, f: schemas.Filters) -> list[schemas.MatrixCell]:
    where, params = _where(f)
    rows = (
        await db.execute(
            text(f"""
            SELECT v.risk_level, v.dpd_bucket,
                   count(*) AS accounts,
                   count(DISTINCT v.customer_id) AS customers,
                   COALESCE(sum(v.outstanding), 0) AS outstanding,
                   COALESCE(avg(v.recovery_probability), 0) AS avg_recovery
              FROM {VIEW} v
             WHERE {where}
             GROUP BY v.risk_level, v.dpd_bucket
            """),
            params,
        )
    ).mappings().all()
    return [
        schemas.MatrixCell(
            riskLevel=r["risk_level"], dpdBucket=r["dpd_bucket"],
            accounts=r["accounts"], customers=r["customers"],
            outstanding=round(float(r["outstanding"]), 2),
            avgRecovery=round(float(r["avg_recovery"]), 1),
        )
        for r in rows
    ]


async def behaviour(db: AsyncSession, f: schemas.Filters) -> list[schemas.BehaviourSegment]:
    where, params = _where(f)
    rows = (
        await db.execute(
            text(f"""
            SELECT v.behaviour_profile,
                   count(*) AS accounts,
                   COALESCE(sum(v.outstanding), 0) AS outstanding,
                   COALESCE(avg(v.recovery_probability), 0) AS avg_recovery,
                   COALESCE(avg(v.risk_score), 0) AS avg_risk,
                   100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0) AS share
              FROM {VIEW} v
             WHERE {where}
             GROUP BY v.behaviour_profile
             ORDER BY sum(v.outstanding) DESC
            """),
            params,
        )
    ).mappings().all()
    return [
        schemas.BehaviourSegment(
            profile=r["behaviour_profile"], accounts=r["accounts"],
            outstanding=round(float(r["outstanding"]), 2),
            avgRecovery=round(float(r["avg_recovery"]), 1),
            avgRisk=round(float(r["avg_risk"]), 1),
            share=round(float(r["share"] or 0), 1),
        )
        for r in rows
    ]


async def strategies(db: AsyncSession, f: schemas.Filters) -> list[schemas.StrategyRow]:
    where, params = _where(f)
    rows = (
        await db.execute(
            text(f"""
            SELECT COALESCE(v.strategy_name, 'Unassigned') AS strategy,
                   v.strategy_code,
                   count(*) AS accounts,
                   COALESCE(sum(v.outstanding), 0) AS outstanding,
                   COALESCE(sum(v.collected_90d), 0) AS collected,
                   ROUND(100.0 * sum(v.collected_90d)
                         / NULLIF(sum(v.collected_90d) + sum(v.outstanding), 0), 1) AS rate,
                   COALESCE(avg(v.recovery_probability), 0) AS prob
              FROM {VIEW} v
             WHERE {where}
             GROUP BY 1, 2
             ORDER BY rate DESC NULLS LAST
            """),
            params,
        )
    ).mappings().all()
    return [
        schemas.StrategyRow(
            strategy=r["strategy"], code=r["strategy_code"], accounts=r["accounts"],
            outstanding=round(float(r["outstanding"]), 2),
            collected90d=round(float(r["collected"]), 2),
            recoveryRate=float(r["rate"] or 0),
            avgRecoveryProbability=round(float(r["prob"]), 1),
        )
        for r in rows
    ]


async def recommendation(db: AsyncSession, f: schemas.Filters) -> schemas.Recommendation:
    """What to do with the currently filtered slice, and why."""
    where, params = _where(f)
    r = (
        await db.execute(
            text(f"""
            SELECT count(*) AS accounts,
                   COALESCE(sum(v.outstanding), 0) AS outstanding,
                   COALESCE(avg(v.dpd), 0) AS avg_dpd,
                   COALESCE(avg(v.contactability), 0) AS contactability,
                   COALESCE(avg(v.recovery_probability), 0) AS recovery,
                   COALESCE(avg(v.ptp_broken), 0) AS broken,
                   COALESCE(avg(v.dispute_count), 0) AS disputes
              FROM {VIEW} v WHERE {where}
            """),
            params,
        )
    ).mappings().first()

    dpd = float(r["avg_dpd"] or 0)
    reach = float(r["contactability"] or 0)
    broken = float(r["broken"] or 0)
    disputes = float(r["disputes"] or 0)

    if dpd > 90:
        action, channels = "Escalate to legal / agency allocation", ["Legal Escalation", "Agency Allocation"]
        reason = f"Average {dpd:.0f} days past due with {broken:.1f} broken promises per account"
    elif dpd > 60:
        action, channels = "Settlement offer with supervisor call", ["Dialer", "Settlement Offer"]
        reason = f"{dpd:.0f} days overdue on average — recovery falls sharply beyond this point"
    elif dpd > 30 and reach >= 55:
        action, channels = "Prioritise dialer + SMS reminder", ["Dialer", "SMS"]
        reason = f"{reach:.0f}% contactability means these accounts answer — push for a promise"
    elif dpd > 30:
        action, channels = "Offer an instalment plan via WhatsApp", ["WhatsApp", "Installment Plan"]
        reason = f"Low reachability ({reach:.0f}%) — a self-serve plan converts better than calls"
    elif disputes > 0.5:
        action, channels = "Resolve disputes before collecting", ["Email", "Dispute Resolution"]
        reason = f"{disputes:.1f} open disputes per account are blocking payment"
    else:
        action, channels = "Automated reminder cycle", ["SMS", "Email"]
        reason = f"Portfolio is current with {reach:.0f}% contactability — keep costs low"

    return schemas.Recommendation(
        action=action, reason=reason, channels=channels,
        coverage=int(r["accounts"] or 0),
        outstanding=round(float(r["outstanding"] or 0), 2),
    )


async def funnel(db: AsyncSession, f: schemas.Filters) -> list[schemas.FunnelStage]:
    where, params = _where(f)
    r = (
        await db.execute(
            text(f"""
            SELECT count(*) AS portfolio,
                   COALESCE(sum(v.outstanding), 0) AS portfolio_amt,
                   count(*) FILTER (WHERE v.contact_events > 0) AS contacted,
                   COALESCE(sum(v.outstanding) FILTER (WHERE v.contact_events > 0), 0) AS contacted_amt,
                   count(*) FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0) AS ptp,
                   COALESCE(sum(v.outstanding)
                            FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0), 0) AS ptp_amt,
                   count(*) FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0
                                      AND v.payments_90d > 0) AS paid,
                   COALESCE(sum(v.collected_90d)
                            FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0
                                      AND v.payments_90d > 0), 0) AS paid_amt,
                   count(*) FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0
                                      AND v.payments_90d > 0
                                      AND (v.outstanding = 0 OR v.case_status = 'CLOSED')) AS closed,
                   COALESCE(sum(v.collected_90d)
                            FILTER (WHERE v.outstanding = 0), 0) AS closed_amt
              FROM {VIEW} v WHERE {where}
            """),
            params,
        )
    ).mappings().first()

    total = int(r["portfolio"] or 0) or 1
    stages = [
        ("Total Portfolio", int(r["portfolio"] or 0), float(r["portfolio_amt"] or 0)),
        ("Contacted", int(r["contacted"] or 0), float(r["contacted_amt"] or 0)),
        ("PTP Created", int(r["ptp"] or 0), float(r["ptp_amt"] or 0)),
        ("Payment Received", int(r["paid"] or 0), float(r["paid_amt"] or 0)),
        ("Closed", int(r["closed"] or 0), float(r["closed_amt"] or 0)),
    ]
    out: list[schemas.FunnelStage] = []
    for i, (name, count, amount) in enumerate(stages):
        prev = stages[i - 1][1] if i else count
        out.append(
            schemas.FunnelStage(
                stage=name, accounts=count, outstanding=round(amount, 2),
                conversionPct=round(100 * count / prev, 1) if prev else 0.0,
                ofPortfolioPct=round(100 * count / total, 1),
            )
        )
    return out


async def priority_targets(
    db: AsyncSession, f: schemas.Filters, *, search: str | None, limit: int, offset: int
) -> schemas.PriorityPage:
    """Ranked by money at risk: exposure weighted by how likely it is to be lost."""
    where, params = _where(f)
    if search:
        where += (
            " AND (lower(v.customer_name) LIKE :q OR lower(v.account_code) LIKE :q"
            " OR lower(COALESCE(v.subscriber_no,'')) LIKE :q)"
        )
        params["q"] = f"%{search.lower()}%"
    params |= {"limit": limit, "offset": offset}

    total = (
        await db.execute(text(f"SELECT count(*) FROM {VIEW} v WHERE {where}"), params)
    ).scalar_one()

    rows = (
        await db.execute(
            text(f"""
            SELECT v.*,
                   v.outstanding * (100 - v.recovery_probability) / 100 AS priority_score
              FROM {VIEW} v
             WHERE {where}
             ORDER BY priority_score DESC
             LIMIT :limit OFFSET :offset
            """),
            params,
        )
    ).mappings().all()

    def suggest(r) -> str:
        if r["dpd"] > 90:
            return "Legal Escalation"
        if r["dpd"] > 60:
            return "Settlement Offer"
        if r["dpd"] > 30:
            return "Dialer + SMS" if (r["contactability"] or 0) >= 55 else "Installment Plan"
        if r["dpd"] > 0:
            return "SMS Reminder"
        return "Monitor"

    return schemas.PriorityPage(
        total=int(total),
        rows=[
            schemas.PriorityTarget(
                rank=offset + i + 1,
                customerId=r["customer_code"],
                customerName=r["customer_name"],
                customerType=r["customer_type"],
                accountCode=r["account_code"],
                subscriberNo=r["subscriber_no"],
                outstanding=round(float(r["outstanding"]), 2),
                dpd=int(r["dpd"]),
                riskLevel=r["risk_level"],
                behaviourProfile=r["behaviour_profile"],
                recoveryProbability=float(r["recovery_probability"]),
                recommendedStrategy=r["strategy_name"] or suggest(r),
                lastContact=r["last_contact_at"],
                nextAction=r["next_followup_date"],
                priorityScore=round(float(r["priority_score"]), 2),
            )
            for i, r in enumerate(rows)
        ],
    )


async def enterprise_exposure(
    db: AsyncSession, f: schemas.Filters, company: str | None
) -> list[schemas.EnterpriseNode]:
    """Company → branch → BAN → account, for drilling into corporate exposure."""
    where, params = _where(f)
    where += " AND v.company_code IS NOT NULL"
    if company:
        where += " AND v.company_code = :company"
        params["company"] = company

    level_sql = {
        "company": ("v.company_code", "v.company_name", "NULL"),
        "branch": ("v.branch_code", "v.branch_name", "v.company_code"),
        "ban": ("v.ban", "v.ban", "v.branch_code"),
        "account": ("v.account_code", "v.customer_name", "v.ban"),
    }
    levels = ["company"] if not company else ["branch", "ban", "account"]

    out: list[schemas.EnterpriseNode] = []
    for level in levels:
        id_col, name_col, parent_col = level_sql[level]
        rows = (
            await db.execute(
                text(f"""
                SELECT {id_col} AS id, max({name_col}) AS name,
                       max({parent_col}) AS parent_id,
                       count(*) AS accounts,
                       COALESCE(sum(v.outstanding), 0) AS outstanding,
                       COALESCE(avg(v.dpd), 0) AS avg_dpd,
                       COALESCE(avg(v.recovery_probability), 0) AS recovery,
                       COALESCE(max(v.risk_score), 0) AS worst_risk
                  FROM {VIEW} v
                 WHERE {where} AND {id_col} IS NOT NULL
                 GROUP BY {id_col}
                 ORDER BY outstanding DESC
                """),
                params,
            )
        ).mappings().all()
        for r in rows:
            worst = float(r["worst_risk"])
            out.append(
                schemas.EnterpriseNode(
                    level=level, id=r["id"], name=r["name"], parentId=r["parent_id"],
                    accounts=r["accounts"],
                    outstanding=round(float(r["outstanding"]), 2),
                    avgDpd=round(float(r["avg_dpd"]), 1),
                    riskLevel=("Critical" if worst >= 75 else "High" if worst >= 55
                               else "Medium" if worst >= 30 else "Low"),
                    recoveryProbability=round(float(r["recovery"]), 1),
                )
            )
    return out


async def filter_options(db: AsyncSession) -> schemas.FilterOptions:
    async def distinct(col: str) -> list[str]:
        rows = (
            await db.execute(
                text(f"SELECT DISTINCT {col} AS v FROM {VIEW} v WHERE {col} IS NOT NULL ORDER BY 1")
            )
        ).all()
        return [r[0] for r in rows]

    return schemas.FilterOptions(
        customerTypes=await distinct("v.customer_type"),
        riskLevels=["Low", "Medium", "High", "Critical"],
        dpdBuckets=["0-30", "31-60", "61-90", "90+"],
        regions=await distinct("v.region"),
        accountStatuses=await distinct("v.account_status"),
        strategies=await distinct("COALESCE(v.strategy_name, 'Unassigned')"),
        behaviours=await distinct("v.behaviour_profile"),
    )


async def migration(db: AsyncSession, f: schemas.Filters) -> list[schemas.MigrationCell]:
    """Where accounts moved between risk bands from last month to this one.

    Bands are recomputed from the stored monthly score with the same cut-offs
    the live band uses, so a move here means the score really crossed a line.
    """
    where, params = _where(f)
    rows = (
        await db.execute(
            text(f"""
            WITH banded AS (
                SELECT h.account_id, h.as_of_month,
                       CASE WHEN h.risk_score >= 75 THEN 'Critical'
                            WHEN h.risk_score >= 55 THEN 'High'
                            WHEN h.risk_score >= 30 THEN 'Medium'
                            ELSE 'Low' END AS band
                  FROM customer_schema.risk_history h
                 WHERE h.as_of_month >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
            ),
            moves AS (
                SELECT prev.account_id,
                       prev.band AS from_band,
                       cur.band  AS to_band
                  FROM banded prev
                  JOIN banded cur
                    ON cur.account_id = prev.account_id
                   AND cur.as_of_month = date_trunc('month', CURRENT_DATE)::date
                 WHERE prev.as_of_month = (date_trunc('month', CURRENT_DATE)
                                           - INTERVAL '1 month')::date
            )
            SELECT m.from_band, m.to_band,
                   count(*) AS accounts,
                   COALESCE(sum(v.outstanding), 0) AS outstanding
              FROM moves m
              JOIN {VIEW} v ON v.account_id = m.account_id
             WHERE {where}
             GROUP BY m.from_band, m.to_band
            """),
            params,
        )
    ).mappings().all()

    rank = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
    out = []
    for r in rows:
        delta = rank.get(r["to_band"], 0) - rank.get(r["from_band"], 0)
        out.append(
            schemas.MigrationCell(
                fromBand=r["from_band"], toBand=r["to_band"],
                accounts=r["accounts"], outstanding=round(float(r["outstanding"]), 2),
                direction="deteriorated" if delta > 0 else "improved" if delta < 0 else "stable",
            )
        )
    return out


async def drivers(db: AsyncSession, f: schemas.Filters) -> list[schemas.RiskDriver]:
    """Which components are pushing the risk score, weighted as configured."""
    where, params = _where(f)
    components = {
        "Financial Stress": ("financial_stress_score", "financial_stress", False),
        "Responsibility": ("responsibility_score", "responsibility", True),
        "Cooperation": ("cooperation_score", "cooperation", True),
        "Credit Awareness": ("credit_awareness_score", "credit_awareness", True),
        "Legal Awareness": ("legal_awareness_score", "legal_awareness", True),
        "Employment Stability": ("employment_stability_score", "employment_stability", True),
    }
    weights = {
        r[0]: float(r[1])
        for r in (
            await db.execute(
                text("SELECT code, weight_pct FROM administration.risk_score_definition")
            )
        ).all()
    }

    selects = ", ".join(
        f"COALESCE(avg(v.{col}), 0) AS {col}, count(v.{col}) AS {col}_n"
        for col, _, _ in components.values()
    )
    row = (
        await db.execute(text(f"SELECT {selects} FROM {VIEW} v WHERE {where}"), params)
    ).mappings().first()

    raw = []
    for label, (col, code, higher_better) in components.items():
        avg = float(row[col] or 0)
        # A "higher is better" component contributes risk as its complement.
        risk_contribution = (100 - avg) if higher_better else avg
        weight = weights.get(code, 0.0)
        raw.append((label, avg, weight, risk_contribution * weight, int(row[f"{col}_n"] or 0)))

    total = sum(x[3] for x in raw) or 1
    return sorted(
        [
            schemas.RiskDriver(
                driver=label, avgScore=round(avg, 1), weightPct=weight,
                contribution=round(100 * contrib / total, 1), accountsAffected=n,
            )
            for label, avg, weight, contrib, n in raw
        ],
        key=lambda d: d.contribution,
        reverse=True,
    )


async def distribution(db: AsyncSession, f: schemas.Filters) -> list[schemas.DistributionBand]:
    """Counts and exposure per risk band — the distribution and the money."""
    where, params = _where(f)
    rows = (
        await db.execute(
            text(f"""
            SELECT v.risk_level,
                   count(*) AS accounts,
                   count(DISTINCT v.customer_id) AS customers,
                   COALESCE(sum(v.outstanding), 0) AS outstanding,
                   COALESCE(avg(v.dpd), 0) AS avg_dpd,
                   COALESCE(avg(v.recovery_probability), 0) AS avg_recovery,
                   100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0) AS share,
                   100.0 * sum(v.outstanding)
                       / NULLIF(sum(sum(v.outstanding)) OVER (), 0) AS exposure_share
              FROM {VIEW} v
             WHERE {where}
             GROUP BY v.risk_level
            """),
            params,
        )
    ).mappings().all()
    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    return sorted(
        [
            schemas.DistributionBand(
                riskLevel=r["risk_level"], accounts=r["accounts"], customers=r["customers"],
                outstanding=round(float(r["outstanding"]), 2),
                sharePct=round(float(r["share"] or 0), 1),
                exposurePct=round(float(r["exposure_share"] or 0), 1),
                avgDpd=round(float(r["avg_dpd"]), 1),
                avgRecovery=round(float(r["avg_recovery"]), 1),
            )
            for r in rows
        ],
        key=lambda b: order.get(b.riskLevel, 9),
    )
