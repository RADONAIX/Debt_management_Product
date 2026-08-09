"""Reading and editing the risk scoring rules."""

from __future__ import annotations

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationFailedError
from app.modules.risk import schemas
from app.modules.risk.models import RiskScoreBand, RiskScoreDefinition


# Prediction output is produced outside this service and the table names are
# not user-controlled. Keep an explicit allow-list so a score code can never be
# interpolated into SQL as an identifier. Some model tables retain their source
# system's historical spelling/casing.
_ML_PREDICTION_TABLES: dict[str, str] = {
    "financial_stress": 'ml_predictions."financial_stress"',
    "responsibility": 'ml_predictions."Responsibility_model_results"',
    "credit_awareness": 'ml_predictions."credit_awareness_model_resluts"',
    "employment_stability": 'ml_predictions."employment_stability_model_results"',
    "overall_risk": 'ml_predictions."overall_risk_score_prediction_results"',
}


def _column_label(key: str) -> str:
    return key.replace("_", " ").title()


def to_schema(d: RiskScoreDefinition) -> schemas.ScoreDefinition:
    return schemas.ScoreDefinition(
        code=d.code,
        name=d.name,
        description=d.description,
        mode=d.mode,
        driverField=d.driver_field,
        weightPct=float(d.weight_pct),
        direction=d.direction,
        sortOrder=d.sort_order,
        isActive=d.is_active,
        bands=[
            schemas.Band(
                id=b.id,
                sortOrder=b.sort_order,
                minValue=float(b.min_value) if b.min_value is not None else None,
                score=float(b.score),
                label=b.label,
                bandValue=b.band_value,
            )
            for b in d.bands
        ],
    )


async def list_scores(db: AsyncSession) -> list[schemas.ScoreDefinition]:
    rows = (
        (await db.execute(select(RiskScoreDefinition).order_by(RiskScoreDefinition.sort_order)))
        .scalars()
        .unique()
        .all()
    )
    return [to_schema(d) for d in rows]


async def ml_prediction_sample(
    db: AsyncSession, code: str, limit: int = 10
) -> schemas.MlPredictionSample:
    """Read recent output for a score that is currently assigned to ML.

    Every ML-enabled score remains selectable even when its model has not
    produced a table yet. In that case the UI receives a normal empty result
    with an explanatory message instead of treating it as a broken request.
    """
    definition = await _get(db, code)
    if definition.mode != "ML":
        raise ValidationFailedError(f"{definition.name} is not currently set to ML.")

    qualified_table = _ML_PREDICTION_TABLES.get(code)
    if qualified_table is None:
        return schemas.MlPredictionSample(
            scoreCode=definition.code,
            scoreName=definition.name,
            available=False,
            message="No prediction table is available for this ML score yet.",
        )

    schema_name, quoted_table = qualified_table.split(".", 1)
    table_name = quoted_table.strip('"')
    column_rows = (
        await db.execute(
            text(
                """
                SELECT column_name, data_type
                  FROM information_schema.columns
                 WHERE table_schema = :schema AND table_name = :table
                 ORDER BY ordinal_position
                """
            ),
            {"schema": schema_name, "table": table_name},
        )
    ).mappings().all()

    if not column_rows:
        return schemas.MlPredictionSample(
            scoreCode=definition.code,
            scoreName=definition.name,
            tableName=f"{schema_name}.{table_name}",
            available=False,
            message="The configured prediction table could not be found.",
        )

    order_column = next(
        (c["column_name"] for c in column_rows if c["column_name"] == "predicted_at"),
        column_rows[0]["column_name"],
    )
    rows = (
        await db.execute(
            text(
                f'SELECT * FROM {qualified_table} '
                f'ORDER BY "{order_column}" DESC NULLS LAST LIMIT :limit'
            ),
            {"limit": limit},
        )
    ).mappings().all()

    return schemas.MlPredictionSample(
        scoreCode=definition.code,
        scoreName=definition.name,
        tableName=f"{schema_name}.{table_name}",
        available=True,
        columns=[
            schemas.MlPredictionColumn(
                key=c["column_name"],
                label=_column_label(c["column_name"]),
                dataType=c["data_type"],
            )
            for c in column_rows
        ],
        rows=[dict(row) for row in rows],
    )


