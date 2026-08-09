"""
Generates docs/RADONaix-Assure-Screen-Guide.docx — a functional reference for
EVERY screen: what it does, who uses it, what it shows, and its working
scenarios. Figures are drawn from src/data/portfolio.json so the guide matches
the running application.

Run:  python3 docs/build_screen_guide.py
"""
import json
import os
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, "..", "src", "data", "portfolio.json")))
A = DATA["accounts"]
S = lambda l, g: sum(g(a) for a in l)
def money(v): return f"${v/1e6:.2f}M" if v >= 1e6 else (f"${round(v/1000)}K" if v >= 1e3 else f"${v:,}")

# Live figures used across the guide
OUT = S(A, lambda a: a["outstanding"])
DEL = [a for a in A if a["agingBucket"] != "Current"]
ENT = [a for a in A if a["segment"] != "Consumer"]

INK = RGBColor(0x10, 0x18, 0x28)
MUTED = RGBColor(0x66, 0x70, 0x85)
ACCENT = RGBColor(0x1D, 0x4E, 0xD8)
CRIT = RGBColor(0xDC, 0x26, 0x26)
WARN = RGBColor(0xB4, 0x53, 0x09)
GOOD = RGBColor(0x16, 0xA3, 0x4A)
BAND = "F1F4F9"
RULE = "E4E9F1"
SANS, MONO = "Calibri", "Consolas"

doc = Document()
st = doc.styles["Normal"]; st.font.name = SANS; st.font.size = Pt(10.5); st.font.color.rgb = INK
sec = doc.sections[0]
sec.top_margin = sec.bottom_margin = Inches(0.8)
sec.left_margin = sec.right_margin = Inches(0.9)


def rule_below(p, color=RULE, size=8):
    pPr = p._p.get_or_add_pPr(); pbdr = OxmlElement("w:pBdr")
    b = OxmlElement("w:bottom")
    b.set(qn("w:val"), "single"); b.set(qn("w:sz"), str(size)); b.set(qn("w:space"), "6"); b.set(qn("w:color"), color)
    pbdr.append(b); pPr.append(pbdr)


def shade(cell, hexc):
    tcpr = cell._tc.get_or_add_tcPr(); shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), hexc); tcpr.append(shd)


def run(p, text, *, size=10.5, bold=False, italic=False, color=INK, font=SANS):
    r = p.add_run(text); r.font.name = font; r.font.size = Pt(size)
    r.font.bold = bold; r.font.italic = italic; r.font.color.rgb = color
    return r


def para(sb=0, sa=6):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(sb); p.paragraph_format.space_after = Pt(sa)
    return p


def eyebrow(t):
    p = para(14, 2); run(p, t.upper(), size=8.5, bold=True, color=ACCENT, font=MONO)


def h1(t):
    p = para(2, 8); run(p, t, size=22, bold=True)


def h2(t):
    p = para(18, 4); run(p, t, size=15, bold=True); rule_below(p)


def screen(module, name):
    p = para(14, 1); run(p, module.upper(), size=8, bold=True, color=MUTED, font=MONO)
    p2 = para(0, 3); run(p2, name, size=13, bold=True, color=ACCENT)


def field(label, runs):
    p = para(0, 4)
    run(p, label + "   ", size=9.5, bold=True, color=INK)
    for text, kw in runs:
        run(p, text, **kw)


def bullet(runs, sub=False):
    p = doc.add_paragraph(style="List Bullet 2" if sub else "List Bullet")
    p.paragraph_format.space_after = Pt(2)
    for text, kw in runs:
        run(p, text, **kw)


def scen(trigger, result):
    """Working scenario: a trigger and what happens."""
    p = doc.add_paragraph(style="List Bullet"); p.paragraph_format.space_after = Pt(2)
    run(p, trigger, size=10, bold=True)
    run(p, "  →  ", size=10, font=MONO, color=ACCENT)
    for text, kw in result:
        run(p, text, **{**dict(size=10), **kw})


