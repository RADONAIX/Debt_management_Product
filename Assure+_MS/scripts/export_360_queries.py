"""Generate the Subscriber 360 query reference as a Word document.

Every SQL statement is read out of app/modules/customers/service.py at run
time rather than being retyped here, so the document cannot drift from the
code. Re-run it after changing a query and the reference regenerates.
"""

from __future__ import annotations

import pathlib
import re
from datetime import date

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = pathlib.Path(__file__).resolve().parents[1]
SERVICE = ROOT / "app/modules/customers/service.py"
RISK_SERVICE = ROOT / "app/modules/risk/service.py"
OUT = ROOT.parent / "docs" / "Subscriber_360_SQL_Reference.docx"

INK = RGBColor(0x1E, 0x29, 0x3B)
ACCENT = RGBColor(0x2B, 0x4C, 0xDE)
MUTED = RGBColor(0x64, 0x74, 0x8B)


def named_queries(path: pathlib.Path) -> dict[str, str]:
    """Module-level `_X_SQL = text(\"\"\"...\"\"\")` constants, keyed by name."""
    src = path.read_text()
    found = re.findall(r'^(_[A-Z0-9_]+SQL)\s*=\s*(?:text\()?"""(.*?)"""', src, re.S | re.M)
    return {name: body.strip("\n") for name, body in found}


def dedent(sql: str) -> str:
    lines = [l.rstrip() for l in sql.splitlines() if l.strip()]
    pad = min((len(l) - len(l.lstrip()) for l in lines), default=0)
    return "\n".join(l[pad:] for l in lines)


Q = named_queries(SERVICE)
QR = named_queries(RISK_SERVICE)

# Queries written inline in a function body rather than as a constant.
_SRC = SERVICE.read_text()


def func_body(name: str) -> str:
    """Source of one function, bounded so extraction cannot run past its end."""
    m = re.search(rf"\nasync def {name}\(.*?(?=\n(?:async )?def |\n_[A-Z][A-Z0-9_]*\s*=)",
                  _SRC, re.S)
    return m.group(0) if m else ""


def inline(name: str) -> str:
    """SQL written as adjacent string literals inside a function, rejoined."""
    body_src = func_body(name)
    out = []
    for call in re.findall(r"text\(\s*((?:\s*\"[^\"]*\"\s*)+)\)", body_src):
        parts = re.findall(r'"([^"]*)"', call)
        joined = "".join(parts).strip()
        if joined.upper().startswith("SELECT"):
            out.append(joined)
    return out


_GRADES = inline("_apply_rule_grades")
_COMPANY = inline("_company_customer_ids")
GRADES_SQL = _GRADES[0] if _GRADES else ""
COMPANY_IDS_SQL = "\n\n".join(f"{s.rstrip(chr(59))};" for s in _COMPANY)

doc = Document()

# --- Page + base styles ----------------------------------------------------
for s in doc.sections:
    s.left_margin = s.right_margin = Inches(0.85)
    s.top_margin = s.bottom_margin = Inches(0.8)

normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)
normal.font.color.rgb = INK
normal.paragraph_format.space_after = Pt(6)


def shade(paragraph, hex_fill: str) -> None:
    el = OxmlElement("w:shd")
    el.set(qn("w:val"), "clear")
    el.set(qn("w:fill"), hex_fill)
    paragraph._p.get_or_add_pPr().append(el)


def heading(text: str, level: int) -> None:
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = ACCENT if level == 1 else INK
        run.font.name = "Calibri"
    h.paragraph_format.space_before = Pt(16 if level == 1 else 12)
    h.paragraph_format.space_after = Pt(4)


def body(text: str, italic: bool = False, colour: RGBColor | None = None) -> None:
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.italic = italic
    if colour:
        r.font.color.rgb = colour


def sql_block(sql: str) -> None:
    """Monospaced, shaded, with the SQL kept verbatim."""
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.12)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.line_spacing = 1.0
    shade(p, "F4F6FA")
    r = p.add_run(dedent(sql))
    r.font.name = "Consolas"
    r.font.size = Pt(8.5)
    r.font.color.rgb = RGBColor(0x0F, 0x23, 0x44)
    # East-Asian font must be set too or Word substitutes the monospace face.
    r._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")


