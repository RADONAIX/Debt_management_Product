# negotiation_bot2

A debt-negotiation chatbot in one file: [api.py](api.py).

Standalone. It imports nothing from `src/` — no policy engine, no guardrail
layer, no gateway. Just FastAPI, the OpenAI SDK, one Postgres connection, and
one large system prompt.

Account facts are read live from `customer_schema` in `Debt_management_db` —
the same `risk_grid_account_view` that backs the Priority Targets grid — so a
session opens against a real customer instead of hand-typed figures.
Conversations are durably written to `chatbot.sessions`, `chatbot.turns`, and
`chatbot.escalations` so the Assure+ AI Engagement Center can take over the
same transcript. Customer and account data are read-only apart from one row:
a closed deal books a promise into `customer_schema.ptp`.

## Run

Credentials come from the repo-root `.env` (`OPENAI_API_KEY`, `DATABASE_URL`),
loaded automatically. From the repository root:

```bash
uv run uvicorn api:app --app-dir negotiation_bot2 --reload --port 8000
```

Optional env: `NEGOTIATION_BOT2_MODEL` (default `gpt-5.4`),
`NEGOTIATION_BOT2_TEMPERATURE` (default `0.3`; negative omits the parameter for
models that reject it), `NEGOTIATION_BOT2_MAX_TURNS` (default `24`),
`NEGOTIATION_BOT2_CREDITOR`, `NEGOTIATION_BOT2_AGENT_NAME`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | model, key presence, DB configured, session count |
| `GET` | `/targets` | Priority Targets, ranked by money at risk |
| `POST` | `/sessions` | open a call or chat against an account, returns the first turn |
| `POST` | `/sessions/{id}/messages` | customer reply in, next collector turn out |
| `GET` | `/sessions/{id}/messages` | stored transcript; the polling contract after handoff |
| `GET` | `/sessions/{id}/handoff` | the brief a human agent reads before taking over |
| `GET` | `/sessions/{id}` | transcript, outcome, agreement, and the dossier used |
| `DELETE` | `/sessions/{id}` | drop the session |

Interactive docs at `http://localhost:8000/docs`.

## The three demo customers

`GET /targets` returns them in this order — `outstanding × (1 − recovery
probability)`, which reproduces the grid exactly.

| Customer | Subscriber | Outstanding | Disputed | **Negotiable** | DPD | Profile |
|---|---|---|---|---|---|---|
| Vikas Chandran | `+971580000633` | $2,457.00 | $512.00 | **$1,945.00** | 143 | High Value Risk |
| Rania Haddad | `+971580000422` | $2,070.92 | $224.00 | **$1,846.92** | 143 | High Value Risk |
| Faisal Al Nuaimi | `+971580000211` | $1,612.91 | $336.00 | **$1,276.91** | 171 | Strategic Defaulters |

Open a call on any of them:

```bash
curl -s localhost:8000/sessions -H 'content-type: application/json' \
  -d '{"subscriber_no":"+971580000633"}'
```

`account_id`, `customer_id`, and `account_code` also work as selectors.

## Voice or chat

`POST /sessions` takes a `channel`, and it changes only how the first turn
opens:

- **`voice`** (default) — an outbound call. The bot dialled out and does not
  know who answered, so it verifies the account holder before saying a balance.
  Disclosing the debt to whoever picked up the phone is a real breach.
- **`chat`** — the AI Engagement Center. The customer opened the chat from
  inside their own account, so identity is already established. Asking them to
  confirm it wastes the opening and reads as a machine that cannot see who just
  logged in, so the bot greets them by name and leads with the balance and a
  concrete plan.

Everything downstream — the ring-fence, concession discipline, the escalation
triggers — is identical. Only the opening differs.

```bash
curl -s localhost:8000/sessions -H 'content-type: application/json' \
  -d '{"subscriber_no":"+971501243283","channel":"chat"}'
```

Then:

```bash
curl -s localhost:8000/sessions/$SID/messages -H 'content-type: application/json' \
  -d '{"message":"Yeah, speaking. Who is this?"}'
```

Every turn returns:

