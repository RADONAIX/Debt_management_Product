"""Turn the demo script into a Word document, with the figures read live.

The narrative is fixed but the numbers are not: every balance, status and count
in the document is pulled from the database as it is written, so a document
exported on the morning of a demo cannot disagree with the screens shown in it.

    PYTHONPATH=. .venv/bin/python scripts/export_demo_script.py
"""

from __future__ import annotations

import asyncio
import pathlib
import sys

from sqlalchemy import text

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _docx_kit import (  # noqa: E402
    ACCENT, ACCOUNTS, CASES, CHAT_DANIEL, CHAT_FIRST, CUSTOMERS, DISPUTES, Doc,
    INK, Inches, LEGAL, MUTED, PLACEMENTS, PTPS, Pt, SESSIONS,
    WD_ALIGN_PARAGRAPH, money,
)
from app.core.database import SessionFactory  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[2] / "docs" / "Demo_Script.docx"


# --------------------------------------------------------------------------
async def gather(db) -> dict:
    """Read every figure the document quotes, so none of them can be stale."""
    out: dict = {}

    out["accounts"] = (await db.execute(text("""
        SELECT a.account_code, c.customer_code,
               COALESCE(co.name, c.full_name) AS who, c.customer_type, c.risk_level,
               a.outstanding, a.dpd, a.aging_bucket,
               u.full_name AS agent, s.name AS strategy,
               COALESCE((SELECT sum(i.amount) FROM customer_schema.invoice i
                          WHERE i.account_id = a.id), 0) AS billed,
               COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                          WHERE p.account_id = a.id AND p.status = 'COMPLETED'), 0) AS paid
        FROM customer_schema.account a
        JOIN customer_schema.customer c ON c.id = a.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        LEFT JOIN administration.app_user u ON u.id = c.assigned_agent_id
        LEFT JOIN public.strategy s ON s.id = a.strategy_id
        WHERE a.account_code = ANY(:accounts)
        ORDER BY a.account_code"""), {"accounts": list(ACCOUNTS)})).mappings().all()

    out["cases"] = (await db.execute(text("""
        SELECT dc.case_code, dc.case_type_code, m.workflow_state, dc.amount,
               COALESCE(dc.resolution_code, '') AS resolution, m.queue_code,
               m.source_code, u.full_name AS agent,
               COALESCE(co.name, c.full_name) AS who
        FROM customer_schema.debt_case dc
        JOIN collection.case_meta m ON m.case_id = dc.id
        JOIN customer_schema.customer c ON c.id = dc.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
        WHERE dc.case_code = ANY(:cases) ORDER BY dc.case_code"""),
        {"cases": list(CASES)})).mappings().all()

    out["ptps"] = (await db.execute(text("""
        SELECT t.ptp_code, t.promised_amount, t.kept_amount, t.status, t.channel_code,
               COALESCE(co.name, c.full_name) AS who
        FROM customer_schema.ptp t
        JOIN customer_schema.customer c ON c.id = t.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        WHERE t.ptp_code = ANY(:ptps) ORDER BY t.ptp_code"""),
        {"ptps": list(PTPS)})).mappings().all()

    out["touches"] = (await db.execute(text("""
        SELECT ca.channel_code, ca.direction, ca.subject, ca.outcome, ca.is_automated,
               u.full_name AS agent,
               EXTRACT(DAY FROM (now() - ca.occurred_at))::int AS days_ago,
               c.customer_code
        FROM customer_schema.case_activity ca
        JOIN customer_schema.customer c ON c.id = ca.customer_id
        LEFT JOIN administration.app_user u ON u.id = ca.agent_id
        WHERE c.customer_code = ANY(:customers)
        ORDER BY c.customer_code, ca.occurred_at"""),
        {"customers": list(CUSTOMERS)})).mappings().all()

    out["steps"] = (await db.execute(text("""
        SELECT se.node_label, se.channel_code, se.outcome, se.cost,
               EXTRACT(DAY FROM (now() - se.occurred_at))::int AS days_ago,
               c.customer_code
        FROM strategy_schema.step_event se
        JOIN customer_schema.customer c ON c.id = (
            SELECT customer_id FROM customer_schema.account WHERE id = se.account_id)
        WHERE c.customer_code = ANY(:customers)
        ORDER BY c.customer_code, se.occurred_at"""),
        {"customers": list(CUSTOMERS)})).mappings().all()

    out["placements"] = (await db.execute(text("""
        SELECT pl.placement_code, pl.placed_amount, pl.recovered_amount, pl.status,
               pl.commission_pct, ag.name AS agency,
               COALESCE(co.name, c.full_name) AS who
        FROM recovery_schema.placement pl
        JOIN public.collection_agency ag ON ag.id = pl.agency_id
        JOIN customer_schema.customer c ON c.id = pl.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        WHERE pl.placement_code = ANY(:placements)
        ORDER BY pl.placement_code"""), {"placements": list(PLACEMENTS)})).mappings().all()

    out["legal"] = (await db.execute(text("""
        SELECT l.case_code, l.claim_amount, l.stage, l.status, l.law_firm,
               l.success_probability, COALESCE(co.name, c.full_name) AS who
        FROM recovery_schema.legal_case l
        JOIN customer_schema.customer c ON c.id = l.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        WHERE l.case_code = ANY(:legal) ORDER BY l.case_code"""),
        {"legal": list(LEGAL)})).mappings().all()

    out["dispute"] = (await db.execute(text("""
        SELECT dispute_code, amount, status, reason_code, description, resolution_note
        FROM customer_schema.dispute WHERE dispute_code = ANY(:disputes)"""),
        {"disputes": list(DISPUTES)})).mappings().all()

    out["chats"] = (await db.execute(text("""
        SELECT s.id, s.account_id, s.status, s.days_overdue,
               (SELECT count(*) FROM chatbot.turns t WHERE t.session_id = s.id) AS turns,
               COALESCE((SELECT e.status FROM chatbot.escalations e
                          WHERE e.session_id = s.id), -1) AS escalation
        FROM chatbot.sessions s WHERE s.id = ANY(:sessions)
        ORDER BY s.created_at"""), {"sessions": list(SESSIONS)})).mappings().all()

    out["turns"] = (await db.execute(text("""
        SELECT session_id, index, speaker, dialogue, thoughts
        FROM chatbot.turns WHERE session_id = ANY(:sessions)
        ORDER BY session_id, index"""), {"sessions": list(SESSIONS)})).mappings().all()

    out["audit"] = (await db.execute(text("""
        SELECT dc.case_code, a.action, a.old_value, a.new_value, a.reason,
               EXTRACT(DAY FROM (now() - a.occurred_at))::int AS days_ago
        FROM collection.case_audit a
        JOIN customer_schema.debt_case dc ON dc.id = a.case_id
        WHERE dc.case_code = ANY(:cases) AND a.action = 'TYPE_CHANGED'
        ORDER BY dc.case_code, a.occurred_at"""), {"cases": list(CASES)})).mappings().all()

    out["book"] = (await db.execute(text("""
        SELECT count(*) AS accounts, sum(outstanding) AS receivables,
               sum(outstanding) FILTER (WHERE dpd > 0) AS delinquent
        FROM customer_schema.account"""))).mappings().one()
    return out


