"""Risk Grid Analysis routes: /risk-grid."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey
from app.modules.riskgrid import schemas, service

router = APIRouter(prefix="/risk-grid", tags=["risk-grid"])

_can_view = require(PermKey.RISK_GRID_ANALYTICS, "view")


def filters(
    dateFrom: date | None = Query(default=None),
    dateTo: date | None = Query(default=None),
    customerType: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
    dpdBucket: str | None = Query(default=None),
    region: str | None = Query(default=None),
    accountStatus: str | None = Query(default=None),
    strategy: str | None = Query(default=None),
    behaviour: str | None = Query(default=None),
) -> schemas.Filters:
    """One dependency, so every widget honours the same filter bar."""
    return schemas.Filters(
        dateFrom=dateFrom, dateTo=dateTo, customerType=customerType, riskLevel=riskLevel,
        dpdBucket=dpdBucket, region=region, accountStatus=accountStatus,
        strategy=strategy, behaviour=behaviour,
    )


Filt = Depends(filters)


@router.get("/options", response_model=schemas.FilterOptions)
async def options(db: DbSession, _: Principal = Depends(_can_view)) -> schemas.FilterOptions:
    return await service.filter_options(db)


@router.get("/summary", response_model=schemas.KpiSummary)
async def summary(
    db: DbSession, f: schemas.Filters = Filt, _: Principal = Depends(_can_view)
) -> schemas.KpiSummary:
    return await service.summary(db, f)


@router.get("/matrix", response_model=list[schemas.MatrixCell])
async def matrix(
    db: DbSession, f: schemas.Filters = Filt, _: Principal = Depends(_can_view)
) -> list[schemas.MatrixCell]:
    return await service.matrix(db, f)


@router.get("/customer-behaviour", response_model=list[schemas.BehaviourSegment])
async def customer_behaviour(
    db: DbSession, f: schemas.Filters = Filt, _: Principal = Depends(_can_view)
) -> list[schemas.BehaviourSegment]:
    return await service.behaviour(db, f)


@router.get("/migration", response_model=list[schemas.MigrationCell])
async def migration(
    db: DbSession, f: schemas.Filters = Filt, _: Principal = Depends(_can_view)
) -> list[schemas.MigrationCell]:
    return await service.migration(db, f)


@router.get("/drivers", response_model=list[schemas.RiskDriver])
async def drivers(
    db: DbSession, f: schemas.Filters = Filt, _: Principal = Depends(_can_view)
) -> list[schemas.RiskDriver]:
    return await service.drivers(db, f)


@router.get("/distribution", response_model=list[schemas.DistributionBand])
async def distribution(
    db: DbSession, f: schemas.Filters = Filt, _: Principal = Depends(_can_view)
) -> list[schemas.DistributionBand]:
    return await service.distribution(db, f)


@router.get("/strategies", response_model=list[schemas.StrategyRow])
async def strategies(
    db: DbSession, f: schemas.Filters = Filt, _: Principal = Depends(_can_view)
) -> list[schemas.StrategyRow]:
    return await service.strategies(db, f)


@router.get("/recommendation", response_model=schemas.Recommendation)
async def recommendation(
    db: DbSession, f: schemas.Filters = Filt, _: Principal = Depends(_can_view)
) -> schemas.Recommendation:
    return await service.recommendation(db, f)


@router.get("/funnel", response_model=list[schemas.FunnelStage])
async def funnel(
    db: DbSession, f: schemas.Filters = Filt, _: Principal = Depends(_can_view)
) -> list[schemas.FunnelStage]:
    return await service.funnel(db, f)


@router.get("/priority-targets", response_model=schemas.PriorityPage)
async def priority_targets(
    db: DbSession,
    f: schemas.Filters = Filt,
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=10, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: Principal = Depends(_can_view),
) -> schemas.PriorityPage:
    return await service.priority_targets(db, f, search=search, limit=limit, offset=offset)


@router.get("/enterprise-exposure", response_model=list[schemas.EnterpriseNode])
async def enterprise_exposure(
    db: DbSession,
    f: schemas.Filters = Filt,
    company: str | None = Query(default=None),
    _: Principal = Depends(_can_view),
) -> list[schemas.EnterpriseNode]:
    return await service.enterprise_exposure(db, f, company)
