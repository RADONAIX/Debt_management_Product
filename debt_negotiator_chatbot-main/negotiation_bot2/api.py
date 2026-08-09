"""negotiation_bot2 — a single-file debt-negotiation chatbot API.

Standalone sandbox. It shares nothing with ``src/``: no policy engine,
guardrail layer, or gateway. One OpenAI key, one Postgres connection, one
system prompt, one file.

Account facts are read live from ``customer_schema`` in Debt_management_db —
the same ``risk_grid_account_view`` that backs the Priority Targets grid — so a
session opens against a real customer rather than hand-typed figures.
Conversation state is written to ``chatbot``. Customer data is read-only with
one deliberate exception: a closed deal books a promise into
``customer_schema.ptp``, because an agreement that exists only in a transcript
never reaches the collections floor.

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
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any, Literal

import psycopg
from fastapi import BackgroundTasks, FastAPI, HTTPException
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

# chatbot.turns and chatbot.sessions are shared with the Assure+ engagement
# centre, and it seeds transcripts in its own vocabulary: speaker `bot`/`user`
# where this file writes `collector`/`debtor`, and an upper-case session status.
# Read both and keep writing ours. A conversation this bot cannot resume is one
# the handoff cannot hand back, which is exactly the demo's live moment.
# administration.master_data CHANNEL codes, which customer_schema.ptp has a
# foreign key onto. A promise has to say where it was taken.
PTP_CHANNEL = {"voice": "Voicebot", "chat": "Chat"}

BOT_SPEAKERS = frozenset({"collector", "bot", "assistant"})
CUSTOMER_SPEAKERS = frozenset({"debtor", "user", "customer"})
AGENT_SPEAKERS = frozenset({"agent", "human_agent"})


def _role(speaker: str | None) -> str:
    """Map either transcript vocabulary onto the roles this API exposes."""
    name = (speaker or "").lower()
    if name in CUSTOMER_SPEAKERS:
        return "user"
    if name in AGENT_SPEAKERS:
        return "agent"
    return "assistant"

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

# What we have already said to them. Without this the bot negotiates blind: it
# cannot answer "I got a text about a bill" and will contradict, or pointlessly
# repeat, a message the customer is holding in their hand.
ACTIVITY_SQL = """
select occurred_at::date as on_date, activity_type, direction, channel_code,
       subject, body, outcome
from customer_schema.case_activity
where account_id = %(account_id)s
order by occurred_at desc
limit 5
"""

# A promise is booked against the live case when there is one, so it shows up
# on the case timeline rather than floating loose on the account.
OPEN_CASE_SQL = """
select id
from customer_schema.debt_case
where account_id = %(account_id)s and status <> 'CLOSED'
order by opened_at desc
limit 1
"""

PTP_SQL = """
select ptp_code, promised_amount, promised_date, instalment_count, kept_amount, status
from customer_schema.ptp
where account_id = %(account_id)s
order by promised_date
"""

SESSION_SQL = """
select id, account_id, principal, days_overdue, status, agreement, ledger,
       created_at
from chatbot.sessions
where id = %(session_id)s
"""

TRANSCRIPT_SQL = """
select id, index, speaker, dialogue, created_at
from chatbot.turns
where session_id = %(session_id)s
order by index, id
"""

# The handoff brief needs more than the transcript view: the strategy labels
# show how the call was run, and the turn index locates the escalation.
HANDOFF_TURNS_SQL = """
select index, speaker, strategy, action, dialogue, created_at
from chatbot.turns
where session_id = %(session_id)s
order by index, id
"""

# `to_jsonb(e) -> 'summary'` reads as NULL rather than erroring when the column
# is absent, so this works both before and after the summary migration.
ESCALATION_SQL = """
select turn_index, trigger, detail, status, created_at,
       to_jsonb(e) -> 'summary' as summary
from chatbot.escalations e
where session_id = %(session_id)s
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
                        "channel": session.channel,
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