B = dict(bold=True); MU = dict(color=MUTED); FIG = dict(font=MONO, bold=True, color=ACCENT)
GR = RGBColor(0x47, 0x50, 0x67)

# ══ MASTHEAD ══
eyebrow("Functional Reference · Work Document")
h1("RADONaix Assure+ — Screen Guide")
p = para(0, 8)
run(p, "Every screen in the platform, explained: what it does, who uses it, what it shows, and how it "
       "behaves. Use it to talk through any screen with confidence. Figures come from the live dataset "
       "(480 accounts, " + money(OUT) + " book), so what you read here is what the app shows.",
    size=11, color=GR)
p = para(0, 2)
run(p, "How the app is organized   ", size=9.5, bold=True)
run(p, "Four module groups in the sidebar — Portfolio Pulseboard (the book), Customer Pulseboard "
       "(individual risk), Dunning Strategy Studio (the playbook), Operations Hub (the front line). "
       "A global Customer Scope selector in the header narrows every screen at once.", size=9.5, color=GR)

# ══ FOUNDATIONS ══
h2("Foundations — the shell every screen lives in")

screen("Sign-in", "Login & Access Rights")
field("Purpose", [("Authenticate the user and load their permission set. Each role sees only the modules "
                   "it is entitled to.", {})])
field("Who uses it", [("Every user. Admins, collections agents, analysts, credit controllers, customer care.", {})])
field("Working scenarios", [])
scen("Sign in as admin@gmail.com", [("full access — every module in the sidebar.", {})])
scen("Sign in as a limited role", [("the sidebar and settings menu hide modules the role can't reach; the "
                                    "nav is built from the permission map, not hard-coded.", {})])

screen("App Shell", "Sidebar, Header & Customer Scope")
field("Purpose", [("The persistent frame: collapsible sidebar (modules grouped and expandable), a sticky "
                   "header with the Customer Scope selector, theme toggle, settings and profile.", {})])
field("Who uses it", [("Everyone, on every screen.", {})])
field("The Customer Scope selector", [("The single most important control — ", {}),
      ("it filters the entire application at once", dict(bold=True, color=ACCENT)), (".", {})])
scen("Scope = All Customers", [("every screen shows the full book — ", {}), ("480 accounts, " + money(OUT), FIG), (".", {})])
scen("Scope = Normal Customers", [("consumer accounts only (", {}), ("300 accounts", FIG), ("); enterprise "
      "cards and rows vanish across all screens.", {})])
scen("Scope = Enterprise Customers", [("business accounts only — ", {}),
      (f"{len(ENT)} accounts, {money(S(ENT, lambda a: a['outstanding']))}", FIG),
      ("; consumers disappear, Case Management included.", {})])
field("Theme", [("Light and dark are both first-class; the toggle stamps the whole app.", {})])

# ══ PORTFOLIO PULSEBOARD ══
h2("Portfolio Pulseboard — the whole book at a glance")

sev = [a for a in A if a["agingBucket"] == "90+"]
screen("Portfolio Pulseboard", "Portfolio Dashboard")
field("Purpose", [("Answer one question fast: how big is the book, and how much of it is in trouble? "
                   "Laid out as an argument — Exposure → Health → Diagnosis → Action.", {})])
field("Who uses it", [("Collections managers and operations leads starting their day.", {})])
field("What you see", [])
bullet([("Four hero tiles — Total Outstanding ", {}), (money(OUT), FIG),
        (", 90+ Exposure ", {}), (money(S(sev, lambda a: a['outstanding'])), FIG),
        (", Collected MTD, Collection Effectiveness (CEI).", {})])
bullet([("Operating Health — six ratios (recovery, cure, roll-forward, PTP-kept, right-party-contact, cost-to-collect).", {})])
bullet([("Aging Distribution chart + Collections-vs-Pace line.", {})])
bullet([("Needs Attention — three ranked priority cohorts, each a click into the relevant screen.", {})])
field("Working scenarios", [])
scen("Read the 90+ tile", [("21.4% of the book sits in 7.1% of accounts — risk is concentrating, and the "
                            "tile is styled red to say so.", {})])
