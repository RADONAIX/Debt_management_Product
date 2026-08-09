"""What evidence may enter, and from where.

This is the second half of the concession-ladder guarantee, and it is the more
important half.

Phase 1 made it impossible to argue the *policy engine* out of its envelope: no
amount of pressure moves a rung without a new evidence event. But that guarantee
is only worth as much as the thing deciding what counts as an evidence event.
If a persuasive sentence could mint ``severe_hardship_documented``, the hole the
policy engine closes simply reopens one layer up, and the attack becomes "say
the magic words" instead of "argue harder".

So evidence is split by provenance:

**Soft evidence** may be inferred from chat. It is behavioural and, notably,
buys nothing on the discount axis — a debtor *saying* they are struggling has
always been worth zero (:mod:`policy.hardship`).

**Verified evidence** may never come from chat, at any confidence, from any
model. It requires an out-of-band verification event carrying a verifier
identity. An LLM reading "I lost my job, I swear" has not seen a P45, and no
amount of conviction in the sentence changes that.

Pure: no I/O, no clock, no LLM (CLAUDE.md §12).
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from domain.evidence import EvidenceEvent, EvidenceKind


class EvidenceSource(StrEnum):
    CHAT_EXTRACTION = "chat_extraction"
    """Inferred by the extractor from what the debtor said."""

    VERIFIED_UPLOAD = "verified_upload"
    """Confirmed out of band by a person or system that saw the artefact."""


SOFT_EVIDENCE: frozenset[EvidenceKind] = frozenset(
    {
        EvidenceKind.HARDSHIP_CLAIMED,
        EvidenceKind.LIQUIDITY_CONSTRAINED,
        EvidenceKind.ASSETS_DISCLOSED,
    }
)
"""Assertible from conversation alone."""

VERIFIED_ONLY_EVIDENCE: frozenset[EvidenceKind] = (
    frozenset(EvidenceKind) - SOFT_EVIDENCE
)
"""Requires an artefact somebody actually checked.

Derived by subtraction rather than listed, so a new ``EvidenceKind`` added later
defaults to *verified-only*. Failing closed on the security-relevant axis means
the mistake of forgetting to classify something is a rejected disclosure, not a
free discount.
"""


class EvidenceIntakeError(ValueError):
    """An evidence event was offered from a source not entitled to assert it."""


class EvidenceSubmission(BaseModel):
    """An evidence event plus where it came from."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    kind: EvidenceKind
    source: EvidenceSource
    turn_index: int = Field(ge=0)
    verified_by: str | None = None
    note: str = ""


def accept(submission: EvidenceSubmission) -> EvidenceEvent:
    """Admit a submission, or refuse it.

    Refuses when:

    - chat asserts a verified-only kind — the core barrier;
    - a verified upload arrives without a verifier identity, since unattributed
      verification is indistinguishable from an assertion, and §7 requires the
      audit record to answer who stood behind it.
    """
    if (
        submission.source is EvidenceSource.CHAT_EXTRACTION
        and submission.kind in VERIFIED_ONLY_EVIDENCE
    ):
        raise EvidenceIntakeError(
            f"'{submission.kind.value}' cannot be established from conversation; "
            "it requires out-of-band verification. Refused."
        )

    if (
        submission.source is EvidenceSource.VERIFIED_UPLOAD
        and not (submission.verified_by or "").strip()
    ):
        raise EvidenceIntakeError(
            "verified evidence must carry a verifier identity (§7 audit)"
        )

    return EvidenceEvent(
        kind=submission.kind,
        turn_index=submission.turn_index,
        note=submission.note,
    )


def filter_chat_claims(
    kinds: list[str] | tuple[str, ...], *, turn_index: int
) -> tuple[EvidenceEvent, ...]:
    """Admit only the soft evidence from an extractor's output.

    Silently drops anything it is not entitled to assert — including strings
    that are not evidence kinds at all — rather than raising. A model naming a
    verified tier is an expected event, not an exceptional one, and it must not
    be able to abort a live negotiation turn by doing so.
    """
    admitted: list[EvidenceEvent] = []
    for raw in kinds:
        try:
            kind = EvidenceKind(raw)
        except ValueError:
            continue
        if kind not in SOFT_EVIDENCE:
            continue
        admitted.append(EvidenceEvent(kind=kind, turn_index=turn_index))
    return tuple(admitted)
