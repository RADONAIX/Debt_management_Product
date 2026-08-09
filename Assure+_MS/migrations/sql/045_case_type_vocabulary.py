"""Make collection.case_type share the existing case-type vocabulary.

customer_schema.debt_case.case_type_code is foreign-keyed to
administration.master_data(CASE_TYPE). Inventing a second set of codes in the
collection schema would mean either breaking that key or maintaining a
translation table — both are duplication.

So: master_data stays the vocabulary and is extended with the four operational
types it was missing, and collection.case_type is re-keyed onto it. The
collection table then holds only what master_data does not — the SLA, default
queue, duplicate policy and approval rules for each type.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory

# New codes, written in the same style as the ones already there.
NEW_MASTER = [
    ("Payment Failure", "Raised when a payment attempt fails or is reversed."),
    ("High Risk", "Raised when the risk engine flags the account."),
    ("High DPD", "Raised when the account crosses a delinquency threshold."),
    ("Agency Recall", "Placement is due for recall or review."),
]

# collection.case_type code -> master_data code
REKEY = {
    "COLLECTION": "Collection",
    "BROKEN_PTP": "Broken PTP",
    "PAYMENT_FAILURE": "Payment Failure",
    "HIGH_RISK": "High Risk",
    "HIGH_DPD": "High DPD",
    "DISPUTE": "Dispute",
    "PAYMENT_PLAN": "Payment Plan",
    "LEGAL_FOLLOWUP": "Legal Followup",
    "AGENCY_RECALL": "Agency Recall",
    "BILLING_ISSUE": "Billing Issue",
}


async def main() -> None:
    async with SessionFactory() as db:
        sort = (await db.execute(text(
            "SELECT COALESCE(MAX(sort_order), 0) FROM administration.master_data "
            "WHERE category = 'CASE_TYPE'"))).scalar_one()
        for i, (code, desc) in enumerate(NEW_MASTER, start=1):
            await db.execute(text("""
                INSERT INTO administration.master_data
                  (category, code, label, description, sort_order, status)
                VALUES ('CASE_TYPE', :c, :c, :d, :o, 'ACTIVE')
                ON CONFLICT (category, code) DO NOTHING"""),
                {"c": code, "d": desc, "o": sort + i * 10})
        total = (await db.execute(text(
            "SELECT count(*) FROM administration.master_data WHERE category = 'CASE_TYPE'"
        ))).scalar_one()
        print(f"  case-type vocabulary extended to {total} codes")

        # Re-key the operational rules onto the shared vocabulary.
        for old, new in REKEY.items():
            if old == new:
                continue
            exists = (await db.execute(text(
                "SELECT 1 FROM collection.case_type WHERE code = :c"), {"c": old})).first()
            if not exists:
                continue
            await db.execute(text("""
                INSERT INTO collection.case_type
                  (code, name, description, default_priority, default_queue, sla_hours,
                   duplicate_policy, requires_approval, auto_close_on_pay, is_active, sort_order)
                SELECT :new, name, description, default_priority, default_queue, sla_hours,
                       duplicate_policy, requires_approval, auto_close_on_pay, is_active, sort_order
                FROM collection.case_type WHERE code = :old
                ON CONFLICT (code) DO UPDATE SET
                  default_queue = EXCLUDED.default_queue, sla_hours = EXCLUDED.sla_hours,
                  duplicate_policy = EXCLUDED.duplicate_policy"""),
                {"new": new, "old": old})
            await db.execute(text(
                "UPDATE collection.assignment_rule SET case_type_code = :new WHERE case_type_code = :old"),
                {"new": new, "old": old})
            await db.execute(text("DELETE FROM collection.case_type WHERE code = :c"), {"c": old})

        await db.commit()

        rows = (await db.execute(text("""
            SELECT t.code, t.default_queue, t.sla_hours, t.duplicate_policy,
                   (SELECT count(*) FROM customer_schema.debt_case dc
                     WHERE dc.case_type_code = t.code) AS cases,
                   (md.code IS NOT NULL) AS in_vocabulary
            FROM collection.case_type t
            LEFT JOIN administration.master_data md
                   ON md.category = 'CASE_TYPE' AND md.code = t.code
            ORDER BY t.sort_order"""))).mappings().all()
        print("\n  type                 queue            sla  duplicate policy  cases  valid")
        for r in rows:
            print(f"  {r['code']:<20} {(r['default_queue'] or '-'):<16} {r['sla_hours']:>3}h "
                  f"{r['duplicate_policy']:<17} {r['cases']:>5}  {'yes' if r['in_vocabulary'] else 'NO'}")
        bad = [r["code"] for r in rows if not r["in_vocabulary"]]
        print(f"\n  types not in the shared vocabulary: {bad or 'none'}")


if __name__ == "__main__":
    asyncio.run(main())