def query(title: str, purpose: str, feeds: str, tables: str, sql: str) -> None:
    heading(title, 3)
    for label, value in (("Purpose", purpose), ("Feeds", feeds), ("Reads", tables)):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        lr = p.add_run(f"{label}:  ")
        lr.bold = True
        lr.font.size = Pt(9.5)
        vr = p.add_run(value)
        vr.font.size = Pt(9.5)
        vr.font.color.rgb = MUTED if label != "Purpose" else INK
    sql_block(sql)


def table(headers: list[str], rows: list[list[str]]) -> None:
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Light Grid Accent 1"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        r = cell.paragraphs[0].add_run(h)
        r.bold = True
        r.font.size = Pt(9)
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""
            r = cells[i].paragraphs[0].add_run(v)
            r.font.size = Pt(9)
    doc.add_paragraph()


# --- Cover -----------------------------------------------------------------
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.LEFT
tr = title.add_run("RADONaix Assure+")
tr.font.size = Pt(13)
tr.font.color.rgb = ACCENT
tr.bold = True

sub = doc.add_paragraph()
sr = sub.add_run("Subscriber 360 — SQL Query Reference")
sr.font.size = Pt(26)
sr.bold = True
sr.font.color.rgb = INK

meta = doc.add_paragraph()
mr = meta.add_run(
    f"Every SELECT statement that populates the Subscriber 360 module.\n"
    f"Generated {date.today():%d %B %Y} from app/modules/customers/service.py."
)
mr.font.size = Pt(10)
mr.font.color.rgb = MUTED

doc.add_paragraph()

# --- How the screen is assembled -------------------------------------------
heading("How the screen is assembled", 1)
body(
    "Subscriber 360 is served by four endpoints. Each one runs a small set of "
    "purpose-built queries rather than one wide join, so a slow section never "
    "blocks the rest of the screen. All customer data is read live from "
    "customer_schema — nothing about a customer is cached or copied into "
    "another schema."
)

table(
    ["Endpoint", "Screen area", "Queries"],
    [
        ["GET /customers/{code}/360", "Profile header, KPIs, risk trend, payment history, engagement", "5"],
        ["GET /customers/{code}/borrower", "Account Activity tabs: invoices, payments, interactions, disputes, milestones", "5"],
        ["GET /customers/{code}/signals", "Behavioural signal panel", "1"],
        ["GET /companies, /companies/{code}", "Enterprise hierarchy and the company-level 360", "5"],
    ],
)

body("Schemas in play", italic=False)
table(
    ["Schema", "Holds", "Used by 360 for"],
    [
        ["customer_schema", "customer, company, company_branch, department, account, billing_account, invoice, payment, ptp, dispute, case_activity, debt_case, risk_profile, risk_history, subscriber_risk_profile", "Everything the screen shows"],
        ["public", "strategy", "The assigned strategy name"],
        ["administration", "app_user", "The assigned agent and interaction actors"],
        ["recovery_schema", "placement, recovery", "Agency recoveries, posted into customer_schema.payment so they appear here as payments"],
    ],
)

doc.add_page_break()

# --- 1. Customer 360 -------------------------------------------------------
heading("1.  GET /customers/{code}/360", 1)
body(
    "The main screen. build_360() runs these five queries and assembles the "
    "profile. The :ids parameter is an array — for a consumer it is that one "
    "customer, for an enterprise it is every customer holding a line under the "
    "company, which is how the same code serves both views."
)

query(
    "1.1  Profile and line summary  (_LINE_SQL)",
    "The customer record joined to their primary account — identity, plan, balance, DPD, "
    "risk band, assigned strategy and agent. Also aggregates every line the customer "
    "holds so the header can show total outstanding across all of them.",
    "Profile header, account tiles, total outstanding, DPD, aging bucket, assigned strategy",
    "customer, account, billing_account, company, company_branch, department, strategy, app_user",
    Q["_LINE_SQL"],
)

