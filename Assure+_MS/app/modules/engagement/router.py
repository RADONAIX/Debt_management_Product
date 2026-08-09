"""Protected AI Engagement Center live-chat routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey, desk_scope
from app.modules.engagement import contacts, schemas, service

router = APIRouter(prefix="/engagement", tags=["engagement"])

_can_view = require(PermKey.AI_ENGAGEMENT, "view")
_can_edit = require(PermKey.AI_ENGAGEMENT, "edit")


@router.get("/chat/summary", response_model=schemas.ChatSummary)
async def chat_summary(
    db: DbSession, _: Principal = Depends(_can_view),
) -> schemas.ChatSummary:
    return await service.summary(db)


@router.get("/chat/conversations", response_model=list[schemas.ConversationRow])
async def chat_conversations(
    db: DbSession,
    state: str = Query(default="open", pattern="^(waiting|active|resolved|open|all)$"),
    _: Principal = Depends(_can_view),
) -> list[schemas.ConversationRow]:
    return await service.conversations(db, state)


@router.get("/chat/conversations/{session_id}", response_model=schemas.ConversationDetail)
async def chat_conversation(
    session_id: str, db: DbSession, _: Principal = Depends(_can_view),
) -> schemas.ConversationDetail:
    return await service.conversation(db, session_id)


@router.post("/chat/conversations/{session_id}/accept", response_model=schemas.ActionResult)
async def accept_chat(
    session_id: str, db: DbSession, principal: Principal = Depends(_can_edit),
) -> schemas.ActionResult:
    await service.accept(db, session_id, int(principal.id))
    return schemas.ActionResult()


@router.post("/chat/conversations/{session_id}/messages")
async def send_agent_message(
    session_id: str, payload: schemas.SendAgentMessage, db: DbSession,
    principal: Principal = Depends(_can_edit),
) -> dict:
    message_id = await service.send_message(
        db, session_id, int(principal.id), payload.message,
    )
    return {"id": message_id}


@router.post("/chat/conversations/{session_id}/resolve", response_model=schemas.ActionResult)
async def resolve_chat(
    session_id: str, db: DbSession, principal: Principal = Depends(_can_edit),
) -> schemas.ActionResult:
    await service.resolve(db, session_id, int(principal.id))
    return schemas.ActionResult()


# ==========================================================================
# Contact history — every conversation, on any channel
# ==========================================================================
@router.get("/contacts/summary", response_model=schemas.ContactSummary)
async def contacts_summary(
    db: DbSession, agentId: int | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=180),
    principal: Principal = Depends(_can_view),
) -> schemas.ContactSummary:
    """How the desk has been engaging customers, and how well it lands."""
    return await contacts.summary(db, desk_scope(principal, agentId, default_floor=True), days)


@router.get("/contacts", response_model=list[schemas.ContactRow])
async def contact_history(
    db: DbSession,
    agentId: int | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=180),
    channel: str | None = None,
    direction: str | None = None,
    reached: bool | None = None,
    search: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(_can_view),
) -> list[schemas.ContactRow]:
    """The conversations themselves — calls, messages and bot exchanges."""
    return await contacts.history(
        db, agent_id=desk_scope(principal, agentId, default_floor=True),
        days=days, channel=channel, direction=direction,
        reached=reached, search=search, limit=limit, offset=offset)


@router.get("/contacts/options", response_model=schemas.ContactOptions)
async def contact_options(
    db: DbSession, _: Principal = Depends(_can_view),
) -> schemas.ContactOptions:
    return await contacts.options(db)
