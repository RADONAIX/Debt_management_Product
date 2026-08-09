"""Collection roles and their case-management permissions.

Adds the four roles the collection operation needs alongside the existing
ones, and writes each role's permission matrix. Uses administration.role and
its JSONB `permissions` column — no new permission storage.
"""

from __future__ import annotations

import asyncio
import json

from sqlalchemy import text

from app.core.database import SessionFactory

V = {"view": True, "edit": False}
E = {"view": True, "edit": True}

# Screens each role can reach.
SCREENS = {
    "AGENT": ["collectionsWorkspace", "agentWorkspace", "caseManagement", "customer360"],
    "SUPERVISOR": ["collectionsWorkspace", "agentWorkspace", "caseManagement", "customer360",
                   "agentPerformance", "portfoliodashboard", "riskanalysis"],
    "COLLECTION_MANAGER": ["collectionsWorkspace", "agentWorkspace", "caseManagement",
                           "customer360", "agentPerformance", "portfoliodashboard",
                           "riskanalysis", "riskGridAnalytics", "recoveryWorkspace",
                           "dunningStrategySummary", "performancereports"],
    "RISK_ANALYST": ["riskanalysis", "riskGridAnalytics", "portfoliodashboard",
                     "customer360", "caseManagement"],
    "LEGAL_OFFICER": ["caseManagement", "recoveryWorkspace", "customer360",
                      "collectionsWorkspace"],
    "AGENCY_USER": ["recoveryWorkspace", "caseManagement"],
}

# Case-management capabilities each role holds.
CASE_CAPS = {
    "AGENT": {"caseCreateManual": E, "caseAssign": V, "caseEscalate": E},
    "SUPERVISOR": {"caseCreateManual": E, "caseCreateAuto": E, "caseAssign": E,
                   "caseTransfer": E, "caseClose": E, "caseReopen": E, "caseMerge": E,
                   "caseEscalate": E, "caseApprove": E},
    "COLLECTION_MANAGER": {"caseCreateManual": E, "caseCreateAuto": E, "caseAssign": E,
                           "caseTransfer": E, "caseClose": E, "caseReopen": E,
                           "caseMerge": E, "caseEscalate": E, "caseApprove": E,
                           "caseDelete": E, "caseConfigTypes": E, "caseConfigQueues": E,
                           "caseConfigWorkflow": E},
    # A risk analyst studies the book and can raise cases, but works none of them.
    "RISK_ANALYST": {"caseCreateAuto": E, "caseCreateManual": V},
    "LEGAL_OFFICER": {"caseEscalate": E, "caseClose": E, "caseCreateManual": E},
    "AGENCY_USER": {},
}

NEW_ROLES = [
    ("COLLECTION_MANAGER", "Collection Manager",
     "Owns the collection operation: queues, workflow, assignment and escalation."),
    ("RISK_ANALYST", "Risk Analyst",
     "Analyses the book and raises risk-driven cases; does not work them."),
    ("LEGAL_OFFICER", "Legal Officer",
     "Handles pre-legal and legal matters and the cases attached to them."),
    ("AGENCY_USER", "Agency User",
     "External agency access, limited to placements and their cases."),
]


async def main() -> None:
    async with SessionFactory() as db:
        catalog = [c for (c,) in (await db.execute(text(
            "SELECT code FROM administration.permission"))).all()]

        for code, name, desc in NEW_ROLES:
            await db.execute(text("""
                INSERT INTO administration.role (code, name, description, status)
                VALUES (:c,:n,:d,'ACTIVE')
                ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,
                    description=EXCLUDED.description"""),
                dict(c=code, n=name, d=desc))

        for role_code in list(SCREENS):
            matrix: dict[str, dict] = {}
            for key in SCREENS[role_code]:
                if key in catalog:
                    # An agent edits the screens they work in; an analyst reads.
                    matrix[key] = E if role_code != "RISK_ANALYST" else V
            for key, level in CASE_CAPS[role_code].items():
                if key in catalog:
                    matrix[key] = level
            # Everyone who can see cases can view them.
            if "caseManagement" in matrix:
                matrix.setdefault("caseManagement", V)
            await db.execute(text("""
                UPDATE administration.role SET permissions = CAST(:m AS jsonb), updated_at = now()
                WHERE code = :c"""), {"m": json.dumps(matrix), "c": role_code})

        await db.commit()

        rows = (await db.execute(text("""
            SELECT r.code, r.name,
                   (SELECT count(*) FROM jsonb_object_keys(r.permissions)) AS keys,
                   (SELECT count(*) FROM jsonb_each(r.permissions) e
                     WHERE (e.value->>'edit')::boolean) AS edits,
                   (SELECT count(*) FROM administration.app_user u WHERE u.role_id = r.id) AS users
            FROM administration.role r ORDER BY r.code"""))).mappings().all()
        print("  role                 keys  edit  users")
        for r in rows:
            print(f"  {r['code']:<20} {r['keys']:>4} {r['edits']:>5} {r['users']:>6}")


if __name__ == "__main__":
    asyncio.run(main())
