"""Strategy CRUD + lifecycle (activate / deactivate).

The UI addresses a strategy by its ``strategy_code``; the surrogate bigint never
leaves this module. Status vocabulary is translated here: the table stores
DRAFT/ACTIVE/PAUSED/ARCHIVED, the UI shows Draft/Active/Paused/Archived.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.modules.identity.service import master_data
from app.modules.strategies import schemas, versions
from app.modules.strategies.models import Strategy


def _status_api(value: str) -> str:
    return value.capitalize()


def _status_db(value: str | None) -> str | None:
    if value is None:
        return None
    upper = value.strip().upper()
    if upper not in {s.upper() for s in schemas.STATUSES}:
        raise ValidationFailedError(f"Unknown status '{value}'.")
    return upper


def _aging_one(value: str) -> str:
    """Accept what the library displays ("0-30 days") as well as the raw bucket."""
    cleaned = value.strip().replace(" days", "").replace("days", "").strip()
    if cleaned == "0-30":
        return "1-30"
    if cleaned in schemas.AGING_BUCKETS:
        return cleaned
    raise ValidationFailedError(
        f"Aging must be one of {', '.join(schemas.AGING_BUCKETS)} (got '{value}')."
    )


def _list_of(
    values: list[str] | None, allowed: tuple[str, ...], what: str, coerce=None
) -> list[str] | None:
    """Validate a multi-select against its vocabulary, de-duplicated and ordered."""
    if values is None:
        return None
    cleaned: list[str] = []
    for raw in values:
        if not raw or not raw.strip():
            continue
        item = coerce(raw) if coerce else _one_of(raw, allowed, what)
        if item and item not in cleaned:
            cleaned.append(item)
    return cleaned


def _aging_db(values: list[str] | None) -> list[str] | None:
    return _list_of(values, schemas.AGING_BUCKETS, "Aging", coerce=_aging_one)


def _risk_db(values: list[str] | None) -> list[str] | None:
    return _list_of(values, schemas.RISK_LEVELS, "Risk")


def _one_of(value: str | None, allowed: tuple[str, ...], what: str) -> str | None:
    """Case-insensitive membership check against a small closed vocabulary."""
    if not value:
        return None
    match = next((a for a in allowed if a.lower() == value.strip().lower()), None)
    if match is None:
        raise ValidationFailedError(f"{what} must be one of {', '.join(allowed)}.")
    return match


def _num(value: float | None, what: str) -> float | None:
    if value is None:
        return None
    if value < 0:
        raise ValidationFailedError(f"{what} cannot be negative.")
    return value


def _f(value) -> float | None:
    return float(value) if value is not None else None


def to_row(s: Strategy) -> schemas.StrategyRow:
    return schemas.StrategyRow(
        id=s.strategy_code,
        name=s.name,
        description=s.description,
        segment=s.segment_code,
        aging=s.aging_bucket or [],
        riskLevel=s.risk_level or [],
        status=_status_api(s.status),
        version=s.current_version,
        workflow=s.workflow_json or {},
        targetAudience=s.target_audience or {},
        abTest=s.ab_test_config or {},
        settings=s.settings or {},
        uplift=_f(s.uplift_pct),
        behaviour=s.behaviour_type or [],
        emotion=s.emotion_type or [],
        minIncome=_f(s.minimum_income),
        maxIncome=_f(s.maximum_income),
        minLoan=_f(s.minimum_loan),
        maxLoan=_f(s.maximum_loan),
        successRate=_f(s.success_rate),
        averageRecovery=_f(s.average_collection),
        averageTurns=_f(s.average_turns),
        # Failure is the complement of success — derived so the two can't drift.
        failureRate=(100 - float(s.success_rate)) if s.success_rate is not None else None,
        isDefault=s.is_default,
        activatedAt=s.activated_at,
        createdAt=s.created_at,
        updatedAt=s.updated_at,
    )


async def _ensure_segment(db: AsyncSession, code: str | None) -> str | None:
    """segment_code is FK'd to master_data — register unknown values."""
    if not code or not code.strip():
        return None
    code = code.strip()[:60]
    found = (
        await db.execute(
            select(master_data.c.id).where(
                master_data.c.category == "SEGMENT", master_data.c.code == code
            )
        )
    ).first()
    if found is None:
        await db.execute(
            master_data.insert().values(
                category="SEGMENT", code=code, label=code, sort_order=200
            )
        )
    return code


