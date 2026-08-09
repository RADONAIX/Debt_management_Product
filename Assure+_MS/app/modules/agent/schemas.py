"""Agent Workspace payloads.

Everything here maps onto tables that already exist — debt_case, ptp,
case_activity, dispute, payment, customer, account. No storage of its own.
"""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field


class Camel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


# --- Desk ------------------------------------------------------------------
class AgentRow(Camel):
    id: int
    name: str
    email: str
    role: str | None = None
    openCases: int = 0
    customers: int = 0
    pendingPtps: int = 0
    openDisputes: int = 0
    availability: str | None = None
    maxCaseload: int | None = None


class DeskSummary(Camel):
    agentId: int
    agentName: str
    # From public.agent_profile — the desk's own establishment record.
    employeeCode: str | None = None
    skillGroup: str | None = None
    expertise: str | None = None
    languages: list[str] = []
    specializations: list[str] = []
    availability: str | None = None
    maxCaseload: int | None = None
    monthlyTarget: float | None = None
    performanceRating: float | None = None
    targetProgress: float | None = None
    caseloadPct: float | None = None
    #: Every customer the desk owns, and everything they owe — the whole
    #: assigned portfolio, whether or not it is under collection.
    customers: int
    portfolioValue: float
    #: The subset actually under collection: customers and balance on accounts
    #: with a live case. This is what the Collections Dashboard reports.
    bookCustomers: int = 0
    bookExposure: float = 0.0
    openCases: int
    slaBreached: int
    dueToday: int
    pendingPtps: int
    ptpValue: float
    ptpsDueToday: int
    keptRate: float
    openDisputes: int
    contactsToday: int
    collectedMtd: float
    promisedMtd: float


# --- Worklist / customers --------------------------------------------------
class WorkItem(Camel):
    customerId: str
    customerName: str
    customerType: str
    accountId: int | None = None
    accountCode: str | None = None
    outstanding: float
    dpd: int
    agingBucket: str | None = None
    riskLevel: str
    riskScore: float
    contactability: float
    bestChannel: str | None = None
    bestContactTime: str | None = None
    phone: str | None = None
    email: str | None = None
    strategy: str | None = None
    openCases: int = 0
    openCaseCode: str | None = None
    openCaseId: int | None = None
    pendingPtp: bool = False
    ptpDueOn: dt.date | None = None
    lastContact: dt.datetime | None = None
    lastPayment: dt.date | None = None
    # What the workspace thinks should happen next, and why it is ranked here.
    nextAction: str
    priority: str
    priorityScore: int
    # Who owns this customer — shown when looking across every desk.
    agentName: str | None = None


# --- Cases -----------------------------------------------------------------
class CaseRow(Camel):
    id: int
    code: str
    customerId: str
    customerName: str
    accountCode: str | None = None
    type: str
    summary: str | None = None
    status: str
    priority: str
    riskLevel: str
    amount: float
    dpd: int
    strategy: str | None = None
    dunningStage: int = 0
    agentId: int | None = None
    agentName: str | None = None
    openedAt: dt.datetime
    slaDeadline: dt.datetime | None = None
    slaBreached: bool = False
    firstResponseAt: dt.datetime | None = None
    lastActivityAt: dt.datetime | None = None
    closedAt: dt.datetime | None = None
    resolution: str | None = None
    activityCount: int = 0
    hoursToSla: float | None = None


class ActivityRow(Camel):
    id: int
    type: str
    channel: str | None = None
    direction: str
    subject: str
    body: str | None = None
    outcome: str | None = None
    visibility: str
    isAutomated: bool
    agent: str | None = None
    occurredAt: dt.datetime


class PtpRow(Camel):
    id: int
    code: str
    customerId: str
    customerName: str
    accountCode: str | None = None
    caseCode: str | None = None
    promisedAmount: float
    promisedDate: dt.date
    instalments: int
    keptAmount: float
    outstandingOnPromise: float
    status: str
    channel: str | None = None
    aiProbability: float | None = None
    fulfilledAt: dt.datetime | None = None
    notes: str | None = None
    agentName: str | None = None
    createdAt: dt.datetime
    daysToDue: int | None = None
    overdue: bool = False


class DisputeRow(Camel):
    id: int
    code: str
    customerId: str
    customerName: str
    reason: str
    description: str | None = None
    amount: float
    status: str
    priority: str
    filedAt: dt.datetime
    slaDeadline: dt.datetime | None = None
    resolvedAt: dt.datetime | None = None
    resolutionNote: str | None = None
    caseCode: str | None = None
    agentName: str | None = None


class PaymentRow(Camel):
    reference: str
    date: dt.date
    amount: float
    method: str
    status: str
    invoiceNo: str | None = None
    notes: str | None = None


class CaseDetail(Camel):
    case: CaseRow
    customer: WorkItem
    activities: list[ActivityRow]
    ptps: list[PtpRow]
    disputes: list[DisputeRow]
    payments: list[PaymentRow]


# --- Writes ----------------------------------------------------------------
class CaseCreate(Camel):
    customerId: str
    accountId: int | None = None
    type: str = "Collection"
    summary: str | None = None
    priority: str = "Medium"
    amount: float | None = None


class CasePatch(Camel):
    status: str | None = None
    priority: str | None = None
    summary: str | None = None
    resolution: str | None = None
    agentId: int | None = None


class ActivityCreate(Camel):
    type: str = "CALL"
    channel: str | None = None
    direction: str = "OUTBOUND"
    subject: str
    body: str | None = None
    outcome: str | None = None
    visibility: str = "INTERNAL"


class PtpCreate(Camel):
    customerId: str
    accountId: int | None = None
    caseId: int | None = None
    promisedAmount: float = Field(gt=0)
    promisedDate: dt.date
    instalments: int = 1
    channel: str | None = "Dialer"
    notes: str | None = None


class PtpPatch(Camel):
    status: str | None = None
    keptAmount: float | None = None
    promisedDate: dt.date | None = None
    promisedAmount: float | None = None
    notes: str | None = None


class ReminderRequest(Camel):
    customerId: str
    accountId: int | None = None
    caseId: int | None = None
    channel: str = "SMS"
    template: str = "Payment due"
    message: str | None = None


class DisputeCreate(Camel):
    customerId: str
    accountId: int | None = None
    caseId: int | None = None
    reason: str
    description: str | None = None
    amount: float = 0
    priority: str = "Medium"


class DisputePatch(Camel):
    status: str | None = None
    priority: str | None = None
    resolutionNote: str | None = None


class LogPaymentRequest(Camel):
    customerId: str
    accountId: int
    amount: float = Field(gt=0)
    method: str = "Payment Link"
    reference: str | None = None
    paidOn: dt.date | None = None
    ptpId: int | None = None
    note: str | None = None


class ReminderTemplate(Camel):
    key: str
    label: str
    channel: str
    subject: str
    body: str
