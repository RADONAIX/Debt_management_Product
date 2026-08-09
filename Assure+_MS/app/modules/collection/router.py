"""Collection Workspace & Case Management routes: /collection.

Reading is gated on the screen permission. Each write is gated on the specific
capability the spec calls for — assign, transfer, close, reopen, merge,
escalate, configure — so a role can be given exactly the authority it needs.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey, desk_scope, has_permission
from app.modules.collection import overview as overview_service, schemas, service
from app.modules.identity import service as identity_service

router = APIRouter(prefix="/collection", tags=["collection"])

_view_workspace = require(PermKey.COLLECTIONS_WORKSPACE, "view")
_view_cases = require(PermKey.CASE_MANAGEMENT, "view")
_view_dashboard = require(PermKey.COLLECTIONS_DASHBOARD, "view")
_work_cases = require(PermKey.CASE_MANAGEMENT, "edit")
_create_manual = require(PermKey.CASE_CREATE_MANUAL, "edit")
_create_auto = require(PermKey.CASE_CREATE_AUTO, "edit")
_can_assign = require(PermKey.CASE_ASSIGN, "edit")
_can_transfer = require(PermKey.CASE_TRANSFER, "edit")
_can_merge = require(PermKey.CASE_MERGE, "edit")
_config_queues = require(PermKey.CASE_CONFIG_QUEUES, "edit")
_config_types = require(PermKey.CASE_CONFIG_TYPES, "edit")


def _desk_scope(principal: Principal, agent_id: int | None) -> int | None:
    """Whose work this request may see. Collections open on the whole floor for
    anyone entitled to it; see ``rbac.desk_scope`` for the rule itself."""
    return desk_scope(principal, agent_id, default_floor=True)


async def _audit_admin(db, principal: Principal, action: str, target: str) -> None:
    await identity_service.record_audit(
        db, actor=principal.email, actor_id=principal.id, action=action, target=target)


# ==========================================================================
# Collection Workspace
# ==========================================================================
@router.get("/workspace", response_model=list[schemas.WorkspaceRow])
async def workspace(
    db: DbSession,
    search: str | None = Query(default=None),
    status_f: str | None = Query(default=None, alias="status"),
    bucket: str | None = Query(default=None),
    risk: str | None = Query(default=None),
    queue: str | None = Query(default=None),
    agentId: int | None = Query(default=None),
    unassigned: bool = Query(default=False),
    limit: int = Query(default=300, le=1000),
    _: Principal = Depends(_view_workspace),
) -> list[schemas.WorkspaceRow]:
    return await service.workspace(
        db, search=search, status_f=status_f, bucket=bucket, risk=risk, queue=queue,
        agent_id=agentId, unassigned=unassigned, limit=limit)


@router.get("/workspace/summary", response_model=schemas.WorkspaceSummary)
async def workspace_summary(db: DbSession,
                            _: Principal = Depends(_view_workspace)) -> schemas.WorkspaceSummary:
    return await service.workspace_summary(db)


@router.get("/customers/{code}", response_model=schemas.WorkspaceRow)
async def customer(code: str, db: DbSession,
                   _: Principal = Depends(_view_workspace)) -> schemas.WorkspaceRow:
    return await service.customer_row(db, code)


@router.get("/customers/{code}/timeline", response_model=list[schemas.TimelineEntry])
async def timeline(code: str, db: DbSession, limit: int = Query(default=120, le=500),
                   _: Principal = Depends(_view_workspace)) -> list[schemas.TimelineEntry]:
    return await service.customer_timeline(db, code, limit)


# --- Case candidates: defaulters with nobody working them ------------------
@router.get("/candidates", response_model=list[schemas.CandidateRow])
async def candidates(
    db: DbSession,
    mine: bool = Query(default=False, description="Only accounts assigned to me"),
    agentId: int | None = Query(default=None),
    search: str | None = Query(default=None),
    trigger: str | None = Query(default=None),
    minDpd: int | None = Query(default=None),
    limit: int = Query(default=300, le=1000),
    principal: Principal = Depends(_view_workspace),
) -> list[schemas.CandidateRow]:
    owner = int(principal.id) if mine else agentId
    return await service.candidates(db, agent_id=owner, search=search, trigger=trigger,
                                    min_dpd=minDpd, limit=limit)


@router.get("/customer-search")
async def customer_search(q: str, db: DbSession, limit: int = Query(default=25, le=100),
                          _: Principal = Depends(_view_cases)) -> list[dict]:
    """Find any customer to raise a case against, defaulting or not."""
    return await service.search_customers(db, q, limit)


@router.get("/candidates/summary", response_model=schemas.CandidateSummary)
async def candidate_summary(db: DbSession,
                            principal: Principal = Depends(_view_workspace)
                            ) -> schemas.CandidateSummary:
    return await service.candidate_summary(db, int(principal.id))


@router.post("/candidates/create-cases", response_model=schemas.BulkCaseResult,
             status_code=status.HTTP_201_CREATED)
async def bulk_create(payload: schemas.BulkCaseRequest, db: DbSession,
                      principal: Principal = Depends(_create_manual)) -> schemas.BulkCaseResult:
    """Raise a case for each selected candidate, using its suggested type."""
    res = await service.bulk_create(db, payload, int(principal.id), principal.role)
    await _audit_admin(db, principal, "Raised cases from candidates",
                       f"{res.created} created, {res.skipped} skipped")
    return res


# ==========================================================================
# Cases
# ==========================================================================
@router.get("/cases", response_model=list[schemas.CaseRow])
async def cases(
    db: DbSession,
    search: str | None = Query(default=None),
    state: str | None = Query(default=None),
    category: str | None = Query(default=None),
    queue: str | None = Query(default=None),
    source: str | None = Query(default=None),
    typeCode: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    agentId: int | None = Query(default=None),
    unassigned: bool = Query(default=False),
    breached: bool = Query(default=False),
    includeMerged: bool = Query(default=False),
    limit: int = Query(default=300, le=1000),
    principal: Principal = Depends(_view_cases),
) -> list[schemas.CaseRow]:
    return await service.list_cases(
        db, search=search, state=state, category=category, queue=queue, source=source,
        type_code=typeCode, priority=priority,
        agent_id=_desk_scope(principal, agentId), unassigned=unassigned,
        breached=breached, include_merged=includeMerged, limit=limit)


@router.get("/cases/dashboard", response_model=schemas.CaseDashboard)
async def dashboard(db: DbSession, agentId: int | None = Query(default=None),
                    principal: Principal = Depends(_view_cases)) -> schemas.CaseDashboard:
    return await service.dashboard(db, _desk_scope(principal, agentId))


@router.get("/overview", response_model=schemas.CollectionsOverview)
async def collections_overview(db: DbSession, agentId: int | None = Query(default=None),
                               weeks: int = Query(default=8, ge=4, le=26),
                               principal: Principal = Depends(_view_dashboard),
                               ) -> schemas.CollectionsOverview:
    """The collections book for whichever desk this user is allowed to see."""
    return await overview_service.overview(db, _desk_scope(principal, agentId), weeks=weeks)


@router.get("/cases/{case_id}", response_model=schemas.CaseDetail)
async def case(case_id: int, db: DbSession,
               principal: Principal = Depends(_view_cases)) -> schemas.CaseDetail:
    return await service.case_detail(db, case_id, principal.permissions)


@router.get("/duplicate-check", response_model=schemas.DuplicateCheck)
async def duplicate_check(customerId: str, typeCode: str, db: DbSession,
                          accountId: int | None = Query(default=None),
                          _: Principal = Depends(_view_cases)) -> schemas.DuplicateCheck:
    """Whether this account is already being worked, and so cannot take a second case."""
    return await service.check_duplicate(db, customerId, typeCode, accountId)


@router.post("/cases", response_model=schemas.CaseCreated,
             status_code=status.HTTP_201_CREATED)
async def create_case(payload: schemas.CaseCreate, db: DbSession,
                      principal: Principal = Depends(_create_manual)) -> schemas.CaseCreated:
    return await service.create_case(db, payload, int(principal.id), principal.role)


@router.post("/cases/automatic", response_model=schemas.CaseCreated,
             status_code=status.HTTP_201_CREATED)
async def create_automatic(payload: schemas.CaseCreate, db: DbSession,
                           principal: Principal = Depends(_create_auto)) -> schemas.CaseCreated:
    """Entry point for strategy, risk, ageing, external API and system workflows."""
    if payload.sourceCode in ("AGENT_MANUAL", "SUPERVISOR_MANUAL"):
        payload.sourceCode = "SYSTEM_WORKFLOW"
    return await service.create_case(db, payload, int(principal.id), principal.role)


@router.patch("/cases/{case_id}")
async def patch_case(case_id: int, payload: schemas.CasePatch, db: DbSession,
                     principal: Principal = Depends(_work_cases)) -> dict:
    """Re-type, re-prioritise or re-describe a case without opening another one."""
    await service.patch_case(db, case_id, payload, int(principal.id), principal.role)
    return {"ok": True}


@router.post("/cases/{case_id}/transition")
async def transition(case_id: int, payload: schemas.TransitionRequest, db: DbSession,
                     principal: Principal = Depends(_work_cases)) -> dict:
    await service.transition(db, case_id, payload, int(principal.id),
                             principal.permissions, principal.role)
    return {"ok": True}


@router.post("/cases/{case_id}/assign")
async def assign(case_id: int, payload: schemas.AssignRequest, db: DbSession,
                 principal: Principal = Depends(_can_assign)) -> dict:
    await service.assign(db, case_id, payload, int(principal.id), principal.role)
    return {"ok": True}


@router.post("/cases/{case_id}/transfer")
async def transfer(case_id: int, payload: schemas.AssignRequest, db: DbSession,
                   principal: Principal = Depends(_can_transfer)) -> dict:
    payload.assignmentType = "TRANSFER"
    await service.assign(db, case_id, payload, int(principal.id), principal.role)
    return {"ok": True}


@router.post("/cases/{case_id}/claim")
async def claim(case_id: int, db: DbSession,
                principal: Principal = Depends(_work_cases)) -> dict:
    """Take an unassigned case out of the pool, along with the customer's others."""
    await service.claim(db, case_id, int(principal.id), principal.role)
    return {"ok": True}


