"""Normalise the recovery book against the customer of record.

Three corrections:

1. Every placement is linked to a real ``customer_schema.account``. The seeded
   history had none, which forced the workspace to read a stored copy.
2. ``dpd_at_placement`` / ``risk_at_placement`` are dropped. They duplicated
   columns that already live on the account and customer, so the workspace now
   joins for them instead of carrying a second version that can drift.
3. Legal cases are restricted to genuinely litigable debt — High or Critical
   risk with an account at or past the legal DPD threshold. Anything that did
   not qualify is removed and re-raised against a customer that does.
"""

from __future__ import annotations

import asyncio
import random
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text

from app.core.database import SessionFactory

random.seed(20260806)
TODAY = date(2026, 8, 6)

LEGAL_MIN_DPD = 90
LEGAL_RISKS = ("High", "Critical")

FIRMS = [
    ("Whitfield & Barr LLP", "Sarah Mitchell", "Superior Court, Suffolk County"),
    ("Castellan Legal Group", "Michael Chang", "District Court, Cook County"),
    ("Rowe Deveraux LLP", "Amara Nwosu", "Civil Court, New York County"),
    ("Bishop & Hale", "Tomas Reyes", "County Court, Dallas"),
]
STAGES = [("Notice Served", 35), ("Filed", 55), ("Discovery", 65),
          ("Hearing", 72), ("Judgment", 85)]


