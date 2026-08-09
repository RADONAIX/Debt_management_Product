"""Reading and writing negotiation state (CLAUDE.md §7).

The audit write is the part that matters. Law 7: *"Persist state, model and
prompt versions, retrieved context references, selected strategy, validation
outcomes, and final utterance. Collections is regulated; the transcript is the
evidence."*

Note :func:`record_turn` writes **one audit row per generation attempt**. A turn
that was rejected by policy and regenerated leaves its rejected attempt behind
on purpose — "the model tried to offer 30% and the engine stopped it" is exactly
what an auditor needs, and keeping only accepted output erases it.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from domain.account import Account
from domain.agreement import AgreementDelta
from domain.enums import Speaker
from domain.turn import Turn as DomainTurn
from orchestrator.loop import TurnOutcome
from persistence.models import AuditRecord, Escalation, EvidenceRecord, Session, Turn
from policy.evidence_intake import EvidenceSource
from policy.ladder import ConcessionAxis, ConcessionLedger


def new_session_id() -> str:
    return f"sess_{uuid.uuid4().hex[:20]}"


def create_session(db: OrmSession, account: Account) -> Session:
    row = Session(
        id=new_session_id(),
        tenant_id=account.tenant_id,
        account_id=account.account_id,
        jurisdiction=account.jurisdiction,
        product=account.product,
        principal=account.principal,
        days_overdue=account.days_overdue,
        status="open",
        ledger=ledger_to_json(ConcessionLedger()),
    )
    db.add(row)
    db.flush()
    return row


def get_session(db: OrmSession, session_id: str) -> Session | None:
    return db.get(Session, session_id)


def account_from_row(row: Session) -> Account:
    return Account(
        account_id=row.account_id,
        tenant_id=row.tenant_id,
        jurisdiction=row.jurisdiction,
        product=row.product,
        principal=Decimal(row.principal),
        days_overdue=row.days_overdue,
        inferred_archetype=row.inferred_archetype,  # type: ignore[arg-type]
    )


def ledger_to_json(ledger: ConcessionLedger) -> dict[str, object]:
    return {
        "spent_evidence": sorted(k.value for k in ledger.spent_evidence),
        "discount_rungs": ledger.discount_rungs,
        "upfront_rungs": ledger.upfront_rungs,
        "pay_window_rungs": ledger.pay_window_rungs,
        "installment_rungs": ledger.installment_rungs,
    }


def ledger_from_json(payload: dict[str, object]) -> ConcessionLedger:
    return ConcessionLedger(
        spent_evidence=frozenset(payload.get("spent_evidence", []) or []),  # type: ignore[arg-type]
        discount_rungs=int(payload.get("discount_rungs", 0) or 0),
        upfront_rungs=int(payload.get("upfront_rungs", 0) or 0),
        pay_window_rungs=int(payload.get("pay_window_rungs", 0) or 0),
        installment_rungs=int(payload.get("installment_rungs", 0) or 0),
    )


def load_turns(db: OrmSession, session_id: str) -> tuple[DomainTurn, ...]:
    rows = (
        db.execute(
            select(Turn).where(Turn.session_id == session_id).order_by(Turn.index)
        )
        .scalars()
        .all()
    )
    turns: list[DomainTurn] = []
    for row in rows:
        turns.append(
            DomainTurn(
                index=row.index,
                speaker=Speaker(row.speaker),
                strategy=row.strategy,  # type: ignore[arg-type]
                thoughts=row.thoughts,
                action=row.action,  # type: ignore[arg-type]
                dialogue=row.dialogue,
                proposed=AgreementDelta(**row.proposed) if row.proposed else None,
            )
        )
    return tuple(turns)


def last_collector_offer(turns: tuple[DomainTurn, ...]) -> AgreementDelta | None:
    """The collector's standing offer, accumulated across turns.

    Merged rather than "most recent", because a collector may settle terms one
    at a time; the standing offer is everything agreed so far.
    """
    offer: AgreementDelta | None = None
    for turn in turns:
        if turn.speaker is Speaker.COLLECTOR and turn.proposed is not None:
            offer = turn.proposed if offer is None else offer.merged_with(turn.proposed)
    return offer


def record_turn(
    db: OrmSession,
    session_row: Session,
    outcome: TurnOutcome,
    *,
    debtor_message: str | None,
    debtor_proposal: AgreementDelta | None,
) -> None:
    """Persist a completed turn: transcript, evidence, audit, escalation."""
    index = _next_index(db, session_row.id)

    if debtor_message is not None:
        db.add(
            Turn(
                session_id=session_row.id,
                index=index,
                speaker=Speaker.DEBTOR.value,
                strategy=None,
                action="ask",
                dialogue=debtor_message,
                thoughts="",
                proposed=debtor_proposal.model_dump(mode="json")
                if debtor_proposal
                else None,
            )
        )
        for event in outcome.evidence_admitted:
            db.add(
                EvidenceRecord(
                    session_id=session_row.id,
                    turn_index=index,
                    kind=event.kind.value,
                    source=EvidenceSource.CHAT_EXTRACTION.value,
                    verified_by=None,
                    note=event.note,
                )
            )
        index += 1

    envelope_json = outcome.envelope.model_dump(mode="json")
    ledger_json = ledger_to_json(outcome.ledger)

    for attempt in outcome.attempts:
        db.add(
            AuditRecord(
                session_id=session_row.id,
                turn_index=index,
                attempt=attempt.attempt,
                model=attempt.model,
                prompt_version=attempt.prompt_version,
                envelope=envelope_json,
                ledger=ledger_json,
                strategy=attempt.strategy,
                proposed=attempt.proposed,
                retrieved_refs=list(outcome.retrieved_refs),
                policy_approved=attempt.policy.approved,
                policy_violations=[
                    v.model_dump(mode="json") for v in attempt.policy.violations
                ],
                guardrail_passed=attempt.compliance.passed,
                guardrail_findings=[
                    f.model_dump(mode="json") for f in attempt.compliance.findings
                ],
                accepted=attempt.accepted,
                dialogue=attempt.dialogue,
                prompt_tokens=attempt.prompt_tokens,
                completion_tokens=attempt.completion_tokens,
            )
        )

    if outcome.turn is not None:
        db.add(
            Turn(
                session_id=session_row.id,
                index=index,
                speaker=Speaker.COLLECTOR.value,
                strategy=outcome.turn.strategy.value,
                action=outcome.turn.action.value,
                dialogue=outcome.turn.dialogue,
                thoughts=outcome.turn.thoughts,
                proposed=outcome.turn.proposed.model_dump(mode="json")
                if outcome.turn.proposed
                else None,
            )
        )

    if outcome.escalated and outcome.escalation_trigger is not None:
        db.add(
            Escalation(
                session_id=session_row.id,
                turn_index=index,
                trigger=outcome.escalation_trigger.value,
                detail=outcome.escalation_detail,
                status=0,
            )
        )
        session_row.status = "escalated"

    if outcome.agreement is not None:
        session_row.agreement = outcome.agreement.model_dump(mode="json")
        session_row.status = "agreed"

    session_row.ledger = ledger_json


def add_verified_evidence(
    db: OrmSession,
    session_row: Session,
    *,
    kind: str,
    verified_by: str,
    note: str,
    turn_index: int,
) -> None:
    db.add(
        EvidenceRecord(
            session_id=session_row.id,
            turn_index=turn_index,
            kind=kind,
            source=EvidenceSource.VERIFIED_UPLOAD.value,
            verified_by=verified_by,
            note=note,
        )
    )


def rebuild_ledger(db: OrmSession, session_id: str) -> ConcessionLedger:
    """Recompute the ledger from every recorded evidence event.

    Rebuilt rather than trusted from the stored column: the ledger is a pure
    function of the evidence on record, and deriving it means a corrupted or
    hand-edited ledger column cannot silently widen anyone's envelope.
    """
    from domain.evidence import EvidenceEvent, EvidenceKind
    from policy.ladder import apply_all

    rows = (
        db.execute(
            select(EvidenceRecord)
            .where(EvidenceRecord.session_id == session_id)
            .order_by(EvidenceRecord.id)
        )
        .scalars()
        .all()
    )
    events = [
        EvidenceEvent(kind=EvidenceKind(r.kind), turn_index=r.turn_index, note=r.note)
        for r in rows
    ]
    return apply_all(events)


def _next_index(db: OrmSession, session_id: str) -> int:
    rows = (
        db.execute(select(Turn.index).where(Turn.session_id == session_id))
        .scalars()
        .all()
    )
    return max(rows) + 1 if rows else 0


__all__ = [
    "ConcessionAxis",
    "account_from_row",
    "add_verified_evidence",
    "create_session",
    "get_session",
    "last_collector_offer",
    "ledger_from_json",
    "ledger_to_json",
    "load_turns",
    "rebuild_ledger",
    "record_turn",
]
