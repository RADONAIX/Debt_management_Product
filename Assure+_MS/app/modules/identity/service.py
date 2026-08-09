"""Identity business logic: authentication, sessions, users, roles, audit.

Backed by the ``administration`` schema from ``database_setup.sql``. Two
translations happen here and nowhere else:

  * **Identifiers** — the API speaks in stable business keys (``role.code``,
    the user's bigint id as a string); the tables use surrogate bigints.
  * **Status vocabulary** — the database uses ``ACTIVE``/``INACTIVE``/
    ``LOCKED``/``PENDING``; the UI uses ``Active``/``Disabled``.

Permissions live in ``role.permissions`` as ``{code: {view, edit}}``;
``administration.permission`` is the catalog of valid keys.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import (
    BigInteger,
    Column,
    Integer,
    MetaData,
    String,
    Table,
    func,
    select,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AuthenticationError, ConflictError, NotFoundError
from app.core.logging import client_ip_ctx, user_agent_ctx
from app.core.rbac import PermissionMap
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from app.modules.identity import schemas
from app.modules.identity.models import AuditLog, Permission, Role, User, UserSession

# Departments are validated against the shared lookup table; a full ORM model
# for it belongs to whichever module owns master data, so this is a minimal
# handle covering only the columns this service writes.
master_data = Table(
    "master_data",
    MetaData(),
    Column("id", BigInteger, primary_key=True),
    Column("category", String(40)),
    Column("code", String(60)),
    Column("label", String(120)),
    Column("sort_order", Integer),
    schema="administration",
)


# --- Vocabulary translation ------------------------------------------------
_USER_STATUS_TO_API = {
    "ACTIVE": "Active",
    "INACTIVE": "Disabled",
    "LOCKED": "Locked",
    "PENDING": "Pending",
}
_USER_STATUS_TO_DB = {
    "active": "ACTIVE",
    "disabled": "INACTIVE",
    "inactive": "INACTIVE",
    "locked": "LOCKED",
    "pending": "PENDING",
}


def _user_status_api(value: str) -> str:
    return _USER_STATUS_TO_API.get(value.upper(), value.title())


def _user_status_db(value: str) -> str:
    return _USER_STATUS_TO_DB.get(value.strip().lower(), "INACTIVE")


def _role_status_api(value: str) -> str:
    return "Active" if value.upper() == "ACTIVE" else "Inactive"


def _role_status_db(value: str) -> str:
    return "ACTIVE" if value.strip().lower() == "active" else "INACTIVE"


def _initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _role_code(name: str) -> str:
    """Derive a stable role code from a display name ("Risk Lead" -> RISK_LEAD)."""
    cleaned = "".join(ch if ch.isalnum() else "_" for ch in name).strip("_")
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned.upper()[:40] or "ROLE"


def _hash_jti(jti: str) -> str:
    """user_session.token_hash never stores the raw token id."""
    return hashlib.sha256(jti.encode()).hexdigest()


def _as_id(value: str | int, what: str = "Record") -> int:
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise NotFoundError(f"{what} not found.") from exc


# --- Permission resolution -------------------------------------------------
async def permissions_for_role_id(db: AsyncSession, role_id: int) -> PermissionMap:
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
    return dict(role.permissions or {}) if role else {}


async def permissions_for_user(db: AsyncSession, user: User) -> PermissionMap:
    """A user's effective matrix — the one carried by their role."""
    return dict(user.role.permissions or {}) if user.role else {}


async def _permission_codes(db: AsyncSession) -> set[str]:
    """The capability keys this platform knows about."""
    return {code for (code,) in (await db.execute(select(Permission.code))).all()}


# --- Mappers ---------------------------------------------------------------
def to_auth_user(user: User) -> schemas.AuthUser:
    return schemas.AuthUser(
        id=str(user.id),
        name=user.full_name,
        email=user.email,
        role=user.role.code,
        roleLabel=user.role.name,
        department=user.department_code,
        avatar=_initials(user.full_name),
        status=_user_status_api(user.status),
        lastLogin=user.last_login_at,
        mustResetPassword=user.must_change_password,
    )


def to_user_row(user: User) -> schemas.UserRow:
    return schemas.UserRow(
        id=str(user.id),
        fullName=user.full_name,
        email=user.email,
        phone=user.phone,
        department=user.department_code,
        role=user.role.code,
        roleLabel=user.role.name,
        status=_user_status_api(user.status),
        avatar=_initials(user.full_name),
        lastLogin=user.last_login_at,
        createdAt=user.created_at,
    )


