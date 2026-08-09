"""Let a collector see their own performance.

The Agent Performance screen was admin-only, which made no sense once it became
a collector's own dashboard: the person whose figures they are could not open
them. The server already decides whose desk a request may see — an agent always
gets their own — so granting view here exposes nobody else's numbers.
"""

from __future__ import annotations

import asyncio
import json

from sqlalchemy import text

from app.core.database import SessionFactory

KEY = "agentPerformance"
# Everyone who works or supervises collections.
ROLES = ("AGENT", "SUPERVISOR", "COLLECTION_MANAGER", "LEGAL_OFFICER")


async def main() -> None:
    async with SessionFactory() as db:
        for code in ROLES:
            row = (await db.execute(text(
                "SELECT id, permissions FROM administration.role WHERE code = :c"),
                {"c": code})).mappings().first()
            if row is None:
                continue
            perms = dict(row["permissions"] or {})
            if perms.get(KEY, {}).get("view"):
                print(f"  {code:<20} already had it")
                continue
            perms[KEY] = {"view": True, "edit": False}
            await db.execute(text("""
                UPDATE administration.role SET permissions = CAST(:p AS jsonb), updated_at = now()
                WHERE id = :i"""), {"i": row["id"], "p": json.dumps(perms)})
            print(f"  {code:<20} granted view")
        await db.commit()

        rows = (await db.execute(text("""
            SELECT code, permissions -> :k AS p FROM administration.role
            WHERE permissions ? :k ORDER BY code"""), {"k": KEY})).all()
        print("\n  roles holding " + KEY + ":",
              ", ".join(f"{c} {'view+edit' if p.get('edit') else 'view'}" for c, p in rows))


if __name__ == "__main__":
    asyncio.run(main())
