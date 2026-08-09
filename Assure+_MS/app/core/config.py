"""Application configuration via pydantic-settings.

All settings are environment-driven (12-factor). See ``.env.example`` for the
full list. Trimmed to only what the Assure+ UI needs: auth/JWT, the app
database and CORS.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known-insecure defaults that MUST be overridden before running in production.
_INSECURE_JWT_SECRETS = {
    "change-me-in-production",
    "change-me-please-use-a-long-random-secret",
}
_INSECURE_ADMIN_PASSWORDS = {"ChangeMe!123"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- General -----------------------------------------------------------
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    project_name: str = "RADONaix Assure+ API"
    api_prefix: str = "/api"
    log_level: str = "INFO"
    log_json: bool = True

    # CORS — comma-separated origins, or "*" for all (dev only).
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8080"

    # --- Auth / JWT --------------------------------------------------------
    jwt_secret: str = Field(default="change-me-in-production", min_length=8)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12h
    refresh_token_expire_minutes: int = 60 * 24 * 14  # 14 days
    # Account lockout after too many failed logins.
    max_failed_logins: int = 5
    lockout_minutes: int = 15
    # First-run bootstrap admin (created by seed if no users exist).
    bootstrap_admin_email: str = "admin@radonaix.io"
    bootstrap_admin_password: str = "ChangeMe!123"
    # Per-IP rate limit on the login endpoint (brute-force speed bump).
    login_rate_limit_max: int = 10
    login_rate_limit_window_seconds: int = 60

    # --- App database (owns users/roles/sessions/audit) --------------------
    app_db_host: str = "localhost"
    app_db_port: int = 5432
    app_db_name: str = "Debt_management_db"
    app_db_user: str = "assure"
    app_db_password: str = "assure"
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_echo: bool = False

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def app_database_url(self) -> str:
        """Async SQLAlchemy URL for the app database."""
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                username=self.app_db_user,
                password=self.app_db_password,
                host=self.app_db_host,
                port=self.app_db_port,
                path=self.app_db_name,
            )
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def app_database_url_sync(self) -> str:
        """Sync URL (used by Alembic migrations)."""
        return str(
            PostgresDsn.build(
                scheme="postgresql+psycopg2",
                username=self.app_db_user,
                password=self.app_db_password,
                host=self.app_db_host,
                port=self.app_db_port,
                path=self.app_db_name,
            )
        )

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @model_validator(mode="after")
    def _enforce_production_secrets(self) -> Settings:
        """Fail fast if production is started with default/weak secrets."""
        if self.environment != "production":
            return self
        problems: list[str] = []
        if (
            self.jwt_secret in _INSECURE_JWT_SECRETS
            or len(self.jwt_secret) < 32
        ):
            problems.append(
                "JWT_SECRET must be a unique random value of at least 32 characters"
            )
        if self.bootstrap_admin_password in _INSECURE_ADMIN_PASSWORDS:
            problems.append("BOOTSTRAP_ADMIN_PASSWORD must be changed from the default")
        if problems:
            raise ValueError(
                "Refusing to start in production with insecure configuration: "
                + "; ".join(problems)
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