def to_role_row(role: Role, permissions: PermissionMap, user_count: int = 0) -> schemas.RoleRow:
    return schemas.RoleRow(
        id=role.code,
        name=role.name,
        description=role.description or "",
        status=_role_status_api(role.status),
        permissions=permissions,
        isSystem=role.is_system,
        userCount=user_count,
        createdAt=role.created_at,
        updatedAt=role.updated_at,
    )


# --- Audit -----------------------------------------------------------------
async def record_audit(
    db: AsyncSession,
    *,
    actor: str,
    action: str,
    target: str | int | None = None,
    actor_id: str | int | None = None,
    meta: dict | None = None,
) -> None:
    """Write an audit entry, enriched with the request's IP / user-agent."""
    db.add(
        AuditLog(
            user_id=int(actor_id) if actor_id is not None else None,
            user_name=actor,
            action=action,
            entity_type="identity",
            entity_id=str(target) if target is not None else None,
            new_value=meta or None,
            ip_address=client_ip_ctx.get(),
            user_agent=(user_agent_ctx.get() or None or "")[:255] or None,
            created_at=datetime.now(UTC),
        )
    )
    await db.flush()


# --- Auth: tokens & sessions ----------------------------------------------
def _tokens_for_session(user: User, session_id: int, refresh_jti: str) -> tuple[str, str]:
    access = create_access_token(
        str(user.id),
        extra_claims={"email": user.email, "role": user.role.code, "sid": str(session_id)},
    )
    refresh = create_refresh_token(str(user.id), session_id=str(session_id), jti=refresh_jti)
    return access, refresh


async def _issue_session(
    db: AsyncSession, user: User, *, user_agent: str | None, ip: str | None
) -> tuple[str, str]:
    now = datetime.now(UTC)
    refresh_jti = uuid.uuid4().hex
    session = UserSession(
        user_id=user.id,
        token_hash=_hash_jti(refresh_jti),
        issued_at=now,
        expires_at=now + timedelta(minutes=settings.refresh_token_expire_minutes),
        user_agent=user_agent[:255] if user_agent else None,
        ip_address=ip,
    )
    db.add(session)
    await db.flush()
    return _tokens_for_session(user, session.id, refresh_jti)


async def authenticate(
    db: AsyncSession,
    email: str,
    password: str,
    *,
    user_agent: str | None = None,
    ip: str | None = None,
) -> tuple[str, str, User]:
    """Verify credentials (with lockout) and open a session."""
    now = datetime.now(UTC)
    user = (
        await db.execute(select(User).where(func.lower(User.email) == email.lower()))
    ).scalar_one_or_none()

    # Generic message so we don't reveal which emails exist.
    if user is None:
        raise AuthenticationError("Invalid email or password.")
    if user.locked_until and user.locked_until > now:
        raise AuthenticationError(
            "Account temporarily locked due to failed login attempts. Try again later."
        )
    if not user.is_active:
        raise AuthenticationError("Your account has been disabled. Please contact administrator.")

    if not verify_password(password, user.password_hash or ""):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.max_failed_logins:
            user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            user.failed_login_attempts = 0
            # Commit so the lockout persists despite the error raised next.
            await db.commit()
            raise AuthenticationError(
                "Too many failed attempts. Account locked for "
                f"{settings.lockout_minutes} minutes."
            )
        await db.commit()
        raise AuthenticationError("Invalid email or password.")

    # Success — reset lockout state and open a session.
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    if ip:
        user.last_login_ip = ip
    # Transparently upgrade the seeded bcrypt hashes to Argon2id.
    if needs_rehash(user.password_hash or ""):
        user.password_hash = hash_password(password)
    access, refresh = await _issue_session(db, user, user_agent=user_agent, ip=ip)
    return access, refresh, user


