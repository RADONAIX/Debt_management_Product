"""Strategy performance analytics.

Deliberately not another portfolio dashboard. Every figure here answers a
question you can only ask of a *strategy* — is it beating doing nothing, what
does it cost to run, is it aimed at the right accounts, is it still converting
after the last edit — rather than restating how the book is doing.

Everything aggregates `strategy_schema.strategy_account_view`, so a number here
always reconciles with a number there, and recovery rate uses the same
definition the Collections Dashboard uses: collected ÷ (collected + still owed).
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.strategies import schemas

VIEW = "strategy_schema.strategy_account_view"

#: The comparison window on either side of a version publish. Both sides must be
#: the same length or the change is an artefact of the calendar.
WINDOW_DAYS = 30


def _f(v) -> float:
    return float(v or 0)


def _rate(collected: float, outstanding: float) -> float:
    """Recovery rate: of everything that was collectable, what came in."""
    base = collected + outstanding
    return round(collected / base * 100, 1) if base else 0.0


def _pct(part: float, whole: float) -> float:
    return round(part / whole * 100, 1) if whole else 0.0


async def _control_rates(db: AsyncSession) -> dict[str, float]:
    """Recovery rate for accounts on **no** strategy, by ageing bucket.

    This is the control group. Comparing a strategy against the whole book
    would flatter strategies that happen to hold current accounts; comparing it
    against unmanaged accounts of the same age is the only fair test of whether
    running the strategy beat leaving the account alone.
    """
    rows = (await db.execute(text("""
        SELECT a.aging_bucket AS bucket,
               COALESCE(sum(pm.paid), 0)     AS collected,
               COALESCE(sum(a.outstanding), 0) AS outstanding
          FROM customer_schema.account a
          LEFT JOIN LATERAL (
              SELECT COALESCE(sum(p.amount), 0) AS paid
                FROM customer_schema.payment p
               WHERE p.account_id = a.id AND p.status = 'COMPLETED'
                 AND p.payment_date >= CURRENT_DATE - 90) pm ON TRUE
         WHERE a.strategy_id IS NULL AND a.aging_bucket IS NOT NULL
         GROUP BY 1"""))).mappings().all()
    return {r["bucket"]: _rate(_f(r["collected"]), _f(r["outstanding"])) for r in rows}


async def strategies(db: AsyncSession) -> list[schemas.StrategyPerformance]:
    """The league table: one row per strategy, with everything it is judged on."""
    control = await _control_rates(db)

    rows = (await db.execute(text(f"""
        SELECT v.strategy_id, v.strategy_code, v.strategy_name, v.strategy_status,
               v.current_version,
               count(*)                                       AS accounts,
               count(*) FILTER (WHERE v.exited_at IS NULL)     AS live_accounts,
               COALESCE(sum(v.outstanding), 0)                 AS outstanding,
               COALESCE(sum(v.collected_since), 0)             AS collected,
               COALESCE(sum(v.touches), 0)                     AS touches,
               COALESCE(sum(v.touch_cost), 0)                  AS cost,
               COALESCE(sum((SELECT count(*) FROM strategy_schema.step_event se
                              WHERE se.enrolment_id = v.enrolment_id
                                AND se.outcome IN ('CONTACTED','PROMISE_MADE','RESOLVED'))), 0)
                                                               AS responses,
               COALESCE(sum(v.promises), 0)                    AS promises,
               COALESCE(sum(v.promises_kept), 0)               AS kept,
               COALESCE(sum(v.promises_broken), 0)             AS broken,
               count(*) FILTER (WHERE NOT v.on_target)         AS off_target,
               COALESCE(sum(v.outstanding) FILTER (WHERE NOT v.on_target), 0)
                                                               AS off_target_value,
               count(*) FILTER (WHERE v.escalated_agency OR v.escalated_legal)
                                                               AS escalated,
               avg(v.first_payment_on - v.entered_at::date) FILTER (
                   WHERE v.first_payment_on IS NOT NULL)       AS days_to_pay,
               -- The bucket mix, so the control rate can be weighted to match.
               jsonb_object_agg(COALESCE(v.aging_bucket, 'Current'), 1) AS buckets,
               (SELECT max(sv.published_at) FROM public.strategy_version sv
                 WHERE sv.strategy_id = v.strategy_id
                   AND sv.status = 'PUBLISHED')                AS last_published
          FROM {VIEW} v
         GROUP BY v.strategy_id, v.strategy_code, v.strategy_name,
                  v.strategy_status, v.current_version
         ORDER BY outstanding DESC"""))).mappings().all()

    # Each strategy's own bucket mix, needed to weight the control fairly.
    mixes = (await db.execute(text(f"""
        SELECT v.strategy_id, COALESCE(v.aging_bucket, 'Current') AS bucket,
               COALESCE(sum(v.collected_since), 0) + COALESCE(sum(v.outstanding), 0) AS base
          FROM {VIEW} v GROUP BY 1, 2"""))).mappings().all()
    by_strategy: dict[int, list[tuple[str, float]]] = {}
    for m in mixes:
        by_strategy.setdefault(m["strategy_id"], []).append((m["bucket"], _f(m["base"])))

    out: list[schemas.StrategyPerformance] = []
    for r in rows:
        collected, outstanding = _f(r["collected"]), _f(r["outstanding"])
        rate = _rate(collected, outstanding)

        # What the same accounts would have recovered with no strategy at all,
        # weighted by this strategy's own ageing mix.
        parts = by_strategy.get(r["strategy_id"], [])
        # Only buckets that actually contain unmanaged accounts can be compared.
        comparable = [(b, base) for b, base in parts if b in control]
        comparable_base = sum(base for _, base in comparable)
        total_base = sum(base for _, base in parts)
        expected = (
            sum(control[b] * base for b, base in comparable) / comparable_base
            if comparable_base else None
        )
        # How much of this strategy's book the comparison actually covers. A lift
        # measured on a sliver of the accounts is not a verdict on the strategy.
        coverage = _pct(comparable_base, total_base)

        accounts = r["accounts"] or 1
        settled = _f(r["kept"]) + _f(r["broken"])
        out.append(schemas.StrategyPerformance(
            strategyId=r["strategy_code"], name=r["strategy_name"],
            status=r["strategy_status"], version=r["current_version"],
            accounts=r["accounts"], liveAccounts=r["live_accounts"],
            outstanding=round(outstanding, 2), collected=round(collected, 2),
            recoveryRate=rate,
            # Percentage points above (or below) leaving these accounts alone.
            # None when no unmanaged account of the same age exists to compare to.
            liftPct=round(rate - expected, 1) if expected is not None else None,
            controlRate=round(expected, 1) if expected is not None else None,
            controlCoveragePct=coverage,
            touches=int(r["touches"]),
            touchesPerAccount=round(_f(r["touches"]) / accounts, 1),
            cost=round(_f(r["cost"]), 2),
            # What it costs in outreach to bring in 100 currency units.
            costPer100=round(_f(r["cost"]) / collected * 100, 2) if collected else 0.0,
            responseRate=_pct(_f(r["responses"]), _f(r["touches"])),
            promises=int(r["promises"]),
            promiseKeptRate=_pct(_f(r["kept"]), settled),
            escalationRate=_pct(_f(r["escalated"]), accounts),
            offTarget=r["off_target"],
            offTargetValue=round(_f(r["off_target_value"]), 2),
            daysToFirstPayment=round(_f(r["days_to_pay"]), 1) if r["days_to_pay"] else None,
            lastPublished=r["last_published"],
        ))
    return out


async def summary(db: AsyncSession) -> schemas.StrategySummary:
    """The six headline measures, each one about the strategies themselves."""
    book = (await db.execute(text("""
        SELECT count(*) FILTER (WHERE a.strategy_id IS NOT NULL)          AS covered,
               count(*) FILTER (WHERE a.strategy_id IS NULL)              AS uncovered,
               COALESCE(sum(a.outstanding) FILTER (WHERE a.strategy_id IS NOT NULL), 0)
                                                                          AS covered_value,
               COALESCE(sum(a.outstanding) FILTER (WHERE a.strategy_id IS NULL), 0)
                                                                          AS uncovered_value,
               COALESCE(avg(a.dpd) FILTER (WHERE a.strategy_id IS NULL), 0)
                                                                          AS uncovered_dpd
          FROM customer_schema.account a"""))).mappings().one()

    perf = (await db.execute(text(f"""
        SELECT COALESCE(sum(v.collected_since), 0) AS collected,
               COALESCE(sum(v.outstanding), 0)     AS outstanding,
               COALESCE(sum(v.touch_cost), 0)      AS cost,
               COALESCE(sum(v.touches), 0)         AS touches,
               COALESCE((SELECT count(*) FROM strategy_schema.step_event se
                          WHERE se.outcome IN ('CONTACTED','PROMISE_MADE','RESOLVED')), 0)
                                                   AS responses,
               COALESCE(sum(v.promises), 0)        AS promises,
               COALESCE(sum(v.promises_kept), 0)   AS kept,
               COALESCE(sum(v.promises_broken), 0) AS broken,
               count(*)                            AS enrolled,
               count(*) FILTER (WHERE v.on_target) AS on_target,
               count(*) FILTER (WHERE v.escalated_agency OR v.escalated_legal)
                                                   AS escalated
          FROM {VIEW} v"""))).mappings().one()

    active = (await db.execute(text(
        "SELECT count(*) FROM public.strategy WHERE status = 'ACTIVE'"))).scalar_one()

    control = await _control_rates(db)
    collected, outstanding = _f(perf["collected"]), _f(perf["outstanding"])
    rate = _rate(collected, outstanding)
    # A single control figure for the headline: how the unmanaged book is doing.
    control_avg = round(sum(control.values()) / len(control), 1) if control else 0.0
    settled = _f(perf["kept"]) + _f(perf["broken"])
    enrolled = int(perf["enrolled"]) or 1

    return schemas.StrategySummary(
        activeStrategies=int(active),
        coveredAccounts=book["covered"], uncoveredAccounts=book["uncovered"],
        coveredValue=round(_f(book["covered_value"]), 2),
        uncoveredValue=round(_f(book["uncovered_value"]), 2),
        coveragePct=_pct(_f(book["covered_value"]),
                         _f(book["covered_value"]) + _f(book["uncovered_value"])),
        uncoveredAvgDpd=round(_f(book["uncovered_dpd"]), 0),
        recoveryRate=rate, controlRate=control_avg, liftPct=round(rate - control_avg, 1),
        collected=round(collected, 2),
        touchCost=round(_f(perf["cost"]), 2),
        costPer100=round(_f(perf["cost"]) / collected * 100, 2) if collected else 0.0,
        touches=int(perf["touches"]),
        responseRate=_pct(_f(perf["responses"]), _f(perf["touches"])),
        promises=int(perf["promises"]),
        promiseKeptRate=_pct(_f(perf["kept"]), settled),
        escalationRate=_pct(_f(perf["escalated"]), enrolled),
        routingAccuracy=_pct(_f(perf["on_target"]), enrolled),
        offTarget=enrolled - int(perf["on_target"]),
    )


async def channels(db: AsyncSession) -> list[schemas.ChannelEconomics]:
    """What each channel costs and what it buys, across every strategy."""
    rows = (await db.execute(text("""
        SELECT COALESCE(se.channel_code, 'Unknown') AS channel,
               COALESCE(cc.label, se.channel_code)  AS label,
               count(*)                             AS touches,
               COALESCE(sum(se.cost), 0)            AS cost,
               COALESCE(max(cc.cost_per_touch), 0)  AS unit_cost,
               count(*) FILTER (WHERE se.outcome IN ('CONTACTED','PROMISE_MADE','RESOLVED'))
                                                    AS responses,
               count(*) FILTER (WHERE se.outcome = 'PROMISE_MADE') AS promises
          FROM strategy_schema.step_event se
          LEFT JOIN strategy_schema.channel_cost cc ON cc.channel_code = se.channel_code
         GROUP BY 1, 2
         ORDER BY touches DESC"""))).mappings().all()

    return [
        schemas.ChannelEconomics(
            channel=r["channel"], label=r["label"] or r["channel"],
            touches=r["touches"], cost=round(_f(r["cost"]), 2),
            unitCost=round(_f(r["unit_cost"]), 4),
            responses=r["responses"],
            responseRate=_pct(_f(r["responses"]), _f(r["touches"])),
            promises=r["promises"],
            # What one engaged customer costs through this channel.
            costPerResponse=round(_f(r["cost"]) / _f(r["responses"]), 2)
                            if r["responses"] else None,
        )
        for r in rows
    ]


async def fatigue(db: AsyncSession) -> list[schemas.FatiguePoint]:
    """Does the nth message still work?

    Every strategy assumes persistence pays. This is the check: response rate
    against how many times the account has already been contacted. Where the
    curve flattens is where the extra touch is only costing money.
    """
    rows = (await db.execute(text("""
        WITH ordered AS (
            SELECT se.enrolment_id, se.cost,
                   se.outcome IN ('CONTACTED','PROMISE_MADE','RESOLVED') AS engaged,
                   row_number() OVER (PARTITION BY se.enrolment_id
                                      ORDER BY se.occurred_at) AS touch_no
              FROM strategy_schema.step_event se
        )
        SELECT LEAST(touch_no, 6) AS touch_no,
               count(*)                            AS touches,
               count(*) FILTER (WHERE engaged)     AS responses,
               COALESCE(sum(cost), 0)              AS cost
          FROM ordered
         GROUP BY 1 ORDER BY 1"""))).mappings().all()

    return [
        schemas.FatiguePoint(
            touchNo=r["touch_no"], touches=r["touches"], responses=r["responses"],
            responseRate=_pct(_f(r["responses"]), _f(r["touches"])),
            cost=round(_f(r["cost"]), 2),
        )
        for r in rows
    ]


async def coverage_gap(db: AsyncSession) -> list[schemas.CoverageGap]:
    """Money nobody has a plan for, by ageing bucket.

    An account on no strategy is not being worked by anything except an agent
    remembering it exists. This is the list that should be empty.
    """
    rows = (await db.execute(text("""
        SELECT COALESCE(a.aging_bucket, 'Current') AS bucket,
               count(*)                            AS accounts,
               COALESCE(sum(a.outstanding), 0)     AS outstanding,
               COALESCE(avg(a.dpd), 0)             AS avg_dpd,
               COALESCE(max(a.risk_level), '')     AS worst_risk
          FROM customer_schema.account a
         WHERE a.strategy_id IS NULL
         GROUP BY 1
         ORDER BY outstanding DESC"""))).mappings().all()
    return [
        schemas.CoverageGap(
            bucket=r["bucket"], accounts=r["accounts"],
            outstanding=round(_f(r["outstanding"]), 2),
            avgDpd=round(_f(r["avg_dpd"]), 0), worstRisk=r["worst_risk"] or None,
        )
        for r in rows
    ]


async def version_impact(db: AsyncSession) -> list[schemas.VersionImpact]:
    """Did the last edit help?

    Recovery in the 30 days after the most recent publish, against the 30 days
    before it. A strategy nobody has touched in months shows as stale rather
    than as improving.
    """
    rows = (await db.execute(text(f"""
        WITH last_pub AS (
            SELECT sv.strategy_id, max(sv.published_at) AS published_at
              FROM public.strategy_version sv
             WHERE sv.status = 'PUBLISHED'
             GROUP BY 1
        )
        SELECT s.strategy_code, s.name, s.current_version, lp.published_at,
               (CURRENT_DATE - lp.published_at::date) AS days_since,
               COALESCE(sum(pm.amount) FILTER (
                   WHERE pm.payment_date >= lp.published_at::date
                     AND pm.payment_date < lp.published_at::date + {WINDOW_DAYS}), 0) AS after_amt,
               COALESCE(sum(pm.amount) FILTER (
                   WHERE pm.payment_date >= lp.published_at::date - {WINDOW_DAYS}
                     AND pm.payment_date < lp.published_at::date), 0)      AS before_amt
          FROM public.strategy s
          JOIN last_pub lp ON lp.strategy_id = s.id
          LEFT JOIN {VIEW} v ON v.strategy_id = s.id
          LEFT JOIN customer_schema.payment pm
                 ON pm.account_id = v.account_id AND pm.status = 'COMPLETED'
         GROUP BY s.strategy_code, s.name, s.current_version, lp.published_at
         ORDER BY lp.published_at DESC"""))).mappings().all()

    out: list[schemas.VersionImpact] = []
    for r in rows:
        before, after = _f(r["before_amt"]), _f(r["after_amt"])
        days = int(r["days_since"] or 0)
        # The comparison is only fair once the 30-day window after the publish has
        # actually elapsed. Before that, one day of "after" against thirty days of
        # "before" would read as a collapse when nothing has happened yet.
        mature = days >= WINDOW_DAYS
        out.append(schemas.VersionImpact(
            strategyId=r["strategy_code"], name=r["name"], version=r["current_version"],
            publishedAt=r["published_at"], daysSince=days,
            collectedBefore=round(before, 2), collectedAfter=round(after, 2),
            windowDays=WINDOW_DAYS, mature=mature,
            changePct=round((after - before) / before * 100, 1)
                      if mature and before else None,
        ))
    return out


async def instrumentation(db: AsyncSession) -> schemas.Instrumentation:
    """How much of what the dashboard shows rests on recorded fact.

    The per-step funnel needs the strategy engine to stamp `node_id` on each
    execution. Until it does, this reports the gap rather than the dashboard
    quietly implying there is no drop-off.
    """
    r = (await db.execute(text("""
        SELECT count(*)                                        AS events,
               count(*) FILTER (WHERE node_id IS NOT NULL)     AS with_node,
               count(DISTINCT strategy_id)                     AS strategies
          FROM strategy_schema.step_event"""))).mappings().one()
    e = (await db.execute(text("""
        SELECT count(*)                                              AS total,
               count(*) FILTER (WHERE assignment_mode = 'BACKFILL')  AS backfilled
          FROM strategy_schema.enrolment"""))).mappings().one()
    return schemas.Instrumentation(
        stepEvents=r["events"], stepEventsWithNode=r["with_node"],
        nodeCoveragePct=_pct(_f(r["with_node"]), _f(r["events"])),
        enrolments=e["total"], backfilledEnrolments=e["backfilled"],
    )