def _persist_outcome(
    session: "Session",
    action: str,
    detail: str = "",
    trigger: str = "model_escalated",
) -> None:
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
                    values (%s, %s, %s, %s, 0)
                    on conflict (session_id) do update set
                        trigger = excluded.trigger,
                        detail = excluded.detail,
                        status = case
                            when chatbot.escalations.status = 2 then 2 else 0
                        end
                    """,
                    (session.session_id, turn_index, trigger, detail),
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


def _escalation_row(session_id: str) -> dict[str, Any] | None:
    rows = _query(ESCALATION_SQL, {"session_id": session_id})
    return rows[0] if rows else None


def _persist_summary(session_id: str, summary: dict[str, Any]) -> None:
    """Store the handover brief on the escalation the agent console reads.

    Deliberately swallows its errors. A missing ``summary`` column — the state
    before the migration lands — or a database that blinks must never take down
    a live handoff, and ``GET /sessions/{id}/handoff`` rebuilds the brief on
    demand when nothing was stored.
    """
    try:
        with psycopg.connect(DSN, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute(
                "update chatbot.escalations set summary = %s where session_id = %s",
                (json.dumps(summary), session_id),
            )
    except psycopg.Error:
        return


# ---------------------------------------------------------------------------
# Dossier — turning database rows into prompt facts
# ---------------------------------------------------------------------------


def _money(value: Decimal | float | None, currency: str = "$") -> str:
    return "unknown" if value is None else f"{currency}{Decimal(str(value)):,.2f}"


def _cents(value: Decimal) -> float:
    """Round to the cent the way money is quoted — half up, not half to even.

    ``round()`` would turn an instalment of exactly 243.125 into 243.12, which
    is not the figure an agent reading the brief would say out loud.
    """
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _build_dossier(
    acct: dict[str, Any],
    disputes: list[dict[str, Any]],
    ptps: list[dict[str, Any]],
    activity: list[dict[str, Any]] | None = None,
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

    if activity:
        lines += [
            "",
            "## WHAT WE HAVE ALREADY SENT THEM (most recent first)",
            "They have seen these. Do not repeat one back at them as though it "
            "were news, and do not contradict it.",
        ]
        for item in activity:
            body = " ".join((item.get("body") or "").split())
            lines.append(
                f"  {item['on_date']} · {item['direction'].lower()} "
                f"{item['activity_type']} on {item.get('channel_code')} · "
                f"{item.get('subject')}"
                + (f" · {item.get('outcome')}" if item.get("outcome") else "")
            )
            if body:
                lines.append(f'      "{body[:220]}"')

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
# Channel — who established identity, and therefore how the first turn opens
# ---------------------------------------------------------------------------

# On the phone the bot dialled out and cannot know who picked up, so it must
# verify before disclosing anything. In the engagement centre the customer
# opened the chat from inside their own authenticated account, so the same
# verification turn is dead weight — it burns the opening and reads as a
# machine failing to recognise someone who just logged in.
CHANNEL_BRIEFS = {
    "voice": """\
# CHANNEL — outbound phone call
You dialled them and do not know who answered. Confirm you are speaking to the
account holder BEFORE you disclose the balance or any account detail. Naming
the debt to the wrong person is a serious breach. If they will not confirm,
keep the account details to yourself and close the call politely.""",
    "chat": """\
# CHANNEL — inbound web chat, identity already established
They opened this chat from inside their own account, so you already know who
they are. Do NOT ask them to confirm their identity and do not spend a turn on
verification — it is already done, and asking reads as a machine that cannot
see who just logged in. Greet them by first name, state the balance plainly,
and put a concrete way forward in the very first message. Keep every message
short: this is a chat window, and a wall of text does not get read.""",
}

# What the model is told before it speaks first, per channel.
OPENING_CUE = {
    "voice": (
        "[The customer has answered the call and has not spoken yet. "
        "Open the conversation.]"
    ),
    "chat": (
        "[The customer has just opened a chat from their account and has not "
        "typed anything yet. Open with their balance and a concrete offer of "
        "help, in two sentences.]"
    ),
}


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are {agent_name}, a professional debt-collection negotiator employed by
{creditor}. You are talking to a customer whose account is delinquent. Your job
is to reach a concrete, affordable, fully-specified repayment agreement — not
to punish, shame, or read policy at them.

Today's date is {today}.

{channel_brief}

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
# Handoff brief — what the human agent reads before taking the conversation
# ---------------------------------------------------------------------------

HANDOFF_SYSTEM_PROMPT = """\
You are writing a handover note for a human debt-collection agent who is about
to take over a live conversation from an automated negotiator. They will read
it in the seconds before they type their first message. Assume they know the
job and nothing about this call.

