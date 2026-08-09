"""API shapes for the AI Engagement Center live-chat queue."""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, Field


class ChatSummary(BaseModel):
    waiting: int
    active: int
    resolvedToday: int


class ConversationRow(BaseModel):
    sessionId: str
    escalationId: int
    status: int
    trigger: str
    detail: str
    customerId: int | None = None
    customerCode: str | None = None
    customerName: str
    email: str | None = None
    msisdn: str | None = None
    accountCode: str
    outstanding: float
    dpd: int
    assignedTo: int | None = None
    assignedToName: str | None = None
    lastMessage: str | None = None
    lastSpeaker: str | None = None
    lastMessageAt: dt.datetime | None = None
    createdAt: dt.datetime
    acceptedAt: dt.datetime | None = None
    resolvedAt: dt.datetime | None = None


class ChatMessage(BaseModel):
    id: int
    index: int
    speaker: str
    text: str
    createdAt: dt.datetime


class ConversationDetail(ConversationRow):
    messages: list[ChatMessage] = []


class SendAgentMessage(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ActionResult(BaseModel):
    ok: bool = True


# --- Contact history --------------------------------------------------------
class ChannelLine(BaseModel):
    channel: str
    attempts: int
    reached: int
    reachRate: float | None = None
    automated: int


class OutcomeLine(BaseModel):
    outcome: str
    count: int


class DayLine(BaseModel):
    day: dt.date
    attempts: int
    reached: int
    automated: int


class HourLine(BaseModel):
    hour: int
    attempts: int
    reached: int
    reachRate: float | None = None


class AgentContactLine(BaseModel):
    agentId: int | None = None
    agentName: str
    attempts: int
    reached: int
    reachRate: float | None = None
    customers: int


class ContactSummary(BaseModel):
    """What the engagement desk has been doing, and how well it lands."""
    days: int
    attempts: int
    reached: int
    # Attempts nobody picked up, and messages that were only delivered.
    noAnswer: int = 0
    delivered: int = 0
    # Attempts somebody could have answered — the reach-rate denominator.
    answerable: int = 0
    reachRate: float | None = None
    customers: int
    agents: int
    automated: int
    automatedShare: float | None = None
    inbound: int
    today: int
    # Conversations followed by a promise within two days.
    ledToPromise: int
    promiseRate: float | None = None
    channels: list[ChannelLine] = []
    outcomes: list[OutcomeLine] = []
    byDay: list[DayLine] = []
    byHour: list[HourLine] = []
    # Trailing underscore: `agents` above is the count.
    agents_: list[AgentContactLine] = Field(default_factory=list, alias="agentBoard")

    model_config = {"populate_by_name": True}


class ContactRow(BaseModel):
    id: int
    kind: str
    channel: str
    direction: str
    subject: str
    body: str | None = None
    outcome: str | None = None
    isAutomated: bool
    occurredAt: dt.datetime
    customerId: str
    customerName: str
    companyName: str | None = None
    agentName: str | None = None
    caseId: int | None = None
    caseNumber: str | None = None


class ContactOptions(BaseModel):
    channels: list[str] = []
    directions: list[str] = []
    agents: list[dict] = []
