"""The turn loop (CLAUDE.md §5).

One path. Single generation per turn, plus up to two informed retries.

    1. assemble state
    2. retrieve context      — fail closed
    3. generate              — one strategy-labelled turn
    4. policy validation     — deterministic
    5. guardrails            — post-generation compliance
    6. on 4 or 5 failure     — regenerate with the violation fed back,
                               max 2 retries, then escalate
    7. persist               — full audit record

Ordering is deliberate and load-bearing:

**Escalation triggers run before generation.** A debtor who disputes the debt or
asks for written validation gets a handoff, not a negotiating turn. Checking
afterwards would mean the model had already composed a reply arguing with them.

**Evidence is extracted before the envelope is computed**, so a disclosure
counts on the turn it was made rather than the next one.

**Nothing non-compliant is ever returned.** Retry exhaustion escalates. That is
the §5.6 contract: the failure mode is a human picking up the conversation, not
a plausible-sounding turn that broke a rule.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from agent.collector import Generation, ProductionCollector
from agent.extractor import extract
from domain.account import Account
from domain.agreement import Agreement, AgreementDelta
from domain.customer import CustomerContext
from domain.enums import Action, DebtorStrategy, Speaker
from domain.evidence import EvidenceEvent
from domain.turn import Turn
from gateway.client import Gateway
from guardrails.compliance import ComplianceResult, check
from guardrails.triggers import (
    EscalationTrigger,
    TriggerHit,
    is_authority_challenge,
    scan_conversation,
)
from policy.envelope import Envelope, compute_envelope
from policy.ladder import ConcessionLedger, apply_all
from policy.validation import ValidationResult, validate_delta
from retrieval.packs import CompliancePack, RetrievalError, get_pack

MAX_RETRIES = 2
"""§5.6: two retries, then escalate rather than return a non-compliant turn."""


class AttemptRecord(BaseModel):
    """One generation attempt — accepted or not.

    Rejected attempts are kept deliberately. "The model tried to offer 30% and
    we stopped it" is precisely what a regulator wants to see, and it is
    invisible if only accepted output is retained.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    attempt: int
    model: str
    prompt_version: str
    strategy: str | None
    proposed: dict[str, int | None] | None
    policy: ValidationResult
    compliance: ComplianceResult
    accepted: bool
    dialogue: str
    prompt_tokens: int = 0
    completion_tokens: int = 0


class TurnOutcome(BaseModel):
    """Everything one call to :func:`run_turn` produced."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    escalated: bool = False
    escalation_trigger: EscalationTrigger | None = None
    escalation_detail: str = ""

    turn: Turn | None = None
    envelope: Envelope
    ledger: ConcessionLedger
    evidence_admitted: tuple[EvidenceEvent, ...] = ()
    evidence_rejected: tuple[str, ...] = ()
    authority_challenged: bool = False
    retrieved_refs: tuple[str, ...] = ()
    attempts: tuple[AttemptRecord, ...] = ()
    agreement: Agreement | None = None

    @property
    def dialogue(self) -> str:
        return self.turn.dialogue if self.turn else ""


class TurnRequest(BaseModel):
    """The state the loop needs. Assembled by the caller from storage."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    account: Account
    turns: tuple[Turn, ...] = ()
    ledger: ConcessionLedger = ConcessionLedger()
    debtor_message: str | None = None
    debtor_proposal: AgreementDelta | None = None
    last_collector_offer: AgreementDelta | None = None
    context: CustomerContext | None = None
    """Institution-held behavioural context (§5.1). Never direct identifiers."""


def _escalate(
    hit: TriggerHit, envelope: Envelope, ledger: ConcessionLedger
) -> TurnOutcome:
    return TurnOutcome(
        escalated=True,
        escalation_trigger=hit.trigger,
        escalation_detail=hit.detail,
        envelope=envelope,
        ledger=ledger,
    )


