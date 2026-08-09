"""Post the live recovery book to the customer's account.

Every recovery on an open placement becomes a real payment in
``customer_schema.payment`` and comes off ``account.outstanding``. After this
runs, what the Recovery Workspace calls "open" on a placement is exactly what
Subscriber 360 calls "debt" on that account — there is no third number.

Recoveries on closed placements are left alone. They were collected before the
current billing cycle and the account balance already reflects them; deducting
them again would understate the debt. They are marked applied_to_account=false
so the ledger can say so rather than leaving an unexplained difference.
"""

from __future__ import annotations

import asyncio
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text

from app.core.database import SessionFactory

# The workspace's method names mapped onto the vocabulary already in use on
# customer_schema.payment, so 360 does not grow a second set of labels.
METHOD_MAP = {
    "Bank Transfer": "Bank Transfer",
    "Card Payment": "Credit Card",
    "Direct Debit": "Auto-Debit",
    "Cheque": "Cheque",
    "Cash Deposit": "Cash",
}


def money(v) -> Decimal:
    return Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def main() -> None:
    async with SessionFactory() as db:
        # Start clean so the migration can be re-run.
        await db.execute(text("""
            DELETE FROM customer_schema.payment
            WHERE id IN (SELECT payment_id FROM recovery_schema.recovery WHERE payment_id IS NOT NULL)"""))
        await db.execute(text(
            "UPDATE recovery_schema.recovery SET payment_id = NULL, applied_to_account = FALSE"))

        live = (await db.execute(text("""
            SELECT r.id, r.amount, r.recovered_on, r.method, r.reference,
                   p.customer_id, p.account_id, ag.name AS agency_name
            FROM recovery_schema.recovery r
            JOIN recovery_schema.placement p ON p.id = r.placement_id
            JOIN recovery_schema.agency ag ON ag.id = p.agency_id
            WHERE p.status IN ('ACTIVE','LEGAL') AND p.account_id IS NOT NULL
            ORDER BY r.recovered_on"""))).mappings().all()

        posted = Decimal("0")
        for r in live:
            pay_id = (await db.execute(text("""
                INSERT INTO customer_schema.payment
                  (payment_ref, customer_id, account_id, amount, payment_date, method_code,
                   status, notes)
                VALUES (:ref, :cu, :ac, :amt, :on, :method, 'COMPLETED', :note)
                RETURNING id"""),
                dict(ref=r["reference"] or f"AGY-{r['id']:06d}", cu=r["customer_id"],
                     ac=r["account_id"], amt=money(r["amount"]), on=r["recovered_on"],
                     method=METHOD_MAP.get(r["method"], "Bank Transfer"),
                     note=f"Recovered by {r['agency_name']}"))).scalar_one()
            await db.execute(text("""
                UPDATE recovery_schema.recovery
                SET payment_id = :p, applied_to_account = TRUE WHERE id = :i"""),
                {"p": pay_id, "i": r["id"]})
            posted += money(r["amount"])

        print(f"  posted {len(live)} recoveries as payments (${posted:,.2f})")

        # The account balance now carries the agency's collections.
        await db.execute(text("""
            UPDATE customer_schema.account a
            SET outstanding = GREATEST(0, a.outstanding - t.recovered), updated_at = now()
            FROM (
              SELECT p.account_id, SUM(r.amount) AS recovered
              FROM recovery_schema.recovery r
              JOIN recovery_schema.placement p ON p.id = r.placement_id
              WHERE r.applied_to_account AND p.account_id IS NOT NULL
              GROUP BY p.account_id) t
            WHERE a.id = t.account_id"""))

        await db.commit()

        # --- Verify: open on a placement == debt on the account -------------
        gaps = (await db.execute(text("""
            SELECT p.placement_code, a.account_code,
                   p.placed_amount - p.recovered_amount AS open_amt, a.outstanding
            FROM recovery_schema.placement p
            JOIN customer_schema.account a ON a.id = p.account_id
            WHERE p.status IN ('ACTIVE','LEGAL')
              AND abs((p.placed_amount - p.recovered_amount) - a.outstanding) > 0.02
            ORDER BY 1"""))).mappings().all()
        print(f"  live placements where open != account debt: {len(gaps)}")
        for g in gaps[:10]:
            print(f"    {g['placement_code']} {g['account_code']}: open "
                  f"${float(g['open_amt']):,.2f} vs debt ${float(g['outstanding']):,.2f}")

        tot = (await db.execute(text("""
            SELECT COALESCE(SUM(outstanding), 0) FROM customer_schema.account"""))).scalar_one()
        print(f"  portfolio outstanding now ${float(tot):,.2f}")


if __name__ == "__main__":
    asyncio.run(main())
