# RADONaix Assure+ — Backend (Assure+_MS)

Minimal FastAPI **auth / identity** service for the Assure+ UI. It keeps the
same architecture as `RAFMS_MS` (modular monolith, async SQLAlchemy + Postgres,
Alembic migrations, JWT auth with Argon2id hashing, RBAC, structured logging,
Prometheus metrics, request-context middleware, per-IP login rate limiting) but
trimmed down to only what the Assure+ UI needs: **authentication + RBAC**.

## What's included

```
app/
├── main.py                 # app factory: CORS, rate-limit, request-context, metrics
├── api.py                  # mounts the meta + identity routers
├── models.py               # ORM aggregate (for Alembic)
├── seed.py                 # roles + bootstrap admin
├── core/                   # config, database, security (JWT/Argon2id), deps, errors,
│                           #   middleware, rbac, logging
└── modules/
    ├── identity/           # auth: login, refresh, logout, change-password, me, permissions
    └── meta/               # /health, /health/ready
```

Excluded vs RAFMS_MS: the analytics / assurance / reporting / exports / operations
/ rules business modules, ClickHouse / ra-Postgres / Airflow / Superset
integrations, Redis / Celery workers, and the SSO/OAuth flow.

## Auth API (consumed by the `assure-master` UI)

| Method | Path                     | Purpose                          |
|--------|--------------------------|----------------------------------|
| POST   | `/api/auth/login`        | Email + password → JWT pair      |
| POST   | `/api/auth/refresh`      | Rotate refresh token             |
| POST   | `/api/auth/logout`       | Revoke the current session       |
| POST   | `/api/auth/change-password` | Change own password           |
| GET    | `/api/auth/me`           | Current user profile             |
| GET    | `/api/auth/my-permissions` | RBAC matrix that drives the UI nav |
| GET    | `/api/health`            | Liveness                         |

### Administration API (User & Role Management)

| Method | Path                            | Permission              |
|--------|---------------------------------|-------------------------|
| GET    | `/api/users`                    | `userManagement:view`   |
| POST   | `/api/users`                    | `userManagement:edit`   |
| PATCH  | `/api/users/{id}`               | `userManagement:edit`   |
| DELETE | `/api/users/{id}`               | `userManagement:edit`   |
| GET    | `/api/roles`                    | `roleManagement:view`   |
| POST   | `/api/roles`                    | `roleManagement:edit`   |
| PATCH  | `/api/roles/{id}`               | `roleManagement:edit`   |
| PUT    | `/api/roles/{id}/permissions`   | `roleManagement:edit`   |
| DELETE | `/api/roles/{id}`               | `roleManagement:edit`   |
| GET    | `/api/permissions`              | `roleManagement:view`   |

The permission keys in `app/core/rbac.py` mirror the Assure+ UI navigation
(`assure-master/src/components/layout/navConfig.ts`).

## Quick start (local — no Docker)

The app database is `Debt_management_db` on the local Postgres 16 server
(`127.0.0.1:5432`, role `assure`), alongside the rest of the product schema.

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # adjust APP_DB_* if your Postgres differs
make start                  # migrate + seed + run on port 8008 (logs: api.log)
# or, with reload in the foreground:
make run
```

Port **8008**, not 8000: the RAFMS backend already owns 8000 on this machine.
The UI's dev proxy (`assure-master/vite.config.ts`) points at 8008 to match.

Default bootstrap login: **admin@radonaix.io** / **ChangeMe!123** (admin role,
full permissions). Change these before any real deployment.
