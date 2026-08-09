# RADONaix Assure+ — Demo Script

Three customers, three lifecycles, one continuous story. Everything below is
real data in the database: no screen is mocked, and every figure reconciles
across every screen.

**Before you start:** run `PYTHONPATH=. .venv/bin/python scripts/verify_consistency.py`
from `Assure+_MS`. It should end with **"Everything agrees."** If it doesn't, the
line it prints names the screen that would show a wrong number.

---

## The three customers

Their identifiers continue the sequences the rest of the book already uses, so
nothing on screen reads as a seeded record.

| | Who | Type | Risk | Owes | The story |
|---|---|---|---|---|---|
| **A** | Priya Raghavan · `CUST-CON-207` | Consumer | High | **$2,465** | Full escalation — dunning → promise → broken → case → chatbot → agent → second promise → broken → legal → agency |
| **B** | Daniel Okafor · `CUST-CON-208` | Consumer | Low | **$0** | Clean recovery — reminder → chatbot self-serve → promise kept → paid → closed |
| **C** | Meridian Freight Logistics · `CUST-ENT-036` | Enterprise | High | **$14,820** | Disputed account — chased → dispute → partly upheld → payment plan → broken → legal → agency |

Every account's ledger ties exactly: `billed − paid = outstanding`.

| Account | Billed | Paid | Outstanding |
|---|---|---|---|
| `ACC-10066` Priya | 3,215 | 750 | **2,465.00** |
| `ACC-10067` Daniel | 326 | 326 | **0.00** |
| `ACC-20007` Meridian | 19,070 | 4,250 | **14,820.00** |

Meridian was billed 21,020; 1,950 was credited when the dispute was partly
upheld, which is why the invoice line reads 19,070.

---

## Journey A — Priya Raghavan: the full escalation

**The line to open with:** *"This is what happens when someone stops paying and
keeps not paying. Watch the account move itself through the operation."*

### 1. She falls behind — Portfolio Dashboard → Subscriber 360

Open **Portfolio Management → Customer 360**, search **Priya Raghavan**.

- Three monthly bills, one part-paid: $3,215 billed, $750 received
- **96 days past due**, sitting in the **90+** bucket, risk **High** (81.5)
- Assigned agent: **Robert Kim**
- Strategy driving her: **Standard Dunning (STR-002)**

> *"The account is 96 days down. Nobody typed that — it comes from the invoices
> and the payments underneath it."*

### 2. Dunning runs automatically — Strategy Management → Strategy Performance

The strategy ran four touches before any human was involved:

| Day | Step | Channel | Outcome | Cost |
|---|---|---|---|---|
| −95 | SMS + Email combo | SMS | Delivered | 0.015 |
| −95 | SMS + Email combo | Email | Opened | 0.002 |
| −88 | AI Dialer attempt | Dialer | **No answer** | 0.450 |
| −80 | AI Voicebot negotiation | WhatsApp | Contacted | 0.035 |

> *"Four touches for half a dirham. The dialer is thirty times the cost of an
> SMS, which is exactly the trade-off the Strategy Performance screen exists to
> show you."*

### 3. A promise is taken — and broken

- **PTP-R001253**: $900 promised for 12 June, agreed on WhatsApp → **BROKEN**

### 4. The broken promise raises a case — Collections Workspace

**Collection Management → Collections Workspace → Cases**, find **CASE-000150**.

- Raised automatically, source **Broken PTP**, queue **Broken Promise**
- Description written on the case, so whoever picks it up knows why it exists
- Owner: Robert Kim

> *"The case wasn't created by a person. The broken promise created it."*

### 5. The chatbot talks to her first — AI Engagement Center

**Operations Management → AI Engagement Center → Live Chat.**

Her earlier conversation (`sess_9c41d0be…`) is in the resolved queue — read the
transcript:

> **Bot:** Your account is $2,465 past due. I can set up a payment plan now.
> **Priya:** I lost my job last month. I can't pay all of it.
> **Bot:** We can split this over three months, starting with $400.
> **Priya:** I want to talk to someone about it.

