"""Role-Based Access Control.

The backend is the authoritative enforcement point. The catalog of capability
keys, the roles, and which role gets which key all live in the database —
``administration.permission``, ``administration.role`` and
``administration.role_permission`` (see ``database_setup.sql``), editable at
runtime through Role Management.

What stays in code is the small set of keys the API itself enforces: an
endpoint guard has to name a permission, and a typo must fail at import time
rather than silently grant access. ``PermKey`` therefore mirrors the seeded
``permission.code`` values; ``app/seed.py`` reconciles the two on boot.

The effective matrix handed to a request is ``{code: {"view": …, "edit": …}}``,
built by ``identity.service.permissions_for_user``.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

PermAction = Literal["view", "edit"]
PermissionMap = dict[str, dict[str, bool]]


class RoleSlug(StrEnum):
    """Role codes seeded by database_setup.sql."""

    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    SUPERVISOR = "SUPERVISOR"
    AGENT = "AGENT"
    FINANCE = "FINANCE"
    COLLECTION_MANAGER = "COLLECTION_MANAGER"
    RISK_ANALYST = "RISK_ANALYST"
    LEGAL_OFFICER = "LEGAL_OFFICER"
    AGENCY_USER = "AGENCY_USER"


class PermKey(StrEnum):
    """Capability keys the API enforces. Must exist in administration.permission."""

    # --- Modules (sidebar navigation) ---
    PORTFOLIO_DASHBOARD = "portfoliodashboard"
    PERFORMANCE_REPORTS = "performancereports"
    RISK_ANALYSIS = "riskanalysis"
    RISK_GRID_ANALYTICS = "riskGridAnalytics"
    CUSTOMER_360 = "customer360"
    DUNNING_SUMMARY = "dunningStrategySummary"
    DUNNING_DESIGNER = "dunningStrategyDesigner"
    CASE_MANAGEMENT = "caseManagement"
    COLLECTIONS_WORKSPACE = "collectionsWorkspace"
    AGENT_WORKSPACE = "agentWorkspace"
    STRATEGY_VERSIONS = "strategyVersions"
    STRATEGY_SIMULATION = "strategySimulation"
    RECOVERY_WORKSPACE = "recoveryWorkspace"
    # --- Case Management capabilities ---
    CASE_CREATE_MANUAL = "caseCreateManual"
    CASE_CREATE_AUTO = "caseCreateAuto"
    CASE_ASSIGN = "caseAssign"
    CASE_TRANSFER = "caseTransfer"
    CASE_CLOSE = "caseClose"
    CASE_REOPEN = "caseReopen"
    CASE_MERGE = "caseMerge"
    CASE_ESCALATE = "caseEscalate"
    CASE_DELETE = "caseDelete"
    CASE_APPROVE = "caseApprove"
    CASE_CONFIG_TYPES = "caseConfigTypes"
    CASE_CONFIG_QUEUES = "caseConfigQueues"
    CASE_CONFIG_WORKFLOW = "caseConfigWorkflow"
    AGENT_PERFORMANCE = "agentPerformance"
    AI_GUARDRAILS = "aiGuardrails"
    AI_ENGAGEMENT = "aiEngagementCenter"
    COLLECTIONS_DASHBOARD = "collectionsDashboard"
    SELF_SERVICE_BI = "selfServiceBI"
    CHATBOT_CONFIG = "chatbotConfig"
    # --- Administration ---
    ADMIN_CONFIG = "adminconfig"
    USER_MANAGEMENT = "userManagement"
    ROLE_MANAGEMENT = "roleManagement"


# Labels + sidebar group for any key missing from the database, so seeding can
# create it. Keys already present are left exactly as the DBA configured them.
PERMISSION_DEFAULTS: dict[PermKey, tuple[str, str]] = {
    PermKey.PORTFOLIO_DASHBOARD: ("Portfolio Dashboard", "Portfolio Management"),
    PermKey.PERFORMANCE_REPORTS: ("Performance Reports", "Portfolio Management"),
    PermKey.RISK_ANALYSIS: ("Risk Analytics", "Portfolio Management"),
    PermKey.RISK_GRID_ANALYTICS: ("Risk Grid Analytics", "Portfolio Management"),
    PermKey.CUSTOMER_360: ("Customer Financial 360", "Portfolio Management"),
    PermKey.DUNNING_SUMMARY: ("Strategy Dashboard", "Strategy Management"),
    PermKey.DUNNING_DESIGNER: ("Strategy Designer", "Strategy Management"),
    PermKey.CASE_MANAGEMENT: ("Case Management", "Collection Management"),
    PermKey.COLLECTIONS_WORKSPACE: ("Collections Workspace", "Collection Management"),
    PermKey.AGENT_WORKSPACE: ("Agent Workspace", "Collection Management"),
    PermKey.STRATEGY_VERSIONS: ("Strategy Versions", "Strategy Management"),
    PermKey.STRATEGY_SIMULATION: ("Strategy Simulation", "Strategy Management"),
    PermKey.RECOVERY_WORKSPACE: ("Recovery Workspace", "Recovery Management"),
    PermKey.CASE_CREATE_MANUAL: ("Create Manual Case", "Case Management"),
    PermKey.CASE_CREATE_AUTO: ("Create Automatic Case", "Case Management"),
    PermKey.CASE_ASSIGN: ("Assign Case", "Case Management"),
    PermKey.CASE_TRANSFER: ("Transfer Case", "Case Management"),
    PermKey.CASE_CLOSE: ("Close Case", "Case Management"),
    PermKey.CASE_REOPEN: ("Reopen Case", "Case Management"),
    PermKey.CASE_MERGE: ("Merge Cases", "Case Management"),
    PermKey.CASE_ESCALATE: ("Escalate Case", "Case Management"),
    PermKey.CASE_DELETE: ("Delete Case", "Case Management"),
    PermKey.CASE_APPROVE: ("Approve Case Actions", "Case Management"),
    PermKey.CASE_CONFIG_TYPES: ("Configure Case Types", "Case Management"),
    PermKey.CASE_CONFIG_QUEUES: ("Configure Queues", "Case Management"),
    PermKey.CASE_CONFIG_WORKFLOW: ("Configure Workflow", "Case Management"),
    PermKey.AGENT_PERFORMANCE: ("Agent Performance", "Operations Management"),
    PermKey.AI_GUARDRAILS: ("AI Guardrails", "Operations Management"),
    PermKey.AI_ENGAGEMENT: ("AI Engagement Center", "Operations Management"),
    PermKey.COLLECTIONS_DASHBOARD: ("Collections Dashboard", "Collection Management"),
    PermKey.SELF_SERVICE_BI: ("Self Service BI", "Operations Management"),
    PermKey.CHATBOT_CONFIG: ("Chatbot Configuration", "Administration"),
    PermKey.ADMIN_CONFIG: ("Admin Configuration", "Administration"),
    PermKey.USER_MANAGEMENT: ("User Management", "Administration"),
    PermKey.ROLE_MANAGEMENT: ("Role Management", "Administration"),
}


def has_permission(perms: PermissionMap, key: PermKey, action: PermAction) -> bool:
    entry = perms.get(key.value)
    return bool(entry and entry.get(action, False))


def desk_scope(principal, agent_id: int | None, *, default_floor: bool) -> int | None:
    """Whose work a request may see.

    A collector sees their own desk and nothing else — asking for another
    agent, or for everyone, silently returns their own rather than erroring.
    Only a User Management holder (supervisor, manager, admin) may widen the
    scope, and ``agentId=0`` means the whole floor.

    ``default_floor`` decides what an unqualified request means for someone who
    *may* widen: the collections screens open on the whole floor, the agent
    workspace opens on your own desk. Everything else about the rule is the
    same, so it lives here rather than being written out per module.

    Enforced server-side on purpose: a screen that merely hides other people's
    work is not access control.
    """
    own = int(principal.id)
    if not has_permission(principal.permissions, PermKey.USER_MANAGEMENT, "view"):
        return own
    if agent_id is None:
        return None if default_floor else own
    return None if agent_id == 0 else agent_id
