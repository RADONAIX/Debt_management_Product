"""The four model roles (CLAUDE.md §9).

Only ``COLLECTOR`` is reachable in production. The other three are evaluation
and offline batch roles, and law 6 is explicit that the debtor simulator must
never be reachable from a production route. That is enforced twice: here at
call time via :func:`assert_reachable`, and structurally by the AST guard in
``tests/gateway/test_role_isolation.py``.
"""

from __future__ import annotations

from enum import StrEnum


class ModelRole(StrEnum):
    COLLECTOR = "collector"
    """The product. Reachable in production."""

    EXTRACTOR = "extractor"
    """Reads a debtor utterance and names the evidence in it. Production.

    Separate from ``COLLECTOR`` on purpose: the component that decides what a
    debtor evidenced must not be the component that benefits from a looser
    envelope. It is also strictly limited in what it may assert — see
    :mod:`policy.evidence_intake`.
    """

    JUDGE = "judge"
    """US/ES/CA scoring in the harness. Eval only."""

    SIMULATOR = "simulator"
    """The debtor agent. Eval only — never a real counterparty."""

    SYNTHESIS = "synthesis"
    """Persona generation. Offline batch only."""


PRODUCTION_ALLOWED: dict[ModelRole, bool] = {
    ModelRole.COLLECTOR: True,
    ModelRole.EXTRACTOR: True,
    ModelRole.JUDGE: False,
    ModelRole.SIMULATOR: False,
    ModelRole.SYNTHESIS: False,
}


class RoleNotReachableError(RuntimeError):
    """Raised when a production gateway is asked to invoke an eval-only role."""


def assert_reachable(role: ModelRole, *, production: bool) -> None:
    """Refuse eval-only roles on a production gateway."""
    if production and not PRODUCTION_ALLOWED[role]:
        raise RoleNotReachableError(
            f"role '{role.value}' is eval-only and cannot be invoked from a "
            "production gateway (CLAUDE.md law 6)"
        )
