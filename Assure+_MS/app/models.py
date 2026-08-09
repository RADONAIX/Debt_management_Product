"""Aggregate import of all ORM models.

Importing this module ensures every table is registered on ``Base.metadata``
so Alembic autogenerate and ``create_all`` see the full schema.
"""

from app.core.database import Base
from app.modules.identity.models import AuditLog, Role, User, UserSession
from app.modules.customers.models import Customer
from app.modules.risk.models import RiskScoreBand, RiskScoreDefinition
from app.modules.strategies.models import Strategy

__all__ = [
    "Base",
    "Role",
    "User",
    "UserSession",
    "AuditLog",
    "Strategy",
    "Customer",
    "RiskScoreDefinition",
    "RiskScoreBand",
]
