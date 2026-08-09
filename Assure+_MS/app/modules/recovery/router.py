"""Recovery Workspace routes: /recovery.

Everything is gated on the Recovery Workspace permission — view to read the
book, edit to place, reassign, recall, post recoveries and run legal cases.
"""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query, status

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey
from app.modules.identity import service as identity_service
from app.modules.recovery import schemas, service

router = APIRouter(prefix="/recovery", tags=["recovery"])

_can_view = require(PermKey.RECOVERY_WORKSPACE, "view")
_can_edit = require(PermKey.RECOVERY_WORKSPACE, "edit")


async def _audit(db, principal: Principal, action: str, target: str) -> None:
    await identity_service.record_audit(
        db, actor=principal.email, actor_id=principal.id, action=action, target=target
    )


# --- Overview --------------------------------------------------------------
@router.get("/summary", response_model=schemas.Summary)
async def summary(db: DbSession, _: Principal = Depends(_can_view)) -> schemas.Summary:
    return await service.summary(db)


@router.get("/ledger", response_model=list[schemas.RecoveryRow])
async def ledger(db: DbSession, limit: int = Query(200, le=1000),
                 _: Principal = Depends(_can_view)) -> list[schemas.RecoveryRow]:
    return await service.recovery_ledger(db, limit)


# --- Agencies --------------------------------------------------------------
@router.get("/agencies", response_model=list[schemas.AgencyRow])
async def agencies(db: DbSession, _: Principal = Depends(_can_view)) -> list[schemas.AgencyRow]:
    return await service.list_agencies(db)


@router.post("/agencies", status_code=status.HTTP_201_CREATED)
async def create_agency(payload: schemas.AgencyWrite, db: DbSession,
                        principal: Principal = Depends(_can_edit)) -> dict:
    code = await service.create_agency(db, payload)
    await _audit(db, principal, "Registered recovery agency", code)
    return {"id": code}


@router.put("/agencies/{code}")
async def update_agency(code: str, payload: schemas.AgencyWrite, db: DbSession,
                        principal: Principal = Depends(_can_edit)) -> dict:
    await service.update_agency(db, code, payload)
    await _audit(db, principal, "Updated recovery agency", code)
    return {"ok": True}


@router.delete("/agencies/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agency(code: str, db: DbSession,
                        principal: Principal = Depends(_can_edit)) -> None:
    await service.delete_agency(db, code)
    await _audit(db, principal, "Removed recovery agency", code)


# --- Placements ------------------------------------------------------------
@router.get("/placements", response_model=list[schemas.PlacementRow])
async def placements(
    db: DbSession,
    agency: str | None = Query(default=None),
    status_f: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    search: str | None = Query(default=None),
    overdue: bool = Query(default=False),
    _: Principal = Depends(_can_view),
) -> list[schemas.PlacementRow]:
    return await service.list_placements(
        db, agency=agency, status_f=status_f, priority=priority, search=search, overdue=overdue
    )


@router.get("/placements/{pid}", response_model=schemas.PlacementDetail)
async def placement(pid: int, db: DbSession,
                    _: Principal = Depends(_can_view)) -> schemas.PlacementDetail:
    return await service.placement_detail(db, pid)


@router.post("/placements", status_code=status.HTTP_201_CREATED)
async def place(payload: schemas.PlacementCreate, db: DbSession,
                principal: Principal = Depends(_can_edit)) -> dict:
    pid = await service.create_placement(db, payload, principal.email)
    await _audit(db, principal, "Placed account with agency", f"{payload.customerId} → {payload.agencyId}")
    return {"id": pid}


@router.patch("/placements/{pid}")
async def patch_placement(pid: int, payload: schemas.PlacementPatch, db: DbSession,
                          principal: Principal = Depends(_can_edit)) -> dict:
    await service.patch_placement(db, pid, payload, principal.email)
    await _audit(db, principal, "Updated placement", str(pid))
    return {"ok": True}


@router.post("/placements/{pid}/reassign")
async def reassign(pid: int, payload: schemas.ReassignRequest, db: DbSession,
                   principal: Principal = Depends(_can_edit)) -> dict:
    await service.reassign(db, pid, payload, principal.email)
    await _audit(db, principal, "Reassigned placement", f"{pid} → {payload.agencyId}")
    return {"ok": True}


@router.post("/placements/{pid}/recoveries", status_code=status.HTTP_201_CREATED)
async def post_recovery(pid: int, payload: schemas.RecoveryCreate, db: DbSession,
                        principal: Principal = Depends(_can_edit)) -> dict:
    await service.add_recovery(db, pid, payload, principal.email)
    await _audit(db, principal, "Posted recovery", f"placement {pid}: {payload.amount}")
    return {"ok": True}


@router.delete("/recoveries/{rid}", status_code=status.HTTP_204_NO_CONTENT)
async def reverse_recovery(rid: int, db: DbSession,
                           principal: Principal = Depends(_can_edit)) -> None:
    await service.delete_recovery(db, rid, principal.email)
    await _audit(db, principal, "Reversed recovery entry", str(rid))


@router.get("/eligible", response_model=list[schemas.EligibleAccount])
async def eligible(db: DbSession, search: str | None = Query(default=None),
                   _: Principal = Depends(_can_view)) -> list[schemas.EligibleAccount]:
    return await service.eligible_accounts(db, search)


# --- Legal -----------------------------------------------------------------
@router.get("/legal", response_model=list[schemas.LegalRow])
async def legal(db: DbSession, status_f: str | None = Query(default=None, alias="status"),
                _: Principal = Depends(_can_view)) -> list[schemas.LegalRow]:
    return await service.list_legal(db, status_f)


@router.post("/legal", status_code=status.HTTP_201_CREATED)
async def create_legal(payload: schemas.LegalCreate, db: DbSession,
                       principal: Principal = Depends(_can_edit)) -> dict:
    cid = await service.create_legal(db, payload, principal.email)
    await _audit(db, principal, "Opened legal case", payload.customerId)
    return {"id": cid}


@router.patch("/legal/{cid}")
async def patch_legal(cid: int, payload: schemas.LegalPatch, db: DbSession,
                      principal: Principal = Depends(_can_edit)) -> dict:
    await service.patch_legal(db, cid, payload, principal.email)
    await _audit(db, principal, "Updated legal case", str(cid))
    return {"ok": True}


@router.delete("/legal/{cid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_legal(cid: int, db: DbSession,
                       principal: Principal = Depends(_can_edit)) -> None:
    await service.delete_legal(db, cid)
    await _audit(db, principal, "Deleted legal case", str(cid))


# --- Configuration ---------------------------------------------------------
@router.get("/config", response_model=list[schemas.ConfigRow])
async def get_config(db: DbSession, _: Principal = Depends(_can_view)) -> list[schemas.ConfigRow]:
    return await service.get_config(db)


@router.put("/config")
async def put_config(db: DbSession, values: dict[str, str] = Body(...),
                     principal: Principal = Depends(_can_edit)) -> dict:
    await service.save_config(db, values)
    await _audit(db, principal, "Updated recovery configuration", ", ".join(values))
    return {"ok": True}
