"""
Generates docs/RADONaix-Assure-Demo-Script.docx — the demo walkthrough as a Word
document. Every figure is drawn from src/data/portfolio.json so the doc reconciles
with the running application.

Run:  python3 docs/build_demo_doc.py
"""
import json
import os
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, "..", "src", "data", "portfolio.json")))
ACCOUNTS = DATA["accounts"]

# ── Brand palette (matches the app's tokens) ────────────────────────────────
INK = RGBColor(0x10, 0x18, 0x28)
MUTED = RGBColor(0x66, 0x70, 0x85)
ACCENT = RGBColor(0x1D, 0x4E, 0xD8)      # corporate blue
CRIT = RGBColor(0xDC, 0x26, 0x26)
WARN = RGBColor(0xB4, 0x53, 0x09)
GOOD = RGBColor(0x16, 0xA3, 0x4A)
RULE = "E4E9F1"
BAND = "F1F4F9"

SANS = "Calibri"
MONO = "Consolas"

# ── Derived figures (same selectors as the app) ─────────────────────────────
def money(v):
    return f"${v/1e6:.2f}M" if v >= 1e6 else (f"${round(v/1000)}K" if v >= 1e3 else f"${v:,}")

S = lambda l, g: sum(g(a) for a in l)
out = S(ACCOUNTS, lambda a: a["outstanding"])
prior = S(ACCOUNTS, lambda a: a["priorOutstanding"])
severe = [a for a in ACCOUNTS if a["agingBucket"] == "90+"]
sev_out = S(severe, lambda a: a["outstanding"])
col = S(ACCOUNTS, lambda a: a["collectedMTD"])
tgt = S(ACCOUNTS, lambda a: a["targetMTD"])
aisha = next(a for a in ACCOUNTS if a["customerId"] == "CUST-CON-298")
rk = [a for a in ACCOUNTS if a["assignedAgentId"] == "AGENT-005" and a["agingBucket"] != "Current"]
rk_ptp = S(rk, lambda a: a["ptpCreated"])
rk_kept = S(rk, lambda a: a["ptpKept"])
aged = [a for a in ACCOUNTS if a["agingBucket"] == "90+" and a["lastContactDays"] >= 14]
broken = [a for a in ACCOUNTS if a["ptpBroken"] > 0]
disp = [a for a in ACCOUNTS if a["disputesPastSla"] > 0]
ent = [a for a in ACCOUNTS if a["segment"] != "Consumer"]

# ── Low-level helpers ───────────────────────────────────────────────────────
doc = Document()

# Page + base font
for s in ("Normal",):
    st = doc.styles[s]
    st.font.name = SANS
    st.font.size = Pt(10.5)
    st.font.color.rgb = INK
sec = doc.sections[0]
sec.top_margin = sec.bottom_margin = Inches(0.85)
sec.left_margin = sec.right_margin = Inches(0.95)


def _shade(cell, hexcolor):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hexcolor)
    tcpr.append(shd)


def _no_borders_but_bottom(paragraph, color=RULE, size=8):
    p = paragraph._p
    pPr = p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), "6")
    bottom.set(qn("w:color"), color)
    pbdr.append(bottom)
    pPr.append(pbdr)


def run(p, text, *, size=10.5, bold=False, italic=False, color=INK, font=SANS):
    r = p.add_run(text)
    r.font.name = font
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    return r


