"""AI Guardrails — the rules in `operations`, and what they have caught.

Every change is written to `operations.guardrail` and recorded in
`operations.guardrail_audit`, so what an operator sets survives a restart and
can be traced afterwards. `operations.guardrail_event` holds what the rules
have judged, which is what the Activity section reads.

This module stores and reports the rules; it does not run them. Whatever
serves the assistant is what applies them to live traffic.
"""

from __future__ import annotations

import json
import re

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.operations import schemas

def _row(r) -> schemas.GuardrailRow:
    return schemas.GuardrailRow(
        id=r["id"], kind=r["kind"], code=r["code"], label=r["label"],
        description=r["description"], action=r["action"], severity=r["severity"],
        config=r["config"] or {}, isEnabled=r["is_enabled"], isSystem=r["is_system"],
        sortOrder=r["sort_order"], updatedAt=r["updated_at"], updatedBy=r["updated_by_name"],
        hits30d=r["hits"] or 0)


async def _audit(db: AsyncSession, gid: int | None, code: str, action: str, actor: int,
                 *, field: str | None = None, old: str | None = None,
                 new: str | None = None, reason: str | None = None) -> None:
    await db.execute(text("""
        INSERT INTO operations.guardrail_audit
          (guardrail_id, code, action, field_name, old_value, new_value, reason, actor_id)
        VALUES (:g, :c, :a, :f, :o, :n, :r, :actor)"""),
        {"g": gid, "c": code, "a": action, "f": field, "o": old, "n": new,
         "r": reason, "actor": actor})


async def guardrails(db: AsyncSession) -> schemas.Guardrails:
    rows = (await db.execute(text("""
        SELECT g.*, u.full_name AS updated_by_name,
               (SELECT count(*) FROM operations.guardrail_event e
                 WHERE e.guardrail_id = g.id
                   AND e.created_at > now() - interval '30 days') AS hits
        FROM operations.guardrail g
        LEFT JOIN administration.app_user u ON u.id = g.updated_by
        ORDER BY g.kind, g.sort_order, g.id"""))).mappings().all()

    by_kind: dict[str, list[schemas.GuardrailRow]] = {k: [] for k in schemas.KINDS}
    for r in rows:
        by_kind.setdefault(r["kind"], []).append(_row(r))

    return schemas.Guardrails(
        inputFilters=by_kind["INPUT_FILTER"],
        outputFilters=by_kind["OUTPUT_FILTER"],
        escalationRules=by_kind["ESCALATION_RULE"],
        promptTemplates=by_kind["PROMPT_TEMPLATE"],
        stats=await stats(db),
    )


async def stats(db: AsyncSession) -> schemas.GuardrailStats:
    counts = (await db.execute(text("""
        SELECT (SELECT count(*) FROM operations.guardrail)                       AS rules,
               (SELECT count(*) FROM operations.guardrail WHERE is_enabled)      AS enabled,
               count(*)                                                          AS events,
               count(*) FILTER (WHERE outcome = 'BLOCKED')                       AS blocked,
               count(*) FILTER (WHERE outcome = 'ESCALATED')                     AS escalated,
               count(*) FILTER (WHERE outcome = 'PASSED')                        AS passed
        FROM operations.guardrail_event
        WHERE created_at > now() - interval '30 days'"""))).mappings().one()

    by_day = [
        schemas.DayCount(day=r["day"], blocked=r["blocked"], masked=r["masked"],
                         escalated=r["escalated"], other=r["other"])
        for r in (await db.execute(text("""
            WITH days AS (
                SELECT generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day')::date AS d
            )
            SELECT days.d AS day,
                   count(e.id) FILTER (WHERE e.outcome = 'BLOCKED')   AS blocked,
                   count(e.id) FILTER (WHERE e.outcome = 'MASKED')    AS masked,
                   count(e.id) FILTER (WHERE e.outcome = 'ESCALATED') AS escalated,
                   count(e.id) FILTER (WHERE e.outcome NOT IN
                        ('BLOCKED', 'MASKED', 'ESCALATED'))           AS other
            FROM days LEFT JOIN operations.guardrail_event e
                   ON e.created_at::date = days.d
            GROUP BY days.d ORDER BY days.d"""))).mappings().all()]

    top = [dict(code=r["code"], label=r["label"], hits=r["hits"], outcome=r["outcome"])
           for r in (await db.execute(text("""
               SELECT e.code, COALESCE(g.label, e.code) AS label, count(*) AS hits,
                      mode() WITHIN GROUP (ORDER BY e.outcome) AS outcome
               FROM operations.guardrail_event e
               LEFT JOIN operations.guardrail g ON g.id = e.guardrail_id
               WHERE e.created_at > now() - interval '30 days'
               GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 6"""))).mappings().all()]

    judged = counts["events"]
    intervened = judged - counts["passed"]
    return schemas.GuardrailStats(
        rules=counts["rules"], enabled=counts["enabled"], events30d=judged,
        blocked30d=counts["blocked"], escalated30d=counts["escalated"],
        interventionRate=round(intervened / judged * 100, 1) if judged else None,
        byDay=by_day, topRules=top)


