"""Complete the profile fields the new records left blank.

The Subscriber Profile panel reads a dozen columns the lifecycle seed never
set — preferred contact time, emotional state, life event, credit awareness,
risk appetite, employment stability, and the responsibility and cooperation
scores — so half the panel rendered as em-dashes while every established
customer showed a full profile.

The values are not decorative. They come from what each customer has actually
done: the responsibility score from whether promises were honoured, the
cooperation score from whether contact attempts connected, and the categorical
fields from the story each customer is in. Vocabularies match the ones the rest
of the book already uses.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory

# The three lifecycles, and the profile each one implies.
PROFILES = {
    # Behind on three bills, hardship declared, two broken arrangements.
    "CUST-CON-207": dict(
        preferred_contact_time="5:00 PM - 7:00 PM", emotional_state="Anxious",
        life_event="Job change", credit_awareness="Low", risk_appetite="High",
        employment_stability="Low", monthly_income=7800),
    # One missed bill on an expired card; paid the moment it was explained.
    "CUST-CON-208": dict(
        preferred_contact_time="9:00 AM - 11:00 AM", emotional_state="Cooperative",
        life_event="None reported", credit_awareness="High", risk_appetite="Low",
        employment_stability="High", monthly_income=24500),
    # Accounts payable at a freight company: disputes hard, pays selectively.
    "CUST-ENT-036": dict(
        preferred_contact_time="11:00 AM - 1:00 PM", emotional_state="Frustrated",
        life_event="None reported", credit_awareness="High", risk_appetite="Medium",
        employment_stability="High", monthly_income=18000),
}


async def main() -> None:
    async with SessionFactory() as db:
        for code, p in PROFILES.items():
            await db.execute(text("""
                UPDATE customer_schema.customer
                SET preferred_contact_time = COALESCE(preferred_contact_time, :pct),
                    emotional_state = COALESCE(emotional_state, :emo),
                    life_event = COALESCE(life_event, :life),
                    credit_awareness = COALESCE(credit_awareness, :credit),
                    risk_appetite = COALESCE(risk_appetite, :appetite),
                    employment_stability = COALESCE(employment_stability, :employ),
                    monthly_income = COALESCE(monthly_income, :income),
                    -- Enterprise contacts still have a mobile number.
                    msisdn = COALESCE(msisdn, regexp_replace(phone, '[^0-9]', '', 'g')),
                    updated_at = now()
                WHERE customer_code = :c"""),
                {"c": code, "pct": p["preferred_contact_time"], "emo": p["emotional_state"],
                 "life": p["life_event"], "credit": p["credit_awareness"],
                 "appetite": p["risk_appetite"], "employ": p["employment_stability"],
                 "income": p["monthly_income"]})
        print(f"  {len(PROFILES)} profile(s) completed")

        # Scored from behaviour rather than assigned: how many promises were
        # honoured, and how often reaching out actually connected.
        n = (await db.execute(text("""
            UPDATE customer_schema.customer c
            SET responsibility_score = COALESCE(c.responsibility_score, (
                    SELECT CASE WHEN count(*) FILTER (WHERE t.status IN ('KEPT','BROKEN')) = 0
                                THEN 55.0
                                ELSE round(count(*) FILTER (WHERE t.status = 'KEPT')::numeric
                                     / count(*) FILTER (WHERE t.status IN ('KEPT','BROKEN'))
                                     * 100, 1) END
                    FROM customer_schema.ptp t WHERE t.customer_id = c.id)),
                cooperation_score = COALESCE(c.cooperation_score, (
                    SELECT CASE WHEN sum(a.contact_attempts) = 0 THEN 50.0
                                ELSE round(sum(a.contact_successes)::numeric
                                     / sum(a.contact_attempts) * 100, 1) END
                    FROM customer_schema.account a WHERE a.customer_id = c.id)),
                onboarded_on = COALESCE(c.onboarded_on, (
                    SELECT min(a.activation_date) FROM customer_schema.account a
                    WHERE a.customer_id = c.id)),
                updated_at = now()
            WHERE c.responsibility_score IS NULL OR c.cooperation_score IS NULL
               OR c.onboarded_on IS NULL"""))).rowcount
        print(f"  {n} customer(s) scored from their own behaviour")

        # --- Account-level gaps ------------------------------------------
        a = (await db.execute(text("""
            UPDATE customer_schema.account a
            SET assigned_agent_id = COALESCE(a.assigned_agent_id, (
                    SELECT c.assigned_agent_id FROM customer_schema.customer c
                    WHERE c.id = a.customer_id)),
                subscriber_no = COALESCE(a.subscriber_no,
                    '+9715' || lpad(((a.id * 7919) % 100000000)::text, 8, '0')),
                -- What this line bills in a typical month.
                monthly_bill = COALESCE(a.monthly_bill, (
                    SELECT round(avg(i.amount), 2) FROM customer_schema.invoice i
                    WHERE i.account_id = a.id)),
                updated_at = now()
            WHERE a.assigned_agent_id IS NULL OR a.subscriber_no IS NULL
               OR a.monthly_bill IS NULL"""))).rowcount
        print(f"  {a} account(s) given subscriber number, bill and owner")

        await db.commit()

        # --- Prove nothing the rest of the book has is still missing -------
        for table, key in (("customer_schema.customer", "customer_code"),
                           ("customer_schema.account", "account_code")):
            cols = [r[0] for r in (await db.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = split_part(:t, '.', 1)
                  AND table_name = split_part(:t, '.', 2)
                  AND is_generated = 'NEVER' AND is_nullable = 'YES'
                ORDER BY ordinal_position"""), {"t": table})).all()]
            gaps = []
            for c in cols:
                r = (await db.execute(text(f"""
                    SELECT count(*) FILTER (WHERE {c} IS NULL) AS empty,
                           count(*) AS total FROM {table}"""))).mappings().one()
                filled = (r["total"] - r["empty"]) / r["total"] * 100 if r["total"] else 0
                if 0 < r["empty"] and filled >= 90:
                    gaps.append(f"{c} ({r['empty']} row(s))")
            print(f"  {table}: " + (", ".join(gaps) if gaps
                                    else "no column is populated for the book but blank here"))


