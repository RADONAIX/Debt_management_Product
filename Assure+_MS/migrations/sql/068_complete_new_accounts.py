"""Fill the gaps the three lifecycle accounts left across the application.

The seed wrote the money and the work but not the account's own descriptive
columns, and it gave the enterprise a customer with no branch behind it. Three
things were visibly wrong:

  * Customer 360 showed no service type, no activation date, no last payment or
    contact date, and zero contactability, because those columns were never set.
  * The company 360 rolls its subscriber lines up through company_branch, and
    the enterprise account belonged to no branch — so the company read $0
    outstanding, 0 lines and Low Risk 0/100 while its own subscriber showed
    $14,820 at high risk.
  * Meridian had a single line, where every other enterprise in the book runs
    several across two or three branches.

Everything here is derived from records that already exist — last payment from
the payment ledger, last contact from the activity trail, contactability from
attempts against successes. The extra Meridian lines are new, and their billing
is written so each one ties on its own.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory

COMPANY = "COMP-010"
# The extra lines Meridian runs, beyond the one the lifecycle was built on.
EXTRA_LINES = [
    # code,        product,             plan,                     service,
    # balance, dpd, bucket,  branch, invoice, paid
    ("ACC-20008", "IoT Connectivity", "Fleet telematics · 240 SIMs", "IoT/M2M",
     3180.00, 47, "31-60", 0, 5180.00, 2000.00),
    ("ACC-20009", "Business Fibre", "Depot fibre 500Mbps", "Fibre",
     0.00, 0, "Current", 1, 4260.00, 4260.00),
    ("ACC-20010", "MPLS", "Site-to-site MPLS 200Mbps", "Leased Line",
     1940.00, 12, "1-30", 1, 6440.00, 4500.00),
]


async def main() -> None:
    async with SessionFactory() as db:
        # --- 1. The descriptive columns, from what the records already say ---
        n = (await db.execute(text("""
            UPDATE customer_schema.account a
            SET service_type = CASE a.product_code
                    WHEN 'Mobile Postpaid'   THEN 'Mobile Postpaid'
                    WHEN 'Device Financing'  THEN 'Mobile Postpaid'
                    WHEN 'Business Fibre'    THEN 'Fibre'
                    WHEN 'IoT Connectivity'  THEN 'IoT/M2M'
                    WHEN 'MPLS'              THEN 'Leased Line'
                    WHEN 'Enterprise Suite'  THEN 'Leased Line'
                    ELSE 'Broadband' END,
                -- On air a month before the first bill it was charged on.
                activation_date = COALESCE(a.activation_date, (
                    SELECT min(i.issue_date) - 30 FROM customer_schema.invoice i
                    WHERE i.account_id = a.id), CURRENT_DATE - 400),
                tenure_months = COALESCE(a.tenure_months, GREATEST(1, (
                    SELECT (CURRENT_DATE - min(i.issue_date))::int / 30
                    FROM customer_schema.invoice i WHERE i.account_id = a.id))),
                -- How often reaching out has actually worked on this account.
                contactability = CASE WHEN a.contact_attempts > 0
                    THEN round(a.contact_successes::numeric / a.contact_attempts * 100, 2)
                    ELSE 45.00 END,
                last_payment_at = (SELECT max(p.payment_date) FROM customer_schema.payment p
                                    WHERE p.account_id = a.id AND p.status = 'COMPLETED'),
                last_contact_at = (SELECT max(ca.occurred_at) FROM customer_schema.case_activity ca
                                    WHERE ca.account_id = a.id AND ca.direction <> 'INTERNAL'),
                updated_at = now()
            WHERE a.service_type IS NULL OR a.activation_date IS NULL
               OR a.contactability = 0 OR a.tenure_months IS NULL"""))).rowcount
        print(f"  1. {n} account(s) given their descriptive columns")

        # The next follow-up is whatever is actually diarised on the account.
        f = (await db.execute(text("""
            UPDATE customer_schema.account a
            SET next_followup_date = COALESCE((
                    SELECT min(t.due_date) FROM collection.case_task t
                    JOIN customer_schema.debt_case dc ON dc.id = t.case_id
                    WHERE dc.account_id = a.id AND t.status <> 'DONE'), (
                    SELECT min(p.promised_date) FROM customer_schema.ptp p
                    WHERE p.account_id = a.id AND p.status = 'PENDING'),
                    CURRENT_DATE + 3),
                updated_at = now()
            WHERE a.next_followup_date IS NULL"""))).rowcount
        print(f"  2. {f} account(s) given a next follow-up date")

        # --- 3. The enterprise needs branches to roll up through -------------
        cid = (await db.execute(text(
            "SELECT id FROM customer_schema.company WHERE company_code = :c"),
            {"c": COMPANY})).scalar_one()
        # Branch codes continue the sequence. Never ON CONFLICT DO UPDATE here:
        # branch_code is unique across the whole book, so claiming one that
        # already exists silently moves another company's branch — and its
        # accounts with it.
        nxt = (await db.execute(text("""
            SELECT COALESCE(max(substring(branch_code from 'BR-([0-9]+)')::int), 0)
            FROM customer_schema.company_branch"""))).scalar_one()
        branches = []
        for offset, (name, city, head) in enumerate((
            ("Head Office Branch", "Jebel Ali", True),
            ("Depot Branch", "Dubai", False),
        ), start=1):
            existing = (await db.execute(text("""
                SELECT id FROM customer_schema.company_branch
                WHERE company_id = :cid AND name = :name"""),
                {"cid": cid, "name": name})).scalar_one_or_none()
            if existing:
                branches.append(existing)
                continue
            bid = (await db.execute(text("""
                INSERT INTO customer_schema.company_branch
                  (company_id, branch_code, name, city, region_code, is_head_office, status)
                VALUES (:cid, :code, :name, :city, 'East', :head, 'ACTIVE')
                RETURNING id"""),
                {"cid": cid, "code": f"BR-{nxt + offset:04d}", "name": name,
                 "city": city, "head": head})).scalar_one()
            branches.append(bid)
        print(f"  3. {len(branches)} branch(es) created for {COMPANY}")

        # The line the lifecycle was built on belongs to the head office.
        await db.execute(text("""
            UPDATE customer_schema.account SET branch_id = :b, updated_at = now()
            WHERE account_code = 'ACC-20007'"""), {"b": branches[0]})

        # --- 4. The rest of the enterprise's estate --------------------------
        cust = (await db.execute(text(
            "SELECT id FROM customer_schema.customer WHERE customer_code = 'CUST-ENT-036'")
        )).scalar_one()
        ban = (await db.execute(text(
            "SELECT id FROM customer_schema.billing_account WHERE ban = 'BAN10018'")
        )).scalar_one()
        strategy = (await db.execute(text(
            "SELECT id FROM public.strategy WHERE strategy_code = 'STR-005'")
        )).scalar_one()
        agent = (await db.execute(text(
            "SELECT id FROM administration.app_user WHERE full_name = 'Lisa Davis'")
        )).scalar_one()

        added = 0
        for (code, product, plan, service, balance, dpd, bucket,
             branch_ix, billed, paid) in EXTRA_LINES:
            exists = (await db.execute(text(
                "SELECT id FROM customer_schema.account WHERE account_code = :c"),
                {"c": code})).scalar_one_or_none()
            if exists:
                continue
            risk = min(95.0, 12 + dpd * 0.5)
            level = "High" if risk >= 55 else "Medium" if risk >= 30 else "Low"
            stage = 3 if dpd > 30 else 1
            acc = (await db.execute(text("""
                INSERT INTO customer_schema.account
                  (account_code, customer_id, product_code, currency_code, contract_plan,
                   service_type, credit_limit, outstanding, prior_outstanding, target_mtd,
                   dpd, aging_bucket, risk_score, risk_level, strategy_id, dunning_stage,
                   channel_code, contact_attempts, contact_successes, billing_account_id,
                   branch_id, activation_date, tenure_months, contactability)
                VALUES (:code, :cu, :prod, 'USD', :plan, :svc, 40000, :bal, :bal, 0,
                        :dpd, :bucket, :risk, :level, :strat, :stage,
                        'Email', 4, 3, :ban, :branch,
                        CURRENT_DATE - 540, 18, 75.00)
                RETURNING id"""),
                {"code": code, "cu": cust, "prod": product, "plan": plan, "svc": service,
                 "bal": balance, "dpd": dpd, "bucket": bucket, "risk": risk,
                 "level": level, "stage": stage, "strat": strategy, "ban": ban,
                 "branch": branches[branch_ix]})
            ).scalar_one()

            # Billing that explains the balance: one bill, part-paid.
            await db.execute(text("""
                INSERT INTO customer_schema.invoice
                  (invoice_no, account_id, customer_id, billing_account_id,
                   bill_period_start, bill_period_end, issue_date, due_date, amount,
                   tax_amount, paid_amount, service_description, status, invoice_type)
                VALUES (:no, :acc, :cu, :ban,
                        CURRENT_DATE - 120, CURRENT_DATE - 91, CURRENT_DATE - 90,
                        CURRENT_DATE - 60, :amt, 0, :paid, :desc, :status,
                        'INDIVIDUAL')"""),
                {"no": f"INV-2026-{2040 + added}", "acc": acc, "cu": cust, "ban": ban,
                 "amt": billed, "paid": paid, "desc": f"{plan} — quarterly charge",
                 "status": "PAID" if paid >= billed - 0.01 else "OVERDUE"})
            if paid > 0:
                await db.execute(text("""
                    INSERT INTO customer_schema.payment
                      (payment_ref, customer_id, account_id, amount, payment_date,
                       method_code, status, notes)
                    VALUES (:ref, :cu, :acc, :amt,
                            CURRENT_DATE - 55, 'Bank Transfer', 'COMPLETED',
                            'Settled on the quarterly account')"""),
                    {"ref": f"PAY-R00126{added}", "cu": cust, "acc": acc, "amt": paid})
            await db.execute(text("""
                UPDATE customer_schema.account
                SET last_payment_at = CURRENT_DATE - 55,
                    last_contact_at = now() - interval '9 days',
                    next_followup_date = CURRENT_DATE + 4
                WHERE id = :a"""), {"a": acc})
            added += 1
        print(f"  4. {added} further subscriber line(s) added to {COMPANY}")

        # --- 5. The company has an owner -------------------------------------
        await db.execute(text("""
            UPDATE customer_schema.company SET account_manager_id = :m, updated_at = now()
            WHERE company_code = :c AND account_manager_id IS NULL"""),
            {"m": agent, "c": COMPANY})

        await db.commit()

        roll = (await db.execute(text("""
            SELECT count(a.id) AS lines, COALESCE(sum(a.outstanding), 0) AS outstanding,
                   COALESCE(max(a.dpd), 0) AS dpd,
                   COALESCE(round(avg(a.risk_score), 1), 0) AS risk
            FROM customer_schema.account a
            JOIN customer_schema.company_branch b ON b.id = a.branch_id
            WHERE b.company_id = :cid"""), {"cid": cid})).mappings().one()
        print(f"\n  {COMPANY} now rolls up: {roll['lines']} lines, "
              f"${float(roll['outstanding']):,.2f} outstanding, {roll['dpd']} DPD, "
              f"risk {roll['risk']}")

        gaps = (await db.execute(text("""
            SELECT count(*) FROM customer_schema.account
            WHERE service_type IS NULL OR activation_date IS NULL
               OR contactability = 0 OR next_followup_date IS NULL"""))).scalar_one()
        print(f"  accounts still missing descriptive columns: {gaps}")


if __name__ == "__main__":
    asyncio.run(main())