def money(v) -> Decimal:
    return Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def main() -> None:
    async with SessionFactory() as db:
        # --- 1. Link every placement to a real account --------------------
        # Pick the customer's largest account, so the placement points at the
        # balance it most plausibly came from.
        linked = (await db.execute(text("""
            UPDATE recovery_schema.placement p
            SET account_id = pick.id
            FROM (
              SELECT DISTINCT ON (a.customer_id) a.customer_id, a.id
              FROM customer_schema.account a
              ORDER BY a.customer_id, a.outstanding DESC, a.dpd DESC, a.id
            ) pick
            WHERE p.account_id IS NULL AND pick.customer_id = p.customer_id
            RETURNING p.id"""))).rowcount
        print(f"  linked {linked} placements to an account")

        # The partial unique index allows one OPEN placement per account; the
        # back-dated ones are all closed, so relinking cannot collide.
        clash = (await db.execute(text("""
            SELECT count(*) FROM (
              SELECT account_id FROM recovery_schema.placement
              WHERE account_id IS NOT NULL AND status IN ('ACTIVE','LEGAL')
              GROUP BY 1 HAVING count(*) > 1) x"""))).scalar_one()
        assert clash == 0, f"{clash} accounts ended up with two open placements"

        orphan = (await db.execute(text(
            "SELECT count(*) FROM recovery_schema.placement WHERE account_id IS NULL"))).scalar_one()
        print(f"  placements still unlinked: {orphan}")

        # --- 2. Drop the duplicated customer attributes -------------------
        await db.execute(text("""
            ALTER TABLE recovery_schema.placement
              DROP COLUMN IF EXISTS dpd_at_placement,
              DROP COLUMN IF EXISTS risk_at_placement"""))
        print("  dropped dpd_at_placement / risk_at_placement (now joined live)")

        # --- 3. Legal cases only where litigation is warranted ------------
        for k, v, label, desc, vt in [
            ("legal_min_dpd", str(LEGAL_MIN_DPD), "Legal escalation minimum DPD",
             "An account must be at least this delinquent before a legal case can be opened.", "number"),
            ("legal_min_risk", "High", "Legal escalation minimum risk",
             "Only customers at this risk band or worse may be escalated to legal.", "text"),
        ]:
            await db.execute(text("""
                INSERT INTO recovery_schema.recovery_config (key, value, label, description, value_type)
                VALUES (:k,:v,:l,:d,:t)
                ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, label=EXCLUDED.label,
                    description=EXCLUDED.description, value_type=EXCLUDED.value_type"""),
                dict(k=k, v=v, l=label, d=desc, t=vt))

        removed = (await db.execute(text(f"""
            DELETE FROM recovery_schema.legal_case lc
            WHERE lc.customer_id NOT IN (
              SELECT c.id FROM customer_schema.customer c
              WHERE c.risk_level = ANY(:risks)
                AND (SELECT COALESCE(MAX(a.dpd), 0) FROM customer_schema.account a
                     WHERE a.customer_id = c.id) >= :dpd)
            RETURNING lc.id"""), {"risks": list(LEGAL_RISKS), "dpd": LEGAL_MIN_DPD})).rowcount
        print(f"  removed {removed} legal cases that did not meet the threshold")

        await db.execute(text("""
            UPDATE recovery_schema.placement SET status='ACTIVE'
            WHERE status='LEGAL' AND id NOT IN
              (SELECT placement_id FROM recovery_schema.legal_case WHERE placement_id IS NOT NULL)"""))

        # Raise a case for every qualifying customer that has open exposure.
        candidates = (await db.execute(text("""
            SELECT c.id AS customer_id, c.customer_type, c.risk_level,
                   (SELECT MAX(a.dpd) FROM customer_schema.account a WHERE a.customer_id=c.id) AS dpd,
                   p.id AS placement_id,
                   COALESCE(p.placed_amount - p.recovered_amount,
                            (SELECT SUM(a.outstanding) FROM customer_schema.account a
                             WHERE a.customer_id = c.id)) AS claim
            FROM customer_schema.customer c
            LEFT JOIN LATERAL (
              SELECT id, placed_amount, recovered_amount FROM recovery_schema.placement
              WHERE customer_id = c.id AND status IN ('ACTIVE','LEGAL')
                AND placed_amount > recovered_amount
              ORDER BY placed_amount - recovered_amount DESC LIMIT 1) p ON TRUE
            WHERE c.risk_level = ANY(:risks)
              AND (SELECT COALESCE(MAX(a.dpd),0) FROM customer_schema.account a
                   WHERE a.customer_id=c.id) >= :dpd
              AND c.id NOT IN (SELECT customer_id FROM recovery_schema.legal_case)
            ORDER BY claim DESC NULLS LAST"""),
            {"risks": list(LEGAL_RISKS), "dpd": LEGAL_MIN_DPD})).mappings().all()

        made = 0
        for i, c in enumerate(candidates):
            claim = money(c["claim"] or 0)
            if claim <= 0:
                continue
            firm = FIRMS[i % len(FIRMS)]
            stage, prob = STAGES[i % len(STAGES)]
            # A case filed no earlier than the debt became litigable.
            filed = TODAY - timedelta(days=min(int(c["dpd"]) - LEGAL_MIN_DPD + 20,
                                               random.randint(25, 200)))
            code = (await db.execute(text("""
                SELECT 'LC-' || (COALESCE(MAX(SUBSTRING(case_code FROM 4)::int), 2026000) + 1)::text
                FROM recovery_schema.legal_case"""))).scalar_one()
            cid = (await db.execute(text("""
                INSERT INTO recovery_schema.legal_case
                  (case_code, customer_id, placement_id, claim_amount, legal_cost, stage, status,
                   law_firm, attorney, court, filed_on, next_hearing, success_probability, notes)
                VALUES (:code,:cu,:p,:claim,:cost,:st,'OPEN',:firm,:att,:court,:filed,:next,:prob,:notes)
                RETURNING id"""),
                dict(code=code, cu=c["customer_id"], p=c["placement_id"], claim=claim,
                     cost=money(float(claim) * random.uniform(0.04, 0.10)), st=stage,
                     firm=firm[0], att=firm[1], court=firm[2], filed=filed,
                     next=TODAY + timedelta(days=random.randint(10, 70)), prob=prob,
                     notes=f"{c['risk_level']} risk at {c['dpd']} DPD — beyond agency recovery."))
            ).scalar_one()
            if c["placement_id"]:
                await db.execute(text(
                    "UPDATE recovery_schema.placement SET status='LEGAL' WHERE id=:i"),
                    {"i": c["placement_id"]})
            for et, detail, when in [
                ("OPENED", f"Case opened on a claim of ${claim:,.2f}.", filed),
                ("NOTICE", "Statutory demand served on the customer.", filed + timedelta(days=12)),
                ("FILED", f"Claim filed at {firm[2]}.", filed + timedelta(days=25)),
            ]:
                if when <= TODAY:
                    await db.execute(text("""
                        INSERT INTO recovery_schema.legal_event (case_id, event_type, detail, actor, occurred_at)
                        VALUES (:c,:e,:d,:a,:t)"""),
                        dict(c=cid, e=et, d=detail, a=firm[1], t=when))
            made += 1
        print(f"  raised {made} legal cases against qualifying customers")

        await db.commit()

        rows = (await db.execute(text("""
            SELECT lc.case_code, c.customer_type, c.risk_level,
                   (SELECT MAX(a.dpd) FROM customer_schema.account a WHERE a.customer_id=c.id) dpd,
                   lc.claim_amount
            FROM recovery_schema.legal_case lc
            JOIN customer_schema.customer c ON c.id = lc.customer_id
            ORDER BY lc.case_code"""))).mappings().all()
        print("\n  legal book now:")
        for r in rows:
            print(f"    {r['case_code']}  {r['customer_type']:<10} {r['risk_level']:<8} "
                  f"{r['dpd']:>4} DPD  ${float(r['claim_amount']):>9,.2f}")


if __name__ == "__main__":
    asyncio.run(main())
