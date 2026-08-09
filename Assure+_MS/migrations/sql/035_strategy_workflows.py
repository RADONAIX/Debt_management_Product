"""Build a meaningful workflow for each reference strategy.

Every journey follows the same collections lifecycle — contact, then a promise,
then what happens when the promise breaks — but the channels, timing and
escalation match the ageing band the strategy is built for:

    Soft Reminder      courtesy nudges, self-serve payment, no pressure
    Standard Dunning   multi-channel cycle, agent call, PTP, case on failure
    AI Adaptive        model picks channel and timing, dispute-aware
    Intensive Recovery supervisor calls, settlement offer, instalments
    Pre-Legal          final notice, legal validation, case for filing
    Agency Allocation  handover to an external agency, then write-off review

Run:  .venv/bin/python migrations/sql/035_strategy_workflows.py
"""

from __future__ import annotations

import asyncio
import json

from sqlalchemy import text

from app.core.database import SessionFactory

# Node coordinates: a single column at x=380 with branches at 140 and 640, so
# Auto-Layout is never needed to read the flow.
MID, LEFT, RIGHT = 380, 120, 660
# A regular node is 168px wide; the start marker is a 48px circle, so it sits
# 60px further right to put both centres on the same line.
START_X = MID + 60


def n(node_id, node_type, label, x, y, **config):
    return {"id": node_id, "type": node_type, "label": label, "x": x, "y": y, "config": config}


def e(a, b, from_side="bottom", to_side="top"):
    return {"from": a, "to": b, "fromSide": from_side, "toSide": to_side}


SOFT_REMINDER = {
    "nodes": [
        n("start", "start", "Start", START_X, 20),
        n("sms1", "SMS", "Day 1 · Friendly SMS reminder", MID, 120,
          template="soft_reminder", delayDays=1,
          message="Hi {name}, your bill of {amount} is due. Pay here: {link}"),
        n("paid1", "If Payment Posted", "Paid within 3 days?", MID, 240, waitDays=3),
        n("close1", "Close Case", "Close — settled", LEFT, 360, reason="PAID_ON_REMINDER"),
        n("email1", "Email", "Day 5 · Statement + payment link", MID, 360,
          template="statement_with_link", delayDays=4),
        n("wa1", "WhatsApp", "Day 10 · WhatsApp nudge", MID, 480,
          template="gentle_nudge", delayDays=5),
        n("link1", "Payment Link", "Send self-serve payment link", MID, 600, expiryHours=72),
        n("paid2", "If Payment Posted", "Paid by day 14?", MID, 720, waitDays=4),
        n("close2", "Close Case", "Close — settled", LEFT, 840, reason="PAID_SELF_SERVE"),
        n("ptp1", "Create PTP", "Capture promise to pay", MID, 840,
          instalments=1, dueInDays=7, channel="WhatsApp"),
        n("broken1", "PTP Broken?", "Promise kept?", MID, 960),
        n("close3", "Close Case", "Close — promise honoured", LEFT, 1080, reason="PTP_KEPT"),
        n("handoff", "Label Node", "Escalate to Standard Dunning", RIGHT, 1080,
          nextStrategy="STR-002", note="Two cycles unpaid — hand to the dunning cycle"),
    ],
    "edges": [
        e("start", "sms1"), e("sms1", "paid1"),
        e("paid1", "close1", "left", "top"), e("paid1", "email1"),
        e("email1", "wa1"), e("wa1", "link1"), e("link1", "paid2"),
        e("paid2", "close2", "left", "top"), e("paid2", "ptp1"),
        e("ptp1", "broken1"),
        e("broken1", "close3", "left", "top"), e("broken1", "handoff", "right", "top"),
    ],
}

STANDARD_DUNNING = {
    "nodes": [
        n("start", "start", "Start", START_X, 20),
        n("channel", "AI Recommend Channel", "Pick the best channel", MID, 120,
          candidates=["SMS", "Email", "WhatsApp"]),
        n("sms1", "SMS", "Cycle 1 · Overdue notice", MID, 240, template="overdue_notice"),
        n("noresp1", "No Response?", "Any response in 3 days?", MID, 360, waitDays=3),
        n("email1", "Email", "Cycle 2 · Formal reminder", RIGHT, 480, template="formal_reminder"),
        n("ivr", "IVR", "Automated call", MID, 480, retries=2, contactWindow="9 AM-6 PM"),
        n("dialer", "AI Dialer", "Agent call", MID, 600,
          dialerType="Predictive", retryAttempts=3, voicemailAction="Send SMS"),
        n("ptp", "Create PTP", "Agent captures promise", MID, 720, instalments=1, dueInDays=10),
        n("prob", "AI PTP Probability", "Score the promise", MID, 840),
        n("broken", "PTP Broken?", "Promise kept?", MID, 960),
        n("close", "Close Case", "Close — promise honoured", LEFT, 1080, reason="PTP_KEPT"),
        n("link", "Send Payment Link", "Final self-serve attempt", RIGHT, 1080, expiryHours=48),
        n("case", "Create Case", "Raise collection case", RIGHT, 1200,
          caseType="Collection", priority="Medium", assignTo="collections_queue"),
        n("escalate", "Label Node", "Escalate to Intensive Recovery", RIGHT, 1320,
          nextStrategy="STR-004"),
    ],
    "edges": [
        e("start", "channel"), e("channel", "sms1"), e("sms1", "noresp1"),
        e("noresp1", "email1", "right", "top"), e("noresp1", "ivr"),
        e("email1", "ivr", "bottom", "right"),
        e("ivr", "dialer"), e("dialer", "ptp"), e("ptp", "prob"), e("prob", "broken"),
        e("broken", "close", "left", "top"), e("broken", "link", "right", "top"),
        e("link", "case"), e("case", "escalate"),
    ],
}

