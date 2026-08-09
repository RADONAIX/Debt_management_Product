"""Shared chatbot transcript and human handoff persistence."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.engagement import schemas


_CONVERSATION_SQL = """
    SELECT s.id AS session_id, e.id AS escalation_id, e.status, e.trigger,
           e.detail, e.assigned_to, e.created_at, e.accepted_at, e.resolved_at,
           u.full_name AS assigned_to_name,
           c.id AS customer_id, c.customer_code, c.full_name, c.email, c.msisdn,
           COALESCE(a.account_code, s.account_id) AS account_code,
           s.principal AS outstanding, s.days_overdue AS dpd,
           last_turn.dialogue AS last_message,
           last_turn.speaker AS last_speaker,
           last_turn.created_at AS last_message_at
    FROM chatbot.escalations e
    JOIN chatbot.sessions s ON s.id = e.session_id
    LEFT JOIN customer_schema.account a ON a.account_code = s.account_id
    LEFT JOIN customer_schema.customer c ON c.id = a.customer_id
    LEFT JOIN administration.app_user u ON u.id = e.assigned_to
    LEFT JOIN LATERAL (
        SELECT t.dialogue, t.speaker, t.created_at
        FROM chatbot.turns t
        WHERE t.session_id = s.id
        ORDER BY t.index DESC, t.id DESC
        LIMIT 1
    ) last_turn ON true
