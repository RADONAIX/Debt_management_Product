"""Performance Reports service.

Four registers, one shape. Each function builds a WHERE clause from the same
filter object, runs a COUNT + SUM over the whole filtered set (so the totals a
user sees describe the filter, not the page), then reads one page of rows.

Identity always resolves against the customer of record, so a row can never
show a stale copy of a name, type or region.
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.reports import schemas

_NAME = "COALESCE(c.full_name, c.company_name, c.customer_code)"

# ---------------------------------------------------------------------------
# Creation source
#
# Two answers only: did the system raise this work, or did a person?
#
#   Strategy Engine   — raised without anyone asking for it: a dunning step, a
#                       broken promise, an ageing or risk threshold, an
#                       escalation from legal, a dispute or an agency.
#   Collection Agent  — a person at the workspace created it.
#
# No column records this, so each register resolves the strongest evidence it
# has. collection.case_meta names the origin of every case and
# collection.case_source flags whether that origin is automated — that flag is
# what decides the label. With no case attached, the presence of a human on
# the record decides instead.
#
# The label is deliberately coarse, so the specific trigger and the person are
# both kept on the detail line: "Broken PTP · Robert Kim" says a broken promise
# opened the case and Robert recorded the new one.
# ---------------------------------------------------------------------------
SOURCE_STRATEGY = "Strategy Engine"
SOURCE_AGENT = "Collection Agent"
SOURCES = [SOURCE_AGENT, SOURCE_STRATEGY]


def _binary_source(human: str, case_alias: str = "cs") -> str:
    """The case's automation flag decides; failing that, whether a human is on the row."""
    return f"""
        CASE WHEN {case_alias}.code IS NOT NULL
                  THEN CASE WHEN {case_alias}.is_automated
                            THEN '{SOURCE_STRATEGY}' ELSE '{SOURCE_AGENT}' END
             WHEN {human} IS NOT NULL THEN '{SOURCE_AGENT}'
             ELSE '{SOURCE_STRATEGY}'
        END"""


def _source_detail(case_alias: str = "cs", person: str = "cu.full_name") -> str:
    """The precise trigger and the person, whichever of the two are known."""
    return f"""
        NULLIF(concat_ws(' · ',
            CASE WHEN {case_alias}.is_automated AND {case_alias}.code <> 'STRATEGY'
                 THEN {case_alias}.name END,
            {person}), '')"""


def _f(v) -> float:
    return float(v or 0)


def _days(since) -> int:
    """Whole days between a date/timestamp and today, floored at zero."""
    if since is None:
        return 0
    d = since.date() if isinstance(since, dt.datetime) else since
    return max(0, (dt.date.today() - d).days)


def _common(f: schemas.Filters, alias: str) -> tuple[list[str], dict]:
    """Filters that mean the same thing on every register."""
    clauses: list[str] = []
    params: dict = {}
    if f.status:
        clauses.append(f"{alias}.status = :status")
        params["status"] = f.status
    if f.customerScope == "consumer":
        clauses.append("c.customer_type = 'CONSUMER'")
    elif f.customerScope == "enterprise":
        clauses.append("c.customer_type <> 'CONSUMER'")
    if f.customerType:
        clauses.append("c.customer_type = :customer_type")
        params["customer_type"] = f.customerType.upper()
    if f.region:
        clauses.append("c.region_code = :region")
        params["region"] = f.region
    return clauses, params


def _search(f: schemas.Filters, cols: list[str], params: dict) -> str | None:
    """One case-insensitive contains across the row's identifying columns."""
    if not f.search:
        return None
    params["q"] = f"%{f.search.lower()}%"
    return "(" + " OR ".join(f"lower(COALESCE({c}, '')) LIKE :q" for c in cols) + ")"


def _order(sort: str | None, direction: str | None, allowed: dict[str, str], default: str) -> str:
    """Sorting is whitelisted — the client sends a key, never a column."""
    col = allowed.get(sort or "", default)
    dirn = "ASC" if (direction or "").lower() == "asc" else "DESC"
    return f"{col} {dirn} NULLS LAST"


async def _totals(db: AsyncSession, sql: str, params: dict) -> tuple[int, float]:
    row = (await db.execute(text(sql), params)).mappings().first()
    if row is None:
        return 0, 0.0
    return int(row["n"] or 0), round(_f(row["amt"]), 2)


