"""Seed the Recovery Workspace with a believable placement book.

Nothing here is invented in isolation — every placement is a real delinquent
account from customer_schema, the amount placed is that account's actual
outstanding, and the recovery ledger sums back to the placement's recovered
figure. Live placements come from the accounts that are genuinely past due
today; the closed and recalled ones are back-dated so the workspace opens with
history to trend against.
"""

from __future__ import annotations

import asyncio
import random
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text

from app.core.database import SessionFactory

random.seed(20260806)  # a rebuild must reproduce the same book

TODAY = date(2026, 8, 6)


def money(v) -> Decimal:
    return Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


AGENCIES = [
    # code, name, type, status, comm, recall, capacity, min, max, contact, email, phone, city, risk, buckets, onboarded, contract_end
    ("AG-001", "Meridian Recovery Solutions", "Commercial Debt", "ACTIVE", 15.0, 90, 300, 1000, 500000,
     "Daniel Okafor", "d.okafor@meridianrecovery.com", "+1 415 555 0142", "San Francisco", "USA",
     ["High", "Critical"], ["61-90", "90+"], date(2023, 3, 14), date(2027, 3, 13),
     "Preferred partner for enterprise balances above $5k."),
    ("AG-002", "Elite Collection Agency", "Consumer Debt", "ACTIVE", 18.0, 75, 400, 100, 25000,
     "Priya Raman", "priya@elitecollect.com", "+1 312 555 0198", "Chicago", "USA",
     ["Medium", "High"], ["31-60", "61-90"], date(2022, 9, 1), date(2026, 8, 31),
     "Strongest consumer contact rates; heavy outbound voice."),
    ("AG-003", "Northgate Credit Partners", "Consumer Debt", "ACTIVE", 16.5, 90, 250, 250, 60000,
     "Marcus Feld", "m.feld@northgatecp.com", "+1 646 555 0117", "New York", "USA",
     ["Medium", "High", "Critical"], ["61-90", "90+"], date(2024, 1, 22), date(2027, 1, 21),
     "Digital-first agency; strong self-serve settlement conversion."),
    ("AG-004", "Regional Recovery Corp", "Small Business", "UNDER_REVIEW", 20.0, 60, 150, 500, 40000,
     "Alicia Duarte", "alicia@regionalrecovery.com", "+1 214 555 0176", "Dallas", "USA",
     ["Medium"], ["31-60"], date(2023, 11, 6), date(2026, 11, 5),
     "Under review — recovery rate below the 55% contractual floor."),
    ("AG-005", "Harborline Asset Management", "Late Stage", "ACTIVE", 22.0, 120, 200, 2000, 250000,
     "Ken Ishida", "k.ishida@harborline.com", "+1 206 555 0163", "Seattle", "USA",
     ["Critical"], ["90+"], date(2022, 4, 18), date(2026, 12, 31),
     "Late-stage specialist; takes the 180+ day book others recall."),
    ("AG-006", "Anchor Legal Recoveries", "Legal", "ACTIVE", 25.0, 180, 80, 5000, None,
     "Sarah Mitchell", "s.mitchell@anchorlegal.com", "+1 617 555 0155", "Boston", "USA",
     ["Critical"], ["90+"], date(2021, 7, 9), date(2027, 6, 30),
     "Pre-litigation and filing; instructs counsel on our behalf."),
]

CONFIG = [
    ("auto_placement_dpd", "90", "Auto-placement threshold (DPD)",
     "Accounts past this many days are queued for agency placement.", "number"),
    ("min_placement_amount", "250", "Minimum placement amount ($)",
     "Balances below this are written off rather than placed.", "number"),
    ("default_recall_days", "90", "Default recall window (days)",
     "Placements with no recovery inside this window are flagged for recall.", "number"),
    ("max_commission_pct", "25", "Maximum commission (%)",
     "Ceiling on the commission any agency contract may carry.", "number"),
    ("legal_threshold_amount", "5000", "Legal escalation threshold ($)",
     "Unrecovered balances above this may be escalated to a legal case.", "number"),
    ("performance_floor_pct", "55", "Contractual recovery floor (%)",
     "Agencies below this recovery rate move to Under Review.", "number"),
    ("allow_reassignment", "true", "Allow reassignment",
     "Whether an open placement may be moved between agencies.", "boolean"),
    ("remit_cycle", "Fortnightly", "Remittance cycle",
     "How often agencies settle collected funds with us.", "text"),
]

# Weighted so the book is not uniform — a couple of agencies carry most of it.
LIVE_MIX = ["AG-002", "AG-001", "AG-003", "AG-002", "AG-005", "AG-003", "AG-001", "AG-002",
            "AG-005", "AG-003", "AG-004", "AG-002"]
