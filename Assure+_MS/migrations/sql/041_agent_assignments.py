"""Give every agent a real desk to work.

No new tables — this only fills columns that already exist:
  customer.assigned_agent_id   who owns the relationship
  debt_case.assigned_agent_id  who owns the case  (+ SLA deadlines)
  ptp.created_by               who took the promise
  dispute.assigned_agent_id    who owns the dispute

A customer follows their case: if an agent already works a case for someone,
that agent owns the customer too. Whatever is left is spread across the team
by current load, so nobody starts with an empty or impossible queue.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta

from sqlalchemy import text

from app.core.database import SessionFactory

# Hours to first response / resolution by priority — the SLA the desk works to.
SLA_HOURS = {"Critical": 4, "High": 8, "Medium": 24, "Low": 48}


async def main() -> None:
    async with SessionFactory() as db:
        agents = [r[0] for r in (await db.execute(text("""
            SELECT u.id FROM administration.app_user u
            JOIN administration.role r ON r.id = u.role_id
            WHERE r.code IN ('AGENT','SUPERVISOR') AND u.status = 'ACTIVE'
            ORDER BY u.id"""))).all()]
        if not agents:
            raise SystemExit("no agents to assign to")
        print(f"  {len(agents)} agents on the floor")

        # 1. A customer belongs to whoever already works their case.
        n = (await db.execute(text("""
            UPDATE customer_schema.customer c
            SET assigned_agent_id = t.agent_id, updated_at = now()
            FROM (
              SELECT DISTINCT ON (customer_id) customer_id, assigned_agent_id AS agent_id
              FROM customer_schema.debt_case
              WHERE assigned_agent_id IS NOT NULL
              ORDER BY customer_id, opened_at DESC) t
            WHERE c.id = t.customer_id
              AND c.assigned_agent_id IS DISTINCT FROM t.agent_id"""))).rowcount
        print(f"  {n} customers aligned to the agent already working their case")

        # 2. Anyone still unassigned goes to the lightest desk, worst debt first.
        unassigned = [r[0] for r in (await db.execute(text("""
            SELECT c.id FROM customer_schema.customer c
            WHERE c.assigned_agent_id IS NULL
            ORDER BY (SELECT COALESCE(MAX(a.dpd), 0) FROM customer_schema.account a
                      WHERE a.customer_id = c.id) DESC,
                     (SELECT COALESCE(SUM(a.outstanding), 0) FROM customer_schema.account a
                      WHERE a.customer_id = c.id) DESC"""))).all()]
        load = dict((r[0], r[1]) for r in (await db.execute(text("""
            SELECT u.id, COUNT(c.id)
            FROM administration.app_user u
            LEFT JOIN customer_schema.customer c ON c.assigned_agent_id = u.id
            WHERE u.id = ANY(:ids) GROUP BY u.id"""), {"ids": agents})).all())
        for cid in unassigned:
            aid = min(agents, key=lambda a: load.get(a, 0))
            await db.execute(text(
                "UPDATE customer_schema.customer SET assigned_agent_id = :a WHERE id = :c"),
                {"a": aid, "c": cid})
            load[aid] = load.get(aid, 0) + 1
        print(f"  {len(unassigned)} unassigned customers spread across the team")

        # 3. Cases follow the customer, and every open case gets an SLA clock.
        await db.execute(text("""
            UPDATE customer_schema.debt_case dc
            SET assigned_agent_id = c.assigned_agent_id, updated_at = now()
            FROM customer_schema.customer c
            WHERE c.id = dc.customer_id AND dc.assigned_agent_id IS NULL"""))
        # The deadline is when the next action falls due, measured from the last
        # time the case was worked. A case touched today is inside its SLA; one
        # left alone for a week is not, whatever its age.
        for priority, hours in SLA_HOURS.items():
            await db.execute(text("""
                UPDATE customer_schema.debt_case dc
                SET sla_deadline = COALESCE(
                      dc.last_activity_at,
                      (SELECT MAX(ca.occurred_at) FROM customer_schema.case_activity ca
                        WHERE ca.case_id = dc.id),
                      dc.opened_at) + make_interval(hours => :h)
                WHERE dc.priority = :p"""),
                {"h": hours, "p": priority})
        await db.execute(text("""
            UPDATE customer_schema.debt_case dc
            SET last_activity_at = COALESCE(dc.last_activity_at,
                  (SELECT MAX(ca.occurred_at) FROM customer_schema.case_activity ca
                    WHERE ca.case_id = dc.id))
            WHERE dc.last_activity_at IS NULL"""))
        # A case that has run past its deadline without being closed is breached.
        await db.execute(text("""
            UPDATE customer_schema.debt_case
            SET sla_breached = (closed_at IS NULL AND sla_deadline < now())
                               OR (closed_at IS NOT NULL AND closed_at > sla_deadline)
            WHERE sla_deadline IS NOT NULL"""))

        # 4. Disputes follow the customer too.
        await db.execute(text("""
            UPDATE customer_schema.dispute d
            SET assigned_agent_id = c.assigned_agent_id, updated_at = now()
            FROM customer_schema.customer c
            WHERE c.id = d.customer_id AND d.assigned_agent_id IS NULL"""))
        await db.execute(text("""
            UPDATE customer_schema.dispute SET sla_deadline = filed_at + INTERVAL '48 hours'
            WHERE sla_deadline IS NULL"""))

        # 5. Attribute promises to the agent who owns the customer.
        await db.execute(text("""
            UPDATE customer_schema.ptp p
            SET created_by = c.assigned_agent_id, updated_by = c.assigned_agent_id
            FROM customer_schema.customer c
            WHERE c.id = p.customer_id AND p.created_by IS NULL"""))

        # 6. Settle promises that are already decided, from the payment record.
        # Kept when enough was paid by the promised date; broken once it passes.
        await db.execute(text("""
            UPDATE customer_schema.ptp p
            SET kept_amount = t.paid,
                status = CASE
                    WHEN t.paid >= p.promised_amount - 0.01 THEN 'KEPT'
                    WHEN p.promised_date < CURRENT_DATE THEN 'BROKEN'
                    ELSE p.status END,
                fulfilled_at = CASE WHEN t.paid >= p.promised_amount - 0.01
                                    THEN t.last_paid::timestamptz ELSE p.fulfilled_at END,
                updated_at = now()
            FROM (
              SELECT p2.id, COALESCE(SUM(pay.amount), 0) AS paid, MAX(pay.payment_date) AS last_paid
              FROM customer_schema.ptp p2
              LEFT JOIN customer_schema.payment pay
                     ON pay.customer_id = p2.customer_id
                    AND pay.payment_date BETWEEN p2.created_at::date AND p2.promised_date
              WHERE p2.status = 'PENDING'
              GROUP BY p2.id) t
            WHERE p.id = t.id"""))

        # 7. A working desk has live promises on it, not only settled ones.
        # Take the most delinquent accounts that have no open promise and put a
        # realistic one on each, due over the next fortnight.
        live = (await db.execute(text("""
            SELECT a.id AS account_id, a.customer_id, a.outstanding, c.assigned_agent_id
            FROM customer_schema.account a
            JOIN customer_schema.customer c ON c.id = a.customer_id
            WHERE a.outstanding > 50 AND a.dpd > 0
              AND NOT EXISTS (SELECT 1 FROM customer_schema.ptp p
                              WHERE p.account_id = a.id AND p.status = 'PENDING')
            ORDER BY a.dpd DESC, a.outstanding DESC
            LIMIT 14"""))).mappings().all()
        made = 0
        for i, r in enumerate(live):
            # Part payment on the bigger balances, in full on the smaller ones.
            share = 0.4 if float(r["outstanding"]) > 1500 else 1.0
            amount = round(float(r["outstanding"]) * share, 2)
            due = 2 + (i * 3) % 14           # spread across the next fortnight
            instal = 2 if share < 1 else 1
            code = (await db.execute(text("""
                SELECT 'PTP-' || LPAD((COALESCE(MAX(SUBSTRING(ptp_code FROM 5)::int), 0) + 1)::text, 6, '0')
                FROM customer_schema.ptp WHERE ptp_code ~ '^PTP-[0-9]+$'"""))).scalar_one()
            case_id = (await db.execute(text("""
                SELECT id FROM customer_schema.debt_case
                WHERE customer_id = :c AND status <> 'CLOSED'
                ORDER BY opened_at DESC LIMIT 1"""), {"c": r["customer_id"]})).scalar_one_or_none()
            await db.execute(text("""
                INSERT INTO customer_schema.ptp
                  (ptp_code, customer_id, account_id, case_id, promised_amount, promised_date,
                   instalment_count, status, channel_code, ai_probability, notes, created_by, updated_by)
                VALUES (:code, :cu, :ac, :case, :amt, CURRENT_DATE + make_interval(days => :d),
                        :inst, 'PENDING', :ch, :prob, :note, :ag, :ag)"""),
                dict(code=code, cu=r["customer_id"], ac=r["account_id"], case=case_id,
                     amt=amount, d=due, inst=instal,
                     ch=["Dialer", "SMS", "WhatsApp", "Email"][i % 4],
                     prob=round(45 + (i * 7) % 45, 2),
                     note="Promise taken on an outbound collection call."
                          if i % 2 == 0 else "Customer called in to arrange payment.",
                     ag=r["assigned_agent_id"]))
            made += 1
        print(f"  {made} live promises placed on the desks")

        # 8. A live desk has recent contact on most of its cases. Without this
        # every SLA reads as breached, which tells an agent nothing about where
        # to look. Give two thirds of the open book a recent touch.
        recent = (await db.execute(text("""
            SELECT dc.id, dc.customer_id, dc.account_id, dc.assigned_agent_id, dc.priority
            FROM customer_schema.debt_case dc
            WHERE dc.status <> 'CLOSED'
            ORDER BY dc.id"""))).mappings().all()
        TOUCHES = [
            ("CALL", "Dialer", "OUTBOUND", "Outbound collection call",
             "Spoke to the customer about the overdue balance.", "Reached — discussing options"),
            ("SMS", "SMS", "OUTBOUND", "Payment reminder sent",
             "Automated overdue reminder with a payment link.", "Delivered"),
            ("CALL", "Dialer", "OUTBOUND", "Follow-up call attempt",
             "No answer, voicemail left.", "No answer"),
            ("EMAIL", "Email", "OUTBOUND", "Statement and payment options emailed",
             "Sent the current statement with instalment options.", "Delivered"),
            ("NOTE", None, "INTERNAL", "Account reviewed",
             "Checked billing history before the next contact attempt.", None),
            ("CALL", "Dialer", "INBOUND", "Customer called back",
             "Customer called to discuss the balance.", "Reached — negotiating"),
        ]
        touched = 0
        for i, r in enumerate(recent):
            if i % 3 == 2:          # leave a third genuinely neglected
                continue
            a_type, ch, direction, subject, body, outcome = TOUCHES[i % len(TOUCHES)]
            hours_ago = (i * 5) % 40          # spread over the last day and a half
            await db.execute(text("""
                INSERT INTO customer_schema.case_activity
                  (activity_type, customer_id, account_id, case_id, channel_code, direction,
                   subject, body, outcome, visibility, is_automated, agent_id, created_by,
                   occurred_at)
                VALUES (:t,:cu,:ac,:case,:ch,:dir,:subj,:body,:out,:vis,:auto,:ag,:ag,
                        now() - make_interval(hours => :h))"""),
                dict(t=a_type, cu=r["customer_id"], ac=r["account_id"], case=r["id"], ch=ch,
                     dir=direction, subj=subject, body=body, out=outcome,
                     vis="CUSTOMER_FACING" if direction != "INTERNAL" else "INTERNAL",
                     auto=a_type == "SMS", ag=r["assigned_agent_id"], h=hours_ago))
            touched += 1
        print(f"  {touched} of {len(recent)} open cases given recent contact")

        # Re-derive the clock now that the activity is in place.
        await db.execute(text("""
            UPDATE customer_schema.debt_case dc
            SET last_activity_at = t.last_at,
                sla_deadline = t.last_at + make_interval(hours => CASE dc.priority
                    WHEN 'Critical' THEN 4 WHEN 'High' THEN 8
                    WHEN 'Medium' THEN 24 ELSE 48 END),
                first_response_at = COALESCE(dc.first_response_at, t.first_at)
            FROM (SELECT case_id, MAX(occurred_at) last_at, MIN(occurred_at) first_at
                  FROM customer_schema.case_activity WHERE case_id IS NOT NULL
                  GROUP BY case_id) t
            WHERE dc.id = t.case_id"""))
        await db.execute(text("""
            UPDATE customer_schema.debt_case
            SET sla_breached = (status <> 'CLOSED' AND sla_deadline < now())
            WHERE sla_deadline IS NOT NULL"""))

        await db.commit()

        rows = (await db.execute(text("""
            SELECT u.full_name,
                   (SELECT count(*) FROM customer_schema.customer c
                     WHERE c.assigned_agent_id = u.id) AS customers,
                   (SELECT count(*) FROM customer_schema.debt_case dc
                     WHERE dc.assigned_agent_id = u.id AND dc.status <> 'CLOSED') AS open_cases,
                   (SELECT count(*) FROM customer_schema.ptp p
                     WHERE p.created_by = u.id AND p.status = 'PENDING') AS open_ptps,
                   (SELECT count(*) FROM customer_schema.dispute d
                     WHERE d.assigned_agent_id = u.id AND d.status <> 'RESOLVED') AS disputes
            FROM administration.app_user u
            WHERE u.id = ANY(:ids) ORDER BY customers DESC"""), {"ids": agents})).mappings().all()
        print("\n  desk        customers  open cases  open PTPs  disputes")
        for r in rows:
            print(f"  {r['full_name'][:18]:<18} {r['customers']:>6} {r['open_cases']:>10}"
                  f" {r['open_ptps']:>10} {r['disputes']:>9}")

        p = (await db.execute(text(
            "SELECT status, count(*) FROM customer_schema.ptp GROUP BY 1 ORDER BY 1"))).all()
        print("\n  promises:", ", ".join(f"{s} {n}" for s, n in p))


if __name__ == "__main__":
    asyncio.run(main())