The bot escalated on that last line. **This is the handoff moment.**

> *"The assistant did the first three turns. The moment she asked for a person,
> it stopped negotiating and handed over — that's a guardrail, not a fallback."*

### 6. 🔴 Live handoff — accept it on screen

There is **one conversation waiting right now** (`sess_2f88a51c…`): Priya has
come back today about a letter from a law firm.

**Click Accept.** The full bot transcript is already there; type a reply and it
continues the same conversation. This is the one thing to do live rather than
describe.

### 7. The agent works it — case timeline

Back on **CASE-000150**, the timeline shows what Robert did:

| Day | What | Outcome |
|---|---|---|
| −54 | Call after the chatbot handover | **Promise made** |
| −53 | SMS confirming the arrangement | Delivered |
| −52 | **$400 received** | Payment cleared |
| −39 | WhatsApp chasing the second instalment | No answer |

- **PTP-R001254**: $1,200 in two parts. $400 arrived, $800 did not → **BROKEN**

### 8. The case changes type — it does not spawn a second one

At day −35 the case was **re-typed from Broken PTP to Legal Follow-up**. Open the
**Audit** tab:

> `TYPE_CHANGED · case_type · Broken PTP → Legal Followup`
> *"Second arrangement broken; balance referred for legal follow-up."*

> *"One account, one case. When the situation changes, the case changes type —
> the queue moves and the SLA resets. You never end up with four cards for one
> customer."*

### 9. Out to an agency — Recovery Workspace

**Recovery Management → Recovery Workspace.**

- **PL-1092**, $2,065 placed, status **Active**, commission 12.5%
- The agency has recovered **$350**, and there is a matching payment on the
  ledger — Subscriber 360 shows the same $350

> *"Recovery and Subscriber 360 can't disagree, because the agency recovery is
> a payment row, not a number on a placement."*

### 10. And into legal

- **LC-2026012**, $1,715 claimed, Al Tamimi & Partners, stage **Pre-Legal**

**Where she stands now:** $2,465 owed, case open as Legal Follow-up, with an
agency, a legal file open, and a customer waiting in the chat queue.

---

## Journey B — Daniel Okafor: the clean recovery

**The line to open with:** *"Not everyone is a problem. Most people just forgot."*

1. **One missed bill.** $326, twelve days late, risk **Low**, credit score 742.
   Strategy: **Soft Reminder (STR-001)**.
2. **One SMS**, sent automatically on day 1 — cost 1.5 fils.
3. **He replies to the bot** (`sess_71e0b93a…`):

   > **Daniel:** I got a text about a bill — I thought my card was on autopay.
   > **Bot:** Your autopay card expired on the 3rd, so the July bill of $326
   > was not taken. I can send you a payment link now.
   > **Daniel:** Yes please, send it. I'll pay this week.

   No escalation — the bot resolved it and captured the promise.
4. **PTP-R001255**: $326 → **KEPT**, paid in full five days later.
5. **CASE-000151** went **Resolved → Closed**, resolution *"Paid in full"*.
6. Account is now **$0, Current, 0 DPD**.

> *"Total cost of collecting this: one SMS. The whole thing was handled by the
> assistant, and the case closed itself when the money arrived."*

---

## Journey C — Meridian Freight Logistics: the disputed enterprise

**The line to open with:** *"Enterprise doesn't behave like consumer. They don't
go quiet — they argue, and they're often partly right."*

1. **Two quarterly invoices unpaid** — $21,020, **104 days** past due.
   Owner: **Lisa Davis**. Strategy: **Pre-Legal (STR-005)**.
2. **Chased through the right channel** — email to AP, then a relationship
   manager call. On that call AP disputes the Q2 IoT line charges.
3. **DSP-R001252 raised** — $3,200 disputed: *"46 IoT SIMs decommissioned in
   March but billed in Q2."* The case is created as a **Dispute**, queue
   **Enterprise**.
