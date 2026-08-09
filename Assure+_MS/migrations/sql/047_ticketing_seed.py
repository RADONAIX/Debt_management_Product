"""Extend the workflow for ticketing, seed tags, and give the desk a work plan.

Adds the states the ticket board needs (Promise Taken, Broken Promise,
Recovery Agency) alongside the existing ones, wires the transitions between
them, seeds the tag vocabulary, and creates follow-up tasks so the day-by-day
timeline has something real to show.
"""

from __future__ import annotations

import asyncio
import random
import datetime as dt
from datetime import date, timedelta

from sqlalchemy import text

from app.core.database import SessionFactory

random.seed(20260807)
TODAY = date(2026, 8, 7)

# Board columns, in the order the spec lays them out.
NEW_STATES = [
    # code, name, category, terminal, pauses_sla, colour, order
    ("PROMISE_TAKEN", "Promise Taken", "PENDING", False, True, "info", 55),
    ("BROKEN_PROMISE", "Broken Promise", "OPEN", False, False, "destructive", 58),
    ("RECOVERY_AGENCY", "Recovery Agency", "ESCALATED", False, True, "purple", 85),
]

# from, to, label, permission, note, approval
NEW_TRANSITIONS = [
    ("IN_PROGRESS", "PROMISE_TAKEN", "Promise taken", "caseManagement", False, False),
    ("MONITORING_PTP", "PROMISE_TAKEN", "Promise taken", "caseManagement", False, False),
    ("PROMISE_TAKEN", "RESOLVED", "Promise kept", "caseManagement", False, False),
    ("PROMISE_TAKEN", "BROKEN_PROMISE", "Promise broken", "caseManagement", True, False),
    ("PROMISE_TAKEN", "IN_PROGRESS", "Back to collection", "caseManagement", False, False),
    ("BROKEN_PROMISE", "IN_PROGRESS", "Re-engage", "caseManagement", False, False),
    ("BROKEN_PROMISE", "ESCALATED", "Escalate", "caseEscalate", True, False),
    ("BROKEN_PROMISE", "RECOVERY_AGENCY", "Place with agency", "caseEscalate", True, True),
    ("ESCALATED", "RECOVERY_AGENCY", "Place with agency", "caseEscalate", True, True),
    ("RECOVERY_AGENCY", "RESOLVED", "Recovered by agency", "caseManagement", True, False),
    ("RECOVERY_AGENCY", "IN_PROGRESS", "Recalled from agency", "caseManagement", True, False),
    ("RECOVERY_AGENCY", "LEGAL", "Agency exhausted — legal", "caseEscalate", True, True),
    ("LEGAL", "RECOVERY_AGENCY", "Return to agency", "caseEscalate", True, True),
]

TAGS = [
    ("VIP", "VIP", "warning", "High-value relationship — handle with care."),
    ("HIGH_VALUE", "High Value", "warning", "Balance well above portfolio average."),
    ("FRAUD", "Fraud", "destructive", "Suspected fraudulent activity."),
    ("LEGAL", "Legal", "destructive", "Legal action in progress or pending."),
    ("AGENCY", "Agency", "purple", "Placed with an external agency."),
    ("WATCHLIST", "Watchlist", "info", "Under close monitoring."),
    ("SENSITIVE", "Sensitive", "warning", "Requires careful handling."),
    ("COMPLAINT", "Complaint", "orange", "An open complaint is attached."),
    ("SENIOR_CITIZEN", "Senior Citizen", "info", "Vulnerable customer protections apply."),
    ("CORPORATE", "Corporate", "muted", "Enterprise account."),
    ("SKIP_TRACE", "Skip Trace", "warning", "Customer cannot be located."),
    ("DO_NOT_CALL", "Do Not Call", "destructive", "Voice contact is prohibited."),
]

TASK_TEMPLATES = [
    ("CALLBACK", "Call back {name}", "Customer asked to be called back."),
    ("FOLLOW_UP", "Follow up with {name}", "Chase the outstanding balance."),
    ("PTP_FOLLOW_UP", "Confirm promise from {name}", "Check the promised payment arrived."),
    ("DOCUMENT_CHASE", "Chase documents from {name}", "Awaiting proof of payment."),
    ("DISPUTE_REVIEW", "Review dispute for {name}", "Assess the disputed charge."),
    ("LEGAL_REVIEW", "Legal review for {name}", "Confirm the file is ready to file."),
    ("FIELD_VISIT", "Field visit to {name}", "Doorstep visit arranged."),
]