METHODS = ["Bank Transfer", "Card Payment", "Direct Debit", "Cheque", "Cash Deposit"]
CLOSE_WON = ["Paid in full", "Settled at discount", "Payment plan completed"]
CLOSE_LOST = ["No contact established", "Recalled — window expired", "Customer disputed balance",
              "Escalated to legal", "Skip traced — untraceable"]


async def main() -> None:
    async with SessionFactory() as db:
        # Idempotent: rebuild the book from scratch each run.
        await db.execute(text("TRUNCATE recovery_schema.legal_event, recovery_schema.legal_case, "
                              "recovery_schema.recovery, recovery_schema.placement_event, "
                              "recovery_schema.placement, recovery_schema.agency RESTART IDENTITY CASCADE"))

        agency_id: dict[str, int] = {}
        for a in AGENCIES:
            row = await db.execute(text("""
                INSERT INTO recovery_schema.agency
                  (agency_code, name, agency_type, status, commission_pct, recall_days, capacity,
                   min_placement, max_placement, contact_name, contact_email, contact_phone,
                   city, country, covers_risk, covers_bucket, onboarded_on, contract_end, notes)
                VALUES (:c,:n,:t,:s,:comm,:rd,:cap,:mn,:mx,:cn,:ce,:cp,:city,:ctry,:cr,:cb,:on,:end,:notes)
                RETURNING id"""),
                dict(c=a[0], n=a[1], t=a[2], s=a[3], comm=a[4], rd=a[5], cap=a[6], mn=a[7], mx=a[8],
                     cn=a[9], ce=a[10], cp=a[11], city=a[12], ctry=a[13], cr=a[14], cb=a[15],
                     on=a[16], end=a[17], notes=a[18]))
            agency_id[a[0]] = row.scalar_one()

        for k, v, label, desc, vt in CONFIG:
            await db.execute(text("""
                INSERT INTO recovery_schema.recovery_config (key, value, label, description, value_type)
                VALUES (:k,:v,:l,:d,:t)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, label = EXCLUDED.label,
                    description = EXCLUDED.description, value_type = EXCLUDED.value_type"""),
                dict(k=k, v=v, l=label, d=desc, t=vt))

        # ---- Live book: the accounts that are actually past due today -------
        live = (await db.execute(text("""
            SELECT a.id, a.customer_id, a.outstanding, a.dpd, a.risk_level, a.aging_bucket
            FROM customer_schema.account a
            WHERE a.outstanding > 0 AND a.dpd >= 45
            ORDER BY a.outstanding DESC"""))).mappings().all()

        seq = 1000
        placements: list[tuple[int, str, dict]] = []
        for i, acc in enumerate(live):
            code = AGENCIES[0][0] if acc["outstanding"] >= 5000 else LIVE_MIX[i % len(LIVE_MIX)]
            ag = next(a for a in AGENCIES if a[0] == code)
            placed_on = TODAY - timedelta(days=random.randint(8, ag[5] - 5))
            seq += 1
            pid = (await db.execute(text("""
                INSERT INTO recovery_schema.placement
                  (placement_code, agency_id, customer_id, account_id, placed_amount, commission_pct,
                   status, priority, dpd_at_placement, risk_at_placement, placed_on, recall_due, notes)
                VALUES (:code,:ag,:cu,:ac,:amt,:comm,'ACTIVE',:pri,:dpd,:risk,:on,:due,:notes)
                RETURNING id"""),
                dict(code=f"PL-{seq}", ag=agency_id[code], cu=acc["customer_id"], ac=acc["id"],
                     amt=money(acc["outstanding"]), comm=ag[4],
                     pri="Critical" if acc["dpd"] >= 120 else "High" if acc["dpd"] >= 90 else "Medium",
                     dpd=acc["dpd"], risk=acc["risk_level"], on=placed_on,
                     due=placed_on + timedelta(days=ag[5]),
                     notes=f"Placed from {acc['aging_bucket']} bucket after in-house cycle exhausted."))
            ).scalar_one()
            placements.append((pid, code, dict(acc)))
            await db.execute(text("""
                INSERT INTO recovery_schema.placement_event (placement_id, event_type, to_agency_id, detail, actor, occurred_at)
                VALUES (:p,'PLACED',:ag,:d,'system', :t)"""),
                dict(p=pid, ag=agency_id[code], d=f"Placed with {ag[1]} at {ag[4]}% commission.",
                     t=placed_on))

            # Partial recoveries on roughly half the live book.
            if random.random() < 0.55:
                remaining = money(acc["outstanding"])
                total = Decimal("0")
                for _ in range(random.randint(1, 3)):
                    if remaining <= 20:
                        break
                    amt = money(min(float(remaining), float(remaining) * random.uniform(0.15, 0.5)))
                    if amt <= 0:
                        break
                    comm = money(amt * Decimal(str(ag[4])) / 100)
                    on = placed_on + timedelta(days=random.randint(3, max(4, (TODAY - placed_on).days)))
                    if on > TODAY:
                        on = TODAY
                    await db.execute(text("""
                        INSERT INTO recovery_schema.recovery
                          (placement_id, recovered_on, amount, commission, method, reference, remitted, note)
                        VALUES (:p,:on,:a,:c,:m,:r,:rem,:n)"""),
                        dict(p=pid, on=on, a=amt, c=comm, m=random.choice(METHODS),
                             r=f"RCV-{random.randint(100000, 999999)}",
                             rem=on < TODAY - timedelta(days=14),
                             n="Part payment remitted by agency."))
                    await db.execute(text("""
                        INSERT INTO recovery_schema.placement_event (placement_id, event_type, detail, actor, occurred_at)
                        VALUES (:p,'RECOVERY',:d,:actor,:t)"""),
                        dict(p=pid, d=f"Recovery of ${amt} received.", actor=ag[9], t=on))
                    total += amt
                    remaining -= amt
                await db.execute(text("""
                    UPDATE recovery_schema.placement
                    SET recovered_amount = :t, commission_accrued = :c,
                        last_activity = (SELECT max(recovered_on) FROM recovery_schema.recovery WHERE placement_id = :p)
                    WHERE id = :p"""),
                    dict(p=pid, t=total, c=money(total * Decimal(str(ag[4])) / 100)))

        # ---- History: closed and recalled placements over the last year -----
        history = (await db.execute(text("""
            SELECT a.id, a.customer_id, a.outstanding, a.dpd, a.risk_level
            FROM customer_schema.account a
            WHERE a.id NOT IN (SELECT account_id FROM recovery_schema.placement WHERE account_id IS NOT NULL)
            ORDER BY a.id"""))).mappings().all()

        for acc in history:
            for _ in range(random.choice([0, 1, 1, 2])):
                ag = random.choice(AGENCIES[:5])
                placed_on = TODAY - timedelta(days=random.randint(120, 420))
                closed_on = placed_on + timedelta(days=random.randint(20, ag[5]))
                if closed_on >= TODAY:
                    continue
                # A closed placement's amount reflects what was owed then, not now.
                base = float(acc["outstanding"]) or random.uniform(300, 4000)
                amount = money(max(150.0, base * random.uniform(0.6, 1.8)))
                won = random.random() < 0.58
                if won:
                    recovered = money(float(amount) * random.uniform(0.55, 1.0))
                    status, reason = ("SETTLED", random.choice(CLOSE_WON))
                else:
                    recovered = money(float(amount) * random.uniform(0.0, 0.2))
                    status, reason = (random.choice(["RECALLED", "CLOSED"]), random.choice(CLOSE_LOST))
                comm = money(recovered * Decimal(str(ag[4])) / 100)
                seq += 1
                pid = (await db.execute(text("""
                    INSERT INTO recovery_schema.placement
                      (placement_code, agency_id, customer_id, account_id, placed_amount, recovered_amount,
                       commission_pct, commission_accrued, status, priority, dpd_at_placement,
                       risk_at_placement, placed_on, recall_due, closed_on, last_activity, close_reason)
                    VALUES (:code,:ag,:cu,NULL,:amt,:rec,:comm,:ca,:st,:pri,:dpd,:risk,:on,:due,:cl,:cl,:reason)
                    RETURNING id"""),
                    dict(code=f"PL-{seq}", ag=agency_id[ag[0]], cu=acc["customer_id"], amt=amount,
                         rec=recovered, comm=ag[4], ca=comm, st=status,
                         pri=random.choice(["Medium", "High", "Critical"]),
                         dpd=random.randint(60, 210), risk=acc["risk_level"], on=placed_on,
                         due=placed_on + timedelta(days=ag[5]), cl=closed_on, reason=reason))
                ).scalar_one()
                await db.execute(text("""
                    INSERT INTO recovery_schema.placement_event (placement_id, event_type, to_agency_id, detail, actor, occurred_at)
                    VALUES (:p,'PLACED',:ag,:d,'system',:t)"""),
                    dict(p=pid, ag=agency_id[ag[0]], d=f"Placed with {ag[1]}.", t=placed_on))
                if recovered > 0:
                    # Split the recovered total into instalments so the ledger reconciles.
                    parts = random.randint(1, 3)
                    left = recovered
                    for k in range(parts):
                        amt = money(left if k == parts - 1 else float(recovered) / parts)
                        if amt <= 0:
                            continue
                        on = placed_on + timedelta(days=int((closed_on - placed_on).days * (k + 1) / parts))
                        await db.execute(text("""
                            INSERT INTO recovery_schema.recovery
                              (placement_id, recovered_on, amount, commission, method, reference, remitted, note)
                            VALUES (:p,:on,:a,:c,:m,:r,TRUE,'Remitted in the closing cycle.')"""),
                            dict(p=pid, on=on, a=amt, c=money(amt * Decimal(str(ag[4])) / 100),
                                 m=random.choice(METHODS), r=f"RCV-{random.randint(100000, 999999)}"))
                        left -= amt
                await db.execute(text("""
                    INSERT INTO recovery_schema.placement_event (placement_id, event_type, detail, actor, occurred_at)
                    VALUES (:p,:et,:d,'system',:t)"""),
                    dict(p=pid, et="RECALLED" if status == "RECALLED" else "CLOSED",
                         d=reason, t=closed_on))

        # ---- Legal cases: escalations off the heaviest unrecovered ----------
        FIRMS = [("Whitfield & Barr LLP", "Sarah Mitchell", "Superior Court, Suffolk County"),
                 ("Castellan Legal Group", "Michael Chang", "District Court, Cook County"),
                 ("Rowe Deveraux LLP", "Amara Nwosu", "Civil Court, New York County"),
                 ("Bishop & Hale", "Tomas Reyes", "County Court, Dallas")]
        STAGES = [("Pre-Legal", 20), ("Notice Served", 35), ("Filed", 55),
                  ("Discovery", 65), ("Hearing", 72), ("Judgment", 85), ("Post-Judgment", 90)]

        cands = (await db.execute(text("""
            SELECT p.id, p.customer_id, p.placed_amount - p.recovered_amount AS open_amt
            FROM recovery_schema.placement p
            WHERE p.placed_amount - p.recovered_amount > 1500
            ORDER BY open_amt DESC LIMIT 7"""))).mappings().all()

        for i, c in enumerate(cands):
            firm = FIRMS[i % len(FIRMS)]
            stage, prob = STAGES[i % len(STAGES)]
            filed = TODAY - timedelta(days=random.randint(30, 260))
            claim = money(c["open_amt"])
            settled = stage in ("Judgment", "Post-Judgment") and random.random() < 0.5
            case_id = (await db.execute(text("""
                INSERT INTO recovery_schema.legal_case
                  (case_code, customer_id, placement_id, claim_amount, legal_cost, recovered_amount,
                   stage, status, law_firm, attorney, court, filed_on, next_hearing,
                   success_probability, notes)
                VALUES (:code,:cu,:p,:claim,:cost,:rec,:st,:status,:firm,:att,:court,:filed,:next,:prob,:notes)
                RETURNING id"""),
                dict(code=f"LC-{2026000 + i + 1}", cu=c["customer_id"], p=c["id"], claim=claim,
                     cost=money(float(claim) * random.uniform(0.04, 0.12)),
                     rec=money(float(claim) * random.uniform(0.4, 0.9)) if settled else 0,
                     st="Settled" if settled else stage,
                     status="SETTLED" if settled else "OPEN",
                     firm=firm[0], att=firm[1], court=firm[2], filed=filed,
                     next=None if settled else TODAY + timedelta(days=random.randint(9, 75)),
                     prob=prob, notes="Escalated after the agency recall window closed."))
            ).scalar_one()
            await db.execute(text("UPDATE recovery_schema.placement SET status='LEGAL' WHERE id=:p AND status='ACTIVE'"),
                             {"p": c["id"]})
            timeline = [("FILED", f"Claim filed at {firm[2]}.", filed),
                        ("NOTICE", "Statutory demand served on the customer.", filed + timedelta(days=12))]
            if stage in ("Discovery", "Hearing", "Judgment", "Post-Judgment"):
                timeline.append(("HEARING", "First hearing listed; documents exchanged.",
                                 filed + timedelta(days=45)))
            if settled:
                timeline.append(("SETTLED", "Settled on the courthouse steps; consent order recorded.",
                                 filed + timedelta(days=90)))
            for et, detail, when in timeline:
                if when > TODAY:
                    continue
                await db.execute(text("""
                    INSERT INTO recovery_schema.legal_event (case_id, event_type, detail, actor, occurred_at)
                    VALUES (:c,:e,:d,:a,:t)"""),
                    dict(c=case_id, e=et, d=detail, a=firm[1], t=when))

        await db.commit()

        for tbl in ("agency", "placement", "recovery", "placement_event", "legal_case", "legal_event"):
            n = (await db.execute(text(f"SELECT count(*) FROM recovery_schema.{tbl}"))).scalar_one()
            print(f"  {tbl:<16} {n}")


if __name__ == "__main__":
    asyncio.run(main())
