"""Database engine and session factory.

Connection details come from the environment (§12: no secrets in code).
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

from persistence.models import SCHEMA, Base


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = Field(alias="DATABASE_URL")
    sql_echo: bool = Field(default=False, alias="SQL_ECHO")


_engine: Engine | None = None
_factory: sessionmaker[OrmSession] | None = None


def engine() -> Engine:
    global _engine
    if _engine is None:
        settings = DatabaseSettings()
        _engine = create_engine(
            settings.database_url,
            echo=settings.sql_echo,
            pool_pre_ping=True,
        )
    return _engine


def session_factory() -> sessionmaker[OrmSession]:
    global _factory
    if _factory is None:
        _factory = sessionmaker(bind=engine(), expire_on_commit=False)
    return _factory


@contextmanager
def db_session() -> Iterator[OrmSession]:
    """A transactional scope. Rolls back on any exception."""
    session = session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def create_schema_and_tables() -> None:
    """Create the ``chatbot`` schema and its tables. Idempotent.

    Deliberately **not** called on API startup. The target database is shared
    with other systems; DDL is a decision someone makes on purpose, by running
    ``python -m persistence.init_db``, not a side effect of booting a web
    server. ``CREATE SCHEMA IF NOT EXISTS`` and ``create_all`` both no-op when
    the objects already exist, and neither can reach outside ``chatbot``.
    """
    with engine().begin() as connection:
        connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
    Base.metadata.create_all(engine())
