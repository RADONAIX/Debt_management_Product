"""Recovery Workspace service.

Reads run as SQL against ``recovery_schema`` joined to the customer book, so a
placement always carries the live customer it belongs to. Writes keep two
invariants: a placement's ``recovered_amount`` always equals the sum of its
recovery ledger, and every state change leaves a ``placement_event`` behind.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.recovery import schemas

# Identity always resolves against the customer of record: the company table
# names an enterprise, the customer table names a consumer. Nothing about a
# customer is stored in recovery_schema.
_CUST_NAME = "COALESCE(co.name, c.full_name, c.customer_code)"
_CUST_JOIN = """
JOIN customer_schema.customer c ON c.id = p.customer_id
LEFT JOIN customer_schema.company co ON co.id = c.company_id
"""

_PLACEMENT_SELECT = f"""
SELECT p.id, p.placement_code, p.placed_amount, p.recovered_amount, p.commission_pct,
       p.commission_accrued, p.status, p.priority,
       p.placed_on, p.recall_due, p.closed_on, p.last_activity, p.close_reason, p.notes,
       ag.agency_code, ag.name AS agency_name,
       c.customer_code, {_CUST_NAME} AS customer_name, c.customer_type,
       co.name AS company_name, co.company_code,
       acc.account_code,
       -- Delinquency and risk are read live from the account and the customer,
       -- so the board can never show a stale copy of either.
       COALESCE(acc.dpd, 0) AS dpd, COALESCE(acc.risk_level, c.risk_level) AS risk_level
