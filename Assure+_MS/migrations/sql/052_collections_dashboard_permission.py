"""Agent Dashboard becomes the Collections Dashboard.

The screen moved from Operations Management into Collection Management and
stopped being one agent's private view: it now shows the collections book for
whatever desk the signed-in user is allowed to see. So the permission moves
with it — `agentdashboard` is renamed `collectionsDashboard` wherever a role
holds it, keeping each role's existing view/edit flags.

It is also granted to the people who actually collect. The old screen was
admin-only, which made no sense for a dashboard that shows an agent their own
book; anyone who can open the Collections Workspace can now see it, scoped by
the same desk rule the workspace uses.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory

OLD, NEW = "agentdashboard", "collectionsDashboard"


async def main() -> None:
    async with SessionFactory() as db:
        roles = (await db.execute(text(
            "SELECT id, code, permissions FROM administration.role ORDER BY code"))).mappings().all()

        for r in roles:
            perms = dict(r["permissions"] or {})
            before = dict(perms)
            if OLD in perms:
                perms[NEW] = perms.pop(OLD)
            # Whoever works collections gets the dashboard for their own desk.
            if NEW not in perms and perms.get("collectionsWorkspace", {}).get("view"):
                perms[NEW] = {"view": True, "edit": False}
            if perms == before:
                continue
            await db.execute(text("""
                UPDATE administration.role SET permissions = CAST(:p AS jsonb), updated_at = now()
                WHERE id = :i"""), {"i": r["id"], "p": __import__("json").dumps(perms)})
            was = "renamed" if OLD in before else "granted"
            print(f"  {r['code']:<20} {NEW} {was}: {perms[NEW]}")

        await db.commit()

        left = (await db.execute(text(
            "SELECT count(*) FROM administration.role WHERE permissions ? :k"),
            {"k": OLD})).scalar_one()
        rows = (await db.execute(text("""
            SELECT code, permissions -> :k AS p FROM administration.role
            WHERE permissions ? :k ORDER BY code"""), {"k": NEW})).all()
        print(f"\n  roles still holding {OLD}: {left}")
        print("  roles holding " + NEW + ":",
              ", ".join(f"{c} {'view+edit' if p.get('edit') else 'view'}" for c, p in rows))


if __name__ == "__main__":
    asyncio.run(main())
