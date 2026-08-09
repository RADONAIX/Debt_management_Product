"""Strategy version history: snapshot on edit, restore, and clone.

The model is append-only. Every row in ``strategy_version`` is the complete
definition *at* that version, and its summary says what changed to produce it.
``public.strategy`` holds the live definition, and the newest version row is a
copy of it — so the history always includes where the strategy stands today.

Nothing is ever rewritten. A rollback is a new version whose content happens to
be an old one, which means you can see that the rollback happened and undo it
in turn by restoring the version it replaced.

A version stores the whole definition, not just the workflow canvas. Restoring
a strategy has to bring back who it targeted and how it was configured, or the
restored strategy is not the one that was running.
"""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationFailedError
from app.modules.strategies import schemas
from app.modules.strategies.models import Strategy

# Everything that makes a strategy what it is. Anything not listed here is
# either identity (the code), bookkeeping (timestamps) or measured outcome —
# none of which should travel back in time with a restore.
SNAPSHOT_FIELDS = (
    "name", "description", "segment_code", "aging_bucket", "risk_level",
    "workflow_json", "target_audience", "ab_test_config", "settings",
    "behaviour_type", "emotion_type", "minimum_income", "maximum_income",
    "minimum_loan", "maximum_loan", "status",
)

# How each field reads in the history, so "aging_bucket" never reaches a user.
FIELD_LABELS = {
    "name": "Name", "description": "Description", "segment_code": "Segment",
    "aging_bucket": "Ageing buckets", "risk_level": "Risk levels",
    "workflow_json": "Workflow", "target_audience": "Target audience",
    "ab_test_config": "A/B test", "settings": "Settings",
    "behaviour_type": "Behaviour", "emotion_type": "Emotion",
    "minimum_income": "Minimum income", "maximum_income": "Maximum income",
    "minimum_loan": "Minimum loan", "maximum_loan": "Maximum loan",
    "status": "Status",
}


def _json(value) -> str:
    return json.dumps(_jsonable(value))


def _jsonable(value):
    """Decimals and dates do not survive JSONB on their own."""
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "quantize"):  # Decimal
        return float(value)
    return value


def snapshot_of(s: Strategy) -> dict:
    return {f: _jsonable(getattr(s, f)) for f in SNAPSHOT_FIELDS}


def bump(version: str | None) -> str:
    """v1.8 → v1.9, v1.9 → v1.10. Minor only; a major is a deliberate act."""
    m = re.fullmatch(r"v?(\d+)\.(\d+)", (version or "v1.0").strip())
    if not m:
        return "v1.1"
    return f"v{m.group(1)}.{int(m.group(2)) + 1}"


def _count_nodes(workflow) -> tuple[int, int]:
    if not isinstance(workflow, dict):
        return 0, 0
    return len(workflow.get("nodes") or []), len(workflow.get("edges") or [])


def diff_fields(before: dict, after: dict) -> list[str]:
    """Which fields actually moved — an edit that changed nothing says so."""
    return [f for f in SNAPSHOT_FIELDS if before.get(f) != after.get(f)]


def describe(changed: list[str], before: dict, after: dict) -> str:
    """A one-line summary a person can read in a list without opening anything."""
    if not changed:
        return "Saved with no changes."
    parts: list[str] = []
    if "workflow_json" in changed:
        bn, be = _count_nodes(before.get("workflow_json"))
        an, ae = _count_nodes(after.get("workflow_json"))
        if (an, ae) != (bn, be):
            parts.append(f"workflow {bn}→{an} steps, {be}→{ae} links")
        else:
            parts.append("workflow re-arranged")
    rest = [FIELD_LABELS.get(f, f) for f in changed if f != "workflow_json"]
    if rest:
        parts.append(", ".join(rest[:4]).lower()
                     + (f" and {len(rest) - 4} more" if len(rest) > 4 else ""))
    return "Changed " + "; ".join(parts) + "."


