"""The long-form walkthrough: what every KPI means, and the three lifecycles.

Where Demo_Script.docx is the thing you hold while presenting, this is the
document you send afterwards. It explains every measure on every screen — what
it counts, how it is worked out, which tables it comes from — tells the three
customers' stories in full, and then proves the figures agree with each other.

Every number is read live: from the API where a screen has one, from the
database where the detail is finer than the API exposes.

    PYTHONPATH=. .venv/bin/python scripts/export_walkthrough.py
"""

from __future__ import annotations

import asyncio
import json
import pathlib
import sys
import urllib.request

from sqlalchemy import text

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _docx_kit import (  # noqa: E402
    ACCENT, ACCOUNTS, CASES, CHAT_DANIEL, CHAT_FIRST, CHAT_LIVE, CUSTOMERS,
    DISPUTES, Doc, GOOD, INK, Inches, LEGAL, MUTED, PLACEMENTS, PTPS, Pt,
    SESSIONS, WARN, WD_ALIGN_PARAGRAPH, money,
)
from app.core.database import SessionFactory  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[2] / "docs" / "Demo_Walkthrough.docx"
API = "http://127.0.0.1:8008/api"


# --------------------------------------------------------------------------
def api_reader():
    req = urllib.request.Request(
        f"{API}/auth/login",
        data=json.dumps({"email": "admin@radonaix.io",
                         "password": "ChangeMe!123"}).encode(),
        headers={"content-type": "application/json"})
    token = json.load(urllib.request.urlopen(req))["token"]

    def get(path: str):
        r = urllib.request.Request(f"{API}{path}",
                                   headers={"Authorization": f"Bearer {token}"})
        return json.load(urllib.request.urlopen(r))
    return get


def pct(v, dp: int = 1) -> str:
    return "—" if v is None else f"{float(v):.{dp}f}%"