scen("Click a priority cohort", [("deep-links into Risk Analysis carrying the filter.", {})])
scen("Apply the FilterBar (segment / region / product / aging)", [("every tile, chart and cohort re-derives; "
      "the count shows \"N of M accounts\".", {})])

screen("Portfolio Pulseboard", "Performance Reports")
field("Purpose", [("Six analytical lenses on the same book — each tab a different cut, all reconciling with "
                   "the dashboard.", {})])
field("Who uses it", [("Analysts and managers preparing reviews; CSV export for offline work.", {})])
field("The six tabs", [])
bullet([("Portfolio Aging", B), (" — exposure by bucket, weighted-avg DPD, largest exposures table.", {})])
bullet([("PTP Lifecycle", B), (" — promise reliability decaying by aging bucket.", {})])
bullet([("Collections", B), (" — recovery by product and by segment.", {})])
bullet([("Strategy", B), (" — the five dunning stages, recovery falling as they escalate.", {})])
bullet([("Channels", B), (" — response rate vs cost-per-contact vs return, per channel.", {})])
bullet([("Case & SLA", B), (" — case load by status, agent SLA compliance.", {})])
field("Working scenarios", [])
scen("Change the FilterBar", [("all six tabs re-scope together.", {})])
scen("Click Export", [("downloads the filtered rows for the active tab as CSV — what you see is what you get.", {})])

# ══ CUSTOMER PULSEBOARD ══
h2("Customer Pulseboard — from the crowd to the individual")

bands = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
for a in A:
    s = a["riskScore"]
    bands["Critical" if s >= 85 else "High" if s >= 70 else "Medium" if s >= 45 else "Low"] += 1

screen("Customer Pulseboard", "Risk Analysis")
field("Purpose", [("Automated risk scoring on one 0–100 scale, with the drivers behind each score.", {})])
field("Who uses it", [("Analysts and credit controllers triaging who to work first.", {})])
field("What you see", [])
bullet([("Four risk bands — Low ", {}), (str(bands["Low"]), FIG), (", Medium ", {}), (str(bands["Medium"]), FIG),
        (", High ", {}), (str(bands["High"]), FIG), (", Critical ", {}), (str(bands["Critical"]), FIG),
        (" — each a real count.", {})])
bullet([("A searchable, scored customer list; select one to see its ranked risk drivers.", {})])
field("Working scenarios", [])
scen("Search a customer", [("their 0–100 score, band, and the factors that built it (DPD, contactability, "
                            "broken PTPs, disputes, contact recency).", {})])
scen("Compare two customers", [("the score is consistent — the same 95 means the same thing everywhere in the app.", {})])

screen("Customer Pulseboard", "Risk Grid Analytics")
field("Purpose", [("Diagnostic + prescriptive segmentation: where the risk sits and what to do about it.", {})])
field("Who uses it", [("Operations leads planning campaigns.", {})])
field("What you see", [])
bullet([("Risk Grid heatmap — aging × risk band, cell intensity = exposure.", {})])
bullet([("Behavioural Segmentation — accounts grouped by behaviour (Disputed/Blocked, Unreachable, Promise "
         "Breakers, High-Value at Risk, Drifters, Recoverable, Healthy), each with a recommended play.", {})])
bullet([("Priority Targets — ranked by exposure × risk × reachability.", {})])
field("Working scenarios", [])
scen("Click a heatmap cell", [("AI recommendation panel for that aging×risk cluster.", {})])
scen("Pick a customer from the search", [("the grid highlights their cell; View 360 jumps to their profile.", {})])
scen("Change scope or filters", [("the grid, segments and targets all re-derive.", {})])

screen("Customer Pulseboard", "Customer 360  &  Borrower 360")
field("Purpose", [("The complete account file for one customer — risk view (360) plus the account-level "
                   "borrower record (Borrower 360, embedded).", {})])
