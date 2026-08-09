"""Collection Workspace & Case Management payloads.

Case identity lives in customer_schema.debt_case; the collection schema adds
provenance, routing, workflow, notes, attachments and audit. Everything about
the customer, account, invoice, payment, promise, dispute, placement and legal
matter is joined at read time — none of it is stored twice.
"""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field


class Camel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


# ==========================================================================
# Configuration
# ==========================================================================
class CaseTypeRow(Camel):
    code: str
    name: str
    description: str | None = None
    defaultPriority: str
    defaultQueue: str | None = None
    slaHours: int
    duplicatePolicy: str
    requiresApproval: bool
    autoCloseOnPay: bool
    isActive: bool


class CaseSourceRow(Camel):
    code: str
    name: str
    description: str | None = None
    isAutomated: bool
    isActive: bool


class QueueRow(Camel):
    code: str
    name: str
    description: str | None = None
    dpdMin: int | None = None
    dpdMax: int | None = None
    amountMin: float | None = None
    amountMax: float | None = None
    riskLevels: list[str] = []
    customerTypes: list[str] = []
    assignmentMode: str
    maxPerAgent: int
    isActive: bool
    # Live load
    openCases: int = 0
    slaBreached: int = 0
    totalValue: float = 0
    agents: int = 0


class WorkflowStateRow(Camel):
    code: str
    name: str
    category: str
    isInitial: bool
    isTerminal: bool
    pausesSla: bool
    colour: str | None = None
    caseCount: int = 0


class TransitionRow(Camel):
    fromState: str
    toState: str
    label: str
    requiredPermission: str | None = None
    requiresNote: bool
    requiresApproval: bool
    allowed: bool = True


class AssignmentRuleRow(Camel):
    id: int
    name: str
    description: str | None = None
    priority: int
    isActive: bool
    caseTypeCode: str | None = None
    sourceCode: str | None = None
    dpdMin: int | None = None
    dpdMax: int | None = None
    amountMin: float | None = None
    amountMax: float | None = None
    riskLevels: list[str] = []
    customerTypes: list[str] = []
    targetQueue: str | None = None
    targetAgentId: int | None = None
    setPriority: str | None = None


class Config(Camel):
    types: list[CaseTypeRow]
    sources: list[CaseSourceRow]
    queues: list[QueueRow]
    priorities: list[dict]
    states: list[WorkflowStateRow]
    transitions: list[TransitionRow]
    rules: list[AssignmentRuleRow]
    agents: list[dict]


# ==========================================================================
# Collection Workspace
# ==========================================================================
class WorkspaceRow(Camel):
    """One line of the collection workspace — an account needing action."""

    customerId: str
    customerName: str
    customerType: str
    companyName: str | None = None
    phone: str | None = None
    email: str | None = None
    accountId: int | None = None
    accountCode: str | None = None
    ban: str | None = None
    servicePlan: str | None = None
    outstanding: float
    dpd: int
    agingBucket: str | None = None
    accountStatus: str | None = None
    riskScore: float
    riskLevel: str
    creditScore: int | None = None
    contactability: float
    # Operational state, each from the table that owns it
    agentId: int | None = None
    agentName: str | None = None
    collectionStatus: str
    openCases: int = 0
    openCaseCode: str | None = None
    openCaseId: int | None = None
    activePtp: bool = False
    ptpAmount: float | None = None
    ptpDueOn: dt.date | None = None
    activeDisputes: int = 0
    disputedAmount: float = 0
    legalStatus: str | None = None
    legalStage: str | None = None
    agencyStatus: str | None = None
    agencyName: str | None = None
    lastPaymentOn: dt.date | None = None
    lastPaymentAmount: float | None = None
    payments90d: int = 0
    collected90d: float = 0
    lastContactAt: dt.datetime | None = None
    contactAttempts: int = 0
    strategy: str | None = None
    queueCode: str | None = None
    nextAction: str
    priority: str
    priorityScore: int


class WorkspaceSummary(Camel):
    accounts: int
    customers: int
    totalOutstanding: float
    needingAction: int
    withActivePtp: int
    inDispute: int
    withAgency: int
    inLegal: int
    openCases: int
    slaBreached: int
    unassigned: int


