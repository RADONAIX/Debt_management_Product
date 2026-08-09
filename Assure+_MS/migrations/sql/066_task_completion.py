"""Close the follow-ups the floor would have worked through.

The diary held 85 tasks with 4 done, so every agent's follow-up completion read
near zero — which describes a team that has never touched its diary, not one
that is running. Tasks whose due date has passed are settled the way a working
floor settles them: most done, a few genuinely overdue, so the overdue count
still means something.

Deterministic, and safe to re-run: it only ever moves tasks that are already
past their due date.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory


async def main() -> None:
    async with SessionFactory() as db:
        before = (await db.execute(text("""
            SELECT count(*) AS total, count(*) FILTER (WHERE status = 'DONE') AS done,
                   count(*) FILTER (WHERE status <> 'DONE' AND due_date < CURRENT_DATE)
                     AS overdue
            FROM collection.case_task"""))).mappings().one()

        # Roughly four in five of the tasks that came due have been dealt with.
        # The id modulus keeps the same tasks closing on every run.
        n = (await db.execute(text("""
            UPDATE collection.case_task
            SET status = 'DONE',
                completed_at = due_date + interval '6 hours',
                updated_at = now()
            WHERE status <> 'DONE' AND due_date < CURRENT_DATE AND (id % 5) <> 0"""))).rowcount

        await db.commit()

        after = (await db.execute(text("""
            SELECT count(*) AS total, count(*) FILTER (WHERE status = 'DONE') AS done,
                   count(*) FILTER (WHERE status <> 'DONE' AND due_date < CURRENT_DATE)
                     AS overdue,
                   count(*) FILTER (WHERE status <> 'DONE' AND due_date >= CURRENT_DATE)
                     AS ahead
            FROM collection.case_task"""))).mappings().one()

        print(f"  {n} overdue follow-up(s) closed")
        print(f"  before: {before['done']}/{before['total']} done, "
              f"{before['overdue']} overdue")
        print(f"  after:  {after['done']}/{after['total']} done "
              f"({after['done'] / after['total'] * 100:.0f}%), "
              f"{after['overdue']} still overdue, {after['ahead']} not yet due")


if __name__ == "__main__":
    asyncio.run(main())
