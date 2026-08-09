"""What counts as a case, in one place.

Every screen that shows a case count reads these predicates, so the
Collections Dashboard, the Collections Workspace and the agent desk can never
report different numbers for the same question. Before this existed each of
them wrote its own WHERE clause and they drifted: one counted resolved cases
as open, another ignored paused SLA clocks.

Aliases assumed by the fragments below:

    dc  customer_schema.debt_case
    m   collection.case_meta   (LEFT JOINed — see CASE_FROM)

Two different columns say two different things about a case, and conflating
them is what caused the drift:

    dc.status           whether the record is closed off in the ledger
    m.workflow_state    how far the work on it has actually got

A case can be finished (workflow_state RESOLVED) while still open in the
ledger, waiting for someone to close it. It is not live work, and counting it
as such overstates the caseload and drags the on-time figure down for nothing.
"""

from __future__ import annotations

# case_meta is LEFT JOINed so a case can never vanish from a count just because
# its metadata row is missing; COALESCE below gives such a case a sane state.
CASE_FROM = """
    FROM customer_schema.debt_case dc
    LEFT JOIN collection.case_meta m ON m.case_id = dc.id
"""

# A merged case is a duplicate folded into another one. Counting both would
# count the same work twice.
NOT_MERGED = "m.merged_into_case_id IS NULL"

_STATE = "COALESCE(m.workflow_state, 'NEW')"

#: Work still to be done: open in the ledger and not finished.
LIVE_CASE = f"dc.status <> 'CLOSED' AND {_STATE} NOT IN ('RESOLVED', 'CLOSED')"

#: Live work that has an owner but that nobody has started.
NOT_STARTED = f"{LIVE_CASE} AND {_STATE} = 'ASSIGNED'"

#: Live work with no owner at all.
UNASSIGNED = f"{LIVE_CASE} AND dc.assigned_agent_id IS NULL"

#: Finished, waiting to be closed off. Excluded from LIVE_CASE by design.
AWAITING_CLOSE = f"dc.status <> 'CLOSED' AND {_STATE} = 'RESOLVED'"

#: Live work past its next-action deadline. A deliberately paused clock — a case
#: waiting on the customer, say — is not a breach, so it is excluded.
PAST_SLA = f"{LIVE_CASE} AND dc.sla_deadline < now() AND m.sla_paused_at IS NULL"

#: Live work whose deadline falls inside the next 24 hours.
DUE_SOON = (f"{LIVE_CASE} AND m.sla_paused_at IS NULL"
            " AND dc.sla_deadline BETWEEN now() AND now() + interval '24 hours'")

#: How far back "recently" reaches for promise-keeping rates. A rate with no
#: window drifts forever and can never improve, so every screen uses this one.
PROMISE_WINDOW_DAYS = 90

#: Promises settled inside the window, for a kept-rate that means something.
PROMISE_RECENT = (
    f"t.promised_date >= CURRENT_DATE - interval '{PROMISE_WINDOW_DAYS} days'"
)