class TimelineEntry(Camel):
    at: dt.datetime
    kind: str
    title: str
    detail: str | None = None
    actor: str | None = None
    amount: float | None = None


# ==========================================================================
# Cases
# ==========================================================================
class CaseRow(Camel):
    id: int
    caseNumber: str
    status: str
    workflowState: str
    stateCategory: str | None = None
    source: str
    sourceName: str | None = None
    type: str
    typeName: str | None = None
    priority: str
    queueCode: str | None = None
    queueName: str | None = None
    summary: str | None = None
    # Customer / account, joined live
    customerId: str
    customerName: str
    customerType: str
    accountCode: str | None = None
    outstanding: float
    dpd: int
    riskScore: float
    riskLevel: str
    amount: float
    # Ownership and SLA
    agentId: int | None = None
    agentName: str | None = None
    openedAt: dt.datetime
    dueDate: dt.date | None = None
    slaDeadline: dt.datetime | None = None
    slaBreached: bool = False
    hoursToSla: float | None = None
    slaPaused: bool = False
    firstResponseAt: dt.datetime | None = None
    lastActivityAt: dt.datetime | None = None
    closedAt: dt.datetime | None = None
    resolution: str | None = None
    # Relationships
    parentCaseId: int | None = None
    parentCaseNumber: str | None = None
    childCount: int = 0
    mergedIntoCaseId: int | None = None
    mergedIntoNumber: str | None = None
    reopenCount: int = 0
    strategy: str | None = None
    activityCount: int = 0
    noteCount: int = 0
    attachmentCount: int = 0
    createdByName: str | None = None
    triggerDetail: str | None = None


class NoteRow(Camel):
    id: int
    body: str
    noteType: str
    visibility: str
    isPinned: bool
    author: str | None = None
    createdAt: dt.datetime


class AttachmentRow(Camel):
    id: int
    fileName: str
    fileType: str | None = None
    fileSizeBytes: int | None = None
    storageUri: str
    documentType: str
    uploadedBy: str | None = None
    uploadedAt: dt.datetime


class AuditRow(Camel):
    id: int
    action: str
    fieldName: str | None = None
    oldValue: str | None = None
    newValue: str | None = None
    actor: str | None = None
    actorRole: str | None = None
    reason: str | None = None
    occurredAt: dt.datetime


class AssignmentRow(Camel):
    id: int
    agentName: str | None = None
    queueCode: str | None = None
    assignedByName: str | None = None
    assignmentType: str
    reason: str | None = None
    assignedAt: dt.datetime
    releasedAt: dt.datetime | None = None


class RelatedPtp(Camel):
    id: int
    code: str
    promisedAmount: float
    promisedDate: dt.date
    keptAmount: float
    status: str
    instalments: int


class RelatedDispute(Camel):
    id: int
    code: str
    reason: str
    amount: float
    status: str
    filedAt: dt.datetime


class RelatedPayment(Camel):
    reference: str
    date: dt.date
    amount: float
    method: str
    status: str


class RelatedLegal(Camel):
    id: int
    code: str
    stage: str
    status: str
    claimAmount: float
    nextHearing: dt.date | None = None


class RelatedPlacement(Camel):
    id: int
    code: str
    agencyName: str
    placedAmount: float
    recoveredAmount: float
    status: str


class RelatedCommunication(Camel):
    id: int
    type: str
    channel: str | None = None
    direction: str
    subject: str
    outcome: str | None = None
    agent: str | None = None
    occurredAt: dt.datetime


class CaseDetail(Camel):
    case: CaseRow
    customer: WorkspaceRow
    transitions: list[TransitionRow]
    # What happened on this case. Empty for a case nobody has worked.
    timeline: list[TimelineEntry]
    # The customer's wider history, which exists whether or not this case does.
    customerHistory: list[TimelineEntry] = []
    communications: list[RelatedCommunication]
    notes: list[NoteRow]
    attachments: list[AttachmentRow]
    audit: list[AuditRow]
    assignments: list[AssignmentRow]
    ptps: list[RelatedPtp]
    disputes: list[RelatedDispute]
    payments: list[RelatedPayment]
    legal: list[RelatedLegal]
    placements: list[RelatedPlacement]
    children: list[CaseRow]