async def _get(db: AsyncSession, code: str) -> RiskScoreDefinition:
    d = (
        await db.execute(select(RiskScoreDefinition).where(RiskScoreDefinition.code == code))
    ).scalar_one_or_none()
    if d is None:
        raise NotFoundError(f"Risk score '{code}' does not exist.")
    return d


async def update_score(
    db: AsyncSession, code: str, payload: schemas.ScoreUpdate
) -> schemas.ScoreDefinition:
    d = await _get(db, code)
    if payload.mode is not None:
        if payload.mode.upper() not in schemas.MODES:
            raise ValidationFailedError("Mode must be RULE or ML.")
        d.mode = payload.mode.upper()
    if payload.driverField is not None:
        if payload.driverField not in schemas.DRIVER_FIELDS:
            raise ValidationFailedError(
                f"Driver must be one of {', '.join(schemas.DRIVER_FIELDS)}."
            )
        d.driver_field = payload.driverField
    if payload.name is not None:
        d.name = payload.name
    if payload.description is not None:
        d.description = payload.description
    if payload.weightPct is not None:
        d.weight_pct = payload.weightPct
    if payload.direction is not None:
        d.direction = payload.direction
    if payload.isActive is not None:
        d.is_active = payload.isActive
    await db.flush()
    await db.refresh(d)
    return to_schema(d)


async def replace_bands(
    db: AsyncSession, code: str, payload: schemas.BandsUpdate
) -> schemas.ScoreDefinition:
    """Rewrite the threshold ladder, keeping the order the caller submitted.

    The ladder is evaluated top to bottom, so the order is a real decision and
    is preserved as sent. The one exception is the catch-all rung: anything
    below it could never be reached, so it is always moved to the end.
    """
    d = await _get(db, code)
    if sum(1 for b in payload.bands if b.minValue is None) > 1:
        raise ValidationFailedError("Only one catch-all band (no threshold) is allowed.")
    ordered = [b for b in payload.bands if b.minValue is not None]
    ordered += [b for b in payload.bands if b.minValue is None]

    await db.execute(delete(RiskScoreBand).where(RiskScoreBand.definition_id == d.id))
    for i, b in enumerate(ordered, start=1):
        db.add(
            RiskScoreBand(
                definition_id=d.id,
                sort_order=i,
                min_value=b.minValue,
                score=b.score,
                label=b.label,
                band_value=b.bandValue,
            )
        )
    await db.flush()
    await db.refresh(d)
    return to_schema(d)


# --- Scoring engine ---------------------------------------------------------
# What each driver field means in SQL, per subscriber line. These are the only
# values a rule can be written against, so the ladder is always computable.
DRIVER_SQL: dict[str, str] = {
    "dpd": "a.dpd",
    "outstanding": "a.outstanding",
    "contact_success_rate": (
        "COALESCE(a.contact_successes::numeric / NULLIF(a.contact_attempts, 0) * 100, 0)"
    ),
    "broken_ptp_count": (
        "(SELECT count(*) FROM customer_schema.ptp t"
        "  WHERE t.account_id = a.id AND t.status = 'BROKEN')"
    ),
    "dispute_count": (
        "(SELECT count(*) FROM customer_schema.dispute d WHERE d.account_id = a.id)"
    ),
    "customer_type": (
        "CASE c.customer_type WHEN 'GOVERNMENT' THEN 2 WHEN 'ENTERPRISE' THEN 1 ELSE 0 END"
    ),
    "credit_score": "COALESCE(c.credit_score, 650)",
    "monthly_bill": "COALESCE(a.monthly_bill, 0)",
}

_SCORE_COLUMNS = {
    "financial_stress": "financial_stress_score",
    "responsibility": "responsibility_score",
    "cooperation": "cooperation_score",
    "credit_awareness": "credit_awareness_score",
    "legal_awareness": "legal_awareness_score",
    "employment_stability": "employment_stability_score",
    "overall_risk": "overall_risk_score",
}


def _ladder_sql(definition: RiskScoreDefinition) -> str:
    """Turn one rule's bands into a CASE expression over its driver field."""
    driver = DRIVER_SQL.get(definition.driver_field or "", None)
    if driver is None or not definition.bands:
        return "NULL"
    rungs, fallback = [], "NULL"
    for band in definition.bands:                       # already in evaluation order
        if band.min_value is None:
            fallback = str(float(band.score))
        else:
            rungs.append(f"WHEN {driver} >= {float(band.min_value)} THEN {float(band.score)}")
    if not rungs:
        return fallback
    return "CASE " + " ".join(rungs) + f" ELSE {fallback} END"