You are given the account dossier the bot worked from, the full transcript, and
why the conversation was handed over.

RULES
- Report only what is in the transcript or the dossier. If the customer never
  said what they earn, do not infer it. No invented figures, no guesses, no
  filling of gaps with what a customer like this usually says.
- For anything the customer claimed, stay close to their own words. The agent
  needs to know what was actually said to them, not your reading of it.
- commitments_made is the highest-stakes field. Anything the bot offered,
  conceded, or promised now binds the agent, who cannot walk it back without
  losing the customer. Put terms in money, not only percentages. Empty list if
  the bot committed to nothing.
- cautions is what the agent must NOT do: a ring-fenced dispute they must not
  argue, distress or vulnerability, a legal representative now involved, a line
  the bot already tried that failed and would irritate on a second outing.
- Never present an internal score (risk, cooperation, responsibility,
  contactability, recovery probability) as something to say to the customer.
  The agent may see them; the customer must never hear them.
- Plain factual sentences. This is an internal note, not customer-facing copy.
  No greetings, no sign-off, no encouragement.
"""

HANDOFF_NARRATIVE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "headline",
        "what_happened",
        "customer_position",
        "disclosed_facts",
        "commitments_made",
        "open_threads",
        "cautions",
        "suggested_next_step",
    ],
    "properties": {
        "headline": {
            "type": "string",
            "description": "One line, under 120 characters: who, what they owe, "
            "and why this landed in the queue.",
        },
        "what_happened": {
            "type": "string",
            "description": "Two to four sentences on how the call went.",
        },
        "customer_position": {
            "type": "string",
            "description": "What the customer said they can and cannot do, in "
            "their terms. 'Not stated' if they never said.",
        },
        "disclosed_facts": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Concrete things the customer volunteered: pay dates, "
            "income, job change, other debts. Transcript only.",
        },
        "commitments_made": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Every offer or concession the bot put on the table, "
            "in money. Empty if none.",
        },
        "open_threads": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Questions asked and never answered; anything left "
            "hanging when the bot stepped back.",
        },
        "cautions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "What the agent must not do or say on this account.",
        },
        "suggested_next_step": {
            "type": "string",
            "description": "The single most useful opening move for the agent.",
        },
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

    # "chat" is the AI Engagement Center: the customer is already signed in, so
    # the bot skips verification and opens on the balance. "voice" keeps the
    # outbound-call behaviour, where it must verify first.
    channel: Literal["voice", "chat"] = "voice"


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
    ptp_code: str | None = None
    ptp_error: str | None = None


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


class HandoffNarrative(BaseModel):
    """The model-written half of the brief. Absent if the call failed."""

    headline: str
    what_happened: str
    customer_position: str
    disclosed_facts: list[str] = Field(default_factory=list)
    commitments_made: list[str] = Field(default_factory=list)
    open_threads: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    suggested_next_step: str


class HandoffSummary(BaseModel):
    """Everything the human agent needs to take over the conversation.

    Extra keys are ignored rather than forbidden: a brief written by an earlier
    build is read back out of the database long after it was stored, and a
    field added since must not turn an old row into a 500.
    """

    session_id: str
    generated_at: str

    # Why the bot stopped.
    trigger: str
    trigger_message: str
    escalated_at_turn: int | None = None
    escalation_status: int | None = None

    # Who and how much.
    customer_name: str
    account_code: str
    outstanding: float
    disputed: float
    negotiable_balance: float
    days_overdue: int

    # Where the negotiation stood when it stopped.
    turns: int
    strategies_used: list[str] = Field(default_factory=list)
    agreement: Agreement | None = None
    agreement_value: float | None = None
    agreement_in_money: dict[str, float] | None = None

    narrative: HandoffNarrative | None = None
    narrative_error: str | None = None


class Session(BaseModel):
    """Hot session state; the authoritative transcript is persisted in Postgres."""

    model_config = ConfigDict(extra="forbid")

    session_id: str
    customer_id: int = 0
    account_id: int = 0
    customer_name: str
    account_code: str
    outstanding: float
    disputed: float
    negotiable_balance: float
    days_overdue: int = 0
    channel: Literal["voice", "chat"] = "voice"
    dossier: str
    started_at: str
    history: list[dict[str, str]] = Field(default_factory=list)
    agreement: Agreement | None = None
    closed: bool = False
    outcome: str = "in_progress"


SESSIONS: dict[str, Session] = {}

# Deterministic handoff boundaries. These are evaluated in code, on the raw
# customer message, before the model is ever called — a prompt rule is guidance
# and would be argued with, and these two boundaries are not negotiable.
# CLAUDE.md law 2.

# Legal representation. Checked first: it is the narrower and more consequential
# claim, and once a lawyer is acting the bot must not negotiate at all. A bare
# noun match is safe here because these words have no benign use in a
# collections call, and only the customer's own words are scanned.
LEGAL_REPRESENTATION_PATTERN = re.compile(
    r"\b(?:lawyer|solicitor|attorney|barrister|counsel)s?\b"
    r"|\blegal\s+(?:team|rep|representative|advis[eo]r|counsel|aid|"
    r"representation)\b"
    r"|\b(?:my|our|his|her|their|the)\s+advocates?\b",
    re.IGNORECASE,
)

# A request for a person. The nouns stay broad — a customer who types nothing
# but "agent" means it — so the false positives are subtracted instead, below.
AGENT_REQUEST_PATTERN = re.compile(
    r"\b(?:agent|human|representative|supervisor|manager|"
    r"live\s+person|real\s+person|customer\s+care|customer\s+service|"
    r"support\s+person|escalat(?:e|ion))\b",
    re.IGNORECASE,
)

# Nouns that only mean a person when they are being asked for. "I want to talk
# to someone about it" is the handoff line the demo script itself uses; "someone
# stole my card" is a disclosure. These need the asking to be visible, so unlike
# the nouns above they are matched with their verb.
VAGUE_AGENT_REQUEST_PATTERN = re.compile(
    r"\b(?:talk|speak|deal|discuss|connect|transfer|refer\s+me|chat|"
    r"put\s+me\s+through)\b[^.?!]{0,30}?"
    r"\b(?:some(?:one|body)|a\s+person|another\s+person|anyone\s+else)\b"
    r"|\b(?:i\s+want|i\s+need|i['\u2019]?d\s+like|can\s+i|could\s+i|let\s+me|"
    r"get\s+me|give\s+me)\b[^.?!]{0,30}?\bsome(?:one|body)\b",
    re.IGNORECASE,
)

# Phrases that contain a trigger noun but are not a request for one: the
# customer's own employer, or a turn of phrase. They are stripped from the
# message before the pattern above runs, so "I'll ask my manager, but just get
# me a human" still escalates while "I'll ask my manager for an advance" — a
# disclosure about their income — does not.
BENIGN_MENTION_PATTERN = re.compile(
    r"\b(?:my|our)\s+(?:manager|supervisor|boss)\b"
    # Both apostrophes: phones autocorrect the one in "I'm" to a curly quote.
    r"|\b(?:i\s*['\u2019]?m|i\s+am|we\s+are|only)\s+human\b"
    r"|\bhuman\s+being\b"
    r"|\bhuman\s+error\b",
    re.IGNORECASE,
)


def _handoff_trigger(message: str) -> str | None:
    """Which deterministic handoff rule this customer message fires, if any."""
    if LEGAL_REPRESENTATION_PATTERN.search(message):
        return "legal_representation"
    scrubbed = BENIGN_MENTION_PATTERN.sub(" ", message)
    if AGENT_REQUEST_PATTERN.search(scrubbed) or VAGUE_AGENT_REQUEST_PATTERN.search(
        scrubbed
    ):
        return "customer_requested_agent"
    return None


# What the customer hears as the bot steps back. Short, no offer, no argument.
HANDOFF_DIALOGUE = {
    "legal_representation": (
        "Understood — if you have someone acting for you legally, I'll stop "
        "here. I'm passing this to a colleague who will take it from you "
        "directly. They can see everything we've discussed."
    ),
    "customer_requested_agent": (
        "I’m transferring this conversation to a support agent now. "
        "They can see our full chat, so you won’t need to repeat yourself."
    ),
}

HANDOFF_THOUGHTS = {
    "legal_representation": (
        "The customer indicated legal representation. Negotiation stops here; "
        "a human owns any further contact."
    ),
    "customer_requested_agent": "The customer explicitly requested a human agent.",
}

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
    activity = _query(ACTIVITY_SQL, {"account_id": acct["account_id"]})
    dossier, negotiable = _build_dossier(acct, disputes, ptps, activity)
    history: list[dict[str, str]] = []
    for item in _stored_messages(session_id):
        # A human agent's replies are part of what this customer has been told,
        # so they carry into context as things "we" said, even though the bot
        # did not say them.
        history.append(
            {"role": _role(item["speaker"]).replace("agent", "assistant"),
             "content": item["dialogue"]}
        )
    # The seed writes RESOLVED/ESCALATED; this file writes open/closed/agreed.
    status = (stored["status"] or "open").lower()
    return Session(
        session_id=session_id,
        customer_id=int(acct["customer_id"]),
        account_id=int(acct["account_id"]),
        customer_name=acct["customer_name"],
        account_code=acct["account_code"],
        outstanding=float(acct["outstanding"]),
        disputed=float(sum(Decimal(str(d["amount"])) for d in disputes)) if disputes else 0,
        negotiable_balance=float(negotiable),
        days_overdue=int(stored["days_overdue"] or 0),
        # Seeded sessions carry no ledger of ours; they were engagement-centre
        # chats, but the bot is silent on them anyway once a human has them.
        channel=(stored["ledger"] or {}).get("channel", "voice"),
        dossier=dossier,
        started_at=stored["created_at"].isoformat(),
        history=history,
        agreement=Agreement.model_validate(stored["agreement"])
        if stored["agreement"] else None,
        closed=status != "open",
        outcome=status if status != "open" else "in_progress",
    )


def _cash_value(session: Session, agreement: Agreement | None) -> float | None:
    """What the agreed plan actually collects, in money."""
    if agreement is None:
        return None
    return _cents(
        Decimal(str(session.negotiable_balance))
        * (1 - Decimal(agreement.disc_ratio) / 100)
    )


def _generate(session: Session) -> dict[str, Any]:
    """One collector turn. The whole model interaction lives here."""
    system = SYSTEM_PROMPT.format(
        agent_name=AGENT_NAME,
        creditor=CREDITOR,
        today=date.today().isoformat(),
        channel_brief=CHANNEL_BRIEFS[session.channel],
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


def _agreement_in_money(
    session: Session, agreement: Agreement | None
) -> dict[str, float] | None:
    """The four ratio fields spelled out in currency, so nobody re-derives them."""
    if agreement is None:
        return None
    balance = Decimal(str(session.negotiable_balance))
    collected = balance * (1 - Decimal(agreement.disc_ratio) / 100)
    upfront = collected * Decimal(agreement.pmt_ratio) / 100
    remainder = collected - upfront
    return {
        # Same formula and rounding as _cash_value, so this can never disagree
        # with the agreement_value the turn responses already report.
        "total_collected": _cents(collected),
        "written_off": _cents(balance - collected),
        "upfront": _cents(upfront),
        "upfront_due_in_days": float(agreement.pmt_days),
        "remainder": _cents(remainder),
        "monthly": _cents(remainder / agreement.inst_prds),
        "months": float(agreement.inst_prds),
    }


def _persist_ptp(
    session: Session, agreement: Agreement
) -> tuple[str | None, str | None]:
    """Book the closed deal as a promise to pay. Returns ``(code, error)``.

    This is the one place the bot writes outside the ``chatbot`` schema. A deal
    that exists only in a transcript is not a deal: the collections floor works
    the promise queue, the kept/broken rate is computed from it, and Journey B
    in the demo script ends on exactly this row being written.

    The code is derived from the session id rather than a sequence, so a retry
    updates the same promise instead of booking a second one against the
    customer. Never raises — the customer has already been told the plan is
    agreed, and failing the turn afterwards would leave the two disagreeing.
    """
    money = _agreement_in_money(session, agreement)
    if money is None:  # unreachable: agreement is non-None here
        return None, None

    code = f"PTP-BOT-{session.session_id.removeprefix('sess_')[:10]}"
    case_rows = _query(OPEN_CASE_SQL, {"account_id": session.account_id})
    notes = (
        f"Agreed with the negotiation bot ({session.channel}) in session "
        f"{session.session_id}: {agreement.disc_ratio}% discount, "
        f"${money['upfront']:,.2f} upfront within {agreement.pmt_days} days, "
        f"then ${money['monthly']:,.2f} a month for {agreement.inst_prds} months."
    )
    try:
        with psycopg.connect(DSN, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into customer_schema.ptp
                    (ptp_code, customer_id, account_id, case_id, promised_amount,
                     promised_date, instalment_count, kept_amount, status,
                     channel_code, notes)
                values (%s, %s, %s, %s, %s, current_date + %s, %s, 0, 'PENDING',
                        %s, %s)
                on conflict (ptp_code) do update set
                    promised_amount = excluded.promised_amount,
                    promised_date = excluded.promised_date,
                    instalment_count = excluded.instalment_count,
                    case_id = excluded.case_id,
                    notes = excluded.notes,
                    updated_at = now()
                """,
                (
                    code,
                    session.customer_id,
                    session.account_id,
                    case_rows[0]["id"] if case_rows else None,
                    money["total_collected"],
                    agreement.pmt_days,
                    # The upfront payment plus one per instalment month: what
                    # the customer actually has to do, not a single lump.
                    1 + agreement.inst_prds,
                    PTP_CHANNEL[session.channel],
                    notes[:500],
                ),
            )
    except (psycopg.Error, HTTPException) as exc:
        return None, f"{type(exc).__name__}: {exc}"
    return code, None


