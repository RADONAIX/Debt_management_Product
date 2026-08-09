"""negotiation_bot2 — a single-file debt-negotiation chatbot API.

Standalone sandbox. It shares nothing with ``src/``: no policy engine,
guardrail layer, or gateway. One OpenAI key, one Postgres connection, one
system prompt, one file.

Account facts are read live from ``customer_schema`` in Debt_management_db —
the same ``risk_grid_account_view`` that backs the Priority Targets grid — so a
session opens against a real customer rather than hand-typed figures. Customer
data stays read-only; conversation state is written only to ``chatbot``.

The negotiation rules live in the prompt only. That is a deliberate divergence
from the main build (CLAUDE.md law 2, which requires code enforcement) and it
is why this folder is not production code. What it gives you is a working
negotiator you can put in front of a real account in about a minute.

Run, from the repository root:
    uv run uvicorn api:app --app-dir negotiation_bot2 --reload --port 8000
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Literal

import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import APIError, OpenAI
from psycopg.rows import dict_row
from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def _load_dotenv() -> None:
    """Read the repo-root .env without taking a dependency on python-dotenv.

    Existing environment variables win, so `OPENAI_API_KEY=... uvicorn ...`
    still overrides the file.
    """
    for parent in [Path(__file__).resolve().parent, *Path(__file__).resolve().parents]:
        env = parent / ".env"
        if not env.is_file():
            continue
        for raw in env.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))
        return


_load_dotenv()

MODEL = os.getenv("NEGOTIATION_BOT2_MODEL", "gpt-5.4")
TEMPERATURE = float(os.getenv("NEGOTIATION_BOT2_TEMPERATURE", "0.3"))
MAX_TURNS = int(os.getenv("NEGOTIATION_BOT2_MAX_TURNS", "24"))
CREDITOR = os.getenv("NEGOTIATION_BOT2_CREDITOR", "Telecom_XYZ")
AGENT_NAME = os.getenv("NEGOTIATION_BOT2_AGENT_NAME", "Debt_collection_agent")

# Comma-separated list, or "*" for any origin.
CORS_ORIGINS = [
    o.strip() for o in os.getenv("NEGOTIATION_BOT2_CORS_ORIGINS", "*").split(",")
]

# SQLAlchemy-style URL in .env; psycopg wants the bare scheme.
DSN = os.getenv("DATABASE_URL", "").replace("postgresql+psycopg://", "postgresql://")

# The nine collector strategies. Every turn must carry exactly one.
STRATEGIES = (
    "IDENTITY_VERIFICATION",
    "ESTABLISH_TRUST",
    "FINANCIAL_ASSESSMENT",
    "EMOTIONAL_APPEASEMENT",
    "STATEMENT_OF_FACTS",
    "CONSTRUCTIVE_CHALLENGE",
    "ETHICAL_APPEAL",
    "LEGAL_DETERRENT",
    "REPAYMENT_NEGOTIATION",
)

# ---------------------------------------------------------------------------
# SQL — customer data is read-only; conversation writes stay in chatbot.*
# ---------------------------------------------------------------------------

# Money at risk = exposure weighted by the chance of losing it. This is the
# ordering behind the Priority Targets grid.
TARGETS_SQL = """
select account_id, account_code, subscriber_no, customer_id, customer_code,
       customer_name, customer_type, outstanding, dpd, risk_level,
       behaviour_profile, recovery_probability, case_status, agent_name,
       next_followup_date,
       round(outstanding * (1 - recovery_probability / 100), 2) as money_at_risk
from customer_schema.risk_grid_account_view
-- Casts are required: Postgres cannot infer a parameter's type from a NULL.
where (%(risk_level)s::text is null or risk_level = %(risk_level)s::text)
order by money_at_risk desc
limit %(limit)s
"""

ACCOUNT_SQL = """
select v.*,
       c.city, c.occupation, c.monthly_income, c.financial_stress,
       c.legal_awareness, c.financial_literacy, c.credit_awareness,
       c.emotional_state, c.life_event, c.employment_stability,
       c.preferred_language, c.best_contact_time, c.behaviour_type,
       c.status as customer_status,
       a.currency_code, a.aging_bucket, a.dunning_stage, a.tenure_months
from customer_schema.risk_grid_account_view v
join customer_schema.customer c on c.id = v.customer_id
join customer_schema.account a on a.id = v.account_id
-- Casts are required: Postgres cannot infer a parameter's type from a NULL.
where (%(account_id)s::bigint is null or v.account_id = %(account_id)s::bigint)
  and (%(customer_id)s::bigint is null or v.customer_id = %(customer_id)s::bigint)
  and (%(subscriber_no)s::text is null or v.subscriber_no = %(subscriber_no)s::text)
  and (%(account_code)s::text is null or v.account_code = %(account_code)s::text)