async def build_scoring_sql(db: AsyncSession) -> tuple[str, list[str]]:
    """The INSERT that scores every line, built from the rules as configured."""
    definitions = (
        (await db.execute(select(RiskScoreDefinition).order_by(RiskScoreDefinition.sort_order)))
        .scalars().unique().all()
    )
    by_code = {d.code: d for d in definitions}

    selects, notes = [], []
    for code, column in _SCORE_COLUMNS.items():
        d = by_code.get(code)
        if d is None:
            selects.append(f"NULL AS {column}")
            continue
        if d.mode == "ML":
            # No model service yet: keep whatever was last written rather than
            # overwriting a model score with a rule result.
            selects.append(f"rp_old.{column} AS {column}")
            notes.append(f"{d.name} left to the ML model")
        elif code == "overall_risk":
            continue                                    # composed below
        else:
            selects.append(f"({_ladder_sql(d)})::numeric(6,2) AS {column}")

    # Overall = weighted mean of the rule-based components that carry a weight.
    weighted = [
        (by_code[c], w)
        for c in _SCORE_COLUMNS
        if c != "overall_risk"
        and (d := by_code.get(c)) is not None
        and d.mode == "RULE"
        and (w := float(d.weight_pct)) > 0
    ]
    overall_def = by_code.get("overall_risk")
    if weighted:
        total = sum(w for _, w in weighted)
        # A "higher is better" component (cooperation, responsibility) has to be
        # inverted before it can be added to a risk score, or a cooperative
        # customer would come out looking riskier than an evasive one.
        parts = " + ".join(
            f"({'100 - (' + _ladder_sql(d) + ')' if d.direction == 'HIGHER_BETTER' else _ladder_sql(d)}) * {w}"
            for d, w in weighted
        )
        overall = f"round((({parts}) / {total})::numeric, 2)"
        notes.append(
            "Overall = "
            + ", ".join(
                f"{d.name} {w:g}%{' (inverted)' if d.direction == 'HIGHER_BETTER' else ''}"
                for d, w in weighted
            )
        )
    elif overall_def is not None and overall_def.mode == "RULE":
        overall = f"({_ladder_sql(overall_def)})::numeric(6,2)"
        notes.append("Overall taken from its own threshold ladder")
    else:
        overall = "rp_old.overall_risk_score"
        notes.append("Overall left to the ML model")

    # A component scored "higher is better" must be inverted before it can be
    # read as risk; that is what `direction` records.
    sql = f"""
        INSERT INTO customer_schema.risk_profile AS rp (
            account_id, customer_id,
            financial_stress_score, responsibility_score, cooperation_score,
            credit_awareness_score, legal_awareness_score, employment_stability_score,
            overall_risk_score, risk_band, rules_version, computed_at
        )
        SELECT a.id, a.customer_id,
               {', '.join(s.split(' AS ')[0] + ' AS ' + s.split(' AS ')[1] for s in selects)},
               {overall} AS overall_risk_score,
               CASE
                 WHEN {overall} >= 75 THEN 'Critical'
                 WHEN {overall} >= 55 THEN 'High'
                 WHEN {overall} >= 30 THEN 'Medium'
                 ELSE 'Low'
               END AS risk_band,
               (SELECT max(updated_at) FROM administration.risk_score_definition),
               now()
          FROM customer_schema.account a
          JOIN customer_schema.customer c ON c.id = a.customer_id
          LEFT JOIN customer_schema.risk_profile rp_old ON rp_old.account_id = a.id
        ON CONFLICT (account_id) DO UPDATE SET
            financial_stress_score     = EXCLUDED.financial_stress_score,
            responsibility_score       = EXCLUDED.responsibility_score,
            cooperation_score          = EXCLUDED.cooperation_score,
            credit_awareness_score     = EXCLUDED.credit_awareness_score,
            legal_awareness_score      = EXCLUDED.legal_awareness_score,
            employment_stability_score = EXCLUDED.employment_stability_score,
            overall_risk_score         = EXCLUDED.overall_risk_score,
            risk_band                  = EXCLUDED.risk_band,
            rules_version              = EXCLUDED.rules_version,
            computed_at                = now()
    """
    return sql, notes