def _handoff_facts(session: Session) -> dict[str, Any]:
    """The half of the brief that is arithmetic and transcript, never inference.

    Built entirely from data already in hand, so it cannot be wrong and cannot
    fail. The model's narrative is layered on top of this, never in place of it.
    """
    turns = _query(HANDOFF_TURNS_SQL, {"session_id": session.session_id})
    escalation = _escalation_row(session.session_id) or {}
    escalated_at = escalation.get("turn_index")

    # What tipped it: the last thing the customer said before the bot's closing
    # turn. On a model-initiated escalation that is still the relevant message.
    trigger_message = ""
    for row in turns:
        if (row["speaker"] or "").lower() not in CUSTOMER_SPEAKERS:
            continue
        if escalated_at is not None and row["index"] > escalated_at:
            break
        trigger_message = row["dialogue"]

    strategies: list[str] = []
    for row in turns:
        label = row.get("strategy")
        if label and label not in strategies:
            strategies.append(label)

    return {
        "session_id": session.session_id,
        "generated_at": datetime.now(UTC).isoformat(),
        "trigger": escalation.get("trigger") or "model_escalated",
        "trigger_message": trigger_message,
        "escalated_at_turn": escalated_at,
        "escalation_status": escalation.get("status"),
        "customer_name": session.customer_name,
        "account_code": session.account_code,
        "outstanding": session.outstanding,
        "disputed": session.disputed,
        "negotiable_balance": session.negotiable_balance,
        "days_overdue": session.days_overdue,
        "turns": sum(
            1 for row in turns if (row["speaker"] or "").lower() in BOT_SPEAKERS
        ),
        "strategies_used": strategies,
        "agreement": session.agreement.model_dump() if session.agreement else None,
        "agreement_value": _cash_value(session, session.agreement),
        "agreement_in_money": _agreement_in_money(session, session.agreement),
        "narrative": None,
        "narrative_error": None,
    }