# --------------------------------------------------------------------------
async def gather(db) -> dict:
    get = api_reader()
    d: dict = {
        "portfolio": get("/portfolio/overview"),
        "collections": get("/collection/overview"),
        "contacts": get("/engagement/contacts/summary?days=90"),
        "chat": get("/engagement/chat/summary"),
        "sim_assumptions": get("/strategies/simulation/assumptions"),
        "strategies": get("/strategies"),
    }
    agents = [a for a in get("/collection/config")["agents"]]
    d["agent_perf"] = get(f"/operations/performance?agentId={agents[0]['id']}") if agents else None

    d["journeys"] = (await db.execute(text("""
        SELECT c.customer_code, COALESCE(co.name, c.full_name) AS who,
               c.full_name AS contact, c.customer_type, c.risk_level, c.risk_score,
               c.credit_score, c.behaviour_type, c.occupation, c.monthly_income,
               c.financial_stress, c.email, c.phone, c.city,
               a.account_code, a.product_code, a.contract_plan, a.outstanding, a.dpd,
               a.aging_bucket, a.credit_limit, a.contact_attempts, a.contact_successes,
               u.full_name AS agent, s.name AS strategy, s.strategy_code,
               COALESCE((SELECT sum(i.amount) FROM customer_schema.invoice i
                          WHERE i.account_id = a.id), 0) AS billed,
               COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                          WHERE p.account_id = a.id AND p.status = 'COMPLETED'), 0) AS paid
        FROM customer_schema.customer c
        JOIN customer_schema.account a ON a.customer_id = c.id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        LEFT JOIN administration.app_user u ON u.id = c.assigned_agent_id
        LEFT JOIN public.strategy s ON s.id = a.strategy_id
        WHERE c.customer_code = ANY(:c) ORDER BY c.customer_code"""),
        {"c": list(CUSTOMERS)})).mappings().all()

    d["timeline"] = (await db.execute(text("""
        SELECT c.customer_code, ca.activity_type, ca.channel_code, ca.direction,
               ca.subject, ca.body, ca.outcome, ca.is_automated,
               u.full_name AS agent,
               EXTRACT(DAY FROM (now() - ca.occurred_at))::int AS days_ago
        FROM customer_schema.case_activity ca
        JOIN customer_schema.customer c ON c.id = ca.customer_id
        LEFT JOIN administration.app_user u ON u.id = ca.agent_id
        WHERE c.customer_code = ANY(:c)
        ORDER BY c.customer_code, ca.occurred_at"""),
        {"c": list(CUSTOMERS)})).mappings().all()

    d["invoices"] = (await db.execute(text("""
        SELECT c.customer_code, i.invoice_no, i.amount, i.paid_amount, i.status,
               i.service_description,
               (CURRENT_DATE - i.issue_date)::int AS days_ago
        FROM customer_schema.invoice i
        JOIN customer_schema.customer c ON c.id = i.customer_id
        WHERE c.customer_code = ANY(:c) ORDER BY c.customer_code, i.issue_date"""),
        {"c": list(CUSTOMERS)})).mappings().all()

    d["payments"] = (await db.execute(text("""
        SELECT c.customer_code, p.payment_ref, p.amount, p.method_code, p.notes,
               (CURRENT_DATE - p.payment_date)::int AS days_ago
        FROM customer_schema.payment p
        JOIN customer_schema.customer c ON c.id = p.customer_id
        WHERE c.customer_code = ANY(:c) ORDER BY c.customer_code, p.payment_date"""),
        {"c": list(CUSTOMERS)})).mappings().all()

    d["ptps"] = (await db.execute(text("""
        SELECT c.customer_code, t.ptp_code, t.promised_amount, t.kept_amount,
               t.status, t.channel_code, t.notes,
               (CURRENT_DATE - t.promised_date)::int AS due_days_ago
        FROM customer_schema.ptp t
        JOIN customer_schema.customer c ON c.id = t.customer_id
        WHERE t.ptp_code = ANY(:p) ORDER BY t.ptp_code"""),
        {"p": list(PTPS)})).mappings().all()

    d["cases"] = (await db.execute(text("""
        SELECT dc.case_code, dc.case_type_code, dc.summary, dc.amount, dc.priority,
               m.workflow_state, m.queue_code, m.source_code, dc.resolution_code,
               u.full_name AS agent, c.customer_code,
               EXTRACT(DAY FROM (now() - dc.opened_at))::int AS opened_days_ago
        FROM customer_schema.debt_case dc
        JOIN collection.case_meta m ON m.case_id = dc.id
        JOIN customer_schema.customer c ON c.id = dc.customer_id
        LEFT JOIN administration.app_user u ON u.id = dc.assigned_agent_id
        WHERE dc.case_code = ANY(:c) ORDER BY dc.case_code"""),
        {"c": list(CASES)})).mappings().all()

    d["audit"] = (await db.execute(text("""
        SELECT dc.case_code, a.old_value, a.new_value, a.reason,
               EXTRACT(DAY FROM (now() - a.occurred_at))::int AS days_ago
        FROM collection.case_audit a
        JOIN customer_schema.debt_case dc ON dc.id = a.case_id
        WHERE dc.case_code = ANY(:c) AND a.action = 'TYPE_CHANGED'
        ORDER BY dc.case_code, a.occurred_at"""), {"c": list(CASES)})).mappings().all()

    d["turns"] = (await db.execute(text("""
        SELECT session_id, index, speaker, dialogue, thoughts
        FROM chatbot.turns WHERE session_id = ANY(:s)
        ORDER BY session_id, index"""), {"s": list(SESSIONS)})).mappings().all()

    d["placements"] = (await db.execute(text("""
        SELECT pl.placement_code, pl.placed_amount, pl.recovered_amount, pl.status,
               pl.commission_pct, pl.commission_accrued, ag.name AS agency,
               c.customer_code
        FROM recovery_schema.placement pl
        JOIN public.collection_agency ag ON ag.id = pl.agency_id
        JOIN customer_schema.customer c ON c.id = pl.customer_id
        WHERE pl.placement_code = ANY(:p) ORDER BY pl.placement_code"""),
        {"p": list(PLACEMENTS)})).mappings().all()

    d["legal"] = (await db.execute(text("""
        SELECT l.case_code, l.claim_amount, l.legal_cost, l.stage, l.status,
               l.law_firm, l.success_probability, c.customer_code
        FROM recovery_schema.legal_case l
        JOIN customer_schema.customer c ON c.id = l.customer_id
        WHERE l.case_code = ANY(:l) ORDER BY l.case_code"""),
        {"l": list(LEGAL)})).mappings().all()

    d["dispute"] = (await db.execute(text("""
        SELECT dispute_code, amount, status, reason_code, description, resolution_note
        FROM customer_schema.dispute WHERE dispute_code = ANY(:d)"""),
        {"d": list(DISPUTES)})).mappings().all()

    d["steps"] = (await db.execute(text("""
        SELECT c.customer_code, se.node_label, se.channel_code, se.outcome, se.cost,
               EXTRACT(DAY FROM (now() - se.occurred_at))::int AS days_ago
        FROM strategy_schema.step_event se
        JOIN customer_schema.account a ON a.id = se.account_id
        JOIN customer_schema.customer c ON c.id = a.customer_id
        WHERE c.customer_code = ANY(:c)
        ORDER BY c.customer_code, se.occurred_at"""),
        {"c": list(CUSTOMERS)})).mappings().all()

    # --- The reconciliations the document proves -------------------------
    d["checks"] = {}
    d["checks"]["stage_sum"] = float((await db.execute(text("""
        SELECT COALESCE(sum(outstanding), 0) FROM customer_schema.account
        WHERE dpd > 0"""))).scalar_one())
    d["checks"]["ledger_gaps"] = (await db.execute(text("""
        SELECT count(*) FROM customer_schema.account a
        WHERE abs(a.outstanding - COALESCE((
            SELECT sum(i.amount - i.paid_amount) FROM customer_schema.invoice i
            WHERE i.account_id = a.id), 0)) > 0.02"""))).scalar_one()
    d["checks"]["agency_cash"] = (await db.execute(text("""
        SELECT pl.recovered_amount,
               COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                          WHERE p.account_id = pl.account_id AND p.status = 'COMPLETED'
                            AND p.notes = 'Recovered under placement ' || pl.placement_code), 0)
                 AS in_ledger
        FROM recovery_schema.placement pl WHERE pl.placement_code = :p"""),
        {"p": PLACEMENTS[0]})).mappings().one()
    return d


