"""Risk scoring rule routes: /risk/scores."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey
from app.modules.risk import schemas, service

router = APIRouter(prefix="/risk", tags=["risk"])

_can_view = require(PermKey.RISK_ANALYSIS, "view")
_can_edit = require(PermKey.RISK_ANALYSIS, "edit")


@router.get("/scores", response_model=list[schemas.ScoreDefinition])
async def list_scores(
    db: DbSession, _: Principal = Depends(_can_view)
) -> list[schemas.ScoreDefinition]:
    return await service.list_scores(db)


@router.get("/drivers", response_model=list[str])
async def list_drivers(_: Principal = Depends(_can_view)) -> list[str]:
    """Fields a rule-based score can be evaluated against."""
    return list(schemas.DRIVER_FIELDS)


@router.get("/ml-predictions/{code}", response_model=schemas.MlPredictionSample)
async def ml_predictions(
    code: str,
    db: DbSession,
    limit: int = Query(default=10, ge=1, le=100),
    _: Principal = Depends(_can_view),
) -> schemas.MlPredictionSample:
    """Return recent sample rows for one score currently assigned to ML."""
    return await service.ml_prediction_sample(db, code, limit)


@router.patch("/scores/{code}", response_model=schemas.ScoreDefinition)
async def update_score(
    code: str,
    payload: schemas.ScoreUpdate,
    db: DbSession,
    _: Principal = Depends(_can_edit),
) -> schemas.ScoreDefinition:
    return await service.update_score(db, code, payload)


@router.put("/scores/{code}/bands", response_model=schemas.ScoreDefinition)
async def replace_bands(
    code: str,
    payload: schemas.BandsUpdate,
    db: DbSession,
    _: Principal = Depends(_can_edit),
) -> schemas.ScoreDefinition:
    return await service.replace_bands(db, code, payload)


@router.post("/recalculate")
async def recalculate(db: DbSession, _: Principal = Depends(_can_edit)) -> dict:
    """Run the configured rules over every subscriber line."""
    return await service.recalculate(db)


@router.post("/recalculate-profiles")
async def recalculate_profiles(db: DbSession, _: Principal = Depends(_can_edit)) -> dict:
    """Rebuild customer_schema.subscriber_risk_profile from the current rules."""
    return await service.recalculate_subscriber_profiles(db)


@router.get("/customers")
async def risk_customers(db: DbSession, _: Principal = Depends(_can_view)) -> list[dict]:
    """Risk-scored customers for the Risk Analysis customer list."""
    return await service.risk_customers(db)


@router.get("/summary")
async def summary(db: DbSession, _: Principal = Depends(_can_view)) -> dict:
    return await service.score_summary(db)


@router.get("/profiles")
async def profiles(db: DbSession, _: Principal = Depends(_can_view)) -> list[dict]:
    return await service.sample_profiles(db)


@router.get("/scoring-sql")
async def scoring_sql(db: DbSession, _: Principal = Depends(_can_view)) -> dict:
    """The SQL the current rules compile to — useful for review and debugging."""
    sql, notes = await service.build_scoring_sql(db)
    return {"sql": sql.strip(), "notes": notes}
