"""Health and readiness probes."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app import __version__
from app.core.config import settings
from app.core.database import engine

router = APIRouter(tags=["meta"])


class Health(BaseModel):
    status: str
    version: str
    environment: str


class Readiness(BaseModel):
    ready: bool
    checks: dict[str, bool]


@router.get("/health", response_model=Health)
async def health() -> Health:
    return Health(status="ok", version=__version__, environment=settings.environment)


@router.get("/health/ready", response_model=Readiness)
async def readiness() -> Readiness:
    checks: dict[str, bool] = {}
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["app_db"] = True
    except Exception:  # noqa: BLE001
        checks["app_db"] = False
    return Readiness(ready=checks["app_db"], checks=checks)
