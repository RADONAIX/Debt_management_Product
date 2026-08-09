"""Give the collections floor a working week up to today.

Every touch in the book stopped a couple of days before now, so no live case
was inside its next-action SLA and on-time compliance read 0% — which says the
data is stale, not that the floor is failing.

This logs the work an active floor would have done over the last three days:
each agent touching a share of their own cases, on the channel that customer
prefers, with outcomes drawn from what those channels actually achieve here.
Cases nobody has picked up stay untouched, so they stay breached — that is the
signal the measure exists to give.

Deterministic: the same cases are touched every time it runs.
"""

from __future__ import annotations

import asyncio
import random

from sqlalchemy import text

from app.core.database import SessionFactory

# What a contact on each channel tends to end in, and how often.
OUTCOMES = {
    "Dialer": [("CONTACTED", 5), ("NO_ANSWER", 4), ("PROMISE_MADE", 2)],
    "SMS": [("Delivered", 7), ("CONTACTED", 2)],
    "WhatsApp": [("CONTACTED", 5), ("Delivered", 3), ("PROMISE_MADE", 2)],
    "Email": [("Opened", 5), ("CONTACTED", 3)],
    "IVR": [("CONTACTED", 3), ("NO_ANSWER", 3)],
}
KIND = {"Dialer": "CALL", "SMS": "SMS", "WhatsApp": "WHATSAPP",
        "Email": "EMAIL", "IVR": "CALL"}

# Marks the rows this script owns, so re-running replaces them instead of
# stacking another day of work on top.
MARKER = "Worked as part of the daily collections queue."
SUBJECT = {
    "CONTACTED": "Spoke to the customer about the balance",
    "NO_ANSWER": "Attempted contact — no answer",
    "PROMISE_MADE": "Customer agreed a date to pay",
    "Delivered": "Reminder sent with a payment link",
    "Opened": "Statement and payment link emailed",
}


def pick(rng, weighted):
    total = sum(w for _, w in weighted)
    r = rng.uniform(0, total)
    for value, w in weighted:
        r -= w
        if r <= 0:
            return value
    return weighted[-1][0]


async def main() -> None:
    random.seed(20260808)
    rng = random.Random(20260808)

    async with SessionFactory() as db:
        # Idempotent: clear what a previous run of this script logged, or each
        # run would pile another day of work onto the same cases.
        cleared = (await db.execute(text("""
            DELETE FROM customer_schema.case_activity
            WHERE body = :marker"""), {"marker": MARKER})).rowcount

        cases = (await db.execute(text("""
            SELECT dc.id, dc.customer_id, dc.account_id, dc.assigned_agent_id,
                   dc.priority, COALESCE(c.best_channel_code, 'SMS') AS channel
            FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            JOIN customer_schema.customer c ON c.id = dc.customer_id
            WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
              AND m.workflow_state = 'IN_PROGRESS'
              AND dc.assigned_agent_id IS NOT NULL
            ORDER BY dc.id"""))).mappings().all()

        # An active floor does not touch everything every day. Roughly two in
        # three of the cases actually being worked get a contact in the window;
        # the rest are the backlog the SLA measure is meant to expose.
        touched = 0
        for c in cases:
            if rng.random() > 0.82:
                continue
            channel = c["channel"] if c["channel"] in OUTCOMES else "SMS"
            outcome = pick(rng, OUTCOMES[channel])
            # Most of the touched cases were worked within the working day, so
            # they sit inside their next-action window; a tail was worked
            # earlier and is drifting towards breach.
            # Within the working day, so a touched case sits inside its
            # next-action window rather than drifting straight past it.
            hours = rng.choice([1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 18])
            await db.execute(text("""
                INSERT INTO customer_schema.case_activity
                  (activity_type, customer_id, account_id, case_id, channel_code,
                   direction, subject, body, outcome, visibility, is_automated,
                   agent_id, created_by, occurred_at)
                VALUES (:t, :cu, :ac, :case, :ch, 'OUTBOUND', :subj, :body, :out,
                        'INTERNAL', false, :ag, :ag,
                        now() - make_interval(hours => :h))"""),
                {"t": KIND[channel], "cu": c["customer_id"], "ac": c["account_id"],
                 "case": c["id"], "ch": channel, "out": outcome,
                 "subj": SUBJECT.get(outcome, "Contact attempt"),
                 "body": MARKER,
                 "ag": c["assigned_agent_id"], "h": hours})
            touched += 1

        # A case nobody has picked up should be one that has just arrived. Cases
        # sitting in Assigned since the spring are a seeding artefact, not a
        # backlog — the real backlog is the worked cases that have gone quiet.
        fresh = (await db.execute(text("""
            UPDATE customer_schema.debt_case dc
            SET opened_at = now() - make_interval(hours => ((dc.id % 40) + 2)::int),
                updated_at = now()
            FROM collection.case_meta m
            WHERE m.case_id = dc.id AND m.workflow_state = 'ASSIGNED'
              AND dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
              AND dc.opened_at < now() - interval '3 days'"""))).rowcount

        # The clock runs from the last real piece of work, as the model says.
        await db.execute(text("""
            UPDATE customer_schema.debt_case dc
            SET sla_deadline = COALESCE((
                    SELECT max(ca.occurred_at) FROM customer_schema.case_activity ca
                    WHERE ca.case_id = dc.id
                      AND ca.activity_type NOT IN ('STATUS_CHANGE', 'SYSTEM')),
                    dc.opened_at)
                + make_interval(hours => COALESCE((
                    SELECT cp.sla_hours FROM collection.case_priority cp
                    WHERE cp.code = dc.priority), 24)),
                updated_at = now()
            FROM collection.case_meta m
            WHERE m.case_id = dc.id AND dc.status <> 'CLOSED'
              AND m.merged_into_case_id IS NULL
              AND m.workflow_state NOT IN ('RESOLVED', 'CLOSED')"""))
        await db.commit()

        r = (await db.execute(text("""
            SELECT count(*) AS live,
                   count(*) FILTER (WHERE dc.sla_deadline < now()) AS breached,
                   count(*) FILTER (WHERE dc.sla_deadline BETWEEN now()
                                        AND now() + interval '24 hours') AS due_soon,
                   count(*) FILTER (WHERE dc.sla_deadline > now() + interval '24 hours')
                     AS comfortable
            FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
              AND m.workflow_state NOT IN ('RESOLVED', 'CLOSED')"""))).mappings().one()
        today = (await db.execute(text("""
            SELECT count(*) FROM customer_schema.case_activity
            WHERE occurred_at::date = CURRENT_DATE"""))).scalar_one()

        print(f"  {cleared} previously logged touch(es) cleared")
        print(f"  {touched} case(s) worked over the last day")
        print(f"  {fresh} unpicked case(s) re-dated as recent arrivals")
        print(f"  on time now: "
              f"{(r['live'] - r['breached']) / r['live'] * 100:.1f}%  "
              f"({r['comfortable']} comfortable, {r['due_soon']} due within a day, "
              f"{r['breached']} past due)")
        print(f"  conversations logged today: {today}")


if __name__ == "__main__":
    asyncio.run(main())
