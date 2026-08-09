"""Target audience sizing for the Strategy Designer.

Answers one question honestly: if a strategy targeted *this* set of criteria,
how much of the book would it actually pick up? Both the criteria offered and
the count returned come from the live book, so an option can never be one that
matches nothing, and the count can never be a guess.

Counts are reported three ways because a collections strategy is aimed at all
three: customers (who you will talk to), accounts (the lines you will work) and
outstanding (the money at stake).
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.strategies import schemas

# Contactability is stored 0-100 on the account.
_CONTACTABILITY = {
    "high": ("High (over 70%)", "a.contactability > 70"),
    "medium": ("Medium (40-70%)", "a.contactability BETWEEN 40 AND 70"),
    "low": ("Low (under 40%)", "a.contactability < 40"),
}

# Credit banding follows the usual score bands; the boundaries are spelled out
# in the label so nobody has to guess what "Class B" means.
_CREDIT = {
    "a": ("Class A · 750+", "c.credit_score >= 750"),
    "b": ("Class B · 650-749", "c.credit_score BETWEEN 650 AND 749"),
    "c": ("Class C · 550-649", "c.credit_score BETWEEN 550 AND 649"),
    "d": ("Class D · under 550", "c.credit_score < 550"),
}

_FROM = """
    FROM customer_schema.account a
    JOIN customer_schema.customer c ON c.id = a.customer_id
"""


def _f(v) -> float:
    return float(v or 0)


def _balance_bands(hi: float) -> dict[str, tuple[str, str]]:
    """Balance bands scaled to the book that actually exists.

    Fixed thresholds age badly — a band of "over $1M" on a book whose largest
    balance is a few thousand offers a filter that can never match. Splitting
    the observed range in three keeps every band reachable.
    """
    if hi <= 0:
        return {}
    low, mid = round(hi / 3), round(hi * 2 / 3)
    return {
        "high": (f"High · over {mid:,.0f}", f"a.outstanding > {mid}"),
        "mid": (f"Medium · {low:,.0f}-{mid:,.0f}", f"a.outstanding BETWEEN {low} AND {mid}"),
        "low": (f"Low · under {low:,.0f}", f"a.outstanding < {low}"),
    }


async def options(db: AsyncSession) -> schemas.AudienceOptions:
    """The criteria on offer, each carrying how much of the book it covers.

    Every option is read from the data, so the designer can only choose filters
    that match something.
    """
    segments = (await db.execute(text(f"""
        SELECT c.customer_type AS value, count(DISTINCT c.id) AS customers,
               count(*) AS accounts
        {_FROM}
        WHERE c.customer_type IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC"""))).mappings().all()

    buckets = (await db.execute(text(f"""
        SELECT COALESCE(a.aging_bucket, 'Current') AS value,
               count(DISTINCT c.id) AS customers, count(*) AS accounts
        {_FROM}
        GROUP BY 1
        ORDER BY CASE COALESCE(a.aging_bucket, 'Current')
                   WHEN 'Current' THEN 0 WHEN '1-30' THEN 1 WHEN '31-60' THEN 2
                   WHEN '61-90' THEN 3 ELSE 4 END"""))).mappings().all()

    spread = (await db.execute(text(f"""
        SELECT COALESCE(min(a.risk_score), 0)   AS risk_min,
               COALESCE(max(a.risk_score), 100) AS risk_max,
               COALESCE(max(a.outstanding), 0)  AS balance_max
        {_FROM}"""))).mappings().one()

    async def bucketed(defs: dict[str, tuple[str, str]]) -> list[schemas.AudienceOption]:
        out: list[schemas.AudienceOption] = []
        for value, (label, clause) in defs.items():
            r = (await db.execute(text(f"""
                SELECT count(DISTINCT c.id) AS customers, count(*) AS accounts
                {_FROM} WHERE {clause}"""))).mappings().one()
            out.append(schemas.AudienceOption(
                value=value, label=label,
                customers=r["customers"], accounts=r["accounts"]))
        return out

    return schemas.AudienceOptions(
        segments=[schemas.AudienceOption(
            value=s["value"], label=s["value"].title(),
            customers=s["customers"], accounts=s["accounts"]) for s in segments],
        agingBuckets=[schemas.AudienceOption(
            value=b["value"], label=b["value"],
            customers=b["customers"], accounts=b["accounts"]) for b in buckets],
        riskMin=round(_f(spread["risk_min"])),
        riskMax=round(_f(spread["risk_max"])),
        contactability=await bucketed(_CONTACTABILITY),
        balanceBands=await bucketed(_balance_bands(_f(spread["balance_max"]))),
        creditClasses=await bucketed(_CREDIT),
    )


async def estimate(
    db: AsyncSession, *, segment: str | None, aging_bucket: str | None,
    risk_min: float | None, risk_max: float | None, contactability: str | None,
    balance_band: str | None, credit_class: str | None,
) -> schemas.AudienceEstimate:
    """How much of the book the given criteria actually select."""
    clauses: list[str] = []
    params: dict = {}

    if segment:
        clauses.append("c.customer_type = :segment")
        params["segment"] = segment.upper()
    if aging_bucket:
        clauses.append("COALESCE(a.aging_bucket, 'Current') = :bucket")
        params["bucket"] = aging_bucket
    if risk_min is not None:
        clauses.append("a.risk_score >= :risk_min")
        params["risk_min"] = risk_min
    if risk_max is not None:
        clauses.append("a.risk_score <= :risk_max")
        params["risk_max"] = risk_max
    # The banded filters are whitelisted, never interpolated from user input.
    if contactability and contactability in _CONTACTABILITY:
        clauses.append(_CONTACTABILITY[contactability][1])
    if credit_class and credit_class in _CREDIT:
        clauses.append(_CREDIT[credit_class][1])
    if balance_band:
        hi = _f((await db.execute(text(
            "SELECT COALESCE(max(outstanding), 0) FROM customer_schema.account"))).scalar())
        bands = _balance_bands(hi)
        if balance_band in bands:
            clauses.append(bands[balance_band][1])

    where = " AND ".join(clauses) or "TRUE"
    r = (await db.execute(text(f"""
        SELECT count(DISTINCT c.id)               AS customers,
               count(*)                           AS accounts,
               COALESCE(sum(a.outstanding), 0)    AS outstanding,
               COALESCE(avg(a.dpd), 0)            AS avg_dpd,
               COALESCE(avg(a.risk_score), 0)     AS avg_risk
        {_FROM} WHERE {where}"""), params)).mappings().one()

    total = (await db.execute(text(f"""
        SELECT count(DISTINCT c.id) AS customers, count(*) AS accounts,
               COALESCE(sum(a.outstanding), 0) AS outstanding
        {_FROM}"""))).mappings().one()

    accounts, all_accounts = r["accounts"], total["accounts"] or 1
    return schemas.AudienceEstimate(
        customers=r["customers"], accounts=accounts,
        outstanding=round(_f(r["outstanding"]), 2),
        avgDpd=round(_f(r["avg_dpd"]), 1),
        avgRisk=round(_f(r["avg_risk"]), 1),
        # What share of the whole book this strategy would take on.
        shareOfAccountsPct=round(accounts / all_accounts * 100, 1),
        shareOfValuePct=round(
            _f(r["outstanding"]) / _f(total["outstanding"]) * 100, 1)
            if _f(total["outstanding"]) else 0.0,
        totalCustomers=total["customers"], totalAccounts=total["accounts"],
    )