order by v.outstanding desc
limit 1
"""

DISPUTES_SQL = """
select dispute_code, description, amount, status, priority, filed_at::date as filed_on
from customer_schema.dispute
where account_id = %(account_id)s and resolved_at is null
order by filed_at
"""

PTP_SQL = """
select ptp_code, promised_amount, promised_date, instalment_count, kept_amount, status
from customer_schema.ptp
where account_id = %(account_id)s
order by promised_date
"""

SESSION_SQL = """
select id, account_id, principal, days_overdue, status, agreement, created_at
from chatbot.sessions
where id = %(session_id)s
"""

TRANSCRIPT_SQL = """
select id, index, speaker, dialogue, created_at
from chatbot.turns
where session_id = %(session_id)s
order by index, id
"""


def _query(sql: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    if not DSN:
        raise HTTPException(500, "DATABASE_URL is not set")
    try:
        with (
            psycopg.connect(DSN, connect_timeout=10, row_factory=dict_row) as conn,
            conn.cursor() as cur,
        ):
            cur.execute(sql, params)
            return list(cur.fetchall())
    except psycopg.Error as exc:
        raise HTTPException(502, f"database error: {exc}") from exc


def _persist_session(session: "Session", acct: dict[str, Any]) -> None:
    """Create the durable conversation row before the first bot utterance."""
    try:
        with psycopg.connect(DSN, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into chatbot.sessions
                    (id, tenant_id, account_id, jurisdiction, product, principal,
                     days_overdue, status, ledger, agreement)
                values (%s, 'assure', %s, 'ae', %s, %s, %s, 'open', %s, null)
                on conflict (id) do nothing
                """,
                (
                    session.session_id,
                    acct["account_code"],
                    acct.get("service_type") or "telecom",
                    session.negotiable_balance,
                    int(acct.get("dpd") or 0),
                    json.dumps({
                        "source": "negotiation_bot2",
                        "customer_id": acct.get("customer_id"),
                        "subscriber_no": acct.get("subscriber_no"),
                    }),
                ),
            )
    except psycopg.Error as exc:
        raise HTTPException(502, f"could not persist chat session: {exc}") from exc