def run_turn(
    gateway: Gateway,
    collector: ProductionCollector,
    request: TurnRequest,
) -> TurnOutcome:
    """Produce the next collector turn, or escalate."""
    turns = request.turns
    index = len(turns)
    ledger = request.ledger

    # --- 1/2. retrieve context, fail closed -------------------------------
    # Before anything else: §7 forbids negotiating in a jurisdiction whose
    # rules we could not load. A soft degrade here is the one failure the
    # spec calls out by name.
    try:
        pack: CompliancePack = get_pack(request.account.jurisdiction)
    except RetrievalError as exc:
        return _escalate(
            TriggerHit(trigger=EscalationTrigger.GUARDRAIL_BREACH, detail=str(exc)),
            compute_envelope(request.account, ledger),
            ledger,
        )

    # --- debtor message: triggers first, then evidence ---------------------
    evidence_admitted: tuple[EvidenceEvent, ...] = ()
    evidence_rejected: tuple[str, ...] = ()
    authority_challenged = False

    if request.debtor_message is not None:
        previous = [t.dialogue for t in turns if t.speaker is Speaker.DEBTOR]
        hits = scan_conversation(request.debtor_message, previous)
        if hits:
            # Hard handoff. The agent does not get a turn in which to argue.
            return _escalate(hits[0], compute_envelope(request.account, ledger), ledger)

        # Not an escalation — the debtor is challenging the caller, not the
        # debt. The collector is told to identify itself properly rather
        # than press on, which is what the debtor is actually asking for.
        authority_challenged = is_authority_challenge(request.debtor_message)

        extraction = extract(
            gateway,
            request.debtor_message,
            "\n".join(f"[{t.speaker.value}] {t.dialogue}" for t in turns),
            turn_index=index,
        )
        evidence_admitted = extraction.events
        evidence_rejected = extraction.rejected
        ledger = apply_all(evidence_admitted, ledger)

        turns = (
            *turns,
            Turn(
                index=index,
                speaker=Speaker.DEBTOR,
                strategy=DebtorStrategy.HONEST_DISCLOSURE,
                thoughts=extraction.reasoning,
                action=Action.ASK,
                dialogue=request.debtor_message,
                proposed=request.debtor_proposal,
                evidence=evidence_admitted,
            ),
        )
        index += 1

    # --- 1. assemble state -------------------------------------------------
    envelope = compute_envelope(request.account, ledger)

    # --- 3-6. generate, validate, guardrail, retry -------------------------
    attempts: list[AttemptRecord] = []
    feedback = ""

    for attempt in range(MAX_RETRIES + 1):
        generation: Generation = collector.generate(
            account=request.account,
            turns=turns,
            envelope=envelope,
            pack=pack,
            index=index,
            violation_feedback=feedback,
            context=request.context,
            authority_challenged=authority_challenged,
        )
        turn = generation.turn

        policy = validate_delta(turn.proposed or AgreementDelta(), envelope)
        compliance = check(turn.dialogue, turn_index=index)
        accepted = policy.approved and compliance.passed

        attempts.append(
            AttemptRecord(
                attempt=attempt,
                model=generation.model,
                prompt_version=generation.prompt_version,
                strategy=turn.strategy.value,
                proposed=turn.proposed.model_dump() if turn.proposed else None,
                policy=policy,
                compliance=compliance,
                accepted=accepted,
                dialogue=turn.dialogue,
                prompt_tokens=generation.prompt_tokens,
                completion_tokens=generation.completion_tokens,
            )
        )

        if accepted:
            agreement = _settle(turn, request.last_collector_offer, request)
            return TurnOutcome(
                turn=turn,
                envelope=envelope,
                ledger=ledger,
                evidence_admitted=evidence_admitted,
                evidence_rejected=evidence_rejected,
                authority_challenged=authority_challenged,
                retrieved_refs=tuple(pack.refs()),
                attempts=tuple(attempts),
                agreement=agreement,
            )

        feedback = "\n".join(filter(None, [policy.feedback(), compliance.feedback()]))

    # --- retry exhausted ---------------------------------------------------
    # Deliberately not "return the least-bad attempt". §5.6 says escalate, and
    # a turn that failed validation twice is exactly the turn a human should
    # be handling.
    return TurnOutcome(
        escalated=True,
        escalation_trigger=EscalationTrigger.RETRY_EXHAUSTED,
        escalation_detail=(
            f"{MAX_RETRIES + 1} attempts failed policy or compliance: {feedback}"
        ),
        envelope=envelope,
        ledger=ledger,
        evidence_admitted=evidence_admitted,
        evidence_rejected=evidence_rejected,
        authority_challenged=authority_challenged,
        retrieved_refs=tuple(pack.refs()),
        attempts=tuple(attempts),
    )


def _settle(
    turn: Turn,
    last_collector_offer: AgreementDelta | None,
    request: TurnRequest,
) -> Agreement | None:
    """Whether this turn closes the negotiation.

    Same semantics the eval runner uses: an ``accept`` takes the *other* side's
    outstanding complete offer, and matching complete offers converge. A
    partial offer never closes — §3.1 requires all four fields.
    """
    if turn.action is Action.ACCEPT:
        return (
            request.debtor_proposal.to_agreement() if request.debtor_proposal else None
        )

    collector_offer = turn.proposed
    if collector_offer is not None and last_collector_offer is not None:
        collector_offer = last_collector_offer.merged_with(collector_offer)

    if (
        collector_offer is not None
        and request.debtor_proposal is not None
        and collector_offer == request.debtor_proposal
    ):
        return collector_offer.to_agreement()
    return None