async def main() -> None:
    async with SessionFactory() as db:
        # --- Workflow ---------------------------------------------------
        for code, name, cat, terminal, pause, colour, order in NEW_STATES:
            await db.execute(text("""
                INSERT INTO collection.workflow_state
                  (workflow_code, code, name, category, is_initial, is_terminal,
                   pauses_sla, colour, sort_order)
                VALUES ('STANDARD',:c,:n,:cat,FALSE,:term,:pause,:col,:o)
                ON CONFLICT (workflow_code, code) DO UPDATE SET
                  name=EXCLUDED.name, category=EXCLUDED.category,
                  pauses_sla=EXCLUDED.pauses_sla, sort_order=EXCLUDED.sort_order"""),
                dict(c=code, n=name, cat=cat, term=terminal, pause=pause, col=colour, o=order))

        for i, (f, t, label, perm, note, appr) in enumerate(NEW_TRANSITIONS):
            await db.execute(text("""
                INSERT INTO collection.workflow_transition
                  (workflow_code, from_state, to_state, label, required_permission,
                   requires_note, requires_approval, sort_order)
                VALUES ('STANDARD',:f,:t,:l,:p,:n,:a,:o)
                ON CONFLICT (workflow_code, from_state, to_state) DO UPDATE SET
                  label=EXCLUDED.label, requires_note=EXCLUDED.requires_note"""),
                dict(f=f, t=t, l=label, p=perm, n=note, a=appr, o=400 + i))

        states = (await db.execute(text(
            "SELECT count(*) FROM collection.workflow_state WHERE workflow_code='STANDARD'"))).scalar_one()
        trans = (await db.execute(text(
            "SELECT count(*) FROM collection.workflow_transition"))).scalar_one()
        print(f"  workflow: {states} states, {trans} transitions")

        # --- Tags -------------------------------------------------------
        for i, (code, label, colour, desc) in enumerate(TAGS):
            await db.execute(text("""
                INSERT INTO collection.tag (code, label, colour, description, sort_order)
                VALUES (:c,:l,:col,:d,:o)
                ON CONFLICT (code) DO UPDATE SET label=EXCLUDED.label,
                  colour=EXCLUDED.colour, description=EXCLUDED.description"""),
                dict(c=code, l=label, col=colour, d=desc, o=i * 10))
        print(f"  {len(TAGS)} tags seeded")

        # Tag the book where the data already says something is true.
        rules = [
            ("CORPORATE", "c.customer_type = 'ENTERPRISE'"),
            ("HIGH_VALUE", "acc.outstanding >= 2000"),
            ("LEGAL", "EXISTS (SELECT 1 FROM recovery_schema.legal_case l "
                      "WHERE l.customer_id = c.id AND l.status = 'OPEN')"),
            ("AGENCY", "EXISTS (SELECT 1 FROM recovery_schema.placement p "
                       "WHERE p.customer_id = c.id AND p.status IN ('ACTIVE','LEGAL'))"),
            ("WATCHLIST", "COALESCE(rp.risk_band, acc.risk_level) = 'Critical'"),
            ("COMPLAINT", "EXISTS (SELECT 1 FROM customer_schema.dispute d "
                          "WHERE d.customer_id = c.id AND d.status NOT IN ('RESOLVED','REJECTED'))"),
        ]
        tagged = 0
        for code, cond in rules:
            n = (await db.execute(text(f"""
                INSERT INTO collection.case_tag (case_id, tag_code)
                SELECT dc.id, :code
                FROM customer_schema.debt_case dc
                JOIN customer_schema.customer c ON c.id = dc.customer_id
                LEFT JOIN customer_schema.account acc ON acc.id = dc.account_id
                LEFT JOIN customer_schema.risk_profile rp ON rp.account_id = acc.id
                WHERE dc.status <> 'CLOSED' AND ({cond})
                ON CONFLICT DO NOTHING"""), {"code": code})).rowcount
            tagged += n
        print(f"  {tagged} tags applied from what the data already says")

        # --- Tasks: a real day-by-day plan ------------------------------
        await db.execute(text("DELETE FROM collection.case_task"))
        cases = (await db.execute(text("""
            SELECT dc.id, dc.customer_id, dc.assigned_agent_id,
                   COALESCE(co.name, c.full_name, c.customer_code) AS name,
                   dc.priority
            FROM customer_schema.debt_case dc
            JOIN customer_schema.customer c ON c.id = dc.customer_id
            LEFT JOIN customer_schema.company co ON co.id = c.company_id
            WHERE dc.status <> 'CLOSED' AND dc.assigned_agent_id IS NOT NULL
            ORDER BY dc.id"""))).mappings().all()

        made = 0
        for i, r in enumerate(cases):
            # Weighted so today and tomorrow are busy and the week tapers off,
            # which is what a real follow-up diary looks like.
            offset = random.choice([-2, -1, 0, 0, 0, 1, 1, 2, 3, 4, 5, 7, 10, 14])
            ttype, title, detail = TASK_TEMPLATES[i % len(TASK_TEMPLATES)]
            due = TODAY + timedelta(days=offset)
            # Anything already past its date and untouched is left open — that is
            # exactly the overdue pile an agent needs to see.
            status = "DONE" if offset < 0 and random.random() < 0.6 else "OPEN"
            await db.execute(text("""
                INSERT INTO collection.case_task
                  (case_id, customer_id, title, detail, task_type, due_date, due_time,
                   assigned_to, status, priority, completed_at, created_by)
                VALUES (:case,:cu,:t,:d,:ty,:due,:time,:ag,:st,:pri,:done,:ag)"""),
                dict(case=r["id"], cu=r["customer_id"], t=title.format(name=r["name"]),
                     d=detail, ty=ttype, due=due,
                     time=dt.time(random.choice([9, 10, 11, 14, 15, 16]),
                                  random.choice([0, 30])),
                     ag=r["assigned_agent_id"], st=status, pri=r["priority"],
                     # Computed here so the status parameter has one unambiguous type.
                     done=dt.datetime.now(dt.timezone.utc) if status == "DONE" else None))
            made += 1

        # Promises falling due are follow-ups in their own right.
        ptps = (await db.execute(text("""
            SELECT p.id, p.customer_id, p.promised_date, p.promised_amount, p.created_by,
                   COALESCE(co.name, c.full_name) AS name,
                   (SELECT dc.id FROM customer_schema.debt_case dc
                     WHERE dc.customer_id = p.customer_id AND dc.status <> 'CLOSED'
                     ORDER BY dc.opened_at DESC LIMIT 1) AS case_id
            FROM customer_schema.ptp p
            JOIN customer_schema.customer c ON c.id = p.customer_id
            LEFT JOIN customer_schema.company co ON co.id = c.company_id
            WHERE p.status = 'PENDING'"""))).mappings().all()
        for p in ptps:
            await db.execute(text("""
                INSERT INTO collection.case_task
                  (case_id, customer_id, title, detail, task_type, due_date,
                   assigned_to, status, priority, created_by)
                VALUES (:case,:cu,:t,:d,'PTP_FOLLOW_UP',:due,:ag,'OPEN','High',:ag)"""),
                dict(case=p["case_id"], cu=p["customer_id"],
                     t=f"Promise due — {p['name']}",
                     d=f"${float(p['promised_amount']):,.2f} promised for "
                       f"{p['promised_date']:%d %b %Y}.",
                     due=p["promised_date"], ag=p["created_by"]))
            made += 1

        await db.commit()

        spread = (await db.execute(text("""
            SELECT CASE
                     WHEN due_date < CURRENT_DATE THEN 'Overdue'
                     WHEN due_date = CURRENT_DATE THEN 'Today'
                     WHEN due_date = CURRENT_DATE + 1 THEN 'Tomorrow'
                     WHEN due_date <= CURRENT_DATE + 7 THEN 'This week'
                     ELSE 'Later' END AS bucket,
                   count(*) FILTER (WHERE status = 'OPEN') AS open_n,
                   count(*) AS total
            FROM collection.case_task GROUP BY 1
            ORDER BY min(due_date)"""))).mappings().all()
        print(f"\n  {made} tasks created")
        print("  when          open  total")
        for s in spread:
            print(f"  {s['bucket']:<12} {s['open_n']:>5} {s['total']:>6}")

        types = (await db.execute(text("""
            SELECT task_type, count(*) FROM collection.case_task
            WHERE status = 'OPEN' GROUP BY 1 ORDER BY 2 DESC"""))).all()
        print("  by type:", ", ".join(f"{t} {n}" for t, n in types))


if __name__ == "__main__":
    asyncio.run(main())
