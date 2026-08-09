"""Shared hypothesis strategies."""

from __future__ import annotations

from decimal import Decimal

from hypothesis import strategies as st

from domain.account import Account
from domain.enums import DiscRatio, InstPrds, PmtDays, PmtRatio
from domain.evidence import EvidenceEvent, EvidenceKind
from policy.envelope import (
    INSTALLMENT_STEPS,
    PAY_WINDOW_STEPS,
    UPFRONT_STEPS,
    Envelope,
)
from policy.hardship import tier_from_evidence
from policy.ladder import ConcessionLedger, apply_all

ACCOUNT = Account(
    account_id="acct-1",
    tenant_id="tenant-1",
    jurisdiction="uk",
    product="unsecured_personal_loan",
    principal=Decimal("4200.00"),
    days_overdue=95,
)

agreements = st.builds(
    lambda d, p, days, i: {
        "disc_ratio": d,
        "pmt_ratio": p,
        "pmt_days": days,
        "inst_prds": i,
    },
    st.sampled_from(list(DiscRatio)),
    st.sampled_from(list(PmtRatio)),
    st.sampled_from(list(PmtDays)),
    st.sampled_from(list(InstPrds)),
)

evidence_events = st.builds(
    EvidenceEvent,
    kind=st.sampled_from(list(EvidenceKind)),
    turn_index=st.integers(min_value=0, max_value=40),
)

ledgers = st.builds(apply_all, st.lists(evidence_events, max_size=12))


@st.composite
def envelopes(draw: st.DrawFn) -> Envelope:
    """Any envelope reachable by construction, plus arbitrary rung combinations.

    Drawn from the step tables rather than from a ledger so the validation
    property is tested against envelopes the ladder cannot currently produce
    too — the guarantee should not depend on the ladder being correct.
    """
    evidence = draw(st.frozensets(st.sampled_from(list(EvidenceKind))))
    return Envelope(
        max_disc_ratio=draw(st.sampled_from(list(DiscRatio))),
        min_pmt_ratio=draw(st.sampled_from(UPFRONT_STEPS)),
        max_pmt_days=draw(st.sampled_from(PAY_WINDOW_STEPS)),
        allowed_inst_prds=draw(st.sampled_from(INSTALLMENT_STEPS)),
        hardship_tier=tier_from_evidence(evidence),
    )


__all__ = [
    "ACCOUNT",
    "ConcessionLedger",
    "agreements",
    "envelopes",
    "evidence_events",
    "ledgers",
]