FROM recovery_schema.placement p
JOIN recovery_schema.agency ag ON ag.id = p.agency_id
{_CUST_JOIN}
LEFT JOIN customer_schema.account acc ON acc.id = p.account_id
"""


def _placement_row(r) -> schemas.PlacementRow:
    placed = float(r["placed_amount"])
    recovered = float(r["recovered_amount"])
    end = r["closed_on"] or dt.date.today()
    open_amt = round(placed - recovered, 2)
    return schemas.PlacementRow(
        id=r["id"],
        code=r["placement_code"],
        agencyId=r["agency_code"],
        agencyName=r["agency_name"],
        customerId=r["customer_code"],
        customerName=r["customer_name"],
        customerType=r["customer_type"],
        accountCode=r["account_code"],
        placedAmount=round(placed, 2),
        recoveredAmount=round(recovered, 2),
        openAmount=open_amt,
        recoveryPct=round(recovered / placed * 100, 1) if placed else 0,
        commissionPct=float(r["commission_pct"]),
        commissionAccrued=round(float(r["commission_accrued"]), 2),
        status=r["status"],
        priority=r["priority"],
        dpd=r["dpd"],
        riskLevel=r["risk_level"],
        companyName=r["company_name"],
        companyId=r["company_code"],
        placedOn=r["placed_on"],
        recallDue=r["recall_due"],
        closedOn=r["closed_on"],
        lastActivity=r["last_activity"],
        closeReason=r["close_reason"],
        notes=r["notes"],
        daysWithAgency=(end - r["placed_on"]).days,
        overdueRecall=bool(
            r["status"] in ("ACTIVE", "LEGAL")
            and r["recall_due"]
            and r["recall_due"] < dt.date.today()
            and open_amt > 0
        ),
    )


# --------------------------------------------------------------------------
# Agencies
# --------------------------------------------------------------------------
async def list_agencies(db: AsyncSession) -> list[schemas.AgencyRow]:
    rows = (await db.execute(text("""
        SELECT ag.*,
               COUNT(p.id) FILTER (WHERE p.status IN ('ACTIVE','LEGAL'))        AS active_n,
               COALESCE(SUM(p.placed_amount), 0)                                 AS placed,
               COALESCE(SUM(p.recovered_amount), 0)                              AS recovered,
               COALESCE(SUM(p.commission_accrued), 0)                            AS commission,
               AVG(p.closed_on - p.placed_on) FILTER (WHERE p.closed_on IS NOT NULL
                                                       AND p.recovered_amount > 0) AS avg_days
        FROM recovery_schema.agency ag
        LEFT JOIN recovery_schema.placement p ON p.agency_id = ag.id
        GROUP BY ag.id
        ORDER BY ag.name"""))).mappings().all()

    out: list[schemas.AgencyRow] = []
    for r in rows:
        placed, recovered = float(r["placed"]), float(r["recovered"])
        rate = round(recovered / placed * 100, 1) if placed else 0.0
        speed = float(r["avg_days"]) if r["avg_days"] is not None else None
        # Performance blends what they recover with how fast, then penalises a
        # suspended contract — the same shape a scorecard review would take.
        score = rate * 0.75
        if speed is not None:
            score += max(0.0, 25 - speed / 6)
        if r["status"] != "ACTIVE":
            score *= 0.8
        out.append(schemas.AgencyRow(
            id=r["agency_code"], name=r["name"], type=r["agency_type"], status=r["status"],
            commissionPct=float(r["commission_pct"]), recallDays=r["recall_days"],
            capacity=r["capacity"], minPlacement=float(r["min_placement"]),
            maxPlacement=float(r["max_placement"]) if r["max_placement"] is not None else None,
            contactName=r["contact_name"], contactEmail=r["contact_email"],
            contactPhone=r["contact_phone"], city=r["city"], country=r["country"],
            coversRisk=list(r["covers_risk"] or []), coversBucket=list(r["covers_bucket"] or []),
            onboardedOn=r["onboarded_on"], contractEnd=r["contract_end"], notes=r["notes"],
            activePlacements=r["active_n"], totalPlaced=round(placed, 2),
            totalRecovered=round(recovered, 2), recoveryRate=rate,
            commissionEarned=round(float(r["commission"]), 2),
            avgDaysToRecover=round(speed, 1) if speed is not None else None,
            performanceScore=int(min(100, round(score))),
            utilisationPct=round(r["active_n"] / r["capacity"] * 100, 1) if r["capacity"] else 0,
        ))
    return out


async def _agency_id(db: AsyncSession, code: str) -> int:
    row = (await db.execute(
        text("SELECT id FROM recovery_schema.agency WHERE agency_code = :c"), {"c": code}
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown agency {code}")
    return row


async def create_agency(db: AsyncSession, p: schemas.AgencyWrite) -> str:
    code = (await db.execute(text("""
        SELECT 'AG-' || LPAD((COALESCE(MAX(SUBSTRING(agency_code FROM 4)::int), 0) + 1)::text, 3, '0')
        FROM recovery_schema.agency"""))).scalar_one()
    await db.execute(text("""
        INSERT INTO recovery_schema.agency
          (agency_code, name, agency_type, status, commission_pct, recall_days, capacity,
           min_placement, max_placement, contact_name, contact_email, contact_phone, city, country,
           covers_risk, covers_bucket, onboarded_on, contract_end, notes)
        VALUES (:code,:n,:t,:s,:comm,:rd,:cap,:mn,:mx,:cn,:ce,:cp,:city,:ctry,:cr,:cb,CURRENT_DATE,:end,:notes)"""),
        dict(code=code, n=p.name, t=p.type, s=p.status, comm=p.commissionPct, rd=p.recallDays,
             cap=p.capacity, mn=p.minPlacement, mx=p.maxPlacement, cn=p.contactName,
             ce=p.contactEmail, cp=p.contactPhone, city=p.city, ctry=p.country,
             cr=p.coversRisk, cb=p.coversBucket, end=p.contractEnd, notes=p.notes))
    await db.commit()
    return code


async def update_agency(db: AsyncSession, code: str, p: schemas.AgencyWrite) -> None:
    await _agency_id(db, code)
    await db.execute(text("""
        UPDATE recovery_schema.agency SET
          name=:n, agency_type=:t, status=:s, commission_pct=:comm, recall_days=:rd, capacity=:cap,
          min_placement=:mn, max_placement=:mx, contact_name=:cn, contact_email=:ce,
          contact_phone=:cp, city=:city, country=:ctry, covers_risk=:cr, covers_bucket=:cb,
          contract_end=:end, notes=:notes, updated_at=now()
        WHERE agency_code=:code"""),
        dict(code=code, n=p.name, t=p.type, s=p.status, comm=p.commissionPct, rd=p.recallDays,
             cap=p.capacity, mn=p.minPlacement, mx=p.maxPlacement, cn=p.contactName,
             ce=p.contactEmail, cp=p.contactPhone, city=p.city, ctry=p.country,
             cr=p.coversRisk, cb=p.coversBucket, end=p.contractEnd, notes=p.notes))
    await db.commit()


async def delete_agency(db: AsyncSession, code: str) -> None:
    aid = await _agency_id(db, code)
    open_n = (await db.execute(text(
        "SELECT count(*) FROM recovery_schema.placement WHERE agency_id=:a AND status IN ('ACTIVE','LEGAL')"
    ), {"a": aid})).scalar_one()
    if open_n:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{open_n} placement(s) are still open with this agency. Recall or reassign them first.",
        )
    await db.execute(text("DELETE FROM recovery_schema.placement WHERE agency_id=:a"), {"a": aid})
    await db.execute(text("DELETE FROM recovery_schema.agency WHERE id=:a"), {"a": aid})
    await db.commit()


# --------------------------------------------------------------------------
# Placements
# --------------------------------------------------------------------------
async def list_placements(
    db: AsyncSession,
    *,
    agency: str | None = None,
    status_f: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    overdue: bool = False,
) -> list[schemas.PlacementRow]:
    where, params = ["1=1"], {}
    if agency:
        where.append("ag.agency_code = :ag")
        params["ag"] = agency
    if status_f:
        where.append("p.status = :st")
        params["st"] = status_f
    if priority:
        where.append("p.priority = :pri")
        params["pri"] = priority
    if search:
        where.append(f"({_CUST_NAME} ILIKE :q OR c.customer_code ILIKE :q "
                     "OR p.placement_code ILIKE :q OR ag.name ILIKE :q)")
        params["q"] = f"%{search}%"
    if overdue:
        where.append("p.status IN ('ACTIVE','LEGAL') AND p.recall_due < CURRENT_DATE "
                     "AND p.placed_amount > p.recovered_amount")
    sql = f"{_PLACEMENT_SELECT} WHERE {' AND '.join(where)} ORDER BY p.status, p.placed_on DESC"
    rows = (await db.execute(text(sql), params)).mappings().all()
    return [_placement_row(r) for r in rows]


async def placement_detail(db: AsyncSession, pid: int) -> schemas.PlacementDetail:
    row = (await db.execute(text(f"{_PLACEMENT_SELECT} WHERE p.id = :id"), {"id": pid})).mappings().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Placement not found")
    recs = (await db.execute(text("""
        SELECT * FROM recovery_schema.recovery WHERE placement_id = :id ORDER BY recovered_on DESC, id DESC"""),
        {"id": pid})).mappings().all()
    events = (await db.execute(text("""
        SELECT e.id, e.event_type, e.detail, e.actor, e.occurred_at,
               fa.name AS from_agency, ta.name AS to_agency
        FROM recovery_schema.placement_event e
        LEFT JOIN recovery_schema.agency fa ON fa.id = e.from_agency_id
        LEFT JOIN recovery_schema.agency ta ON ta.id = e.to_agency_id
        WHERE e.placement_id = :id ORDER BY e.occurred_at DESC, e.id DESC"""),
        {"id": pid})).mappings().all()
    return schemas.PlacementDetail(
        placement=_placement_row(row),
        recoveries=[schemas.RecoveryRow(
            id=r["id"], placementId=r["placement_id"], recoveredOn=r["recovered_on"],
            amount=float(r["amount"]), commission=float(r["commission"]), method=r["method"],
            reference=r["reference"], remitted=r["remitted"], note=r["note"],
        appliedToAccount=r["applied_to_account"]) for r in recs],
        events=[schemas.EventRow(
            id=e["id"], type=e["event_type"], detail=e["detail"], actor=e["actor"],
            occurredAt=e["occurred_at"], fromAgency=e["from_agency"], toAgency=e["to_agency"])
            for e in events],
    )


async def _log(db: AsyncSession, pid: int, etype: str, detail: str, actor: str,
               from_agency: int | None = None, to_agency: int | None = None) -> None:
    await db.execute(text("""
        INSERT INTO recovery_schema.placement_event
          (placement_id, event_type, from_agency_id, to_agency_id, detail, actor)
        VALUES (:p,:e,:f,:t,:d,:a)"""),
        dict(p=pid, e=etype, f=from_agency, t=to_agency, d=detail, a=actor))


async def create_placement(db: AsyncSession, p: schemas.PlacementCreate, actor: str) -> int:
    aid = await _agency_id(db, p.agencyId)
    ag = (await db.execute(text(
        "SELECT name, commission_pct, recall_days, min_placement, max_placement, capacity, status "
        "FROM recovery_schema.agency WHERE id=:a"), {"a": aid})).mappings().one()
    if ag["status"] != "ACTIVE":
        raise HTTPException(status.HTTP_409_CONFLICT, f"{ag['name']} is {ag['status'].lower()} and cannot take placements.")
    if p.placedAmount < float(ag["min_placement"]):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"{ag['name']} has a minimum placement of ${float(ag['min_placement']):,.0f}.")
    if ag["max_placement"] is not None and p.placedAmount > float(ag["max_placement"]):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"{ag['name']} has a maximum placement of ${float(ag['max_placement']):,.0f}.")
    open_n = (await db.execute(text(
        "SELECT count(*) FROM recovery_schema.placement WHERE agency_id=:a AND status IN ('ACTIVE','LEGAL')"),
        {"a": aid})).scalar_one()
    if open_n >= ag["capacity"]:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{ag['name']} is at capacity ({ag['capacity']}).")

    cust = (await db.execute(text(
        "SELECT id FROM customer_schema.customer WHERE customer_code = :c"), {"c": p.customerId})).scalar_one_or_none()
    if cust is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown customer {p.customerId}")

    if p.accountId:
        already = (await db.execute(text(
            "SELECT placement_code FROM recovery_schema.placement "
            "WHERE account_id=:i AND status IN ('ACTIVE','LEGAL')"), {"i": p.accountId})).scalar_one_or_none()
        if already:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"That account is already placed as {already}. Recall it first.")

    code = (await db.execute(text("""
        SELECT 'PL-' || (COALESCE(MAX(SUBSTRING(placement_code FROM 4)::int), 1000) + 1)::text
        FROM recovery_schema.placement"""))).scalar_one()
    pid = (await db.execute(text("""
        INSERT INTO recovery_schema.placement
          (placement_code, agency_id, customer_id, account_id, placed_amount, commission_pct,
           status, priority, placed_on, recall_due, notes)
        VALUES (:code,:ag,:cu,:ac,:amt,:comm,'ACTIVE',:pri,CURRENT_DATE,
                CURRENT_DATE + CAST(:rd AS int), :notes)
        RETURNING id"""),
        dict(code=code, ag=aid, cu=cust, ac=p.accountId, amt=p.placedAmount,
             comm=ag["commission_pct"], pri=p.priority,
             rd=ag["recall_days"], notes=p.notes))).scalar_one()
    await _log(db, pid, "PLACED",
               f"Placed with {ag['name']} at {float(ag['commission_pct'])}% commission.",
               actor, to_agency=aid)
    await db.commit()
    return pid


async def patch_placement(db: AsyncSession, pid: int, p: schemas.PlacementPatch, actor: str) -> None:
    cur = (await db.execute(text(
        "SELECT status, priority FROM recovery_schema.placement WHERE id=:i"), {"i": pid})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Placement not found")
    sets, params = [], {"i": pid}
    if p.priority and p.priority != cur["priority"]:
        sets.append("priority = :pri")
        params["pri"] = p.priority
        await _log(db, pid, "PRIORITY", f"Priority changed from {cur['priority']} to {p.priority}.", actor)
    if p.notes is not None:
        sets.append("notes = :notes")
        params["notes"] = p.notes
    if p.status and p.status != cur["status"]:
        if p.status not in ("ACTIVE", "RECALLED", "SETTLED", "CLOSED", "LEGAL"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown status {p.status}")
        sets.append("status = :st")
        params["st"] = p.status
        closing = p.status in ("RECALLED", "SETTLED", "CLOSED")
        sets.append("closed_on = " + ("CURRENT_DATE" if closing else "NULL"))
        if p.closeReason:
            sets.append("close_reason = :cr")
            params["cr"] = p.closeReason
        await _log(db, pid, p.status,
                   p.closeReason or f"Status changed from {cur['status']} to {p.status}.", actor)
    if not sets:
        return
    await db.execute(text(f"UPDATE recovery_schema.placement SET {', '.join(sets)}, updated_at=now() WHERE id=:i"), params)
    await db.commit()


async def reassign(db: AsyncSession, pid: int, req: schemas.ReassignRequest, actor: str) -> None:
    cur = (await db.execute(text("""
        SELECT p.agency_id, p.status, ag.name FROM recovery_schema.placement p
        JOIN recovery_schema.agency ag ON ag.id = p.agency_id WHERE p.id = :i"""),
        {"i": pid})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Placement not found")
    if cur["status"] not in ("ACTIVE", "LEGAL"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an open placement can be reassigned.")
    allowed = (await db.execute(text(
        "SELECT value FROM recovery_schema.recovery_config WHERE key='allow_reassignment'"))).scalar_one_or_none()
    if allowed is not None and allowed.lower() not in ("true", "1", "yes"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Reassignment is disabled in Recovery configuration.")

    new_id = await _agency_id(db, req.agencyId)
    if new_id == cur["agency_id"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "The placement is already with that agency.")
    new = (await db.execute(text(
        "SELECT name, commission_pct, recall_days, status FROM recovery_schema.agency WHERE id=:a"),
        {"a": new_id})).mappings().one()
    if new["status"] != "ACTIVE":
        raise HTTPException(status.HTTP_409_CONFLICT, f"{new['name']} is {new['status'].lower()}.")
    # The clock restarts with the new agency, on their commission and window.
    await db.execute(text("""
        UPDATE recovery_schema.placement
        SET agency_id = :a, commission_pct = :comm, placed_on = CURRENT_DATE,
            recall_due = CURRENT_DATE + CAST(:rd AS int), updated_at = now()
        WHERE id = :i"""),
        dict(a=new_id, comm=new["commission_pct"], rd=new["recall_days"], i=pid))
    await _log(db, pid, "REASSIGNED",
               req.reason or f"Reassigned from {cur['name']} to {new['name']}.",
               actor, from_agency=cur["agency_id"], to_agency=new_id)
    await db.commit()


# Workspace method names mapped onto the vocabulary customer_schema.payment
# already uses, so Subscriber 360 does not grow a second set of labels.
_METHOD_MAP = {
    "Bank Transfer": "Bank Transfer",
    "Card Payment": "Credit Card",
    "Direct Debit": "Auto-Debit",
    "Cheque": "Cheque",
    "Cash Deposit": "Cash",
}


async def add_recovery(db: AsyncSession, pid: int, r: schemas.RecoveryCreate, actor: str) -> None:
    cur = (await db.execute(text(
        "SELECT placed_amount, recovered_amount, commission_pct, status, customer_id, account_id, "
        "       (SELECT name FROM recovery_schema.agency WHERE id = agency_id) AS agency_name "
        "FROM recovery_schema.placement WHERE id=:i"), {"i": pid})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Placement not found")
    if cur["status"] not in ("ACTIVE", "LEGAL"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This placement is closed — recoveries cannot be posted to it.")
    open_amt = float(cur["placed_amount"]) - float(cur["recovered_amount"])
    if r.amount > open_amt + 0.01:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"Only ${open_amt:,.2f} is still open on this placement.")
    commission = round(r.amount * float(cur["commission_pct"]) / 100, 2)

    # A recovery is a payment: record it against the customer's account so the
    # money shows up in Subscriber 360, and take it off the outstanding balance.
    payment_id = None
    if cur["account_id"]:
        payment_id = (await db.execute(text("""
            INSERT INTO customer_schema.payment
              (payment_ref, customer_id, account_id, amount, payment_date, method_code, status, notes)
            VALUES (:ref, :cu, :ac, :amt, COALESCE(:on, CURRENT_DATE), :method, 'COMPLETED', :note)
            RETURNING id"""),
            dict(ref=r.reference or f"AGY-{pid}-{int(r.amount * 100)}", cu=cur["customer_id"],
                 ac=cur["account_id"], amt=r.amount, on=r.recoveredOn,
                 method=_METHOD_MAP.get(r.method, "Bank Transfer"),
                 note=f"Recovered by {cur['agency_name']}"))).scalar_one()
        # last_payment_at is a stored column 360 reads, so it moves too.
        await db.execute(text("""
            UPDATE customer_schema.account
            SET outstanding = GREATEST(0, outstanding - :amt),
                last_payment_at = GREATEST(COALESCE(last_payment_at, '-infinity'::timestamptz),
                                           COALESCE(:on, CURRENT_DATE)::timestamptz),
                updated_at = now()
            WHERE id = :i"""), {"amt": r.amount, "i": cur["account_id"], "on": r.recoveredOn})

    await db.execute(text("""
        INSERT INTO recovery_schema.recovery
          (placement_id, recovered_on, amount, commission, method, reference, note,
           payment_id, applied_to_account)
        VALUES (:p, COALESCE(:on, CURRENT_DATE), :a, :c, :m, :r, :n, :pay, :applied)"""),
        dict(p=pid, on=r.recoveredOn, a=r.amount, c=commission, m=r.method, r=r.reference,
             n=r.note, pay=payment_id, applied=payment_id is not None))
    # Recompute from the ledger so the two can never drift apart.
    await db.execute(text("""
        UPDATE recovery_schema.placement p SET
          recovered_amount = t.total, commission_accrued = t.comm,
          last_activity = t.last_on, updated_at = now(),
          status = CASE WHEN t.total >= p.placed_amount - 0.01 THEN 'SETTLED' ELSE p.status END,
          closed_on = CASE WHEN t.total >= p.placed_amount - 0.01 THEN CURRENT_DATE ELSE p.closed_on END,
          close_reason = CASE WHEN t.total >= p.placed_amount - 0.01
                              THEN 'Recovered in full' ELSE p.close_reason END
        FROM (SELECT COALESCE(SUM(amount),0) total, COALESCE(SUM(commission),0) comm,
                     MAX(recovered_on) last_on
              FROM recovery_schema.recovery WHERE placement_id = :i) t
        WHERE p.id = :i"""), {"i": pid})
    await _log(db, pid, "RECOVERY", f"Recovery of ${r.amount:,.2f} posted via {r.method}.", actor)
    settled = (await db.execute(text(
        "SELECT status FROM recovery_schema.placement WHERE id=:i"), {"i": pid})).scalar_one()
    if settled == "SETTLED":
        await _log(db, pid, "SETTLED", "Placement recovered in full and closed.", actor)
    await db.commit()


async def delete_recovery(db: AsyncSession, rid: int, actor: str) -> None:
    row = (await db.execute(text("""
        SELECT r.placement_id, r.amount, r.payment_id, r.applied_to_account, p.account_id
        FROM recovery_schema.recovery r
        JOIN recovery_schema.placement p ON p.id = r.placement_id
        WHERE r.id = :i"""), {"i": rid})).mappings().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recovery entry not found")
    pid = row["placement_id"]
    # Reversing gives the debt back to the account and removes the payment, so
    # the two screens never disagree about what was collected.
    if row["applied_to_account"] and row["account_id"]:
        await db.execute(text("""
            UPDATE customer_schema.account a
            SET outstanding = a.outstanding + :amt,
                last_payment_at = (SELECT MAX(p.payment_date)::timestamptz
                                   FROM customer_schema.payment p
                                   WHERE p.account_id = a.id AND p.id <> COALESCE(:pay, -1)),
                updated_at = now()
            WHERE a.id = :i"""),
            {"amt": row["amount"], "i": row["account_id"], "pay": row["payment_id"]})
    if row["payment_id"]:
        await db.execute(text("DELETE FROM customer_schema.payment WHERE id=:i"),
                         {"i": row["payment_id"]})
    await db.execute(text("DELETE FROM recovery_schema.recovery WHERE id=:i"), {"i": rid})
    await db.execute(text("""
        UPDATE recovery_schema.placement p SET
          recovered_amount = t.total, commission_accrued = t.comm, last_activity = t.last_on,
          updated_at = now()
        FROM (SELECT COALESCE(SUM(amount),0) total, COALESCE(SUM(commission),0) comm,
                     MAX(recovered_on) last_on
              FROM recovery_schema.recovery WHERE placement_id = :i) t
        WHERE p.id = :i"""), {"i": pid})
    await _log(db, pid, "ADJUSTED", "A recovery entry was reversed.", actor)
    await db.commit()


# --------------------------------------------------------------------------
# Legal
# --------------------------------------------------------------------------
async def list_legal(db: AsyncSession, status_f: str | None = None) -> list[schemas.LegalRow]:
    where = "WHERE lc.status = :st" if status_f else ""
    rows = (await db.execute(text(f"""
        SELECT lc.*, c.customer_code, {_CUST_NAME} AS customer_name, c.customer_type,
               c.risk_level, p.placement_code,
               (SELECT COALESCE(MAX(a.dpd), 0) FROM customer_schema.account a
                WHERE a.customer_id = c.id) AS dpd
        FROM recovery_schema.legal_case lc
        JOIN customer_schema.customer c ON c.id = lc.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        LEFT JOIN recovery_schema.placement p ON p.id = lc.placement_id
        {where}
        ORDER BY lc.status, lc.next_hearing NULLS LAST, lc.claim_amount DESC"""),
        {"st": status_f} if status_f else {})).mappings().all()
    events = (await db.execute(text("""
        SELECT id, case_id, event_type, detail, actor, occurred_at
        FROM recovery_schema.legal_event ORDER BY occurred_at DESC"""))).mappings().all()
    by_case: dict[int, list[schemas.EventRow]] = {}
    for e in events:
        by_case.setdefault(e["case_id"], []).append(schemas.EventRow(
            id=e["id"], type=e["event_type"], detail=e["detail"], actor=e["actor"],
            occurredAt=e["occurred_at"]))
    return [schemas.LegalRow(
        id=r["id"], code=r["case_code"], customerId=r["customer_code"],
        customerName=r["customer_name"], customerType=r["customer_type"],
        riskLevel=r["risk_level"], dpd=r["dpd"], placementCode=r["placement_code"],
        claimAmount=float(r["claim_amount"]), legalCost=float(r["legal_cost"]),
        recoveredAmount=float(r["recovered_amount"]), stage=r["stage"], status=r["status"],
        lawFirm=r["law_firm"], attorney=r["attorney"], court=r["court"], filedOn=r["filed_on"],
        nextHearing=r["next_hearing"],
        successProbability=float(r["success_probability"]) if r["success_probability"] is not None else None,
        outcome=r["outcome"], notes=r["notes"], events=by_case.get(r["id"], []),
    ) for r in rows]


_RISK_ORDER = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}


async def _cfg(db: AsyncSession, key: str, default: str) -> str:
    v = (await db.execute(text(
        "SELECT value FROM recovery_schema.recovery_config WHERE key=:k"), {"k": key})).scalar_one_or_none()
    return v if v is not None else default


async def create_legal(db: AsyncSession, p: schemas.LegalCreate, actor: str) -> int:
    row = (await db.execute(text("""
        SELECT c.id, c.risk_level, COALESCE(co.name, c.full_name, c.customer_code) AS name,
               (SELECT COALESCE(MAX(a.dpd), 0) FROM customer_schema.account a
                WHERE a.customer_id = c.id) AS dpd
        FROM customer_schema.customer c
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        WHERE c.customer_code = :c"""), {"c": p.customerId})).mappings().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown customer {p.customerId}")

    # Litigation is reserved for genuinely delinquent, high-risk debt. The bar
    # is configurable, and read from the customer of record rather than any
    # figure held on the placement.
    min_dpd = int(float(await _cfg(db, "legal_min_dpd", "90")))
    min_risk = await _cfg(db, "legal_min_risk", "High")
    floor = _RISK_ORDER.get(min_risk, 2)
    if _RISK_ORDER.get(row["risk_level"], 0) < floor:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{row['name']} is {row['risk_level']} risk. Legal escalation needs {min_risk} or worse.")
    if row["dpd"] < min_dpd:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{row['name']} is {row['dpd']} days past due. Legal escalation needs {min_dpd}+.")
    open_case = (await db.execute(text(
        "SELECT case_code FROM recovery_schema.legal_case WHERE customer_id=:i AND status='OPEN'"),
        {"i": row["id"]})).scalar_one_or_none()
    if open_case:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"{row['name']} already has an open case ({open_case}).")
    cust = row["id"]
    code = (await db.execute(text("""
        SELECT 'LC-' || (COALESCE(MAX(SUBSTRING(case_code FROM 4)::int), 2026000) + 1)::text
        FROM recovery_schema.legal_case"""))).scalar_one()
    cid = (await db.execute(text("""
        INSERT INTO recovery_schema.legal_case
          (case_code, customer_id, placement_id, claim_amount, stage, law_firm, attorney, court,
           filed_on, next_hearing, success_probability, notes)
        VALUES (:code,:cu,:p,:amt,:st,:firm,:att,:court,:filed,:next,:prob,:notes)
        RETURNING id"""),
        dict(code=code, cu=cust, p=p.placementId, amt=p.claimAmount, st=p.stage, firm=p.lawFirm,
             att=p.attorney, court=p.court, filed=p.filedOn, next=p.nextHearing,
             prob=p.successProbability, notes=p.notes))).scalar_one()
    await db.execute(text("""
        INSERT INTO recovery_schema.legal_event (case_id, event_type, detail, actor)
        VALUES (:c,'OPENED',:d,:a)"""),
        dict(c=cid, d=f"Legal case opened for a claim of ${p.claimAmount:,.2f}.", a=actor))
    if p.placementId:
        await db.execute(text(
            "UPDATE recovery_schema.placement SET status='LEGAL' WHERE id=:i AND status='ACTIVE'"),
            {"i": p.placementId})
        await _log(db, p.placementId, "LEGAL", f"Escalated to legal case {code}.", actor)
    await db.commit()
    return cid


async def patch_legal(db: AsyncSession, cid: int, p: schemas.LegalPatch, actor: str) -> None:
    cur = (await db.execute(text(
        "SELECT stage, status FROM recovery_schema.legal_case WHERE id=:i"), {"i": cid})).mappings().first()
    if cur is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Legal case not found")
    fields = {"stage": p.stage, "status": p.status, "law_firm": p.lawFirm, "attorney": p.attorney,
              "court": p.court, "next_hearing": p.nextHearing, "legal_cost": p.legalCost,
              "recovered_amount": p.recoveredAmount, "success_probability": p.successProbability,
              "outcome": p.outcome, "notes": p.notes}
    sets = {k: v for k, v in fields.items() if v is not None}
    if not sets:
        return
    clause = ", ".join(f"{k} = :{k}" for k in sets)
    await db.execute(text(f"UPDATE recovery_schema.legal_case SET {clause}, updated_at=now() WHERE id=:i"),
                     {**sets, "i": cid})
    if p.stage and p.stage != cur["stage"]:
        await db.execute(text("""
            INSERT INTO recovery_schema.legal_event (case_id, event_type, detail, actor)
            VALUES (:c,'STAGE',:d,:a)"""),
            dict(c=cid, d=f"Stage moved from {cur['stage']} to {p.stage}.", a=actor))
    if p.status and p.status != cur["status"]:
        await db.execute(text("""
            INSERT INTO recovery_schema.legal_event (case_id, event_type, detail, actor)
            VALUES (:c,'STATUS',:d,:a)"""),
            dict(c=cid, d=f"Case closed as {p.status}." if p.status != "OPEN" else "Case reopened.", a=actor))
    await db.commit()


async def delete_legal(db: AsyncSession, cid: int) -> None:
    n = (await db.execute(text("DELETE FROM recovery_schema.legal_case WHERE id=:i RETURNING id"),
                          {"i": cid})).scalar_one_or_none()
    if n is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Legal case not found")
    await db.commit()


# --------------------------------------------------------------------------
# Overview, config, eligibility
# --------------------------------------------------------------------------
async def summary(db: AsyncSession) -> schemas.Summary:
    k = (await db.execute(text("""
        SELECT
          COUNT(*) FILTER (WHERE status IN ('ACTIVE','LEGAL'))                       AS active_n,
          COALESCE(SUM(placed_amount), 0)                                            AS placed,
          COALESCE(SUM(recovered_amount), 0)                                         AS recovered,
          COALESCE(SUM(placed_amount - recovered_amount)
                   FILTER (WHERE status IN ('ACTIVE','LEGAL')), 0)                   AS open_val,
          COALESCE(SUM(commission_accrued), 0)                                       AS commission,
          COUNT(*) FILTER (WHERE status IN ('ACTIVE','LEGAL') AND recall_due < CURRENT_DATE
                             AND placed_amount > recovered_amount)                   AS overdue_n,
          AVG(closed_on - placed_on) FILTER (WHERE closed_on IS NOT NULL
                                               AND recovered_amount > 0)             AS avg_days
        FROM recovery_schema.placement"""))).mappings().one()
    legal = (await db.execute(text("""
        SELECT COUNT(*) FILTER (WHERE status='OPEN') AS open_n,
               COALESCE(SUM(claim_amount) FILTER (WHERE status='OPEN'), 0) AS claim
        FROM recovery_schema.legal_case"""))).mappings().one()
    agencies = (await db.execute(text("SELECT count(*) FROM recovery_schema.agency"))).scalar_one()
    mtd = (await db.execute(text("""
        SELECT COALESCE(SUM(amount), 0) FROM recovery_schema.recovery
        WHERE recovered_on >= date_trunc('month', CURRENT_DATE)"""))).scalar_one()
    trend = (await db.execute(text("""
        WITH months AS (
          SELECT generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
                                 date_trunc('month', CURRENT_DATE), INTERVAL '1 month')::date AS m
        )
        SELECT to_char(m, 'Mon YY') AS month,
               COALESCE((SELECT SUM(placed_amount) FROM recovery_schema.placement p
                         WHERE date_trunc('month', p.placed_on) = m), 0) AS placed,
               COALESCE((SELECT SUM(amount) FROM recovery_schema.recovery r
                         WHERE date_trunc('month', r.recovered_on) = m), 0) AS recovered,
               COALESCE((SELECT SUM(commission) FROM recovery_schema.recovery r
                         WHERE date_trunc('month', r.recovered_on) = m), 0) AS commission
        FROM months ORDER BY m"""))).mappings().all()

    placed, recovered = float(k["placed"]), float(k["recovered"])
    return schemas.Summary(
        activePlacements=k["active_n"], placedValue=round(placed, 2),
        recoveredValue=round(recovered, 2), openValue=round(float(k["open_val"]), 2),
        recoveryRate=round(recovered / placed * 100, 1) if placed else 0,
        commissionAccrued=round(float(k["commission"]), 2), overdueRecalls=k["overdue_n"],
        legalOpen=legal["open_n"], legalClaimValue=round(float(legal["claim"]), 2),
        agencies=agencies, recoveredThisMonth=round(float(mtd), 2),
        avgDaysToRecover=round(float(k["avg_days"]), 1) if k["avg_days"] is not None else None,
        trend=[schemas.TrendPoint(month=t["month"], placed=round(float(t["placed"]), 2),
                                  recovered=round(float(t["recovered"]), 2),
                                  commission=round(float(t["commission"]), 2)) for t in trend],
    )


async def recovery_ledger(db: AsyncSession, limit: int = 200) -> list[schemas.RecoveryRow]:
    rows = (await db.execute(text(f"""
        SELECT r.*, p.placement_code, ag.name AS agency_name, {_CUST_NAME} AS customer_name,
               c.customer_code
        FROM recovery_schema.recovery r
        JOIN recovery_schema.placement p ON p.id = r.placement_id
        JOIN recovery_schema.agency ag ON ag.id = p.agency_id
        JOIN customer_schema.customer c ON c.id = p.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        ORDER BY r.recovered_on DESC, r.id DESC LIMIT :n"""), {"n": limit})).mappings().all()
    return [schemas.RecoveryRow(
        id=r["id"], placementId=r["placement_id"], placementCode=r["placement_code"],
        agencyName=r["agency_name"], customerName=r["customer_name"], recoveredOn=r["recovered_on"],
        amount=float(r["amount"]), commission=float(r["commission"]), method=r["method"],
        reference=r["reference"], remitted=r["remitted"], note=r["note"],
        appliedToAccount=r["applied_to_account"], customerId=r["customer_code"]) for r in rows]


async def get_config(db: AsyncSession) -> list[schemas.ConfigRow]:
    rows = (await db.execute(text(
        "SELECT * FROM recovery_schema.recovery_config ORDER BY label"))).mappings().all()
    return [schemas.ConfigRow(key=r["key"], value=r["value"], label=r["label"],
                              description=r["description"], valueType=r["value_type"]) for r in rows]


async def save_config(db: AsyncSession, values: dict[str, str]) -> None:
    for k, v in values.items():
        await db.execute(text(
            "UPDATE recovery_schema.recovery_config SET value=:v, updated_at=now() WHERE key=:k"),
            {"k": k, "v": str(v)})
    await db.commit()


async def eligible_accounts(db: AsyncSession, search: str | None = None) -> list[schemas.EligibleAccount]:
    """Delinquent accounts not currently with an agency, worst first."""
    threshold = (await db.execute(text(
        "SELECT value FROM recovery_schema.recovery_config WHERE key='auto_placement_dpd'"))).scalar_one_or_none()
    minimum = (await db.execute(text(
        "SELECT value FROM recovery_schema.recovery_config WHERE key='min_placement_amount'"))).scalar_one_or_none()
    where, params = [
        "a.outstanding > :min",
        "a.id NOT IN (SELECT account_id FROM recovery_schema.placement "
        "WHERE account_id IS NOT NULL AND status IN ('ACTIVE','LEGAL'))",
    ], {"min": float(minimum or 0)}
    if search:
        where.append("(COALESCE(co.name, c.full_name) ILIKE :q OR a.account_code ILIKE :q "
                     "OR c.customer_code ILIKE :q)")
        params["q"] = f"%{search}%"
    rows = (await db.execute(text(f"""
        SELECT a.id, a.account_code, a.outstanding, a.dpd, a.aging_bucket, a.risk_level,
               c.customer_code, COALESCE(co.name, c.full_name, c.customer_code) AS customer_name,
               c.customer_type
        FROM customer_schema.account a
        JOIN customer_schema.customer c ON c.id = a.customer_id
        LEFT JOIN customer_schema.company co ON co.id = c.company_id
        WHERE {' AND '.join(where)}
        ORDER BY a.dpd DESC, a.outstanding DESC LIMIT 200"""), params)).mappings().all()
    # Anything past the auto-placement threshold sorts to the top by DPD already.
    _ = threshold
    return [schemas.EligibleAccount(
        accountId=r["id"], accountCode=r["account_code"], customerId=r["customer_code"],
        customerName=r["customer_name"], customerType=r["customer_type"],
        outstanding=round(float(r["outstanding"]), 2), dpd=r["dpd"],
        agingBucket=r["aging_bucket"], riskLevel=r["risk_level"]) for r in rows]


_ = Decimal  # kept for numeric parity with the rest of the modules
