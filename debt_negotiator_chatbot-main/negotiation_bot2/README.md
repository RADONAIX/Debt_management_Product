# negotiation_bot2

A debt-negotiation chatbot in one file: [api.py](api.py).

Standalone. It imports nothing from `src/` — no policy engine, no guardrail
layer, no gateway. Just FastAPI, the OpenAI SDK, one Postgres connection, and
one large system prompt.

Account facts are read live from `customer_schema` in `Debt_management_db` —
the same `risk_grid_account_view` that backs the Priority Targets grid — so a
session opens against a real customer instead of hand-typed figures. Customer
and account data remain read-only. Conversations are durably written only to
`chatbot.sessions`, `chatbot.turns`, and `chatbot.escalations` so the Assure+
AI Engagement Center can take over the same transcript.

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
| `POST` | `/sessions` | open a call against an account, returns the first turn |
| `POST` | `/sessions/{id}/messages` | customer reply in, next collector turn out |
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

`account_id`, `customer_id`, and `account_code` also work as selectors. Then:

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

## The ring-fenced dispute

All three demo accounts carry open `ESCALATED` disputes. A strict reading of
"customer disputes the debt → hand to a human" would end every call on turn one.

So the disputed amount is treated as **ring-fenced**: already with the disputes
team, excluded from the balance, and not the bot's to argue. It says so plainly
and negotiates only the undisputed remainder — which is why the negotiable
balance is below the outstanding in the table above. It still escalates if the
customer disputes the *undisputed* balance or raises something new.

## What the bot is told

The prompt is assembled per session from the live account: balances, DPD,
payment history, promise-to-pay record, open disputes, occupation, income,
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
in the JSON schema, but the concession ladder, the compliance rules, and the
escalation triggers are checked nowhere in code. It regressed once under
sympathetic pressure and it can regress again on a conversation nobody tested.
That is CLAUDE.md law 2, and it is what the policy engine in `src/` exists to
prevent.

The hot model context remains in memory, but every customer, chatbot, and human
agent message is persisted in Postgres. A restart rebuilds the usable transcript
from `chatbot.turns`; the richer policy-attempt audit remains a feature of the
main build under `src/`.

Use it to demo, to feel out prompt changes, and to have something to talk to.
Do not put it in front of a real debtor.