async def get(db: AsyncSession, code: str) -> Strategy:
    strategy = (
        await db.execute(select(Strategy).where(Strategy.strategy_code == code))
    ).scalar_one_or_none()
    if strategy is None:
        raise NotFoundError(f"Strategy '{code}' does not exist.")
    return strategy


async def list_all(db: AsyncSession) -> list[schemas.StrategyRow]:
    rows = (
        (await db.execute(select(Strategy).order_by(Strategy.updated_at.desc()))).scalars().all()
    )
    return [to_row(s) for s in rows]


async def _next_code(db: AsyncSession, name: str) -> str:
    """STR-007 style codes, continuing the seeded sequence."""
    codes = [
        c for (c,) in (await db.execute(select(Strategy.strategy_code))).all()
    ]
    numbers = [int(m.group(1)) for c in codes if (m := re.fullmatch(r"STR-(\d+)", c))]
    return f"STR-{max(numbers, default=0) + 1:03d}"


async def create(db: AsyncSession, payload: schemas.StrategyCreate, actor_id: int) -> Strategy:
    code = (payload.id or await _next_code(db, payload.name)).strip()[:40]
    exists = (
        await db.execute(select(Strategy).where(Strategy.strategy_code == code))
    ).scalar_one_or_none()
    if exists:
        raise ConflictError(f"A strategy with code '{code}' already exists.")
    status = _status_db(payload.status) or "DRAFT"
    strategy = Strategy(
        strategy_code=code,
        name=payload.name,
        description=payload.description,
        segment_code=await _ensure_segment(db, payload.segment),
        aging_bucket=_aging_db(payload.aging),
        risk_level=_risk_db(payload.riskLevel),
        status=status,
        current_version="v1.0",
        workflow_json=payload.workflow or {"nodes": [], "edges": []},
        target_audience=payload.targetAudience or {},
        ab_test_config=payload.abTest or {},
        settings=payload.settings or {},
        behaviour_type=_list_of(payload.behaviour, schemas.BEHAVIOUR_TYPES, "Behaviour"),
        emotion_type=_list_of(payload.emotion, schemas.EMOTION_TYPES, "Emotion"),
        minimum_income=_num(payload.minIncome, "Minimum income"),
        maximum_income=_num(payload.maxIncome, "Maximum income"),
        minimum_loan=_num(payload.minLoan, "Minimum loan"),
        maximum_loan=_num(payload.maxLoan, "Maximum loan"),
        success_rate=_num(payload.successRate, "Success rate"),
        average_collection=_num(payload.averageRecovery, "Average recovery"),
        average_turns=_num(payload.averageTurns, "Average negotiation time"),
        activated_at=datetime.now(UTC) if status == "ACTIVE" else None,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(strategy)
    await db.flush()
    await versions.baseline(db, strategy, actor_id)
    await db.refresh(strategy)
    return strategy


async def update(
    db: AsyncSession, code: str, payload: schemas.StrategyUpdate, actor_id: int
) -> Strategy:
    strategy = await get(db, code)
    # What the strategy is now, so the change can be filed as a version.
    before = versions.snapshot_of(strategy)
    if payload.name is not None:
        strategy.name = payload.name
    if payload.description is not None:
        strategy.description = payload.description
    if payload.segment is not None:
        strategy.segment_code = await _ensure_segment(db, payload.segment)
    if payload.aging is not None:
        strategy.aging_bucket = _aging_db(payload.aging)
    if payload.riskLevel is not None:
        strategy.risk_level = _risk_db(payload.riskLevel)
    if payload.status is not None:
        strategy.status = _status_db(payload.status)
        if strategy.status == "ACTIVE" and strategy.activated_at is None:
            strategy.activated_at = datetime.now(UTC)
    if payload.version is not None:
        strategy.current_version = payload.version
    if payload.behaviour is not None:
        strategy.behaviour_type = _list_of(payload.behaviour, schemas.BEHAVIOUR_TYPES, "Behaviour")
    if payload.emotion is not None:
        strategy.emotion_type = _list_of(payload.emotion, schemas.EMOTION_TYPES, "Emotion")
    if payload.minIncome is not None:
        strategy.minimum_income = _num(payload.minIncome, "Minimum income")
    if payload.maxIncome is not None:
        strategy.maximum_income = _num(payload.maxIncome, "Maximum income")
    if payload.minLoan is not None:
        strategy.minimum_loan = _num(payload.minLoan, "Minimum loan")
    if payload.maxLoan is not None:
        strategy.maximum_loan = _num(payload.maxLoan, "Maximum loan")
    if payload.successRate is not None:
        strategy.success_rate = _num(payload.successRate, "Success rate")
    if payload.averageRecovery is not None:
        strategy.average_collection = _num(payload.averageRecovery, "Average recovery")
    if payload.averageTurns is not None:
        strategy.average_turns = _num(payload.averageTurns, "Average negotiation time")
    if payload.workflow is not None:
        strategy.workflow_json = payload.workflow
    if payload.targetAudience is not None:
        strategy.target_audience = payload.targetAudience
    if payload.abTest is not None:
        strategy.ab_test_config = payload.abTest
    if payload.settings is not None:
        strategy.settings = payload.settings
    strategy.updated_by = actor_id
    # An explicit version in the payload is honoured; otherwise the version
    # history assigns the next number itself.
    if payload.version is None:
        await versions.record(db, strategy, before=before, actor_id=actor_id,
                              summary=payload.changeSummary)
    await db.flush()
    await db.refresh(strategy)
    return strategy


async def set_active(db: AsyncSession, code: str, active: bool, actor_id: int) -> Strategy:
    """Activate a strategy, or pause a running one."""
    strategy = await get(db, code)
    strategy.status = "ACTIVE" if active else "PAUSED"
    if active and strategy.activated_at is None:
        strategy.activated_at = datetime.now(UTC)
    strategy.updated_by = actor_id
    await db.flush()
    await db.refresh(strategy)
    return strategy


async def delete(db: AsyncSession, code: str) -> None:
    strategy = await get(db, code)
    # Versions cascade; anything else pointing at the strategy blocks the delete.
    await db.delete(strategy)
    await db.flush()


async def counts_by_strategy(db: AsyncSession) -> dict[str, int]:
    """How many accounts each strategy is currently driving."""
    from sqlalchemy import text

    rows = (
        await db.execute(
            text(
                "SELECT s.strategy_code, count(c.id) "
                "FROM strategy s LEFT JOIN debt_case c ON c.strategy_id = s.id "
                "GROUP BY s.strategy_code"
            )
        )
    ).all()
    return {code: count for code, count in rows}


async def clone_from_version(
    db: AsyncSession, code: str, version: str, payload: schemas.CloneRequest, actor_id: int
) -> Strategy:
    """Start a new strategy from an old version of an existing one.

    The source is left exactly as it is — this is a branch, not a rollback. The
    copy always begins as a Draft: an old definition brought back under a new
    name has not been reviewed by anyone yet.
    """
    source = await get(db, code)
    snap = (await versions.snapshot(db, code, version)).snapshot
    if not snap:
        raise ValidationFailedError(f"Version {version} holds no definition to copy.")

    new_code = (payload.id or await _next_code(db, payload.name)).strip()[:40]
    if (await db.execute(
            select(Strategy).where(Strategy.strategy_code == new_code))).scalar_one_or_none():
        raise ConflictError(f"A strategy with code '{new_code}' already exists.")

    clone = Strategy(
        strategy_code=new_code,
        name=payload.name,
        description=payload.description
        or f"Started from {source.name} {version}.",
        segment_code=snap.get("segment_code"),
        aging_bucket=snap.get("aging_bucket"),
        risk_level=snap.get("risk_level"),
        status="DRAFT",
        current_version="v1.0",
        workflow_json=snap.get("workflow_json") or {"nodes": [], "edges": []},
        target_audience=snap.get("target_audience") or {},
        ab_test_config=snap.get("ab_test_config") or {},
        settings=snap.get("settings") or {},
        behaviour_type=snap.get("behaviour_type"),
        emotion_type=snap.get("emotion_type"),
        minimum_income=snap.get("minimum_income"),
        maximum_income=snap.get("maximum_income"),
        minimum_loan=snap.get("minimum_loan"),
        maximum_loan=snap.get("maximum_loan"),
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(clone)
    await db.flush()
    await versions._write(
        db, clone, snap=versions.snapshot_of(clone), kind="CLONE", changed=[],
        restored_from=version, actor_id=actor_id,
        summary=f"Copied from {source.strategy_code} {version}.")
    await db.refresh(clone)
    return clone


async def restore_version(
    db: AsyncSession, code: str, version: str, actor_id: int
) -> tuple[Strategy, str, list[str]]:
    """Replace the live definition with an older version of itself."""
    strategy = await get(db, code)
    new_version, changed = await versions.restore(db, strategy, version, actor_id)
    await db.refresh(strategy)
    return strategy, new_version, changed