def _generate_narrative(
    session: Session, facts: dict[str, Any]
) -> tuple[dict[str, Any] | None, str | None]:
    """One model call for the readable half of the brief.

    Returns ``(narrative, error)`` and never raises. A handoff that has already
    happened must not be undone by a summariser that could not be reached.
    """
    transcript = "\n".join(
        f"{'CUSTOMER' if m['role'] == 'user' else 'BOT'}: {m['content']}"
        for m in session.history
    )
    money = facts["agreement_in_money"]
    handover = (
        f"Handover reason: {facts['trigger']}\n"
        f"The customer's last message before handover: "
        f"\"{facts['trigger_message']}\"\n"
        f"Collector turns taken: {facts['turns']}\n"
        f"Terms on the table at handover: "
        f"{json.dumps(money) if money else 'none'}"
    )
    request: dict[str, Any] = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": HANDOFF_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"# ACCOUNT DOSSIER\n{session.dossier}\n\n"
                    f"# HANDOVER\n{handover}\n\n"
                    f"# TRANSCRIPT\n{transcript}"
                ),
            },
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "handoff_brief",
                "strict": True,
                "schema": HANDOFF_NARRATIVE_SCHEMA,
            },
        },
    }
    if TEMPERATURE >= 0:
        request["temperature"] = TEMPERATURE

    try:
        completion = _client().chat.completions.create(**request)
        parsed = json.loads(completion.choices[0].message.content or "")
        return HandoffNarrative.model_validate(parsed).model_dump(), None
    except Exception as exc:  # a brief is never worth an outage
        return None, f"{type(exc).__name__}: {exc}"