async def refresh_session(
    db: AsyncSession,
    refresh_token: str,
    *,
    user_agent: str | None = None,
    ip: str | None = None,
) -> tuple[str, str]:
    """Validate a refresh token and rotate it, with reuse detection."""
    try:
        payload = decode_token(refresh_token)
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Invalid or expired refresh token.") from exc
    if payload.get("type") != "refresh":
        raise AuthenticationError("Not a refresh token.")

    jti = payload.get("jti") or ""
    session = (
        await db.execute(
            select(UserSession).where(UserSession.id == _as_id(payload.get("sid", 0), "Session"))
        )
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if session is None or session.revoked_at is not None or session.expires_at <= now:
        raise AuthenticationError("Session is no longer valid. Please sign in again.")
    if session.token_hash != _hash_jti(jti):
        # A previously-rotated token was replayed → likely theft. Kill the session.
        session.revoked_at = now
        await db.commit()
        raise AuthenticationError("Refresh token reuse detected. Session revoked.")

    user = (
        await db.execute(select(User).where(User.id == session.user_id))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        session.revoked_at = now
        await db.commit()
        raise AuthenticationError("Account is no longer active.")

    new_jti = uuid.uuid4().hex
    session.token_hash = _hash_jti(new_jti)
    session.expires_at = now + timedelta(minutes=settings.refresh_token_expire_minutes)
    if user_agent:
        session.user_agent = user_agent[:255]
    if ip:
        session.ip_address = ip
    await db.flush()
    return _tokens_for_session(user, session.id, new_jti)


async def revoke_session(db: AsyncSession, session_id: str | int | None) -> None:
    if not session_id:
        return
    session = (
        await db.execute(select(UserSession).where(UserSession.id == _as_id(session_id, "Session")))
    ).scalar_one_or_none()
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)
        await db.flush()


async def _revoke_user_sessions(db: AsyncSession, user_id: int) -> None:
    now = datetime.now(UTC)
    sessions = (
        (
            await db.execute(
                select(UserSession).where(
                    UserSession.user_id == user_id, UserSession.revoked_at.is_(None)
                )
            )
        )
        .scalars()
        .all()
    )
    for session in sessions:
        session.revoked_at = now


async def change_password(
    db: AsyncSession, user_id: str | int, current_password: str, new_password: str
) -> User:
    user = await get_user(db, user_id)
    if not verify_password(current_password, user.password_hash or ""):
        raise AuthenticationError("Current password is incorrect.")
    user.password_hash = hash_password(new_password)
    user.password_changed_at = datetime.now(UTC)
    user.must_change_password = False
    await db.flush()
    await db.refresh(user)
    return user


async def get_user(db: AsyncSession, user_id: str | int) -> User:
    user = (
        await db.execute(select(User).where(User.id == _as_id(user_id, "User")))
    ).scalar_one_or_none()
    if user is None:
        raise NotFoundError("User not found.")
    return user


async def _require_role(db: AsyncSession, role_code: str) -> Role:
    role = (
        await db.execute(select(Role).where(Role.code == role_code))
    ).scalar_one_or_none()
    if role is None:
        raise NotFoundError(f"Role '{role_code}' does not exist.")
    return role


async def _ensure_department(db: AsyncSession, code: str | None) -> str | None:
    """``app_user.department_code`` is FK'd to master_data — register new values.

    The admin screen offers a free-text department, so an unknown value becomes
    a new DEPARTMENT master-data row rather than a foreign-key error.
    """
    if not code or not code.strip():
        return None
    code = code.strip()[:60]
    found = (
        await db.execute(
            select(master_data.c.id).where(
                master_data.c.category == "DEPARTMENT", master_data.c.code == code
            )
        )
    ).first()
    if found is None:
        await db.execute(
            master_data.insert().values(
                category="DEPARTMENT", code=code, label=code, sort_order=200
            )
        )
    return code


# --- Users (admin) ---------------------------------------------------------
async def list_users(db: AsyncSession, *, limit: int, offset: int) -> list[schemas.UserRow]:
    rows = (
        (
            await db.execute(
                select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return [to_user_row(u) for u in rows]


async def create_user(db: AsyncSession, payload: schemas.UserCreate) -> User:
    role = await _require_role(db, payload.role)
    exists = (
        await db.execute(select(User).where(func.lower(User.email) == payload.email.lower()))
    ).scalar_one_or_none()
    if exists:
        raise ConflictError("A user with this email already exists.")
    user = User(
        full_name=payload.fullName,
        email=payload.email,
        phone=payload.phone,
        department_code=await _ensure_department(db, payload.department),
        role_id=role.id,
        status=_user_status_db(payload.status),
        password_hash=hash_password(payload.password),
        must_change_password=payload.mustResetPassword,
        password_changed_at=datetime.now(UTC),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user_id: str | int, payload: schemas.UserUpdate) -> User:
    user = await get_user(db, user_id)
    if payload.role and payload.role != user.role.code:
        user.role_id = (await _require_role(db, payload.role)).id
    if payload.fullName is not None:
        user.full_name = payload.fullName
    if payload.email is not None:
        user.email = payload.email
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.department is not None:
        user.department_code = await _ensure_department(db, payload.department)
    if payload.status is not None:
        user.status = _user_status_db(payload.status)
        # Deactivating a user revokes their active sessions immediately.
        if user.status != "ACTIVE":
            await _revoke_user_sessions(db, user.id)
    if payload.password:
        user.password_hash = hash_password(payload.password)
        user.password_changed_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user_id: str | int) -> User:
    """Remove an account. Sessions and permission overrides cascade.

    ``app_user`` has no soft-delete column, so this is a real delete. Accounts
    that other records point at (an agent's cases, for instance) cannot be
    removed — deactivate those instead.
    """
    user = await get_user(db, user_id)
    await _revoke_user_sessions(db, user.id)
    await db.flush()
    try:
        await db.delete(user)
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(
            "This account is referenced by other records and cannot be deleted. "
            "Set its status to Disabled instead."
        ) from exc
    return user


# --- Roles (admin) ---------------------------------------------------------
async def list_permissions(db: AsyncSession) -> list[schemas.PermissionInfo]:
    rows = (
        (await db.execute(select(Permission).order_by(Permission.sort_order, Permission.id)))
        .scalars()
        .all()
    )
    return [
        schemas.PermissionInfo(key=p.code, label=p.name, path=p.module_group) for p in rows
    ]


async def _role_user_counts(db: AsyncSession) -> dict[int, int]:
    rows = (
        await db.execute(select(User.role_id, func.count(User.id)).group_by(User.role_id))
    ).all()
    return {role_id: count for role_id, count in rows}


async def role_row(db: AsyncSession, role: Role) -> schemas.RoleRow:
    """A single role with its resolved matrix and current user count."""
    counts = await _role_user_counts(db)
    return to_role_row(role, await permissions_for_role_id(db, role.id), counts.get(role.id, 0))


async def list_roles(db: AsyncSession) -> list[schemas.RoleRow]:
    roles = (await db.execute(select(Role).order_by(Role.id))).scalars().all()
    counts = await _role_user_counts(db)
    return [
        to_role_row(r, await permissions_for_role_id(db, r.id), counts.get(r.id, 0))
        for r in roles
    ]


async def _set_role_permissions(
    db: AsyncSession, role: Role, permissions: PermissionMap
) -> None:
    """Store the submitted matrix, keeping only keys in the capability catalog.

    Checking Edit implies View, matching the Role Management screen.
    """
    known = await _permission_codes(db)
    cleaned: PermissionMap = {}
    for code, entry in (permissions or {}).items():
        if code not in known:
            continue  # not a capability this platform knows about — ignore
        edit = bool(entry.get("edit"))
        if bool(entry.get("view")) or edit:
            cleaned[code] = {"view": True, "edit": edit}
    role.permissions = cleaned
    await db.flush()


async def upsert_role(db: AsyncSession, payload: schemas.RoleUpsert) -> Role:
    code = payload.id or _role_code(payload.name)
    role = (await db.execute(select(Role).where(Role.code == code))).scalar_one_or_none()
    if role is None:
        role = Role(
            code=code,
            name=payload.name,
            description=payload.description,
            status=_role_status_db(payload.status),
            is_system=False,
        )
        db.add(role)
        await db.flush()
        # A new role starts with no access; the matrix is filled in afterwards.
        await _set_role_permissions(db, role, payload.permissions or {})
    else:
        role.name = payload.name
        role.description = payload.description
        role.status = _role_status_db(payload.status)
        if payload.permissions is not None:
            await _set_role_permissions(db, role, payload.permissions)
    await db.flush()
    await db.refresh(role)
    return role


async def update_role(db: AsyncSession, role_code: str, payload: schemas.RoleUpdate) -> Role:
    role = await _require_role(db, role_code)
    if payload.name is not None:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description
    if payload.status is not None:
        role.status = _role_status_db(payload.status)
    await db.flush()
    await db.refresh(role)
    return role


async def update_role_permissions(
    db: AsyncSession, role_code: str, permissions: PermissionMap
) -> Role:
    role = await _require_role(db, role_code)
    await _set_role_permissions(db, role, permissions)
    await db.refresh(role)
    return role


async def delete_role(db: AsyncSession, role_code: str) -> None:
    role = await _require_role(db, role_code)
    if role.is_system:
        raise ConflictError("System roles cannot be deleted.")
    assigned = (await _role_user_counts(db)).get(role.id, 0)
    if assigned:
        raise ConflictError(
            f"Cannot delete a role that still has {assigned} user(s) assigned."
        )
    await db.delete(role)
    await db.flush()
