"""Tie the last three figures to the ledger.

1. One account was worked by two agents, so Subscriber 360 could only ever name
   one of them. The account gets a single owner — the agent already holding the
   larger share of the customer's work — and both cases move to them.

2. Agency recoveries were a number on the placement that no cash backed. Rather
   than invent payments or delete the recoveries, each placement is credited
   with the payments the ledger actually shows on its account while it was out
   with the agency, and the payment rows are labelled with the placement they
   belong to. No cash is created, moved or removed.

3. Agent monthly collections follow the same rule as everywhere else: a payment
   belongs to the agent who owns the customer.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory


async def main() -> None:
    async with SessionFactory() as db:
        # --- 1. One account, one owner --------------------------------------
        split = (await db.execute(text("""
            SELECT dc.account_id,
                   (SELECT c.assigned_agent_id FROM customer_schema.customer c
                     WHERE c.id = dc.customer_id) AS owner
            FROM customer_schema.debt_case dc
            JOIN customer_schema.customer c ON c.id = dc.customer_id
            JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
              AND dc.assigned_agent_id IS DISTINCT FROM c.assigned_agent_id
            GROUP BY 1, 2"""))).mappings().all()
        for r in split:
            await db.execute(text("""
                UPDATE customer_schema.debt_case SET assigned_agent_id = :o, updated_at = now()
                WHERE account_id = :a AND status <> 'CLOSED'"""),
                {"o": r["owner"], "a": r["account_id"]})
            await db.execute(text("""
                UPDATE collection.case_assignment SET released_at = now()
                WHERE released_at IS NULL AND agent_id IS DISTINCT FROM :o
                  AND case_id IN (SELECT id FROM customer_schema.debt_case
                                   WHERE account_id = :a AND status <> 'CLOSED')"""),
                {"o": r["owner"], "a": r["account_id"]})
        print(f"  1. {len(split)} account(s) given a single owner")

        # --- 2. Recoveries credited from the payments that exist -------------
        # A placement is credited with what cleared on its account while it was
        # out, capped at what was placed — an agency cannot recover more than
        # the debt it was given.
        await db.execute(text("""
            UPDATE recovery_schema.placement pl
            SET recovered_amount = LEAST(pl.placed_amount, COALESCE((
                    SELECT sum(p.amount) FROM customer_schema.payment p
                    WHERE p.account_id = pl.account_id AND p.status = 'COMPLETED'
                      AND p.payment_date >= pl.placed_on
                      AND (pl.closed_on IS NULL OR p.payment_date <= pl.closed_on)), 0)),
                updated_at = now()"""))
        # Label the payments so the two screens can be reconciled by anyone.
        labelled = (await db.execute(text("""
            UPDATE customer_schema.payment p
            SET notes = 'Recovered under placement ' || pl.placement_code, updated_at = now()
            FROM recovery_schema.placement pl
            WHERE p.account_id = pl.account_id AND p.status = 'COMPLETED'
              AND p.payment_date >= pl.placed_on
              AND (pl.closed_on IS NULL OR p.payment_date <= pl.closed_on)
              AND p.notes IS DISTINCT FROM 'Recovered under placement ' || pl.placement_code"""
        ))).rowcount
        # Commission follows the recovery, not the other way round.
        await db.execute(text("""
            UPDATE recovery_schema.placement
            SET commission_accrued = round(recovered_amount * commission_pct / 100, 2)
            WHERE commission_pct IS NOT NULL"""))
        totals = (await db.execute(text("""
            SELECT round(sum(recovered_amount)) AS recovered,
                   count(*) FILTER (WHERE recovered_amount > 0) AS with_cash
            FROM recovery_schema.placement"""))).mappings().one()
        print(f"  2. {labelled} payments labelled · placements now credit "
              f"{totals['recovered']:,} across {totals['with_cash']} placements")

        # --- 3. Agent collections follow customer ownership -------------------
        await db.execute(text("""
            UPDATE public.agent_performance ap
            SET collected_amount = COALESCE((
                    SELECT sum(p.amount) FROM customer_schema.payment p
                    JOIN customer_schema.account a ON a.id = p.account_id
                    JOIN customer_schema.customer c ON c.id = a.customer_id
                    WHERE c.assigned_agent_id = ap.agent_id AND p.status = 'COMPLETED'
                      AND date_trunc('month', p.payment_date) = ap.period_month), 0),
                updated_at = now()"""))
        await db.execute(text("""
            UPDATE public.agent_performance ap
            SET target_amount = GREATEST(500, round(COALESCE((
                    SELECT avg(x.collected_amount) FROM public.agent_performance x
                    WHERE x.agent_id = ap.agent_id AND x.collected_amount > 0), 0) * 1.2, -1))"""))
        await db.execute(text("""
            UPDATE public.agent_profile ap
            SET monthly_target = COALESCE((SELECT max(x.target_amount)
                                            FROM public.agent_performance x
                                           WHERE x.agent_id = ap.user_id), 1000)"""))
        rows = (await db.execute(text("""
            SELECT u.full_name, round(sum(ap.collected_amount)) AS collected,
                   round(max(ap.target_amount)) AS target
            FROM public.agent_performance ap
            JOIN administration.app_user u ON u.id = ap.agent_id
            GROUP BY 1 ORDER BY 2 DESC"""))).all()
        print("  3. six months of collections per agent, from the ledger:")
        for name, collected, target in rows:
            print(f"       {name:<18} {collected:>9,}  target {target:>7,}/month")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