```json
{
  "session_id": "…", "customer_name": "Vikas Chandran",
  "negotiable_balance": 1945.0, "turn": 4,
  "strategy": "REPAYMENT_NEGOTIATION", "action": "offer",
  "dialogue": "what the customer hears",
  "agreement": {"disc_ratio": 0, "pmt_ratio": 25, "pmt_days": 7, "inst_prds": 6},
  "agreement_value": 1945.0, "agreement_reached": false, "closed": false,
  "thoughts": "private reasoning — never show the customer"
}
```

The session closes on `accept`, on `escalate`, or at the turn cap.

## The demo-script customers

`docs/DEMO_SCRIPT.md` runs a separate trio through the whole Assure+ lifecycle.
Two of them negotiate; open both with `"channel":"chat"`, which is the surface
that script is describing.

| Customer | Line | Subscriber | Negotiable | DPD |
|---|---|---|---|---|
| Priya Raghavan | `ACC-10066` | `+971501243283` | $2,465.00 | 96 |
| Faisal Al Marzooqi (Meridian) | `ACC-20007` | `+971501259121` | $14,820.00 | 104 |
| Daniel Okafor | `ACC-10068` | `+971501251203` | $412.60 | 9 |

**Daniel's second line.** Journey B ends with his mobile line settled — *"$0,
Current, 0 DPD"* — which is the whole point of that story, so it cannot be
given a balance without breaking the screens the journey finishes on.
`ACC-10067` therefore still answers 422, *"nothing to negotiate — the balance
is settled"*. `071_daniel_second_line.sql` gives him a fibre line whose autopay
failed the same way, with a real unpaid invoice behind it, and that is what the
bot negotiates. The seeded "your card has expired" SMS is in the dossier, so
the bot explains the cause the way the script does instead of saying it cannot
see the card.

None of the three carries an open dispute, so the ring-fence below has nothing
to demonstrate on them. That story still needs the three customers above.

## When a deal closes, a promise is booked

`action: "accept"` writes one row to `customer_schema.ptp` and returns its
`ptp_code` on the turn. This is the only write the bot makes outside the
`chatbot` schema, and it is deliberate: an agreement that lives only in a
transcript never reaches the collections floor, never appears in the promise
queue, and never counts toward the kept-or-broken rate the whole operation is
measured on.

The four agreement fields map onto the row like this:

| Agreement | Promise |
|---|---|
| balance less `disc_ratio` | `promised_amount` — the whole arrangement |
| `pmt_days` | `promised_date` — when the upfront falls due |
| `inst_prds` | `instalment_count` = 1 upfront + one per month |
| channel | `channel_code` — `Chat` or `Voicebot` |

It is booked against the account's open case when there is one, so it lands on
the case timeline rather than floating loose. `pmt_ratio` and the monthly
figure are spelled out in `notes` alongside the session id.

The `ptp_code` is derived from the session id, not a sequence, so a retried
turn updates the same promise instead of booking a second one against the
customer. If the write fails the turn still succeeds — the customer has
already been told the plan is agreed, and failing afterwards would leave the
two disagreeing — and the reason comes back in `ptp_error`.

**A known gap:** `pmt_ratio` tops out at 50%, so a customer who agrees to
clear the balance in one payment cannot be recorded as having done so. The
grid has no "pay in full" value.

## The ring-fenced dispute

All three demo accounts carry open `ESCALATED` disputes. A strict reading of
"customer disputes the debt → hand to a human" would end every call on turn one.

So the disputed amount is treated as **ring-fenced**: already with the disputes
team, excluded from the balance, and not the bot's to argue. It says so plainly
and negotiates only the undisputed remainder — which is why the negotiable
balance is below the outstanding in the table above. It still escalates if the
customer disputes the *undisputed* balance or raises something new.

## Handing over to a human

Two things end the bot's involvement immediately, and both are decided in code
on the raw customer message, before the model is called at all:

| The customer says | Trigger |
|---|---|
| lawyer, solicitor, attorney, counsel, legal team, "my advocate" | `legal_representation` |
| agent, human, supervisor, representative, customer care, "escalate this" | `customer_requested_agent` |

These are the one place this folder does not trust the prompt. Both were listed
in the escalation rules the model is given, and a model under pressure argues
with a rule; a regex does not. The bot then goes silent — further customer
messages keep landing in `chatbot.turns` for the human to answer, and every
reply from the bot is empty.

The nouns are matched broadly, because a customer who types nothing but "agent"
means it. The false positives are subtracted instead: *"I'll ask my manager for
an advance"* is a disclosure about their income and does not hand over, while
*"I'll ask my manager, but just get me a human"* does.

