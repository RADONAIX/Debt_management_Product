"""Strategy simulation — run a journey against the real book before publishing it.

The model walks each selected account through the strategy's own workflow graph,
day by day, spending the channel costs the cost table already holds and applying
response rates measured from what those channels have actually achieved. It is a
projection, not a forecast: every rate it uses is shown on the screen with where
it came from, and every run stores its inputs and its seed so the same inputs
always produce the same answer.

What it does not do is invent behaviour. Contact rates come from
`customer_schema.case_activity` outcomes per channel, promise-kept rates from
`customer_schema.ptp`, and the settlement mix from `customer_schema.payment`.
Where the book has too little history to support a rate, the fallback is stated
rather than quietly substituted.
"""

from __future__ import annotations

import hashlib
import json
import random
import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.strategies import schemas

# Enough history for a rate to be worth using rather than a coincidence.
MIN_OBSERVATIONS = 8

# Used only where the book has nothing to measure. Deliberately conservative,
# and reported as an assumption rather than a measurement.
FALLBACK_REACH = {
    "SMS": 0.28, "Email": 0.22, "WhatsApp": 0.35, "Dialer": 0.30,
    "IVR": 0.18, "Voicebot": 0.20, "Letter": 0.12, "Field": 0.55,
}

# A reached customer is likelier to act when the balance is fresh and the risk
# is low. Multipliers on the base settle/promise chance.
RISK_FACTOR = {"Low": 1.25, "Medium": 1.0, "High": 0.72, "Critical": 0.5}
AGE_FACTOR = {"Current": 1.3, "1-30": 1.15, "31-60": 0.95, "61-90": 0.75, "90+": 0.5}


def _f(v) -> float:
    return float(v) if v is not None else 0.0


def _channel_of(node: dict) -> str | None:
    """Which channel a workflow step sends on, from its type or its label."""
    blob = f"{node.get('type', '')} {node.get('label', '')}".lower()
    for channel, needles in (
        ("SMS", ("sms",)), ("Email", ("email", "statement", "letter pack")),
        ("WhatsApp", ("whatsapp",)), ("Dialer", ("dialer", "call", "agent call")),
        ("IVR", ("ivr", "hotline")), ("Voicebot", ("voicebot", "voice bot", "va")),
        ("Letter", ("letter",)), ("Field", ("field visit",)),
    ):
        if any(n in blob for n in needles):
            return channel
    return None


def _scheduled_day(node: dict) -> int | None:
    """The day a step runs, when the strategy says so in the step's own name.

    Journeys are written as "Day 5 · Statement + payment link", so the schedule
    is already in the graph. Reading it beats spreading steps evenly across the
    horizon, which pushed later steps past the end and made them unreachable.
    """
    m = re.search(r"\bday\s*(\d{1,3})\b", str(node.get("label", "")), re.I)
    return int(m.group(1)) if m else None


def _kind(node: dict) -> str:
    label = str(node.get("label", "")).lower()
    if node.get("id") == "start" or label == "start":
        return "start"
    if "?" in label:
        return "decision"
    if label.startswith(("close", "end", "stop")) or "settled" in label:
        return "terminal"
    if "ptp" in label or "promise" in label:
        return "promise"
    if "escalat" in label or "handoff" in label or "legal" in label:
        return "escalate"
    if _channel_of(node):
        return "touch"
    return "action"


