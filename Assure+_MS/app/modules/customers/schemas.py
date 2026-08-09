"""Customer 360 response shapes."""

from __future__ import annotations

import datetime as dt
from datetime import date, datetime

from pydantic import BaseModel, Field

GRADES = ("Low", "Medium", "High")


class CustomerProfile(BaseModel):
    """Everything the Subscriber 360 screen needs about one customer."""

    id: str  # customer_code
    name: str
    customerType: str
    email: str | None = None
    phone: str | None = None
    msisdn: str | None = None
    ban: str | None = None
    segment: str
    region: str
    country: str | None = None
    city: str | None = None
    address: str | None = None
    creditScore: int | None = None
    riskScore: float
    riskLevel: str
    contactability: float
    bestContactTime: str | None = None
    bestChannel: str | None = None
    status: str
    onboardedOn: date | None = None

    # --- Subscriber profile ---
    behaviourType: str | None = None
    preferredLanguage: str | None = None
    communicationPreference: str | None = None
    occupation: str | None = None
    monthlyIncome: float | None = None
    financialStress: str | None = None
    legalAwareness: str | None = None
    financialLiteracy: str | None = None
    responsibilityScore: float | None = None
    creditAwareness: str | None = None
    riskAppetite: str | None = None
    emotionalState: str | None = None
    lifeEvent: str | None = None
    employmentStability: str | None = None
    cooperationScore: float | None = None
    preferredContactTime: str | None = None

    # --- Subscriber line + enterprise hierarchy (one row per subscriber) ---
    subscriberNo: str | None = None
    companyCode: str | None = None
    companyName: str | None = None
    branch: str | None = None
    department: str | None = None
    billingAccountNumber: str | None = None
    invoiceNumber: str | None = None
    invoiceType: str | None = None
    serviceType: str | None = None
    plan: str | None = None
    accountStatus: str | None = None
    activationDate: date | None = None
    outstanding: float | None = None          # this subscriber line
    totalOutstanding: float | None = None     # every line this customer holds
    lineCount: int = 1
    currency: str = "USD"
    currentDpd: int | None = None
    agingBucket: str | None = None
    assignedStrategy: str | None = None
    assignedAgent: str | None = None
    lastPaymentDate: date | None = None
    lastContactDate: date | None = None
    nextFollowupDate: date | None = None


class TrendPoint(BaseModel):
    month: str
    score: float


class PaymentPoint(BaseModel):
    month: str
    amount: float
    status: str


class Customer360(CustomerProfile):
    """Profile plus the engagement, risk and payment history the screen charts."""

    riskTrend: list[TrendPoint] = Field(default_factory=list)
    paymentHistory: list[PaymentPoint] = Field(default_factory=list)
    lastPaymentAmount: float | None = None
    contactability: float = 0
    disputeRate: float = 0
    ptpSuccess: float = 0
    communications: int = 0
    dunningStage: int = 0
    caseId: str | None = None
    caseStatus: str | None = None
    ptpStatus: str | None = None
    nextAction: str | None = None
    riskDrivers: list[str] = Field(default_factory=list)


class CustomerRow(BaseModel):
    """Compact row for pickers and lists."""

    id: str
    name: str
    customerType: str
    segment: str
    riskLevel: str
    status: str


class CustomerProfileUpdate(BaseModel):
    behaviourType: str | None = None
    preferredLanguage: str | None = None
    communicationPreference: str | None = None
    occupation: str | None = Field(default=None, max_length=80)
    monthlyIncome: float | None = None
    financialStress: str | None = None
    legalAwareness: str | None = None
    financialLiteracy: str | None = None
    responsibilityScore: float | None = None
    creditAwareness: str | None = None
    riskAppetite: str | None = None
    emotionalState: str | None = None
    lifeEvent: str | None = Field(default=None, max_length=80)
    employmentStability: str | None = None
    cooperationScore: float | None = None
    preferredContactTime: str | None = None


# --- Borrower 360 tabs -----------------------------------------------------
class InvoiceRow(BaseModel):
    invoiceNo: str
    product: str | None = None
    dueDate: date
    amount: float
    paid: float
    status: str
    invoiceType: str


class PaymentRow(BaseModel):
    reference: str
    date: dt.date
    amount: float
    method: str | None = None
    status: str
    invoiceNo: str | None = None


class InteractionRow(BaseModel):
    occurredAt: datetime
    type: str
    channel: str | None = None
    direction: str
    subject: str | None = None
    outcome: str | None = None
    agent: str | None = None
    automated: bool = False


class DisputeRow(BaseModel):
    disputeCode: str
    reason: str
    description: str | None = None
    amount: float
    status: str
    priority: str
    filedAt: datetime
    slaDeadline: datetime | None = None


class MilestoneRow(BaseModel):
    label: str
    date: dt.date | None = None
    status: str
    detail: str | None = None


class BorrowerFile(BaseModel):
    invoices: list[InvoiceRow] = Field(default_factory=list)
    payments: list[PaymentRow] = Field(default_factory=list)
    interactions: list[InteractionRow] = Field(default_factory=list)
    disputes: list[DisputeRow] = Field(default_factory=list)
    milestones: list[MilestoneRow] = Field(default_factory=list)


# --- Enterprise hierarchy --------------------------------------------------
class SubscriberRow(BaseModel):
    id: str                     # customer_code
    name: str
    subscriberNo: str | None = None
    servicePlan: str | None = None
    ban: str | None = None
    outstanding: float = 0
    dpd: int = 0
    riskLevel: str
    status: str


class BranchRow(BaseModel):
    id: str                     # branch_code
    name: str
    city: str | None = None
    isHeadOffice: bool = False
    subscribers: int = 0
    outstanding: float = 0
    subscriberList: list[SubscriberRow] = Field(default_factory=list)


class CompanyRow(BaseModel):
    id: str                     # company_code
    name: str
    industry: str | None = None
    hqCity: str | None = None
    branches: int = 0
    subscribers: int = 0
    bans: list[str] = Field(default_factory=list)
    outstanding: float = 0


class CompanyDetail(CompanyRow):
    branchList: list[BranchRow] = Field(default_factory=list)


class SubscriberSignals(BaseModel):
    """Behavioural signals from customer_schema.subscriber_risk_profile."""

    behaviourType: str | None = None
    riskBand: str | None = None
    recommendedStrategy: str | None = None
    accountAgeMonths: int | None = None
    invoicesLast12m: int | None = None
    invoicesPaidOnTime: int | None = None
    onTimePct: float | None = None
    avgPaymentDelayDays: float | None = None
    ptpCount: int | None = None
    ptpHonoured: int | None = None
    ptpBroken: int | None = None
    disputesRaised: int | None = None
    complaintsRaised: int | None = None
    successfulContacts: int | None = None
    failedContacts: int | None = None
    smsResponseRate: float | None = None
    emailResponseRate: float | None = None
    callAnswerRate: float | None = None
    legalNotices: int | None = None
    settlements: int | None = None
    writeoffs: int | None = None
    financialStressScore: float | None = None
    responsibilityScore: float | None = None
    cooperationScore: float | None = None
    creditAwarenessScore: float | None = None
    legalAwarenessScore: float | None = None
    financialLiteracyScore: float | None = None
    employmentStabilityScore: float | None = None
    overallRiskScore: float | None = None
    lastCalculated: datetime | None = None