class CaseDashboard(Camel):
    totalOpen: int
    unassigned: int
    slaBreached: int
    dueToday: int
    createdToday: int
    closedToday: int
    reopened: int
    totalValue: int | float
    avgResolutionHours: float | None = None
    byState: list[dict]
    byQueue: list[dict]
    bySource: list[dict]
    byPriority: list[dict]
    byType: list[dict]
    byAgent: list[dict]
    ageing: list[dict]


# --- Collections Dashboard -------------------------------------------------
class TrendPoint(Camel):
    weekStart: dt.date
    collected: float
    promised: float
    opened: int
    closed: int


class AgeingLine(Camel):
    bucket: str
    accounts: int
    exposure: float


class CollectorLine(Camel):
    agentId: int
    agentName: str
    openCases: int
    exposure: float
    breached: int
    collected30d: float
    keptRate: float | None = None


class ExposureLine(Camel):
    caseId: int
    caseNumber: str
    # How many live cases sit on this account; the id above is the most urgent.
    caseCount: int = 1
    customerId: str
    customerName: str
    companyName: str | None = None
    accountCode: str
    outstanding: float
    dpd: int
    riskLevel: str | None = None
    caseType: str | None = None
    agentName: str | None = None


class SlaLine(Camel):
    caseId: int
    caseNumber: str
    customerId: str
    customerName: str
    priority: str
    caseType: str | None = None
    outstanding: float
    hoursToSla: float
    agentName: str | None = None


class CollectionsOverview(Camel):
    """Six measures that each say something the others do not: what is owed,
    what came in, the share of it collected, whether promises hold, whether the
    work is on time, and how long a case takes to finish."""
    scope: str
    openExposure: float
    accounts: int
    customers: int
    # Of the exposure above, what is not past due yet.
    notYetDue: float = 0
    openCases: int
    untouched: int
    unassigned: int
    awaitingClose: int
    over90Exposure: float
    collected30d: float
    collectedToday: float
    collectedPayments: int
    collectedDeltaPct: float | None = None
    recoveryRatePct: float | None = None
    promiseKeptRatePct: float | None = None
    promisesKept: int
    promisesBroken: int
    openPromises: int
    openPromiseValue: float
    promisesDueToday: int
    promisesDueTodayValue: float
    promisesDueWeek: int
    promisesOverdue: int
    slaCompliancePct: float | None = None
    slaBreached: int
    slaDueSoon: int
    avgDaysToClose: float | None = None
    closedMtd: int
    trend: list[TrendPoint] = []
    ageing: list[AgeingLine] = []
    collectors: list[CollectorLine] = []
    topExposure: list[ExposureLine] = []
    atRisk: list[SlaLine] = []


# --- Writes ---------------------------------------------------------------
class CaseCreate(Camel):
    customerId: str
    accountId: int | None = None
    typeCode: str
    sourceCode: str = "AGENT_MANUAL"
    reason: str | None = None
    priority: str | None = None
    queueCode: str | None = None
    agentId: int | None = None
    dueDate: dt.date | None = None
    notes: str | None = None
    invoiceId: int | None = None
    ptpId: int | None = None
    disputeId: int | None = None
    amount: float | None = None
    externalRef: str | None = None
    triggerDetail: str | None = None
    # What to do if an active case of this type already exists. Omitted, the
    # case type's own duplicate_policy decides.
    duplicateAction: str | None = None
    # Deliberately unassigned, so it lands in the Needs-a-case pool rather than
    # following the customer's existing owner.
    assignToPool: bool = False


class CasePatch(Camel):
    """Edits to a case that are not a status move.

    A case carries one type at a time and that type changes as the situation
    does — a broken promise that goes to legal becomes a Legal Follow-up case
    rather than spawning a second one.
    """
    typeCode: str | None = None
    priority: str | None = None
    summary: str | None = None
    reason: str | None = None


class DuplicateCheck(Camel):
    hasDuplicate: bool
    policy: str
    existingCaseId: int | None = None
    existingCaseNumber: str | None = None
    existingState: str | None = None
    existingOpenedAt: dt.datetime | None = None
    existingType: str | None = None
    message: str | None = None
    options: list[str] = []


