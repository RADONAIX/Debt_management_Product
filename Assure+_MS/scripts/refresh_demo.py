"""Bring the demo data up to today. Run it before presenting.

The book is dated relative to now, so time passing on its own creates drift: a
promise reaches its date and nobody settles it, every case slips past its
next-action window because the floor stopped working, and the agent roll-up
falls behind the payment ledger.

This does the housekeeping a running system would do overnight. It invents
nothing — promises settle according to whether money arrived, and the roll-up is
recomputed from the ledger.

    PYTHONPATH=. .venv/bin/python scripts/refresh_demo.py
"""

from __future__ import annotations

import asyncio
import pathlib
import subprocess
import sys

from sqlalchemy import text

from app.core.database import SessionFactory

HERE = pathlib.Path(__file__).resolve().parent
MIGRATIONS = HERE.parent / "migrations" / "sql"


async def settle_promises(db) -> None:
    """A promise past its date is kept or broken — never still pending."""
    kept = (await db.execute(text("""
        UPDATE customer_schema.ptp t
        SET status = 'KEPT',
            kept_amount = GREATEST(t.kept_amount, t.promised_amount),
            fulfilled_at = COALESCE(t.fulfilled_at, now()), updated_at = now()
        WHERE t.status = 'PENDING' AND t.promised_date < CURRENT_DATE
          AND EXISTS (SELECT 1 FROM customer_schema.payment p
                       WHERE p.account_id = t.account_id AND p.status = 'COMPLETED'
                         AND p.payment_date BETWEEN t.promised_date - 3
                                               AND t.promised_date + 3
                         AND p.amount >= t.promised_amount * 0.9)"""))).rowcount
    broken = (await db.execute(text("""
        UPDATE customer_schema.ptp
        SET status = 'BROKEN', updated_at = now()
        WHERE status = 'PENDING' AND promised_date < CURRENT_DATE"""))).rowcount
    print(f"  promises settled: {kept} kept, {broken} broken")


async def refresh_rollup(db) -> None:
    """The agent roll-up follows the ledger, never the other way round."""
    await db.execute(text("""
        UPDATE public.agent_performance ap
        SET collected_amount = COALESCE((
                SELECT sum(p.amount) FROM customer_schema.payment p
                JOIN customer_schema.account a ON a.id = p.account_id
                JOIN customer_schema.customer c ON c.id = a.customer_id
                WHERE c.assigned_agent_id = ap.agent_id AND p.status = 'COMPLETED'
                  AND date_trunc('month', p.payment_date) = ap.period_month), 0),
            contact_attempts = (SELECT count(*) FROM customer_schema.case_activity ca
                                 WHERE ca.agent_id = ap.agent_id
                                   AND ca.direction <> 'INTERNAL'
                                   AND date_trunc('month', ca.occurred_at) = ap.period_month),
            updated_at = now()"""))
    print("  agent roll-up recomputed from the ledger")


def run(script: str) -> None:
    subprocess.run([sys.executable, str(MIGRATIONS / script)],
                   check=True, cwd=HERE.parent,
                   env={**__import__("os").environ, "PYTHONPATH": "."})


async def main() -> None:
    async with SessionFactory() as db:
        await settle_promises(db)
        await db.commit()

    # A day's work on the floor, and the SLA clocks re-cut from it.
    run("065_recent_floor_activity.py")
    run("066_task_completion.py")

    async with SessionFactory() as db:
        await refresh_rollup(db)
        await db.commit()

    print("\n  now run: PYTHONPATH=. .venv/bin/python scripts/verify_consistency.py")


if __name__ == "__main__":
    asyncio.run(main())
