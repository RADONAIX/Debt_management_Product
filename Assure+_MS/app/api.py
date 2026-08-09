"""Top-level API router aggregating every module under the API prefix."""

from __future__ import annotations

from fastapi import APIRouter

from app.modules.agent.router import router as agent_router
from app.modules.collection.router import router as collection_router
from app.modules.customers.router import companies_router
from app.modules.customers.router import router as customers_router
from app.modules.engagement.router import router as engagement_router
from app.modules.identity.router import router as identity_router
from app.modules.recovery.router import router as recovery_router
from app.modules.reports.router import router as reports_router
from app.modules.risk.router import router as risk_router
from app.modules.riskgrid.router import router as risk_grid_router
from app.modules.meta.router import router as meta_router
from app.modules.operations.router import router as operations_router
from app.modules.portfolio.router import router as portfolio_router
from app.modules.strategies.router import router as strategies_router

api_router = APIRouter()
api_router.include_router(meta_router)
api_router.include_router(identity_router)
api_router.include_router(strategies_router)
api_router.include_router(customers_router)
api_router.include_router(engagement_router)
api_router.include_router(companies_router)
api_router.include_router(risk_router)
api_router.include_router(risk_grid_router)
api_router.include_router(recovery_router)
api_router.include_router(reports_router)
api_router.include_router(agent_router)
api_router.include_router(collection_router)
api_router.include_router(portfolio_router)
api_router.include_router(operations_router)
