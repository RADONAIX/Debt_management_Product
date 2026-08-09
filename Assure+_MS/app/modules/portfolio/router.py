"""Portfolio Dashboard routes: /portfolio — the application-wide overview."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey
from app.modules.portfolio import schemas, service

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

_can_view = require(PermKey.PORTFOLIO_DASHBOARD, "view")


@router.get("/overview", response_model=schemas.PortfolioOverview)
async def overview(db: DbSession, _: Principal = Depends(_can_view)) -> schemas.PortfolioOverview:
    """Everything the landing screen needs, in one read."""
    return await service.overview(db)