async def events(db: AsyncSession, *, kind: str | None = None, outcome: str | None = None,
                 limit: int = 60) -> list[schemas.EventRow]:
    rows = (await db.execute(text("""
        SELECT e.id, e.code, g.label, e.kind, e.outcome, e.channel, e.sample,
               e.detail, e.created_at
        FROM operations.guardrail_event e
        LEFT JOIN operations.guardrail g ON g.id = e.guardrail_id
        WHERE (CAST(:k AS text) IS NULL OR e.kind = CAST(:k AS text))
          AND (CAST(:o AS text) IS NULL OR e.outcome = CAST(:o AS text))
        ORDER BY e.created_at DESC LIMIT :lim"""),
        {"k": kind, "o": outcome, "lim": limit})).mappings().all()
    return [schemas.EventRow(
        id=r["id"], code=r["code"], label=r["label"], kind=r["kind"], outcome=r["outcome"],
        channel=r["channel"], sample=r["sample"], detail=r["detail"],
        createdAt=r["created_at"]) for r in rows]


async def audit(db: AsyncSession, limit: int = 40) -> list[schemas.AuditRow]:
    rows = (await db.execute(text("""
        SELECT a.id, a.code, a.action, a.field_name, a.old_value, a.new_value,
               a.reason, u.full_name AS actor, a.created_at
        FROM operations.guardrail_audit a
        LEFT JOIN administration.app_user u ON u.id = a.actor_id
        ORDER BY a.created_at DESC, a.id DESC LIMIT :lim"""), {"lim": limit})).mappings().all()
    return [schemas.AuditRow(
        id=r["id"], code=r["code"], action=r["action"], fieldName=r["field_name"],
        oldValue=r["old_value"], newValue=r["new_value"], reason=r["reason"],
        actor=r["actor"], createdAt=r["created_at"]) for r in rows]


async def create(db: AsyncSession, p: schemas.GuardrailWrite, actor: int) -> int:
    if p.kind not in schemas.KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown guardrail kind {p.kind}")
    code = (p.code or re.sub(r"[^a-z0-9]+", "_", p.label.lower()).strip("_"))[:60]
    clash = (await db.execute(text(
        "SELECT 1 FROM operations.guardrail WHERE kind = :k AND code = :c"),
        {"k": p.kind, "c": code})).first()
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"A rule called '{code}' already exists in this section.")
    # Worked out first: asyncpg cannot deduce a type for a parameter used both
    # as a value and in a comparison within one statement.
    order = (await db.execute(text(
        "SELECT COALESCE(max(sort_order) + 10, 10) FROM operations.guardrail WHERE kind = :k"),
        {"k": p.kind})).scalar_one()
    gid = (await db.execute(text("""
        INSERT INTO operations.guardrail
          (kind, code, label, description, action, severity, config, is_enabled,
           is_system, sort_order, updated_by)
        VALUES (:k, :c, :l, :d, :a, :s, CAST(:cfg AS jsonb), :on, false, :ord, :actor)
        RETURNING id"""),
        {"k": p.kind, "c": code, "l": p.label, "d": p.description, "a": p.action,
         "s": p.severity, "cfg": json.dumps(p.config or {}), "on": p.isEnabled,
         "ord": order, "actor": actor})).scalar_one()
    await _audit(db, gid, code, "CREATED", actor, new=p.label)
    await db.commit()
    return gid


async def patch(db: AsyncSession, gid: int, p: schemas.GuardrailPatch, actor: int) -> None:
    cur = (await db.execute(text(
        "SELECT * FROM operations.guardrail WHERE id = :i"), {"i": gid})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That rule does not exist.")

    sets, params, changed = ["updated_at = now()", "updated_by = :actor"], \
                            {"i": gid, "actor": actor}, False

    if p.isEnabled is not None and p.isEnabled != cur["is_enabled"]:
        sets.append("is_enabled = :on")
        params["on"] = p.isEnabled
        await _audit(db, gid, cur["code"], "ENABLED" if p.isEnabled else "DISABLED", actor,
                     field="is_enabled", old=str(cur["is_enabled"]), new=str(p.isEnabled),
                     reason=p.reason)
        changed = True
    for field, column, value in (
        ("label", "label", p.label), ("description", "description", p.description),
        ("action", "action", p.action), ("severity", "severity", p.severity),
    ):
        if value is not None and value != cur[column]:
            sets.append(f"{column} = :{field}")
            params[field] = value
            await _audit(db, gid, cur["code"], "EDITED", actor, field=column,
                         old=str(cur[column]), new=str(value), reason=p.reason)
            changed = True
    if p.config is not None and p.config != (cur["config"] or {}):
        sets.append("config = CAST(:cfg AS jsonb)")
        params["cfg"] = json.dumps(p.config)
        await _audit(db, gid, cur["code"], "EDITED", actor, field="config",
                     old=json.dumps(cur["config"] or {})[:400],
                     new=json.dumps(p.config)[:400], reason=p.reason)
        changed = True

    if not changed:
        return
    await db.execute(text(
        f"UPDATE operations.guardrail SET {', '.join(sets)} WHERE id = :i"), params)
    await db.commit()


async def delete(db: AsyncSession, gid: int, actor: int) -> None:
    cur = (await db.execute(text(
        "SELECT code, label, is_system FROM operations.guardrail WHERE id = :i"),
        {"i": gid})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That rule does not exist.")
    if cur["is_system"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"'{cur['label']}' is a built-in rule. Disable it instead of deleting it, "
            "so the history of what it caught stays readable.")
    await _audit(db, None, cur["code"], "DELETED", actor, old=cur["label"])
    await db.execute(text("DELETE FROM operations.guardrail WHERE id = :i"), {"i": gid})
    await db.commit()
