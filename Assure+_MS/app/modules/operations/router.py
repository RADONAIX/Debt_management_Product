"""Operations routes: /operations — how the platform itself is configured.

Reading is gated on the AI Guardrails screen permission; every change needs
edit on the same, because a guardrail an operator can turn off is a control.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey, has_permission
from app.modules.identity import service as identity_service
from app.modules.operations import performance as perf, schemas, service

router = APIRouter(prefix="/operations", tags=["operations"])

_can_view = require(PermKey.AI_GUARDRAILS, "view")
_view_performance = require(PermKey.AGENT_PERFORMANCE, "view")
_can_edit = require(PermKey.AI_GUARDRAILS, "edit")


@router.get("/guardrails", response_model=schemas.Guardrails)
async def guardrails(db: DbSession, _: Principal = Depends(_can_view)) -> schemas.Guardrails:
    """Every rule, grouped as the screen shows them, with 30 days of activity."""
    return await service.guardrails(db)


@router.get("/guardrails/events", response_model=list[schemas.EventRow])
async def events(db: DbSession, kind: str | None = None, outcome: str | None = None,
                 limit: int = Query(default=60, ge=1, le=300),
                 _: Principal = Depends(_can_view)) -> list[schemas.EventRow]:
    """What the guardrails have actually caught."""
    return await service.events(db, kind=kind, outcome=outcome, limit=limit)


@router.get("/guardrails/audit", response_model=list[schemas.AuditRow])
async def audit(db: DbSession, limit: int = Query(default=40, ge=1, le=200),
                _: Principal = Depends(_can_view)) -> list[schemas.AuditRow]:
    """Who changed which rule, and from what to what."""
    return await service.audit(db, limit)


@router.post("/guardrails", status_code=status.HTTP_201_CREATED)
async def create(payload: schemas.GuardrailWrite, db: DbSession,
                 principal: Principal = Depends(_can_edit)) -> dict:
    gid = await service.create(db, payload, int(principal.id))
    await identity_service.record_audit(
        db, actor=principal.email, actor_id=principal.id,
        action="Created guardrail", target=payload.label)
    return {"id": gid}


@router.patch("/guardrails/{guardrail_id}")
async def patch(guardrail_id: int, payload: schemas.GuardrailPatch, db: DbSession,
                principal: Principal = Depends(_can_edit)) -> dict:
    await service.patch(db, guardrail_id, payload, int(principal.id))
    return {"ok": True}


@router.delete("/guardrails/{guardrail_id}")
async def delete(guardrail_id: int, db: DbSession,
                 principal: Principal = Depends(_can_edit)) -> dict:
    await service.delete(db, guardrail_id, int(principal.id))
    await identity_service.record_audit(
        db, actor=principal.email, actor_id=principal.id,
        action="Deleted guardrail", target=str(guardrail_id))
    return {"ok": True}



# ==========================================================================
# Agent Performance
# ==========================================================================
@router.get("/performance", response_model=schemas.AgentPerformance)
async def agent_performance(db: DbSession, agentId: int | None = Query(default=None),
                            principal: Principal = Depends(_view_performance),
                            ) -> schemas.AgentPerformance:
    """One collector's performance — their own unless they may see the floor.

    Enforced here rather than in the UI: a collector asking for a colleague's
    figures gets their own back, not an error and not the colleague's numbers.
    """
    may_widen = has_permission(principal.permissions, PermKey.USER_MANAGEMENT, "view")
    target = agentId if (may_widen and agentId) else int(principal.id)
    return await perf.performance(db, target)
