"""Portfolio Dashboard response shapes."""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel


class MonthPoint(BaseModel):
    month: dt.date
    billed: float
    collected: float


class AgeingLine(BaseModel):
    bucket: str
    accounts: int
    balance: float


class StageLine(BaseModel):
    """One slice of the delinquent balance. Slices are mutually exclusive."""
    stage: str
    accounts: int
    balance: float


class SegmentLine(BaseModel):
    name: str
    accounts: int
    balance: float
    delinquent: float
    delinquentPct: float | None = None


class StrategyLine(BaseModel):
    code: str
    name: str
    status: str
    version: str
    accounts: int
    balance: float
    successRate: float | None = None


class PortfolioOverview(BaseModel):
    """The whole book, and how much of the application is engaged with it."""

    # The book
    receivables: float
    accounts: int
    customers: int
    enterpriseCustomers: int
    companies: int
    receivablesDeltaPct: float | None = None

    # What has gone bad
    delinquent: float
    delinquentAccounts: int
    delinquentPct: float | None = None
    severe: float
    severePct: float | None = None

    # How much of it is being worked
    underCase: float
    coveragePct: float | None = None
    uncovered: float
    openCases: int
    closedThisMonth: int

    # Cash
    billedThisMonth: float
    collectedThisMonth: float
    cashCollectionPct: float | None = None
    collectedDeltaPct: float | None = None

    # The delinquent balance split by where it sits — these sum to `delinquent`.
    stages: list[StageLine] = []

    # Commitments and cash movements, which are NOT slices of that balance:
    # a promise is a future undertaking, a placement's face value is what it was
    # worth on the day it went out, and recoveries are cash received over the
    # life of the book.
    promised: float
    disputed: float
    placedFaceValue: float
    claimed: float
    agencyRecovered: float

    # Risk, strategy coverage, and the people running it
    riskyAccounts: int
    riskyValue: float
    accountsOnStrategy: int
    accountsOffStrategy: int
    activeUsers: int
    agents: int
    roles: int

    trend: list[MonthPoint] = []
    ageing: list[AgeingLine] = []
    products: list[SegmentLine] = []
    strategies: list[StrategyLine] = []