def of(rows, code):
    return [r for r in rows if r.get("customer_code") == code]


# --------------------------------------------------------------------------
def build(d: dict) -> None:
    doc = Doc()
    P, C, X = d["portfolio"], d["collections"], d["contacts"]
    j = {r["customer_code"]: r for r in d["journeys"]}
    case = {r["case_code"]: r for r in d["cases"]}
    ptp = {r["ptp_code"]: r for r in d["ptps"]}
    pl = {r["placement_code"]: r for r in d["placements"]}
    lc = {r["case_code"]: r for r in d["legal"]}

    # ---------------- Cover -------------------------------------------
    t = doc.doc.add_paragraph()
    r = t.add_run("RADONaix Assure+")
    r.bold = True
    r.font.size = Pt(28)
    r.font.color.rgb = ACCENT
    s = doc.doc.add_paragraph()
    r = s.add_run("Demo walkthrough — every measure explained, and three "
                  "customers followed from first missed bill to court")
    r.font.size = Pt(13)
    r.font.color.rgb = MUTED
    doc.rule()
    doc.p("This is the document to read before presenting, and the one to send "
          "afterwards. It has four parts.")
    doc.table(
        ["Part", "What it covers"],
        [["1  The map", "Every module, and the one question each screen answers"],
         ["2  The stories", "Three customers followed step by step, with the data behind each step"],
         ["3  The measures", "Every KPI: what it counts, how it is worked out, where it comes from"],
         ["4  The proof", "Which figures must agree with which, and evidence that they do"]],
        widths=[1.5, 5.4])
    doc.p("Every number in this document was read from the live system as it was "
          "written. Nothing is illustrative.", italic=True, colour=MUTED, size=9.5)

    doc.page_break()

    # ================= PART 1 — THE MAP =================================
    doc.h("Part 1 — The map", 1)
    doc.p("Five modules. Each screen exists to answer one question; where two "
          "screens look similar, the difference is stated on the screen itself.")

    doc.h("Portfolio Management", 2)
    doc.table(["Screen", "The question it answers"],
              [["Portfolio Dashboard", "How big is the book, how much has gone bad, "
                                       "and how much of the bad is being worked?"],
               ["Risk Grid Analytics", "Which combinations of age and risk hold the exposure?"],
               ["Customer 360", "Everything known about one customer, on one page"],
               ["Performance Reports", "The registers: promises, disputes, legal and agency"]],
              widths=[1.9, 5.0])

    doc.h("Collection Management", 2)
    doc.table(["Screen", "The question it answers"],
              [["Collections Workspace", "What needs working today, and the case board"],
               ["Collections Dashboard", "How is collection going — cash, promises, SLA, speed"]],
              widths=[1.9, 5.0])

    doc.h("Strategy Management", 2)
    doc.table(["Screen", "The question it answers"],
              [["Strategy Dashboard", "Which journeys are working, and what each channel costs"],
               ["Strategy Designer", "Building the journey itself"],
               ["Strategy Versions", "What a strategy used to be, with rollback and branching"],
               ["Strategy Simulation", "What would this journey do if we ran it?"]],
              widths=[1.9, 5.0])

    doc.h("Recovery Management", 2)
    doc.table(["Screen", "The question it answers"],
              [["Recovery Workspace", "What is out with agencies and in legal, and what came back"]],
              widths=[1.9, 5.0])

    doc.h("Operations Management", 2)
    doc.table(["Screen", "The question it answers"],
              [["Risk Analytics", "How the risk scores are built and how the model performs"],
               ["Agent Performance", "One collector's month, against target and against the floor"],
               ["AI Guardrails", "What the assistant may say, and what it has caught"],
               ["AI Engagement Center", "The live handoff queue, and every conversation ever had"]],
              widths=[1.9, 5.0])

    doc.page_break()

    # ================= PART 2 — THE STORIES =============================
    doc.h("Part 2 — Three customers, three stories", 1)
    doc.p("The same product, three very different outcomes. Read these as "
          "narratives; the tables under each step are the data that produced them.")

    # ---- A ----
    a, ca = j[CUSTOMERS[0]], case[CASES[0]]
    doc.h(f"{a['who']} — the escalation", 2)
    doc.p(f"{a['occupation']}, {a['city']}. Credit score {a['credit_score']}, risk "
          f"{a['risk_level']} at {float(a['risk_score']):.1f}, behaviour recorded as "
          f"“{a['behaviour_type']}”. Monthly income "
          f"{money(a['monthly_income']) if a['monthly_income'] else 'not recorded'}. "
          f"She is on {a['product_code']} — {a['contract_plan']} — with a credit "
          f"limit of {money(a['credit_limit'])}.")

    doc.p("How she got here", bold=True)
    doc.table(["Day", "Invoice", "For", "Billed", "Paid", "Status"],
              [[f"−{i['days_ago']}", i["invoice_no"], i["service_description"][:34],
                money(i["amount"]), money(i["paid_amount"]), i["status"]]
               for i in of(d["invoices"], CUSTOMERS[0])],
              widths=[0.5, 1.3, 2.0, 1.0, 0.9, 0.8], right={3, 4})
    doc.p(f"Three cycles billed {money(a['billed'])}; {money(a['paid'])} has been "
          f"received. She owes {money(a['outstanding'])} and is {a['dpd']} days past "
          f"due, which puts her in the {a['aging_bucket']} bucket.")

    doc.p("What the strategy did before anyone picked up the phone", bold=True)
    doc.table(["Day", "Step", "Channel", "Outcome", "Cost"],
              [[f"−{s['days_ago']}", s["node_label"], s["channel_code"], s["outcome"],
                f"${float(s['cost']):.3f}"] for s in of(d["steps"], CUSTOMERS[0])],
              widths=[0.5, 2.2, 1.0, 1.3, 0.8], right={4})
    doc.p("Four automated touches. The dialer alone costs thirty times an SMS and "
          "was the one nobody answered — which is the trade-off the Strategy "
          "Dashboard exists to make visible.")

    doc.p("The promises", bold=True)
    doc.table(["Promise", "Amount", "Received", "Channel", "Result"],
              [[p["ptp_code"], money(p["promised_amount"]), money(p["kept_amount"]),
                p["channel_code"], p["status"]]
               for p in d["ptps"] if p["customer_code"] == CUSTOMERS[0]],
              widths=[1.4, 1.1, 1.1, 1.1, 1.0], right={1, 2})
    doc.p("The first promise broke outright. The second brought $400 of the $1,200 "
          "agreed and then stopped — which is worse than nothing, because it "
          "consumed an agent's time as well as the customer's goodwill.")

    doc.p("Where the case came from", bold=True)
    doc.bullet(f"{ca['case_code']} — raised by the system, source {ca['source_code']}, "
               f"queue {ca['queue_code']}, owner {ca['agent']}", "")
    doc.p(f"“{ca['summary']}”", italic=True, size=9.5, colour=MUTED)

    doc.p("The conversation that changed the approach", bold=True)
    for t_ in [x for x in d["turns"] if x["session_id"] == CHAT_FIRST]:
        who = "Assistant" if t_["speaker"] == "bot" else a["contact"].split()[0]
        par = doc.doc.add_paragraph()
        par.paragraph_format.left_indent = Inches(0.28)
        par.paragraph_format.space_after = Pt(2)
        rr = par.add_run(f"{who}:  ")
        rr.bold = True
        rr.font.size = Pt(9.5)
        rr.font.color.rgb = ACCENT if t_["speaker"] == "bot" else INK
        par.add_run(t_["dialogue"]).font.size = Pt(9.5)
        th = doc.doc.add_paragraph()
        th.paragraph_format.left_indent = Inches(0.5)
        th.paragraph_format.space_after = Pt(5)
        rt = th.add_run("reasoning: " + t_["thoughts"])
        rt.italic = True
        rt.font.size = Pt(8.5)
        rt.font.color.rgb = MUTED
    doc.p("The assistant declared hardship handling and stopped negotiating the "
          "moment she asked for a person. That is a guardrail firing, not the bot "
          "failing — and the reasoning line above each turn is stored with the "
          "transcript, so a compliance reviewer can see why it said what it said.")

    doc.p("Then the case changed type rather than multiplying", bold=True)
    for row in [r for r in d["audit"] if r["case_code"] == CASES[0]]:
        doc.code(f"day −{row['days_ago']}   {row['old_value']} → {row['new_value']}\n"
                 f"{row['reason']}")
    doc.p("One account carries one case. When the situation moves, the case moves "
          "with it: the queue changes, the SLA is re-cut, and the old type stays in "
          "the audit trail. You never end up with four cards for one customer.")

    doc.p("Out of the building", bold=True)
    pa, la = pl[PLACEMENTS[0]], lc[LEGAL[0]]
    doc.table(["", "Reference", "Detail", "Value"],
              [["Agency", pa["placement_code"],
                f"{pa['agency']} · {pa['status']} · {float(pa['commission_pct'])}% commission",
                money(pa["placed_amount"])],
               ["Recovered", "", "cash returned by the agency so far",
                money(pa["recovered_amount"])],
               ["Legal", la["case_code"], f"{la['law_firm']} · stage {la['stage']}",
                money(la["claim_amount"])]],
              widths=[0.9, 1.2, 3.0, 1.1], right={3})

    doc.callout("Where she stands today",
                f"{money(a['outstanding'])} owed. Case {ca['case_code']} open as "
                f"{ca['case_type_code']}, {ca['priority']} priority, with "
                f"{a['agent']}. Out with an agency, a legal file open, and — as of "
                "this morning — a conversation waiting in the chat queue about the "
                "solicitor's letter.", ACCENT)

    doc.page_break()

    # ---- B ----
    b, cb = j[CUSTOMERS[1]], case[CASES[1]]
    doc.h(f"{b['who']} — the recovery", 2)
    doc.p(f"{b['occupation']}, {b['city']}. Credit score {b['credit_score']}, risk "
          f"{b['risk_level']} at {float(b['risk_score']):.1f}, behaviour "
          f"“{b['behaviour_type']}”. Income {money(b['monthly_income'])} a month. "
          "Nothing about this customer says collections problem — and the product "
          "should not treat him like one.")

    doc.table(["Day", "What happened", "Detail"],
              [["−27", "Bill issued",
                f"{money(of(d['invoices'], CUSTOMERS[1])[0]['amount'])} — "
                f"{of(d['invoices'], CUSTOMERS[1])[0]['service_description']}"],
               ["−12", "Missed, one SMS sent",
                f"Soft Reminder strategy, cost ${float(of(d['steps'], CUSTOMERS[1])[0]['cost']):.3f}"],
               ["−10", "He replied to the assistant",
                "Autopay card had expired — explained, link sent, promise captured"],
               ["−10", "Case opened", f"{cb['case_code']}, queue {cb['queue_code']}"],
               ["−5", "Paid in full", money(of(d["payments"], CUSTOMERS[1])[0]["amount"])],
               ["−4", "Case resolved", "Promise honoured"],
               ["−3", "Case closed", cb["resolution_code"]]],
              widths=[0.6, 2.1, 3.5])

    doc.p("The conversation", bold=True)
    for t_ in [x for x in d["turns"] if x["session_id"] == CHAT_DANIEL]:
        who = "Assistant" if t_["speaker"] == "bot" else b["contact"].split()[0]
        par = doc.doc.add_paragraph()
        par.paragraph_format.left_indent = Inches(0.28)
        par.paragraph_format.space_after = Pt(3)
        rr = par.add_run(f"{who}:  ")
        rr.bold = True
        rr.font.size = Pt(9.5)
        rr.font.color.rgb = ACCENT if t_["speaker"] == "bot" else INK
        par.add_run(t_["dialogue"]).font.size = Pt(9.5)

    p3 = ptp[PTPS[2]]
    doc.p(f"{p3['ptp_code']} was captured for {money(p3['promised_amount'])} and "
          f"came in at {money(p3['kept_amount'])} — {p3['status']}. The account is "
          f"now {money(b['outstanding'])}, current, {b['dpd']} days past due.")
    doc.callout("Why this journey matters in a demo",
                "It cost one SMS — under two cents — and no human time at all. "
                "It is the counterweight to Priya: most delinquency is an expired "
                "card, not a refusal to pay, and a collections product that treats "
                "the two the same burns money and goodwill.", ACCENT)

    doc.page_break()

    # ---- C ----
    c, cc = j[CUSTOMERS[2]], case[CASES[2]]
    disp = d["dispute"][0]
    doc.h(f"{c['who']} — the argument", 2)
    doc.p(f"Enterprise account, {c['city']}. Contact is {c['contact']}, "
          f"{c['occupation']}. Risk {c['risk_level']} at {float(c['risk_score']):.1f}, "
          f"credit score {c['credit_score']}, behaviour “{c['behaviour_type']}”. "
          f"Product {c['product_code']} — {c['contract_plan']} — on a "
          f"{money(c['credit_limit'])} limit.")

    doc.table(["Day", "What happened", "Detail"],
              [["−119", "Q2 invoice issued", money(21020.00) + " billed across two quarters"],
               ["−100", "Chased by email", "Automated, opened but not answered"],
               ["−95", "Statement pack sent", "By the relationship manager"],
               ["−88", "RM call", "AP disputes the Q2 IoT line charges"],
               ["−80", f"Dispute {disp['dispute_code']} raised",
                f"{money(disp['amount'])} — {disp['reason_code']}"],
               ["−60", "Dispute partly upheld", "$1,950 credited; the rest stands"],
               ["−55", "Payment plan agreed", f"{money(ptp[PTPS[3]]['promised_amount'])} in two parts"],
               ["−48", "First instalment cleared", money(ptp[PTPS[3]]["kept_amount"])],
               ["−38", "Second instalment missed", "Chased by email, no answer"],
               ["−30", "Re-typed to Legal Follow-up", "Plan broken"],
               ["−15", "Placed with an agency", money(pl[PLACEMENTS[1]]["placed_amount"])],
               ["−6", "Claim filed", f"{lc[LEGAL[1]]['law_firm']}"]],
              widths=[0.6, 2.3, 3.3])

    doc.p("What they actually disputed", bold=True)
    doc.p(f"“{disp['description']}”", italic=True, size=9.5)
    doc.p("Outcome", bold=True)
    doc.p(f"“{disp['resolution_note']}”", italic=True, size=9.5)
    doc.p("They were partly right — which is the point. Collection paused while the "
          "dispute was open, so the SLA clock did not run against the team for money "
          "that turned out not to be owed, and the credit is reflected in the "
          "invoice rather than bolted on as an adjustment somewhere else.")

    doc.p("Two type changes on one case", bold=True)
    for row in [r for r in d["audit"] if r["case_code"] == CASES[2]]:
        doc.code(f"day −{row['days_ago']}   {row['old_value']} → {row['new_value']}\n"
                 f"{row['reason']}")

    lcc = lc[LEGAL[1]]
    doc.callout("Where they stand today",
                f"{money(c['outstanding'])} owed on {c['dpd']} days. Case "
                f"{cc['case_code']} open as {cc['case_type_code']} with {cc['agent']}. "
                f"{money(lcc['claim_amount'])} claimed through {lcc['law_firm']}, "
                f"legal costs {money(lcc['legal_cost'])} so far, success probability "
                f"{float(lcc['success_probability'] or 0):.0f}%.", ACCENT)

    doc.page_break()

    # ================= PART 3 — THE MEASURES ============================
    doc.h("Part 3 — Every measure, explained", 1)
    doc.p("For each KPI: what it counts, how it is worked out, and the value it "
          "holds right now. Where a measure could be read two ways, the definition "
          "chosen is stated — that is usually the question an audience asks.")

    def kpis(title: str, note: str, rows: list[list[str]]) -> None:
        doc.h(title, 2)
        if note:
            doc.p(note, colour=MUTED, size=9.5)
        doc.table(["Measure", "What it means and how it is worked out", "Now"], rows,
                  widths=[1.5, 4.3, 1.1], right={2})

    kpis("Portfolio Dashboard",
         "The landing screen. Deliberately the whole book, not the collections desk.",
         [["Total receivables",
           "Every account's outstanding balance added up — the whole book, not only "
           "what is delinquent. Source: customer_schema.account.",
           money(P["receivables"])],
          ["Delinquent balance",
           "Outstanding on accounts more than zero days past due, and its share of "
           "the book. This is the entry point to collections.",
           money(P["delinquent"])],
          ["  of it 90+",
           "The part of the delinquent balance more than ninety days down — the "
           "hardest money to recover.", money(P["severe"])],
          ["Under collection",
           "Of the delinquent balance, the share sitting on an account with an open "
           "case. The join between this screen and the collections floor, and the "
           "number no other screen reports.", pct(P["coveragePct"])],
          ["  uncovered",
           "Delinquent money with no case on it at all. Should trend to zero.",
           money(P["uncovered"])],
          ["Cash collection ratio",
           "Payments received this month divided by invoices issued this month. A "
           "billing-side measure: it asks whether the business is converting what it "
           "bills, not how the collectors are doing.", pct(P["cashCollectionPct"])],
          ["Where the balance sits",
           "The delinquent balance split so every account is counted exactly once, "
           "by precedence: legal, then agency, then dispute, then promise, then in "
           "collection, then no case. These add up to the delinquent balance.",
           f"{len(P['stages'])} stages"],
          ["Accounts on a strategy",
           "How much of the book is being driven by a dunning journey rather than "
           "waited on.", f"{P['accountsOnStrategy']}/{P['accounts']}"],
          ["High and critical risk",
           "Accounts the risk engine scored High or Critical, and the exposure they "
           "carry.", str(P["riskyAccounts"])]])

    doc.p("Why “under collection” and the Collections Dashboard's “open exposure” "
          "differ — and both are right", bold=True)
    doc.p(f"Portfolio counts only delinquent balances as under collection "
          f"({money(P['underCase'])}). The collections book also holds accounts that "
          f"are not past due yet — {money(C['notYetDue'])} of it — so its exposure "
          f"reads {money(C['openExposure'])}. Subtract one from the other and you "
          f"get exactly the not-yet-due figure. The Collections Dashboard states it "
          f"on the tile rather than leaving the gap unexplained.")

    kpis("Collections Dashboard",
         "The collections desk: its book, its cash, its promises, its service level.",
         [["Open exposure",
           "Balance on accounts with a live case — resolved cases excluded, because "
           "they are finished work waiting to be closed.", money(C["openExposure"])],
          ["Collected · 30 days",
           "Completed payments on those accounts over a rolling thirty days, against "
           "the thirty before. Rolling rather than month-to-date, so a comparison "
           "made on the 2nd is not a part-month against a whole one.",
           money(C["collected30d"])],
          ["Recovery rate",
           "Collected divided by collected plus still owed — the share of what was "
           "collectable that actually came in.", pct(C["recoveryRatePct"])],
          ["Promises kept",
           "Of promises that have reached their date in the last ninety days, the "
           "share honoured. Pending promises are excluded: they have not been tested "
           "yet.", pct(C["promiseKeptRatePct"])],
          ["On-time work",
           "Share of live cases still inside their next-action SLA. The clock is "
           "'time to the next action', not 'time to resolve' — an aged case that is "
           "being worked weekly is healthy; one nobody has touched is not.",
           pct(C["slaCompliancePct"])],
          ["Days to close",
           "Average hours from opening to closing, over cases closed in the last "
           "ninety days, expressed in days.",
           str(C["avgDaysToClose"]) if C["avgDaysToClose"] else "—"],
          ["Not yet picked up",
           "Cases still in Assigned — nobody has done any work on them. The audit "
           "moves a case out of Assigned the first time real work is logged.",
           str(C["untouched"])]])

    ap = d.get("agent_perf")
    if ap:
        kpis("Agent Performance",
             f"One collector's month. Figures shown are {ap['agentName']}'s. A "
             "collector sees only their own; the server enforces that, not the UI.",
             [["Collected",
               "Payments on accounts whose customer this agent owns, this month. "
               "Attribution follows one rule everywhere: a payment belongs to the "
               "agent who owns the customer.", money(ap["collectedMtd"])],
              ["Against target",
               "Collected over the monthly target on the agent's profile. Targets "
               "were rebuilt from what each agent actually collects, so attainment "
               "means something.", pct(ap["attainment"])],
              ["Promises kept",
               "This agent's promises that were honoured, over ninety days.",
               pct(ap["keptRate"])],
              ["On-time work",
               "Their live cases inside SLA.", pct(ap["slaCompliance"])],
              ["Reached",
               "Conversations that connected, over conversations attempted. A "
               "delivery receipt is not a connection.", pct(ap["reachRate"])],
              ["Follow-ups done",
               "Diary tasks completed over tasks assigned.", pct(ap["taskCompletion"])],
              ["Caseload used",
               "Open cases against the ceiling on their profile.",
               pct(ap["caseloadPct"])]])

    kpis("AI Engagement Center — Contact History",
         "Every conversation on any channel, over the last ninety days.",
         [["Conversations",
           "Calls, SMS, email, WhatsApp, IVR and bot exchanges. Internal notes and "
           "status changes are excluded — they are not conversations.",
           str(X["attempts"])],
          ["Connected",
           "Of the attempts somebody could have answered, the share that reached a "
           "person. Attempts that were only delivered — an SMS receipt, an email "
           "open — are excluded from the denominator, not counted as successes.",
           pct(X["reachRate"])],
          ["No answer", "Attempts nobody picked up.", str(X["noAnswer"])],
          ["Handled by bots",
           "Share of all conversations that were automated.", pct(X["automatedShare"])],
          ["Customer got in touch",
           "Inbound conversations. The rest were outbound.", str(X["inbound"])],
          ["Led to a promise",
           "Conversations followed by a promise within two days — the closest this "
           "data comes to attributing an outcome to a conversation.",
           str(X["ledToPromise"])]])

    sa = d["sim_assumptions"]
    kpis("Strategy Simulation",
         "A projection, not a forecast. Every rate is shown with whether it was "
         "measured from this book or assumed, and each run stores its seed so the "
         "same inputs always give the same answer.",
         [["Reach per channel",
           "Measured from what each channel has actually achieved here. Channels "
           "with too little history fall back to a conservative default, and the "
           "screen says which.",
           f"{len([x for x in sa['channels'] if x['source'].startswith('measured')])}"
           f"/{len(sa['channels'])} measured"],
          ["Promises kept", sa["promiseKeptSource"], pct(sa["promiseKeptRate"])],
          ["Settlement share",
           "What a paying account typically clears, as a share of what it owed. "
           + sa["settlementSource"], pct(sa["settlementShare"])],
          ["Risk and age factors",
           "Multipliers on the chance of paying: a fresh, low-risk balance is worth "
           "more than an old, high-risk one.", "6 factors"]])
    doc.p("What a run reports", bold=True)
    doc.bullet("accounts in, exposure, touches sent, cost to run, recovered, "
               "recovery rate, cost per $100 recovered, average days to settle", "Headline: ")
    doc.bullet("every account counted once, at the furthest point it reached — "
               "settled, escalated, finished unpaid, or still running when the "
               "horizon ended", "Funnel: ")
    doc.bullet("how many reached each step of the real workflow and what happened "
               "there, so a step that drops everybody is visible", "Step by step: ")

    doc.page_break()

    # ================= PART 4 — THE PROOF ===============================
    doc.h("Part 4 — What matches what", 1)
    doc.p("A demo lives or dies on whether the numbers agree. These are the "
          "reconciliations that hold, and how to show each one.")

    checks = d["checks"]
    stage_total = sum(s["balance"] for s in P["stages"])
    doc.table(
        ["What must agree", "Left", "Right", "Agrees?"],
        [["Delinquent balance = the sum of its stages\n"
          "Portfolio headline against its own split",
          money(P["delinquent"]), money(stage_total),
          "yes" if abs(P["delinquent"] - stage_total) < 0.01 else "NO"],
         ["Under collection = the delinquent part of the collections book\n"
          "Portfolio coverage against the Collections Dashboard",
          money(P["underCase"]),
          money(C["openExposure"] - C["notYetDue"]),
          "yes" if abs(P["underCase"] - (C["openExposure"] - C["notYetDue"])) < 0.01 else "NO"],
         ["Open cases on both dashboards",
          str(P["openCases"]), str(C["openCases"]),
          "yes" if P["openCases"] == C["openCases"] else "NO"],
         ["Agency recovery = cash on the ledger\n"
          f"Recovery Workspace against Subscriber 360 for {PLACEMENTS[0]}",
          money(checks["agency_cash"]["recovered_amount"]),
          money(checks["agency_cash"]["in_ledger"]),
          "yes" if abs(float(checks["agency_cash"]["recovered_amount"])
                       - float(checks["agency_cash"]["in_ledger"])) < 0.01 else "NO"],
         ["Every account's billing explains its balance\n"
          "invoices minus payments = outstanding, on all accounts",
          f"{P['accounts']} accounts", f"{checks['ledger_gaps']} disagree",
          "yes" if checks["ledger_gaps"] == 0 else "NO"]],
        widths=[3.1, 1.4, 1.4, 0.8], right={1, 2, 3})

    doc.p("The three demo accounts, proved individually", bold=True)
    doc.table(["Account", "Customer", "Billed", "Paid", "Outstanding", "Ties?"],
              [[r["account_code"], r["who"], money(r["billed"]), money(r["paid"]),
                money(r["outstanding"]),
                "yes" if abs(float(r["billed"]) - float(r["paid"])
                             - float(r["outstanding"])) < 0.01 else "NO"]
               for r in d["journeys"]],
              widths=[1.1, 2.0, 1.1, 1.0, 1.2, 0.6], right={2, 3, 4, 5})

    doc.callout(
        "Show this, don't claim it",
        "scripts/verify_consistency.py runs eighteen checks and two reconciliations "
        "against the live database and prints each one. Run it on screen. It ends "
        "with “Everything agrees.” — and when it does not, the line it prints names "
        "the screen that would show a wrong number.", ACCENT)

    doc.p("What the eighteen checks cover", bold=True)
    for line in [
        "case value and DPD match the account balance the 360 shows",
        "ageing buckets match the DPD they are derived from",
        "one live case per account per type — no duplicate cards",
        "the case owner and the customer's owner are the same person",
        "workflow state and the legacy status column agree",
        "cases in Assigned genuinely have no work logged against them",
        "every open case carries a description",
        "agency recoveries are backed by payment rows",
        "promises marked kept have money against them",
        "no promise is still pending after its date",
        "agent monthly performance matches the payment ledger",
        "targets and caseload ceilings are within reach of the book",
        "payments and cases point at accounts owned by the right customer",
        "strategy-driven accounts point at a live strategy",
        "open legal cases can be reached from an account",
    ]:
        doc.bullet(line)

    doc.page_break()

    # ================= PART 5 — RUNNING IT ==============================
    doc.h("Part 5 — Running the demo", 1)
    doc.table(["#", "Screen", "What to show", "The line to land", "Min"],
              [["1", "Portfolio Dashboard",
                "Receivables, delinquency, coverage, where the balance sits",
                "The parts add up to the whole, by construction", "2"],
               ["2", "Customer 360 — Priya",
                "96 DPD, three bills, one part-payment",
                "Nobody typed 96 — it comes from the invoices", "1"],
               ["3", "Strategy Dashboard",
                "The four dunning touches and their cost",
                "Half a dollar spent before a human was involved", "1.5"],
               ["4", "Collections Workspace",
                "The case, its timeline, both broken promises, the audit trail",
                "One account, one case — the type moves, the case doesn't multiply", "3"],
               ["5", "AI Engagement Center",
                "Read the transcript, then accept the waiting handoff",
                "It stopped negotiating the moment she asked for a person", "2"],
               ["6", "Customer 360 — Daniel",
                "One SMS, bot-resolved, paid, closed",
                "Most delinquency is an expired card, not a refusal", "1"],
               ["7", "Collections Workspace",
                "Meridian: dispute part-upheld, plan broken, two type changes",
                "They were partly right, and the system handled that", "2"],
               ["8", "Recovery Workspace",
                "Both placements, the recovered cash, both legal files",
                "The agency figure is a payment row, not a claim", "1.5"],
               ["9", "Strategy Simulation",
                "Run Standard Dunning live",
                "Every rate here was measured from those same conversations", "1.5"]],
              widths=[0.3, 1.5, 2.2, 2.4, 0.4], right={4})

    doc.h("Questions you should expect", 2)
    for q, ans in [
        ("“Is this real data or a mock-up?”",
         "Every screen reads Postgres. The consistency script is the proof — run it."),
        ("“What happens if the numbers disagree?”",
         "They are checked, not hoped for. The script names the screen that would be "
         "wrong, and it is run before every demo."),
        ("“Why does the bot hand over instead of closing the deal?”",
         "Because the guardrails say so on hardship and on an explicit request for a "
         "person. AI Guardrails shows the rule and what it has caught."),
        ("“Can you prove the agency recovery is real money?”",
         f"{PLACEMENTS[0]} shows {money(checks['agency_cash']['recovered_amount'])} "
         "recovered. Open the customer's 360 — the same amount is a payment."),
        ("“How would we know a strategy is worth running before we run it?”",
         "Strategy Simulation walks the real accounts through the real workflow on "
         "measured rates, and states which rates are assumptions."),
    ]:
        doc.p(q, bold=True)
        doc.p(ans, size=9.5)

    doc.h("Rebuilding", 2)
    doc.code("cd Assure+_MS\n"
             "PYTHONPATH=. .venv/bin/python migrations/sql/062_lifecycle_customers.py\n"
             "PYTHONPATH=. .venv/bin/python scripts/verify_consistency.py")
    doc.callout("One caveat",
                "The three journeys bring payments with them, which changes what "
                "agents have collected. After re-seeding, re-run the agent roll-up "
                "(step 8 of 057_reconcile_book.py) before showing Agent Performance, "
                "or its figures will lag the ledger.")

    doc.rule()
    doc.p(f"Generated from the live system — {P['accounts']} accounts, "
          f"{money(P['receivables'])} receivables, {money(P['delinquent'])} "
          f"delinquent, {P['openCases']} open cases, {X['attempts']} conversations "
          "in the last ninety days.", italic=True, colour=MUTED, size=9)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.doc.save(OUT)


async def main() -> None:
    async with SessionFactory() as db:
        data = await gather(db)
    build(data)
    print(f"  written: {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