field("Who uses it", [("A collector about to make contact; a manager reviewing an escalation.", {})])
field("What you see", [])
bullet([("Header: risk badge, aging badge, outstanding, assigned agent.", {})])
bullet([("Risk trend (6 months), payment history, risk drivers, next action.", {})])
bullet([("Borrower 360 tabs — Invoices, Payments, Milestones, Communications, Disputes.", {})])
field("Working scenarios", [])
scen("Open from Risk Grid \"View 360\"", [("lands on that exact customer — the customerId carries through.", {})])
scen("Switch customer in the picker", [("every panel updates; the list spans all segments (not just enterprise).", {})])
scen("Reassign the agent", [("updates locally without mutating the shared dataset.", {})])

# ══ DUNNING ══
h2("Dunning Strategy Studio — design the playbook once")

screen("Dunning Strategy Studio", "Strategy Execution Summary")
field("Purpose", [("How the live strategies are performing across the delinquent book.", {})])
field("Who uses it", [("Operations leads monitoring the running playbook.", {})])
field("What you see", [])
bullet([("Six KPIs — accounts in strategy ", {}), (str(len(DEL)), FIG),
        (", PTP success, avg resolution, total recovered, active strategies, contact response rate.", {})])
bullet([("Channel Performance — response, delivery and recovery per channel (SMS through Dialer).", {})])
field("Working scenario", [])
scen("Read the channel cards", [("digital is cheap but ignored (SMS ~13%, Email ~8%); voice converts (~24%) "
                                 "but costs more — the core collections trade-off, straight from the data.", {})])

screen("Dunning Strategy Studio", "Strategy Designer")
field("Purpose", [("A general workflow tool — browse published journeys, then design them on a visual canvas.", {})])
field("Who uses it", [("Strategy designers and operations leads authoring dunning journeys.", {})])
field("What you see", [])
bullet([("Strategy Library lands first — six journeys with segment, aging, uplift, version. Search + filters "
         "+ Clear.", {})])
bullet([("Click one → the visual designer: a component library (Channels, Actions, Conditions, AI, RPA) and a "
         "drag-and-drop canvas.", {})])
bullet([("Toolbar: Clear, Export, Import, Auto-Layout, Simulate, A/B Testing, What-If; Save Draft, Submit for "
         "Approval, Publish, Version History.", {})])
field("Working scenarios", [])
scen("Click a strategy row", [("opens that journey's workflow on the canvas with a context bar and a Back button.", {})])
scen("Drag a node, connect it", [("the edge curves cleanly from box to box; Simulate animates the active path.", {})])
scen("Save Draft, reopen", [("your edits reload (persisted per strategy), not the template.", {})])
field("Escalation stages", [("Soft Reminder → Standard Dunning → AI Adaptive → Intensive Recovery → ", {}),
      ("Pre-Legal", dict(bold=True, color=CRIT)), (".", {})])

# ══ OPERATIONS HUB ══
h2("Operations Hub — the front line")

screen("Operations Hub", "Case Management")
field("Purpose", [("The full case operations dashboard — customers, agents and cases, three ways to look at "
                   "the same book.", {})])
field("Who uses it", [("Collections agents and team leads working the queue.", {})])
field("Three view modes", [])
bullet([("Customer view", B), (" — expandable table (exposure, aging, DPD, risk, credit, agent); expand a row "
        "for its PTP / Cases / Disputes / Legal.", {})])
bullet([("Agent view", B), (" — one collapsible card per agent with badge counts; expand for four typed columns "
        "of that agent's items.", {})])
