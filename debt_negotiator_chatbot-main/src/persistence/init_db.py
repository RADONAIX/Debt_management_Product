"""Create the ``chatbot`` schema and its tables.

    uv run python -m persistence.init_db

Run deliberately. The target database is shared with other systems, so this
prints exactly what it is about to touch and confirms afterwards that it
created nothing outside ``chatbot``.
"""

from __future__ import annotations

import sys

from sqlalchemy import text

from persistence.db import create_schema_and_tables, engine
from persistence.models import SCHEMA, Base


def main() -> int:
    with engine().connect() as connection:
        url = connection.engine.url
        print(f"target : {url.host}:{url.port}/{url.database} as {url.username}")

        before = {
            row[0]
            for row in connection.execute(
                text("select schema_name from information_schema.schemata")
            )
        }

    print(f"schema : {SCHEMA}")
    print(f"tables : {', '.join(sorted(t.name for t in Base.metadata.sorted_tables))}")
    print("\nExisting schemas, none of which will be touched:")
    print("  " + ", ".join(sorted(before - {SCHEMA})))

    create_schema_and_tables()

    with engine().connect() as connection:
        after = {
            row[0]
            for row in connection.execute(
                text("select schema_name from information_schema.schemata")
            )
        }
        created = connection.execute(
            text(
                "select table_name from information_schema.tables "
                "where table_schema = :s order by table_name"
            ),
            {"s": SCHEMA},
        ).fetchall()

    unexpected = (after - before) - {SCHEMA}
    if unexpected:
        print(f"\nUNEXPECTED schemas created: {sorted(unexpected)}", file=sys.stderr)
        return 1

    print(f"\nOK. {SCHEMA} now has {len(created)} tables:")
    for (name,) in created:
        print(f"  {SCHEMA}.{name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
