"""Idempotent reconciliation of the identity data the API depends on.

The schema and its reference data belong to ``database_setup.sql``; this only
makes sure the running service can function against it:

  1. every capability key the API enforces exists in ``administration.permission``
  2. the administrator roles' permission matrix covers every capability (so a
     new key never locks the admins out of their own screens)
  3. the bootstrap admin account exists and can sign in

Run with:  python -m app.seed        (safe to run repeatedly)
"""

from __future__ import annotations

import asyncio

from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import SessionFactory
from app.core.logging import configure_logging, get_logger
from app.core.rbac import PERMISSION_DEFAULTS, PermKey, RoleSlug
from app.core.security import hash_password
from app.modules.identity.models import Permission, Role, User

log = get_logger("seed")

# Roles that must always be able to reach every screen.
_FULL_ACCESS_ROLES = (RoleSlug.SUPER_ADMIN, RoleSlug.ADMIN)


async def seed() -> None:
    async with SessionFactory() as db:
        # --- 1. Capability catalog -----------------------------------------
        existing = {
            code for (code,) in (await db.execute(select(Permission.code))).all()
        }
        for index, key in enumerate(PermKey):
            if key.value in existing:
                continue
            label, group = PERMISSION_DEFAULTS[key]
            db.add(
                Permission(
                    code=key.value,
                    name=label,
                    module_group=group,
                    sort_order=100 + index,
                )
            )
            log.info("seed_permission", code=key.value)
        await db.flush()

        # --- 2. Administrator roles get everything -------------------------
        codes = [c for (c,) in (await db.execute(select(Permission.code))).all()]
        full_matrix = {code: {"view": True, "edit": True} for code in codes}
        for role_code in _FULL_ACCESS_ROLES:
            role = (
                await db.execute(select(Role).where(Role.code == role_code))
            ).scalar_one_or_none()
            if role is None:
                log.warning("seed_role_missing", role=role_code)
                continue
            if role.permissions != full_matrix:
                role.permissions = full_matrix
                log.info("seed_role_permissions", role=role_code, keys=len(full_matrix))
        await db.flush()

        # --- 3. Bootstrap administrator ------------------------------------
        admin_role = (
            await db.execute(select(Role).where(Role.code == RoleSlug.ADMIN))
        ).scalar_one_or_none()
        if admin_role is None:
            log.error("seed_admin_role_missing", role=RoleSlug.ADMIN)
        else:
            email = settings.bootstrap_admin_email
            exists = (
                await db.execute(select(User).where(func.lower(User.email) == email.lower()))
            ).scalar_one_or_none()
            if exists is None:
                db.add(
                    User(
                        full_name="Administrator",
                        email=email,
                        role_id=admin_role.id,
                        status="ACTIVE",
                        password_hash=hash_password(settings.bootstrap_admin_password),
                    )
                )
                log.info("seed_user", email=email)

        await db.commit()
    log.info("seed_complete")


def main() -> None:
    configure_logging(level=settings.log_level, json_logs=False)
    asyncio.run(seed())


if __name__ == "__main__":
    main()