# --------------------------------------------------------------------------
# Promises to pay
# --------------------------------------------------------------------------
# The case's own origin wins: a promise recorded inside a strategy-generated
# case is strategy-driven work, and the agent who keyed it is shown alongside.
_PTP_SOURCE = _binary_source("p.created_by")
_PTP_SOURCE_DETAIL = _source_detail()
_PTP_SOURCE_JOINS = """
        LEFT JOIN administration.app_user cu ON cu.id = p.created_by
        LEFT JOIN collection.case_meta cm    ON cm.case_id = p.case_id
        LEFT JOIN collection.case_source cs  ON cs.code = cm.source_code
"""

_PTP_SORTS = {
    "promisedDate": "p.promised_date",
    "promisedAmount": "p.promised_amount",
    "keptAmount": "p.kept_amount",
    "customerName": _NAME,
    "status": "p.status",
    "daysOverdue": "(CURRENT_DATE - p.promised_date)",
    "source": _PTP_SOURCE,
}


async def list_ptps(
    db: AsyncSession, f: schemas.Filters, *, sort: str | None, direction: str | None,
    limit: int, offset: int,
) -> schemas.PtpPage:
    clauses, params = _common(f, "p")
    if f.channel:
        clauses.append("COALESCE(md.label, p.channel_code) = :channel")
        params["channel"] = f.channel
    if f.dateFrom:
        clauses.append("p.promised_date >= :date_from")
        params["date_from"] = f.dateFrom
    if f.dateTo:
        clauses.append("p.promised_date <= :date_to")
        params["date_to"] = f.dateTo
    if f.source:
        clauses.append(f"{_PTP_SOURCE} = :source")
        params["source"] = f.source
    s = _search(f, ["p.ptp_code", _NAME, "c.customer_code", "a.account_code"], params)
    if s:
        clauses.append(s)
    where = " AND ".join(clauses) or "TRUE"

    frm = f"""
        FROM customer_schema.ptp p
        JOIN customer_schema.customer c ON c.id = p.customer_id
        LEFT JOIN customer_schema.account a ON a.id = p.account_id
        LEFT JOIN administration.app_user u ON u.id = p.created_by
        LEFT JOIN administration.master_data md
               ON md.category = 'CHANNEL' AND md.code = p.channel_code
        {_PTP_SOURCE_JOINS}
        WHERE {where}
    """
    total, amount = await _totals(
        db, f"SELECT count(*) AS n, COALESCE(sum(p.promised_amount), 0) AS amt {frm}", params
    )

    params |= {"limit": limit, "offset": offset}
    rows = (await db.execute(text(f"""
        SELECT p.id, p.ptp_code, p.promised_amount, p.kept_amount, p.promised_date,
               p.status, p.ai_probability,
               COALESCE(md.label, p.channel_code) AS channel,
               c.customer_code, {_NAME} AS customer_name, c.customer_type,
               a.account_code, u.full_name AS agent_name,
               {_PTP_SOURCE} AS source, {_PTP_SOURCE_DETAIL} AS source_detail
        {frm}
        ORDER BY {_order(sort, direction, _PTP_SORTS, 'p.promised_date')}
        LIMIT :limit OFFSET :offset
    """), params)).mappings().all()

    today = dt.date.today()
    return schemas.PtpPage(
        total=total, totalAmount=amount,
        rows=[schemas.PtpRow(
            id=r["id"], code=r["ptp_code"],
            customerId=r["customer_code"], customerName=r["customer_name"],
            customerType=r["customer_type"], accountCode=r["account_code"],
            promisedAmount=round(_f(r["promised_amount"]), 2),
            keptAmount=round(_f(r["kept_amount"]), 2),
            promisedDate=r["promised_date"], status=r["status"],
            channel=r["channel"], agentName=r["agent_name"],
            source=r["source"], sourceDetail=r["source_detail"],
            daysOverdue=(max(0, (today - r["promised_date"]).days)
                         if r["status"] in ("PENDING", "BROKEN") else 0),
            aiProbability=_f(r["ai_probability"]) if r["ai_probability"] is not None else None,
        ) for r in rows],
    )


# --------------------------------------------------------------------------
# Disputes
# --------------------------------------------------------------------------
# Most disputes arrive with no created_by — raised by the customer through a
# channel rather than keyed by staff — so the case origin carries the answer.
_DISPUTE_SOURCE = _binary_source("d.created_by")
_DISPUTE_SOURCE_DETAIL = _source_detail()
_DISPUTE_SOURCE_JOINS = """
        LEFT JOIN administration.app_user cu ON cu.id = d.created_by
        LEFT JOIN collection.case_meta cm    ON cm.case_id = d.case_id
        LEFT JOIN collection.case_source cs  ON cs.code = cm.source_code
"""

