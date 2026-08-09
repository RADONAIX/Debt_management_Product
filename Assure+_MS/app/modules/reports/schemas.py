"""Performance Reports response shapes.

Four registers of work — promises, disputes, legal escalations and agency
escalations — each returned as a page of rows. Every list carries the same
envelope so the UI renders them through one table component.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class Filters(BaseModel):
    """The filter bar. Not every field applies to every register.

    ``dateFrom`` / ``dateTo`` always bound the register's own primary date:
    promised date for PTPs, filed date for disputes and legal cases, placed
    date for agency placements.
    """

    search: str | None = None
    status: str | None = None
    # What created the row — see the derivation in service.py.
    source: str | None = None
    # The header's Customer Scope: all | consumer | enterprise. "Enterprise" is
    # everything that is not a consumer, matching the split used elsewhere.
    customerScope: str | None = None
    customerType: str | None = None
    region: str | None = None
    dateFrom: date | None = None
    dateTo: date | None = None
    # Register-specific
    channel: str | None = None      # PTPs
    priority: str | None = None     # disputes, placements
    reason: str | None = None       # disputes
    stage: str | None = None        # legal cases
    agency: str | None = None       # placements


class PtpRow(BaseModel):
    id: int
    code: str
    customerId: str
    customerName: str
    customerType: str
    accountCode: str | None = None
    promisedAmount: float
    keptAmount: float
    promisedDate: date
    status: str
    channel: str | None = None
    agentName: str | None = None
    # Days past the promised date for a promise still unpaid; 0 otherwise.
    daysOverdue: int
    aiProbability: float | None = None
    source: str
    sourceDetail: str | None = None


class DisputeRow(BaseModel):
    id: int
    code: str
    customerId: str
    customerName: str
    customerType: str
    accountCode: str | None = None
    reason: str
    amount: float
    status: str
    priority: str
    filedAt: datetime
    slaDeadline: datetime | None = None
    resolvedAt: datetime | None = None
    agentName: str | None = None
    ageDays: int
    slaBreached: bool
    source: str
    sourceDetail: str | None = None


class LegalRow(BaseModel):
    id: int
    code: str
    customerId: str
    customerName: str
    customerType: str
    claimAmount: float
    legalCost: float
    recoveredAmount: float
    stage: str
    status: str
    lawFirm: str | None = None
    court: str | None = None
    filedOn: date | None = None
    nextHearing: date | None = None
    successProbability: float | None = None
    ageDays: int
    source: str
    sourceDetail: str | None = None


class AgencyRow(BaseModel):
    id: int
    code: str
    agencyName: str
    customerId: str
    customerName: str
    customerType: str
    accountCode: str | None = None
    placedAmount: float
    recoveredAmount: float
    openAmount: float
    recoveryPct: float
    status: str
    priority: str
    # Read live off the account, so the board never shows a stale delinquency.
    dpd: int
    placedOn: date
    recallDue: date | None = None
    daysWithAgency: int
    # Still open past its recall date — the row a supervisor needs to see.
    overdueRecall: bool
    source: str
    sourceDetail: str | None = None


class Page(BaseModel):
    """One page of a register, plus the totals for the whole filtered set."""

    rows: list
    total: int
    totalAmount: float


class PtpPage(Page):
    rows: list[PtpRow]


class DisputePage(Page):
    rows: list[DisputeRow]


class LegalPage(Page):
    rows: list[LegalRow]


class AgencyPage(Page):
    rows: list[AgencyRow]


class FilterOptions(BaseModel):
    """Dropdown values, read from the data so a filter can never be empty."""

    customerTypes: list[str]
    regions: list[str]
    ptpStatuses: list[str]
    ptpChannels: list[str]
    disputeStatuses: list[str]
    disputeReasons: list[str]
    disputePriorities: list[str]
    legalStatuses: list[str]
    legalStages: list[str]
    agencyStatuses: list[str]
    agencyPriorities: list[str]
    agencies: list[str]
    # Derived creation sources actually present in each register.
    ptpSources: list[str]
    disputeSources: list[str]
    legalSources: list[str]
    agencySources: list[str]