async def assumptions(db: AsyncSession) -> schemas.SimAssumptions:
    """The rates the simulation will use, and where each one came from."""
    reach_rows = (await db.execute(text("""
        SELECT COALESCE(NULLIF(ca.channel_code, ''), ca.activity_type) AS channel,
               count(*) AS attempts,
               count(*) FILTER (
                   WHERE ca.outcome IS NOT NULL AND btrim(ca.outcome) <> ''
                     AND upper(ca.outcome) NOT LIKE 'NO%ANSWER%'
                     AND upper(ca.outcome) NOT IN ('DELIVERED','OPENED','READ','SENT')
               ) AS reached
        FROM customer_schema.case_activity ca
        WHERE ca.activity_type IN ('CALL','SMS','EMAIL','WHATSAPP','VOICEBOT','IVR','CHAT')
        GROUP BY 1"""))).mappings().all()

    costs = {r["channel_code"]: (_f(r["cost_per_touch"]), r["label"])
             for r in (await db.execute(text(
                 "SELECT channel_code, label, cost_per_touch FROM strategy_schema.channel_cost "
                 "WHERE is_active"))).mappings().all()}

    measured = {r["channel"]: (r["attempts"], r["reached"]) for r in reach_rows}
    channels: list[schemas.SimChannelRate] = []
    for code, (cost, label) in sorted(costs.items()):
        attempts, reached = measured.get(code, (0, 0))
        if attempts >= MIN_OBSERVATIONS:
            rate, source = reached / attempts, f"measured from {attempts} attempts"
        else:
            rate = FALLBACK_REACH.get(code, 0.2)
            source = (f"assumed — only {attempts} attempt(s) on record"
                      if attempts else "assumed — no history on this channel")
        channels.append(schemas.SimChannelRate(
            channel=code, label=label, costPerTouch=cost,
            reachRate=round(rate * 100, 1), source=source))

    ptp = (await db.execute(text("""
        SELECT count(*) FILTER (WHERE status = 'KEPT')   AS kept,
               count(*) FILTER (WHERE status IN ('KEPT','BROKEN')) AS decided
        FROM customer_schema.ptp"""))).mappings().one()
    kept_rate = (ptp["kept"] / ptp["decided"]) if ptp["decided"] >= MIN_OBSERVATIONS else 0.45
    kept_source = (f"measured from {ptp['decided']} settled promises"
                   if ptp["decided"] >= MIN_OBSERVATIONS else "assumed — too few settled promises")

    # What a paying account typically clears, as a share of what it owed.
    settle = (await db.execute(text("""
        SELECT count(*) AS n, COALESCE(avg(share), 0) AS avg_share FROM (
            SELECT LEAST(1.0, sum(p.amount) / NULLIF(a.outstanding + sum(p.amount), 0)) AS share
            FROM customer_schema.payment p
            JOIN customer_schema.account a ON a.id = p.account_id
            WHERE p.status = 'COMPLETED' AND p.payment_date > CURRENT_DATE - 180
            GROUP BY a.id, a.outstanding
            HAVING sum(p.amount) > 0) x"""))).mappings().one()
    share = _f(settle["avg_share"]) if settle["n"] >= MIN_OBSERVATIONS else 0.55

    return schemas.SimAssumptions(
        channels=channels,
        promiseKeptRate=round(kept_rate * 100, 1), promiseKeptSource=kept_source,
        settlementShare=round(share * 100, 1),
        settlementSource=(f"measured from {settle['n']} paying accounts over 180 days"
                          if settle["n"] >= MIN_OBSERVATIONS else "assumed — too few payments"),
        riskFactors=[schemas.SimFactor(key=k, factor=v) for k, v in RISK_FACTOR.items()],
        ageFactors=[schemas.SimFactor(key=k, factor=v) for k, v in AGE_FACTOR.items()],
    )


async def population(db: AsyncSession, code: str, *, use_targeting: bool,
                     aging: list[str] | None, risk: list[str] | None, limit: int
                     ) -> tuple[list[dict], dict]:
    """The accounts this run will put through the journey."""
    s = (await db.execute(text(
        "SELECT * FROM public.strategy WHERE strategy_code = :c"), {"c": code})).mappings().first()
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Strategy '{code}' does not exist.")

    buckets = list(aging or []) or (list(s["aging_bucket"] or []) if use_targeting else [])
    risks = list(risk or []) or (list(s["risk_level"] or []) if use_targeting else [])

    where = ["a.outstanding > 0"]
    params: dict[str, Any] = {"lim": limit}
    if buckets:
        where.append("COALESCE(a.aging_bucket, 'Current') = ANY(:buckets)")
        params["buckets"] = buckets
    if risks:
        where.append("a.risk_level = ANY(:risks)")
        params["risks"] = risks

    rows = (await db.execute(text(f"""
        SELECT a.id, a.account_code, a.outstanding, a.dpd, a.risk_level,
               COALESCE(a.aging_bucket, 'Current') AS bucket,
               COALESCE(c.full_name, co.name, c.customer_code) AS who
        FROM customer_schema.account a
        JOIN customer_schema.customer c ON c.id = a.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        WHERE {' AND '.join(where)}
        ORDER BY a.outstanding DESC
        LIMIT :lim"""), params)).mappings().all()

    return [dict(r) for r in rows], {
        "strategy": dict(s), "buckets": buckets, "risks": risks,
    }