4. **Partly upheld.** 28 of the 46 SIMs were genuinely decommissioned →
   **$1,950 credited**, the rest stands. The invoice reflects the credit, so
   the balance drops to $14,820.

   > *"Collection paused while the dispute was open, which is what the SLA
   > pause is for. We didn't chase them for money that turned out not to be owed."*

5. **Case re-typed Dispute → Payment Plan.** $8,000 agreed in two instalments.
   **$4,250 cleared**; the second instalment did not → **PTP-R001256 BROKEN**.
6. **Re-typed again → Legal Follow-up** at day −30. Two type changes on one case,
   both in the audit trail.
7. **PL-1093**: $14,820 placed, status **Legal**, commission 15%.
8. **LC-2026013**: claim filed with Hadef & Partners, hearing in 24 days,
   success probability 68%.

---

## The cross-checks that make it credible

Have these ready — they are the questions a sharp audience asks.

**"Do these numbers agree with each other?"**
Run `scripts/verify_consistency.py` on screen. Eighteen checks and two
reconciliations, ending in *"Everything agrees."*

**"Where does the recovery figure come from?"**
Recovery Workspace shows $350 recovered on Priya's placement. Open her
Subscriber 360 — the same $350 is a payment row. The agency figure is derived
from the ledger, not typed alongside it.

**"Is the Portfolio number the same as the Collections number?"**
Portfolio Dashboard → *Under collection*. Collections Dashboard → *Open exposure*.
They differ, deliberately, and each says why: Portfolio counts only delinquent
balances; the collections book also holds accounts that are not past due yet,
and the KPI states that figure separately.

**"Could you simulate this before running it?"**
**Strategy Management → Strategy Simulation.** Pick Standard Dunning, press Run.
It walks the real accounts through the real workflow using response rates
measured from these very conversations, and shows the cost and recovery it would
expect. Every rate is listed with whether it was measured or assumed.

---

## Suggested running order (12–15 minutes)

| # | Screen | Show | Minutes |
|---|---|---|---|
| 1 | Portfolio Dashboard | The whole book, coverage, where the money sits | 2 |
| 2 | Customer 360 — Priya | 96 DPD, the bills, the balance | 1 |
| 3 | Strategy Performance | The four dunning touches and what they cost | 1.5 |
| 4 | Collections Workspace — CASE-000150 | Timeline, the broken promises, the audit trail | 3 |
| 5 | AI Engagement Center | Read the transcript, **accept the live handoff** | 2 |
| 6 | Customer 360 — Daniel | The clean path, closed case, zero balance | 1 |
| 7 | Collections Workspace — CASE-000152 | Dispute → plan → legal, two type changes | 2 |
| 8 | Recovery Workspace | Both placements, the legal files | 1.5 |
| 9 | Strategy Simulation | Run it live, talk through the assumptions | 1.5 |

---

## Rebuilding the demo

```bash
cd Assure+_MS
PYTHONPATH=. .venv/bin/python scripts/refresh_demo.py        # run this before presenting
PYTHONPATH=. .venv/bin/python scripts/verify_consistency.py  # must end "Everything agrees."
```

`refresh_demo.py` does the housekeeping a running system would do overnight:
settles promises that have reached their date, logs a day's work on the floor so
the SLA clocks are meaningful, closes the follow-ups that came due, and
recomputes the agent roll-up from the payment ledger. Run it on the morning of
the demo — the data is dated relative to today, so a few days of drift otherwise
shows up as 0% on-time work.

To rebuild the three journeys from scratch:

```bash
PYTHONPATH=. .venv/bin/python migrations/sql/062_lifecycle_customers.py
```

The script clears its own three customers first, so it is safe to re-run as often
as you like. All dates are relative to today, so the timelines stay correct
whenever the demo is given. It touches nothing outside these three customers.

**One caveat worth knowing:** the demo payments change what agents have
collected, so if you re-run the seed, also re-run the agent roll-up
(step 8 of `057_reconcile_book.py`) before the Agent Performance screen is shown.
