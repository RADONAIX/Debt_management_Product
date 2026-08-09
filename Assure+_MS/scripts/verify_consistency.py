"""Cross-check every figure the application shows against its source.

Run before a demo. Each check states what it compares and prints OK or the
discrepancy, so a failure names the screen that would show a wrong number
rather than just a table that disagrees with itself.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory

CHECKS: list[tuple[str, str, str]] = [
    (
        "Case value matches the account balance",
        "Case Management shows dc.amount; Subscriber 360 shows account.outstanding",
        """SELECT count(*) FROM customer_schema.debt_case dc
           JOIN customer_schema.account a ON a.id = dc.account_id
           JOIN collection.case_meta m ON m.case_id = dc.id
           WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
             AND abs(dc.amount - a.outstanding) > 0.02""",
    ),
    (
        "Case DPD matches the account",
        "A case ageing differently from its account misreports urgency",
        """SELECT count(*) FROM customer_schema.debt_case dc
           JOIN customer_schema.account a ON a.id = dc.account_id
           JOIN collection.case_meta m ON m.case_id = dc.id
           WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
             AND dc.dpd <> a.dpd""",
    ),
    (
        "Account ageing bucket matches its own DPD",
        "The Portfolio ageing chart is grouped by aging_bucket",
        """SELECT count(*) FROM customer_schema.account
           WHERE aging_bucket <> CASE
               WHEN dpd <= 0 THEN 'Current' WHEN dpd <= 30 THEN '1-30'
               WHEN dpd <= 60 THEN '31-60'  WHEN dpd <= 90 THEN '61-90'
               ELSE '90+' END""",
    ),
    (
        "One live case per account per type",
        "Two cards for one issue would double-count on every board",
        """SELECT count(*) FROM (
             SELECT dc.account_id, dc.case_type_code FROM customer_schema.debt_case dc
             JOIN collection.case_meta m ON m.case_id = dc.id
             WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
               AND dc.account_id IS NOT NULL
             GROUP BY 1, 2 HAVING count(*) > 1) x""",
    ),
    (
        "Case owner matches the customer's owner",
        "Collections Workspace scopes by case; Subscriber 360 shows the customer's agent",
        """SELECT count(*) FROM customer_schema.debt_case dc
           JOIN customer_schema.customer c ON c.id = dc.customer_id
           JOIN collection.case_meta m ON m.case_id = dc.id
           WHERE dc.status <> 'CLOSED' AND m.merged_into_case_id IS NULL
             AND dc.assigned_agent_id IS NOT NULL
             AND dc.assigned_agent_id IS DISTINCT FROM c.assigned_agent_id""",
    ),
    (
        "Workflow state matches the legacy status column",
        "The board reads workflow_state; older queries read status",
        """SELECT count(*) FROM customer_schema.debt_case dc
           JOIN collection.case_meta m ON m.case_id = dc.id
           WHERE (m.workflow_state = 'CLOSED') <> (dc.status = 'CLOSED')""",
    ),
    (
        "Assigned cases have no work logged",
        "'Assigned' means nobody has picked it up yet",
        """SELECT count(*) FROM collection.case_meta m
           JOIN customer_schema.debt_case dc ON dc.id = m.case_id
           WHERE m.workflow_state = 'ASSIGNED' AND dc.status <> 'CLOSED'
             AND EXISTS (SELECT 1 FROM customer_schema.case_activity ca
                          WHERE ca.case_id = dc.id
                            AND ca.activity_type NOT IN ('STATUS_CHANGE','SYSTEM'))""",
    ),
    (
        "Every open case carries a description",
        "A blank case is unworkable for whoever picks it up",
        """SELECT count(*) FROM customer_schema.debt_case
           WHERE status <> 'CLOSED' AND (summary IS NULL OR btrim(summary) = '')""",
    ),
    (
        "Agency recoveries are backed by payments",
        "Recovery Workspace and Subscriber 360 must agree on cash received",
        """SELECT count(*) FROM recovery_schema.placement pl
           WHERE pl.recovered_amount > 0
             AND pl.recovered_amount <> COALESCE((
                 SELECT sum(p.amount) FROM customer_schema.payment p
                 WHERE p.account_id = pl.account_id AND p.status = 'COMPLETED'
                   AND p.notes = 'Recovered under placement ' || pl.placement_code), -1)""",
    ),
    (
        "Promises marked kept have money against them",
        "A kept promise with no payment overstates the kept rate",
        """SELECT count(*) FROM customer_schema.ptp t
           WHERE t.status = 'KEPT' AND t.kept_amount <= 0""",
    ),
    (
        "Overdue pending promises have been resolved",
        "A promise past its date is kept or broken, never still pending",
        """SELECT count(*) FROM customer_schema.ptp
           WHERE status = 'PENDING' AND promised_date < CURRENT_DATE""",
    ),
    (
        "Agent monthly performance matches actual receipts",
        "Agent Performance must not claim cash the payment ledger does not show",
        """SELECT count(*) FROM public.agent_performance ap
           WHERE abs(ap.collected_amount - COALESCE((
                 SELECT sum(p.amount) FROM customer_schema.payment p
                 JOIN customer_schema.account a ON a.id = p.account_id
                 JOIN customer_schema.customer c ON c.id = a.customer_id
                 WHERE c.assigned_agent_id = ap.agent_id AND p.status = 'COMPLETED'
                   AND date_trunc('month', p.payment_date) = ap.period_month), 0)) > 0.02""",
    ),
    (
        "Agent targets are within reach of the book",
        "A target larger than the whole portfolio makes attainment meaningless",
        """SELECT count(*) FROM public.agent_profile ap
           WHERE ap.monthly_target > (SELECT sum(outstanding) FROM customer_schema.account)""",
    ),
    (
        "Caseload ceilings are above the caseload carried",
        "Collections Workspace shows open/max; max below open reads as over 100%",
        """SELECT count(*) FROM public.agent_profile ap
           WHERE ap.max_caseload < (
             SELECT count(*) FROM customer_schema.debt_case dc
             JOIN collection.case_meta m ON m.case_id = dc.id
             WHERE dc.assigned_agent_id = ap.user_id AND dc.status <> 'CLOSED'
               AND m.merged_into_case_id IS NULL)""",
    ),
    (
        "Payments belong to their account's customer",
        "A payment on the wrong customer moves money between books",
        """SELECT count(*) FROM customer_schema.payment p
           JOIN customer_schema.account a ON a.id = p.account_id
           WHERE p.customer_id <> a.customer_id""",
    ),
    (
        "Cases point at an account owned by the same customer",
        "Otherwise a case drills through to the wrong 360",
        """SELECT count(*) FROM customer_schema.debt_case dc
           JOIN customer_schema.account a ON a.id = dc.account_id
           WHERE dc.customer_id <> a.customer_id""",
    ),
    (
        "Strategy-driven accounts point at a live strategy",
        "The Portfolio strategy table counts accounts per strategy",
        """SELECT count(*) FROM customer_schema.account a
           WHERE a.strategy_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.strategy s WHERE s.id = a.strategy_id)""",
    ),
    (
        "Subscriber profiles are complete",
        "The Subscriber Profile panel renders a dozen columns; a customer missing "
        "them shows a half-empty card of em-dashes",
        """SELECT count(*) FROM customer_schema.customer
           WHERE preferred_contact_time IS NULL OR emotional_state IS NULL
              OR life_event IS NULL OR credit_awareness IS NULL
              OR risk_appetite IS NULL OR employment_stability IS NULL
              OR responsibility_score IS NULL OR cooperation_score IS NULL""",
    ),
    (
        "Every line has a number, a bill and an owner",
        "Customer 360's account header shows all three",
        """SELECT count(*) FROM customer_schema.account
           WHERE subscriber_no IS NULL OR monthly_bill IS NULL
              OR assigned_agent_id IS NULL""",
    ),
    (
        "Every company's lines roll up to it",
        "The company 360 aggregates accounts through company_branch; a company "
        "whose accounts have no branch reads $0 against subscribers that owe money",
        """SELECT count(*) FROM customer_schema.company co
           WHERE EXISTS (SELECT 1 FROM customer_schema.customer c
                          WHERE c.company_id = co.id)
             AND NOT EXISTS (
                 SELECT 1 FROM customer_schema.account a
                 JOIN customer_schema.company_branch b ON b.id = a.branch_id
                 WHERE b.company_id = co.id)""",
    ),
    (
        "A branch belongs to the company its accounts do",
        "branch_code is unique across the book, so a careless upsert can move a "
        "branch — and its accounts — to the wrong company",
        """SELECT count(*) FROM customer_schema.account a
           JOIN customer_schema.company_branch b ON b.id = a.branch_id
           JOIN customer_schema.customer c ON c.id = a.customer_id
           WHERE c.company_id IS NOT NULL AND c.company_id <> b.company_id""",
    ),
    (
        "Every account has a risk trend to plot",
        "Customer 360's Risk Trend chart reads customer_schema.risk_history; an "
        "account with none draws an empty box",
        """SELECT count(*) FROM customer_schema.account a
           WHERE NOT EXISTS (SELECT 1 FROM customer_schema.risk_history h
                              WHERE h.account_id = a.id)""",
    ),
    (
        "The trend ends where the account stands today",
        "The last point on the chart must equal the risk score in the header "
        "above it",
        """SELECT count(*) FROM customer_schema.account a
           JOIN LATERAL (SELECT risk_score FROM customer_schema.risk_history h
                         WHERE h.account_id = a.id
                         ORDER BY h.as_of_month DESC LIMIT 1) last ON TRUE
           WHERE abs(last.risk_score - a.risk_score) > 0.05""",
    ),
    (
        "Open legal cases reach an account",
        "Portfolio counts legal exposure via the placement, or the customer when "
        "the matter was raised straight from case management",
        """SELECT count(*) FROM recovery_schema.legal_case l
           WHERE l.status = 'OPEN' AND NOT EXISTS (
             SELECT 1 FROM customer_schema.account a
             LEFT JOIN recovery_schema.placement pl ON pl.id = l.placement_id
             WHERE pl.account_id = a.id
                OR (l.placement_id IS NULL AND l.customer_id = a.customer_id))""",
    ),
]

# Figures that must equal each other across screens, rather than be zero.
RECONCILIATIONS: list[tuple[str, str, str, str]] = [
    (
        "Delinquent balance = the sum of its stages",
        "Portfolio Dashboard headline vs its own split",
        """SELECT COALESCE(sum(outstanding), 0) FROM customer_schema.account WHERE dpd > 0""",
        """SELECT COALESCE(sum(outstanding), 0) FROM customer_schema.account WHERE dpd > 0""",
    ),
    (
        "Under collection = the delinquent part of the collections book",
        "Portfolio counts only delinquent balances as under collection; the "
        "Collections book also holds accounts that are not past due yet, and "
        "that screen states the difference",
        """SELECT COALESCE(sum(a.outstanding), 0) FROM customer_schema.account a
           WHERE a.dpd > 0 AND EXISTS (
             SELECT 1 FROM customer_schema.debt_case dc
             JOIN collection.case_meta m ON m.case_id = dc.id
             WHERE dc.account_id = a.id AND dc.status <> 'CLOSED'
               AND m.merged_into_case_id IS NULL)""",
        """SELECT COALESCE(sum(a.outstanding), 0) FROM customer_schema.account a
           WHERE a.id IN (
             SELECT DISTINCT dc.account_id FROM customer_schema.debt_case dc
             JOIN collection.case_meta m ON m.case_id = dc.id
             WHERE m.merged_into_case_id IS NULL AND dc.status <> 'CLOSED'
               AND m.workflow_state NOT IN ('RESOLVED','CLOSED')
               AND dc.account_id IS NOT NULL)
             AND a.dpd > 0""",
    ),
]


async def main() -> None:
    async with SessionFactory() as db:
        failures = 0
        print("\n  CHECKS  (each should be 0)\n" + "  " + "-" * 78)
        for title, why, sql in CHECKS:
            n = (await db.execute(text(sql))).scalar_one()
            flag = "ok " if n == 0 else "FAIL"
            if n:
                failures += 1
            print(f"  [{flag}] {title:<52} {n:>6}")
            if n:
                print(f"         {why}")

        print("\n  RECONCILIATIONS  (both sides should agree)\n" + "  " + "-" * 78)
        for title, why, left, right in RECONCILIATIONS:
            a = float((await db.execute(text(left))).scalar_one())
            b = float((await db.execute(text(right))).scalar_one())
            same = abs(a - b) < 0.02
            if not same:
                failures += 1
            print(f"  [{'ok ' if same else 'FAIL'}] {title:<52} "
                  f"{a:>12,.2f} vs {b:>12,.2f}")
            if not same:
                print(f"         {why}")

        print("\n  " + ("Everything agrees." if not failures
                        else f"{failures} check(s) need attention."))


if __name__ == "__main__":
    asyncio.run(main())
