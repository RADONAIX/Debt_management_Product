"""Post-generation compliance checks on the collector's own utterance (§6).

    "No threats of legal action the institution cannot or will not take. No
     contact-time or contact-frequency violations. No third-party disclosure of
     the debt. No misrepresentation of consequences. Identity and purpose
     disclosed on turn one."

§7 splits this deliberately: rule *content* is retrieved, rule *evaluation* is
code. A pack can say what the rule is; whether a given sentence broke it is
decided here, where it cannot be argued with.

A breach does not get softened or rewritten — the turn is rejected and
regenerated with the finding fed back, and after retry exhaustion the session
escalates rather than emitting anything questionable. §5.6.
"""

from __future__ import annotations

import re
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class ComplianceCode(StrEnum):
    UNLAWFUL_THREAT = "unlawful_threat"
    MISREPRESENTED_CONSEQUENCE = "misrepresented_consequence"
    THIRD_PARTY_DISCLOSURE = "third_party_disclosure"
    IDENTITY_NOT_DISCLOSED = "identity_not_disclosed"
    ABUSIVE_LANGUAGE = "abusive_language"
    PRESSURE_TO_BORROW = "pressure_to_borrow"


class Finding(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    code: ComplianceCode
    detail: str

    def as_feedback(self) -> str:
        return f"{self.code.value}: {self.detail}"


class ComplianceResult(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    passed: bool
    findings: tuple[Finding, ...] = ()

    def feedback(self) -> str:
        return "\n".join(f.as_feedback() for f in self.findings)


def _any(*patterns: str) -> re.Pattern[str]:
    return re.compile("|".join(patterns), re.I)


# Stating a consequence as imminent or certain, rather than describing it
# accurately as possible. This is the distinction §6 draws.
_THREATS = _any(
    r"\bwe will (?:take|be taking) you to court\b",
    r"\bcourt (?:action )?(?:will|is going to) (?:be|happen|follow)\b",
    r"\bbailiffs? (?:will|are going to|are being)\b",
    r"\benforcement agents? (?:will|are going to)\b",
    r"\bwe will (?:seize|take|repossess)\b",
    r"\byou will (?:be arrested|go to (?:court|prison|jail))\b",
    r"\bcriminal (?:record|charges?|offence)\b",
    r"\bwe'?ll send (?:someone|a (?:agent|officer|bailiff))\b",
    r"\bvisit you at (?:home|work)\b",
    r"\bcontact your employer\b",
    r"\bgarnish(?:ee|ing)? your (?:wages|salary)\b",
)

_MISREPRESENTATION = _any(
    r"\b(?:this is|it'?s) your (?:last|final) (?:chance|opportunity|warning)\b",
    r"\bthis offer expires (?:today|now|in the next)\b",
    r"\byou have no (?:other )?(?:choice|option)\b",
    r"\bmust pay (?:today|now|immediately) or\b",
    r"\bwill (?:permanently )?(?:destroy|ruin) your credit\b",
    r"\bnever (?:get|be able to get) credit again\b",
    r"\bthere'?s nothing (?:else|more) (?:you|we) can do\b",
)

_THIRD_PARTY = _any(
    r"\btell your (?:family|wife|husband|partner|parents|employer|boss)\b",
    r"\bwe'?ll (?:speak|talk) to your (?:family|employer|partner|boss)\b",
    r"\blet your (?:family|employer|partner) know\b",
    r"\binform your (?:employer|family|next of kin)\b",
)

_ABUSIVE = _any(
    r"\byou'?re (?:being )?(?:pathetic|stupid|useless|a liar|lying)\b",
    r"\bstop (?:whining|whinging|making excuses)\b",
    r"\bgrow up\b",
    r"\byou people\b",
    r"\birresponsible\b",
)

_BORROW = _any(
    r"\bborrow (?:from|off) (?:a |your )?(?:friend|family|relative|someone)\b",
    r"\btake out (?:a|another) loan\b",
    r"\buse (?:a |your )?credit card to (?:pay|clear|settle)\b",
    r"\bpayday loan\b",
)

_IDENTITY = _any(
    r"\bcalling (?:from|on behalf of)\b",
    r"\bi'?m (?:calling|contacting) (?:you )?(?:from|about|regarding)\b",
    r"\bthis is .{0,40}\b(?:from|at|with)\b",
    r"\bcollections? (?:team|department)\b",
    r"\bregarding your\b.{0,40}\b(?:account|loan|balance)\b",
)


def check(utterance: str, *, turn_index: int) -> ComplianceResult:
    """Check one collector utterance.

    ``turn_index`` is needed only for the turn-one identity rule; nothing else
    here depends on position.
    """
    findings: list[Finding] = []

    for pattern, code, detail in (
        (_THREATS, ComplianceCode.UNLAWFUL_THREAT, "states enforcement as certain"),
        (
            _MISREPRESENTATION,
            ComplianceCode.MISREPRESENTED_CONSEQUENCE,
            "overstates consequences or manufactures urgency",
        ),
        (
            _THIRD_PARTY,
            ComplianceCode.THIRD_PARTY_DISCLOSURE,
            "implies disclosing the debt to a third party",
        ),
        (_ABUSIVE, ComplianceCode.ABUSIVE_LANGUAGE, "demeaning language"),
        (
            _BORROW,
            ComplianceCode.PRESSURE_TO_BORROW,
            "pushes the debtor toward further borrowing",
        ),
    ):
        match = pattern.search(utterance)
        if match:
            findings.append(Finding(code=code, detail=f"{detail} ({match.group(0)!r})"))

    # §6: identity and purpose disclosed on turn one. Checked only on the
    # opening turn -- demanding it on every turn would be its own annoyance.
    if turn_index == 0 and not _IDENTITY.search(utterance):
        findings.append(
            Finding(
                code=ComplianceCode.IDENTITY_NOT_DISCLOSED,
                detail="opening turn does not identify the caller or the purpose",
            )
        )

    return ComplianceResult(passed=not findings, findings=tuple(findings))