_DISPUTE_SORTS = {
    "filedAt": "d.filed_at",
    "amount": "d.amount",
    "customerName": _NAME,
    "status": "d.status",
    "priority": ("CASE d.priority WHEN 'Critical' THEN 3 WHEN 'High' THEN 2"
                 " WHEN 'Medium' THEN 1 ELSE 0 END"),
    "slaDeadline": "d.sla_deadline",
    "source": _DISPUTE_SOURCE,
}


async def list_disputes(
    db: AsyncSession, f: schemas.Filters, *, sort: str | None, direction: str | None,
    limit: int, offset: int,
) -> schemas.DisputePage:
    clauses, params = _common(f, "d")
    if f.priority:
        clauses.append("d.priority = :priority")
        params["priority"] = f.priority
    if f.reason:
        clauses.append("COALESCE(md.label, d.reason_code) = :reason")
        params["reason"] = f.reason
    if f.dateFrom:
        clauses.append("d.filed_at >= :date_from")
        params["date_from"] = f.dateFrom
    if f.dateTo:
        clauses.append("d.filed_at < (:date_to::date + 1)")
        params["date_to"] = f.dateTo
    if f.source:
        clauses.append(f"{_DISPUTE_SOURCE} = :source")
        params["source"] = f.source
    s = _search(f, ["d.dispute_code", _NAME, "c.customer_code", "a.account_code"], params)
    if s:
        clauses.append(s)
    where = " AND ".join(clauses) or "TRUE"

    frm = f"""
        FROM customer_schema.dispute d
        JOIN customer_schema.customer c ON c.id = d.customer_id
        LEFT JOIN customer_schema.account a ON a.id = d.account_id
        LEFT JOIN administration.app_user u ON u.id = d.assigned_agent_id
        LEFT JOIN administration.master_data md
               ON md.category = 'DISPUTE_REASON' AND md.code = d.reason_code
        {_DISPUTE_SOURCE_JOINS}
        WHERE {where}
    """
    total, amount = await _totals(
        db, f"SELECT count(*) AS n, COALESCE(sum(d.amount), 0) AS amt {frm}", params
    )

    params |= {"limit": limit, "offset": offset}
    rows = (await db.execute(text(f"""
        SELECT d.id, d.dispute_code, d.amount, d.status, d.priority,
               d.filed_at, d.sla_deadline, d.resolved_at,
               COALESCE(md.label, d.reason_code) AS reason,
               c.customer_code, {_NAME} AS customer_name, c.customer_type,
               a.account_code, u.full_name AS agent_name,
               {_DISPUTE_SOURCE} AS source, {_DISPUTE_SOURCE_DETAIL} AS source_detail
        {frm}
        ORDER BY {_order(sort, direction, _DISPUTE_SORTS, 'd.filed_at')}
        LIMIT :limit OFFSET :offset
    """), params)).mappings().all()

    now = dt.datetime.now(dt.timezone.utc)
    return schemas.DisputePage(
        total=total, totalAmount=amount,
        rows=[schemas.DisputeRow(
            id=r["id"], code=r["dispute_code"],
            customerId=r["customer_code"], customerName=r["customer_name"],
            customerType=r["customer_type"], accountCode=r["account_code"],
            reason=r["reason"], amount=round(_f(r["amount"]), 2),
            status=r["status"], priority=r["priority"],
            filedAt=r["filed_at"], slaDeadline=r["sla_deadline"], resolvedAt=r["resolved_at"],
            agentName=r["agent_name"],
            source=r["source"], sourceDetail=r["source_detail"],
            # Age stops at resolution — an open dispute keeps ageing.
            ageDays=_days(r["resolved_at"] or r["filed_at"]) if r["resolved_at"]
                    else _days(r["filed_at"]),
            slaBreached=bool(
                r["sla_deadline"]
                and (r["resolved_at"] or now) > r["sla_deadline"]
            ),
        ) for r in rows],
    )


# --------------------------------------------------------------------------
# Legal escalations
# --------------------------------------------------------------------------
# A legal case carries no created_by. What it does carry is the escalation
# that opened it, and the placement it came out of — a case with a placement
# was escalated by the agency working it.
#
# legal_event.actor is deliberately NOT used here: on an OPENED event it holds
# the attorney, not whoever raised the case.
_LEGAL_SOURCE = f"""
        CASE WHEN esc.raised_by IS NOT NULL THEN '{SOURCE_AGENT}'
             ELSE '{SOURCE_STRATEGY}' END"""