@router.post("/cases/{case_id}/merge")
async def merge(case_id: int, payload: schemas.MergeRequest, db: DbSession,
                principal: Principal = Depends(_can_merge)) -> dict:
    await service.merge_cases(db, case_id, payload, int(principal.id), principal.role)
    await _audit_admin(db, principal, "Merged case", f"{case_id} → {payload.targetCaseId}")
    return {"ok": True}


@router.post("/cases/{case_id}/notes", status_code=status.HTTP_201_CREATED)
async def add_note(case_id: int, payload: schemas.NoteCreate, db: DbSession,
                   principal: Principal = Depends(_work_cases)) -> dict:
    return {"id": await service.add_note(db, case_id, payload, int(principal.id), principal.role)}


@router.post("/cases/{case_id}/attachments", status_code=status.HTTP_201_CREATED)
async def add_attachment(case_id: int, payload: schemas.AttachmentCreate, db: DbSession,
                         principal: Principal = Depends(_work_cases)) -> dict:
    return {"id": await service.add_attachment(db, case_id, payload, int(principal.id),
                                               principal.role)}


# ==========================================================================
# Configuration
# ==========================================================================
@router.get("/config", response_model=schemas.Config)
async def config(db: DbSession, _: Principal = Depends(_view_cases)) -> schemas.Config:
    return await service.config(db)


