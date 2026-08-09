"""Re-cut every open case's SLA from the last time it was actually worked.

The SLA in this product is "time to the next action", not "time to resolve" —
it restarts whenever somebody touches the case. The seeds stamped a deadline
once at case creation and never moved it, so every live case eventually aged
past its deadline and on-time compliance read 0%, which says nothing useful
about whether the floor is keeping up.

This applies the rule the product already documents: the clock runs from the
last real piece of work, or from the case opening where nothing has been logged
yet. Cases genuinely left alone stay breached — that is the signal the measure
exists to give.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory


async def main() -> None:
    async with SessionFactory() as db:
        before = (await db.execute(text("""
            SELECT count(*) AS live,
                   count(*) FILTER (WHERE dc.sla_deadline < now()
                                      AND m.sla_paused_at IS NULL) AS breached
            FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
              AND m.workflow_state NOT IN ('RESOLVED', 'CLOSED')"""))).mappings().one()

        n = (await db.execute(text("""
            UPDATE customer_schema.debt_case dc
            SET sla_deadline = COALESCE((
                    SELECT max(ca.occurred_at) FROM customer_schema.case_activity ca
                    WHERE ca.case_id = dc.id
                      AND ca.activity_type NOT IN ('STATUS_CHANGE', 'SYSTEM')),
                    dc.opened_at)
                + make_interval(hours => COALESCE((
                    SELECT cp.sla_hours FROM collection.case_priority cp
                    WHERE cp.code = dc.priority), 24)),
                updated_at = now()
            FROM collection.case_meta m
            WHERE m.case_id = dc.id AND dc.status <> 'CLOSED'
              AND m.merged_into_case_id IS NULL
              AND m.workflow_state NOT IN ('RESOLVED', 'CLOSED')"""))).rowcount

        await db.commit()

        after = (await db.execute(text("""
            SELECT count(*) AS live,
                   count(*) FILTER (WHERE dc.sla_deadline < now()
                                      AND m.sla_paused_at IS NULL) AS breached,
                   count(*) FILTER (WHERE dc.sla_deadline BETWEEN now()
                                        AND now() + interval '24 hours') AS due_soon
            FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
              AND m.workflow_state NOT IN ('RESOLVED', 'CLOSED')"""))).mappings().one()

        def rate(row) -> str:
            return (f"{(row['live'] - row['breached']) / row['live'] * 100:.1f}%"
                    if row["live"] else "—")

        print(f"  {n} case(s) re-cut from their last touch")
        print(f"  on time before: {rate(before)}  ({before['breached']} of "
              f"{before['live']} breached)")
        print(f"  on time after:  {rate(after)}  ({after['breached']} of "
              f"{after['live']} breached, {after['due_soon']} due within a day)")
        print("\n  cases still breached are ones nobody has worked recently — "
              "which is what the measure is for.")


if __name__ == "__main__":
    asyncio.run(main())
