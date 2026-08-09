"""Undo 050. A customer may hold several cases at once — one per issue.

050 read "1 dispute = 1 case card, 1 broken PTP = 1 case card" as "one case per
account". It means the opposite: each issue is its own card, so a customer with
a dispute and a broken promise legitimately has two open cases. This reopens
the cases 050 closed and drops the index that stopped new ones being raised.

What one case being open still rules out is a *second case of the same type* on
the same account — two "Dispute" cards for one dispute is duplication, and that
check stays.

Not recoverable: 050 re-pointed notes, attachments, tasks, escalations,
activities, promises and disputes onto the surviving case and kept no record of
where each came from. Those stay where they were moved to; the reopened cases
come back without the history that was taken off them.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory


async def main() -> None:
    async with SessionFactory() as db:
        rows = (await db.execute(text("""
            SELECT dc.id, dc.case_code, dc.resolution_code
            FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE dc.resolution_code LIKE 'Merged into %'
              AND m.merged_into_case_id IS NOT NULL
            ORDER BY dc.id"""))).mappings().all()

        for r in rows:
            # A case with real work logged against it is in progress; one with
            # none is untouched and goes back to Assigned.
            worked = (await db.execute(text("""
                SELECT EXISTS (SELECT 1 FROM customer_schema.case_activity
                               WHERE case_id = :i
                                 AND activity_type NOT IN ('STATUS_CHANGE','SYSTEM'))"""),
                {"i": r["id"]})).scalar_one()
            state = "IN_PROGRESS" if worked else "ASSIGNED"
            await db.execute(text("""
                UPDATE collection.case_meta
                SET merged_into_case_id = NULL, merged_at = NULL,
                    workflow_state = :s, updated_at = now()
                WHERE case_id = :i"""), {"i": r["id"], "s": state})
            await db.execute(text("""
                UPDATE customer_schema.debt_case
                SET status = :legacy, closed_at = NULL, resolution_code = NULL,
                    resolution_hours = NULL, updated_at = now()
                WHERE id = :i"""),
                {"i": r["id"], "legacy": "OPEN" if state == "ASSIGNED" else "IN_PROGRESS"})
            await db.execute(text("""
                INSERT INTO collection.case_audit (case_id, action, actor_role, reason)
                VALUES (:i,'REOPENED','SYSTEM',
                        'Reopened: a customer may hold one case per issue, so this was '
                        'never a duplicate. History moved off it when it was merged has '
                        'not been moved back.')"""), {"i": r["id"]})
            print(f"  {r['case_code']} reopened as {state} (was {r['resolution_code']})")

        await db.commit()
        print(f"\n  {len(rows)} cases reopened")

        left = (await db.execute(text("""
            SELECT count(*) FROM (
              SELECT dc.account_id, dc.case_type_code
              FROM customer_schema.debt_case dc
              JOIN collection.case_meta m ON m.case_id = dc.id
              WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
                AND dc.account_id IS NOT NULL
              GROUP BY 1, 2 HAVING count(*) > 1) x"""))).scalar_one()
        print(f"  accounts holding two cases of the same type: {left}")
        rowsn = (await db.execute(text("""
            SELECT m.workflow_state, count(*) FROM collection.case_meta m
            JOIN customer_schema.debt_case dc ON dc.id = m.case_id
            WHERE m.merged_into_case_id IS NULL AND dc.status <> 'CLOSED'
            GROUP BY 1 ORDER BY 1"""))).all()
        print("  open cases now:", ", ".join(f"{s} {n}" for s, n in rowsn))


if __name__ == "__main__":
    asyncio.run(main())
