"""Baseline — the schema is owned by database_setup.sql.

The identity tables (administration.role / permission / app_user /
user_session / audit_log) are created by ``database_setup.sql`` at the repo
root, then adjusted by the scripts in ``migrations/sql/``. Alembic tracks the
revision so future application-owned changes have somewhere to hang, but it
does not create or drop these tables.

Revision ID: 0001
"""

from __future__ import annotations

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """No-op: see module docstring."""


def downgrade() -> None:
    """No-op: see module docstring."""