"""


def _conversation(row) -> schemas.ConversationRow:
    return schemas.ConversationRow(
        sessionId=row["session_id"], escalationId=row["escalation_id"],
        status=row["status"], trigger=row["trigger"], detail=row["detail"] or "",
        customerId=row["customer_id"], customerCode=row["customer_code"],
        customerName=row["full_name"] or row["customer_code"] or row["account_code"],
        email=row["email"], msisdn=row["msisdn"], accountCode=row["account_code"],
        outstanding=float(row["outstanding"] or 0), dpd=int(row["dpd"] or 0),
        assignedTo=row["assigned_to"], assignedToName=row["assigned_to_name"],
        lastMessage=row["last_message"], lastSpeaker=row["last_speaker"],
        lastMessageAt=row["last_message_at"], createdAt=row["created_at"],
        acceptedAt=row["accepted_at"], resolvedAt=row["resolved_at"],
    )


async def summary(db: AsyncSession) -> schemas.ChatSummary:
    row = (await db.execute(text("""
        SELECT count(*) FILTER (WHERE status = 0) AS waiting,
               count(*) FILTER (WHERE status = 1) AS active,
               count(*) FILTER (
                   WHERE status = 2 AND resolved_at::date = CURRENT_DATE
               ) AS resolved_today
        FROM chatbot.escalations
    """))).mappings().one()
    return schemas.ChatSummary(
        waiting=row["waiting"], active=row["active"],
        resolvedToday=row["resolved_today"],
    )


async def conversations(db: AsyncSession, state: str = "open") -> list[schemas.ConversationRow]:
    status_filter = {
        "waiting": "e.status = 0",
        "active": "e.status = 1",
        "resolved": "e.status = 2",
        "open": "e.status IN (0, 1)",
        "all": "true",
    }.get(state)
    if status_filter is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown conversation state.")
    rows = (await db.execute(text(
        f"{_CONVERSATION_SQL} WHERE {status_filter} "
        "ORDER BY CASE e.status WHEN 0 THEN 0 WHEN 1 THEN 1 ELSE 2 END, "
        "COALESCE(last_turn.created_at, e.created_at) DESC"
    ))).mappings().all()
    return [_conversation(row) for row in rows]


async def conversation(db: AsyncSession, session_id: str) -> schemas.ConversationDetail:
    row = (await db.execute(
        text(f"{_CONVERSATION_SQL} WHERE s.id = :session_id"),
        {"session_id": session_id},
    )).mappings().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    messages = (await db.execute(text("""
        SELECT id, index, speaker, dialogue, created_at
        FROM chatbot.turns
        WHERE session_id = :session_id
        ORDER BY index, id
    """), {"session_id": session_id})).mappings().all()
    base = _conversation(row)
    return schemas.ConversationDetail(
        **base.model_dump(),
        messages=[schemas.ChatMessage(
            id=item["id"], index=item["index"], speaker=item["speaker"],
            text=item["dialogue"], createdAt=item["created_at"],
        ) for item in messages],
    )


async def accept(db: AsyncSession, session_id: str, actor_id: int) -> None:
    result = await db.execute(text("""
        UPDATE chatbot.escalations
        SET status = 1, assigned_to = :actor, accepted_at = COALESCE(accepted_at, now())
        WHERE session_id = :session_id AND status = 0
        RETURNING id
    """), {"session_id": session_id, "actor": actor_id})
    if result.first() is None:
        current = (await db.execute(text(
            "SELECT status FROM chatbot.escalations WHERE session_id = :session_id"
        ), {"session_id": session_id})).scalar_one_or_none()
        if current is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
        if current == 2:
            raise HTTPException(status.HTTP_409_CONFLICT, "Conversation is already resolved.")
    await db.commit()


async def send_message(
    db: AsyncSession, session_id: str, actor_id: int, message: str,
) -> int:
    # Lock the session so a simultaneous customer poll/send cannot allocate the
    # same transcript index as the agent.
    session = (await db.execute(text("""
        SELECT id FROM chatbot.sessions WHERE id = :session_id FOR UPDATE
    """), {"session_id": session_id})).first()
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")

    escalation = (await db.execute(text("""
        SELECT status FROM chatbot.escalations
        WHERE session_id = :session_id FOR UPDATE
    """), {"session_id": session_id})).scalar_one_or_none()
    if escalation is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This conversation was not escalated.")
    if escalation == 2:
        raise HTTPException(status.HTTP_409_CONFLICT, "Conversation is already resolved.")

    await db.execute(text("""
        UPDATE chatbot.escalations
        SET status = 1, assigned_to = COALESCE(assigned_to, :actor),
            accepted_at = COALESCE(accepted_at, now())
        WHERE session_id = :session_id
    """), {"session_id": session_id, "actor": actor_id})
    next_index = (await db.execute(text("""
        SELECT COALESCE(max(index) + 1, 0)
        FROM chatbot.turns WHERE session_id = :session_id
    """), {"session_id": session_id})).scalar_one()
    message_id = (await db.execute(text("""
        INSERT INTO chatbot.turns
            (session_id, index, speaker, strategy, action, dialogue, thoughts)
        VALUES (:session_id, :idx, 'agent', NULL, 'human_response', :message, '')
        RETURNING id
    """), {
        "session_id": session_id, "idx": next_index, "message": message.strip(),
    })).scalar_one()
    await db.commit()
    return message_id


async def resolve(db: AsyncSession, session_id: str, actor_id: int) -> None:
    result = await db.execute(text("""
        UPDATE chatbot.escalations
        SET status = 2, assigned_to = COALESCE(assigned_to, :actor),
            accepted_at = COALESCE(accepted_at, now()), resolved_at = now()
        WHERE session_id = :session_id AND status IN (0, 1)
        RETURNING id
    """), {"session_id": session_id, "actor": actor_id})
    if result.first() is None:
        current = (await db.execute(text(
            "SELECT status FROM chatbot.escalations WHERE session_id = :session_id"
        ), {"session_id": session_id})).scalar_one_or_none()
        if current is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
        # Resolve is idempotent so a double-click or retried network request
        # cannot turn a successful close into a misleading error.
        if current == 2:
            return
    await db.execute(text("""
        UPDATE chatbot.sessions SET status = 'closed', updated_at = now()
        WHERE id = :session_id
    """), {"session_id": session_id})
    await db.commit()