_LEGAL_SOURCE_DETAIL = """
        NULLIF(concat_ws(' · ',
            CASE WHEN l.placement_id IS NOT NULL THEN 'Agency Escalation' END,
            COALESCE(cu.full_name, pag.name)), '')"""
_LEGAL_SOURCE_JOINS = """
        LEFT JOIN LATERAL (
            SELECT ce.raised_by
              FROM collection.case_escalation ce
             WHERE ce.legal_case_id = l.id
             ORDER BY ce.raised_at
             LIMIT 1
        ) esc ON TRUE
        LEFT JOIN administration.app_user cu   ON cu.id = esc.raised_by
        LEFT JOIN recovery_schema.placement pl ON pl.id = l.placement_id
        LEFT JOIN recovery_schema.agency pag   ON pag.id = pl.agency_id
"""

_LEGAL_SORTS = {
    "filedOn": "COALESCE(l.filed_on, l.created_at::date)",
    "claimAmount": "l.claim_amount",
    "recoveredAmount": "l.recovered_amount",
    "customerName": _NAME,
    "status": "l.status",
    "stage": "l.stage",
    "nextHearing": "l.next_hearing",
    "source": _LEGAL_SOURCE,
}


async def list_legal(
    db: AsyncSession, f: schemas.Filters, *, sort: str | None, direction: str | None,
    limit: int, offset: int,
) -> schemas.LegalPage:
    clauses, params = _common(f, "l")
    if f.stage:
        clauses.append("l.stage = :stage")
        params["stage"] = f.stage
    # A case that has not been filed yet is dated by when it was opened.
    if f.dateFrom:
        clauses.append("COALESCE(l.filed_on, l.created_at::date) >= :date_from")
        params["date_from"] = f.dateFrom
    if f.dateTo:
        clauses.append("COALESCE(l.filed_on, l.created_at::date) <= :date_to")
        params["date_to"] = f.dateTo
    if f.source:
        clauses.append(f"{_LEGAL_SOURCE} = :source")
        params["source"] = f.source
    s = _search(f, ["l.case_code", _NAME, "c.customer_code", "l.law_firm", "l.court"], params)
    if s:
        clauses.append(s)
    where = " AND ".join(clauses) or "TRUE"

    frm = f"""
        FROM recovery_schema.legal_case l
        JOIN customer_schema.customer c ON c.id = l.customer_id
        {_LEGAL_SOURCE_JOINS}
        WHERE {where}
    """
    total, amount = await _totals(
        db, f"SELECT count(*) AS n, COALESCE(sum(l.claim_amount), 0) AS amt {frm}", params
    )

    params |= {"limit": limit, "offset": offset}
    rows = (await db.execute(text(f"""
        SELECT l.id, l.case_code, l.claim_amount, l.legal_cost, l.recovered_amount,
               l.stage, l.status, l.law_firm, l.court, l.next_hearing,
               l.success_probability,
               COALESCE(l.filed_on, l.created_at::date) AS filed_on,
               c.customer_code, {_NAME} AS customer_name, c.customer_type,
               {_LEGAL_SOURCE} AS source, {_LEGAL_SOURCE_DETAIL} AS source_detail
        {frm}
        ORDER BY {_order(sort, direction, _LEGAL_SORTS, 'COALESCE(l.filed_on, l.created_at::date)')}
        LIMIT :limit OFFSET :offset
    """), params)).mappings().all()

    return schemas.LegalPage(
        total=total, totalAmount=amount,
        rows=[schemas.LegalRow(
            id=r["id"], code=r["case_code"],
            customerId=r["customer_code"], customerName=r["customer_name"],
            customerType=r["customer_type"],
            claimAmount=round(_f(r["claim_amount"]), 2),
            legalCost=round(_f(r["legal_cost"]), 2),
            recoveredAmount=round(_f(r["recovered_amount"]), 2),
            stage=r["stage"], status=r["status"],
            lawFirm=r["law_firm"], court=r["court"],
            source=r["source"], sourceDetail=r["source_detail"],
            filedOn=r["filed_on"], nextHearing=r["next_hearing"],
            successProbability=(_f(r["success_probability"])
                                if r["success_probability"] is not None else None),
            ageDays=_days(r["filed_on"]),
        ) for r in rows],
    )