@router.put("/config/queues")
async def save_queue(payload: schemas.QueueWrite, db: DbSession,
                     principal: Principal = Depends(_config_queues)) -> dict:
    await service.save_queue(db, payload, int(principal.id))
    await _audit_admin(db, principal, "Configured collection queue", payload.code)
    return {"ok": True}


@router.put("/config/case-types")
async def save_case_type(payload: schemas.CaseTypeWrite, db: DbSession,
                         principal: Principal = Depends(_config_types)) -> dict:
    await service.save_case_type(db, payload, int(principal.id))
    await _audit_admin(db, principal, "Configured case type", payload.code)
    return {"ok": True}


# ==========================================================================
# Ticketing — board, grouping, tasks, escalation, bulk
# ==========================================================================
@router.get("/board", response_model=schemas.BoardResponse)
async def board(
    db: DbSession,
    groupBy: str = Query(default="STATUS"),
    sortBy: str = Query(default="PRIORITY"),
    search: str | None = Query(default=None),
    state: str | None = Query(default=None),
    category: str | None = Query(default=None),
    queue: str | None = Query(default=None),
    source: str | None = Query(default=None),
    typeCode: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    risk: str | None = Query(default=None),
    bucket: str | None = Query(default=None),
    region: str | None = Query(default=None),
    product: str | None = Query(default=None),
    portfolio: str | None = Query(default=None),
    agentId: int | None = Query(default=None),
    unassigned: bool = Query(default=False),
    breached: bool = Query(default=False),
    hasPtp: bool = Query(default=False),
    hasDispute: bool = Query(default=False),
    inLegal: bool = Query(default=False),
    inAgency: bool = Query(default=False),
    minOutstanding: float | None = Query(default=None),
    minDpd: int | None = Query(default=None),
    tags: list[str] | None = Query(default=None),
    limit: int = Query(default=500, le=2000),
    principal: Principal = Depends(_view_cases),
) -> schemas.BoardResponse:
    return await service.board(
        db, int(principal.id), group_by=groupBy, sort_by=sortBy, limit=limit,
        search=search, state=state, category=category, queue=queue, source=source,
        typeCode=typeCode, priority=priority, risk=risk, bucket=bucket, region=region,
        product=product, portfolio=portfolio,
        agentId=_desk_scope(principal, agentId), unassigned=unassigned,
        breached=breached, hasPtp=hasPtp, hasDispute=hasDispute, inLegal=inLegal,
        inAgency=inAgency, minOutstanding=minOutstanding, minDpd=minDpd, tags=tags)


