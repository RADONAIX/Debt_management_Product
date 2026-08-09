"""One placement per recovery payment, and only up to what was placed.

058 credited a placement with every payment that cleared while it was out, which
double-counted where two placements overlapped on one account and left the
recovered figure capped below the cash it had labelled. Here each payment is
claimed by exactly one placement — the one placed most recently at the time —
and only until the placed amount is reached. An agency cannot recover more debt
than it was handed, and no payment is counted for two agencies.
"""

import asyncio
from sqlalchemy import text
from app.core.database import SessionFactory

async def main():
    async with SessionFactory() as db:
        await db.execute(text("""
            UPDATE customer_schema.payment SET notes = NULL
            WHERE notes LIKE 'Recovered under placement %' OR notes LIKE 'Recovered by %'"""))
        # A payment belongs to the placement that was out at the time; where two
        # overlap, the one placed most recently. Only cash up to the placed
        # amount counts — an agency cannot recover more debt than it was given.
        await db.execute(text("""
            WITH claim AS (
                SELECT DISTINCT ON (p.id) p.id AS payment_id, p.amount, pl.id AS placement_id,
                       pl.placement_code, pl.placed_amount, p.payment_date
                FROM customer_schema.payment p
                JOIN recovery_schema.placement pl
                  ON pl.account_id = p.account_id
                 AND p.payment_date >= pl.placed_on
                 AND (pl.closed_on IS NULL OR p.payment_date <= pl.closed_on)
                WHERE p.status = 'COMPLETED'
                ORDER BY p.id, pl.placed_on DESC
            ),
            capped AS (
                SELECT *, sum(amount) OVER (PARTITION BY placement_id
                                            ORDER BY payment_date, payment_id) AS running
                FROM claim
            )
            UPDATE customer_schema.payment p
            SET notes = 'Recovered under placement ' || c.placement_code, updated_at = now()
            FROM capped c
            WHERE p.id = c.payment_id AND c.running <= c.placed_amount"""))
        await db.execute(text("""
            UPDATE recovery_schema.placement pl
            SET recovered_amount = COALESCE((
                    SELECT sum(p.amount) FROM customer_schema.payment p
                    WHERE p.account_id = pl.account_id AND p.status = 'COMPLETED'
                      AND p.notes = 'Recovered under placement ' || pl.placement_code), 0),
                commission_accrued = round(COALESCE((
                    SELECT sum(p.amount) FROM customer_schema.payment p
                    WHERE p.account_id = pl.account_id AND p.status = 'COMPLETED'
                      AND p.notes = 'Recovered under placement ' || pl.placement_code), 0)
                    * pl.commission_pct / 100, 2),
                updated_at = now()"""))
        await db.commit()
        r = (await db.execute(text("""
            SELECT count(*) FILTER (WHERE recovered_amount > 0) AS with_cash,
                   round(sum(recovered_amount)) AS recovered,
                   count(*) FILTER (WHERE recovered_amount > placed_amount) AS over_placed
            FROM recovery_schema.placement"""))).mappings().one()
        print(f"  {r['with_cash']} placements credited {r['recovered']:,}, "
              f"{r['over_placed']} exceeding what was placed")

asyncio.run(main())