def _persist_turn(
    session_id: str,
    *,
    speaker: str,
    dialogue: str,
    strategy: str | None = None,
    action: str = "ask",
    thoughts: str = "",
    proposed: dict[str, Any] | None = None,
) -> None:
    """Append one customer, chatbot, or agent-visible message transactionally."""
    try:
        with psycopg.connect(DSN, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute(
                "select id from chatbot.sessions where id = %s for update",
                (session_id,),
            )
            if cur.fetchone() is None:
                raise HTTPException(404, f"no session {session_id}")
            cur.execute(
                "select coalesce(max(index) + 1, 0) from chatbot.turns where session_id = %s",
                (session_id,),
            )
            next_index = cur.fetchone()[0]
            cur.execute(
                """
                insert into chatbot.turns
                    (session_id, index, speaker, strategy, action, dialogue,
                     thoughts, proposed)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    session_id,
                    next_index,
                    speaker,
                    strategy,
                    action,
                    dialogue,
                    thoughts,
                    json.dumps(proposed) if proposed is not None else None,
                ),
            )
            cur.execute(
                "update chatbot.sessions set updated_at = now() where id = %s",
                (session_id,),
            )
    except HTTPException:
        raise
    except psycopg.Error as exc:
        raise HTTPException(502, f"could not persist chat message: {exc}") from exc


def _persist_outcome(session: "Session", action: str, detail: str = "") -> None:
    agreement = session.agreement.model_dump() if session.agreement else None
    status_value = "escalated" if action == "escalate" else (
        "agreed" if session.outcome == "agreement" else (
            "closed" if session.closed else "open"
        )
    )
    try:
        with psycopg.connect(DSN, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute(
                """
                update chatbot.sessions
                set status = %s, agreement = %s, updated_at = now()
                where id = %s
                """,
                (
                    status_value,
                    json.dumps(agreement) if agreement is not None else None,
                    session.session_id,
                ),
            )
            if action == "escalate":
                cur.execute(
                    "select coalesce(max(index), 0) from chatbot.turns where session_id = %s",
                    (session.session_id,),
                )
                turn_index = cur.fetchone()[0]
                cur.execute(
                    """
                    insert into chatbot.escalations
                        (session_id, turn_index, trigger, detail, status)
                    values (%s, %s, 'customer_requested_agent', %s, 0)
                    on conflict (session_id) do update set
                        trigger = excluded.trigger,
                        detail = excluded.detail,
                        status = case
                            when chatbot.escalations.status = 2 then 2 else 0
                        end
                    """,
                    (session.session_id, turn_index, detail),
                )
    except psycopg.Error as exc:
        raise HTTPException(502, f"could not persist chat outcome: {exc}") from exc


def _stored_messages(session_id: str) -> list[dict[str, Any]]:
    return _query(TRANSCRIPT_SQL, {"session_id": session_id})


def _escalation_status(session_id: str) -> int | None:
    rows = _query(
        "select status from chatbot.escalations where session_id = %(session_id)s",
        {"session_id": session_id},
    )
    return int(rows[0]["status"]) if rows else None


# ---------------------------------------------------------------------------
# Dossier — turning database rows into prompt facts
# ---------------------------------------------------------------------------


def _money(value: Decimal | float | None, currency: str = "$") -> str:
    return "unknown" if value is None else f"{currency}{Decimal(str(value)):,.2f}"


def _build_dossier(
    acct: dict[str, Any], disputes: list[dict[str, Any]], ptps: list[dict[str, Any]]
) -> tuple[str, Decimal]:
    """Render the account into the fact block, and return the balance in play.

    The negotiable balance excludes formally disputed amounts — see the
    ring-fence rule in the prompt.
    """
    cur = "$" if (acct.get("currency_code") or "USD") == "USD" else ""
    outstanding = Decimal(str(acct["outstanding"]))
    disputed = sum((Decimal(str(d["amount"])) for d in disputes), Decimal(0))
    negotiable = outstanding - disputed

    income = acct.get("monthly_income")
    monthly_income = Decimal(str(income)) if income is not None else None

    last_paid = acct.get("last_payment_at")
    last_paid_on = last_paid.date().isoformat() if last_paid else "none on record"
    contacts = f"{acct.get('contact_successes')} of {acct.get('contact_attempts')}"
    daily = f" (≈ {_money(monthly_income / 30, cur)} per day)" if monthly_income else ""

    lines = [
        "## ACCOUNT",
        f"Creditor: {CREDITOR}",
        f"Customer: {acct['customer_name']} ({acct['customer_code']}) · "
        f"{acct.get('city') or 'unknown city'} · {acct['segment']} · "
        f"{acct['region']} region",
        f"Account: {acct['account_code']} · BAN {acct['ban']} · "
        f"{acct.get('service_type')} · plan {acct.get('contract_plan')} · "
        f"status {acct['account_status']}",
        f"Subscriber number: {acct['subscriber_no']}",
        f"Monthly bill: {_money(acct.get('monthly_bill'), cur)}",
        f"Total outstanding: {_money(outstanding, cur)}",
    ]

    if disputed > 0:
        lines.append(
            f"Formally disputed and RING-FENCED: {_money(disputed, cur)} "
            f"across {len(disputes)} open dispute(s), already escalated to the "
            f"disputes team"
        )
    lines += [
        f"NEGOTIABLE BALANCE (all percentages below apply to this figure, "
        f"and this is the only money you discuss today): {_money(negotiable, cur)}",
        f"Days past due: {acct['dpd']} (bucket {acct['dpd_bucket']})",
        f"Last payment: {last_paid_on}"
        f" · payments in last 90 days: {acct.get('payments_90d', 0)}"
        f" ({_money(acct.get('collected_90d'), cur)} collected)",
        f"Credit score: {acct.get('credit_score')} · risk {acct['risk_level']} "
        f"({acct.get('risk_score')}) · recovery probability "
        f"{acct.get('recovery_probability')}%",
        f"Case status: {acct.get('case_status')} · "
        f"assigned human agent: {acct.get('agent_name')}",
        "",
        "## WHAT WE KNOW ABOUT THIS CUSTOMER",
        f"Behaviour profile: {acct.get('behaviour_profile')} "
        f"(internal classification: {acct.get('behaviour_type')})",
        f"Occupation: {acct.get('occupation')} · employment stability "
        f"{acct.get('employment_stability')} · "
        f"tenure {acct.get('tenure_months')} months",
        f"Stated monthly income: {_money(monthly_income, cur)}{daily}",
        f"Financial stress: {acct.get('financial_stress')} · "
        f"financial literacy: {acct.get('financial_literacy')} · "
        f"credit awareness: {acct.get('credit_awareness')} · "
        f"legal awareness: {acct.get('legal_awareness')}",
        f"Recorded emotional state: {acct.get('emotional_state')} · "
        f"recent life event: {acct.get('life_event')}",
        f"Cooperation score: {acct.get('cooperation_score')}/100 · "
        f"responsibility {acct.get('responsibility_score')}/100 · "
        f"contactability {acct.get('contactability')}% "
        f"({contacts} attempts connected)",
        f"Preferred language: {acct.get('preferred_language')}",
    ]

    lines += ["", "## PROMISE-TO-PAY HISTORY"]
    if not ptps:
        lines.append("No promises on record.")
    else:
        kept = sum(1 for p in ptps if p["status"] == "KEPT")
        broken = sum(1 for p in ptps if p["status"] == "BROKEN")
        lines.append(
            f"{len(ptps)} promise(s) on record — {kept} kept, {broken} broken."
        )
        for p in ptps:
            lines.append(
                f"  {p['promised_date']} · {_money(p['promised_amount'], cur)} "
                f"in {p['instalment_count']} instalment(s) · {p['status']}"
                + (
                    f" · paid {_money(p['kept_amount'], cur)}"
                    if p["kept_amount"]
                    else ""
                )
            )

    if disputes:
        lines += ["", "## OPEN DISPUTES (ring-fenced — not yours to settle)"]
        for d in disputes:
            lines.append(
                f"  {d['dispute_code']} filed {d['filed_on']} · "
                f"{_money(d['amount'], cur)} · {d['status']} · "
                f'{d["priority"]} priority · "{d["description"]}"'
            )

    # Pre-computed so the model is not doing mental arithmetic mid-sentence.
    lines += ["", "## OFFER ARITHMETIC (at 0% discount, on the negotiable balance)"]
    for pct in (25, 30, 40):
        upfront = negotiable * Decimal(pct) / 100
        rest = negotiable - upfront
        lines.append(
            f"  {pct}% upfront = {_money(upfront, cur)}; remaining "
            f"{_money(rest, cur)} over 3 months = {_money(rest / 3, cur)}/mo, "
            f"over 6 = {_money(rest / 6, cur)}/mo, "
            f"over 12 = {_money(rest / 12, cur)}/mo"
        )
    if monthly_income:
        lines.append(
            f"  For reference, the 6-month figure at 25% upfront is "
            f"{(negotiable * Decimal('0.75') / 6 / monthly_income * 100):.0f}% "
            f"of their stated monthly income."
        )

    return "\n".join(lines), negotiable


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are {agent_name}, a professional debt-collection negotiator employed by
{creditor}. You are on a live call with a customer whose account is delinquent.
Your job is to reach a concrete, affordable, fully-specified repayment
agreement — not to punish, shame, or read policy at them.

Today's date is {today}.

You are judged on two things at once, and optimising either alone is a failure:
  1. COLLECTION — the value actually recovered, and how soon.
  2. EXPERIENCE — whether the customer felt respected, understood, and dealt
     with honestly.
An agent who gives away discounts to keep the conversation pleasant has failed.
An agent who extracts a good number by pressuring a distressed person has also
failed. Hold both.

{dossier}

# USING THE FILE
Everything above is real and current. Never invent a balance, a date, a fee, a
prior conversation, or a consequence that is not in it. If the customer asks
something the file does not answer, say you do not have it in front of you and
offer to have it sent in writing.

The customer cannot see the file. Never read their risk scores, behaviour
profile, cooperation score, or recovery probability aloud — those are internal
and quoting them is both insulting and a compliance problem. Use them to decide
how to play the call, not as talking points. The same applies to their income
and their broken promises: you may raise a specific broken promise, warmly and
factually, but you may not lecture with a list.

# THE RING-FENCED DISPUTE
If the file shows an open dispute, that amount is already with the disputes
team and is NOT yours to argue, settle, or defend. Do not re-litigate it and do
not treat it as a reason to end the call. If the customer raises it, say
plainly that the disputed amount is on hold with the team handling it, that it
is excluded from today's conversation, and that you are only here about the
undisputed remainder. Then return to that remainder.

# THE AGREEMENT YOU ARE TRYING TO CLOSE
A deal is only real when ALL FOUR fields are settled. Track which are open and
drive toward the missing ones. All percentages apply to the NEGOTIABLE BALANCE.

  disc_ratio  discount on the balance  allowed: 0, 5, 10, 15, 20, 25, 30 (%)
  pmt_ratio   upfront share            allowed: 5 to 50, in steps of 5 (%)
  pmt_days    days to pay the upfront  allowed: 1 to 14 (whole days)
  inst_prds   months for the rest      allowed: 3, 6, 9, 12, 18, 24

These grids are absolute. Never propose an off-grid value — no 7% discount, no
"about three weeks", no 8-month plan. If the customer proposes one, do not
accept it and do not silently round it; name the nearest allowed value and
offer that instead.

# CONCESSION DISCIPLINE — the part you will be tempted to break
- YOUR FIRST OFFER IS ALWAYS disc_ratio = 0, pmt_ratio >= 25, pmt_days <= 7,
  inst_prds of 3 or 6. No exceptions, whatever they have told you by then.
  Hardship changes what you can move to LATER, in exchange for something; it
  never softens the opening. An opening offer that already contains a discount
  has thrown away the only thing you had to trade.
- NEVER ASK FOR LESS THAN THEY HAVE ALREADY VOLUNTEERED. If they say they can
  put down $300, your upfront is at least $300 — choose the smallest allowed
  pmt_ratio whose cash value is at or above their number. Undercutting their
  own offer is the worst mistake available to you, and it happens when you are
  trying to sound accommodating. Take the money they have offered.
- Move off disc_ratio = 0 ONLY on specific, checkable hardship evidence — a job
  loss with a date, a documented medical event, a benefit letter, a concrete
  income figure that contradicts the file — and only after you have already put
  a 0% offer on the table and they have rejected it. Vague pressure — "that's
  too much", "I have nothing", anger, repetition, threatening to hang up — is
  not evidence and earns nothing.
- Push for pmt_ratio >= 25. Go lower only against a stated liquidity constraint
  with a number attached, and never below 5.
- Target pmt_days <= 7. Extend toward 14 only for a named cash-flow event
  ("I'm paid on the 28th").
- Prefer inst_prds of 3 or 6. Longer needs a reason you could repeat to a
  supervisor.
- ONE concession per new piece of information, and never on more than one of
  the four fields in a single turn. If the customer pushes back twice with
  nothing new, your second reply MUST hold the previous position — restate it
  warmly, explain why, ask a question — and must NOT improve the offer.
  Repeated pressure is not new information. This is the single most common way
  agents like you fail.
- Trade, don't donate. Every improvement should buy something: a larger
  upfront, a shorter window, a firm date, a commitment.
- A history of broken promises is a reason to want MORE upfront, not less. If
  they have broken promises on file, a plan that front-loads real money is the
  honest ask, and you may say so gently: past arrangements did not hold, so
  this one needs to start with a payment.

# COMPLIANCE — non-negotiable
- Turn one: give your name, say you are calling from {creditor}, and say it is
  about their account. Verify you are speaking to the named customer before
  disclosing any balance or account detail.
- Never threaten action the creditor has not authorised. No court, bailiffs,
  arrest, wage garnishment, asset seizure, employer contact, or deportation —
  not as fact, not as hint. You MAY calmly state documented consequences that
  genuinely follow: the service is already suspended, arrears continue to be
  reported to credit reference agencies, and an unresolved account can be
  passed to a recovery partner.
- Never discuss the debt with anyone other than the named customer.
- Never misrepresent your identity, the amount owed, or what happens next.
- No abuse, humiliation, shaming, mockery, moralising, or profanity.
- Do not give legal, tax, or debt-advice opinions. Signpost to free debt advice
  if they need it.
- This customer's financial literacy and legal awareness are recorded as low.
  Explain in plain words, check they have followed you, and never use their
  confusion to close a deal they do not understand.

# ESCALATE TO A HUMAN — stop negotiating
Set action = "escalate" if the customer:
  - disputes the UNDISPUTED balance, or raises a new dispute not on file;
  - asks for written validation of the debt;
  - mentions bankruptcy, insolvency, agent or a lawyer or representative acting for
    them;
  - shows distress, hopelessness, or any self-harm signal — respond with care,
    drop the money entirely, and hand off;
  - is a vulnerable party (bereavement, serious illness, coercion);
  - repeats a formal complaint after you have acknowledged it once;
  - asks not to be contacted again.
On escalation your dialogue is short, calm, human, and contains no offer.

# STRATEGY — label every turn with exactly one
  IDENTITY_VERIFICATION   confirm who you are speaking to, disclose purpose
  ESTABLISH_TRUST         build rapport, set a cooperative frame
  FINANCIAL_ASSESSMENT    ask about income, timing, other obligations
  EMOTIONAL_APPEASEMENT   acknowledge and defuse emotion
  STATEMENT_OF_FACTS      restate the account position plainly
  CONSTRUCTIVE_CHALLENGE  test an evasive, inconsistent, or vague claim
  ETHICAL_APPEAL          appeal to responsibility and commitment
  LEGAL_DETERRENT         factually state real, authorised consequences
  REPAYMENT_NEGOTIATION   propose, counter, or close on terms

Rough arc: verify -> trust -> assess -> negotiate. Do not open with terms; you
cannot price a plan before you know what they can pay. Do not stay in
assessment forever either — by turn 4 or 5 there should be a number on the
table.

If you have asked twice for a figure and they have not given you one, STOP
ASKING. Put a concrete, complete offer on the table yourself — all four fields,
with the actual amounts in money — and let them react to it. A question they
keep dodging burns the call; a specific number gives them something to argue
with, and their counter tells you more than another open question would. Never
ask the same question a third time, even reworded.

# HOW TO SPEAK
- One short paragraph, roughly 20 to 70 words. This is a phone call, not a
  letter. Never send a wall of text.
- Plain language. No jargon, no scripted filler, no "I completely understand
  how you feel" boilerplate.
- End with a question or a concrete next step almost every turn.
- Match their register: if they are angry, get calmer and shorter, not louder.
- Never reuse a sentence you have already said in this conversation.
- Say the numbers out loud when you make an offer — the actual amounts, not
  just percentages — so nothing about the deal is ambiguous.

# OUTPUT
Return the structured object only.
  thoughts   private: their position, what is still open, what you will and
             will not give. Never shown to the customer.
  strategy   one of the nine labels.
  action     "ask"      still working toward terms
             "offer"    putting terms on the table or countering
             "accept"   they have agreed to all four fields and you are
                        confirming — only then
             "escalate" handing to a human, per the rules above
  dialogue   exactly what you say to the customer.
  agreement  the four fields as they now stand, or null if no terms are on the
             table yet. When filled it must be the COMPLETE set of terms
             currently proposed, not only the field you changed.
  agreement_reached  true only when action is "accept".
"""

# Strict structured outputs require every property in `required` and
# additionalProperties=false at every level.
TURN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "thoughts",
        "strategy",
        "action",
        "dialogue",
        "agreement",
        "agreement_reached",
    ],
    "properties": {
        "thoughts": {"type": "string"},
        "strategy": {"type": "string", "enum": list(STRATEGIES)},
        "action": {"type": "string", "enum": ["ask", "offer", "accept", "escalate"]},
        "dialogue": {"type": "string"},
        "agreement": {
            "type": ["object", "null"],
            "additionalProperties": False,
            "required": ["disc_ratio", "pmt_ratio", "pmt_days", "inst_prds"],
            "properties": {
                "disc_ratio": {"type": "integer", "enum": [0, 5, 10, 15, 20, 25, 30]},
                "pmt_ratio": {
                    "type": "integer",
                    "enum": [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
                },
                # Enumerated rather than min/max: strict structured outputs
                # ignore numeric range keywords, and an enum cannot be ignored.
                "pmt_days": {"type": "integer", "enum": list(range(1, 15))},
                "inst_prds": {"type": "integer", "enum": [3, 6, 9, 12, 18, 24]},
            },
        },
        "agreement_reached": {"type": "boolean"},
    },
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class Target(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: int
    account_code: str
    subscriber_no: str | None
    customer_id: int
    customer_name: str
    outstanding: float
    dpd: int
    risk_level: str | None
    behaviour_profile: str | None
    recovery_probability: float | None
    money_at_risk: float
    case_status: str | None
    next_action: date | None


class Agreement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    disc_ratio: int
    pmt_ratio: int
    pmt_days: int
    inst_prds: int


class StartRequest(BaseModel):
    """Identify the account. Send exactly one of these — they are AND-ed.

    The example is pinned to a single field on purpose: the docs page otherwise
    prefills all four, and the placeholder values then match no account.
    """

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"example": {"subscriber_no": "+971580000633"}},
    )

    account_id: int | None = None
    customer_id: int | None = None
    subscriber_no: str | None = None
    account_code: str | None = None


class MessageRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"example": {"message": "Yeah, speaking. Who is this?"}},
    )

    message: str = Field(min_length=1)


class TurnResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    customer_name: str
    negotiable_balance: float
    turn: int
    strategy: str
    action: Literal["ask", "offer", "accept", "escalate"]
    dialogue: str
    agreement: Agreement | None
    agreement_value: float | None
    agreement_reached: bool
    closed: bool
    thoughts: str
    escalation_status: int | None = None


class StoredMessage(BaseModel):
    id: int
    index: int
    speaker: str
    dialogue: str
    created_at: str


class LiveTranscriptResponse(BaseModel):
    session_id: str
    status: str
    escalation_status: int | None = None
    messages: list[StoredMessage]


class TranscriptResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    customer_name: str
    account_code: str
    outstanding: float
    disputed: float
    negotiable_balance: float
    started_at: str
    turns: int
    closed: bool
    outcome: str
    agreement: Agreement | None
    agreement_value: float | None
    messages: list[dict[str, str]]
    dossier: str


class Session(BaseModel):
    """Hot session state; the authoritative transcript is persisted in Postgres."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    customer_name: str
    account_code: str
    outstanding: float
    disputed: float
    negotiable_balance: float
    dossier: str
    started_at: str
    history: list[dict[str, str]] = Field(default_factory=list)
    agreement: Agreement | None = None
    closed: bool = False
    outcome: str = "in_progress"


SESSIONS: dict[str, Session] = {}

HUMAN_HANDOFF_PATTERN = re.compile(
    r"\b(agent|human|representative|supervisor|manager|live\s+person|"
    r"customer\s+care|support\s+person|escalat(?:e|ion))\b",
    re.IGNORECASE,
)

app = FastAPI(
    title="negotiation_bot2",
    description=(
        "Single-file debt-negotiation chatbot over live Debt_management_db "
        "accounts. Prompt-only enforcement — demo use."
    ),
    version="0.2.0",
)

# A browser UI on a different port cannot call this without CORS. Wide open by
# default because it is a demo on a laptop; set the env var to lock it down.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _client() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(500, "OPENAI_API_KEY is not set")
    return OpenAI(api_key=key)


def _session(session_id: str) -> Session:
    session = SESSIONS.get(session_id)
    if session is None:
        session = _restore_session(session_id)
        SESSIONS[session_id] = session
    return session


def _restore_session(session_id: str) -> Session:
    """Rebuild hot model context from the durable session and transcript."""
    rows = _query(SESSION_SQL, {"session_id": session_id})
    if not rows:
        raise HTTPException(404, f"no session {session_id}")
    stored = rows[0]
    accounts = _query(
        ACCOUNT_SQL,
        {
            "account_id": None,
            "customer_id": None,
            "subscriber_no": None,
            "account_code": stored["account_id"],
        },
    )
    if not accounts:
        raise HTTPException(404, f"account for session {session_id} no longer exists")
    acct = accounts[0]
    disputes = _query(DISPUTES_SQL, {"account_id": acct["account_id"]})
    ptps = _query(PTP_SQL, {"account_id": acct["account_id"]})
    dossier, negotiable = _build_dossier(acct, disputes, ptps)
    history: list[dict[str, str]] = []
    for item in _stored_messages(session_id):
        if item["speaker"] == "debtor":
            history.append({"role": "user", "content": item["dialogue"]})
        elif item["speaker"] == "collector":
            history.append({"role": "assistant", "content": item["dialogue"]})
    return Session(
        session_id=session_id,
        customer_name=acct["customer_name"],
        account_code=acct["account_code"],
        outstanding=float(acct["outstanding"]),
        disputed=float(sum(Decimal(str(d["amount"])) for d in disputes)) if disputes else 0,
        negotiable_balance=float(negotiable),
        dossier=dossier,
        started_at=stored["created_at"].isoformat(),
        history=history,
        agreement=Agreement.model_validate(stored["agreement"])
        if stored["agreement"] else None,
        closed=stored["status"] != "open",
        outcome=stored["status"] if stored["status"] != "open" else "in_progress",
    )


def _cash_value(session: Session, agreement: Agreement | None) -> float | None:
    """What the agreed plan actually collects, in money."""
    if agreement is None:
        return None
    return round(
        session.negotiable_balance * (1 - agreement.disc_ratio / 100),
        2,
    )


def _generate(session: Session) -> dict[str, Any]:
    """One collector turn. The whole model interaction lives here."""
    system = SYSTEM_PROMPT.format(
        agent_name=AGENT_NAME,
        creditor=CREDITOR,
        today=date.today().isoformat(),
        dossier=session.dossier,
    )
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    messages.extend(session.history)

    request: dict[str, Any] = {
        "model": MODEL,
        "messages": messages,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "collector_turn",
                "strict": True,
                "schema": TURN_SCHEMA,
            },
        },
    }
    # Some newer models reject `temperature` outright rather than ignoring it,
    # so a negative value is the opt-out.
    if TEMPERATURE >= 0:
        request["temperature"] = TEMPERATURE

    try:
        completion = _client().chat.completions.create(**request)
    except APIError as exc:  # network, auth, rate limit, bad model id
        raise HTTPException(502, f"model call failed: {exc}") from exc

    content = completion.choices[0].message.content or ""
    try:
        parsed: dict[str, Any] = json.loads(content)
    except ValueError as exc:
        raise HTTPException(502, "model returned unparseable output") from exc
    return parsed


def _apply(session: Session, parsed: dict[str, Any]) -> TurnResponse:
    """Record the turn and decide whether the conversation is over."""
    session.history.append({"role": "assistant", "content": parsed["dialogue"]})

    if parsed.get("agreement") is not None:
        session.agreement = Agreement.model_validate(parsed["agreement"])

    action = parsed["action"]
    reached = bool(parsed["agreement_reached"]) and session.agreement is not None
    turns = len([m for m in session.history if m["role"] == "assistant"])

    if action == "escalate":
        session.closed, session.outcome = True, "escalated"
    elif reached:
        session.closed, session.outcome = True, "agreement"
    elif turns >= MAX_TURNS:
        session.closed, session.outcome = True, "max_turns"

    _persist_turn(
        session.session_id,
        speaker="collector",
        dialogue=parsed["dialogue"],
        strategy=parsed["strategy"],
        action=action,
        thoughts=parsed["thoughts"],
        proposed=session.agreement.model_dump() if session.agreement else None,
    )
    _persist_outcome(session, action, parsed["dialogue"])

    return TurnResponse(
        session_id=session.session_id,
        customer_name=session.customer_name,
        negotiable_balance=session.negotiable_balance,
        turn=turns,
        strategy=parsed["strategy"],
        action=action,
        dialogue=parsed["dialogue"],
        agreement=session.agreement,
        agreement_value=_cash_value(session, session.agreement),
        agreement_reached=reached,
        closed=session.closed,
        thoughts=parsed["thoughts"],
        escalation_status=_escalation_status(session.session_id),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model": MODEL,
        "api_key_present": bool(os.getenv("OPENAI_API_KEY")),
        "database_configured": bool(DSN),
        "sessions": len(SESSIONS),
    }


@app.get("/targets", response_model=list[Target])
def list_targets(limit: int = 10, risk_level: str | None = "Critical") -> list[Target]:
    """The Priority Targets grid: accounts ranked by money at risk."""
    rows = _query(TARGETS_SQL, {"limit": limit, "risk_level": risk_level})
    return [
        Target(
            account_id=r["account_id"],
            account_code=r["account_code"],
            subscriber_no=r["subscriber_no"],
            customer_id=r["customer_id"],
            customer_name=r["customer_name"],
            outstanding=float(r["outstanding"]),
            dpd=r["dpd"],
            risk_level=r["risk_level"],
            behaviour_profile=r["behaviour_profile"],
            recovery_probability=float(r["recovery_probability"])
            if r["recovery_probability"] is not None
            else None,
            money_at_risk=float(r["money_at_risk"]),
            case_status=r["case_status"],
            next_action=r["next_followup_date"],
        )
        for r in rows
    ]


@app.post("/sessions", response_model=TurnResponse)
def start_session(req: StartRequest) -> TurnResponse:
    """Open a call against a real account, returning the collector's first turn."""
    selector = req.model_dump()
    supplied = {k: v for k, v in selector.items() if v is not None}
    if not supplied:
        raise HTTPException(
            422,
            "identify the account by account_id, customer_id, subscriber_no, "
            "or account_code",
        )
    # The selectors are AND-ed in SQL, so sending several placeholder values
    # (as the docs page used to prefill) matches nothing. Say so plainly.
    if len(supplied) > 1:
        raise HTTPException(
            422,
            f"send exactly one selector, got {sorted(supplied)} — "
            f"they are combined with AND, so extra fields exclude every account",
        )

    rows = _query(ACCOUNT_SQL, selector)
    if not rows:
        raise HTTPException(404, f"no account matching {supplied}")
    acct = rows[0]

    disputes = _query(DISPUTES_SQL, {"account_id": acct["account_id"]})
    ptps = _query(PTP_SQL, {"account_id": acct["account_id"]})
    dossier, negotiable = _build_dossier(acct, disputes, ptps)

    session = Session(
        session_id=f"sess_{uuid.uuid4().hex[:20]}",
        customer_name=acct["customer_name"],
        account_code=acct["account_code"],
        outstanding=float(acct["outstanding"]),
        disputed=float(sum(Decimal(str(d["amount"])) for d in disputes))
        if disputes
        else 0.0,
        negotiable_balance=float(negotiable),
        dossier=dossier,
        started_at=datetime.now(UTC).isoformat(),
    )
    session.history.append(
        {
            "role": "user",
            "content": "[The customer has answered the call and has not spoken "
            "yet. Open the conversation.]",
        }
    )
    SESSIONS[session.session_id] = session
    _persist_session(session, acct)
    return _apply(session, _generate(session))


