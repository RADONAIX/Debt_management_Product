"""Closed vocabularies for the negotiation domain.

The four agreement grids (CLAUDE.md §3.1) are ``IntEnum`` so that an off-grid
value raises at construction. No rounding, no coercion.
"""

from __future__ import annotations

from enum import IntEnum, StrEnum


class DiscRatio(IntEnum):
    """Discount on principal, percent. Policy default 0."""

    ZERO = 0
    FIVE = 5
    TEN = 10
    FIFTEEN = 15
    TWENTY = 20
    TWENTY_FIVE = 25
    THIRTY = 30


class PmtRatio(IntEnum):
    """Upfront share of the settled amount, percent. 5-50 in steps of 5."""

    FIVE = 5
    TEN = 10
    FIFTEEN = 15
    TWENTY = 20
    TWENTY_FIVE = 25
    THIRTY = 30
    THIRTY_FIVE = 35
    FORTY = 40
    FORTY_FIVE = 45
    FIFTY = 50


class PmtDays(IntEnum):
    """Days allowed to pay the upfront portion. 1-14."""

    D1 = 1
    D2 = 2
    D3 = 3
    D4 = 4
    D5 = 5
    D6 = 6
    D7 = 7
    D8 = 8
    D9 = 9
    D10 = 10
    D11 = 11
    D12 = 12
    D13 = 13
    D14 = 14


class InstPrds(IntEnum):
    """Months of installments for the remainder."""

    M3 = 3
    M6 = 6
    M9 = 9
    M12 = 12
    M18 = 18
    M24 = 24


class Action(StrEnum):
    """What a turn does with the agreement (CLAUDE.md §3.4)."""

    ASK = "ask"
    ACCEPT = "accept"
    NON = "non"


class Speaker(StrEnum):
    COLLECTOR = "collector"
    DEBTOR = "debtor"


class CollectorStrategy(StrEnum):
    """The nine collector strategies (CLAUDE.md §3.3, paper Table 7)."""

    IDENTITY_VERIFICATION = "identity_verification"
    ESTABLISH_TRUST = "establish_trust"
    FINANCIAL_ASSESSMENT = "financial_assessment"
    EMOTIONAL_APPEASEMENT = "emotional_appeasement"
    STATEMENT_OF_FACTS = "statement_of_facts"
    CONSTRUCTIVE_CHALLENGE = "constructive_challenge"
    ETHICAL_APPEAL = "ethical_appeal"
    LEGAL_DETERRENT = "legal_deterrent"
    REPAYMENT_NEGOTIATION = "repayment_negotiation"


class DebtorStrategy(StrEnum):
    """The eight debtor strategies. Simulator only, never a production path."""

    HONEST_DISCLOSURE = "honest_disclosure"
    VAGUE_RESPONSE = "vague_response"
    FALSE_COMPLIANCE = "false_compliance"
    SHIFT_RESPONSIBILITY = "shift_responsibility"
    DILEMMA_RENDERING = "dilemma_rendering"
    EMOTIONAL_CONFRONTATION = "emotional_confrontation"
    COMPLAINT = "complaint"
    REPAYMENT_NEGOTIATION = "repayment_negotiation"


class Archetype(StrEnum):
    """Behavioural archetypes with the paper's observed distribution (Table 3).

    Confrontational is the largest *and* hardest segment, so it is the primary
    optimisation target rather than an edge case.
    """

    CONFRONTATIONAL = "confrontational"
    AVOIDANT = "avoidant"
    HELPLESS = "helpless"
    COOPERATIVE = "cooperative"


ARCHETYPE_DISTRIBUTION: dict[Archetype, float] = {
    Archetype.CONFRONTATIONAL: 0.38,
    Archetype.AVOIDANT: 0.31,
    Archetype.HELPLESS: 0.25,
    Archetype.COOPERATIVE: 0.06,
}


class Outcome(StrEnum):
    """How a trajectory ended."""

    AGREEMENT = "agreement"
    NO_AGREEMENT = "no_agreement"
    ESCALATED = "escalated"
    TURN_LIMIT = "turn_limit"