AI_ADAPTIVE = {
    "nodes": [
        n("start", "start", "Start", START_X, 20),
        n("score", "AI Risk Score", "Score the account", MID, 120),
        n("nba", "AI Next-Best-Action", "Choose the action", MID, 240),
        n("timing", "AI Recommend Time-of-Day", "Best hour to reach", MID, 360),
        n("channel", "AI Recommend Channel", "Best channel", MID, 480),
        n("dialer", "AI Dialer", "Adaptive outreach", MID, 600,
          dialerType="Predictive", retryAttempts=3, languages=["English", "Arabic"]),
        n("va", "VA", "Virtual agent handles the call", RIGHT, 720, fallback="human_agent"),
        n("dispute", "AI Dispute Classifier", "Is this a dispute?", MID, 720),
        n("isdispute", "If Dispute Detected", "Dispute raised?", MID, 840),
        n("resolve", "Create Case", "Raise billing dispute", LEFT, 960,
          caseType="Billing Issue", priority="High", slaHours=48),
        n("prob", "AI PTP Probability", "Likelihood of a kept promise", MID, 960),
        n("ptp", "Create PTP", "Capture promise", MID, 1080, instalments=2, dueInDays=14),
        n("broken", "PTP Broken?", "Promise kept?", MID, 1200),
        n("close", "Close Case", "Close — recovered", LEFT, 1320, reason="PTP_KEPT"),
        n("intensive", "Label Node", "Escalate to Intensive Recovery", RIGHT, 1320,
          nextStrategy="STR-004"),
    ],
    "edges": [
        e("start", "score"), e("score", "nba"), e("nba", "timing"), e("timing", "channel"),
        e("channel", "dialer"), e("dialer", "dispute"),
        e("dialer", "va", "right", "top"), e("va", "dispute", "bottom", "right"),
        e("dispute", "isdispute"),
        e("isdispute", "resolve", "left", "top"), e("isdispute", "prob"),
        e("prob", "ptp"), e("ptp", "broken"),
        e("broken", "close", "left", "top"), e("broken", "intensive", "right", "top"),
    ],
}

INTENSIVE_RECOVERY = {
    "nodes": [
        n("start", "start", "Start", START_X, 20),
        n("risk", "If High-Risk Customer", "High risk or high value?", MID, 120),
        n("supervisor", "AI Dialer", "Supervisor call", MID, 240,
          dialerType="Preview", retryAttempts=4, contactWindow="9 AM-8 PM"),
        n("noresp", "No Response?", "Reached after 4 attempts?", MID, 360, waitDays=4),
        n("field", "Label Node", "Field visit request", RIGHT, 480, team="field_ops"),
        n("settle", "Generate Settlement", "Prepare settlement offer", MID, 480,
          discountPct=15, validityDays=7, approval="supervisor"),
        n("offer", "Email", "Send settlement terms", MID, 600, template="settlement_offer"),
        n("ptp", "Create PTP", "Instalment plan", MID, 720,
          instalments=3, dueInDays=30, minDownPaymentPct=20),
        n("paid", "If Payment Posted", "First instalment received?", MID, 840, waitDays=7),
        n("close", "Close Case", "Close — plan running", LEFT, 960, reason="PLAN_ACTIVE"),
        n("broken", "PTP Broken?", "Instalment missed?", MID, 960),
        n("case", "Create Case", "Raise recovery case", MID, 1080,
          caseType="Broken PTP", priority="High", assignTo="senior_collector"),
        n("prelegal", "Label Node", "Escalate to Pre-Legal", MID, 1200, nextStrategy="STR-005"),
    ],
    "edges": [
        e("start", "risk"), e("risk", "supervisor"), e("supervisor", "noresp"),
        e("noresp", "field", "right", "top"), e("noresp", "settle"),
        e("field", "settle", "bottom", "right"),
        e("settle", "offer"), e("offer", "ptp"), e("ptp", "paid"),
        e("paid", "close", "left", "top"), e("paid", "broken"),
        e("broken", "case"), e("case", "prelegal"),
    ],
}