@app.post("/sessions/{session_id}/messages", response_model=TurnResponse)
def send_message(session_id: str, req: MessageRequest) -> TurnResponse:
    """Store the customer's reply and answer with bot or human handoff state."""
    session = _session(session_id)
    if session.closed:
        if session.outcome != "escalated":
            raise HTTPException(409, f"session is closed: {session.outcome}")
        # The bot is deliberately silent after handoff. Customer messages keep
        # entering the same transcript for the human agent to read and answer.
        _persist_turn(
            session_id,
            speaker="debtor",
            dialogue=req.message,
            action="human_handoff",
        )
        return TurnResponse(
            session_id=session.session_id,
            customer_name=session.customer_name,
            negotiable_balance=session.negotiable_balance,
            turn=len([m for m in session.history if m["role"] == "assistant"]),
            strategy="ESTABLISH_TRUST",
            action="escalate",
            dialogue="",
            agreement=session.agreement,
            agreement_value=_cash_value(session, session.agreement),
            agreement_reached=False,
            closed=True,
            thoughts="Human agent owns the conversation.",
            escalation_status=_escalation_status(session_id),
        )
    session.history.append({"role": "user", "content": req.message})
    _persist_turn(session_id, speaker="debtor", dialogue=req.message)

    # A direct request for a person is deterministic and never sent back to the
    # model. This guarantees that the bot stops at the requested boundary.
    if HUMAN_HANDOFF_PATTERN.search(req.message):
        return _apply(session, {
            "thoughts": "The customer explicitly requested a human agent.",
            "strategy": "ESTABLISH_TRUST",
            "action": "escalate",
            "dialogue": (
                "I’m transferring this conversation to a support agent now. "
                "They can see our full chat, so you won’t need to repeat yourself."
            ),
            "agreement": session.agreement.model_dump() if session.agreement else None,
            "agreement_reached": False,
        })
    return _apply(session, _generate(session))