async def departments() -> None:
    """Enterprise lines belong to a department, the way the rest of the book does.

    Departments hang off a branch, so the branches created for the new company
    needed their own before its subscriber lines could name one. Consumers have
    no department, which is correct and stays blank.
    """
    async with SessionFactory() as db:
        branches = (await db.execute(text("""
            SELECT b.id, b.name FROM customer_schema.company_branch b
            JOIN customer_schema.company co ON co.id = b.company_id
            WHERE co.company_code = 'COMP-010' ORDER BY b.branch_code"""))).mappings().all()

        made = {}
        for b in branches:
            for name, centre in (("Finance", "CC-FIN"), ("Fleet Operations", "CC-FLT"),
                                 ("IT Services", "CC-ITS")):
                did = (await db.execute(text("""
                    INSERT INTO customer_schema.department (branch_id, name, cost_centre)
                    VALUES (:b, :n, :c)
                    ON CONFLICT (branch_id, name) DO UPDATE SET cost_centre = EXCLUDED.cost_centre
                    RETURNING id"""), {"b": b["id"], "n": name, "c": centre})).scalar_one()
                made[(b["id"], name)] = did

        # The line that carries the balance is billed to Finance; the fleet and
        # network lines to the departments that actually use them.
        for code, dept in (("ACC-20007", "Finance"), ("ACC-20008", "Fleet Operations"),
                           ("ACC-20009", "IT Services"), ("ACC-20010", "IT Services")):
            await db.execute(text("""
                UPDATE customer_schema.account a
                SET department_id = (SELECT d.id FROM customer_schema.department d
                                      WHERE d.branch_id = a.branch_id AND d.name = :n),
                    updated_at = now()
                WHERE a.account_code = :c AND a.department_id IS NULL"""),
                {"c": code, "n": dept})
        await db.commit()

        left = (await db.execute(text("""
            SELECT count(*) FROM customer_schema.account a
            JOIN customer_schema.customer c ON c.id = a.customer_id
            WHERE c.customer_type = 'ENTERPRISE' AND c.company_id IS NOT NULL
              AND a.department_id IS NULL"""))).scalar_one()
        print(f"  {len(made)} department(s) available; enterprise lines with no "
              f"department: {left}")


async def run() -> None:
    await main()
    await departments()


if __name__ == "__main__":
    asyncio.run(run())
