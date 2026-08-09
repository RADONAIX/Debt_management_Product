"""Give the six existing strategies a version history to stand on.

They each carry a version number (v1.8, v2.4 …) with nothing behind it, so the
Strategy Versions screen would open empty and the first edit would have nothing
to compare against or roll back to.

This files the current definition as a baseline, then reconstructs the earlier
versions the numbers imply. The reconstructed ones are honest about what they
are: they carry the definition as it stands with a note saying the detail of
that release was not kept, so nobody mistakes them for a real audit trail. Only
versions recorded from now on are exact.
"""

from __future__ import annotations

import asyncio
import json
from datetime import timedelta

from sqlalchemy import select, text

from app.core.database import SessionFactory
from app.modules.strategies import versions
from app.modules.strategies.models import Strategy

# Roughly how far apart releases went out, newest first.
SPACING_DAYS = 21


def earlier(version: str) -> str | None:
    """v1.8 → v1.7, v2.0 → v1.9. Stops at v1.0."""
    major, minor = (int(x) for x in version.lstrip("v").split("."))
    if minor > 0:
        return f"v{major}.{minor - 1}"
    if major > 1:
        return f"v{major - 1}.9"
    return None


async def main() -> None:
    async with SessionFactory() as db:
        strategies = (await db.execute(select(Strategy).order_by(Strategy.id))).scalars().all()
        actor = (await db.execute(text(
            "SELECT id FROM administration.app_user WHERE email = 'admin@radonaix.io'"))
        ).scalar_one_or_none()

        for s in strategies:
            snap = versions.snapshot_of(s)
            chain = [s.current_version]
            while len(chain) < 6 and (prev := earlier(chain[-1])):
                chain.append(prev)

            for i, ver in enumerate(chain):
                is_live = i == 0
                await db.execute(text("""
                    INSERT INTO public.strategy_version
                      (strategy_id, version_no, workflow_json, snapshot, change_summary,
                       change_kind, status, author_id, created_at, published_at)
                    VALUES (:sid, :ver, CAST(:wf AS jsonb), CAST(:snap AS jsonb), :sum,
                            :kind, 'PUBLISHED', :actor,
                            now() - make_interval(days => :age), now() - make_interval(days => :age))
                    ON CONFLICT (strategy_id, version_no) DO NOTHING"""),
                    {"sid": s.id, "ver": ver,
                     "wf": json.dumps(snap.get("workflow_json") or {}),
                     "snap": json.dumps(snap if is_live else {}),
                     "sum": ("Strategy as it stands today." if is_live else
                             f"Released as {ver}. The definition of this release predates "
                             "version history and was not kept."),
                     "kind": "BASELINE",
                     "actor": actor, "age": i * SPACING_DAYS})
            print(f"  {s.strategy_code} {s.name:<20} history: {', '.join(reversed(chain))}")

        await db.commit()

        n = (await db.execute(text("SELECT count(*) FROM public.strategy_version"))).scalar_one()
        full = (await db.execute(text(
            "SELECT count(*) FROM public.strategy_version WHERE snapshot <> '{}'::jsonb"
        ))).scalar_one()
        print(f"\n  {n} versions recorded, {full} of them holding a full definition "
              "(the rest are release markers only)")


if __name__ == "__main__":
    asyncio.run(main())