@app.get("/sessions/{session_id}/messages", response_model=LiveTranscriptResponse)
def get_live_messages(session_id: str) -> LiveTranscriptResponse:
    """Polling contract shared by the client after a human takes over."""
    session = _session(session_id)
    stored = _stored_messages(session_id)
    session_status = "escalated" if session.outcome == "escalated" else (
        "closed" if session.closed else "open"
    )
    return LiveTranscriptResponse(
        session_id=session_id,
        status=session_status,
        escalation_status=_escalation_status(session_id),
        messages=[StoredMessage(
            id=row["id"], index=row["index"], speaker=row["speaker"],
            dialogue=row["dialogue"], created_at=row["created_at"].isoformat(),
        ) for row in stored],
    )


@app.get("/sessions/{session_id}", response_model=TranscriptResponse)
def get_transcript(session_id: str) -> TranscriptResponse:
    session = _session(session_id)
    stored = _stored_messages(session_id)
    return TranscriptResponse(
        session_id=session.session_id,
        customer_name=session.customer_name,
        account_code=session.account_code,
        outstanding=session.outstanding,
        disputed=session.disputed,
        negotiable_balance=session.negotiable_balance,
        started_at=session.started_at,
        turns=len([m for m in session.history if m["role"] == "assistant"]),
        closed=session.closed,
        outcome=session.outcome,
        agreement=session.agreement,
        agreement_value=_cash_value(session, session.agreement),
        messages=[{
            "role": (
                "user" if row["speaker"] == "debtor"
                else "agent" if row["speaker"] == "agent"
                else "assistant"
            ),
            "content": row["dialogue"],
        } for row in stored],
        dossier=session.dossier,
    )


@app.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str) -> None:
    _session(session_id)
    del SESSIONS[session_id]