async def recalculate(db: AsyncSession) -> dict:
    """Run the rules over every subscriber line and store the result."""
    sql, notes = await build_scoring_sql(db)
    result = await db.execute(text(sql))
    await db.flush()
    summary = await score_summary(db)
    summary["scored"] = result.rowcount
    summary["notes"] = notes
    return summary


async def score_summary(db: AsyncSession) -> dict:
    rows = (
        await db.execute(
            text(
                "SELECT risk_band, count(*) AS lines,"
                "       round(avg(overall_risk_score), 1) AS avg_score,"
                "       round(sum(a.outstanding), 2) AS exposure"
                "  FROM customer_schema.risk_profile rp"
                "  JOIN customer_schema.account a ON a.id = rp.account_id"
                " GROUP BY risk_band"
            )
        )
    ).mappings().all()
    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    return {
        "bands": sorted(
            [
                {
                    "band": r["risk_band"],
                    "lines": r["lines"],
                    "avgScore": float(r["avg_score"] or 0),
                    "exposure": float(r["exposure"] or 0),
                }
                for r in rows
            ],
            key=lambda b: order.get(b["band"], 9),
        ),
        "computedAt": (
            await db.execute(text("SELECT max(computed_at) FROM customer_schema.risk_profile"))
        ).scalar_one(),
    }


async def sample_profiles(db: AsyncSession, limit: int = 12) -> list[dict]:
    """A few scored lines, so the screen shows what the rules actually produced."""
    rows = (
        await db.execute(
            text(
                "SELECT COALESCE(c.full_name, c.company_name, c.customer_code) AS name,"
                "       a.subscriber_no, a.dpd, a.outstanding,"
                "       rp.financial_stress_score, rp.responsibility_score, rp.cooperation_score,"
                "       rp.credit_awareness_score, rp.legal_awareness_score,"
                "       rp.employment_stability_score, rp.overall_risk_score, rp.risk_band"
                "  FROM customer_schema.risk_profile rp"
                "  JOIN customer_schema.account a  ON a.id = rp.account_id"
                "  JOIN customer_schema.customer c ON c.id = rp.customer_id"
                " ORDER BY rp.overall_risk_score DESC NULLS LAST"
                " LIMIT :limit"
            ),
            {"limit": limit},
        )
    ).mappings().all()
    return [
        {
            "name": r["name"],
            "subscriberNo": r["subscriber_no"],
            "dpd": r["dpd"],
            "outstanding": float(r["outstanding"]),
            "financialStress": _num(r["financial_stress_score"]),
            "responsibility": _num(r["responsibility_score"]),
            "cooperation": _num(r["cooperation_score"]),
            "creditAwareness": _num(r["credit_awareness_score"]),
            "legalAwareness": _num(r["legal_awareness_score"]),
            "employmentStability": _num(r["employment_stability_score"]),
            "overall": _num(r["overall_risk_score"]),
            "band": r["risk_band"],
        }
        for r in rows
    ]


def _num(v) -> float | None:
    return float(v) if v is not None else None


