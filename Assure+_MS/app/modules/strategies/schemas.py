"""Strategy request / response shapes, matching the Strategy Library UI."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

AGING_BUCKETS = ("Current", "1-30", "31-60", "61-90", "90+")
RISK_LEVELS = ("Low", "Medium", "High", "Critical")
BEHAVIOUR_TYPES = ("Willing", "Forgetful", "Evasive", "Disputed", "Hardship")
EMOTION_TYPES = ("Cooperative", "Neutral", "Anxious", "Frustrated", "Hostile")
# What the UI shows / sends, mapped to the database CHECK vocabulary.
STATUSES = ("Draft", "Active", "Paused", "Archived")


class StrategyRow(BaseModel):
    id: str  # strategy_code
    name: str
    description: str | None = None
    segment: str | None = None
    aging: list[str] | None = None
    riskLevel: list[str] | None = None
    status: str
    version: str
    workflow: dict = Field(default_factory=dict)
    targetAudience: dict = Field(default_factory=dict)
    abTest: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)
    uplift: float | None = None
    behaviour: list[str] | None = None
    emotion: list[str] | None = None
    minIncome: float | None = None
    maxIncome: float | None = None
    minLoan: float | None = None
    maxLoan: float | None = None
    successRate: float | None = None
    averageRecovery: float | None = None
    averageTurns: float | None = None
    # Derived, never stored: the two always sum to 100.
    failureRate: float | None = None
    isDefault: bool = False
    activatedAt: datetime | None = None
    createdAt: datetime
    updatedAt: datetime


class StrategyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    id: str | None = Field(default=None, max_length=40)  # optional explicit code
    description: str | None = Field(default=None, max_length=500)
    segment: str | None = None
    aging: list[str] | None = None
    riskLevel: list[str] | None = None
    status: str = "Draft"
    behaviour: list[str] | None = None
    emotion: list[str] | None = None
    minIncome: float | None = None
    maxIncome: float | None = None
    minLoan: float | None = None
    maxLoan: float | None = None
    successRate: float | None = None
    averageRecovery: float | None = None
    averageTurns: float | None = None
    workflow: dict | None = None
    targetAudience: dict | None = None
    abTest: dict | None = None
    settings: dict | None = None


class StrategyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    segment: str | None = None
    aging: list[str] | None = None
    riskLevel: list[str] | None = None
    status: str | None = None
    version: str | None = Field(default=None, max_length=10)
    behaviour: list[str] | None = None
    emotion: list[str] | None = None
    minIncome: float | None = None
    maxIncome: float | None = None
    minLoan: float | None = None
    maxLoan: float | None = None
    successRate: float | None = None
    averageRecovery: float | None = None
    averageTurns: float | None = None
    workflow: dict | None = None
    targetAudience: dict | None = None
    abTest: dict | None = None
    settings: dict | None = None
    # What the editor wants the version history to say about this change.
    # Left blank, the history describes the change itself.
    changeSummary: str | None = Field(default=None, max_length=500)


class ActionResult(BaseModel):
    ok: bool
    detail: str | None = None


# --- Version history --------------------------------------------------------
class VersionRow(BaseModel):
    id: int
    version: str
    summary: str | None = None
    # BASELINE / EDIT / RESTORE — why this version exists.
    kind: str
    changedFields: list[str] = []
    restoredFrom: str | None = None
    author: str | None = None
    createdAt: datetime
    # The strategy as it was at this version, in brief.
    name: str | None = None
    strategyStatus: str | None = None
    nodes: int = 0
    edges: int = 0


class VersionDetail(VersionRow):
    snapshot: dict = {}


class FieldDiff(BaseModel):
    field: str
    before: str
    after: str


class VersionCompare(BaseModel):
    left: str
    right: str
    differences: list[FieldDiff] = []


class RestoreRequest(BaseModel):
    reason: str | None = None


class CloneRequest(BaseModel):
    """Start a new strategy from an old version of this one."""
    name: str
    id: str | None = None
    description: str | None = None


class RestoreResult(BaseModel):
    ok: bool = True
    version: str
    restoredFrom: str
    changed: list[str] = []
    detail: str


# ==========================================================================
# Strategy performance dashboard
#
# Measures that are only meaningful about a strategy — whether it beats doing
# nothing, what it costs to run, whether it is pointed at the right accounts —
# as opposed to restating how the portfolio is doing.
# ==========================================================================
class StrategySummary(BaseModel):
    activeStrategies: int
    #: How much of the book any strategy is actually working.
    coveredAccounts: int
    uncoveredAccounts: int
    coveredValue: float
    uncoveredValue: float
    coveragePct: float
    uncoveredAvgDpd: float
    #: Recovery against the same measure for accounts on no strategy at all.
    recoveryRate: float
    controlRate: float
    liftPct: float
    collected: float
    #: What outreach cost, and what it cost to bring in 100.
    touchCost: float
    costPer100: float
    touches: int
    responseRate: float
    promises: int
    promiseKeptRate: float
    #: Share of enrolled accounts handed on to agency or legal.
    escalationRate: float
    #: Share of accounts that match their strategy's declared target audience.
    routingAccuracy: float
    offTarget: int


class StrategyPerformance(BaseModel):
    strategyId: str
    name: str
    status: str
    version: str | None = None
    accounts: int
    liveAccounts: int
    outstanding: float
    collected: float
    recoveryRate: float
    #: None when no unmanaged account of the same age exists to compare against.
    liftPct: float | None = None
    controlRate: float | None = None
    #: Share of this strategy's book the comparison actually covers.
    controlCoveragePct: float = 0.0
    touches: int
    touchesPerAccount: float
    cost: float
    costPer100: float
    responseRate: float
    promises: int
    promiseKeptRate: float
    escalationRate: float
    offTarget: int
    offTargetValue: float
    daysToFirstPayment: float | None = None
    lastPublished: datetime | None = None


class ChannelEconomics(BaseModel):
    channel: str
    label: str
    touches: int
    cost: float
    unitCost: float
    responses: int
    responseRate: float
    promises: int
    costPerResponse: float | None = None


class FatiguePoint(BaseModel):
    touchNo: int
    touches: int
    responses: int
    responseRate: float
    cost: float


class CoverageGap(BaseModel):
    bucket: str
    accounts: int
    outstanding: float
    avgDpd: float
    worstRisk: str | None = None


class VersionImpact(BaseModel):
    strategyId: str
    name: str
    version: str | None = None
    publishedAt: datetime | None = None
    daysSince: int
    collectedBefore: float
    collectedAfter: float
    windowDays: int
    #: False until the window after the publish has fully elapsed.
    mature: bool
    changePct: float | None = None


class Instrumentation(BaseModel):
    """What the numbers rest on, so gaps are stated rather than implied."""

    stepEvents: int
    stepEventsWithNode: int
    nodeCoveragePct: float
    enrolments: int
    backfilledEnrolments: int


# ==========================================================================
# Target audience sizing
# ==========================================================================
class AudienceOption(BaseModel):
    """One filter choice, carrying how much of the book it covers."""

    value: str
    label: str
    customers: int
    accounts: int


class AudienceOptions(BaseModel):
    segments: list[AudienceOption]
    agingBuckets: list[AudienceOption]
    riskMin: int
    riskMax: int
    contactability: list[AudienceOption]
    balanceBands: list[AudienceOption]
    creditClasses: list[AudienceOption]


class AudienceEstimate(BaseModel):
    customers: int
    accounts: int
    outstanding: float
    avgDpd: float
    avgRisk: float
    shareOfAccountsPct: float
    shareOfValuePct: float
    totalCustomers: int
    totalAccounts: int


# --- Simulation -------------------------------------------------------------
class SimChannelRate(BaseModel):
    channel: str
    label: str
    costPerTouch: float
    reachRate: float
    # Whether this rate was measured from the book or assumed, and on what.
    source: str


class SimFactor(BaseModel):
    key: str
    factor: float


class SimAssumptions(BaseModel):
    """Every rate the run will use, and where each came from."""
    channels: list[SimChannelRate] = []
    promiseKeptRate: float
    promiseKeptSource: str
    settlementShare: float
    settlementSource: str
    riskFactors: list[SimFactor] = []
    ageFactors: list[SimFactor] = []


class SimulationRequest(BaseModel):
    # Population
    useTargeting: bool = True
    agingBuckets: list[str] | None = None
    riskLevels: list[str] | None = None
    maxAccounts: int = Field(default=200, ge=1, le=2000)
    # Assumptions the operator may override
    horizonDays: int = Field(default=30, ge=7, le=180)
    promiseKeptRate: float | None = Field(default=None, ge=0, le=100)
    settlementShare: float | None = Field(default=None, ge=0, le=100)
    responseLiftPct: float | None = Field(default=0, ge=-90, le=200)
    # Bookkeeping
    save: bool = False
    label: str | None = Field(default=None, max_length=160)


class SimFunnelStage(BaseModel):
    stage: str
    accounts: int


class SimStep(BaseModel):
    nodeId: str
    label: str
    kind: str
    channel: str | None = None
    entered: int
    succeeded: int
    cost: float
    successRate: float | None = None


class SimChannelResult(BaseModel):
    channel: str
    touches: int
    reached: int
    cost: float
    reachRate: float | None = None


class SimDay(BaseModel):
    day: int
    recovered: float
    touches: int
    cost: float


class SimOutcome(BaseModel):
    accountCode: str
    customerName: str
    outstanding: float
    riskLevel: str | None = None
    bucket: str | None = None
    outcome: str
    recovered: float


class SimulationResult(BaseModel):
    strategyCode: str
    strategyName: str
    strategyVersion: str | None = None
    seed: int
    accounts: int
    exposure: float
    horizonDays: int
    touches: int
    cost: float
    recovered: float
    recoveryRate: float | None = None
    costPerRecovered: float | None = None
    costPerAccount: float
    avgDaysToSettle: float | None = None
    funnel: list[SimFunnelStage] = []
    steps: list[SimStep] = []
    channels: list[SimChannelResult] = []
    curve: list[SimDay] = []
    sample: list[SimOutcome] = []
    assumptions: SimAssumptions


class SimulationRunRow(BaseModel):
    id: int
    strategyCode: str
    strategyVersion: str | None = None
    label: str | None = None
    accounts: int
    horizonDays: int
    exposure: float
    recovered: float
    cost: float
    recoveryRate: float | None = None
    seed: int
    createdAt: datetime
    createdBy: str | None = None
