"""The negotiator API (CLAUDE.md §4).

The gateway here is constructed with ``production=True``, so law 6 is enforced
at the call site: any attempt to reach the debtor simulator, the judge, or the
persona factory from a live route raises before a request is made.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from sqlalchemy import select

from agent.collector import ProductionCollector
from agent.prompts.loader import available
from api.schemas import (
    AuditEntry,
    CreateFromCaseRequest,
    CreateSessionRequest,
    CrmCaseSummaryView,
    EnvelopeView,
    ProposalPayload,
    SessionView,
    TurnRequestBody,
    TurnResponse,
    VerifiedEvidenceRequest,
)
from domain.account import Account
from domain.agreement import AgreementDelta
from gateway.client import Gateway
from orchestrator.loop import TurnRequest, run_turn
from persistence import crm
from persistence import repository as repo
from persistence.db import db_session
from persistence.models import AuditRecord, EvidenceRecord
from policy.envelope import Envelope, compute_envelope
from policy.evidence_intake import (
    EvidenceIntakeError,
    EvidenceSource,
    EvidenceSubmission,
    accept,
)
from retrieval.packs import known_jurisdictions

app = FastAPI(
    title="Negotiator API",
    version="0.3.0",
    description="Debt-collection negotiation agent. Policy-enforced, audited.",
)

# Law 6: eval-only roles are unreachable from here, enforced at call time.
_gateway = Gateway(production=True)
_collector = ProductionCollector(_gateway)

TERMINAL_STATUSES = {"escalated", "agreed", "closed"}


def _envelope_view(envelope: Envelope) -> EnvelopeView:
    return EnvelopeView(
        max_disc_ratio=int(envelope.max_disc_ratio),
        min_pmt_ratio=int(envelope.min_pmt_ratio),
        max_pmt_days=int(envelope.max_pmt_days),
        allowed_inst_prds=sorted(int(p) for p in envelope.allowed_inst_prds),
        hardship_tier=envelope.hardship_tier.value,
    )


def _proposal_view(delta: AgreementDelta | None) -> ProposalPayload | None:
    if delta is None:
        return None
    return ProposalPayload(**delta.model_dump())


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    """Liveness plus the things that silently break a deployment."""
    status: dict[str, Any] = {"ok": True, "prompts": available()}
    try:
        with db_session() as db:
            db.execute(select(1))
        status["database"] = "ok"
    except Exception as exc:
        status["ok"] = False
        status["database"] = f"error: {type(exc).__name__}"
    status["jurisdictions"] = known_jurisdictions()
    return status


@app.post("/sessions", response_model=SessionView, status_code=201)
def create_session(body: CreateSessionRequest) -> SessionView:
    if body.jurisdiction.lower() not in known_jurisdictions():
        # Fail closed at the door rather than at the first turn (§7).
        raise HTTPException(
            status_code=422,
            detail=(
                f"no compliance pack for jurisdiction '{body.jurisdiction}'; "
                f"known: {known_jurisdictions()}"
            ),
        )

    account = Account(
        account_id=body.account_id,
        tenant_id=body.tenant_id,
        jurisdiction=body.jurisdiction.lower(),
        product=body.product,
        principal=body.principal,
        days_overdue=body.days_overdue,
    )
    with db_session() as db:
        row = repo.create_session(db, account)
        return _session_view(db, row)


@app.get("/sessions/{session_id}", response_model=SessionView)
def read_session(session_id: str) -> SessionView:
    with db_session() as db:
        row = repo.get_session(db, session_id)
        if row is None:
            raise HTTPException(404, "session not found")
        return _session_view(db, row)


@app.post("/sessions/{session_id}/turn", response_model=TurnResponse)
def take_turn(session_id: str, body: TurnRequestBody) -> TurnResponse:
    with db_session() as db:
        row = repo.get_session(db, session_id)
        if row is None:
            raise HTTPException(404, "session not found")
        if row.status in TERMINAL_STATUSES:
            # An escalated session is closed to the agent. §6 is a hard handoff,
            # not a pause the caller can talk its way out of by retrying.
            raise HTTPException(
                409,
                f"session is {row.status}; no further agent turns are permitted",
            )

        account = repo.account_from_row(row)
        turns = repo.load_turns(db, session_id)
        ledger = repo.rebuild_ledger(db, session_id)
        proposal = (
            AgreementDelta(**body.proposal.model_dump()) if body.proposal else None
        )

        outcome = run_turn(
            _gateway,
            _collector,
            TurnRequest(
                account=account,
                turns=turns,
                ledger=ledger,
                debtor_message=body.message,
                debtor_proposal=proposal,
                last_collector_offer=repo.last_collector_offer(turns),
            ),
        )

        repo.record_turn(
            db,
            row,
            outcome,
            debtor_message=body.message,
            debtor_proposal=proposal,
        )

        return TurnResponse(
            session_id=session_id,
            status=row.status,
            escalated=outcome.escalated,
            escalation_trigger=(
                outcome.escalation_trigger.value if outcome.escalation_trigger else None
            ),
            escalation_detail=outcome.escalation_detail,
            strategy=outcome.turn.strategy.value if outcome.turn else None,
            action=outcome.turn.action.value if outcome.turn else None,
            dialogue=outcome.dialogue,
            proposed=_proposal_view(outcome.turn.proposed if outcome.turn else None),
            envelope=_envelope_view(outcome.envelope),
            agreement=_proposal_view(
                AgreementDelta.from_agreement(outcome.agreement)
                if outcome.agreement
                else None
            ),
            evidence_admitted=[e.kind.value for e in outcome.evidence_admitted],
            attempts=len(outcome.attempts),
            retries_used=max(0, len(outcome.attempts) - 1),
        )


@app.post("/sessions/{session_id}/evidence", response_model=SessionView)
def add_evidence(session_id: str, body: VerifiedEvidenceRequest) -> SessionView:
    """Record out-of-band verified evidence.

    The only route to the tiers that unlock a discount. Chat cannot reach them.
    """
    with db_session() as db:
        row = repo.get_session(db, session_id)
        if row is None:
            raise HTTPException(404, "session not found")

        try:
            accept(
                EvidenceSubmission(
                    kind=body.kind,
                    source=EvidenceSource.VERIFIED_UPLOAD,
                    turn_index=len(repo.load_turns(db, session_id)),
                    verified_by=body.verified_by,
                    note=body.note,
                )
            )
        except EvidenceIntakeError as exc:
            raise HTTPException(422, str(exc)) from exc

        repo.add_verified_evidence(
            db,
            row,
            kind=body.kind.value,
            verified_by=body.verified_by,
            note=body.note,
            turn_index=len(repo.load_turns(db, session_id)),
        )
        return _session_view(db, row)


@app.get("/sessions/{session_id}/audit", response_model=list[AuditEntry])
def read_audit(session_id: str) -> list[AuditEntry]:
    """The §7 trail, including attempts that were rejected before they shipped."""
    with db_session() as db:
        if repo.get_session(db, session_id) is None:
            raise HTTPException(404, "session not found")
        rows = (
            db.execute(
                select(AuditRecord)
                .where(AuditRecord.session_id == session_id)
                .order_by(AuditRecord.turn_index, AuditRecord.attempt)
            )
            .scalars()
            .all()
        )
        return [
            AuditEntry(
                turn_index=r.turn_index,
                attempt=r.attempt,
                model=r.model,
                prompt_version=r.prompt_version,
                strategy=r.strategy,
                proposed=r.proposed,
                envelope=r.envelope,
                retrieved_refs=list(r.retrieved_refs or []),
                policy_approved=r.policy_approved,
                policy_violations=list(r.policy_violations or []),
                guardrail_passed=r.guardrail_passed,
                guardrail_findings=list(r.guardrail_findings or []),
                accepted=r.accepted,
                dialogue=r.dialogue,
                created_at=r.created_at.isoformat(),
            )
            for r in rows
        ]


def _session_view(db: Any, row: Any) -> SessionView:
    account = repo.account_from_row(row)
    ledger = repo.rebuild_ledger(db, row.id)
    envelope = compute_envelope(account, ledger)
    evidence = (
        db.execute(
            select(EvidenceRecord.kind).where(EvidenceRecord.session_id == row.id)
        )
        .scalars()
        .all()
    )
    return SessionView(
        session_id=row.id,
        status=row.status,
        account_id=row.account_id,
        tenant_id=row.tenant_id,
        jurisdiction=row.jurisdiction,
        principal=row.principal,
        days_overdue=row.days_overdue,
        turn_count=len(repo.load_turns(db, row.id)),
        envelope=_envelope_view(envelope),
        agreement=(ProposalPayload(**row.agreement) if row.agreement else None),
        evidence_on_file=sorted(set(evidence)),
    )


@app.get("/crm/cases", response_model=list[CrmCaseSummaryView])
def list_crm_cases(limit: int = 25, only_open: bool = True) -> list[CrmCaseSummaryView]:
    """Real debt cases available to negotiate. Read-only.

    Deliberately returns no direct identifiers — a case code, a balance and a
    behaviour type are enough to pick a case to work, and anything more would
    put PII in a response that gets logged.
    """
    with db_session() as db:
        return [
            CrmCaseSummaryView(**c.model_dump())
            for c in crm.list_cases(db, limit=limit, only_open=only_open)
        ]


@app.post("/sessions/from-case", response_model=SessionView, status_code=201)
def create_session_from_case(body: CreateFromCaseRequest) -> SessionView:
    """Open a negotiation against a REAL customer debt case.

    The CRM row has 48 columns; only the allow-listed behavioural subset in
    :class:`domain.customer.CustomerContext` is carried forward, and no direct
    identifier ever is (§11).
    """
    if body.jurisdiction.lower() not in known_jurisdictions():
        raise HTTPException(
            status_code=422,
            detail=f"no compliance pack for '{body.jurisdiction}'",
        )
    with db_session() as db:
        try:
            case = crm.load_case(
                db,
                body.case_code,
                jurisdiction=body.jurisdiction.lower(),
                tenant_id=body.tenant_id,
            )
        except crm.CrmCaseNotFoundError as exc:
            raise HTTPException(404, str(exc)) from exc

        row = repo.create_session(db, case.account)
        row.inferred_archetype = (
            case.context.inferred_archetype.value
            if case.context.inferred_archetype
            else None
        )
        return _session_view(db, row)