# --- Subscriber risk profile ------------------------------------------------
# The aggregate columns from the scoring query, computed once per subscriber
# line. The rule ladders are then evaluated against these, so a threshold change
# on screen changes the stored profile on the next run.
_PROFILE_AGGREGATES = """
    SELECT
        c.id  AS subscriber_id,
        max(a.dpd)                                       AS dpd,
        sum(a.outstanding)                               AS outstanding,
        sum(a.contact_attempts)                          AS contact_attempts,
        sum(a.contact_successes)                         AS contact_successes,
        max(c.customer_type)                             AS customer_type,
        max(COALESCE(c.credit_score, 650))               AS credit_score,
        max((DATE_PART('year',  AGE(CURRENT_DATE, a.activation_date)) * 12
           + DATE_PART('month', AGE(CURRENT_DATE, a.activation_date)))::int)
                                                         AS account_age_months,
        COALESCE(sum(inv.total), 0)                      AS invoices_last_12m,
        COALESCE(sum(inv.on_time), 0)                    AS invoices_paid_on_time,
        COALESCE(avg(inv.avg_delay), 0)                  AS avg_payment_delay_days,
        COALESCE(sum(pt.total), 0)                       AS ptp_count,
        COALESCE(sum(pt.honoured), 0)                    AS ptp_honoured,
        COALESCE(sum(pt.broken), 0)                      AS ptp_broken,
        COALESCE(sum(ds.total), 0)                       AS disputes_raised,
        CASE WHEN sum(a.contact_attempts) > 0
             THEN sum(a.contact_successes)::numeric / sum(a.contact_attempts) * 100
             ELSE 0 END                                  AS contact_success_rate,
        max(CASE c.customer_type WHEN 'GOVERNMENT' THEN 2 WHEN 'ENTERPRISE' THEN 1 ELSE 0 END)
                                                         AS customer_type_rank
      FROM customer_schema.customer c
      JOIN customer_schema.account a ON a.customer_id = c.id
      LEFT JOIN LATERAL (
          -- Billing over the last twelve cycles, and how late settlement was.
          SELECT count(*) AS total,
                 count(*) FILTER (WHERE i.status = 'PAID') AS on_time,
                 COALESCE(avg(GREATEST(0, pay.paid_on - i.due_date)), 0) AS avg_delay
            FROM customer_schema.invoice i
            LEFT JOIN LATERAL (
                SELECT max(p.payment_date) AS paid_on
                  FROM customer_schema.payment p
                 WHERE p.invoice_id = i.id
            ) pay ON TRUE
           WHERE i.account_id = a.id
             AND i.due_date >= CURRENT_DATE - INTERVAL '12 months'
      ) inv ON TRUE
      LEFT JOIN LATERAL (
          SELECT count(*) AS total,
                 count(*) FILTER (WHERE t.status IN ('KEPT','HONOURED')) AS honoured,
                 count(*) FILTER (WHERE t.status = 'BROKEN') AS broken
            FROM customer_schema.ptp t WHERE t.account_id = a.id
      ) pt ON TRUE
      LEFT JOIN LATERAL (
          SELECT count(*) AS total
            FROM customer_schema.dispute d WHERE d.account_id = a.id
      ) ds ON TRUE
     GROUP BY c.id
"""

# Which aggregate each driver field reads, inside the CTE above.
_PROFILE_DRIVER = {
    "dpd": "s.dpd",
    "outstanding": "s.outstanding",
    "contact_success_rate": "s.contact_success_rate",
    "broken_ptp_count": "s.ptp_broken",
    "dispute_count": "s.disputes_raised",
    "customer_type": "s.customer_type_rank",
    "credit_score": "s.credit_score",
    "monthly_bill": "s.outstanding",
}

_PROFILE_SCORES = [
    ("financial_stress", "financial_stress_score"),
    ("responsibility", "responsibility_score"),
    ("cooperation", "cooperation_score"),
    ("credit_awareness", "credit_awareness_score"),
    ("legal_awareness", "legal_awareness_score"),
    ("financial_literacy", "financial_literacy_score"),
    ("employment_stability", "employment_stability_score"),
]


def _profile_ladder(d: RiskScoreDefinition) -> str:
    driver = _PROFILE_DRIVER.get(d.driver_field or "")
    if driver is None or not d.bands:
        return "NULL"
    rungs, fallback = [], "NULL"
    for band in d.bands:
        if band.min_value is None:
            fallback = str(float(band.score))
        else:
            rungs.append(f"WHEN {driver} >= {float(band.min_value)} THEN {float(band.score)}")
    return ("CASE " + " ".join(rungs) + f" ELSE {fallback} END") if rungs else fallback


