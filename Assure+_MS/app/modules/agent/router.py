"""Agent Workspace routes: /agent.

An agent works their own desk. A supervisor or admin — anyone who can edit
User Management — may look at another agent's desk by passing ?agentId=, which
is how a team lead reviews the floor without a second screen.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey, desk_scope, has_permission
from app.modules.agent import schemas, service

router = APIRouter(prefix="/agent", tags=["agent"])

_can_view = require(PermKey.AGENT_WORKSPACE, "view")
_can_edit = require(PermKey.AGENT_WORKSPACE, "edit")


def _desk_of(principal: Principal, agent_id: int | None) -> int | None:
    """Whose desk this request is for. The agent workspace opens on your own
    desk rather than the floor; see ``rbac.desk_scope`` for the rule itself."""
    return desk_scope(principal, agent_id, default_floor=False)


# --- Desk ------------------------------------------------------------------
@router.get("/scope")
async def scope(principal: Principal = Depends(_can_view)) -> dict:
    """Whether this user may look beyond their own desk."""
    return {
        "agentId": int(principal.id),
        "canViewAllDesks": has_permission(principal.permissions, PermKey.USER_MANAGEMENT, "view"),
    }


@router.get("/agents", response_model=list[schemas.AgentRow])
async def agents(db: DbSession, _: Principal = Depends(_can_view)) -> list[schemas.AgentRow]:
    return await service.list_agents(db)


@router.get("/summary", response_model=schemas.DeskSummary)
async def summary(
    db: DbSession, agentId: int | None = Query(default=None),
    principal: Principal = Depends(_can_view),
) -> schemas.DeskSummary:
    return await service.desk_summary(db, _desk_of(principal, agentId))


@router.post("/settle-promises")
async def settle(db: DbSession, agentId: int | None = Query(default=None),
                 principal: Principal = Depends(_can_edit)) -> dict:
    """Re-decide pending promises against the payment record."""
    return await service.settle_promises(db, _desk_of(principal, agentId))


# --- Worklist --------------------------------------------------------------
@router.get("/worklist", response_model=list[schemas.WorkItem])
async def worklist(
    db: DbSession,
    agentId: int | None = Query(default=None),
    search: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    bucket: str | None = Query(default=None),
    risk: str | None = Query(default=None),
    principal: Principal = Depends(_can_view),
) -> list[schemas.WorkItem]:
    return await service.worklist(
        db, _desk_of(principal, agentId), search=search, priority=priority,
        bucket=bucket, risk=risk)


@router.get("/customers/{code}", response_model=schemas.WorkItem)
async def customer(code: str, db: DbSession,
                   principal: Principal = Depends(_can_view)) -> schemas.WorkItem:
    return await service.customer_item(db, int(principal.id), code)


# --- Cases -----------------------------------------------------------------
@router.get("/cases", response_model=list[schemas.CaseRow])
async def cases(
    db: DbSession,
    agentId: int | None = Query(default=None),
    status_f: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    search: str | None = Query(default=None),
    breached: bool = Query(default=False),
    principal: Principal = Depends(_can_view),
) -> list[schemas.CaseRow]:
    return await service.list_cases(
        db, _desk_of(principal, agentId), status_f=status_f, priority=priority,
        search=search, breached=breached)


@router.get("/cases/{case_id}", response_model=schemas.CaseDetail)
async def case(case_id: int, db: DbSession,
               principal: Principal = Depends(_can_view)) -> schemas.CaseDetail:
    return await service.case_detail(db, case_id, int(principal.id))


@router.post("/cases", status_code=status.HTTP_201_CREATED)
async def create_case(payload: schemas.CaseCreate, db: DbSession,
                      principal: Principal = Depends(_can_edit)) -> dict:
    return {"id": await service.create_case(db, payload, int(principal.id))}


@router.patch("/cases/{case_id}")
async def patch_case(case_id: int, payload: schemas.CasePatch, db: DbSession,
                     principal: Principal = Depends(_can_edit)) -> dict:
    await service.patch_case(db, case_id, payload, int(principal.id))
    return {"ok": True}


@router.post("/cases/{case_id}/activities", status_code=status.HTTP_201_CREATED)
async def add_activity(case_id: int, payload: schemas.ActivityCreate, db: DbSession,
                       principal: Principal = Depends(_can_edit)) -> dict:
    await service.add_activity(db, case_id, payload, int(principal.id))
    return {"ok": True}


# --- Promises --------------------------------------------------------------
@router.get("/ptps", response_model=list[schemas.PtpRow])
async def ptps(
    db: DbSession,
    agentId: int | None = Query(default=None),
    status_f: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    principal: Principal = Depends(_can_view),
) -> list[schemas.PtpRow]:
    return await service.list_ptps(
        db, _desk_of(principal, agentId), status_f=status_f, search=search)


@router.post("/ptps", status_code=status.HTTP_201_CREATED)
async def create_ptp(payload: schemas.PtpCreate, db: DbSession,
                     principal: Principal = Depends(_can_edit)) -> dict:
    return {"id": await service.create_ptp(db, payload, int(principal.id))}


@router.patch("/ptps/{ptp_id}")
async def patch_ptp(ptp_id: int, payload: schemas.PtpPatch, db: DbSession,
                    principal: Principal = Depends(_can_edit)) -> dict:
    await service.patch_ptp(db, ptp_id, payload, int(principal.id))
    return {"ok": True}


# --- Reminders -------------------------------------------------------------
@router.get("/reminder-templates", response_model=list[schemas.ReminderTemplate])
async def templates(_: Principal = Depends(_can_view)) -> list[schemas.ReminderTemplate]:
    return service.reminder_templates()


@router.post("/reminders", status_code=status.HTTP_201_CREATED)
async def send_reminder(payload: schemas.ReminderRequest, db: DbSession,
                        principal: Principal = Depends(_can_edit)) -> dict:
    return {"message": await service.send_reminder(db, payload, int(principal.id))}


# --- Disputes --------------------------------------------------------------
@router.get("/disputes", response_model=list[schemas.DisputeRow])
async def disputes(
    db: DbSession,
    agentId: int | None = Query(default=None),
    status_f: str | None = Query(default=None, alias="status"),
    principal: Principal = Depends(_can_view),
) -> list[schemas.DisputeRow]:
    return await service.list_disputes(db, _desk_of(principal, agentId), status_f=status_f)


@router.post("/disputes", status_code=status.HTTP_201_CREATED)
async def create_dispute(payload: schemas.DisputeCreate, db: DbSession,
                         principal: Principal = Depends(_can_edit)) -> dict:
    return {"id": await service.create_dispute(db, payload, int(principal.id))}


@router.patch("/disputes/{dispute_id}")
async def patch_dispute(dispute_id: int, payload: schemas.DisputePatch, db: DbSession,
                        principal: Principal = Depends(_can_edit)) -> dict:
    await service.patch_dispute(db, dispute_id, payload, int(principal.id))
    return {"ok": True}


# --- Payments --------------------------------------------------------------
@router.post("/payments", status_code=status.HTTP_201_CREATED)
async def log_payment(payload: schemas.LogPaymentRequest, db: DbSession,
                      principal: Principal = Depends(_can_edit)) -> dict:
    await service.log_payment(db, payload, int(principal.id))
    return {"ok": True}