class CaseCreated(Camel):
    id: int
    caseNumber: str
    action: str
    queueCode: str | None = None
    agentName: str | None = None
    message: str


class TransitionRequest(Camel):
    toState: str
    note: str | None = None
    resolution: str | None = None


class AssignRequest(Camel):
    agentId: int | None = None
    queueCode: str | None = None
    reason: str | None = None
    assignmentType: str = "MANUAL"


class MergeRequest(Camel):
    targetCaseId: int
    reason: str | None = None


class NoteCreate(Camel):
    body: str = Field(min_length=1)
    noteType: str = "GENERAL"
    visibility: str = "INTERNAL"
    isPinned: bool = False


class AttachmentCreate(Camel):
    fileName: str
    fileType: str | None = None
    fileSizeBytes: int | None = None
    storageUri: str
    documentType: str = "OTHER"


class QueueWrite(Camel):
    code: str
    name: str
    description: str | None = None
    dpdMin: int | None = None
    dpdMax: int | None = None
    amountMin: float | None = None
    amountMax: float | None = None
    riskLevels: list[str] = []
    customerTypes: list[str] = []
    assignmentMode: str = "ROUND_ROBIN"
    maxPerAgent: int = 50
    isActive: bool = True


class CaseTypeWrite(Camel):
    code: str
    name: str
    description: str | None = None
    defaultPriority: str = "Medium"
    defaultQueue: str | None = None
    slaHours: int = 24
    duplicatePolicy: str = "OPEN_EXISTING"
    requiresApproval: bool = False
    autoCloseOnPay: bool = False
    isActive: bool = True


# ==========================================================================
# Case candidates — defaulters with no open case
# ==========================================================================
class CandidateRow(Camel):
    """An account that has defaulted but has no case working it."""

    customerId: str
    customerName: str
    customerType: str
    companyName: str | None = None
    accountId: int
    accountCode: str
    ban: str | None = None
    outstanding: float
    dpd: int
    agingBucket: str | None = None
    riskLevel: str
    riskScore: float
    creditScore: int | None = None
    agentId: int | None = None
    agentName: str | None = None
    lastPaymentOn: dt.date | None = None
    lastContactAt: dt.datetime | None = None
    strategy: str | None = None
    # Why this account is on the list, and what the system would raise for it
    triggerCode: str
    triggerLabel: str
    triggerDetail: str
    suggestedType: str
    suggestedTypeName: str
    suggestedPriority: str
    suggestedQueue: str | None = None
    urgency: int
    # Context behind the trigger
    brokenPtpCode: str | None = None
    brokenPtpAmount: float | None = None
    overduePtpDate: dt.date | None = None
    openDisputes: int = 0


class CandidateSummary(Camel):
    total: int
    totalValue: float
    mine: int
    byTrigger: list[dict]


class BulkCaseRequest(Camel):
    """Raise a case for several candidates at once, honouring each suggestion."""

    accountIds: list[int]
    assignToMe: bool = True
    agentId: int | None = None
    overrideType: str | None = None
    overridePriority: str | None = None
    note: str | None = None


class BulkCaseResult(Camel):
    created: int
    skipped: int
    cases: list[dict]
    messages: list[str]


# ==========================================================================
# Ticketing — board, grouping, tasks, tags, escalation
# ==========================================================================
class TagRow(Camel):
    code: str
    label: str
    colour: str
    description: str | None = None


class TicketCard(Camel):
    """A case as it appears on the board or in a grouped list."""

    id: int
    caseNumber: str
    customerId: str
    # The person; the company they belong to is separate, not a substitute.
    customerName: str
    companyName: str | None = None
    customerType: str
    accountCode: str | None = None
    outstanding: float
    amount: float
    dpd: int
    dpdBucket: str | None = None
    priority: str
    riskLevel: str
    riskScore: float
    type: str
    typeName: str | None = None
    source: str
    workflowState: str
    stateCategory: str | None = None
    queueCode: str | None = None
    queueName: str | None = None
    agentId: int | None = None
    agentName: str | None = None
    strategy: str | None = None
    region: str | None = None
    branch: str | None = None
    product: str | None = None
    openedAt: dt.datetime
    dueDate: dt.date | None = None
    slaDeadline: dt.datetime | None = None
    slaBreached: bool = False
    slaPaused: bool = False
    hoursToSla: float | None = None
    # SLA traffic light: GREEN / AMBER / RED / PAUSED / DONE
    slaColour: str = "GREEN"
    nextFollowUp: dt.date | None = None
    # Indicators
    hasPtp: bool = False
    ptpBroken: bool = False
    hasDispute: bool = False
    isEscalated: bool = False
    inLegal: bool = False
    inAgency: bool = False
    isWatched: bool = False
    # Counts
    activityCount: int = 0
    noteCount: int = 0
    attachmentCount: int = 0
    taskCount: int = 0
    tags: list[str] = []