def _walk(nodes: list[dict], edges: list[dict]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {n["id"]: [] for n in nodes}
    for e in edges:
        if e.get("from") in out and any(n["id"] == e.get("to") for n in nodes):
            out[e["from"]].append(e["to"])
    return out


async def simulate(db: AsyncSession, code: str, p: schemas.SimulationRequest, actor: int
                   ) -> schemas.SimulationResult:
    """Put the population through the journey and report what came out."""
    accounts, meta = await population(
        db, code, use_targeting=p.useTargeting, aging=p.agingBuckets,
        risk=p.riskLevels, limit=p.maxAccounts)
    strategy = meta["strategy"]
    workflow = strategy["workflow_json"] or {}
    nodes = list(workflow.get("nodes") or [])
    edges = list(workflow.get("edges") or workflow.get("connections") or [])
    if not nodes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"{strategy['name']} has no workflow to simulate.")
    if not accounts:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "No accounts match this population.")

    rates = await assumptions(db)
    reach = {c.channel: c.reachRate / 100 for c in rates.channels}
    cost_of = {c.channel: c.costPerTouch for c in rates.channels}
    kept_rate = (p.promiseKeptRate if p.promiseKeptRate is not None
                 else rates.promiseKeptRate) / 100
    settle_share = (p.settlementShare if p.settlementShare is not None
                    else rates.settlementShare) / 100
    lift = 1 + (p.responseLiftPct or 0) / 100

    by_id = {n["id"]: n for n in nodes}
    nexts = _walk(nodes, edges)
    start = next((n["id"] for n in nodes if _kind(n) == "start"), nodes[0]["id"])

    # Same strategy, same population, same assumptions → same result. The seed
    # is stored with the run so a number can always be reproduced.
    seed_src = f"{code}|{p.model_dump_json()}|{len(accounts)}"
    seed = int(hashlib.sha256(seed_src.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)

    step_stats: dict[str, dict] = {
        n["id"]: {"label": n.get("label", n["id"]), "kind": _kind(n),
                  "channel": _channel_of(n), "entered": 0, "reached": 0, "cost": 0.0}
        for n in nodes
    }
    channel_stats: dict[str, dict] = {}
    day_curve = [{"day": d, "recovered": 0.0, "touches": 0, "cost": 0.0}
                 for d in range(p.horizonDays + 1)]

    funnel = {"entered": 0, "touched": 0, "engaged": 0, "promised": 0,
              "kept": 0, "settled": 0, "escalated": 0,
              # Two very different endings: the journey finished and the
              # customer simply did not pay, or the horizon cut it short with
              # steps still to run. Lumping them together hid which it was.
              "completed": 0, "timed_out": 0}
    total_cost = total_recovered = 0.0
    resolution_days: list[int] = []
    outcomes: list[dict] = []

    # Steps that do not name a day fall this far after the previous one.
    STEP_GAP = 3

    for acct in accounts:
        funnel["entered"] += 1
        balance = _f(acct["outstanding"])
        propensity = (RISK_FACTOR.get(acct["risk_level"], 1.0)
                      * AGE_FACTOR.get(acct["bucket"], 1.0) * lift)

        node_id, day, guard = start, 0, 0
        engaged = promised = settled = escalated = timed_out = False
        recovered_here = 0.0

        while node_id and guard < 60:
            if day > p.horizonDays:
                timed_out = True
                break
            guard += 1
            node = by_id.get(node_id)
            if node is None:
                break
            stat = step_stats[node_id]
            stat["entered"] += 1
            kind = stat["kind"]

            if kind == "terminal":
                break

            # A step that names its own day runs on that day, not sooner.
            scheduled = _scheduled_day(node)
            if scheduled is not None:
                day = max(day, scheduled)
                if day > p.horizonDays:
                    timed_out = True
                    break

            if kind == "touch":
                ch = stat["channel"] or "SMS"
                cost = cost_of.get(ch, 0.02)
                stat["cost"] += cost
                total_cost += cost
                cs = channel_stats.setdefault(
                    ch, {"touches": 0, "reached": 0, "cost": 0.0})
                cs["touches"] += 1
                cs["cost"] += cost
                funnel["touched"] += 1
                day_curve[min(day, p.horizonDays)]["touches"] += 1
                day_curve[min(day, p.horizonDays)]["cost"] += cost

                if rng.random() < min(0.95, reach.get(ch, 0.2) * propensity):
                    stat["reached"] += 1
                    cs["reached"] += 1
                    if not engaged:
                        engaged = True
                        funnel["engaged"] += 1
                if scheduled is None:
                    day += STEP_GAP

            elif kind == "promise":
                if engaged and not promised and rng.random() < 0.6 * propensity:
                    promised = True
                    funnel["promised"] += 1
                    stat["reached"] += 1
                day += 1

            elif kind == "decision":
                # Whether the account pays at this checkpoint. Engagement and a
                # standing promise both raise the chance; risk and age lower it.
                chance = 0.08 * propensity
                if engaged:
                    chance += 0.18 * propensity
                if promised:
                    chance = kept_rate * propensity
                if not settled and rng.random() < min(0.9, chance):
                    settled = True
                    if promised:
                        funnel["kept"] += 1
                    funnel["settled"] += 1
                    recovered_here = balance * settle_share
                    total_recovered += recovered_here
                    day_curve[min(day, p.horizonDays)]["recovered"] += recovered_here
                    resolution_days.append(day)
                    stat["reached"] += 1
                    # Settled accounts leave by the branch that closes them.
                    nxt = [t for t in nexts.get(node_id, [])
                           if _kind(by_id.get(t, {})) == "terminal"]
                    node_id = nxt[0] if nxt else None
                    continue
                day += 1

            elif kind == "escalate":
                escalated = True
                funnel["escalated"] += 1
                stat["reached"] += 1
                break

            following = [t for t in nexts.get(node_id, [])
                         if _kind(by_id.get(t, {})) != "terminal"] or nexts.get(node_id, [])
            node_id = following[0] if following else None

        if not settled and not escalated:
            funnel["timed_out" if timed_out else "completed"] += 1
        outcomes.append({
            "accountCode": acct["account_code"], "customerName": acct["who"],
            "outstanding": balance, "riskLevel": acct["risk_level"],
            "bucket": acct["bucket"],
            "outcome": ("Settled" if settled else "Escalated" if escalated
                        else "Still running" if timed_out
                        else "Engaged, unresolved" if engaged else "No contact"),
            "recovered": round(recovered_here, 2),
        })

    exposure = sum(_f(a["outstanding"]) for a in accounts)
    running = 0.0
    curve = []
    for d in day_curve:
        running += d["recovered"]
        curve.append(schemas.SimDay(day=d["day"], recovered=round(running, 2),
                                    touches=d["touches"], cost=round(d["cost"], 2)))

    result = schemas.SimulationResult(
        strategyCode=code, strategyName=strategy["name"],
        strategyVersion=strategy["current_version"], seed=seed,
        accounts=len(accounts), exposure=round(exposure, 2),
        horizonDays=p.horizonDays,
        touches=funnel["touched"], cost=round(total_cost, 2),
        recovered=round(total_recovered, 2),
        recoveryRate=round(total_recovered / exposure * 100, 1) if exposure else None,
        costPerRecovered=(round(total_cost / total_recovered, 4)
                          if total_recovered else None),
        costPerAccount=round(total_cost / len(accounts), 2) if accounts else 0,
        avgDaysToSettle=(round(sum(resolution_days) / len(resolution_days), 1)
                         if resolution_days else None),
        funnel=[
            schemas.SimFunnelStage(stage="Entered", accounts=funnel["entered"]),
            schemas.SimFunnelStage(stage="Contacted", accounts=funnel["engaged"]),
            schemas.SimFunnelStage(stage="Promised", accounts=funnel["promised"]),
            schemas.SimFunnelStage(stage="Settled", accounts=funnel["settled"]),
            schemas.SimFunnelStage(stage="Escalated", accounts=funnel["escalated"]),
            schemas.SimFunnelStage(stage="Finished, unpaid", accounts=funnel["completed"]),
            schemas.SimFunnelStage(stage="Horizon ran out", accounts=funnel["timed_out"]),
        ],
        steps=[
            schemas.SimStep(
                nodeId=nid, label=s["label"], kind=s["kind"], channel=s["channel"],
                entered=s["entered"], succeeded=s["reached"], cost=round(s["cost"], 2),
                successRate=round(s["reached"] / s["entered"] * 100, 1) if s["entered"] else None)
            for nid, s in step_stats.items() if s["entered"] > 0
        ],
        channels=[
            schemas.SimChannelResult(
                channel=ch, touches=v["touches"], reached=v["reached"],
                cost=round(v["cost"], 2),
                reachRate=round(v["reached"] / v["touches"] * 100, 1) if v["touches"] else None)
            for ch, v in sorted(channel_stats.items(), key=lambda kv: -kv[1]["touches"])
        ],
        curve=curve,
        sample=[schemas.SimOutcome(**o) for o in outcomes[:25]],
        assumptions=rates,
    )

    if p.save:
        await db.execute(text("""
            INSERT INTO strategy_schema.simulation_run
              (strategy_id, strategy_code, strategy_version, label, inputs, outputs,
               seed, accounts, horizon_days, exposure, recovered, cost, created_by)
            VALUES (:sid, :code, :ver, :label, CAST(:inp AS jsonb), CAST(:out AS jsonb),
                    :seed, :n, :days, :exp, :rec, :cost, :actor)"""),
            {"sid": strategy["id"], "code": code, "ver": strategy["current_version"],
             "label": p.label, "inp": p.model_dump_json(),
             "out": json.dumps(result.model_dump(mode="json")),
             "seed": seed, "n": len(accounts), "days": p.horizonDays,
             "exp": round(exposure, 2), "rec": round(total_recovered, 2),
             "cost": round(total_cost, 2), "actor": actor})
        await db.commit()

    return result


async def history(db: AsyncSession, code: str | None, limit: int = 20
                  ) -> list[schemas.SimulationRunRow]:
    rows = (await db.execute(text("""
        SELECT r.id, r.strategy_code, r.strategy_version, r.label, r.accounts,
               r.horizon_days, r.exposure, r.recovered, r.cost, r.seed, r.created_at,
               u.full_name AS created_by
        FROM strategy_schema.simulation_run r
        LEFT JOIN administration.app_user u ON u.id = r.created_by
        WHERE (CAST(:c AS text) IS NULL OR r.strategy_code = CAST(:c AS text))
        ORDER BY r.created_at DESC LIMIT :lim"""),
        {"c": code, "lim": limit})).mappings().all()
    return [
        schemas.SimulationRunRow(
            id=r["id"], strategyCode=r["strategy_code"], strategyVersion=r["strategy_version"],
            label=r["label"], accounts=r["accounts"], horizonDays=r["horizon_days"],
            exposure=_f(r["exposure"]), recovered=_f(r["recovered"]), cost=_f(r["cost"]),
            recoveryRate=(round(_f(r["recovered"]) / _f(r["exposure"]) * 100, 1)
                          if _f(r["exposure"]) else None),
            seed=r["seed"], createdAt=r["created_at"], createdBy=r["created_by"])
        for r in rows]


async def run_detail(db: AsyncSession, run_id: int) -> schemas.SimulationResult:
    row = (await db.execute(text(
        "SELECT outputs FROM strategy_schema.simulation_run WHERE id = :i"),
        {"i": run_id})).mappings().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such simulation run.")
    return schemas.SimulationResult(**row["outputs"])