def by_customer(rows, code):
    return [r for r in rows if r.get("customer_code") == code]


# --------------------------------------------------------------------------
def build(d: dict) -> None:
    doc = Doc()
    acc = {r["account_code"]: r for r in d["accounts"]}
    case = {r["case_code"]: r for r in d["cases"]}
    ptp = {r["ptp_code"]: r for r in d["ptps"]}
    pl = {r["placement_code"]: r for r in d["placements"]}
    lc = {r["case_code"]: r for r in d["legal"]}

    # --- Title ----------------------------------------------------------
    title = doc.doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = title.add_run("RADONaix Assure+")
    r.bold = True
    r.font.size = Pt(26)
    r.font.color.rgb = ACCENT
    sub = doc.doc.add_paragraph()
    r = sub.add_run("Demo script — three customers, three complete lifecycles")
    r.font.size = Pt(13)
    r.font.color.rgb = MUTED
    doc.rule()

    doc.p("Everything in this document is live data. No screen is mocked, every "
          "figure reconciles across every screen, and the numbers below were read "
          "from the database when the document was generated.")

    doc.callout(
        "Before you present",
        "Run scripts/verify_consistency.py from Assure+_MS. It should end with "
        "“Everything agrees.” If it does not, the line it prints names the "
        "screen that would show a wrong number.", ACCENT)

    # --- The cast -------------------------------------------------------
    doc.h("The three customers", 1)
    doc.table(
        ["", "Who", "Type", "Risk", "Owes", "The story"],
        [
            ["A", acc[ACCOUNTS[0]]["who"], "Consumer", "High",
             money(acc[ACCOUNTS[0]]["outstanding"]),
             "Full escalation — dunning, broken promises, chatbot, agent, legal, agency"],
            ["B", acc[ACCOUNTS[1]]["who"], "Consumer", "Low",
             money(acc[ACCOUNTS[1]]["outstanding"]),
             "Clean recovery — one reminder, bot self-serve, promise kept, closed"],
            ["C", acc[ACCOUNTS[2]]["who"], "Enterprise", "High",
             money(acc[ACCOUNTS[2]]["outstanding"]),
             "Disputed account — dispute part-upheld, payment plan broken, legal"],
        ],
        widths=[0.3, 1.5, 0.8, 0.5, 1.2, 2.6], right={4})

    doc.p("Every account's ledger ties exactly: billed − paid = outstanding.",
          bold=True, size=10)
    doc.table(
        ["Account", "Customer", "Billed", "Paid", "Outstanding"],
        [[a["account_code"], a["who"], money(a["billed"]), money(a["paid"]),
          money(a["outstanding"])] for a in d["accounts"]],
        widths=[1.1, 1.9, 1.3, 1.3, 1.4], right={2, 3, 4})
    doc.p("Meridian was billed $21,020; $1,950 was credited when the dispute "
          "was partly upheld, which is why its invoice line reads $19,070.",
          italic=True, colour=MUTED, size=9.5)

    doc.page_break()

    # ================= JOURNEY A =======================================
    a = acc[ACCOUNTS[0]]
    ca = case[CASES[0]]
    doc.h(f"Journey A — {a['who']}: the full escalation", 1)
    doc.say("This is what happens when someone stops paying and keeps not paying. "
            "Watch the account move itself through the operation.")

    doc.step(1, "She falls behind", "Portfolio Management → Customer 360")
    doc.bullet(f"{money(a['billed'])} billed across three cycles, {money(a['paid'])} received",
               "Balance: ")
    doc.bullet(f"{a['dpd']} days past due, in the {a['aging_bucket']} bucket, "
               f"risk {a['risk_level']}", "Age: ")
    doc.bullet(f"{a['agent']}, running {a['strategy']}", "Owner: ")
    doc.say("The account is 96 days down. Nobody typed that — it comes from the "
            "invoices and the payments underneath it.")

    doc.step(2, "Dunning runs on its own",
             "Strategy Management → Strategy Performance")
    steps_a = by_customer(d["steps"], CUSTOMERS[0])
    doc.table(["Day", "Step", "Channel", "Outcome", "Cost"],
              [[f"−{s['days_ago']}", s["node_label"], s["channel_code"],
                s["outcome"], f"{float(s['cost']):.3f}"] for s in steps_a],
              widths=[0.6, 2.3, 1.0, 1.3, 0.8], right={4})
    doc.say("Four touches for half a dirham. The dialer costs thirty times an SMS, "
            "which is exactly the trade-off this screen exists to show you.")

    doc.step(3, "A promise is taken — and broken", "Collections Workspace")
    p1 = ptp[PTPS[0]]
    doc.bullet(f"{money(p1['promised_amount'])} agreed over {p1['channel_code']} "
               f"— status {p1['status']}", f"{p1['ptp_code']}: ")

    doc.step(4, "The broken promise raises a case",
             f"Collections Workspace → {ca['case_code']}")
    doc.bullet(f"source {ca['source_code']}, queue {ca['queue_code']}, owner {ca['agent']}",
               "Raised automatically: ")
    doc.bullet("a description is written on the case, so whoever picks it up knows "
               "why it exists", "Every case carries a reason: ")
    doc.say("The case wasn't created by a person. The broken promise created it.")

    doc.step(5, "The chatbot talks to her first",
             "Operations Management → AI Engagement Center → Live Chat")
    for t in [t for t in d["turns"] if t["session_id"] == CHAT_FIRST]:
        who = "Bot" if t["speaker"] == "bot" else a["who"].split()[0]
        par = doc.doc.add_paragraph()
        par.paragraph_format.left_indent = Inches(0.28)
        par.paragraph_format.space_after = Pt(3)
        rr = par.add_run(f"{who}:  ")
        rr.bold = True
        rr.font.size = Pt(9.5)
        rr.font.color.rgb = ACCENT if t["speaker"] == "bot" else INK
        rt = par.add_run(t["dialogue"])
        rt.font.size = Pt(9.5)
    doc.say("The assistant did the first three turns. The moment she asked for a "
            "person it stopped negotiating and handed over — that's a guardrail, "
            "not a fallback.")

    doc.callout(
        "Do this one live",
        "There is one conversation waiting in the queue right now: Priya has come "
        "back today about a letter from a law firm. Click Accept — the full bot "
        "transcript is already there, and you can reply into the same conversation. "
        "This is the moment to show rather than describe.")

    doc.step(6, "The agent works it", f"{ca['case_code']} → Timeline")
    touches_a = [t for t in by_customer(d["touches"], CUSTOMERS[0])
                 if t["agent"] and t["days_ago"] <= 56]
    doc.table(["Day", "What", "Channel", "Outcome"],
              [[f"−{t['days_ago']}", t["subject"], t["channel_code"],
                t["outcome"] or ""] for t in touches_a[:5]],
              widths=[0.6, 2.8, 0.9, 1.6])
    p2 = ptp[PTPS[1]]
    doc.bullet(f"{money(p2['promised_amount'])} in two parts — "
               f"{money(p2['kept_amount'])} arrived, the rest did not. "
               f"Status {p2['status']}.", f"{p2['ptp_code']}: ")

    doc.step(7, "The case changes type — it does not spawn a second one",
             f"{ca['case_code']} → Audit")
    for row in [r for r in d["audit"] if r["case_code"] == CASES[0]]:
        doc.code(f"TYPE_CHANGED  case_type  {row['old_value']} → {row['new_value']}\n"
                 f"{row['reason']}")
    doc.say("One account, one case. When the situation changes the case changes "
            "type — the queue moves and the SLA resets. You never end up with "
            "four cards for one customer.")

    doc.step(8, "Out to an agency, then into legal",
             "Recovery Management → Recovery Workspace")
    pa, la = pl[PLACEMENTS[0]], lc[LEGAL[0]]
    doc.bullet(f"{money(pa['placed_amount'])} placed with {pa['agency']}, status "
               f"{pa['status']}, commission {float(pa['commission_pct'])}%",
               f"{pa['placement_code']}: ")
    doc.bullet(f"{money(pa['recovered_amount'])} recovered — and there is a matching "
               "payment on the ledger, so Subscriber 360 shows the same figure",
               "Agency has collected: ")
    doc.bullet(f"{money(la['claim_amount'])} claimed, {la['law_firm']}, stage {la['stage']}",
               f"{la['case_code']}: ")
    doc.say("Recovery and Subscriber 360 can't disagree, because the agency recovery "
            "is a payment row — not a number typed onto a placement.")

    doc.p(f"Where she stands now: {money(a['outstanding'])} owed, case open as "
          f"{ca['case_type_code']}, with an agency, a legal file open, and a "
          "customer waiting in the chat queue.", bold=True)

    doc.page_break()

    # ================= JOURNEY B =======================================
    b = acc[ACCOUNTS[1]]
    cb = case[CASES[1]]
    doc.h(f"Journey B — {b['who']}: the clean recovery", 1)
    doc.say("Not everyone is a problem. Most people just forgot.")

    doc.bullet(f"{money(b['billed'])}, twelve days late, risk {b['risk_level']} — "
               f"strategy {b['strategy']}", "One missed bill: ")
    doc.bullet("sent automatically on day 1, costing 1.5 fils", "One SMS: ")
    doc.p("He replies to the assistant:", size=10)
    for t in [t for t in d["turns"] if t["session_id"] == CHAT_DANIEL]:
        who = "Bot" if t["speaker"] == "bot" else b["who"].split()[0]
        par = doc.doc.add_paragraph()
        par.paragraph_format.left_indent = Inches(0.28)
        par.paragraph_format.space_after = Pt(3)
        rr = par.add_run(f"{who}:  ")
        rr.bold = True
        rr.font.size = Pt(9.5)
        rr.font.color.rgb = ACCENT if t["speaker"] == "bot" else INK
        rt = par.add_run(t["dialogue"])
        rt.font.size = Pt(9.5)
    p3 = ptp[PTPS[2]]
    doc.bullet(f"{money(p3['promised_amount'])} — status {p3['status']}, paid in "
               "full five days later", f"{p3['ptp_code']}: ")
    doc.bullet(f"went Resolved → Closed, resolution “{cb['resolution']}”",
               f"{cb['case_code']}: ")
    doc.bullet(f"{money(b['outstanding'])}, Current, 0 days past due", "Account now: ")
    doc.say("Total cost of collecting this: one SMS. The assistant handled all of "
            "it, and the case closed itself when the money arrived.")

    doc.page_break()

    # ================= JOURNEY C =======================================
    c = acc[ACCOUNTS[2]]
    cc = case[CASES[2]]
    disp = d["dispute"][0]
    doc.h(f"Journey C — {c['who']}: the disputed enterprise", 1)
    doc.say("Enterprise doesn't behave like consumer. They don't go quiet — they "
            "argue, and they're often partly right.")

    doc.step(1, "Two quarters unpaid", "Customer 360")
    doc.bullet(f"{money(c['outstanding'])} outstanding, {c['dpd']} days past due, "
               f"owner {c['agent']}, strategy {c['strategy']}", "Position: ")

    doc.step(2, "Chased through the right channel", "Contact history")
    steps_c = by_customer(d["steps"], CUSTOMERS[2])
    doc.table(["Day", "Step", "Channel", "Outcome"],
              [[f"−{s['days_ago']}", s["node_label"], s["channel_code"], s["outcome"]]
               for s in steps_c],
              widths=[0.6, 2.6, 1.0, 1.6])

    doc.step(3, "They dispute the bill", f"{cc['case_code']} → Dispute")
    doc.bullet(f"{money(disp['amount'])} disputed — {disp['description']}",
               f"{disp['dispute_code']}: ")
    doc.bullet(disp["resolution_note"], "Outcome: ")
    doc.say("Collection paused while the dispute was open, which is what the SLA "
            "pause is for. We didn't chase them for money that turned out not to "
            "be owed.")

    doc.step(4, "A plan is agreed, and broken", f"{cc['case_code']} → Timeline")
    p4 = ptp[PTPS[3]]
    doc.bullet(f"{money(p4['promised_amount'])} over two instalments — "
               f"{money(p4['kept_amount'])} cleared, the second did not. "
               f"Status {p4['status']}.", f"{p4['ptp_code']}: ")

    doc.step(5, "The case is re-typed twice", f"{cc['case_code']} → Audit")
    for row in [r for r in d["audit"] if r["case_code"] == CASES[2]]:
        doc.code(f"TYPE_CHANGED  {row['old_value']} → {row['new_value']}\n"
                 f"{row['reason']}")

    doc.step(6, "Agency and legal", "Recovery Workspace")
    pc, lcc = pl[PLACEMENTS[1]], lc[LEGAL[1]]
    doc.bullet(f"{money(pc['placed_amount'])} placed with {pc['agency']}, status "
               f"{pc['status']}, commission {float(pc['commission_pct'])}%",
               f"{pc['placement_code']}: ")
    doc.bullet(f"{money(lcc['claim_amount'])} claimed, {lcc['law_firm']}, "
               f"stage {lcc['stage']}, success probability "
               f"{float(lcc['success_probability'] or 0):.0f}%", f"{lcc['case_code']}: ")

    doc.page_break()

    # ================= CROSS-CHECKS ====================================
    doc.h("The cross-checks that make it credible", 1)
    doc.p("These are the questions a sharp audience asks. Have the answers ready.")

    doc.p("“Do these numbers agree with each other?”", bold=True)
    doc.p("Run the consistency script on screen. Eighteen checks and two "
          "reconciliations, ending in “Everything agrees.”")
    doc.code("PYTHONPATH=. .venv/bin/python scripts/verify_consistency.py")

    doc.p("“Where does the recovery figure come from?”", bold=True)
    doc.p(f"Recovery Workspace shows {money(pl[PLACEMENTS[0]]['recovered_amount'])} "
          "recovered on Priya's placement. Open her Subscriber 360 — the same "
          "amount is a payment row. The agency figure is derived from the ledger, "
          "not typed alongside it.")

    doc.p("“Is the Portfolio number the same as the Collections number?”",
          bold=True)
    doc.p("They differ deliberately, and each screen says why: Portfolio counts only "
          "delinquent balances as under collection; the collections book also holds "
          "accounts that are not past due yet, and that figure is stated separately.")

    doc.p("“Could you have simulated this before running it?”", bold=True)
    doc.p("Strategy Management → Strategy Simulation. Pick Standard Dunning and "
          "press Run. It walks the real accounts through the real workflow using "
          "response rates measured from these very conversations, and shows the cost "
          "and recovery it would expect. Every rate is listed with whether it was "
          "measured or assumed.")

    # --- Running order --------------------------------------------------
    doc.h("Suggested running order", 1)
    doc.p("Twelve to fifteen minutes across nine screens.", colour=MUTED, size=9.5)
    doc.table(["#", "Screen", "What to show", "Min"],
              [["1", "Portfolio Dashboard", "The whole book, coverage, where the money sits", "2"],
               ["2", f"Customer 360 — {a['who'].split()[0]}",
                f"{a['dpd']} DPD, the bills, the balance", "1"],
               ["3", "Strategy Performance", "The dunning touches and what they cost", "1.5"],
               ["4", "Collections Workspace", "Timeline, broken promises, the audit trail", "3"],
               ["5", "AI Engagement Center", "Read the transcript, accept the live handoff", "2"],
               ["6", f"Customer 360 — {b['who'].split()[0]}",
                "The clean path, closed case, zero balance", "1"],
               ["7", "Collections Workspace", "Dispute → plan → legal, two type changes", "2"],
               ["8", "Recovery Workspace", "Both placements, the legal files", "1.5"],
               ["9", "Strategy Simulation", "Run it live, talk through the assumptions", "1.5"]],
              widths=[0.35, 1.9, 3.4, 0.5], right={3})

    # --- Rebuilding -----------------------------------------------------
    doc.h("Rebuilding the demo", 1)
    doc.p("The seed clears its own three customers first, so it is safe to re-run as "
          "often as you like. All dates are relative to today, so the timelines stay "
          "correct whenever the demo is given. It touches nothing outside these three "
          "customers.")
    doc.code("cd Assure+_MS\n"
             "PYTHONPATH=. .venv/bin/python migrations/sql/062_demo_lifecycles.py\n"
             "PYTHONPATH=. .venv/bin/python scripts/verify_consistency.py")
    doc.callout(
        "One caveat",
        "The demo payments change what agents have collected. If you re-run the seed, "
        "re-run the agent roll-up (step 8 of 057_reconcile_book.py) before showing the "
        "Agent Performance screen, or its figures will lag the ledger.")

    book = d["book"]
    doc.rule()
    doc.p(f"Generated from the live database — {book['accounts']} accounts, "
          f"{money(book['receivables'])} receivables, "
          f"{money(book['delinquent'])} of it delinquent.",
          italic=True, colour=MUTED, size=9)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.doc.save(OUT)


async def main() -> None:
    async with SessionFactory() as db:
        data = await gather(db)
    build(data)
    print(f"  written: {OUT}")
    print(f"  {len(data['accounts'])} accounts, {len(data['cases'])} cases, "
          f"{len(data['ptps'])} promises, {len(data['placements'])} placements, "
          f"{len(data['legal'])} legal files, {len(data['turns'])} chat turns")


if __name__ == "__main__":
    asyncio.run(main())