async def recalculate_subscriber_profiles(db: AsyncSession) -> dict:
    """Rebuild subscriber_risk_profile from the rules that are RULE-based.

    Components switched to ML keep whatever the model last wrote, so turning a
    switch on does not wipe its score.
    """
    definitions = {
        d.code: d
        for d in (
            (await db.execute(select(RiskScoreDefinition))).scalars().unique().all()
        )
    }

    columns, skipped = [], []
    for code, column in _PROFILE_SCORES:
        d = definitions.get(code)
        if d is None or d.mode == "ML":
            columns.append(f"old.{column} AS {column}")
            if d is not None:
                skipped.append(d.name)
        else:
            columns.append(f"({_profile_ladder(d)})::numeric AS {column}")

    overall = definitions.get("overall_risk")
    weighted = [
        (d, float(d.weight_pct))
        for code, d in definitions.items()
        if code != "overall_risk" and d.mode == "RULE" and float(d.weight_pct) > 0
    ]
    if weighted:
        total = sum(w for _, w in weighted)
        parts = " + ".join(
            f"({'100 - (' + _profile_ladder(d) + ')' if d.direction == 'HIGHER_BETTER' else _profile_ladder(d)}) * {w}"
            for d, w in weighted
        )
        overall_sql = f"ROUND((({parts}) / {total})::numeric, 2)"
    elif overall and overall.mode == "RULE":
        overall_sql = f"({_profile_ladder(overall)})::numeric"
    else:
        overall_sql = "old.overall_risk_score"

    sql = f"""
        WITH s AS ({_PROFILE_AGGREGATES})
        INSERT INTO customer_schema.subscriber_risk_profile (
            subscriber_id, account_age_months, invoices_last_12m, invoices_paid_on_time,
            avg_payment_delay_days, ptp_count, ptp_honoured, ptp_broken, disputes_raised,
            successful_contacts, failed_contacts,
            {', '.join(col for _, col in _PROFILE_SCORES)},
            overall_risk_score, behaviour_type, risk_band, recommended_strategy, last_calculated
        )
        SELECT s.subscriber_id, s.account_age_months, s.invoices_last_12m,
               -- Never report more settled on time than were billed.
               LEAST(s.invoices_paid_on_time, s.invoices_last_12m),
               ROUND(s.avg_payment_delay_days, 2),
               s.ptp_count, s.ptp_honoured, s.ptp_broken, s.disputes_raised,
               s.contact_successes,
               GREATEST(0, s.contact_attempts - s.contact_successes),
               {', '.join(columns)},
               {overall_sql} AS overall_risk_score,
               CASE
                 WHEN s.ptp_broken >= 3               THEN 'Habitual Defaulter'
                 WHEN s.contact_successes = 0         THEN 'Avoidant'
                 WHEN s.outstanding > 5000            THEN 'High Value'
                 WHEN s.customer_type = 'ENTERPRISE'  THEN 'Corporate'
                 WHEN s.dpd < 30 AND s.contact_successes > 5 THEN 'Reliable'
                 WHEN s.dpd < 60                      THEN 'Cooperative'
                 ELSE 'Financially Distressed'
               END,
               CASE WHEN s.dpd < 30 THEN 'LOW' WHEN s.dpd < 60 THEN 'MEDIUM'
                    WHEN s.dpd < 90 THEN 'HIGH' ELSE 'CRITICAL' END,
               CASE WHEN s.dpd < 30 THEN 'Early Reminder' WHEN s.dpd < 60 THEN 'Soft Collection'
                    WHEN s.dpd < 90 THEN 'Intensive Collection' ELSE 'Legal Escalation' END,
               now()
          FROM s
          LEFT JOIN customer_schema.subscriber_risk_profile old
                 ON old.subscriber_id = s.subscriber_id
        ON CONFLICT (subscriber_id) DO UPDATE SET
            account_age_months = EXCLUDED.account_age_months,
            invoices_last_12m = EXCLUDED.invoices_last_12m,
            invoices_paid_on_time = EXCLUDED.invoices_paid_on_time,
            avg_payment_delay_days = EXCLUDED.avg_payment_delay_days,
            ptp_count = EXCLUDED.ptp_count,
            ptp_honoured = EXCLUDED.ptp_honoured,
            ptp_broken = EXCLUDED.ptp_broken,
            disputes_raised = EXCLUDED.disputes_raised,
            successful_contacts = EXCLUDED.successful_contacts,
            failed_contacts = EXCLUDED.failed_contacts,
            {', '.join(f'{col} = EXCLUDED.{col}' for _, col in _PROFILE_SCORES)},
            overall_risk_score = EXCLUDED.overall_risk_score,
            behaviour_type = EXCLUDED.behaviour_type,
            risk_band = EXCLUDED.risk_band,
            recommended_strategy = EXCLUDED.recommended_strategy,
            last_calculated = now()
    """
    result = await db.execute(text(sql))
    await db.flush()
    return {"profiles": result.rowcount, "mlComponents": skipped}


async def band_values(db: AsyncSession) -> dict[str, list[dict]]:
    """The band ladders, so a stored score can be mapped back to its grade."""
    rows = (
        await db.execute(
            text(
                "SELECT d.code, b.sort_order, b.min_value, b.score, b.band_value"
                "  FROM administration.risk_score_definition d"
                "  JOIN administration.risk_score_band b ON b.definition_id = d.id"
                " ORDER BY d.code, b.sort_order"
            )
        )
    ).mappings().all()
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r["code"], []).append(
            {
                "score": float(r["score"]),
                "value": r["band_value"],
                "minValue": float(r["min_value"]) if r["min_value"] is not None else None,
            }
        )
    return out


