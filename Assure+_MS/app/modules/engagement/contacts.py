"""Contact history — every conversation the operation has had with a customer.

The AI Engagement Center's other two tabs were a grid of hardcoded numbers and
a set of literal chart arrays. This reads the record that actually exists:
`customer_schema.case_activity`, where every call, SMS, email, WhatsApp, IVR
and voicebot exchange is already written by the rest of the product.

It is deliberately about the conversation, not the money. What was attempted,
on which channel, whether anyone was reached, what came of it, and who did it —
the questions an engagement desk asks. Balances and recovery belong to the
Collections and Portfolio dashboards.
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.engagement import schemas

# Contact types, as distinct from the internal bookkeeping entries that share
# the table (status changes, notes, system rows).
CONVERSATIONS = ("CALL", "SMS", "EMAIL", "WHATSAPP", "VOICEBOT", "IVR", "CHAT")

_TYPES = "'" + "', '".join(CONVERSATIONS) + "'"


def _f(v) -> float:
    return float(v) if v is not None else 0.0


def _pct(part: float, whole: float) -> float | None:
    return round(part / whole * 100, 1) if whole else None


# An attempt lands in one of three states. Carrying an outcome is not the same
# as reaching anybody — a "no answer" is recorded just as diligently — and a
# delivery receipt on a message is not a conversation either.
_STATE = """
    CASE
      WHEN ca.outcome IS NULL OR btrim(ca.outcome) = ''            THEN 'UNKNOWN'
      WHEN upper(ca.outcome) LIKE 'NO%ANSWER%'
        OR upper(ca.outcome) IN ('BUSY', 'FAILED', 'BOUNCED',
                                 'UNREACHABLE', 'VOICEMAIL')       THEN 'NO_ANSWER'
      WHEN upper(ca.outcome) IN ('DELIVERED', 'OPENED', 'READ', 'SENT')
        OR upper(ca.outcome) LIKE 'REMINDER SENT%'                 THEN 'DELIVERED'
      ELSE 'REACHED'
    END"""

_REACHED = f"({_STATE}) = 'REACHED'"
# Only attempts where somebody could have answered count towards the rate; a
# message that was merely delivered belongs to neither side of it.
_ANSWERABLE = f"({_STATE}) IN ('REACHED', 'NO_ANSWER')"


async def summary(db: AsyncSession, agent_id: int | None, days: int
                  ) -> schemas.ContactSummary:
    p = {"a": agent_id, "d": days}
    scope = ("(CAST(:a AS bigint) IS NULL OR ca.agent_id = CAST(:a AS bigint))"
             f" AND ca.activity_type IN ({_TYPES})"
             " AND ca.occurred_at > now() - make_interval(days => :d)")

    totals = (await db.execute(text(f"""
        SELECT count(*)                                             AS attempts,
               count(*) FILTER (WHERE {_REACHED})                   AS reached,
               count(*) FILTER (WHERE {_ANSWERABLE})                AS answerable,
               count(*) FILTER (WHERE ({_STATE}) = 'NO_ANSWER')     AS no_answer,
               count(*) FILTER (WHERE ({_STATE}) = 'DELIVERED')     AS delivered,
               count(DISTINCT ca.customer_id)                       AS customers,
               count(*) FILTER (WHERE ca.is_automated)              AS automated,
               count(*) FILTER (WHERE ca.direction = 'INBOUND')     AS inbound,
               count(*) FILTER (WHERE ca.occurred_at::date = CURRENT_DATE) AS today,
               count(DISTINCT ca.agent_id)                          AS agents
        FROM customer_schema.case_activity ca
        WHERE {scope}"""), p)).mappings().one()

    # A promise or a payment landing within two days of a conversation is the
    # closest this data comes to an outcome for that conversation.
    converted = (await db.execute(text(f"""
        SELECT count(DISTINCT ca.id) FROM customer_schema.case_activity ca
        WHERE {scope} AND EXISTS (
            SELECT 1 FROM customer_schema.ptp t
            WHERE t.customer_id = ca.customer_id
              AND t.created_at BETWEEN ca.occurred_at AND ca.occurred_at + interval '2 days')"""),
        p)).scalar_one()

    channels = [
        schemas.ChannelLine(
            channel=r["channel"], attempts=r["attempts"], reached=r["reached"],
            reachRate=_pct(_f(r["reached"]), _f(r["answerable"])),
            automated=r["automated"])
        for r in (await db.execute(text(f"""
            SELECT COALESCE(NULLIF(ca.channel_code, ''), ca.activity_type) AS channel,
                   count(*) AS attempts,
                   count(*) FILTER (WHERE {_REACHED}) AS reached,
                   count(*) FILTER (WHERE {_ANSWERABLE}) AS answerable,
                   count(*) FILTER (WHERE ca.is_automated) AS automated
            FROM customer_schema.case_activity ca
            WHERE {scope} GROUP BY 1 ORDER BY 2 DESC"""), p)).mappings().all()]

    outcomes = [
        schemas.OutcomeLine(outcome=r["outcome"], count=r["n"])
        for r in (await db.execute(text(f"""
            SELECT ca.outcome, count(*) AS n
            FROM customer_schema.case_activity ca
            WHERE {scope} AND {_REACHED}
            GROUP BY 1 ORDER BY 2 DESC LIMIT 8"""), p)).mappings().all()]

    by_day = [
        schemas.DayLine(day=r["day"], attempts=r["attempts"], reached=r["reached"],
                        automated=r["automated"])
        for r in (await db.execute(text(f"""
            WITH days AS (
                SELECT generate_series(CURRENT_DATE - (:d - 1), CURRENT_DATE,
                                       interval '1 day')::date AS d
            )
            SELECT days.d AS day,
                   count(ca.id) AS attempts,
                   count(ca.id) FILTER (WHERE {_REACHED}) AS reached,
                   count(ca.id) FILTER (WHERE ca.is_automated) AS automated
            FROM days
            LEFT JOIN customer_schema.case_activity ca
                   ON ca.occurred_at::date = days.d
                  AND ca.activity_type IN ({_TYPES})
                  AND (CAST(:a AS bigint) IS NULL OR ca.agent_id = CAST(:a AS bigint))
            GROUP BY days.d ORDER BY days.d"""), p)).mappings().all()]

    # When customers actually pick up, which is what a dialer schedule needs.
    hours = [
        schemas.HourLine(hour=r["hour"], attempts=r["attempts"], reached=r["reached"],
                         reachRate=_pct(_f(r["reached"]), _f(r["answerable"])))
        for r in (await db.execute(text(f"""
            SELECT EXTRACT(HOUR FROM ca.occurred_at)::int AS hour,
                   count(*) AS attempts,
                   count(*) FILTER (WHERE {_REACHED}) AS reached,
                   count(*) FILTER (WHERE {_ANSWERABLE}) AS answerable
            FROM customer_schema.case_activity ca
            WHERE {scope} GROUP BY 1 ORDER BY 1"""), p)).mappings().all()]

    agents = [
        schemas.AgentContactLine(
            agentId=r["agent_id"], agentName=r["agent_name"], attempts=r["attempts"],
            reached=r["reached"], reachRate=_pct(_f(r["reached"]), _f(r["answerable"])),
            customers=r["customers"])
        for r in (await db.execute(text(f"""
            SELECT ca.agent_id, COALESCE(u.full_name, 'Automated') AS agent_name,
                   count(*) AS attempts,
                   count(*) FILTER (WHERE {_REACHED}) AS reached,
                   count(*) FILTER (WHERE {_ANSWERABLE}) AS answerable,
                   count(DISTINCT ca.customer_id) AS customers
            FROM customer_schema.case_activity ca
            LEFT JOIN administration.app_user u ON u.id = ca.agent_id
            WHERE {scope}
            GROUP BY 1, 2 ORDER BY 3 DESC"""), p)).mappings().all()]

    attempts = totals["attempts"]
    return schemas.ContactSummary(
        days=days,
        attempts=attempts, reached=totals["reached"],
        noAnswer=totals["no_answer"], delivered=totals["delivered"],
        answerable=totals["answerable"],
        # Of the attempts somebody could have answered, the share that connected.
        reachRate=_pct(_f(totals["reached"]), _f(totals["answerable"])),
        customers=totals["customers"], agents=totals["agents"],
        automated=totals["automated"],
        automatedShare=_pct(_f(totals["automated"]), _f(attempts)),
        inbound=totals["inbound"], today=totals["today"],
        ledToPromise=converted,
        promiseRate=_pct(_f(converted), _f(totals["reached"])),
        channels=channels, outcomes=outcomes, byDay=by_day, byHour=hours, agents_=agents)


async def history(db: AsyncSession, *, agent_id: int | None, days: int,
                  channel: str | None = None, direction: str | None = None,
                  reached: bool | None = None, search: str | None = None,
                  limit: int = 100, offset: int = 0
                  ) -> list[schemas.ContactRow]:
    """The conversations themselves, newest first."""
    where = [
        f"ca.activity_type IN ({_TYPES})",
        "ca.occurred_at > now() - make_interval(days => :d)",
        "(CAST(:a AS bigint) IS NULL OR ca.agent_id = CAST(:a AS bigint))",
    ]
    p: dict = {"a": agent_id, "d": days, "lim": limit, "off": offset}
    if channel:
        where.append("COALESCE(NULLIF(ca.channel_code, ''), ca.activity_type) = :ch")
        p["ch"] = channel
    if direction:
        where.append("ca.direction = :dir")
        p["dir"] = direction
    if reached is True:
        where.append(_REACHED)
    elif reached is False:
        where.append(f"NOT ({_REACHED})")
    if search:
        where.append("(c.full_name ILIKE :q OR co.name ILIKE :q OR c.customer_code ILIKE :q "
                     "OR ca.subject ILIKE :q OR ca.outcome ILIKE :q)")
        p["q"] = f"%{search}%"

    rows = (await db.execute(text(f"""
        SELECT ca.id, ca.activity_type, ca.channel_code, ca.direction, ca.subject,
               ca.body, ca.outcome, ca.is_automated, ca.occurred_at, ca.case_id,
               c.customer_code, COALESCE(c.full_name, co.name, c.customer_code) AS who,
               co.name AS company, u.full_name AS agent_name,
               dc.case_code
        FROM customer_schema.case_activity ca
        JOIN customer_schema.customer c ON c.id = ca.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        LEFT JOIN administration.app_user u ON u.id = ca.agent_id
        LEFT JOIN customer_schema.debt_case dc ON dc.id = ca.case_id
        WHERE {' AND '.join(where)}
        ORDER BY ca.occurred_at DESC
        LIMIT :lim OFFSET :off"""), p)).mappings().all()

    return [
        schemas.ContactRow(
            id=r["id"], kind=r["activity_type"],
            channel=r["channel_code"] or r["activity_type"],
            direction=r["direction"], subject=r["subject"],
            body=(r["body"] or "")[:400] or None, outcome=r["outcome"],
            isAutomated=r["is_automated"], occurredAt=r["occurred_at"],
            customerId=r["customer_code"], customerName=r["who"], companyName=r["company"],
            agentName=r["agent_name"], caseId=r["case_id"], caseNumber=r["case_code"])
        for r in rows]


async def options(db: AsyncSession) -> schemas.ContactOptions:
    channels = [r[0] for r in (await db.execute(text(f"""
        SELECT DISTINCT COALESCE(NULLIF(channel_code, ''), activity_type) AS ch
        FROM customer_schema.case_activity
        WHERE activity_type IN ({_TYPES}) ORDER BY 1"""))).all()]
    directions = [r[0] for r in (await db.execute(text(f"""
        SELECT DISTINCT direction FROM customer_schema.case_activity
        WHERE activity_type IN ({_TYPES}) ORDER BY 1"""))).all()]
    agents = [
        {"id": r[0], "name": r[1]}
        for r in (await db.execute(text(f"""
            SELECT DISTINCT ca.agent_id, u.full_name
            FROM customer_schema.case_activity ca
            JOIN administration.app_user u ON u.id = ca.agent_id
            WHERE ca.activity_type IN ({_TYPES}) ORDER BY 2"""))).all()]
    return schemas.ContactOptions(channels=channels, directions=directions, agents=agents)
