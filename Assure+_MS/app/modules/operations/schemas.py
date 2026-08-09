"""AI Guardrails shapes — the rules, what they have caught, and who changed them."""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, Field

KINDS = ("INPUT_FILTER", "OUTPUT_FILTER", "ESCALATION_RULE", "PROMPT_TEMPLATE")
ACTIONS = ("BLOCK", "MASK", "REWRITE", "FLAG", "ESCALATE", "ALLOW")
SEVERITIES = ("Low", "Medium", "High", "Critical")


class GuardrailRow(BaseModel):
    id: int
    kind: str
    code: str
    label: str
    description: str | None = None
    action: str
    severity: str
    config: dict = {}
    isEnabled: bool
    # Seeded rules may be disabled but not deleted.
    isSystem: bool
    sortOrder: int
    updatedAt: dt.datetime
    updatedBy: str | None = None
    # How often this rule has fired in the last 30 days.
    hits30d: int = 0


class GuardrailWrite(BaseModel):
    kind: str
    code: str | None = Field(default=None, max_length=60)
    label: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=500)
    action: str = "BLOCK"
    severity: str = "Medium"
    config: dict = {}
    isEnabled: bool = True


class GuardrailPatch(BaseModel):
    label: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=500)
    action: str | None = None
    severity: str | None = None
    config: dict | None = None
    isEnabled: bool | None = None
    reason: str | None = Field(default=None, max_length=500)


class EventRow(BaseModel):
    id: int
    code: str
    label: str | None = None
    kind: str
    outcome: str
    channel: str
    sample: str | None = None
    detail: str | None = None
    createdAt: dt.datetime


class AuditRow(BaseModel):
    id: int
    code: str
    action: str
    fieldName: str | None = None
    oldValue: str | None = None
    newValue: str | None = None
    reason: str | None = None
    actor: str | None = None
    createdAt: dt.datetime


class DayCount(BaseModel):
    day: dt.date
    blocked: int
    masked: int
    escalated: int
    other: int


class GuardrailStats(BaseModel):
    rules: int
    enabled: int
    events30d: int
    blocked30d: int
    escalated30d: int
    # Share of judged messages that were stopped or changed in some way.
    interventionRate: float | None = None
    byDay: list[DayCount] = []
    topRules: list[dict] = []


class Guardrails(BaseModel):
    inputFilters: list[GuardrailRow] = []
    outputFilters: list[GuardrailRow] = []
    escalationRules: list[GuardrailRow] = []
    promptTemplates: list[GuardrailRow] = []
    stats: GuardrailStats


# --- Agent Performance ------------------------------------------------------
class PerfMonth(BaseModel):
    month: dt.date
    collected: float
    target: float
    attainment: float | None = None
    casesAssigned: int
    casesResolved: int
    ptpCreated: int
    ptpKept: int
    contacts: int
    slaBreaches: int


class PeerLine(BaseModel):
    agentId: int
    agentName: str
    collected: float
    target: float
    attainment: float | None = None
    openCases: int
    breached: int
    isMe: bool = False


class NextAction(BaseModel):
    caseId: int
    caseNumber: str
    customerId: str
    customerName: str
    caseType: str | None = None
    priority: str
    outstanding: float
    hoursToSla: float
    reason: str


class AgentPerformance(BaseModel):
    """One collector's month: what they brought in, carried, promised and did."""

    agentId: int
    agentName: str
    email: str | None = None
    employeeCode: str | None = None
    skillGroup: str | None = None
    expertise: str | None = None
    languages: list[str] = []
    specializations: list[str] = []
    availability: str | None = None
    hiredOn: dt.date | None = None
    yearsExperience: int | None = None
    rating: float | None = None

    # Cash
    collectedMtd: float
    collectedToday: float
    target: float
    attainment: float | None = None
    payments: int

    # The book carried
    portfolio: float
    customers: int
    accounts: int
    openCases: int
    notStarted: int
    closedThisMonth: int
    maxCaseload: int | None = None
    caseloadPct: float | None = None
    slaBreached: int
    slaDueSoon: int
    slaCompliance: float | None = None
    avgDaysToClose: float | None = None

    # Promises
    openPromises: int
    openPromiseValue: float
    promisesDueToday: int
    promisesKept: int
    promisesBroken: int
    keptRate: float | None = None

    # Conversations
    contactsMtd: int
    contactsToday: int
    contactsReached: int
    reachRate: float | None = None

    # Follow-ups
    tasksTotal: int
    tasksDone: int
    tasksOverdue: int
    tasksDueToday: int
    taskCompletion: float | None = None

    openDisputes: int
    disputesSettledMtd: int

    rank: int | None = None
    ofAgents: int = 0
    history: list[PerfMonth] = []
    floor: list[PeerLine] = []
    nextUp: list[NextAction] = []