# --------------------------------------------------------------------------
# Agency escalations (placements)
# --------------------------------------------------------------------------
# A placement carries no created_by either, but every one leaves a PLACED
# event with the actor that made it — a username, an email, or 'system' when
# an unattended allocation run placed the account.
# A placement resolves to a person only when the PLACED actor matches a user
# or an escalation named one; an unattended allocation run stamps 'system'.
_AGENCY_SOURCE = f"""
        CASE WHEN cu.full_name IS NOT NULL THEN '{SOURCE_AGENT}'
             ELSE '{SOURCE_STRATEGY}' END"""
_AGENCY_SOURCE_DETAIL = "COALESCE(cu.full_name, pev.actor)"
_AGENCY_SOURCE_JOINS = """
        LEFT JOIN LATERAL (
            SELECT pe.actor
              FROM recovery_schema.placement_event pe
             WHERE pe.placement_id = p.id AND pe.event_type IN ('PLACED','ASSIGNED')
             ORDER BY pe.occurred_at
             LIMIT 1
        ) pev ON TRUE
        LEFT JOIN LATERAL (
            SELECT ce.raised_by
              FROM collection.case_escalation ce
             WHERE ce.placement_id = p.id
             ORDER BY ce.raised_at
             LIMIT 1
        ) esc ON TRUE
        -- The escalating user if one was recorded, otherwise whoever the
        -- PLACED actor resolves to by email or name.
        LEFT JOIN LATERAL (
            SELECT u2.full_name
              FROM administration.app_user u2
             WHERE u2.id = esc.raised_by
                OR lower(u2.email) = lower(pev.actor)
                OR lower(u2.full_name) = lower(pev.actor)
             LIMIT 1
        ) cu ON TRUE
"""

_AGENCY_SORTS = {
    "placedOn": "p.placed_on",
    "placedAmount": "p.placed_amount",
    "recoveredAmount": "p.recovered_amount",
    "openAmount": "(p.placed_amount - p.recovered_amount)",
    "recoveryPct": "(p.recovered_amount / NULLIF(p.placed_amount, 0))",
    "customerName": _NAME,
    "agencyName": "ag.name",
    "status": "p.status",
    "recallDue": "p.recall_due",
    "dpd": "COALESCE(a.dpd, 0)",
    "source": _AGENCY_SOURCE,
}


async def list_agency(
    db: AsyncSession, f: schemas.Filters, *, sort: str | None, direction: str | None,
    limit: int, offset: int,
) -> schemas.AgencyPage:
    clauses, params = _common(f, "p")
    if f.priority:
        clauses.append("p.priority = :priority")
        params["priority"] = f.priority
    if f.agency:
        clauses.append("ag.name = :agency")
        params["agency"] = f.agency
    if f.dateFrom:
        clauses.append("p.placed_on >= :date_from")
        params["date_from"] = f.dateFrom
    if f.dateTo:
        clauses.append("p.placed_on <= :date_to")
        params["date_to"] = f.dateTo
    if f.source:
        clauses.append(f"{_AGENCY_SOURCE} = :source")
        params["source"] = f.source
    s = _search(f, ["p.placement_code", _NAME, "c.customer_code", "a.account_code", "ag.name"],
                params)
    if s:
        clauses.append(s)
    where = " AND ".join(clauses) or "TRUE"

    frm = f"""
        FROM recovery_schema.placement p
        JOIN recovery_schema.agency ag ON ag.id = p.agency_id
        JOIN customer_schema.customer c ON c.id = p.customer_id
        LEFT JOIN customer_schema.account a ON a.id = p.account_id
        {_AGENCY_SOURCE_JOINS}
        WHERE {where}
    """
    total, amount = await _totals(
        db, f"SELECT count(*) AS n, COALESCE(sum(p.placed_amount), 0) AS amt {frm}", params
    )

    params |= {"limit": limit, "offset": offset}
    rows = (await db.execute(text(f"""
        SELECT p.id, p.placement_code, p.placed_amount, p.recovered_amount,
               p.status, p.priority, p.placed_on, p.recall_due, p.closed_on,
               ag.name AS agency_name,
               c.customer_code, {_NAME} AS customer_name, c.customer_type,
               a.account_code, COALESCE(a.dpd, 0) AS dpd,
               {_AGENCY_SOURCE} AS source, {_AGENCY_SOURCE_DETAIL} AS source_detail
        {frm}
        ORDER BY {_order(sort, direction, _AGENCY_SORTS, 'p.placed_on')}
        LIMIT :limit OFFSET :offset
    """), params)).mappings().all()

    today = dt.date.today()
    out: list[schemas.AgencyRow] = []
    for r in rows:
        placed, recovered = _f(r["placed_amount"]), _f(r["recovered_amount"])
        open_amt = round(placed - recovered, 2)
        end = r["closed_on"] or today
        out.append(schemas.AgencyRow(
            id=r["id"], code=r["placement_code"], agencyName=r["agency_name"],
            customerId=r["customer_code"], customerName=r["customer_name"],
            customerType=r["customer_type"], accountCode=r["account_code"],
            placedAmount=round(placed, 2), recoveredAmount=round(recovered, 2),
            openAmount=open_amt,
            recoveryPct=round(recovered / placed * 100, 1) if placed else 0.0,
            status=r["status"], priority=r["priority"], dpd=r["dpd"],
            source=r["source"], sourceDetail=r["source_detail"],
            placedOn=r["placed_on"], recallDue=r["recall_due"],
            daysWithAgency=(end - r["placed_on"]).days,
            overdueRecall=bool(
                r["status"] in ("ACTIVE", "LEGAL")
                and r["recall_due"] and r["recall_due"] < today and open_amt > 0
            ),
        ))
    return schemas.AgencyPage(total=total, totalAmount=amount, rows=out)