@router.get("/board/group-options")
async def group_options(db: DbSession, _: Principal = Depends(_view_cases)) -> list[dict]:
    return await service.group_options(db)


@router.get("/counters", response_model=schemas.TicketCounters)
async def counters(db: DbSession, agentId: int | None = Query(default=None),
                   principal: Principal = Depends(_view_cases)) -> schemas.TicketCounters:
    return await service.counters(db, _desk_scope(principal, agentId))


# --- Tasks -----------------------------------------------------------------
@router.get("/tasks", response_model=schemas.TaskBoard)
async def tasks(
    db: DbSession,
    mine: bool = Query(default=True),
    agentId: int | None = Query(default=None),
    taskType: str | None = Query(default=None),
    includeDone: bool = Query(default=False),
    daysAhead: int = Query(default=30, le=180),
    principal: Principal = Depends(_view_cases),
) -> schemas.TaskBoard:
    owner = int(principal.id) if mine else _desk_scope(principal, agentId)
    return await service.task_board(db, agent_id=owner, task_type=taskType,
                                    include_done=includeDone, days_ahead=daysAhead)


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(payload: schemas.TaskCreate, db: DbSession,
                      principal: Principal = Depends(_work_cases)) -> dict:
    return {"id": await service.create_task(db, payload, int(principal.id))}


@router.patch("/tasks/{task_id}")
async def patch_task(task_id: int, payload: schemas.TaskPatch, db: DbSession,
                     principal: Principal = Depends(_work_cases)) -> dict:
    await service.patch_task(db, task_id, payload, int(principal.id))
    return {"ok": True}


# --- Escalation ------------------------------------------------------------
@router.post("/cases/{case_id}/escalate")
async def escalate(case_id: int, payload: schemas.EscalationRequest, db: DbSession,
                   principal: Principal = Depends(_work_cases)) -> dict:
    await service.escalate(db, case_id, payload, int(principal.id),
                           principal.permissions, principal.role)
    return {"ok": True}


@router.get("/escalations", response_model=list[schemas.EscalationRow])
async def escalations(db: DbSession, target: str | None = Query(default=None),
                      status_f: str | None = Query(default=None, alias="status"),
                      principal: Principal = Depends(_view_cases)
                      ) -> list[schemas.EscalationRow]:
    return await service.escalations(db, target, status_f,
                                     agent_id=_desk_scope(principal, None))


# --- Bulk, tags, watchers --------------------------------------------------
@router.post("/cases/bulk", response_model=schemas.BulkResult)
async def bulk(payload: schemas.BulkRequest, db: DbSession,
               principal: Principal = Depends(_work_cases)) -> schemas.BulkResult:
    res = await service.bulk(db, payload, int(principal.id), principal.permissions,
                             principal.role)
    await _audit_admin(db, principal, f"Bulk {payload.action.lower()}",
                       f"{res.ok} updated, {res.failed} failed")
    return res


@router.get("/tags", response_model=list[schemas.TagRow])
async def tags(db: DbSession, _: Principal = Depends(_view_cases)) -> list[schemas.TagRow]:
    return await service.tags(db)


@router.put("/cases/{case_id}/tags")
async def set_tags(case_id: int, codes: list[str], db: DbSession,
                   principal: Principal = Depends(_work_cases)) -> dict:
    await service.set_tags(db, case_id, codes, int(principal.id))
    return {"ok": True}


@router.post("/cases/{case_id}/watch")
async def watch(case_id: int, db: DbSession, on: bool = Query(default=True),
                principal: Principal = Depends(_view_cases)) -> dict:
    await service.watch(db, case_id, int(principal.id), on)
    return {"ok": True}