def _complete_handoff_summary(session: Session, facts: dict[str, Any]) -> None:
    """Background half: add the narrative to the facts already persisted."""
    narrative, error = _generate_narrative(session, facts)
    _persist_summary(
        session.session_id,
        {**facts, "narrative": narrative, "narrative_error": error},
    )


def _apply(
    session: Session,
    parsed: dict[str, Any],
    *,
    trigger: str = "model_escalated",
    background: BackgroundTasks | None = None,
) -> TurnResponse:
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
    _persist_outcome(session, action, parsed["dialogue"], trigger)

    ptp_code: str | None = None
    ptp_error: str | None = None
    if reached and session.agreement is not None:
        ptp_code, ptp_error = _persist_ptp(session, session.agreement)

    if action == "escalate":
        # Write the facts immediately so the queue is never briefed with
        # nothing, then let the model fill in the narrative after the customer
        # has already been told they are being transferred. The agent has to
        # claim the conversation before they can read it, which is far longer
        # than the call takes.
        facts = _handoff_facts(session)
        _persist_summary(session.session_id, facts)
        if background is not None:
            background.add_task(_complete_handoff_summary, session, facts)

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
        ptp_code=ptp_code,
        ptp_error=ptp_error,
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
    """The Priority Targets grid: accounts ranked by money at risk.

    `?risk_level=` means every level. Without this an empty value reaches SQL as
    '' rather than NULL, matches no row, and the grid comes back empty — which
    reads as "no accounts at risk" rather than "you filtered them all out".
    """
    rows = _query(TARGETS_SQL, {"limit": limit, "risk_level": risk_level or None})
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
def start_session(req: StartRequest, background: BackgroundTasks) -> TurnResponse:
    """Open a call against a real account, returning the collector's first turn."""
    selector = req.model_dump(exclude={"channel"})
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
    activity = _query(ACTIVITY_SQL, {"account_id": acct["account_id"]})
    dossier, negotiable = _build_dossier(acct, disputes, ptps, activity)

    # Every percentage in the prompt applies to the negotiable balance, so at
    # zero the bot opens a call to discuss $0.00 and the whole offer table
    # collapses. A settled account is not a negotiation; say so instead.
    if negotiable <= 0:
        outstanding = Decimal(str(acct["outstanding"]))
        reason = (
            "the balance is settled"
            if outstanding <= 0
            else f"all {_money(outstanding)} of it is formally disputed"
        )
        raise HTTPException(
            422,
            f"account {acct['account_code']} has nothing to negotiate — {reason}",
        )

    session = Session(
        session_id=f"sess_{uuid.uuid4().hex[:20]}",
        customer_id=int(acct["customer_id"]),
        account_id=int(acct["account_id"]),
        customer_name=acct["customer_name"],
        account_code=acct["account_code"],
        outstanding=float(acct["outstanding"]),
        disputed=float(sum(Decimal(str(d["amount"])) for d in disputes))
        if disputes
        else 0.0,
        negotiable_balance=float(negotiable),
        days_overdue=int(acct.get("dpd") or 0),
        channel=req.channel,
        dossier=dossier,
        started_at=datetime.now(UTC).isoformat(),
    )
    session.history.append({"role": "user", "content": OPENING_CUE[req.channel]})
    SESSIONS[session.session_id] = session
    _persist_session(session, acct)
    return _apply(session, _generate(session), background=background)