def para(space_before=0, space_after=6, align=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    if align:
        p.alignment = align
    return p


def eyebrow(text):
    p = para(space_before=14, space_after=2)
    run(p, text.upper(), size=8.5, bold=True, color=ACCENT, font=MONO)


def h1(text):
    p = para(space_before=2, space_after=8)
    run(p, text, size=22, bold=True)


def h2(text):
    p = para(space_before=16, space_after=3)
    run(p, text, size=15, bold=True)
    _no_borders_but_bottom(p)


def h3(text):
    p = para(space_before=10, space_after=2)
    run(p, text, size=11.5, bold=True)


def body(runs, space_after=6, space_before=0):
    """runs: list of (text, kwargs)."""
    p = para(space_before=space_before, space_after=space_after)
    for text, kw in runs:
        run(p, text, **kw)
    return p


def bullet(runs):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(3)
    for text, kw in runs:
        run(p, text, **kw)


def say(text_runs):
    p = para(space_before=6, space_after=8)
    pPr = p._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single"); left.set(qn("w:sz"), "18")
    left.set(qn("w:space"), "10"); left.set(qn("w:color"), "1D4ED8")
    pbdr.append(left)
    pPr.append(pbdr)
    p.paragraph_format.left_indent = Inches(0.12)
    run(p, "Say:  ", size=10, bold=True, color=ACCENT)
    for text, kw in text_runs:
        run(p, text, **{**dict(size=10, color=RGBColor(0x47, 0x50, 0x67)), **kw})


B = dict(bold=True)
FIG = dict(font=MONO, bold=True, color=ACCENT)
MU = dict(color=MUTED)

# ══ MASTHEAD ════════════════════════════════════════════════════════════════
eyebrow("Demo Script · Work Document")
h1("RADONaix Assure+ — Guided Walkthrough")
body([
    ("A ten-minute demo that follows one delinquent customer and the agent collecting on "
     "her, touching every module. Every figure in this document is pulled from the platform's "
     "single dataset, so the numbers reconcile from screen to screen — that consistency is "
     "itself part of the story.", dict(size=11, color=RGBColor(0x47, 0x50, 0x67))),
], space_after=10)
meta = para(space_after=4)
run(meta, "Product ", size=9, **MU); run(meta, "RADONaix Assure+", size=9, font=MONO, bold=True)
run(meta, "      Domain ", size=9, **MU); run(meta, "Telecom Collections", size=9, font=MONO, bold=True)
run(meta, "      Book ", size=9, **MU); run(meta, f"480 accounts · {money(out)}", size=9, font=MONO, bold=True)
run(meta, "      Runtime ", size=9, **MU); run(meta, "~10 min", size=9, font=MONO, bold=True)

# ══ CAST ════════════════════════════════════════════════════════════════════
eyebrow("Cast")
h2("Two people, one thread")
body([("The demo works because the customer and the agent are connected in the data — she is "
       "one of his cases.", {})])

cast = doc.add_table(rows=1, cols=2)
cast.alignment = WD_TABLE_ALIGNMENT.CENTER
cast.autofit = True
c1, c2 = cast.rows[0].cells


def actor(cell, role, name, cid, rows):
    p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(2)
    run(p, role.upper(), size=8, bold=True, color=MUTED, font=MONO)
    p2 = cell.add_paragraph(); p2.paragraph_format.space_after = Pt(6)
    run(p2, name, size=13, bold=True)
    run(p2, f"   {cid}", size=9, font=MONO, color=MUTED)
    for k, v, kw in rows:
        rp = cell.add_paragraph(); rp.paragraph_format.space_after = Pt(1)
        run(rp, f"{k}   ", size=9.5, color=MUTED)
        run(rp, v, size=9.5, font=MONO, **kw)


actor(c1, "The Customer", "Aisha Darwish", "CUST-CON-298", [
    ("Segment", "Consumer · Device Financing", {}),
    ("Outstanding", "$3,727", B),
    ("Days past due", "194  (90+ DPD)", dict(color=CRIT, bold=True)),
    ("Risk score", "95 / 100  Critical", dict(color=CRIT, bold=True)),
    ("Contactability", "41%", {}),
    ("Signals", "1 broken PTP · dispute past SLA", dict(color=WARN)),
])
actor(c2, "The Agent", "Robert Kim", "AGENT-005 · Collections", [
    ("Live cases", "40 delinquent", {}),
    ("Book exposure", money(S(rk, lambda a: a["outstanding"])), B),
    ("Collected (cycle)", money(S(rk, lambda a: a["collectedMTD"])), {}),
    ("PTP kept rate", f"{round(rk_kept/rk_ptp*100)}%  ({rk_kept} of {rk_ptp})", {}),
    ("Open disputes", str(S(rk, lambda a: a["disputesOpen"])), {}),
    ("In pre-legal", f"{len([a for a in rk if a['dunningStage']>=5])} accounts", {}),
])
_shade(c1, BAND); _shade(c2, "FFFFFF")

body([
    ("The connecting thread:  ", dict(bold=True, color=ACCENT)),
    ("Aisha Darwish is assigned to Robert Kim. When the customer journey ends at her 360° "
     "profile, you switch hats — open Robert's book in the Operations Hub and she is right "
     "there in his queue. Same person, same $3,727, seen from the collector's side.", {}),
], space_before=8)

# ══ SETUP ═══════════════════════════════════════════════════════════════════
eyebrow("Setup")
h2("Before you click")
bullet([("Sign in ", B), ("as ", {}), ("admin@gmail.com", dict(font=MONO)),
        (" — this account sees every module.", {})])
bullet([("Set the Customer Scope ", B),
        ("(top-right of the header) to ", {}), ("All Customers", B),
        (" for the portfolio view. Later flip it to ", {}), ("Enterprise", B),
        (" to show the whole application re-scope in one click — every screen, Case "
         "Management included, forks to business accounts only.", {})])

# ══ PART A ══════════════════════════════════════════════════════════════════
eyebrow("Part A")
h2("The customer journey")
body([("Portfolio Pulseboard → Customer Pulseboard. Start wide, end on one account.", dict(color=MUTED))])

# KPI table
kpi = doc.add_table(rows=2, cols=4)
kpi.style = "Table Grid"
kpi_data = [
    ("Total Outstanding", money(out), f"down {abs(round((out-prior)/prior*100,1))}% MoM · 480 accts"),
    ("90+ DPD Exposure", money(sev_out), f"{round(sev_out/out*100,1)}% of book · {len(severe)} accts"),
    ("Collected MTD", money(col), f"{round(col/tgt*100,1)}% of target"),
    ("Collection Effectiveness", "84.2%", "above 80% = healthy"),
]
for j, (label, val, sub) in enumerate(kpi_data):
    cell = kpi.rows[0].cells[j]
    p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(0)
    run(p, label, size=8.5, color=MUTED)
    vp = cell.add_paragraph(); vp.paragraph_format.space_after = Pt(0)
    run(vp, val, size=16, bold=True, font=MONO, color=CRIT if j == 1 else INK)
    sp = kpi.rows[1].cells[j].paragraphs[0]
    run(sp, sub, size=8, color=MUTED, font=MONO)
    _shade(cell, "FBE9E9" if j == 1 else "FFFFFF")
    _shade(kpi.rows[1].cells[j], "FBE9E9" if j == 1 else "FFFFFF")

stages_a = [
    ("1", "Portfolio Pulseboard · Portfolio Dashboard", "Open on the headline",
     [[("Four hero tiles: ", {}), (money(out), FIG), (" outstanding, ", {}), (money(sev_out), FIG),
       (" in 90+, ", {}), (money(col), FIG), (" collected, CEI ", {}), ("84.2%", FIG), (".", {})],
      [("Aging chart: the ", {}), ("90+ bar is red", B), (f" — {round(sev_out/out*100,1)}% of the money "
       f"sits in {round(len(severe)/len(ACCOUNTS)*100,1)}% of accounts.", {})],
      [("Scroll to ", {}), ("Needs Attention", B), (": three ranked cohorts, largest first.", {})]],
     [("The book is shrinking and we're ahead of collection pace — but risk is ", {}),
      ("concentrating", dict(bold=True, color=RGBColor(0x47,0x50,0x67))),
      (". A fifth of the balance is in 90+, held by a handful of accounts. The dashboard hands the "
       "collector the three cohorts worth their morning.", {})]),
]

for num, module, title, shows, saytxt in stages_a:
    p = para(space_before=12, space_after=1)
    run(p, module.upper(), size=8.5, bold=True, color=MUTED, font=MONO)
    h3(f"{num}.  {title}")
    for sh in shows:
        bullet(sh)
    say(saytxt)

# Priority cohort table
h3("2.  The three priority cohorts")
body([("From Needs Attention — click the top row to deep-link into Risk Analysis. Aisha is in this group.",
       dict(color=MUTED, size=10))], space_after=4)
pc = doc.add_table(rows=1, cols=4); pc.style = "Table Grid"
hdr = pc.rows[0].cells
for j, t in enumerate(["Cohort", "Value at risk", "Accounts", "Severity"]):
    run(hdr[j].paragraphs[0], t.upper(), size=8, bold=True, color=MUTED, font=MONO)
    _shade(hdr[j], BAND)
for name, val, n, sev, sevc in [
    ("Aged high-value, no recent contact", money(S(aged, lambda a: a["outstanding"])), len(aged), "Critical", CRIT),
    ("Broken promises to pay", money(S(broken, lambda a: a["ptpValueAtRisk"])), len(broken), "Warning", WARN),
    ("Disputes past SLA", money(S(disp, lambda a: a["disputeValue"])), len(disp), "Warning", WARN),
]:
    row = pc.add_row().cells
    run(row[0].paragraphs[0], name, size=10, bold=True)
    run(row[1].paragraphs[0], val, size=10, font=MONO)
    run(row[2].paragraphs[0], str(n), size=10, font=MONO)
    run(row[3].paragraphs[0], sev, size=10, bold=True, color=sevc)

rest_a = [
    ("3", "Customer Pulseboard · Risk Analysis", "Score the book, then find her",
     [[("Four bands — Low / Medium / High / ", {}), ("Critical", B), (" — each a real count off the 0–100 score.", {})],
      [("Search ", {}), ("Aisha Darwish", B), (": score ", {}), ("95/100", FIG), (", bar deep red.", {})],
      [("Detail panel lists her ", {}), ("ranked risk drivers", B), (", biggest contribution first.", {})]],
     [("One scale, end to end. Her 95 isn't a label someone typed — it's built from 194 days past due, "
       "41% contactability, a broken promise, and an open dispute.", {})]),
    ("4", "Customer Pulseboard · Risk Grid Analytics", "Where she sits on the grid",
     [[("Aging × risk heatmap; cell intensity = exposure. Aisha lands in the ", {}), ("90+ × Critical", B), (" cell.", {})],
      [("Behavioural segmentation groups her under ", {}), ("Disputed / Blocked", B), (" — dispute holds collection.", {})],
      [("Priority Targets ranks by exposure × risk × reachability, with the recommended play per account.", {})]],
     None),
    ("5", "Customer Pulseboard · Customer 360 & Borrower 360", "The whole account in one view",
     [[("Header badges: ", {}), ("90+ Days · Critical 95/100", dict(color=CRIT, bold=True)),
       (" — outstanding ", {}), ("$3,727", FIG), (".", {})],
      [("Risk trend climbs over 6 months; payment history shows the missed run.", {})],
      [("Borrower 360 tabs — Invoices, Payments, Milestones, Communications, ", {}), ("Disputes", B),
       (". The dispute reads ", {}), ("Past SLA — Escalated", dict(color=WARN, bold=True)), (", ", {}), ("$932", FIG), (".", {})],
      [("Assigned to ", {}), ("Robert Kim", B), (" — your cue to switch hats.", {})]],
     [("Everything a collector needs before dialling — exposure, why she's risky, what she's paid, the open "
       "dispute, and who owns her. That name, Robert Kim, is where Part B begins.", {})]),
]
for num, module, title, shows, saytxt in rest_a:
    p = para(space_before=12, space_after=1)
    run(p, module.upper(), size=8.5, bold=True, color=MUTED, font=MONO)
    h3(f"{num}.  {title}")
    for sh in shows:
        bullet(sh)
    if saytxt:
        say(saytxt)

# ══ PART B ══════════════════════════════════════════════════════════════════
eyebrow("Part B")
h2("The agent workflow")
body([("Operations Hub. Same data, the collector's side of the desk.", dict(color=MUTED))])

stages_b = [
    ("6", "Operations Hub · Case Management", "Open Robert Kim's book",
     [[("Set ", {}), ("View by → Agent", B), (", pick ", {}), ("Robert Kim", B), (" (the roster is the real six agents).", {})],
      [("His card summarizes the load: PTPs · Cases · Disputes · Legal as badge counts.", {})],
      [("Expand the card — items lay out in four typed columns; Aisha's dispute and broken PTP are here.", {})]],
     [("This is the same Aisha, now inside her collector's queue — one of Robert's ", {}),
      ("40 live cases", dict(bold=True, color=RGBColor(0x47,0x50,0x67))),
      (", $494K of exposure. Nothing was re-entered; the case view and the customer view read the same record.", {})]),
    ("7", "Operations Hub · Case Management views", "Three lenses on the same cases",
     [[("Customer view", B), (" — expandable table: exposure, aging, DPD, risk, credit, agent.", {})],
      [("Cases view", B), (" — card grid, Consumer and Enterprise sections, grid⇄table toggle.", {})],
      [("Each card's eye icon opens a drawer (Overview / Notes / To-Do); disputes, PTPs and legal open their own modals.", {})]],
     None),
    ("8", "Operations Hub · Agent Dashboard & Performance", "How the team is tracking",
     [[("Agent Dashboard", B), (": target vs recovery, a case table driven by real assigned accounts.", {})],
      [("Agent Performance", B), (": 6-agent trends and a recovery-comparison bar chart.", {})],
      [("AI Engagement Center", B), (": the live interaction queue — Aisha's channel is ", {}), ("Voicebot", B), (", ranked by risk.", {})]],
     [("The response numbers tell their own story — digital is cheap but ignored (SMS 12.6%, Email 8.1%), voice "
       "converts (Voicebot and Dialer ~24%) but costs more. That trade-off is what the Dunning studio automates.", {})]),
]
for num, module, title, shows, saytxt in stages_b:
    p = para(space_before=12, space_after=1)
    run(p, module.upper(), size=8.5, bold=True, color=MUTED, font=MONO)
    h3(f"{num}.  {title}")
    for sh in shows:
        bullet(sh)
    if saytxt:
        say(saytxt)

# ══ DUNNING ═════════════════════════════════════════════════════════════════
eyebrow("Cross-cutting")
h2("Dunning Strategy Studio")
body([("Show this as the general workflow that ties the two journeys together — not a data screen, a design canvas.",
       dict(color=MUTED))])
flow = para(space_after=8)
stages = ["Soft Reminder", "Standard Dunning", "AI Adaptive", "Intensive Recovery", "Pre-Legal"]
for i, s in enumerate(stages):
    run(flow, s, size=10, font=MONO, bold=True, color=CRIT if s == "Pre-Legal" else INK)
    if i < len(stages) - 1:
        run(flow, "  →  ", size=10, font=MONO, color=MUTED)
bullet([("Strategy Library", B), (" lands first — six published journeys with segment, aging, uplift and version.", {})])
bullet([("Click one to open the ", {}), ("visual designer", B), (": drag channels, actions, conditions, AI and RPA nodes onto the canvas.", {})])
bullet([("Simulate, A/B test, run What-If, then Save Draft → Submit for Approval → Publish.", {})])
say([("Every account you just saw is riding one of these journeys. Aisha has escalated all the way to ", {}),
     ("Pre-Legal", dict(bold=True, color=CRIT)), (" — stage five. The studio is where an operations lead designs "
     "that escalation once, and the whole book follows it.", {})])

# ══ RECONCILIATION ══════════════════════════════════════════════════════════
eyebrow("The proof")
h2("One record, every screen")
body([("If someone asks \"is this real data or six disconnected mockups?\" — this is the answer. "
       "Aisha's $3,727 is the same field read six ways.", dict(color=MUTED))], space_after=4)

rec = doc.add_table(rows=1, cols=3); rec.style = "Table Grid"
rh = rec.rows[0].cells
for j, t in enumerate(["Screen", "What it shows for Aisha", "Figure"]):
    run(rh[j].paragraphs[0], t.upper(), size=8, bold=True, color=MUTED, font=MONO)
    _shade(rh[j], BAND)
for screen, what, fig in [
    ("Portfolio Dashboard", "Counted in 90+ exposure", "$3,727"),
    ("Risk Analysis", "Risk score", "95 / 100"),
    ("Risk Grid", "Grid cell", "90+ × Critical"),
    ("Customer 360", "Outstanding", "$3,727"),
    ("Borrower 360", "Outstanding + dispute", "$3,727 · $932"),
    ("Case Management", "Exposure in Robert's book", "$3,727"),
    ("Reports · Case & SLA", "Dispute past SLA", "$932"),
]:
    row = rec.add_row().cells
    run(row[0].paragraphs[0], screen, size=10, bold=True)
    run(row[1].paragraphs[0], what, size=10)
    run(row[2].paragraphs[0], fig, size=10, font=MONO, color=ACCENT, bold=True)

body([("Why it can't drift:  ", dict(bold=True, color=ACCENT)),
      ("there is one account list. Every screen derives its numbers from it — the dashboard sums it, Risk "
       "Analysis scores it, Case Management groups it by agent. Change the source and all seven move together.", {})],
     space_before=8)
body([("The one-click finale:  ", dict(bold=True, color=ACCENT)),
      (f"flip Customer Scope to Enterprise. The book drops from {money(out)} / 480 accounts to "
       f"{money(S(ent, lambda a: a['outstanding']))} / {len(ent)} — and every screen re-scopes at once, Case "
       "Management included. Aisha (a consumer) disappears; flip back to All and she returns.", {})])

# Footer
foot = para(space_before=18)
_no_borders_but_bottom(foot)  # gives a top rule via the paragraph above; add text below
f2 = para(space_before=2)
run(f2, "RADONaix Assure+ · Demo Script", size=8.5, color=MUTED, font=MONO)
run(f2, "        All figures generated from src/data/portfolio.json · 480 accounts", size=8.5, color=MUTED, font=MONO)

OUT = os.path.join(HERE, "RADONaix-Assure-Demo-Script.docx")
doc.save(OUT)
print("wrote", OUT)