PRE_LEGAL = {
    "nodes": [
        n("start", "start", "Start", START_X, 20),
        n("bucket", "If >90 Bucket", "Over 90 days?", MID, 120),
        n("validate", "Credit Validation", "Validate balance and KYC", MID, 240,
          checks=["balance", "identity", "disputes"]),
        n("dispute", "If Dispute Detected", "Open dispute on file?", MID, 360),
        n("hold", "Create Case", "Hold — resolve dispute first", LEFT, 480,
          caseType="Dispute", priority="Critical", slaHours=72),
        n("notice", "Legal Pre-Notice", "Issue pre-legal notice", MID, 480,
          channels=["SMS", "Email", "Registered post"], noticePeriodDays=15),
        n("call", "AI Dialer", "Final call before filing", MID, 600,
          dialerType="Preview", retryAttempts=5),
        n("final", "Generate Settlement", "Final settlement window", MID, 720,
          discountPct=25, validityDays=10, approval="legal_head"),
        n("paid", "If Payment Posted", "Settled inside the notice period?", MID, 840, waitDays=15),
        n("close", "Close Case", "Close — settled pre-filing", LEFT, 960, reason="SETTLED_PRE_LEGAL"),
        n("case", "Create Case", "Raise legal case for filing", MID, 960,
          caseType="Legal Followup", priority="Critical", assignTo="legal_team"),
        n("agency", "Label Node", "Hand to agency if filing declined", MID, 1080,
          nextStrategy="STR-006"),
    ],
    "edges": [
        e("start", "bucket"), e("bucket", "validate"), e("validate", "dispute"),
        e("dispute", "hold", "left", "top"), e("dispute", "notice"),
        e("notice", "call"), e("call", "final"), e("final", "paid"),
        e("paid", "close", "left", "top"), e("paid", "case"),
        e("case", "agency"),
    ],
}

AGENCY_ALLOCATION = {
    "nodes": [
        n("start", "start", "Start", START_X, 20),
        n("bucket", "If >90 Bucket", "Beyond in-house recovery?", MID, 120),
        n("validate", "Credit Validation", "Confirm balance before handover", MID, 240),
        n("case", "Create Case", "Open agency case", MID, 360,
          caseType="Collection", priority="Critical", assignTo="agency_desk"),
        n("sync", "RPA: ERP Sync", "Push account to the agency", MID, 480,
          agencyApi="partner_portal", includes=["balance", "contacts", "history"]),
        n("handover", "Label Node", "Handover to agency", MID, 600,
          commissionPct=18, recallAfterDays=90),
        n("notify", "Email", "Notify customer of assignment", MID, 720,
          template="agency_assignment_notice"),
        n("track", "RPA: Workflow Trigger", "Weekly agency status pull", MID, 840,
          frequency="weekly", source="partner_portal"),
        n("paid", "If Payment Posted", "Recovered by the agency?", MID, 960, waitDays=90),
        n("close", "Close Case", "Close — recovered by agency", LEFT, 1080,
          reason="AGENCY_RECOVERED"),
        n("recall", "Label Node", "Recall and review for write-off", RIGHT, 1080,
          reviewBoard="finance", writeOffThreshold=1000),
    ],
    "edges": [
        e("start", "bucket"), e("bucket", "validate"), e("validate", "case"),
        e("case", "sync"), e("sync", "handover"), e("handover", "notify"),
        e("notify", "track"), e("track", "paid"),
        e("paid", "close", "left", "top"), e("paid", "recall", "right", "top"),
    ],
}

WORKFLOWS = {
    "STR-001": SOFT_REMINDER,
    "STR-002": STANDARD_DUNNING,
    "STR-003": AI_ADAPTIVE,
    "STR-004": INTENSIVE_RECOVERY,
    "STR-005": PRE_LEGAL,
    "STR-006": AGENCY_ALLOCATION,
}


async def main() -> None:
    async with SessionFactory() as db:
        for code, wf in WORKFLOWS.items():
            result = await db.execute(
                text(
                    "UPDATE public.strategy SET workflow_json = CAST(:wf AS jsonb),"
                    " updated_at = now() WHERE strategy_code = :code"
                ),
                {"wf": json.dumps(wf), "code": code},
            )
            print(f"  {code}: {len(wf['nodes'])} nodes, {len(wf['edges'])} edges"
                  f" ({'updated' if result.rowcount else 'NOT FOUND'})")
        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
