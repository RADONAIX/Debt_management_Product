"""Three customers, each carrying a complete collections lifecycle.

Built so the whole product can be walked end to end — three journeys that
between them touch every screen:

  A  Priya Raghavan       consumer, high risk    the full escalation
     bill missed → dunning → promise → broken → case → chatbot → agent →
     second promise → broken → re-typed to legal → agency → part recovered

  B  Daniel Okafor        consumer, low risk     the clean recovery
     bill missed → soft reminder → chatbot self-serve → promise → kept →
     paid in full → case resolved and closed

  C  Meridian Freight     enterprise, high risk  the disputed account
     bill missed → AP chased → dispute raised → partly upheld → payment plan
     → instalment missed → re-typed to legal → placed with an agency

Every row is dated relative to today so the timelines read correctly whenever
this is run, and the ledger identity the rest of the product depends on —
`sum(invoice.amount - invoice.paid_amount) = account.outstanding` — holds for
all three accounts. Identifiers continue the sequences the rest of the book
already uses, so nothing on screen reads as a seeded record. Re-running the
script rebuilds the three journeys from scratch and touches nothing else.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import os
import pathlib
import sys

from sqlalchemy import text

from app.core.database import SessionFactory

# The three customers this script owns. Codes continue the book's own
# sequences, so nothing in the data reads as a seeded demo record.
CODES = ("CUST-CON-207", "CUST-CON-208", "CUST-ENT-036")
COMPANY = "COMP-010"
BANS = ("BAN10016", "BAN10017", "BAN10018")
SESSIONS = ("sess_9c41d0be5f7a4e12ab73", "sess_2f88a51c6d3b47e9c104",
            "sess_71e0b93a4c8d42f5b6a8")


async def wipe(db) -> None:
    """Remove anything a previous run of this script created."""
    ids = [r[0] for r in (await db.execute(text(
        "SELECT id FROM customer_schema.customer WHERE customer_code = ANY(:c)"),
        {"c": list(CODES)})).all()]
    if not ids:
        return
    accts = [r[0] for r in (await db.execute(text(
        "SELECT id FROM customer_schema.account WHERE customer_id = ANY(:i)"),
        {"i": ids})).all()]
    cases = [r[0] for r in (await db.execute(text(
        "SELECT id FROM customer_schema.debt_case WHERE customer_id = ANY(:i)"),
        {"i": ids})).all()]

    if cases:
        for tbl in ("collection.case_note", "collection.case_attachment",
                    "collection.case_task", "collection.case_escalation",
                    "collection.case_tag", "collection.case_audit",
                    "collection.case_assignment", "collection.case_meta"):
            await db.execute(text(f"DELETE FROM {tbl} WHERE case_id = ANY(:c)"), {"c": cases})
    for tbl, col in (("chatbot.escalations", "session_id"), ("chatbot.turns", "session_id"),
                     ("chatbot.sessions", "id")):
        await db.execute(text(f"DELETE FROM {tbl} WHERE {col} = ANY(:s)"),
                         {"s": list(SESSIONS)})
    for tbl, col in (
        ("recovery_schema.legal_case", "customer_id"),
        ("recovery_schema.placement", "customer_id"),
        ("strategy_schema.step_event", "account_id"),
        ("strategy_schema.enrolment", "customer_id"),
        ("customer_schema.case_activity", "customer_id"),
        ("customer_schema.ptp", "customer_id"),
        ("customer_schema.dispute", "customer_id"),
        ("customer_schema.payment", "customer_id"),
        ("customer_schema.invoice", "customer_id"),
        ("customer_schema.debt_case", "customer_id"),
    ):
        key = accts if col == "account_id" else ids
        if key:
            await db.execute(text(f"DELETE FROM {tbl} WHERE {col} = ANY(:k)"), {"k": key})
    await db.execute(text("DELETE FROM customer_schema.account WHERE customer_id = ANY(:i)"),
                     {"i": ids})
    await db.execute(text(
        "DELETE FROM customer_schema.billing_account WHERE customer_id = ANY(:i) "
        "OR ban = ANY(:b)"), {"i": ids, "b": list(BANS)})
    await db.execute(text("DELETE FROM customer_schema.customer WHERE id = ANY(:i)"), {"i": ids})
    await db.execute(text("DELETE FROM customer_schema.company WHERE company_code = :c"),
                     {"c": COMPANY})
    print(f"  cleared {len(ids)} previously seeded customer(s)")


class Builder:
    """Small helpers so each journey reads as the story it is telling."""

    def __init__(self, db, agents: dict[str, int], strategies: dict[str, int]):
        self.db = db
        self.agents = agents
        self.strategies = strategies

    async def customer(self, **kw) -> int:
        cols = ", ".join(kw)
        vals = ", ".join(f":{k}" for k in kw)
        return (await self.db.execute(text(
            f"INSERT INTO customer_schema.customer ({cols}) VALUES ({vals}) RETURNING id"), kw)
        ).scalar_one()

    async def account(self, **kw) -> int:
        cols = ", ".join(kw)
        vals = ", ".join(f":{k}" for k in kw)
        return (await self.db.execute(text(
            f"INSERT INTO customer_schema.account ({cols}) VALUES ({vals}) RETURNING id"), kw)
        ).scalar_one()

    async def invoice(self, *, no, account, customer, billing, amount, issued_days_ago,
                      paid=0.0, desc) -> int:
        status = ("PAID" if paid >= amount - 0.01
                  else "OVERDUE" if issued_days_ago > 15 else "UNPAID")
        return (await self.db.execute(text("""
            INSERT INTO customer_schema.invoice
              (invoice_no, account_id, customer_id, billing_account_id,
               bill_period_start, bill_period_end, issue_date, due_date,
               amount, tax_amount, paid_amount, service_description, status, invoice_type)
            VALUES (:no, :acc, :cust, :billing,
                    CURRENT_DATE - CAST(:ago AS int) - 30, CURRENT_DATE - CAST(:ago AS int) - 1,
                    CURRENT_DATE - :ago, CURRENT_DATE - CAST(:ago AS int) + 15,
                    :amt, 0, :paid, :desc, :st, 'INDIVIDUAL')
            RETURNING id"""),
            {"no": no, "acc": account, "cust": customer, "billing": billing,
             "ago": issued_days_ago, "amt": amount, "paid": paid, "desc": desc, "st": status})
        ).scalar_one()

    async def payment(self, *, ref, account, customer, amount, days_ago, method,
                      notes=None, ptp=None, case=None) -> int:
        return (await self.db.execute(text("""
            INSERT INTO customer_schema.payment
              (payment_ref, customer_id, account_id, ptp_id, case_id, amount,
               payment_date, method_code, status, notes)
            VALUES (:ref, :cust, :acc, :ptp, :case, :amt, CURRENT_DATE - CAST(:ago AS int),
                    :method, 'COMPLETED', :notes)
            RETURNING id"""),
            {"ref": ref, "cust": customer, "acc": account, "ptp": ptp, "case": case,
             "amt": amount, "ago": days_ago, "method": method, "notes": notes})
        ).scalar_one()

    async def touch(self, *, kind, customer, account, case, channel, direction, subject,
                    body, outcome, days_ago, agent=None, automated=False) -> int:
        return (await self.db.execute(text("""
            INSERT INTO customer_schema.case_activity
              (activity_type, customer_id, account_id, case_id, channel_code, direction,
               subject, body, outcome, visibility, is_automated, agent_id, created_by,
               occurred_at)
            VALUES (:t, :cu, :ac, :case, :ch, :dir, :subj, :body, :out, 'INTERNAL',
                    :auto, :ag, :ag, now() - make_interval(days => :ago))
            RETURNING id"""),
            {"t": kind, "cu": customer, "ac": account, "case": case, "ch": channel,
             "dir": direction, "subj": subject, "body": body, "out": outcome,
             "auto": automated, "ag": agent, "ago": days_ago})
        ).scalar_one()

    async def ptp(self, *, code, customer, account, case, amount, promised_in,
                  created_days_ago, status, kept=0.0, channel, notes, agent) -> int:
        fulfilled = (dt.datetime.now(dt.UTC) - dt.timedelta(days=created_days_ago - 3)
                     if status == "KEPT" else None)
        return (await self.db.execute(text("""
            INSERT INTO customer_schema.ptp
              (ptp_code, customer_id, account_id, case_id, promised_amount, promised_date,
               instalment_count, kept_amount, status, channel_code, notes,
               fulfilled_at, created_at, created_by)
            VALUES (:code, :cu, :ac, :case, :amt, CURRENT_DATE + CAST(:in_days AS int), 1, :kept, :st,
                    :ch, :notes, :fulfilled,
                    now() - make_interval(days => CAST(:ago AS int)), :ag)
            RETURNING id"""),
            {"code": code, "cu": customer, "ac": account, "case": case, "amt": amount,
             "in_days": promised_in, "kept": kept, "st": status, "ch": channel,
             "notes": notes, "ago": created_days_ago, "ag": agent,
             "fulfilled": fulfilled})
        ).scalar_one()

    async def case(self, *, code, customer, account, ctype, summary, amount, dpd, risk,
                   opened_days_ago, agent, status, sla_hours, closed_days_ago=None,
                   resolution=None) -> int:
        # Worked out here rather than in SQL: a parameter used both as a value
        # and inside an expression leaves asyncpg unable to deduce its type.
        priority = "High" if risk in ("High", "Critical") else "Medium"
        closed_hours = ((opened_days_ago - closed_days_ago) * 24
                        if closed_days_ago is not None else None)
        return (await self.db.execute(text("""
            INSERT INTO customer_schema.debt_case
              (case_code, customer_id, account_id, case_type_code, summary, amount, dpd,
               risk_level, priority, status, assigned_agent_id, opened_at, sla_deadline,
               closed_at, resolution_code, resolution_hours, created_by, updated_by)
            VALUES (:code, :cu, :ac, :type, :sum, :amt, :dpd, :risk, :pri,
                    :st, :ag, now() - make_interval(days => :ago),
                    now() - make_interval(days => :ago) + make_interval(hours => :sla),
                    CASE WHEN CAST(:closed AS int) IS NOT NULL
                         THEN now() - make_interval(days => CAST(:closed AS int)) END,
                    :res, :closed_hours, :ag, :ag)
            RETURNING id"""),
            {"code": code, "cu": customer, "ac": account, "type": ctype, "sum": summary,
             "amt": amount, "dpd": dpd, "risk": risk, "pri": priority, "st": status,
             "ag": agent, "ago": opened_days_ago, "sla": sla_hours,
             "closed": closed_days_ago, "closed_hours": closed_hours, "res": resolution})
        ).scalar_one()

    async def case_meta(self, *, case, source, trigger, queue, state, agent, ptp=None,
                        dispute=None, strategy=None, placement=None, legal=None) -> None:
        await self.db.execute(text("""
            INSERT INTO collection.case_meta
              (case_id, source_code, trigger_detail, created_by_user, created_by_role,
               queue_code, workflow_code, workflow_state, ptp_id, dispute_id, strategy_id,
               placement_id, legal_case_id)
            VALUES (:c, :src, :trig, :by, 'AGENT', :q, 'STANDARD', :st, :ptp, :disp,
                    :strat, :pl, :legal)"""),
            {"c": case, "src": source, "trig": trigger, "by": agent, "q": queue,
             "st": state, "ptp": ptp, "disp": dispute, "strat": strategy,
             "pl": placement, "legal": legal})
        await self.db.execute(text("""
            INSERT INTO collection.case_assignment
              (case_id, agent_id, queue_code, assigned_by, assignment_type, reason)
            VALUES (:c, :a, :q, :a, 'AUTO', 'Routed by the dunning strategy.')"""),
            {"c": case, "a": agent, "q": queue})

    async def audit(self, *, case, action, actor, field=None, old=None, new=None,
                    reason=None, days_ago=0) -> None:
        await self.db.execute(text("""
            INSERT INTO collection.case_audit
              (case_id, action, field_name, old_value, new_value, actor_id, actor_role,
               reason, occurred_at)
            VALUES (:c, :a, :f, :o, :n, :actor, 'AGENT', :r,
                    now() - make_interval(days => CAST(:ago AS int)))"""),
            {"c": case, "a": action, "f": field, "o": old, "n": new, "actor": actor,
             "r": reason, "ago": days_ago})

    async def chat(self, *, session, account_code, principal, dpd, turns, escalate_at=None,
                   agent=None, days_ago=0, status="RESOLVED") -> None:
        await self.db.execute(text("""
            INSERT INTO chatbot.sessions
              (id, tenant_id, account_id, jurisdiction, product, principal, days_overdue,
               status, inferred_archetype, ledger, created_at, updated_at)
            VALUES (:id, 'radonaix', :acc, 'AE', 'Mobile Postpaid', :amt, :dpd, :st,
                    'COOPERATIVE', CAST(:ledger AS jsonb),
                    now() - make_interval(days => :ago),
                    now() - make_interval(days => :ago))"""),
            {"id": session, "acc": account_code, "amt": principal, "dpd": dpd,
             "st": status, "ledger": json.dumps({"principal": principal, "fees": 0}),
             "ago": days_ago})
        for i, (speaker, dialogue, thought) in enumerate(turns):
            await self.db.execute(text("""
                INSERT INTO chatbot.turns
                  (session_id, index, speaker, strategy, action, dialogue, thoughts, created_at)
                VALUES (:s, :i, :sp, 'EMPATHETIC_REMINDER', 'SPEAK', :d, :t,
                        now() - make_interval(days => :ago) + make_interval(mins => :i * 2))"""),
                {"s": session, "i": i, "sp": speaker, "d": dialogue, "t": thought,
                 "ago": days_ago})
        if escalate_at is not None:
            # A handoff nobody has taken yet is status 0; one that was worked
            # and finished is status 2. Decided here because a parameter used
            # both as a value and in a comparison confuses asyncpg's inference.
            status_code = 0 if agent is None else 2
            stamp = None if agent is None else days_ago
            await self.db.execute(text("""
                INSERT INTO chatbot.escalations
                  (session_id, turn_index, trigger, detail, status, assigned_to,
                   accepted_at, resolved_at, created_at)
                VALUES (:s, :i, 'CUSTOMER_REQUEST',
                        'Customer asked to speak to a person about a payment plan.',
                        :code, :ag,
                        CASE WHEN CAST(:stamp AS int) IS NULL THEN NULL
                             ELSE now() - make_interval(days => CAST(:stamp AS int)) END,
                        CASE WHEN CAST(:stamp AS int) IS NULL THEN NULL
                             ELSE now() - make_interval(days => CAST(:stamp AS int)) END,
                        now() - make_interval(days => CAST(:ago AS int)))"""),
                {"s": session, "i": escalate_at, "ag": agent, "ago": days_ago,
                 "code": status_code, "stamp": stamp})

    async def enrol(self, *, strategy, account, customer, balance, dpd, risk,
                    days_ago, steps) -> None:
        eid = (await self.db.execute(text("""
            INSERT INTO strategy_schema.enrolment
              (strategy_id, account_id, customer_id, version_no, variant, entered_at,
               opening_balance, opening_dpd, opening_risk)
            VALUES (:s, :a, :c, 'v1.0', 'A', now() - make_interval(days => :ago),
                    :bal, :dpd, :risk)
            RETURNING id"""),
            {"s": strategy, "a": account, "c": customer, "ago": days_ago,
             "bal": balance, "dpd": dpd, "risk": risk})).scalar_one()
        for n, (node, label, channel, outcome, cost, ago) in enumerate(steps, start=1):
            await self.db.execute(text("""
                INSERT INTO strategy_schema.step_event
                  (enrolment_id, strategy_id, account_id, node_id, node_type, node_label,
                   step_no, channel_code, outcome, cost, occurred_at)
                VALUES (:e, :s, :a, :node, 'touch', :label, :n, :ch, :out, :cost,
                        now() - make_interval(days => :ago))"""),
                {"e": eid, "s": strategy, "a": account, "node": node, "label": label,
                 "n": n, "ch": channel, "out": outcome, "cost": cost, "ago": ago})


async def main() -> None:
    async with SessionFactory() as db:
        await wipe(db)

        agents = {r[1]: r[0] for r in (await db.execute(text(
            "SELECT id, full_name FROM administration.app_user"))).all()}
        strategies = {r[1]: r[0] for r in (await db.execute(text(
            "SELECT id, strategy_code FROM public.strategy"))).all()}
        agency = (await db.execute(text(
            "SELECT id FROM public.collection_agency ORDER BY id LIMIT 1"))).scalar_one()
        b = Builder(db, agents, strategies)

        kim, carlos, lisa = agents["Robert Kim"], agents["Carlos Rodriguez"], agents["Lisa Davis"]

        # ==================================================================
        # A — Priya Raghavan · consumer · high risk · the full escalation
        # ==================================================================
        priya = await b.customer(
            customer_code="CUST-CON-207", customer_type="CONSUMER",
            full_name="Priya Raghavan", email="priya.raghavan@example.ae",
            phone="+971-50-114-2278", msisdn="971501142278",
            segment_code="Consumer", region_code="East", country_code="AE", city="Dubai",
            address="Flat 1204, Marina Heights, Dubai Marina",
            credit_score=548, risk_score=81.5, risk_level="High", contactability=62.0,
            best_contact_time="Evening", best_channel_code="WhatsApp",
            assigned_agent_id=kim, status="ACTIVE", behaviour_type="Evasive",
            preferred_language="English", communication_preference="WhatsApp",
            occupation="Retail supervisor", monthly_income=7800,
            financial_stress="High", legal_awareness="Low", financial_literacy="Medium")

        priya_ban = (await db.execute(text("""
            INSERT INTO customer_schema.billing_account (ban, customer_id, name, billing_cycle,
                payment_terms_days, currency_code, credit_limit, status)
            VALUES ('BAN10016', :c, 'Priya Raghavan', 1, 15, 'USD', 3000, 'ACTIVE')
            RETURNING id"""), {"c": priya})).scalar_one()

        priya_acct = await b.account(
            account_code="ACC-10066", customer_id=priya, product_code="Mobile Postpaid",
            currency_code="USD", contract_plan="Unlimited 5G 200", credit_limit=3000,
            outstanding=2465.00, prior_outstanding=2465.00, target_mtd=0,
            dpd=96, aging_bucket="90+", risk_score=81.5, risk_level="High",
            strategy_id=strategies["STR-002"], dunning_stage=4,
            channel_code="WhatsApp", contact_attempts=9, contact_successes=4,
            billing_account_id=priya_ban)

        # Billing: three cycles, one part-paid. 3,215 billed, 750 paid → 2,465 owed.
        inv_a1 = await b.invoice(no="INV-2026-2034", account=priya_acct, customer=priya,
                                 billing=priya_ban, amount=1085.00, issued_days_ago=111,
                                 paid=750.00, desc="Monthly plan + international roaming")
        inv_a2 = await b.invoice(no="INV-2026-2035", account=priya_acct, customer=priya,
                                 billing=priya_ban, amount=1065.00, issued_days_ago=81,
                                 desc="Monthly plan + data add-on")
        await b.invoice(no="INV-2026-2036", account=priya_acct, customer=priya,
                        billing=priya_ban, amount=1065.00, issued_days_ago=51,
                        desc="Monthly plan + late payment fee")

        # The dunning journey the strategy ran.
        await b.enrol(strategy=strategies["STR-002"], account=priya_acct, customer=priya,
                      balance=1085.00, dpd=16, risk="High", days_ago=95, steps=[
            ("std-1", "SMS + Email combo", "SMS", "DELIVERED", 0.015, 95),
            ("std-1", "SMS + Email combo", "Email", "OPENED", 0.002, 95),
            ("std-2", "AI Dialer attempt", "Dialer", "NO_ANSWER", 0.45, 88),
            ("std-3", "AI Voicebot negotiation", "WhatsApp", "CONTACTED", 0.035, 80),
        ])
        await b.touch(kind="SMS", customer=priya, account=priya_acct, case=None,
                      channel="SMS", direction="OUTBOUND", automated=True, days_ago=95,
                      subject="Payment reminder — $1,085 overdue",
                      body="Your bill of $1,085.00 is past due. Pay now: rdnx.ae/p/9f2k",
                      outcome="Delivered")
        await b.touch(kind="EMAIL", customer=priya, account=priya_acct, case=None,
                      channel="Email", direction="OUTBOUND", automated=True, days_ago=95,
                      subject="Your account is overdue", body="Statement attached.",
                      outcome="Opened")
        await b.touch(kind="CALL", customer=priya, account=priya_acct, case=None,
                      channel="Dialer", direction="OUTBOUND", automated=True, days_ago=88,
                      subject="Automated dialer attempt", body="No answer after 4 rings.",
                      outcome="NO_ANSWER")
        await b.touch(kind="WHATSAPP", customer=priya, account=priya_acct, case=None,
                      channel="WhatsApp", direction="OUTBOUND", automated=True, days_ago=80,
                      subject="WhatsApp nudge with payment link",
                      body="Hi Priya — we can split this over two months if that helps.",
                      outcome="CONTACTED")

        # The case, raised when the first promise broke.
        case_a = await b.case(
            code="CASE-000150", customer=priya, account=priya_acct,
            ctype="Broken PTP",
            summary=("Promise of $900 for 12 Jun was not honoured after three dunning "
                     "touches. Account is 96 days past due with $2,465 outstanding."),
            amount=2465.00, dpd=96, risk="High", opened_days_ago=58, agent=kim,
            status="IN_PROGRESS", sla_hours=24)

        ptp_a1 = await b.ptp(code="PTP-R001253", customer=priya, account=priya_acct,
                             case=case_a, amount=900.00, promised_in=-60,
                             created_days_ago=70, status="BROKEN", channel="WhatsApp",
                             notes="Agreed on WhatsApp to clear $900 by 12 June.",
                             agent=kim)
        ptp_a2 = await b.ptp(code="PTP-R001254", customer=priya, account=priya_acct,
                             case=case_a, amount=1200.00, promised_in=-40,
                             created_days_ago=50, status="BROKEN", kept=400.00,
                             channel="Dialer",
                             notes="Second arrangement after handover: $400 upfront, "
                                   "$800 on payday. Only the first part arrived.",
                             agent=kim)

        await b.case_meta(case=case_a, source="BROKEN_PTP",
                          trigger="Promise PTP-R001253 broken", queue="BROKEN_PROMISE",
                          state="IN_PROGRESS", agent=kim, ptp=ptp_a1,
                          strategy=strategies["STR-002"])

        # The chatbot conversation, and the handover to a person.
        await b.chat(session="sess_9c41d0be5f7a4e12ab73", account_code="ACC-10066",
                     principal=2465.00, dpd=53, days_ago=55, agent=kim, escalate_at=3,
                     turns=[
            ("bot", "Hello Priya — your account is $2,465 past due. I can set up a "
                    "payment plan right now if that would help.",
             "High-risk account, third dunning cycle. Lead with a plan, not a demand."),
            ("user", "I lost my job last month. I can't pay all of it.",
             "Hardship signal — soften, do not push the full balance."),
            ("bot", "Thank you for telling me. We can split this over three months, "
                    "starting with $400. Shall I arrange that?",
             "Offer the smallest viable first instalment."),
            ("user", "I want to talk to someone about it.",
             "Explicit request for a human. Escalate."),
        ])
        await b.touch(kind="CHAT", customer=priya, account=priya_acct, case=case_a,
                      channel="WhatsApp", direction="INBOUND", automated=True, days_ago=55,
                      subject="Chatbot conversation — hardship declared",
                      body="Customer reported job loss and asked for a person.",
                      outcome="Reached — discussing options")
        await b.touch(kind="CALL", customer=priya, account=priya_acct, case=case_a,
                      channel="Dialer", direction="OUTBOUND", agent=kim, days_ago=54,
                      subject="Agent call after chatbot handover",
                      body="Discussed hardship. Agreed $400 now, $800 on payday.",
                      outcome="PROMISE_MADE")
        await b.touch(kind="SMS", customer=priya, account=priya_acct, case=case_a,
                      channel="SMS", direction="OUTBOUND", agent=kim, days_ago=53,
                      subject="Confirming the arrangement",
                      body="Confirming $400 today and $800 on 28th. — Robert, RADONaix",
                      outcome="Delivered")
        await b.payment(ref="PAY-R001253", account=priya_acct, customer=priya,
                        amount=400.00, days_ago=52, method="Payment Link",
                        notes="First instalment of the second arrangement", ptp=ptp_a2,
                        case=case_a)
        await b.touch(kind="WHATSAPP", customer=priya, account=priya_acct, case=case_a,
                      channel="WhatsApp", direction="OUTBOUND", agent=kim, days_ago=39,
                      subject="Second instalment missed",
                      body="The $800 due on the 28th has not arrived.",
                      outcome="NO_ANSWER")

        # The case changes type rather than spawning a second one.
        await b.audit(case=case_a, action="TYPE_CHANGED", actor=kim, field="case_type",
                      old="Broken PTP", new="Legal Followup", days_ago=35,
                      reason="Second arrangement broken; balance referred for legal follow-up.")
        await db.execute(text("""
            UPDATE customer_schema.debt_case SET case_type_code = 'Legal Followup'
            WHERE id = :i"""), {"i": case_a})
        await db.execute(text("""
            UPDATE collection.case_meta SET queue_code = 'LEGAL' WHERE case_id = :i"""),
            {"i": case_a})
        await b.touch(kind="CALL", customer=priya, account=priya_acct, case=case_a,
                      channel="Dialer", direction="OUTBOUND", agent=kim, days_ago=35,
                      subject="Case re-typed: Broken PTP → Legal Follow-up",
                      body="Two arrangements broken. Moving to pre-legal.",
                      outcome="RESOLVED")

        # Placed with an agency; the agency clears part of it.
        pl_a = (await db.execute(text("""
            INSERT INTO recovery_schema.placement
              (placement_code, agency_id, customer_id, account_id, placed_amount,
               recovered_amount, commission_pct, commission_accrued, status, priority,
               placed_on, recall_due, last_activity, notes)
            VALUES ('PL-1092', :ag, :cu, :ac, 2065.00, 350.00, 12.5, 43.75,
                    'ACTIVE', 'High', CURRENT_DATE - 20, CURRENT_DATE + 70,
                    CURRENT_DATE - 8, 'Placed after two broken arrangements.')
            RETURNING id"""), {"ag": agency, "cu": priya, "ac": priya_acct})).scalar_one()
        await b.payment(ref="PAY-R001254", account=priya_acct, customer=priya,
                        amount=350.00, days_ago=8, method="Bank Transfer",
                        notes="Recovered under placement PL-1092", case=case_a)
        await db.execute(text("""
            INSERT INTO recovery_schema.legal_case
              (case_code, customer_id, placement_id, claim_amount, legal_cost,
               recovered_amount, stage, status, law_firm, attorney, filed_on, notes)
            VALUES ('LC-2026012', :cu, :pl, 1715.00, 250.00, 0, 'Pre-Legal', 'OPEN',
                    'Al Tamimi & Partners', 'S. Haddad', CURRENT_DATE - 5,
                    'Demand letter issued after agency placement.')"""),
            {"cu": priya, "pl": pl_a})

        # A live conversation waiting for a person, so the handoff can be
        # accepted on screen during the demo rather than only described.
        await b.chat(session="sess_2f88a51c6d3b47e9c104", account_code="ACC-10066",
                     principal=2465.00, dpd=96, days_ago=0, status="ESCALATED",
                     escalate_at=2, agent=None, turns=[
            ("user", "I got a letter from a law firm. What is happening with my account?",
             "Account is with an agency and pre-legal. Do not negotiate — hand to a person."),
            ("bot", "Your account was passed to our recovery partner after two "
                    "arrangements were missed. I can bring a collections specialist in now.",
             "Legal matter in progress: escalation is the only safe path."),
            ("user", "Yes, please. I can pay something this week.",
             "Willingness to pay on a pre-legal account — escalate immediately."),
        ])

        # ==================================================================
        # B — Daniel Okafor · consumer · low risk · the clean recovery
        # ==================================================================
        daniel = await b.customer(
            customer_code="CUST-CON-208", customer_type="CONSUMER",
            full_name="Daniel Okafor", email="daniel.okafor@example.ae",
            phone="+971-55-903-6641", msisdn="971559036641",
            segment_code="Consumer", region_code="West", country_code="AE",
            city="Abu Dhabi", address="Villa 22, Al Reem Island",
            credit_score=742, risk_score=18.0, risk_level="Low", contactability=94.0,
            best_contact_time="Morning", best_channel_code="SMS",
            assigned_agent_id=carlos, status="ACTIVE", behaviour_type="Forgetful",
            preferred_language="English", communication_preference="SMS",
            occupation="Software engineer", monthly_income=24500,
            financial_stress="Low", legal_awareness="High", financial_literacy="High")

        daniel_ban = (await db.execute(text("""
            INSERT INTO customer_schema.billing_account (ban, customer_id, name, billing_cycle,
                payment_terms_days, currency_code, credit_limit, status)
            VALUES ('BAN10017', :c, 'Daniel Okafor', 1, 15, 'USD', 5000, 'ACTIVE')
            RETURNING id"""), {"c": daniel})).scalar_one()

        daniel_acct = await b.account(
            account_code="ACC-10067", customer_id=daniel, product_code="Mobile Postpaid",
            currency_code="USD", contract_plan="Family 5G 300", credit_limit=5000,
            outstanding=0.00, prior_outstanding=326.00, target_mtd=0,
            dpd=0, aging_bucket="Current", risk_score=18.0, risk_level="Low",
            strategy_id=strategies["STR-001"], dunning_stage=0,
            channel_code="SMS", contact_attempts=2, contact_successes=2,
            billing_account_id=daniel_ban)

        await b.invoice(no="INV-2026-2037", account=daniel_acct, customer=daniel,
                        billing=daniel_ban, amount=326.00, issued_days_ago=27,
                        paid=326.00, desc="Monthly plan — family bundle")

        await b.enrol(strategy=strategies["STR-001"], account=daniel_acct, customer=daniel,
                      balance=326.00, dpd=12, risk="Low", days_ago=12, steps=[
            ("soft-1", "Day 1 · Friendly SMS reminder", "SMS", "DELIVERED", 0.015, 12),
        ])

        case_b = await b.case(
            code="CASE-000151", customer=daniel, account=daniel_acct,
            ctype="Collection",
            summary=("First missed bill on an otherwise clean account. $326 outstanding, "
                     "12 days past due, low risk."),
            amount=326.00, dpd=12, risk="Low", opened_days_ago=10, agent=carlos,
            status="CLOSED", sla_hours=48, closed_days_ago=3,
            resolution="Paid in full")

        await b.touch(kind="SMS", customer=daniel, account=daniel_acct, case=None,
                      channel="SMS", direction="OUTBOUND", automated=True, days_ago=12,
                      subject="Friendly reminder — $326 due",
                      body="Hi Daniel, your bill of $326.00 is a few days late. "
                           "Pay here: rdnx.ae/p/3b8t",
                      outcome="Delivered")
        await b.chat(session="sess_71e0b93a4c8d42f5b6a8", account_code="ACC-10067",
                     principal=326.00, dpd=12, days_ago=10, status="RESOLVED", turns=[
            ("user", "I got a text about a bill — I thought my card was on autopay.",
             "Low-risk, cooperative. Likely a genuine payment-method lapse."),
            ("bot", "Your autopay card expired on the 3rd, so the July bill of $326 "
                    "was not taken. I can send you a payment link now.",
             "Explain the cause before asking for money."),
            ("user", "Yes please, send it. I'll pay this week.",
             "Willing to pay — capture as a promise."),
            ("bot", "Sent. I have noted a promise to pay $326 by Friday. Thank you.",
             "Promise captured, no escalation needed."),
        ])
        await b.touch(kind="CHAT", customer=daniel, account=daniel_acct, case=case_b,
                      channel="WhatsApp", direction="INBOUND", automated=True, days_ago=10,
                      subject="Chatbot — expired card explained, promise captured",
                      body="Customer confirmed the autopay card had expired.",
                      outcome="PROMISE_MADE")
        ptp_b = await b.ptp(code="PTP-R001255", customer=daniel, account=daniel_acct,
                            case=case_b, amount=326.00, promised_in=-5,
                            created_days_ago=10, status="KEPT", kept=326.00,
                            channel="WhatsApp",
                            notes="Captured by the assistant after the card expiry was explained.",
                            agent=carlos)
        await b.payment(ref="PAY-R001255", account=daniel_acct, customer=daniel,
                        amount=326.00, days_ago=5, method="Payment Link",
                        notes="Promise PTP-R001255 honoured", ptp=ptp_b, case=case_b)
        await b.touch(kind="SMS", customer=daniel, account=daniel_acct, case=case_b,
                      channel="SMS", direction="OUTBOUND", agent=carlos, days_ago=4,
                      subject="Payment received — thank you",
                      body="We have received $326.00. Your account is up to date.",
                      outcome="RESOLVED")
        await b.case_meta(case=case_b, source="STRATEGY",
                          trigger="First missed bill on a current account",
                          queue="EARLY_STAGE", state="CLOSED", agent=carlos, ptp=ptp_b,
                          strategy=strategies["STR-001"])
        await b.audit(case=case_b, action="STATE_CHANGED", actor=carlos,
                      field="workflow_state", old="IN_PROGRESS", new="RESOLVED",
                      days_ago=4, reason="Promise honoured in full.")
        await b.audit(case=case_b, action="STATE_CHANGED", actor=carlos,
                      field="workflow_state", old="RESOLVED", new="CLOSED",
                      days_ago=3, reason="Closed after payment cleared.")

        # ==================================================================
        # C — Meridian Freight Logistics · enterprise · high risk · disputed
        # ==================================================================
        comp = (await db.execute(text("""
            INSERT INTO customer_schema.company
              (company_code, name, industry, country_code, hq_city, account_manager_id, status)
            VALUES ('COMP-010', 'Meridian Freight Logistics LLC', 'Transport & Logistics',
                    'AE', 'Jebel Ali', :am, 'ACTIVE')
            RETURNING id"""), {"am": lisa})).scalar_one()

        meridian = await b.customer(
            customer_code="CUST-ENT-036", customer_type="ENTERPRISE",
            company_id=comp, full_name="Faisal Al Marzooqi",
            company_name="Meridian Freight Logistics LLC",
            email="ap@meridianfreight.ae", phone="+971-4-887-3200",
            segment_code="Enterprise", region_code="East", country_code="AE",
            city="Jebel Ali", address="Warehouse 14, Jebel Ali Free Zone",
            credit_score=612, risk_score=76.0, risk_level="High", contactability=71.0,
            best_contact_time="Business hours", best_channel_code="Email",
            assigned_agent_id=lisa, status="ACTIVE", behaviour_type="Disputed",
            preferred_language="English", communication_preference="Email",
            occupation="Accounts Payable Manager", monthly_income=None,
            financial_stress="Medium", legal_awareness="High", financial_literacy="High")

        mer_ban = (await db.execute(text("""
            INSERT INTO customer_schema.billing_account (ban, company_id, name,
                billing_cycle, payment_terms_days, currency_code, credit_limit, status)
            VALUES ('BAN10018', :co, 'Meridian Freight Logistics LLC', 1, 30,
                    'USD', 60000, 'ACTIVE')
            RETURNING id"""), {"co": comp})).scalar_one()

        mer_acct = await b.account(
            account_code="ACC-20007", customer_id=meridian,
            product_code="Enterprise Suite", currency_code="USD",
            contract_plan="Fleet IoT + MPLS 200Mbps", credit_limit=60000,
            outstanding=14820.00, prior_outstanding=18020.00, target_mtd=0,
            dpd=104, aging_bucket="90+", risk_score=76.0, risk_level="High",
            strategy_id=strategies["STR-005"], dunning_stage=5,
            channel_code="Email", contact_attempts=7, contact_successes=5,
            billing_account_id=mer_ban)

        # Billed 21,020; 1,950 credited when the dispute was partly upheld; 4,250
        # paid as the first instalment. 19,070 - 4,250 = 14,820 owed.
        # A credit note cannot be a negative invoice here, so the credit reduces
        # the disputed invoice — the same way the book handles credits elsewhere.
        inv_c1 = await b.invoice(no="INV-2026-2038", account=mer_acct, customer=meridian,
                                 billing=mer_ban, amount=9070.00, issued_days_ago=119,
                                 paid=4250.00,
                                 desc="Fleet IoT connectivity + MPLS — Q2 "
                                      "($1,950 credited after dispute DSP-R001252)")
        await b.invoice(no="INV-2026-2039", account=mer_acct, customer=meridian,
                        billing=mer_ban, amount=10000.00, issued_days_ago=89,
                        desc="Fleet IoT connectivity + MPLS — Q3")

        await b.enrol(strategy=strategies["STR-005"], account=mer_acct, customer=meridian,
                      balance=21020.00, dpd=30, risk="High", days_ago=100, steps=[
            ("ent-1", "Dedicated enterprise email", "Email", "OPENED", 0.002, 100),
            ("ent-2", "Email with invoice pack", "Email", "CONTACTED", 0.002, 95),
            ("ent-4", "Relationship manager alert", "Dialer", "CONTACTED", 0.45, 88),
        ])
        await b.touch(kind="EMAIL", customer=meridian, account=mer_acct, case=None,
                      channel="Email", direction="OUTBOUND", automated=True, days_ago=100,
                      subject="Overdue account — Meridian Freight Logistics",
                      body="Two invoices remain unpaid totalling $21,020.",
                      outcome="Opened")
        await b.touch(kind="EMAIL", customer=meridian, account=mer_acct, case=None,
                      channel="Email", direction="OUTBOUND", agent=lisa, days_ago=95,
                      subject="Statement pack and remittance advice",
                      body="Full invoice pack attached for AP review.",
                      outcome="CONTACTED")
        await b.touch(kind="CALL", customer=meridian, account=mer_acct, case=None,
                      channel="Dialer", direction="OUTBOUND", agent=lisa, days_ago=88,
                      subject="Relationship manager call to AP",
                      body="AP disputes the Q2 IoT line charges. Asked for a breakdown.",
                      outcome="CONTACTED")

        case_c = await b.case(
            code="CASE-000152", customer=meridian, account=mer_acct,
            ctype="Dispute",
            summary=("Q2 IoT line charges disputed by accounts payable. $14,820 "
                     "outstanding across two invoices, 104 days past due."),
            amount=14820.00, dpd=104, risk="High", opened_days_ago=80, agent=lisa,
            status="IN_PROGRESS", sla_hours=72)

        disp_c = (await db.execute(text("""
            INSERT INTO customer_schema.dispute
              (dispute_code, customer_id, account_id, invoice_id, case_id, reason_code,
               description, amount, status, priority, assigned_agent_id, filed_at,
               sla_deadline, resolved_at, resolution_note)
            VALUES ('DSP-R001252', :cu, :ac, :inv, :case, 'INCORRECT_AMOUNT',
                    'AP states 46 IoT SIMs were decommissioned in March but billed in Q2.',
                    3200.00, 'RESOLVED', 'High', :ag,
                    now() - make_interval(days => 80), now() - make_interval(days => 73),
                    now() - make_interval(days => 60),
                    'Partly upheld: 28 of the 46 SIMs were decommissioned. $1,950 credited.')
            RETURNING id"""),
            {"cu": meridian, "ac": mer_acct, "inv": inv_c1, "case": case_c, "ag": lisa})
        ).scalar_one()

        await b.touch(kind="EMAIL", customer=meridian, account=mer_acct, case=case_c,
                      channel="Email", direction="INBOUND", days_ago=80,
                      subject="Dispute raised — Q2 IoT SIM charges",
                      body="AP formally disputes $3,200 of the Q2 invoice.",
                      outcome="CONTACTED")
        await b.touch(kind="EMAIL", customer=meridian, account=mer_acct, case=case_c,
                      channel="Email", direction="OUTBOUND", agent=lisa, days_ago=60,
                      subject="Dispute outcome — partly upheld",
                      body="28 of 46 SIMs confirmed decommissioned. $1,950 credited; "
                           "the balance stands.",
                      outcome="RESOLVED")
        await b.audit(case=case_c, action="TYPE_CHANGED", actor=lisa, field="case_type",
                      old="Dispute", new="Payment Plan", days_ago=58,
                      reason="Dispute settled; account moved to an instalment arrangement.")

        ptp_c = await b.ptp(code="PTP-R001256", customer=meridian, account=mer_acct,
                            case=case_c, amount=8000.00, promised_in=-40,
                            created_days_ago=55, status="BROKEN", kept=4250.00,
                            channel="Email",
                            notes="Two instalments of $4,000 agreed with the finance "
                                  "director. The first cleared; the second did not.",
                            agent=lisa)
        await b.payment(ref="PAY-R001256", account=mer_acct, customer=meridian,
                        amount=4250.00, days_ago=48, method="Bank Transfer",
                        notes="First instalment of the agreed plan", ptp=ptp_c, case=case_c)
        await b.touch(kind="EMAIL", customer=meridian, account=mer_acct, case=case_c,
                      channel="Email", direction="OUTBOUND", agent=lisa, days_ago=38,
                      subject="Second instalment overdue",
                      body="$4,000 due on the 15th has not been received.",
                      outcome="NO_ANSWER")

        await b.audit(case=case_c, action="TYPE_CHANGED", actor=lisa, field="case_type",
                      old="Payment Plan", new="Legal Followup", days_ago=30,
                      reason="Instalment plan broken; escalating to pre-legal.")
        await db.execute(text("""
            UPDATE customer_schema.debt_case SET case_type_code = 'Legal Followup'
            WHERE id = :i"""), {"i": case_c})

        pl_c = (await db.execute(text("""
            INSERT INTO recovery_schema.placement
              (placement_code, agency_id, customer_id, account_id, placed_amount,
               recovered_amount, commission_pct, commission_accrued, status, priority,
               placed_on, recall_due, last_activity, notes)
            VALUES ('PL-1093', :ag, :cu, :ac, 14820.00, 0, 15.0, 0,
                    'LEGAL', 'High', CURRENT_DATE - 15, CURRENT_DATE + 75,
                    CURRENT_DATE - 6, 'Enterprise account placed after a broken plan.')
            RETURNING id"""), {"ag": agency, "cu": meridian, "ac": mer_acct})).scalar_one()
        await db.execute(text("""
            INSERT INTO recovery_schema.legal_case
              (case_code, customer_id, placement_id, claim_amount, legal_cost,
               recovered_amount, stage, status, law_firm, attorney, filed_on,
               next_hearing, success_probability, notes)
            VALUES ('LC-2026013', :cu, :pl, 14820.00, 1800.00, 0, 'Filed', 'OPEN',
                    'Hadef & Partners', 'M. Al Rashid', CURRENT_DATE - 6,
                    CURRENT_DATE + 24, 68.0,
                    'Commercial claim filed. Guarantor named in the master agreement.')"""),
            {"cu": meridian, "pl": pl_c})

        await b.case_meta(case=case_c, source="DISPUTE_ESCALATION",
                          trigger="Dispute raised by accounts payable", queue="ENTERPRISE",
                          state="IN_PROGRESS", agent=lisa, ptp=ptp_c, dispute=disp_c,
                          strategy=strategies["STR-005"], placement=pl_c)

        await db.commit()

        # Six months of risk history, so the Risk Trend chart on each 360 has
        # something to plot. Reconstructed from the billing and payments above,
        # ending exactly on the score the account carries now.
        import subprocess  # noqa: PLC0415 - one-off call, not a hot path
        subprocess.run(
            [sys.executable, str(pathlib.Path(__file__).with_name(
                "067_risk_history_for_new_accounts.py"))],
            check=False, env={**os.environ, "PYTHONPATH": "."})

        # --- Prove the three accounts tie to their own ledgers ---------------
        print("\n  account      billed    paid   outstanding   ledger ties?")
        for code in ("ACC-10066", "ACC-10067", "ACC-20007"):
            r = (await db.execute(text("""
                SELECT a.outstanding,
                       COALESCE((SELECT sum(i.amount) FROM customer_schema.invoice i
                                  WHERE i.account_id = a.id), 0) AS billed,
                       COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                                  WHERE p.account_id = a.id AND p.status = 'COMPLETED'), 0) AS paid
                FROM customer_schema.account a WHERE a.account_code = :c"""),
                {"c": code})).mappings().one()
            ties = abs(float(r["billed"]) - float(r["paid"]) - float(r["outstanding"])) < 0.01
            print(f"  {code}  {float(r['billed']):>8,.0f} {float(r['paid']):>7,.0f} "
                  f"{float(r['outstanding']):>12,.2f}   {'yes' if ties else 'NO'}")


if __name__ == "__main__":
    asyncio.run(main())
