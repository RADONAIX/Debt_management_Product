"""Strategy routes: /strategies — list, create, edit, activate, delete.

Viewing is gated on the Strategy Execution Summary permission; every change
requires edit on the Strategy Designer.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey
from app.modules.identity import service as identity_service
from app.modules.strategies import (
    audience, dashboard, schemas, service, simulation, versions,
)

router = APIRouter(prefix="/strategies", tags=["strategies"])

_can_view = require(PermKey.DUNNING_SUMMARY, "view")
_can_edit = require(PermKey.DUNNING_DESIGNER, "edit")


# --------------------------------------------------------------------------
# Target audience sizing for the designer. Read-only counts over the live book.
# --------------------------------------------------------------------------
@router.get("/audience/options", response_model=schemas.AudienceOptions)
async def audience_options(
    db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.AudienceOptions:
    return await audience.options(db)


@router.get("/audience/estimate", response_model=schemas.AudienceEstimate)
async def audience_estimate(
    db: DbSession,
    segment: str | None = None,
    agingBucket: str | None = None,
    riskMin: float | None = None,
    riskMax: float | None = None,
    contactability: str | None = None,
    balanceBand: str | None = None,
    creditClass: str | None = None,
    _: Principal = Depends(_can_view),
) -> schemas.AudienceEstimate:
    return await audience.estimate(
        db, segment=segment, aging_bucket=agingBucket, risk_min=riskMin,
        risk_max=riskMax, contactability=contactability,
        balance_band=balanceBand, credit_class=creditClass)


# --------------------------------------------------------------------------
# Performance dashboard. Read-only, and gated on the same view permission as
# the strategy list — anyone who may see a strategy may see how it is doing.
# --------------------------------------------------------------------------
@router.get("/dashboard/summary", response_model=schemas.StrategySummary)
async def dashboard_summary(
    db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.StrategySummary:
    return await dashboard.summary(db)


@router.get("/dashboard/performance", response_model=list[schemas.StrategyPerformance])
async def dashboard_performance(
    db: DbSession, _: Principal = Depends(_can_view)
) -> list[schemas.StrategyPerformance]:
    return await dashboard.strategies(db)


@router.get("/dashboard/channels", response_model=list[schemas.ChannelEconomics])
async def dashboard_channels(
    db: DbSession, _: Principal = Depends(_can_view)
) -> list[schemas.ChannelEconomics]:
    return await dashboard.channels(db)


@router.get("/dashboard/fatigue", response_model=list[schemas.FatiguePoint])
async def dashboard_fatigue(
    db: DbSession, _: Principal = Depends(_can_view)
) -> list[schemas.FatiguePoint]:
    return await dashboard.fatigue(db)


@router.get("/dashboard/coverage-gap", response_model=list[schemas.CoverageGap])
async def dashboard_coverage_gap(
    db: DbSession, _: Principal = Depends(_can_view)
) -> list[schemas.CoverageGap]:
    return await dashboard.coverage_gap(db)


@router.get("/dashboard/version-impact", response_model=list[schemas.VersionImpact])
async def dashboard_version_impact(
    db: DbSession, _: Principal = Depends(_can_view)
) -> list[schemas.VersionImpact]:
    return await dashboard.version_impact(db)


@router.get("/dashboard/instrumentation", response_model=schemas.Instrumentation)
async def dashboard_instrumentation(
    db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.Instrumentation:
    return await dashboard.instrumentation(db)


@router.get("", response_model=list[schemas.StrategyRow])
async def list_strategies(
    db: DbSession, _: Principal = Depends(_can_view)
) -> list[schemas.StrategyRow]:
    return await service.list_all(db)


@router.get("/{code}", response_model=schemas.StrategyRow)
async def get_strategy(
    code: str, db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.StrategyRow:
    return service.to_row(await service.get(db, code))


@router.post("", response_model=schemas.StrategyRow, status_code=status.HTTP_201_CREATED)
async def create_strategy(
    payload: schemas.StrategyCreate,
    db: DbSession,
    principal: Principal = Depends(_can_edit),
) -> schemas.StrategyRow:
    strategy = await service.create(db, payload, int(principal.id))
    await identity_service.record_audit(
        db,
        actor=principal.email,
        actor_id=principal.id,
        action="Created strategy",
        target=strategy.strategy_code,
    )
    return service.to_row(strategy)


@router.patch("/{code}", response_model=schemas.StrategyRow)
async def update_strategy(
    code: str,
    payload: schemas.StrategyUpdate,
    db: DbSession,
    principal: Principal = Depends(_can_edit),
) -> schemas.StrategyRow:
    strategy = await service.update(db, code, payload, int(principal.id))
    await identity_service.record_audit(
        db,
        actor=principal.email,
        actor_id=principal.id,
        action="Updated strategy",
        target=code,
    )
    return service.to_row(strategy)


@router.post("/{code}/activate", response_model=schemas.StrategyRow)
async def activate_strategy(
    code: str, db: DbSession, principal: Principal = Depends(_can_edit)
) -> schemas.StrategyRow:
    strategy = await service.set_active(db, code, True, int(principal.id))
    await identity_service.record_audit(
        db, actor=principal.email, actor_id=principal.id, action="Activated strategy", target=code
    )
    return service.to_row(strategy)


@router.post("/{code}/deactivate", response_model=schemas.StrategyRow)
async def deactivate_strategy(
    code: str, db: DbSession, principal: Principal = Depends(_can_edit)
) -> schemas.StrategyRow:
    strategy = await service.set_active(db, code, False, int(principal.id))
    await identity_service.record_audit(
        db,
        actor=principal.email,
        actor_id=principal.id,
        action="Deactivated strategy",
        target=code,
    )
    return service.to_row(strategy)


@router.delete("/{code}", response_model=schemas.ActionResult)
async def delete_strategy(
    code: str, db: DbSession, principal: Principal = Depends(_can_edit)
) -> schemas.ActionResult:
    await service.delete(db, code)
    await identity_service.record_audit(
        db, actor=principal.email, actor_id=principal.id, action="Deleted strategy", target=code
    )
    return schemas.ActionResult(ok=True, detail="Strategy deleted.")


# ==========================================================================
# Version history — what the strategy used to be, and getting it back
# ==========================================================================
@router.get("/{code}/versions", response_model=list[schemas.VersionRow])
async def list_versions(
    code: str, db: DbSession, _: Principal = Depends(_can_view)
) -> list[schemas.VersionRow]:
    return await versions.history(db, code)


@router.get("/{code}/versions/{version}", response_model=schemas.VersionDetail)
async def get_version(
    code: str, version: str, db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.VersionDetail:
    return await versions.snapshot(db, code, version)


@router.get("/{code}/versions/{version}/compare", response_model=schemas.VersionCompare)
async def compare_versions(
    code: str, version: str, db: DbSession, against: str | None = None,
    _: Principal = Depends(_can_view),
) -> schemas.VersionCompare:
    """Field-by-field differences against another version, or against what is live."""
    return await versions.compare(db, code, version, against)


@router.post("/{code}/versions/{version}/restore", response_model=schemas.RestoreResult)
async def restore_version(
    code: str, version: str, db: DbSession, principal: Principal = Depends(_can_edit)
) -> schemas.RestoreResult:
    """Replace the live definition with this older version of it."""
    strategy, new_version, changed = await service.restore_version(
        db, code, version, int(principal.id))
    await identity_service.record_audit(
        db, actor=principal.email, actor_id=principal.id,
        action=f"Restored strategy version {version}",
        target=f"{code} → {new_version}")
    return schemas.RestoreResult(
        version=new_version, restoredFrom=version, changed=changed,
        detail=(f"{strategy.name} is back to its {version} definition, filed as {new_version}."
                if changed else f"{version} is identical to what is live; nothing changed."))


@router.post("/{code}/versions/{version}/clone", response_model=schemas.StrategyRow,
             status_code=status.HTTP_201_CREATED)
async def clone_version(
    code: str, version: str, payload: schemas.CloneRequest, db: DbSession,
    principal: Principal = Depends(_can_edit),
) -> schemas.StrategyRow:
    """Start a new strategy from this version, leaving the original alone."""
    clone = await service.clone_from_version(db, code, version, payload, int(principal.id))
    await identity_service.record_audit(
        db, actor=principal.email, actor_id=principal.id,
        action=f"Created strategy from {code} {version}", target=clone.strategy_code)
    return service.to_row(clone)


# ==========================================================================
# Simulation — run a strategy against the book before publishing it
# ==========================================================================
@router.get("/simulation/assumptions", response_model=schemas.SimAssumptions)
async def simulation_assumptions(
    db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.SimAssumptions:
    """The rates a run would use, and whether each is measured or assumed."""
    return await simulation.assumptions(db)


@router.get("/simulation/runs", response_model=list[schemas.SimulationRunRow])
async def simulation_runs(
    db: DbSession, code: str | None = None, limit: int = 20,
    _: Principal = Depends(_can_view),
) -> list[schemas.SimulationRunRow]:
    return await simulation.history(db, code, limit)


@router.get("/simulation/runs/{run_id}", response_model=schemas.SimulationResult)
async def simulation_run(
    run_id: int, db: DbSession, _: Principal = Depends(_can_view),
) -> schemas.SimulationResult:
    return await simulation.run_detail(db, run_id)


@router.post("/{code}/simulate", response_model=schemas.SimulationResult)
async def simulate_strategy(
    code: str, payload: schemas.SimulationRequest, db: DbSession,
    principal: Principal = Depends(_can_view),
) -> schemas.SimulationResult:
    """Put the selected population through this strategy's workflow."""
    return await simulation.simulate(db, code, payload, int(principal.id))