class BoardColumn(Camel):
    key: str
    label: str
    colour: str | None = None
    count: int
    value: float
    cards: list[TicketCard]


class CustomerGroup(Camel):
    """A customer header row, with their cases underneath."""

    key: str
    customerId: str
    customerName: str
    customerType: str
    totalOutstanding: float
    accounts: int
    # How many customer records sit under this group (a company has several).
    people: int = 1
    cases: int
    openPtps: int
    disputes: int
    totalExposure: float
    worstPriority: str
    riskLevel: str
    agentName: str | None = None
    unassigned: int = 0
    breached: int = 0
    tickets: list[TicketCard]


class BoardResponse(Camel):
    groupBy: str
    columns: list[BoardColumn]
    customerGroups: list[CustomerGroup] = []
    total: int
    totalValue: float


class TaskRow(Camel):
    id: int
    caseId: int | None = None
    caseNumber: str | None = None
    customerId: str
    customerName: str
    title: str
    detail: str | None = None
    taskType: str
    dueDate: dt.date
    dueTime: dt.time | None = None
    assignedTo: int | None = None
    assignedToName: str | None = None
    status: str
    priority: str
    outcome: str | None = None
    completedAt: dt.datetime | None = None
    outstanding: float = 0
    dpd: int = 0
    overdue: bool = False


class TaskDay(Camel):
    """One day of the follow-up diary."""

    date: dt.date
    label: str
    relative: str
    isToday: bool
    isOverdue: bool
    total: int
    open: int
    value: float
    tasks: list[TaskRow]


class TaskBoard(Camel):
    days: list[TaskDay]
    totalOpen: int
    overdue: int
    today: int
    tomorrow: int
    thisWeek: int
    byType: list[dict]


class TaskCreate(Camel):
    caseId: int | None = None
    customerId: str | None = None
    title: str
    detail: str | None = None
    taskType: str = "FOLLOW_UP"
    dueDate: dt.date
    dueTime: dt.time | None = None
    assignedTo: int | None = None
    priority: str = "Medium"


class TaskPatch(Camel):
    status: str | None = None
    outcome: str | None = None
    dueDate: dt.date | None = None
    assignedTo: int | None = None
    priority: str | None = None


class EscalationRequest(Camel):
    escalateTo: str
    reason: str
    assignedTo: int | None = None
    queueCode: str | None = None


class EscalationRow(Camel):
    id: int
    caseId: int
    caseNumber: str | None = None
    customerName: str | None = None
    escalateTo: str
    reason: str | None = None
    fromState: str | None = None
    toState: str | None = None
    raisedByName: str | None = None
    assignedToName: str | None = None
    status: str
    raisedAt: dt.datetime
    resolvedAt: dt.datetime | None = None


class BulkRequest(Camel):
    caseIds: list[int]
    action: str
    agentId: int | None = None
    queueCode: str | None = None
    priority: str | None = None
    toState: str | None = None
    tags: list[str] = []
    followUpDate: dt.date | None = None
    escalateTo: str | None = None
    reason: str | None = None


class BulkResult(Camel):
    ok: int
    failed: int
    messages: list[str]


class TicketCounters(Camel):
    needsCase: int
    openCases: int
    inProgress: int
    waitingCustomer: int
    promiseDueToday: int
    brokenPromises: int
    disputes: int
    legalCases: int
    agencyCases: int
    overSla: int
    #: Finished, waiting to be closed off — excluded from openCases by design.
    awaitingClose: int = 0
    resolvedToday: int
    collectedToday: float
    recoveredAmount: float
