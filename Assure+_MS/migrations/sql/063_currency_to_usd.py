"""One currency across the product: US dollars.

The book was already USD on every account, but free text written by the seeds
and the chatbot still quoted AED — so a case summary could say "AED 2,465"
beside a balance the screens rendered as "$2,465". This rewrites the text to
match the currency the data is actually in.

Amounts are never touched. Only the symbol in front of them.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory

# Every free-text column a person can read on a screen.
TARGETS = [
    ("customer_schema.case_activity", ("subject", "body", "outcome")),
    ("customer_schema.debt_case", ("summary", "resolution_code")),
    ("customer_schema.ptp", ("notes",)),
    ("customer_schema.dispute", ("description", "resolution_note")),
    ("customer_schema.invoice", ("service_description",)),
    ("customer_schema.payment", ("notes",)),
    ("recovery_schema.placement", ("notes",)),
    ("recovery_schema.legal_case", ("notes", "outcome")),
    ("collection.case_note", ("body",)),
    ("collection.case_audit", ("reason",)),
    ("chatbot.turns", ("dialogue", "thoughts")),
]


async def main() -> None:
    async with SessionFactory() as db:
        # Currency codes first: the book is USD, so anything else is a stray.
        for table in ("customer_schema.account", "customer_schema.billing_account"):
            n = (await db.execute(text(
                f"UPDATE {table} SET currency_code = 'USD' WHERE currency_code <> 'USD'"))).rowcount
            if n:
                print(f"  {table}: {n} row(s) moved to USD")

        total = 0
        for table, columns in TARGETS:
            for col in columns:
                # "AED 2,465" becomes "$2,465"; a bare "AED" becomes "$".
                n = (await db.execute(text(f"""
                    UPDATE {table}
                    SET {col} = regexp_replace({col}, 'AED\\s*', '$', 'g')
                    WHERE {col} LIKE '%AED%'"""))).rowcount
                if n:
                    print(f"  {table}.{col}: {n} row(s)")
                    total += n
        await db.commit()
        print(f"\n  {total} text field(s) rewritten")

        left = 0
        for table, columns in TARGETS:
            for col in columns:
                left += (await db.execute(text(
                    f"SELECT count(*) FROM {table} WHERE {col} LIKE '%AED%'"))).scalar_one()
        print(f"  fields still mentioning AED: {left}")


if __name__ == "__main__":
    asyncio.run(main())


# Run once as the table owner, so a new billing account cannot arrive in AED:
#
#   ALTER TABLE customer_schema.billing_account
#     ALTER COLUMN currency_code SET DEFAULT 'USD';