@app.post("/sessions/{session_id}/messages", response_model=TurnResponse)
def send_message(
    session_id: str, req: MessageRequest, background: BackgroundTasks
) -> TurnResponse:
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

    # A request for a person, or any mention of legal representation, is decided
    # here and never sent back to the model. This is what guarantees the bot
    # stops at the boundary rather than negotiating its way past it.
    trigger = _handoff_trigger(req.message)
    if trigger is not None:
        return _apply(
            session,
            {
                "thoughts": HANDOFF_THOUGHTS[trigger],
                "strategy": "ESTABLISH_TRUST",
                "action": "escalate",
                "dialogue": HANDOFF_DIALOGUE[trigger],
                "agreement": session.agreement.model_dump()
                if session.agreement
                else None,
                "agreement_reached": False,
            },
            trigger=trigger,
            background=background,
        )
    return _apply(session, _generate(session), background=background)


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


@app.get("/sessions/{session_id}/handoff", response_model=HandoffSummary)
def get_handoff(session_id: str, refresh: bool = False) -> HandoffSummary:
    """The brief a human agent reads before taking over the conversation.

    Normally a read: the brief was written when the bot stepped back and is
    served from ``chatbot.escalations.summary``. It regenerates in place when
    asked to, and when the stored brief has no narrative — which is how a
    failed background call, or a summary column that does not exist yet, still
    ends up in front of the agent rather than as an empty panel.
    """
    session = _session(session_id)
    if session.outcome != "escalated":
        raise HTTPException(
            409,
            f"session has not been handed to a human (outcome: {session.outcome})",
        )

    stored = (_escalation_row(session_id) or {}).get("summary") if not refresh else None
    if stored and stored.get("narrative") is not None:
        return HandoffSummary.model_validate(stored)

    facts = _handoff_facts(session)
    narrative, error = _generate_narrative(session, facts)
    summary = {**facts, "narrative": narrative, "narrative_error": error}
    _persist_summary(session_id, summary)
    return HandoffSummary.model_validate(summary)


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
        messages=[
            {"role": _role(row["speaker"]), "content": row["dialogue"]}
            for row in stored
        ],
        dossier=session.dossier,
    )


@app.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str) -> None:
    _session(session_id)
    del SESSIONS[session_id]
