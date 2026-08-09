"""Risk scoring rule shapes."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

MODES = ("RULE", "ML")
DRIVER_FIELDS = (
    "dpd",
    "outstanding",
    "contact_success_rate",
    "broken_ptp_count",
    "dispute_count",
    "customer_type",
    "credit_score",
    "monthly_bill",
)


class BandIn(BaseModel):
    minValue: float | None = None       # null = the catch-all "else" rung
    score: float = Field(ge=0, le=100)
    label: str | None = Field(default=None, max_length=80)
    # Qualitative grade shown on Subscriber 360 — Low / Medium / High.
    bandValue: str | None = Field(default=None, max_length=40)


class Band(BandIn):
    id: int
    sortOrder: int


class ScoreDefinition(BaseModel):
    code: str
    name: str
    description: str | None = None
    mode: str
    driverField: str | None = None
    weightPct: float
    direction: str
    sortOrder: int
    isActive: bool
    bands: list[Band] = Field(default_factory=list)


class ScoreUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=255)
    mode: str | None = None
    driverField: str | None = None
    weightPct: float | None = Field(default=None, ge=0, le=100)
    direction: str | None = None
    isActive: bool | None = None


class BandsUpdate(BaseModel):
    bands: list[BandIn]


class ActionResult(BaseModel):
    ok: bool
    detail: str | None = None


class MlPredictionColumn(BaseModel):
    key: str
    label: str
    dataType: str


class MlPredictionSample(BaseModel):
    scoreCode: str
    scoreName: str
    tableName: str | None = None
    available: bool
    columns: list[MlPredictionColumn] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    message: str | None = None
