"""Clear the junk my testing left behind and seed real, untouched cases."""
import asyncio
from sqlalchemy import text
from app.core.database import SessionFactory

# Cases created purely to exercise the API during development.
JUNK = ("%check%", "%test%", "%lifecycle%", "%E2E%", "%verification%", "%UI path%")

NEW_CASES = [
    # customer_code, type, priority, description
    ("CUST-CON-201", "Legal Followup", "Critical",
     "171 days past due and unresponsive to every channel. Prepare the file for legal review."),
    ("CUST-CON-206", "Broken PTP", "High",
     "Promised $840 on 27 Jul and paid nothing. Re-engage and agree a realistic instalment plan."),
    ("CUST-ENT-024", "Dispute", "High",
     "Customer disputes $400 of roaming charges on the July invoice. Collection on hold pending review."),
    ("CUST-CON-127", "Collection", "Medium",
     "112 days past due with no contact in three weeks. Attempt voice contact and offer a payment link."),
    ("CUST-ENT-008", "Payment Plan", "Medium",
     "Customer asked for a three-month arrangement. Confirm affordability and set the instalments."),
    ("CUST-CON-202", "High DPD", "High",
     "Crossed the 90-day threshold this cycle. Escalate if no arrangement is agreed this week."),
]


async def main() -> None:
    async with SessionFactory() as db:
        # --- Remove the development junk ---------------------------------
        ids = [r[0] for r in (await db.execute(text(f"""
            SELECT id FROM customer_schema.debt_case
            WHERE {' OR '.join(f"summary ILIKE '{p}'" for p in JUNK)}"""))).all()]
        if ids:
            for tbl, col in [("collection.case_note", "case_id"),
                             ("collection.case_attachment", "case_id"),
                             ("collection.case_audit", "case_id"),
                             ("collection.case_assignment", "case_id"),
                             ("collection.case_tag", "case_id"),
                             ("collection.case_task", "case_id"),
                             ("customer_schema.case_activity", "case_id"),
                             ("collection.case_meta", "case_id")]:
                await db.execute(text(f"DELETE FROM {tbl} WHERE {col} = ANY(:ids)"), {"ids": ids})
            await db.execute(text("UPDATE customer_schema.ptp SET case_id = NULL WHERE case_id = ANY(:ids)"), {"ids": ids})
            await db.execute(text("UPDATE customer_schema.dispute SET case_id = NULL WHERE case_id = ANY(:ids)"), {"ids": ids})
            await db.execute(text("DELETE FROM customer_schema.debt_case WHERE id = ANY(:ids)"), {"ids": ids})
        print(f"  removed {len(ids)} development test cases")

        # --- Nothing should sit on the Administrator account --------------
        agents = [r[0] for r in (await db.execute(text("""
            SELECT u.id FROM administration.app_user u
            JOIN administration.role r ON r.id = u.role_id
            WHERE r.code = 'AGENT' AND u.status = 'ACTIVE' ORDER BY u.id"""))).all()]
        admin_cases = [r[0] for r in (await db.execute(text("""
            SELECT dc.id FROM customer_schema.debt_case dc
            JOIN administration.app_user u ON u.id = dc.assigned_agent_id
            JOIN administration.role r ON r.id = u.role_id
            WHERE r.code IN ('ADMIN','SUPER_ADMIN') AND dc.status <> 'CLOSED'"""))).all()]
        for i, case_id in enumerate(admin_cases):
            # Give them to whoever already owns the customer, else round-robin.
            owner = (await db.execute(text("""
                SELECT c.assigned_agent_id FROM customer_schema.debt_case dc
                JOIN customer_schema.customer c ON c.id = dc.customer_id
                WHERE dc.id = :i"""), {"i": case_id})).scalar_one_or_none()
            agent = owner if owner in agents else agents[i % len(agents)]
            await db.execute(text("""
                UPDATE customer_schema.debt_case SET assigned_agent_id = :a, updated_at = now()
                WHERE id = :i"""), {"a": agent, "i": case_id})
            await db.execute(text("""
                UPDATE collection.case_assignment SET agent_id = :a
                WHERE case_id = :i AND released_at IS NULL"""), {"a": agent, "i": case_id})
        print(f"  moved {len(admin_cases)} cases off the Administrator account")

        # --- Fresh cases: assigned, untouched, no activity ----------------
        made = 0
        for i, (code, ctype, priority, desc) in enumerate(NEW_CASES):
            row = (await db.execute(text("""
                SELECT c.id, c.assigned_agent_id,
                       (SELECT a.id FROM customer_schema.account a
                         WHERE a.customer_id = c.id ORDER BY a.outstanding DESC LIMIT 1) AS account_id
                FROM customer_schema.customer c WHERE c.customer_code = :c"""),
                {"c": code})).mappings().first()
            if row is None:
                continue
            agent = row["assigned_agent_id"] or agents[i % len(agents)]
            acc = (await db.execute(text("""
                SELECT outstanding, dpd, risk_level, strategy_id FROM customer_schema.account
                WHERE id = :i"""), {"i": row["account_id"]})).mappings().first()
            n = (await db.execute(text("SELECT nextval('customer_schema.debt_case_id_seq')"))).scalar_one()
            case_code = f"CASE-{n:06d}"
            sla = {"Critical": 4, "High": 8, "Medium": 24, "Low": 48}[priority]
            case_id = (await db.execute(text("""
                INSERT INTO customer_schema.debt_case
                  (case_code, customer_id, account_id, case_type_code, summary, status,
                   priority, risk_level, amount, dpd, strategy_id, assigned_agent_id,
                   opened_at, sla_deadline)
                VALUES (:code,:cu,:ac,:type,:sum,'OPEN',:pri,:risk,:amt,:dpd,:strat,:ag,
                        now(), now() + make_interval(hours => :h))
                RETURNING id"""),
                dict(code=case_code, cu=row["id"], ac=row["account_id"], type=ctype, sum=desc,
                     pri=priority, risk=acc["risk_level"] if acc else "Low",
                     amt=float(acc["outstanding"]) if acc else 0, dpd=acc["dpd"] if acc else 0,
                     strat=acc["strategy_id"] if acc else None, ag=agent, h=sla))).scalar_one()
            queue = (await db.execute(text(
                "SELECT default_queue FROM collection.case_type WHERE code = :t"),
                {"t": ctype})).scalar_one_or_none()
            await db.execute(text("""
                INSERT INTO collection.case_meta
                  (case_id, source_code, trigger_detail, created_by_user, created_by_role,
                   queue_code, workflow_code, workflow_state, due_date, strategy_id)
                VALUES (:i,'AGENT_MANUAL',:trig,:ag,'AGENT',:q,'STANDARD','ASSIGNED',
                        CURRENT_DATE + 7, :strat)"""),
                dict(i=case_id, trig=desc, ag=agent, q=queue,
                     strat=acc["strategy_id"] if acc else None))
            await db.execute(text("""
                INSERT INTO collection.case_assignment
                  (case_id, agent_id, queue_code, assigned_by, assignment_type, reason)
                VALUES (:i,:a,:q,:a,'MANUAL','Raised and assigned on creation.')"""),
                dict(i=case_id, a=agent, q=queue))
            await db.execute(text("""
                INSERT INTO collection.case_audit (case_id, action, actor_id, actor_role, new_value, reason)
                VALUES (:i,'CASE_CREATED',:a,'AGENT',:new,:reason)"""),
                dict(i=case_id, a=agent, new=f"{case_code} · {ctype} · {priority}", reason=desc))
            # No case_activity row on purpose — nobody has worked it yet.
            made += 1
        print(f"  created {made} fresh cases, assigned and untouched")

        await db.commit()

        rows = (await db.execute(text("""
            SELECT COALESCE(u.full_name, 'Unclaimed') AS agent,
                   count(*) FILTER (WHERE m.workflow_state = 'ASSIGNED') AS assigned,
                   count(*) FILTER (WHERE m.workflow_state = 'IN_PROGRESS') AS in_progress,
                   count(*) AS total
            FROM customer_schema.debt_case dc
            LEFT JOIN collection.case_meta m ON m.case_id = dc.id
            LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
            WHERE dc.status <> 'CLOSED' GROUP BY 1 ORDER BY 4 DESC"""))).mappings().all()
        print("\n  agent               assigned  in progress  total")
        for r in rows:
            print(f"  {r['agent']:<20} {r['assigned']:>7} {r['in_progress']:>12} {r['total']:>6}")
        empty = (await db.execute(text("""
            SELECT count(*) FROM collection.case_meta m
            JOIN customer_schema.debt_case dc ON dc.id = m.case_id
            WHERE m.workflow_state = 'ASSIGNED' AND dc.status <> 'CLOSED'
              AND NOT EXISTS (SELECT 1 FROM customer_schema.case_activity ca
                              WHERE ca.case_id = dc.id)"""))).scalar_one()
        total_assigned = (await db.execute(text("""
            SELECT count(*) FROM collection.case_meta m
            JOIN customer_schema.debt_case dc ON dc.id = m.case_id
            WHERE m.workflow_state = 'ASSIGNED' AND dc.status <> 'CLOSED'"""))).scalar_one()
        print(f"\n  Assigned cases with a completely empty timeline: {empty} of {total_assigned}")


if __name__ == "__main__":
    asyncio.run(main())
