"""Deterministic validation of a proposed agreement against the envelope.

CLAUDE.md §5.4 and law 3: a proposal that fails here is rejected and regenerated.
It never reaches the API response. Violations are structured rather than prose
because §5.6 feeds them back into regeneration and §7 requires them in the audit
record — a string is neither reliably parseable nor reliably queryable.

Pure: no I/O, no clock, no LLM (CLAUDE.md §12).
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from domain.agreement import Agreement, AgreementDelta
from policy.envelope import Envelope

_FIELDS = ("disc_ratio", "pmt_ratio", "pmt_days", "inst_prds")


class ViolationCode(StrEnum):
    DISCOUNT_ABOVE_CEILING = "discount_above_ceiling"
    UPFRONT_BELOW_FLOOR = "upfront_below_floor"
    PAY_WINDOW_TOO_LONG = "pay_window_too_long"
    INSTALLMENT_TERM_NOT_ALLOWED = "installment_term_not_allowed"
    INCOMPLETE_AGREEMENT = "incomplete_agreement"


_CODE_BY_FIELD: dict[str, ViolationCode] = {
    "disc_ratio": ViolationCode.DISCOUNT_ABOVE_CEILING,
    "pmt_ratio": ViolationCode.UPFRONT_BELOW_FLOOR,
    "pmt_days": ViolationCode.PAY_WINDOW_TOO_LONG,
    "inst_prds": ViolationCode.INSTALLMENT_TERM_NOT_ALLOWED,
}


class Violation(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    field: str
    code: ViolationCode
    proposed: int | None
    limit: str

    def as_feedback(self) -> str:
        """One line the collector prompt can be regenerated against."""
        return (
            f"{self.field}={self.proposed} is outside policy; {self.limit}. "
            f"Revise the offer to comply."
        )


class ValidationResult(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    approved: bool
    violations: tuple[Violation, ...] = ()

    def feedback(self) -> str:
        return "\n".join(v.as_feedback() for v in self.violations)


def _limit_text(field: str, envelope: Envelope) -> str:
    match field:
        case "disc_ratio":
            return (
                f"the maximum discount is {int(envelope.max_disc_ratio)}% "
                f"at hardship tier '{envelope.hardship_tier.value}'"
            )
        case "pmt_ratio":
            return f"the minimum upfront share is {int(envelope.min_pmt_ratio)}%"
        case "pmt_days":
            return f"payment is due within {int(envelope.max_pmt_days)} days"
        case _:
            allowed = sorted(int(p) for p in envelope.allowed_inst_prds)
            return f"permitted installment terms are {allowed} months"


def validate_delta(delta: AgreementDelta, envelope: Envelope) -> ValidationResult:
    """Check every field the delta actually sets. Unset fields are unagreed,
    not defaulted — an omission is never treated as a concession."""
    violations = []
    for field in _FIELDS:
        value = getattr(delta, field)
        if value is None:
            continue
        if not envelope.permits(field=field, value=int(value)):
            violations.append(
                Violation(
                    field=field,
                    code=_CODE_BY_FIELD[field],
                    proposed=int(value),
                    limit=_limit_text(field, envelope),
                )
            )
    return ValidationResult(approved=not violations, violations=tuple(violations))


def validate_agreement(agreement: Agreement, envelope: Envelope) -> ValidationResult:
    """Check a complete agreement. Completeness is guaranteed by the type."""
    return validate_delta(AgreementDelta.from_agreement(agreement), envelope)


def validate_terminal(delta: AgreementDelta, envelope: Envelope) -> ValidationResult:
    """Check a proposal that is meant to *close* the negotiation.

    Stricter than :func:`validate_delta` by exactly one rule: success requires
    all four fields specified (CLAUDE.md §3.1). A settlement with an unstated
    installment term is not a settlement.
    """
    result = validate_delta(delta, envelope)
    if delta.to_agreement() is not None:
        return result
    missing = [f for f in _FIELDS if getattr(delta, f) is None]
    incomplete = Violation(
        field=",".join(missing),
        code=ViolationCode.INCOMPLETE_AGREEMENT,
        proposed=None,
        limit=(
            "a binding agreement must specify disc_ratio, pmt_ratio, pmt_days "
            "and inst_prds"
        ),
    )
    return ValidationResult(approved=False, violations=(*result.violations, incomplete))