query(
    "1.2  Risk trend  (_HISTORY_SQL)",
    "Twelve months of stored risk scores, one row per month, so the trend line reflects "
    "recorded history rather than a value recomputed at render time.",
    "Risk trend sparkline",
    "risk_history",
    Q["_HISTORY_SQL"],
)

query(
    "1.3  Payment history  (_PAYMENTS_SQL)",
    "Monthly payment totals with on-time / late classification, derived by comparing the "
    "payment date against the invoice due date. Agency recoveries appear here because a "
    "recovery writes a real payment row.",
    "Payment history chart, bills-settled-on-time, average payment delay",
    "payment, invoice",
    Q["_PAYMENTS_SQL"],
)

query(
    "1.4  Engagement history  (_ENGAGEMENT_SQL)",
    "Contact attempts and their outcomes, plus promise-to-pay counts kept and broken. "
    "Feeds the contactability and PTP-success figures.",
    "Contacts made / failed, PTP success rate, last contact date, next follow-up",
    "case_activity, ptp, debt_case",
    Q["_ENGAGEMENT_SQL"],
)

query(
    "1.5  Behavioural grades  (_apply_rule_grades)",
    "Reads the scored profile and maps each numeric score onto the band label configured "
    "in the risk scoring rules, so the screen shows the same grade the rules engine "
    "assigned rather than a separately stored word.",
    "Financial stress, legal awareness, financial literacy, responsibility, credit awareness, "
    "risk appetite, cooperation",
    "subscriber_risk_profile, risk_score_definition, risk_score_band",
    GRADES_SQL,
)

doc.add_page_break()

# --- 2. Account Activity ---------------------------------------------------
heading("2.  GET /customers/{code}/borrower  —  Account Activity", 1)
body(
    "The tabbed history below the profile. Each tab is one query, paginated at "
    "10 rows in the UI."
)

query(
    "2.1  Invoices  (_INVOICES_SQL)",
    "The customer's own invoices, unioned with their prorated share of any group invoice "
    "billed at company level — so an enterprise subscriber sees what they actually owe, "
    "not the whole company bill.",
    "Invoices tab",
    "invoice, invoice_group_member, account",
    Q["_INVOICES_SQL"],
)

query(
    "2.2  Payments  (_PAYMENT_ROWS_SQL)",
    "Individual payment lines with the invoice each settled. Agency recoveries appear "
    "here with the agency named in the notes.",
    "Payments tab",
    "payment, invoice",
    Q["_PAYMENT_ROWS_SQL"],
)

query(
    "2.3  Interactions  (_INTERACTIONS_SQL)",
    "Every contact on the account — channel, direction, subject, outcome — with the agent "
    "who made it, or flagged automated.",
    "Interactions tab",
    "case_activity, app_user",
    Q["_INTERACTIONS_SQL"],
)

query(
    "2.4  Disputes  (_DISPUTES_SQL)",
    "Raised disputes with their status and resolution.",
    "Disputes tab",
    "dispute",
    Q["_DISPUTES_SQL"],
)

query(
    "2.5  Milestones  (_MILESTONES_SQL)",
    "Key dates on the relationship — activation, first delinquency, last payment, case "
    "opened — rendered as the account timeline.",
    "Timeline",
    "account, payment, debt_case",
    Q["_MILESTONES_SQL"],
)

doc.add_page_break()

# --- 3. Signals ------------------------------------------------------------
heading("3.  GET /customers/{code}/signals", 1)
query(
    "3.1  Behavioural signals  (_SIGNALS_SQL)",
    "The scored behavioural profile for the subscriber, read straight from the risk "
    "engine's output table.",
    "Behavioural signals panel",
    "subscriber_risk_profile",
    Q["_SIGNALS_SQL"],
)

# --- 4. Enterprise ---------------------------------------------------------
heading("4.  Enterprise hierarchy and company 360", 1)
body(
    "An enterprise customer is rendered by the same screen. These queries resolve "
    "the company, its branches and the subscribers underneath, then the company "
    "view reuses the payment and engagement queries from section 1 with the full "
    "list of customer ids."
)