async def record(db: AsyncSession, s: Strategy, *, before: dict, actor_id: int | None,
                 kind: str = "EDIT", summary: str | None = None,
                 restored_from: str | None = None) -> str | None:
    """File the strategy's new definition as the next version.

    Returns the version number written, or None when nothing actually changed —
    a save that alters nothing should not litter the history.
    """
    after = snapshot_of(s)
    changed = diff_fields(before, after)
    if not changed and kind == "EDIT":
        return None

    await baseline(db, s, actor_id, at_version=None, snap=before)
    s.current_version = bump(s.current_version)
    await _write(db, s, snap=after, summary=summary or describe(changed, before, after),
                 kind=kind, changed=changed, restored_from=restored_from, actor_id=actor_id)
    return s.current_version


async def _write(db: AsyncSession, s: Strategy, *, snap: dict, summary: str, kind: str,
                 changed: list[str], restored_from: str | None, actor_id: int | None,
                 at_version: str | None = None) -> None:
    await db.execute(text("""
        INSERT INTO public.strategy_version
          (strategy_id, version_no, workflow_json, snapshot, change_summary,
           change_kind, changed_fields, restored_from, status, author_id, published_at)
        VALUES (:sid, :ver, CAST(:wf AS jsonb), CAST(:snap AS jsonb), :sum,
                :kind, :fields, :from_ver, 'PUBLISHED', :actor, now())
        ON CONFLICT (strategy_id, version_no) DO UPDATE SET
          workflow_json = EXCLUDED.workflow_json, snapshot = EXCLUDED.snapshot,
          change_summary = EXCLUDED.change_summary, change_kind = EXCLUDED.change_kind,
          changed_fields = EXCLUDED.changed_fields, restored_from = EXCLUDED.restored_from"""),
        {"sid": s.id, "ver": at_version or s.current_version,
         "wf": _json(snap.get("workflow_json") or {}), "snap": _json(snap),
         "sum": summary, "kind": kind, "fields": changed,
         "from_ver": restored_from, "actor": actor_id})


async def baseline(db: AsyncSession, s: Strategy, actor_id: int | None = None,
                   *, at_version: str | None = None, snap: dict | None = None) -> None:
    """Give a strategy with no history a starting point to compare against."""
    exists = (await db.execute(text(
        "SELECT 1 FROM public.strategy_version WHERE strategy_id = :i LIMIT 1"),
        {"i": s.id})).first()
    if exists:
        return
    await _write(db, s, snap=snap if snap is not None else snapshot_of(s),
                 summary="Strategy as it stood when version history began.",
                 kind="BASELINE", changed=[], restored_from=None, actor_id=actor_id,
                 at_version=at_version or s.current_version)


async def history(db: AsyncSession, code: str) -> list[schemas.VersionRow]:
    rows = (await db.execute(text("""
        SELECT v.id, v.version_no, v.change_summary, v.change_kind, v.changed_fields,
               v.restored_from, v.created_at, v.snapshot,
               u.full_name AS author, s.current_version
        FROM public.strategy_version v
        JOIN public.strategy s ON s.id = v.strategy_id
        LEFT JOIN administration.app_user u ON u.id = v.author_id
        WHERE s.strategy_code = :c
        ORDER BY v.created_at DESC, v.id DESC"""), {"c": code})).mappings().all()
    out = []
    for r in rows:
        snap = r["snapshot"] or {}
        nodes, edges = _count_nodes(snap.get("workflow_json"))
        out.append(schemas.VersionRow(
            id=r["id"], version=r["version_no"], summary=r["change_summary"],
            kind=r["change_kind"],
            changedFields=[FIELD_LABELS.get(f, f) for f in (r["changed_fields"] or [])],
            restoredFrom=r["restored_from"], author=r["author"], createdAt=r["created_at"],
            name=snap.get("name"), strategyStatus=snap.get("status"),
            nodes=nodes, edges=edges))
    return out


