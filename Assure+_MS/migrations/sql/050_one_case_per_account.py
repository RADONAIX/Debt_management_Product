"""One live case per account, whose type reflects the current situation.

The model this enforces: a case is the piece of work on an account. It carries
exactly one type at a time, and the type changes as the situation moves —
a broken promise that goes to legal becomes a Legal Follow-up case, it does
not spawn a second one.

Duplicates that already exist are merged into the case furthest along, so no
history is lost, and a partial unique index stops new ones appearing.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory

# Which case survives a merge: the one that has travelled furthest, then the
# one opened first.
RANK = {"IN_PROGRESS": 0, "ASSIGNED": 1, "RESOLVED": 2, "CLOSED": 3}


async def main() -> None:
    async with SessionFactory() as db:
        dupes = (await db.execute(text("""
            SELECT dc.account_id,
                   array_agg(dc.id ORDER BY
                       CASE m.workflow_state WHEN 'IN_PROGRESS' THEN 0 WHEN 'ASSIGNED' THEN 1
                                             ELSE 2 END,
                       dc.opened_at) AS ids
            FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
              AND dc.account_id IS NOT NULL
            GROUP BY 1 HAVING count(*) > 1"""))).mappings().all()

        merged = 0
        for row in dupes:
            keep, *rest = row["ids"]
            keep_code = (await db.execute(text(
                "SELECT case_code FROM customer_schema.debt_case WHERE id = :i"),
                {"i": keep})).scalar_one()
            for other in rest:
                other_code = (await db.execute(text(
                    "SELECT case_code FROM customer_schema.debt_case WHERE id = :i"),
                    {"i": other})).scalar_one()
                # Move everything that hangs off the duplicate onto the survivor.
                for tbl in ("collection.case_note", "collection.case_attachment",
                            "collection.case_task", "collection.case_escalation"):
                    await db.execute(text(f"UPDATE {tbl} SET case_id = :k WHERE case_id = :o"),
                                     {"k": keep, "o": other})
                await db.execute(text(
                    "UPDATE customer_schema.case_activity SET case_id = :k WHERE case_id = :o"),
                    {"k": keep, "o": other})
                await db.execute(text(
                    "UPDATE customer_schema.ptp SET case_id = :k WHERE case_id = :o"),
                    {"k": keep, "o": other})
                await db.execute(text(
                    "UPDATE customer_schema.dispute SET case_id = :k WHERE case_id = :o"),
                    {"k": keep, "o": other})
                await db.execute(text("""
                    INSERT INTO collection.case_tag (case_id, tag_code)
                    SELECT :k, tag_code FROM collection.case_tag WHERE case_id = :o
                    ON CONFLICT DO NOTHING"""), {"k": keep, "o": other})
                await db.execute(text("DELETE FROM collection.case_tag WHERE case_id = :o"),
                                 {"o": other})
                await db.execute(text("""
                    INSERT INTO collection.case_audit (case_id, action, actor_role, new_value, reason)
                    VALUES (:k,'CASE_MERGED_IN','SYSTEM',:old,
                            'Only one live case may exist per account; this duplicate was folded in.')"""),
                    {"k": keep, "old": other_code})
                await db.execute(text("""
                    UPDATE collection.case_meta
                    SET merged_into_case_id = :k, merged_at = now(), workflow_state = 'CLOSED',
                        updated_at = now()
                    WHERE case_id = :o"""), {"k": keep, "o": other})
                await db.execute(text("""
                    UPDATE customer_schema.debt_case
                    SET status = 'CLOSED', closed_at = now(), resolution_code = :r, updated_at = now()
                    WHERE id = :o"""), {"o": other, "r": f"Merged into {keep_code}"})
                merged += 1
            print(f"  {keep_code} kept, {len(rest)} duplicate(s) merged in")

        # The index that enforces this is created separately as the table
        # owner; see the psql step alongside this migration.

        await db.commit()

        left = (await db.execute(text("""
            SELECT count(*) FROM (
              SELECT dc.account_id FROM customer_schema.debt_case dc
              JOIN collection.case_meta m ON m.case_id = dc.id
              WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
                AND dc.account_id IS NOT NULL
              GROUP BY 1 HAVING count(*) > 1) x"""))).scalar_one()
        print(f"\n  {merged} duplicates merged · accounts still holding more than one: {left}")

        rows = (await db.execute(text("""
            SELECT m.workflow_state, count(*) FROM collection.case_meta m
            JOIN customer_schema.debt_case dc ON dc.id = m.case_id
            WHERE m.merged_into_case_id IS NULL AND dc.status <> 'CLOSED'
            GROUP BY 1 ORDER BY 1"""))).all()
        print("  open cases now:", ", ".join(f"{s} {n}" for s, n in rows))
        types = (await db.execute(text("""
            SELECT dc.case_type_code, count(*) FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE m.merged_into_case_id IS NULL AND dc.status <> 'CLOSED'
            GROUP BY 1 ORDER BY 2 DESC"""))).all()
        print("  by type:", ", ".join(f"{c} {n}" for c, n in types))


if __name__ == "__main__":
    asyncio.run(main())
