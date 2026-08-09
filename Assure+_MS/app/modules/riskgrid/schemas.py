"""Risk Grid Analysis response shapes."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class Filters(BaseModel):
    """Every widget accepts the same filter set, so cross-filtering is uniform."""

    dateFrom: date | None = None
    dateTo: date | None = None
    customerType: str | None = None
    riskLevel: str | None = None
    dpdBucket: str | None = None
    region: str | None = None
    accountStatus: str | None = None
    strategy: str | None = None
    behaviour: str | None = None


class KpiSummary(BaseModel):
    portfolioHealth: float
    portfolioHealthTrend: float
    totalOutstanding: float
    consumerOutstanding: float
    enterpriseOutstanding: float
    expectedRecovery30d: float
    expectedRecoveryPct: float
    highRiskAccounts: int
    highRiskOutstanding: float
    avgRecoveryProbability: float
    totalAccounts: int
    totalCustomers: int


class MatrixCell(BaseModel):
    riskLevel: str
    dpdBucket: str
    accounts: int
    customers: int
    outstanding: float
    avgRecovery: float


class BehaviourSegment(BaseModel):
    profile: str
    accounts: int
    outstanding: float
    avgRecovery: float
    avgRisk: float
    share: float


class StrategyRow(BaseModel):
    strategy: str
    code: str | None = None
    accounts: int
    outstanding: float
    collected90d: float
    recoveryRate: float
    avgRecoveryProbability: float


class MigrationCell(BaseModel):
    fromBand: str
    toBand: str
    accounts: int
    outstanding: float
    direction: str          # improved | stable | deteriorated


class RiskDriver(BaseModel):
    driver: str
    avgScore: float
    weightPct: float
    contribution: float     # share of the overall score this driver accounts for
    accountsAffected: int


class DistributionBand(BaseModel):
    riskLevel: str
    accounts: int
    customers: int
    outstanding: float
    sharePct: float
    exposurePct: float
    avgDpd: float
    avgRecovery: float


class Recommendation(BaseModel):
    action: str
    reason: str
    channels: list[str] = Field(default_factory=list)
    coverage: int
    outstanding: float


class FunnelStage(BaseModel):
    stage: str
    accounts: int
    outstanding: float
    conversionPct: float
    ofPortfolioPct: float


class PriorityTarget(BaseModel):
    rank: int
    customerId: str
    customerName: str
    customerType: str
    accountCode: str
    subscriberNo: str | None = None
    outstanding: float
    dpd: int
    riskLevel: str
    behaviourProfile: str
    recoveryProbability: float
    recommendedStrategy: str
    lastContact: datetime | None = None
    nextAction: date | None = None
    priorityScore: float


class PriorityPage(BaseModel):
    rows: list[PriorityTarget]
    total: int


class EnterpriseNode(BaseModel):
    level: str                    # company | branch | ban | account
    id: str
    name: str
    parentId: str | None = None
    accounts: int
    outstanding: float
    avgDpd: float
    riskLevel: str
    recoveryProbability: float


class FilterOptions(BaseModel):
    customerTypes: list[str]
    riskLevels: list[str]
    dpdBuckets: list[str]
    regions: list[str]
    accountStatuses: list[str]
    strategies: list[str]
    behaviours: list[str]