async def snapshot(db: AsyncSession, code: str, version: str) -> schemas.VersionDetail:
    r = (await db.execute(text("""
        SELECT v.id, v.version_no, v.change_summary, v.change_kind, v.changed_fields,
               v.restored_from, v.created_at, v.snapshot, u.full_name AS author
        FROM public.strategy_version v
        JOIN public.strategy s ON s.id = v.strategy_id
        LEFT JOIN administration.app_user u ON u.id = v.author_id
        WHERE s.strategy_code = :c AND v.version_no = :v"""),
        {"c": code, "v": version})).mappings().first()
    if r is None:
        raise NotFoundError(f"{code} has no version {version}.")
    snap = r["snapshot"] or {}
    nodes, edges = _count_nodes(snap.get("workflow_json"))
    return schemas.VersionDetail(
        id=r["id"], version=r["version_no"], summary=r["change_summary"],
        kind=r["change_kind"],
        changedFields=[FIELD_LABELS.get(f, f) for f in (r["changed_fields"] or [])],
        restoredFrom=r["restored_from"], author=r["author"], createdAt=r["created_at"],
        name=snap.get("name"), strategyStatus=snap.get("status"), nodes=nodes, edges=edges,
        snapshot=snap)


async def compare(db: AsyncSession, code: str, left: str, right: str | None
                  ) -> schemas.VersionCompare:
    """What differs between two versions — or between one and what is live now."""
    a = (await snapshot(db, code, left)).snapshot
    if right:
        b = (await snapshot(db, code, right)).snapshot
        right_label = right
    else:
        s = (await db.execute(text(
            "SELECT * FROM public.strategy WHERE strategy_code = :c"), {"c": code}
        )).mappings().first()
        if s is None:
            raise NotFoundError(f"Strategy '{code}' does not exist.")
        b = {f: _jsonable(s[f]) for f in SNAPSHOT_FIELDS}
        right_label = f"{s['current_version']} (live)"
    return schemas.VersionCompare(
        left=left, right=right_label,
        differences=[
            schemas.FieldDiff(field=FIELD_LABELS.get(f, f),
                              before=_render(a.get(f)), after=_render(b.get(f)))
            for f in SNAPSHOT_FIELDS if a.get(f) != b.get(f)
        ])


def _render(value) -> str:
    """A field's value as a short line — a canvas is described, not dumped."""
    if value is None or value == "" or value == []:
        return "—"
    if isinstance(value, dict):
        if "nodes" in value or "edges" in value:
            n, e = _count_nodes(value)
            return f"{n} steps, {e} links"
        return f"{len(value)} settings" if value else "—"
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    return str(value)


async def restore(db: AsyncSession, s: Strategy, version: str, actor_id: int,
                  ) -> tuple[str, list[str]]:
    """Put an old version back as the live one.

    The version being replaced stays in the history untouched, so a restore can
    itself be undone by restoring it back.
    """
    target = (await snapshot(db, s.strategy_code, version)).snapshot
    if not target:
        raise ValidationFailedError(f"Version {version} holds no definition to restore.")

    before = snapshot_of(s)
    changed = diff_fields(before, target)
    if not changed:
        return s.current_version, []

    replaced = s.current_version
    await baseline(db, s, actor_id, snap=before)
    for f in SNAPSHOT_FIELDS:
        if f in target:
            setattr(s, f, target[f])
    # Status is a live operational fact, not part of the design: restoring an
    # old definition must not start a paused strategy or stop a running one.
    s.status = before["status"]
    s.updated_by = actor_id
    if s.status == "ACTIVE" and s.activated_at is None:
        s.activated_at = datetime.now(UTC)
    s.current_version = bump(s.current_version)
    await _write(db, s, snap=snapshot_of(s),
                 summary=f"Restored {version}, replacing {replaced}.",
                 kind="RESTORE", changed=changed, restored_from=version, actor_id=actor_id)
    await db.flush()
    return s.current_version, [FIELD_LABELS.get(f, f) for f in changed]
