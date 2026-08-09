"""Simplify the case lifecycle and bring case data back in step with 360.

Six changes, all to Case Management only — nothing in customer_schema's
billing, promise or dispute data is altered except the case rows themselves.

1. Four statuses: Assigned, In Progress, Resolved, Closed. Everything else
   collapses into one of them; escalation and stage are still recorded on
   case_escalation and the queue, so no information is lost.
2. Billing Issue becomes Dispute; High Risk is retired as a case type.
3. Every case carries a description.
4. Case value is re-synced to the account's live outstanding, which is what
   Subscriber 360 shows.
5. A case in Assigned with work already logged is moved to In Progress —
   Assigned means "nobody has touched it yet".
6. Transitions are rewritten for the four states.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory

# Everything the board used to hold, folded into the four that remain.
STATE_MAP = {
    "NEW": "ASSIGNED", "ASSIGNED": "ASSIGNED", "REOPENED": "ASSIGNED",
    "IN_PROGRESS": "IN_PROGRESS", "PENDING_CUSTOMER": "IN_PROGRESS",
    "PENDING_PAYMENT": "IN_PROGRESS", "MONITORING_PTP": "IN_PROGRESS",
    "PROMISE_TAKEN": "IN_PROGRESS", "BROKEN_PROMISE": "IN_PROGRESS",
    "ESCALATED": "IN_PROGRESS", "LEGAL": "IN_PROGRESS",
    "AGENCY": "IN_PROGRESS", "RECOVERY_AGENCY": "IN_PROGRESS",
    "RESOLVED": "RESOLVED", "CLOSED": "CLOSED", "CANCELLED": "CLOSED",
}

KEEP = [
    # code, name, category, initial, terminal, pauses_sla, colour, order
    ("ASSIGNED", "Assigned", "OPEN", True, False, False, "info", 10),
    ("IN_PROGRESS", "In Progress", "OPEN", False, False, False, "primary", 20),
    ("RESOLVED", "Resolved", "CLOSED", False, False, False, "success", 30),
    ("CLOSED", "Closed", "CLOSED", False, True, False, "muted", 40),
]

TRANSITIONS = [
    # from, to, label, permission, requires_note, requires_approval
    ("ASSIGNED", "IN_PROGRESS", "Start work", "caseManagement", False, False),
    ("ASSIGNED", "RESOLVED", "Resolve", "caseManagement", True, False),
    ("ASSIGNED", "CLOSED", "Close", "caseClose", True, False),
    ("IN_PROGRESS", "RESOLVED", "Resolve", "caseManagement", True, False),
    ("IN_PROGRESS", "ASSIGNED", "Hand back", "caseTransfer", True, False),
    ("IN_PROGRESS", "CLOSED", "Close", "caseClose", True, False),
    ("RESOLVED", "CLOSED", "Close", "caseClose", False, False),
    ("RESOLVED", "IN_PROGRESS", "Reopen", "caseReopen", True, False),
    ("CLOSED", "IN_PROGRESS", "Reopen", "caseReopen", True, False),
]

# Case type changes. Billing disputes are disputes; risk is a property of the
# customer, not a kind of case.
TYPE_MAP = {"Billing Issue": "Dispute", "High Risk": "Collection"}

DESCRIPTIONS = {
    "Collection": "Overdue balance requiring collection contact.",
    "Broken PTP": "Promise to pay was missed and needs re-engagement.",
    "Dispute": "Customer disputes a charge; collection is on hold until resolved.",
    "Payment Plan": "Instalment arrangement being negotiated or serviced.",
    "Legal Followup": "Pre-legal or legal action in progress on this balance.",
    "Payment Failure": "A payment attempt failed or was reversed.",
    "High DPD": "Account crossed a delinquency threshold.",
    "Agency Recall": "Agency placement due for recall or review.",
}


async def main() -> None:
    async with SessionFactory() as db:
        # --- 1. Case types ------------------------------------------------
        for old, new in TYPE_MAP.items():
            n = (await db.execute(text("""
                UPDATE customer_schema.debt_case SET case_type_code = :new, updated_at = now()
                WHERE case_type_code = :old"""), {"old": old, "new": new})).rowcount
            await db.execute(text(
                "UPDATE collection.assignment_rule SET case_type_code = :new WHERE case_type_code = :old"),
                {"old": old, "new": new})
            await db.execute(text("DELETE FROM collection.case_type WHERE code = :old"), {"old": old})
            print(f"  {old} → {new}: {n} cases re-typed")

        # --- 2. Descriptions ---------------------------------------------
        filled = 0
        for code, desc in DESCRIPTIONS.items():
            filled += (await db.execute(text("""
                UPDATE customer_schema.debt_case
                SET summary = :d, updated_at = now()
                WHERE case_type_code = :c AND (summary IS NULL OR btrim(summary) = '')"""),
                {"c": code, "d": desc})).rowcount
        filled += (await db.execute(text("""
            UPDATE customer_schema.debt_case
            SET summary = 'Collection case on an overdue balance.', updated_at = now()
            WHERE summary IS NULL OR btrim(summary) = ''"""))).rowcount
        print(f"  {filled} cases given a description")

        # --- 3. Case value follows the account, as 360 shows it ------------
        synced = (await db.execute(text("""
            UPDATE customer_schema.debt_case dc
            SET amount = a.outstanding, dpd = a.dpd, updated_at = now()
            FROM customer_schema.account a
            WHERE a.id = dc.account_id AND dc.status <> 'CLOSED'
              AND (abs(dc.amount - a.outstanding) > 0.02 OR dc.dpd <> a.dpd)"""))).rowcount
        print(f"  {synced} cases re-synced to the account balance Subscriber 360 shows")

        # --- 4. Collapse the workflow to four states -----------------------
        for old, new in STATE_MAP.items():
            if old == new:
                continue
            await db.execute(text("""
                UPDATE collection.case_meta SET workflow_state = :new, updated_at = now()
                WHERE workflow_state = :old"""), {"old": old, "new": new})
        await db.execute(text("""
            UPDATE collection.case_meta SET workflow_state = 'ASSIGNED'
            WHERE workflow_state IS NULL OR workflow_state NOT IN
                  ('ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED')"""))

        await db.execute(text("DELETE FROM collection.workflow_transition WHERE workflow_code='STANDARD'"))
        await db.execute(text("""
            DELETE FROM collection.workflow_state
            WHERE workflow_code='STANDARD' AND code NOT IN
                  ('ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED')"""))
        for code, name, cat, init, term, pause, colour, order in KEEP:
            await db.execute(text("""
                INSERT INTO collection.workflow_state
                  (workflow_code, code, name, category, is_initial, is_terminal,
                   pauses_sla, colour, sort_order)
                VALUES ('STANDARD',:c,:n,:cat,:init,:term,:pause,:col,:o)
                ON CONFLICT (workflow_code, code) DO UPDATE SET
                  name=EXCLUDED.name, category=EXCLUDED.category, is_initial=EXCLUDED.is_initial,
                  is_terminal=EXCLUDED.is_terminal, pauses_sla=EXCLUDED.pauses_sla,
                  sort_order=EXCLUDED.sort_order"""),
                dict(c=code, n=name, cat=cat, init=init, term=term, pause=pause,
                     col=colour, o=order))
        for i, (f, t_, label, perm, note, appr) in enumerate(TRANSITIONS):
            await db.execute(text("""
                INSERT INTO collection.workflow_transition
                  (workflow_code, from_state, to_state, label, required_permission,
                   requires_note, requires_approval, sort_order)
                VALUES ('STANDARD',:f,:t,:l,:p,:n,:a,:o)"""),
                dict(f=f, t=t_, l=label, p=perm, n=note, a=appr, o=i * 10))

        # --- 5. Assigned means untouched -----------------------------------
        # A case with real work logged against it is in progress, whatever the
        # column said. Assignment and transfer entries do not count as work —
        # a case handed to a new agent is legitimately fresh for them.
        moved = (await db.execute(text("""
            UPDATE collection.case_meta m
            SET workflow_state = 'IN_PROGRESS', updated_at = now()
            FROM customer_schema.debt_case dc
            WHERE dc.id = m.case_id AND m.workflow_state = 'ASSIGNED'
              AND dc.status <> 'CLOSED'
              AND EXISTS (
                    SELECT 1 FROM customer_schema.case_activity ca
                    WHERE ca.case_id = dc.id
                      AND ca.activity_type NOT IN ('STATUS_CHANGE','SYSTEM')
                  )
              -- unless the last thing that happened was a hand-over
              AND NOT EXISTS (
                    SELECT 1 FROM collection.case_assignment asg
                    WHERE asg.case_id = dc.id AND asg.released_at IS NULL
                      AND asg.assignment_type IN ('TRANSFER','ESCALATION')
                  )"""))).rowcount
        print(f"  {moved} cases moved out of Assigned because work had already been logged")

        # Keep the legacy status column in step with the new vocabulary.
        await db.execute(text("""
            UPDATE customer_schema.debt_case dc
            SET status = CASE m.workflow_state
                             WHEN 'ASSIGNED' THEN 'OPEN'
                             WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
                             WHEN 'RESOLVED' THEN 'IN_PROGRESS'
                             ELSE 'CLOSED' END,
                updated_at = now()
            FROM collection.case_meta m WHERE m.case_id = dc.id"""))

        await db.commit()

        rows = (await db.execute(text("""
            SELECT m.workflow_state, count(*) AS n,
                   count(*) FILTER (WHERE EXISTS (
                       SELECT 1 FROM customer_schema.case_activity ca
                       WHERE ca.case_id = m.case_id
                         AND ca.activity_type NOT IN ('STATUS_CHANGE','SYSTEM'))) AS with_work
            FROM collection.case_meta m
            JOIN customer_schema.debt_case dc ON dc.id = m.case_id
            WHERE m.merged_into_case_id IS NULL
            GROUP BY 1 ORDER BY 1"""))).mappings().all()
        print("\n  state         cases  of which have work logged")
        for r in rows:
            print(f"  {r['workflow_state']:<13} {r['n']:>5} {r['with_work']:>12}")
        types = (await db.execute(text("""
            SELECT case_type_code, count(*) FROM customer_schema.debt_case
            GROUP BY 1 ORDER BY 2 DESC"""))).all()
        print("\n  types:", ", ".join(f"{c} {n}" for c, n in types))
        bad = (await db.execute(text("""
            SELECT count(*) FROM customer_schema.debt_case dc
            LEFT JOIN customer_schema.account a ON a.id = dc.account_id
            WHERE dc.status <> 'CLOSED' AND a.id IS NOT NULL
              AND abs(dc.amount - a.outstanding) > 0.02"""))).scalar_one()
        print(f"  cases whose value disagrees with the account: {bad}")


if __name__ == "__main__":
    asyncio.run(main())