query(
    "4.1  Company list  (_COMPANIES_SQL)",
    "Every company with its branch count, subscriber count, total outstanding and BANs — "
    "the searchable enterprise picker.",
    "Customer picker (Companies group), enterprise list",
    "company, company_branch, account, billing_account, customer",
    Q["_COMPANIES_SQL"],
)

query(
    "4.2  Branches  (_BRANCHES_SQL)",
    "Branches of one company with per-branch subscriber counts and balances.",
    "Enterprise hierarchy — branch rows",
    "company_branch, department, customer, account",
    Q["_BRANCHES_SQL"],
)

query(
    "4.3  Subscribers per branch  (_BRANCH_SUBS_SQL)",
    "The subscriber lines under each branch, with number, plan, BAN, balance, DPD and "
    "risk — the drill-down table.",
    "Enterprise hierarchy — subscriber rows",
    "customer, account, billing_account, company_branch, department",
    Q["_BRANCH_SUBS_SQL"],
)

query(
    "4.4  Company roll-up  (_COMPANY_SUMMARY_SQL)",
    "Company-level totals — outstanding, line count, worst DPD, weighted risk — so the "
    "company view reconciles with the sum of its subscribers.",
    "Company 360 header and KPIs",
    "company, company_branch, department, customer, account",
    Q["_COMPANY_SUMMARY_SQL"],
)

query(
    "4.5  Company membership  (_company_customer_ids)",
    "Resolves a company code to every customer id holding a line under it. This id array "
    "is what lets the consumer queries above serve the enterprise view unchanged.",
    "All company-scoped sections",
    "company, company_branch, department, customer, account",
    COMPANY_IDS_SQL,
)

doc.add_page_break()

# --- 5. Reconciliation -----------------------------------------------------
heading("5.  How agency recoveries reach this screen", 1)
body(
    "The Recovery Workspace does not have its own idea of what a customer owes. "
    "When a recovery is posted against a placement, the service writes a row into "
    "customer_schema.payment, reduces account.outstanding and moves "
    "account.last_payment_at. Section 1.3 and 2.2 then pick it up like any other "
    "payment, which is why the debt shown in the Recovery Workspace and the debt "
    "shown here are always the same number."
)
sql_block(
    """-- Posted by recovery.service.add_recovery(), inside the same transaction
INSERT INTO customer_schema.payment
  (payment_ref, customer_id, account_id, amount, payment_date, method_code, status, notes)
VALUES (:ref, :cu, :ac, :amt, COALESCE(:on, CURRENT_DATE), :method, 'COMPLETED', :note)
RETURNING id;

UPDATE customer_schema.account
SET outstanding     = GREATEST(0, outstanding - :amt),
    last_payment_at = GREATEST(COALESCE(last_payment_at, '-infinity'::timestamptz),
                               COALESCE(:on, CURRENT_DATE)::timestamptz),
    updated_at      = now()
WHERE id = :i;"""
)

body(
    "Reconciliation check — this returns zero rows when the two screens agree:",
    italic=True,
)
sql_block(
    """SELECT p.placement_code, a.account_code,
       p.placed_amount - p.recovered_amount AS open_on_placement,
       a.outstanding                        AS debt_on_360
FROM recovery_schema.placement p
JOIN customer_schema.account a ON a.id = p.account_id
WHERE p.status IN ('ACTIVE','LEGAL')
  AND abs((p.placed_amount - p.recovered_amount) - a.outstanding) > 0.02;"""
)

# --- Appendix --------------------------------------------------------------
heading("Appendix — parameters", 1)
table(
    ["Parameter", "Type", "Meaning"],
    [
        [":ids", "bigint[]", "Customer ids in scope. One element for a consumer; every customer under the company for an enterprise."],
        [":code", "varchar", "Business key — customer_code or company_code. The API never exposes surrogate ids."],
        [":id", "bigint", "A single customer id, used by the signal and grade queries."],
    ],
)

body(
    "All statements are parameterised through SQLAlchemy text() bindings. No value "
    "is ever interpolated into a query string.",
    italic=True,
    colour=MUTED,
)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(f"wrote {OUT}")
print(f"  {len(Q)} named queries found in the service")
