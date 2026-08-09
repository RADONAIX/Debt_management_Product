"""Recovery Workspace payloads — agencies, placements, recoveries, legal cases."""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field


class Camel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


# --- Agencies --------------------------------------------------------------
class AgencyRow(Camel):
    id: str
    name: str
    type: str
    status: str
    commissionPct: float
    recallDays: int
    capacity: int
    minPlacement: float
    maxPlacement: float | None = None
    contactName: str | None = None
    contactEmail: str | None = None
    contactPhone: str | None = None
    city: str | None = None
    country: str | None = None
    coversRisk: list[str] = []
    coversBucket: list[str] = []
    onboardedOn: dt.date | None = None
    contractEnd: dt.date | None = None
    notes: str | None = None
    # Derived from the placement book
    activePlacements: int = 0
    totalPlaced: float = 0
    totalRecovered: float = 0
    recoveryRate: float = 0
    commissionEarned: float = 0
    avgDaysToRecover: float | None = None
    performanceScore: int = 0
    utilisationPct: float = 0


class AgencyWrite(Camel):
    name: str
    type: str = "Consumer Debt"
    status: str = "ACTIVE"
    commissionPct: float = 15
    recallDays: int = 90
    capacity: int = 250
    minPlacement: float = 0
    maxPlacement: float | None = None
    contactName: str | None = None
    contactEmail: str | None = None
    contactPhone: str | None = None
    city: str | None = None
    country: str | None = None
    coversRisk: list[str] = []
    coversBucket: list[str] = []
    contractEnd: dt.date | None = None
    notes: str | None = None


# --- Placements ------------------------------------------------------------
class PlacementRow(Camel):
    id: int
    code: str
    agencyId: str
    agencyName: str
    customerId: str
    customerName: str
    customerType: str
    accountCode: str | None = None
    companyName: str | None = None
    companyId: str | None = None
    placedAmount: float
    recoveredAmount: float
    openAmount: float
    recoveryPct: float
    commissionPct: float
    commissionAccrued: float
    status: str
    priority: str
    # Read live from the account / customer, never stored here.
    dpd: int
    riskLevel: str | None = None
    placedOn: dt.date
    recallDue: dt.date | None = None
    closedOn: dt.date | None = None
    lastActivity: dt.date | None = None
    closeReason: str | None = None
    notes: str | None = None
    daysWithAgency: int = 0
    # True when the recall window has passed with the balance still open.
    overdueRecall: bool = False


class RecoveryRow(Camel):
    id: int
    placementId: int
    placementCode: str | None = None
    agencyName: str | None = None
    customerName: str | None = None
    recoveredOn: dt.date
    amount: float
    commission: float
    method: str
    reference: str | None = None
    remitted: bool
    note: str | None = None
    # True when this recovery posted a payment against the customer's account.
    appliedToAccount: bool = False
    customerId: str | None = None


class EventRow(Camel):
    id: int
    type: str
    detail: str | None = None
    actor: str | None = None
    occurredAt: dt.datetime
    fromAgency: str | None = None
    toAgency: str | None = None


class PlacementDetail(Camel):
    placement: PlacementRow
    recoveries: list[RecoveryRow]
    events: list[EventRow]


class PlacementCreate(Camel):
    agencyId: str
    customerId: str
    accountId: int | None = None
    placedAmount: float = Field(gt=0)
    priority: str = "Medium"
    notes: str | None = None


class PlacementPatch(Camel):
    priority: str | None = None
    notes: str | None = None
    status: str | None = None
    closeReason: str | None = None


class ReassignRequest(Camel):
    agencyId: str
    reason: str | None = None


class RecoveryCreate(Camel):
    amount: float = Field(gt=0)
    recoveredOn: dt.date | None = None
    method: str = "Bank Transfer"
    reference: str | None = None
    note: str | None = None


# --- Legal -----------------------------------------------------------------
class LegalRow(Camel):
    id: int
    code: str
    customerId: str
    customerName: str
    customerType: str | None = None
    riskLevel: str | None = None
    dpd: int = 0
    placementCode: str | None = None
    claimAmount: float
    legalCost: float
    recoveredAmount: float
    stage: str
    status: str
    lawFirm: str | None = None
    attorney: str | None = None
    court: str | None = None
    filedOn: dt.date | None = None
    nextHearing: dt.date | None = None
    successProbability: float | None = None
    outcome: str | None = None
    notes: str | None = None
    events: list[EventRow] = []


class LegalCreate(Camel):
    customerId: str
    placementId: int | None = None
    claimAmount: float = Field(gt=0)
    stage: str = "Pre-Legal"
    lawFirm: str | None = None
    attorney: str | None = None
    court: str | None = None
    filedOn: dt.date | None = None
    nextHearing: dt.date | None = None
    successProbability: float | None = None
    notes: str | None = None


class LegalPatch(Camel):
    stage: str | None = None
    status: str | None = None
    lawFirm: str | None = None
    attorney: str | None = None
    court: str | None = None
    nextHearing: dt.date | None = None
    legalCost: float | None = None
    recoveredAmount: float | None = None
    successProbability: float | None = None
    outcome: str | None = None
    notes: str | None = None


# --- Overview --------------------------------------------------------------
class TrendPoint(Camel):
    month: str
    placed: float
    recovered: float
    commission: float


class Summary(Camel):
    activePlacements: int
    placedValue: float
    recoveredValue: float
    openValue: float
    recoveryRate: float
    commissionAccrued: float
    overdueRecalls: int
    legalOpen: int
    legalClaimValue: float
    agencies: int
    recoveredThisMonth: float
    avgDaysToRecover: float | None = None
    trend: list[TrendPoint] = []


class ConfigRow(Camel):
    key: str
    value: str
    label: str
    description: str | None = None
    valueType: str


class EligibleAccount(Camel):
    accountId: int
    accountCode: str
    customerId: str
    customerName: str
    customerType: str
    outstanding: float
    dpd: int
    agingBucket: str
    riskLevel: str