# --------------------------------------------------------------------------
# Filter dropdowns
# --------------------------------------------------------------------------
async def filter_options(db: AsyncSession) -> schemas.FilterOptions:
    async def distinct(sql: str) -> list[str]:
        rows = (await db.execute(text(sql))).all()
        return [r[0] for r in rows if r[0] is not None]

    return schemas.FilterOptions(
        customerTypes=await distinct(
            "SELECT DISTINCT customer_type FROM customer_schema.customer"
            " WHERE customer_type IS NOT NULL ORDER BY 1"),
        regions=await distinct(
            "SELECT DISTINCT region_code FROM customer_schema.customer"
            " WHERE region_code IS NOT NULL ORDER BY 1"),
        ptpStatuses=["PENDING", "KEPT", "BROKEN", "CANCELLED"],
        ptpChannels=await distinct(
            "SELECT DISTINCT COALESCE(md.label, p.channel_code)"
            "  FROM customer_schema.ptp p"
            "  LEFT JOIN administration.master_data md"
            "         ON md.category = 'CHANNEL' AND md.code = p.channel_code"
            " WHERE p.channel_code IS NOT NULL ORDER BY 1"),
        disputeStatuses=["OPEN", "INVESTIGATING", "ESCALATED", "APPROVED", "REJECTED", "RESOLVED"],
        disputeReasons=await distinct(
            "SELECT DISTINCT COALESCE(md.label, d.reason_code)"
            "  FROM customer_schema.dispute d"
            "  LEFT JOIN administration.master_data md"
            "         ON md.category = 'DISPUTE_REASON' AND md.code = d.reason_code"
            " ORDER BY 1"),
        disputePriorities=["Low", "Medium", "High", "Critical"],
        legalStatuses=["OPEN", "WON", "LOST", "SETTLED", "WITHDRAWN"],
        legalStages=["Pre-Legal", "Notice Served", "Filed", "Discovery", "Hearing",
                     "Judgment", "Post-Judgment", "Settled", "Withdrawn"],
        agencyStatuses=["ACTIVE", "RECALLED", "SETTLED", "CLOSED", "LEGAL"],
        agencyPriorities=["Low", "Medium", "High", "Critical"],
        agencies=await distinct(
            "SELECT name FROM recovery_schema.agency ORDER BY name"),
        # Source lists are derived, so they are read back through the same
        # expression the rows use — a value offered here always matches rows.
        ptpSources=await distinct(f"""
            SELECT DISTINCT {_PTP_SOURCE} AS v
              FROM customer_schema.ptp p
              {_PTP_SOURCE_JOINS}
             ORDER BY 1"""),
        disputeSources=await distinct(f"""
            SELECT DISTINCT {_DISPUTE_SOURCE} AS v
              FROM customer_schema.dispute d
              {_DISPUTE_SOURCE_JOINS}
             ORDER BY 1"""),
        legalSources=await distinct(f"""
            SELECT DISTINCT {_LEGAL_SOURCE} AS v
              FROM recovery_schema.legal_case l
              {_LEGAL_SOURCE_JOINS}
             ORDER BY 1"""),
        agencySources=await distinct(f"""
            SELECT DISTINCT {_AGENCY_SOURCE} AS v
              FROM recovery_schema.placement p
              {_AGENCY_SOURCE_JOINS}
             ORDER BY 1"""),
    )