### The brief

The moment the bot steps back it writes a handover brief to
`chatbot.escalations.summary`, where the Assure+ engagement centre already
reads the queue. `GET /sessions/{id}/handoff` serves the same object:

```json
{
  "trigger": "legal_representation",
  "trigger_message": "I'm not paying until I discuss this with my lawyer.",
  "customer_name": "Vikas Chandran", "negotiable_balance": 1945.0,
  "outstanding": 2457.0, "disputed": 512.0, "days_overdue": 143,
  "turns": 6, "strategies_used": ["IDENTITY_VERIFICATION", "FINANCIAL_ASSESSMENT"],
  "agreement": {"disc_ratio": 0, "pmt_ratio": 25, "pmt_days": 7, "inst_prds": 6},
  "agreement_in_money": {"upfront": 486.25, "monthly": 243.13, "months": 6},
  "narrative": {
    "headline": "…", "what_happened": "…", "customer_position": "…",
    "disclosed_facts": [], "commitments_made": [], "open_threads": [],
    "cautions": [], "suggested_next_step": "…"
  }
}
```

It is built in two halves, deliberately. Everything above `narrative` is
arithmetic and transcript — it cannot be wrong and cannot fail. `narrative` is
one model call, written after the customer has already been told they are being
transferred, so nobody waits on it. If that call fails the brief still arrives
with `narrative: null` and the reason in `narrative_error`. A handover that has
already happened is never undone by a summariser that could not be reached.

`commitments_made` is the field that matters most: anything the bot conceded
now binds the agent, who cannot walk it back without losing the customer.

Requires the `summary` column from `070_chat_handoff_summary.sql`. Without it
every write is swallowed and the brief is rebuilt on read instead — so the bot
runs correctly before and after that migration.

## What the bot is told

The prompt is assembled per session from the live account: balances, DPD,
payment history, promise-to-pay record, open disputes, the last five things we
sent them on any channel, occupation, income,
financial stress, emotional state, life event, cooperation and contactability
scores, plus pre-computed offer arithmetic so it is not doing mental maths
mid-sentence. On top of that sit the four-field agreement grid, concession
discipline, the nine strategies, compliance rules, and escalation triggers.

It is explicitly told never to read the internal scores aloud.

## Observed behaviour

From live runs against all three accounts:

- Discloses identity and verifies the customer before any figure is mentioned.
- Holds 0% discount against "knock it down by half — half or nothing."
- Two rounds of pushback with no new information extracted **no** concession.
- Anchors with a complete 0% / 25% / 7-day / 6-month offer when the customer
  keeps dodging the question, rather than asking a fourth time.
- Concedes exactly one field per genuine new fact ("I'm paid on the 28th"
  bought 7 → 14 days, and nothing else).
- Escalates and stops on a lawyer mention.

One failure was caught and fixed during testing: told about a lost client, an
earlier version of the prompt opened with a 5% discount, 10% upfront and a
12-month tail — and asked for $175 when the customer had just volunteered $300.
Two prompt rules now forbid a softened opening offer and forbid asking for less
than the customer has already offered. After the fix the same conversation
closes at 0% discount with $369 upfront.

## What this is not

That fix is the whole argument in miniature. The rules live in the prompt, so
they are guidance, not enforcement — the four agreement fields are enum-locked
in the JSON schema, and two escalation triggers are now decided in code, but
the concession ladder, the compliance rules, and every remaining escalation
trigger are checked nowhere. It regressed once under sympathetic pressure and
it can regress again on a conversation nobody tested. That is CLAUDE.md law 2,
and it is what the policy engine in `src/` exists to prevent.

The hot model context remains in memory, but every customer, chatbot, and human
agent message is persisted in Postgres. A restart rebuilds the usable transcript
from `chatbot.turns`; the richer policy-attempt audit remains a feature of the
main build under `src/`.

`chatbot.turns` is shared with the Assure+ engagement centre, which seeds
transcripts using `bot`/`user` where this file writes `collector`/`debtor`, and
an upper-case session status. Both vocabularies are read on the way in and ours
is written on the way out — otherwise a seeded conversation restores with an
empty history and cannot be handed back to the bot at all.

Use it to demo, to feel out prompt changes, and to have something to talk to.
Do not put it in front of a real debtor.
