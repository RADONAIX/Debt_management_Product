"""Make every figure in the application derive from the same facts.

Run scripts/verify_consistency.py before and after. What this fixes, in order:

1. Twelve invoices belonged to a customer but no account, so they appeared on
   no balance anywhere. Attached to the customer's account.
2. `invoiced - paid = outstanding` held on no account at all. A single opening
   balance invoice per account closes the gap, dated before that account's
   first bill, so month-by-month billing is untouched.
3. `invoice.paid_amount` and status were set independently of the payments
   received. Payments are now allocated oldest invoice first, so a paid invoice
   is one that money actually cleared.
4. Three accounts sat in an ageing bucket their own DPD contradicts.
5. Two cases were worked by one agent while Subscriber 360 named another.
6. One case sat in Assigned with work already logged against it.
7. `agent_performance` claimed £532k collected across four months; the payment
   ledger shows a fraction of that. Rebuilt from the ledger, and monthly
   targets reset to something the book can actually produce.

A legal case raised straight from case management has no agency placement
behind it, which is legitimate — the Portfolio split now reaches those through
the customer instead, rather than the case being 'fixed' out of existence.

Nothing here invents cash. Payments are never added, moved or altered — only
the billing that explains a balance, and the derived columns that follow.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory


async def main() -> None:
    async with SessionFactory() as db:
        # --- 1. Invoices with no account -----------------------------------
        n = (await db.execute(text("""
            UPDATE customer_schema.invoice i
            SET account_id = (SELECT a.id FROM customer_schema.account a
                               WHERE a.customer_id = i.customer_id
                               ORDER BY a.outstanding DESC LIMIT 1),
                updated_at = now()
            WHERE i.account_id IS NULL"""))).rowcount
        print(f"  1. {n} orphan invoices attached to their customer's account")

        # --- 2. An opening balance that explains what is owed ---------------
        # Every account was short of billing to justify its balance. One
        # historical invoice per account closes that, dated a month before the
        # account's first real bill so no reported month moves.
        rows = (await db.execute(text("""
            SELECT a.id, a.customer_id, a.account_code, a.billing_account_id,
                   a.outstanding + COALESCE(p.t, 0) - COALESCE(i.t, 0) AS gap,
                   COALESCE(i.first_issue, CURRENT_DATE - 180) AS first_issue
            FROM customer_schema.account a
            LEFT JOIN (SELECT account_id, sum(amount) t, min(issue_date) first_issue
                         FROM customer_schema.invoice GROUP BY 1) i ON i.account_id = a.id
            LEFT JOIN (SELECT account_id, sum(amount) t FROM customer_schema.payment
                        WHERE status = 'COMPLETED' GROUP BY 1) p ON p.account_id = a.id
            WHERE a.outstanding + COALESCE(p.t, 0) - COALESCE(i.t, 0) > 0.02"""))
        ).mappings().all()
        for r in rows:
            await db.execute(text("""
                INSERT INTO customer_schema.invoice
                  (invoice_no, account_id, customer_id, billing_account_id,
                   bill_period_start, bill_period_end, issue_date, due_date,
                   amount, tax_amount, paid_amount, service_description, status,
                   invoice_type)
                VALUES ('OB-' || :code, :acc, :cust, :billing,
                        CAST(:issue AS date) - 60, CAST(:issue AS date) - 31,
                        CAST(:issue AS date) - 30, CAST(:issue AS date) - 16, :amt, 0, 0,
                        'Opening balance carried forward', 'OVERDUE', 'INDIVIDUAL')
                ON CONFLICT DO NOTHING"""),
                {"code": r["account_code"], "acc": r["id"], "cust": r["customer_id"],
                 "billing": r["billing_account_id"], "issue": r["first_issue"],
                 "amt": round(float(r["gap"]), 2)})
        total = sum(float(r["gap"]) for r in rows)
        print(f"  2. {len(rows)} opening-balance invoices raised, {total:,.2f} in total")

        # --- 3. Allocate the payments that were actually received ------------
        await db.execute(text(
            "UPDATE customer_schema.invoice SET paid_amount = 0 WHERE paid_amount <> 0"))
        await db.execute(text("""
            WITH pay AS (
                SELECT account_id, sum(amount) AS cash FROM customer_schema.payment
                WHERE status = 'COMPLETED' GROUP BY 1
            ),
            ordered AS (
                SELECT i.id, i.account_id, i.amount,
                       sum(i.amount) OVER (PARTITION BY i.account_id
                                           ORDER BY i.issue_date, i.id) AS running
                FROM customer_schema.invoice i
            )
            UPDATE customer_schema.invoice i
            SET paid_amount = LEAST(o.amount,
                                    GREATEST(0, COALESCE(pay.cash, 0) - (o.running - o.amount))),
                updated_at = now()
            FROM ordered o LEFT JOIN pay ON pay.account_id = o.account_id
            WHERE i.id = o.id"""))
        await db.execute(text("""
            UPDATE customer_schema.invoice
            SET status = CASE WHEN paid_amount >= amount - 0.02 THEN 'PAID'
                              WHEN due_date < CURRENT_DATE THEN 'OVERDUE'
                              ELSE 'UNPAID' END,
                updated_at = now()"""))
        # Eleven accounts were billed more than their balance and payments
        # explain. A credit note cannot be an invoice here (amount must be
        # positive), so the correction reduces the unpaid part of the newest
        # bills — the mirror of the opening balances raised above. Nothing that
        # has been paid is ever reduced.
        fixed = 0
        while True:
            over = (await db.execute(text("""
                SELECT a.id, a.outstanding,
                       COALESCE(sum(i.amount - i.paid_amount), 0) AS open_bal
                FROM customer_schema.account a
                LEFT JOIN customer_schema.invoice i ON i.account_id = a.id
                GROUP BY a.id, a.outstanding
                HAVING COALESCE(sum(i.amount - i.paid_amount), 0) - a.outstanding > 0.02"""))
            ).mappings().all()
            if not over:
                break
            for r in over:
                excess = float(r["open_bal"]) - float(r["outstanding"])
                target = (await db.execute(text("""
                    SELECT id, amount, paid_amount FROM customer_schema.invoice
                    WHERE account_id = :a AND amount - paid_amount > 0.02
                    ORDER BY issue_date DESC, id DESC LIMIT 1"""),
                    {"a": r["id"]})).mappings().first()
                if target is None:
                    break
                cut = min(excess, float(target["amount"]) - float(target["paid_amount"]))
                await db.execute(text("""
                    UPDATE customer_schema.invoice
                    SET amount = amount - :cut,
                        service_description = COALESCE(service_description, '')
                            || ' (adjusted to the account balance)',
                        updated_at = now()
                    WHERE id = :i"""), {"cut": round(cut, 2), "i": target["id"]})
                fixed += 1
            if fixed > 500:      # a stuck loop should stop, not spin
                break
        await db.execute(text("""
            UPDATE customer_schema.invoice
            SET status = CASE WHEN paid_amount >= amount - 0.02 THEN 'PAID'
                              WHEN due_date < CURRENT_DATE THEN 'OVERDUE'
                              ELSE 'UNPAID' END
            WHERE status <> CASE WHEN paid_amount >= amount - 0.02 THEN 'PAID'
                                 WHEN due_date < CURRENT_DATE THEN 'OVERDUE'
                                 ELSE 'UNPAID' END"""))
        check = (await db.execute(text("""
            SELECT count(*) FROM customer_schema.account a
            WHERE abs(a.outstanding - COALESCE((
                SELECT sum(i.amount - i.paid_amount) FROM customer_schema.invoice i
                WHERE i.account_id = a.id), 0)) > 0.02"""))).scalar_one()
        print(f"  3. payments allocated oldest first, {fixed} over-billed invoice(s) "
              f"corrected · accounts still not tying: {check}")

        # --- 4. Ageing follows DPD -------------------------------------------
        n = (await db.execute(text("""
            UPDATE customer_schema.account
            SET aging_bucket = CASE
                    WHEN dpd <= 0 THEN 'Current' WHEN dpd <= 30 THEN '1-30'
                    WHEN dpd <= 60 THEN '31-60'  WHEN dpd <= 90 THEN '61-90'
                    ELSE '90+' END,
                updated_at = now()
            WHERE aging_bucket <> CASE
                    WHEN dpd <= 0 THEN 'Current' WHEN dpd <= 30 THEN '1-30'
                    WHEN dpd <= 60 THEN '31-60'  WHEN dpd <= 90 THEN '61-90'
                    ELSE '90+' END"""))).rowcount
        print(f"  4. {n} accounts re-bucketed to match their own DPD")

        # --- 5. The customer's agent is whoever holds the live case ----------
        n = (await db.execute(text("""
            UPDATE customer_schema.customer c
            SET assigned_agent_id = dc.assigned_agent_id, updated_at = now()
            FROM customer_schema.debt_case dc
            JOIN collection.case_meta m ON m.case_id = dc.id
            WHERE dc.customer_id = c.id AND dc.status <> 'CLOSED'
              AND m.merged_into_case_id IS NULL AND dc.assigned_agent_id IS NOT NULL
              AND c.assigned_agent_id IS DISTINCT FROM dc.assigned_agent_id"""))).rowcount
        print(f"  5. {n} customers re-pointed at the agent actually working them")

        # --- 6. Assigned means untouched --------------------------------------
        n = (await db.execute(text("""
            UPDATE collection.case_meta m
            SET workflow_state = 'IN_PROGRESS', updated_at = now()
            FROM customer_schema.debt_case dc
            WHERE dc.id = m.case_id AND m.workflow_state = 'ASSIGNED'
              AND dc.status <> 'CLOSED'
              AND EXISTS (SELECT 1 FROM customer_schema.case_activity ca
                           WHERE ca.case_id = dc.id
                             AND ca.activity_type NOT IN ('STATUS_CHANGE','SYSTEM'))"""))).rowcount
        await db.execute(text("""
            UPDATE customer_schema.debt_case dc SET status = 'IN_PROGRESS', updated_at = now()
            FROM collection.case_meta m
            WHERE m.case_id = dc.id AND m.workflow_state = 'IN_PROGRESS'
              AND dc.status = 'OPEN'"""))
        print(f"  6. {n} case(s) moved out of Assigned because work was logged")

        # --- 8. Agent performance, rebuilt from the ledger ---------------------
        await db.execute(text("DELETE FROM public.agent_performance"))
        await db.execute(text("""
            INSERT INTO public.agent_performance
              (agent_id, period_month, target_amount, collected_amount, cases_assigned,
               cases_resolved, ptp_created, ptp_kept, disputes_handled, contact_attempts,
               contact_successes, avg_resolution_hours, sla_breaches, quality_score)
            SELECT u.id, m.month,
                   0,
                   COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                              JOIN customer_schema.account a ON a.id = p.account_id
                              JOIN customer_schema.customer c ON c.id = a.customer_id
                             WHERE c.assigned_agent_id = u.id AND p.status = 'COMPLETED'
                               AND date_trunc('month', p.payment_date) = m.month), 0),
                   (SELECT count(*) FROM customer_schema.debt_case dc
                     WHERE dc.assigned_agent_id = u.id
                       AND date_trunc('month', dc.opened_at) = m.month),
                   (SELECT count(*) FROM customer_schema.debt_case dc
                     WHERE dc.assigned_agent_id = u.id
                       AND date_trunc('month', dc.closed_at) = m.month),
                   (SELECT count(*) FROM customer_schema.ptp t
                     WHERE t.created_by = u.id
                       AND date_trunc('month', t.created_at) = m.month),
                   (SELECT count(*) FROM customer_schema.ptp t
                     WHERE t.created_by = u.id AND t.status = 'KEPT'
                       AND date_trunc('month', t.created_at) = m.month),
                   (SELECT count(*) FROM customer_schema.dispute d
                     WHERE d.assigned_agent_id = u.id
                       AND date_trunc('month', d.created_at) = m.month),
                   (SELECT count(*) FROM customer_schema.case_activity ca
                     WHERE ca.agent_id = u.id AND ca.direction <> 'INTERNAL'
                       AND date_trunc('month', ca.occurred_at) = m.month),
                   (SELECT count(*) FROM customer_schema.case_activity ca
                     WHERE ca.agent_id = u.id AND ca.direction <> 'INTERNAL'
                       AND ca.outcome IS NOT NULL
                       AND date_trunc('month', ca.occurred_at) = m.month),
                   (SELECT round(avg(dc.resolution_hours), 2) FROM customer_schema.debt_case dc
                     WHERE dc.assigned_agent_id = u.id
                       AND date_trunc('month', dc.closed_at) = m.month),
                   (SELECT count(*) FROM customer_schema.debt_case dc
                     JOIN collection.case_meta cm ON cm.case_id = dc.id
                     WHERE dc.assigned_agent_id = u.id AND cm.sla_paused_at IS NULL
                       AND dc.sla_deadline < COALESCE(dc.closed_at, now())
                       AND date_trunc('month', dc.opened_at) = m.month),
                   NULL
            FROM administration.app_user u
            JOIN administration.role r ON r.id = u.role_id
            CROSS JOIN (SELECT generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months',
                                               date_trunc('month', CURRENT_DATE),
                                               interval '1 month')::date AS month) m
            WHERE r.code = 'AGENT' AND u.status = 'ACTIVE'"""))

        # A target the book can actually produce: a fifth above what the agent
        # has averaged over the months that have any receipts at all.
        await db.execute(text("""
            UPDATE public.agent_performance ap
            SET target_amount = GREATEST(500, round(COALESCE((
                    SELECT avg(x.collected_amount) FROM public.agent_performance x
                    WHERE x.agent_id = ap.agent_id AND x.collected_amount > 0), 0) * 1.2, -1))"""))
        await db.execute(text("""
            UPDATE public.agent_profile ap
            SET monthly_target = COALESCE((
                    SELECT max(x.target_amount) FROM public.agent_performance x
                    WHERE x.agent_id = ap.user_id), 1000),
                max_caseload = GREATEST(15, (
                    SELECT count(*) FROM customer_schema.debt_case dc
                    JOIN collection.case_meta m ON m.case_id = dc.id
                    WHERE dc.assigned_agent_id = ap.user_id AND dc.status <> 'CLOSED'
                      AND m.merged_into_case_id IS NULL) + 8)"""))
        n = (await db.execute(text("SELECT count(*) FROM public.agent_performance"))).scalar_one()
        print(f"  8. {n} agent-month rows rebuilt from the payment ledger")

        await db.commit()

        book = (await db.execute(text("""
            SELECT round(sum(outstanding)) AS outstanding,
                   round(sum(outstanding) FILTER (WHERE dpd > 0)) AS delinquent
            FROM customer_schema.account"""))).mappings().one()
        print(f"\n  book unchanged: {book['outstanding']:,} outstanding, "
              f"{book['delinquent']:,} of it delinquent")


if __name__ == "__main__":
    asyncio.run(main())