def grade_for(bands: list[dict], score: float | None) -> str | None:
    """The band value whose score a stored component score matches."""
    if score is None or not bands:
        return None
    # Bands are ordered by evaluation; match the closest score.
    return min(bands, key=lambda b: abs(b["score"] - float(score)))["value"]


# --- Risk-scored customers --------------------------------------------------
_RISK_CUSTOMERS_SQL = text("""
    SELECT v.customer_code, v.customer_name, v.customer_type, v.segment,
           max(v.dpd)                              AS dpd,
           sum(v.outstanding)                      AS outstanding,
           avg(v.contactability)                   AS contactability,
           avg(v.recovery_probability)             AS recovery_probability,
           max(v.risk_score)                       AS risk_score,
           max(v.credit_score)                     AS credit_score,
           string_agg(DISTINCT v.behaviour_profile, ', ') AS behaviour,
           max(v.risk_level)                       AS risk_level,
           sum(v.ptp_broken)                       AS ptp_broken,
           sum(v.dispute_count)                    AS disputes,
           max(p.account_age_months)               AS tenure_months,
           max(p.avg_payment_delay_days)           AS avg_delay,
           max(p.recommended_strategy)             AS recommended_strategy,
           max(p.responsibility_score)             AS responsibility_score,
           max(p.cooperation_score)                AS cooperation_score,
           max(p.employment_stability_score)       AS employment_stability_score,
           max(p.financial_literacy_score)         AS financial_literacy_score,
           max(p.credit_awareness_score)           AS credit_awareness_score,
           max(p.legal_awareness_score)            AS legal_awareness_score,
           max(p.financial_stress_score)           AS financial_stress_score,
           max(v.last_contact_at)                  AS last_contact
      FROM customer_schema.risk_grid_account_view v
      LEFT JOIN customer_schema.subscriber_risk_profile p
             ON p.subscriber_id = v.customer_id
     GROUP BY v.customer_code, v.customer_name, v.customer_type, v.segment
     ORDER BY max(v.risk_score) DESC, sum(v.outstanding) DESC
""")


def _f(v) -> float | None:
    return float(v) if v is not None else None


async def risk_customers(db: AsyncSession) -> list[dict]:
    """Every customer with their scored risk — what the Risk Customers tab lists."""
    rows = (await db.execute(_RISK_CUSTOMERS_SQL)).mappings().all()
    out = []
    for r in rows:
        score = float(r["risk_score"] or 0)
        band = (
            "critical" if score >= 75 else "high" if score >= 55
            else "medium" if score >= 30 else "low"
        )
        out.append(
            {
                "id": r["customer_code"],
                "name": r["customer_name"],
                "segment": (r["segment"] or r["customer_type"] or "").title(),
                "customerType": r["customer_type"],
                "overdueDays": int(r["dpd"] or 0),
                "outstanding": float(r["outstanding"] or 0),
                "riskScore": round(score, 1),
                "riskBand": band,
                "contactability": round(float(r["contactability"] or 0), 1),
                "recoveryProbability": round(float(r["recovery_probability"] or 0), 1),
                # The complement of recovery is what we expect to lose.
                "probabilityOfDefault": round(100 - float(r["recovery_probability"] or 0), 1),
                "creditScore": int(r["credit_score"]) if r["credit_score"] else None,
                "behaviour": r["behaviour"],
                "brokenPromises": int(r["ptp_broken"] or 0),
                "disputes": int(r["disputes"] or 0),
                "tenureMonths": int(r["tenure_months"] or 0),
                "avgPaymentDelay": float(r["avg_delay"] or 0),
                "recommendedStrategy": r["recommended_strategy"],
                # Scored components straight from subscriber_risk_profile.
                "responsibilityScore": _f(r["responsibility_score"]),
                "cooperationScore": _f(r["cooperation_score"]),
                "employmentStabilityScore": _f(r["employment_stability_score"]),
                "financialLiteracyScore": _f(r["financial_literacy_score"]),
                "creditAwarenessScore": _f(r["credit_awareness_score"]),
                "legalAwarenessScore": _f(r["legal_awareness_score"]),
                "financialStressScore": _f(r["financial_stress_score"]),
                "lastContact": r["last_contact"],
            }
        )
    return out