bullet([("Cases view", B), (" — card grid (Consumer + Enterprise sections) with a grid⇄table toggle.", {})])
field("Working scenarios", [])
scen("View by → Agent → Robert Kim", [("his 40-case book; expand to see Aisha Darwish's dispute and broken PTP.", {})])
scen("Group Enterprise by Company", [("individual enterprise cards collapse into per-BAN group cards.", {})])
scen("Filters / Search", [("the panel count reflects active filters; search spans name, company, country, ID.", {})])
scen("Eye icon on a card", [("opens a drawer (Overview / Notes / To-Do); PTP/Dispute/Legal open dedicated modals.", {})])
scen("Change global Customer Scope", [("the whole dashboard re-scopes — all three views at once.", {})])

screen("Operations Hub", "Agent Performance")
field("Purpose", [("Team-level performance — trends and a recovery comparison across the six agents.", {})])
field("Who uses it", [("Team leads and managers reviewing the collections team.", {})])
field("What you see", [])
bullet([("Four KPI tiles (agents, cases managed, recovery, avg success rate).", {})])
bullet([("Performance Trends line chart (with a legend — three series, distinct colours) and a per-agent "
         "recovery bar chart.", {})])
field("Working scenario", [])
scen("Filter by timeframe / sort", [("the table and charts re-order; the six agents are the real roster.", {})])

screen("Operations Hub", "AI Engagement Center")
field("Purpose", [("The live automated-engagement queue and a single customer's interaction workspace.", {})])
field("Who uses it", [("Agents handling AI-assisted outreach.", {})])
field("What you see", [])
bullet([("Subscriber Interactions — the queue, ranked by risk, each with channel and status.", {})])
bullet([("Today's Performance — pending, calls/chats resolved, tickets, response time, first-contact resolution.", {})])
bullet([("Analytics tab — Call Outcomes, Risk Analysis, Escalations (line chart), Distribution (pie).", {})])
field("Working scenarios", [])
scen("Click a subscriber", [("their detail: AI automation metrics, PTP details, and a scrollable chat/call "
                             "history that quotes the customer's real balance and DPD.", {})])
scen("Open Analytics → Distribution", [("call-outcome pie with five distinct, legible slices.", {})])

screen("Operations Hub", "Agent Dashboard")
field("Purpose", [("One agent's daily target-vs-recovery cockpit.", {})])
field("Who uses it", [("An individual collector tracking their day.", {})])
field("What you see", [])
bullet([("KPI tiles (monthly target, recovery, pending, cases closed), a completion ring, a recovery timeline.", {})])
bullet([("Case Management table — the agent's real assigned cases (exposure, recovered, status, next action).", {})])
bullet([("Recovery Notes and a daily Action-Plan checklist.", {})])
field("Working scenario", [])
scen("Search the case table", [("filters the agent's live cases; money and last-contact are formatted "
                                "consistently.", {})])

screen("Operations Hub", "Self Service BI")
field("Purpose", [("An embedded analytics surface (Superset) for ad-hoc exploration beyond the built-in screens.", {})])
field("Who uses it", [("Analysts building their own views.", {})])

# ══ RECONCILIATION NOTE ══
h2("The through-line — one dataset, every screen")
p = para(0, 6)
run(p, "Nothing above is a standalone mockup. There is ", size=10.5, color=GR)
run(p, "one account list", size=10.5, bold=True, color=ACCENT)
run(p, " (480 records). Every screen ", size=10.5, color=GR)
run(p, "derives", size=10.5, italic=True, color=GR)
run(p, " its numbers from it — the dashboard sums it, Risk Analysis scores it, Case Management groups it by "
       "agent, Reports cuts it six ways. A customer's $3,727 is the same field wherever it appears, and the "
       "Customer Scope selector re-scopes all of them together. That is why the figures never disagree.",
    size=10.5, color=GR)

foot = para(16, 2); rule_below(foot)
f2 = para(2, 0)
run(f2, "RADONaix Assure+ · Screen Guide", size=8.5, color=MUTED, font=MONO)
run(f2, "        Generated from src/data/portfolio.json · 480 accounts", size=8.5, color=MUTED, font=MONO)

OUTFILE = os.path.join(HERE, "RADONaix-Assure-Screen-Guide.docx")
doc.save(OUTFILE)
print("wrote", OUTFILE)
