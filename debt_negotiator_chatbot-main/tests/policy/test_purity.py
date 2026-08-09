"""`policy/` is pure (CLAUDE.md §12): no I/O, no LLM calls, no clock reads.

Asserted structurally rather than by convention, so law 1 cannot erode quietly
as later phases add a gateway, a retrieval layer, and a persistence layer next
door. A policy engine that can be reached by the network is not deterministic,
and a non-deterministic envelope is not enforceable.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

POLICY_DIR = Path(__file__).resolve().parents[2] / "src" / "policy"

FORBIDDEN_MODULES = {
    "openai",
    "httpx",
    "requests",
    "sqlalchemy",
    "redis",
    "fastapi",
    "random",
    "time",
    "datetime",
    "os",
    "pathlib",
    "socket",
    "subprocess",
}

FORBIDDEN_PACKAGES = {"gateway", "retrieval", "persistence", "api", "agent", "eval"}

FORBIDDEN_CALLS = {"open", "print", "input"}

POLICY_FILES = sorted(p for p in POLICY_DIR.glob("*.py") if p.name != "__init__.py")


def test_policy_package_is_not_empty() -> None:
    """Guards the guard: an empty glob would make every test below vacuous."""
    assert {p.name for p in POLICY_FILES} >= {
        "envelope.py",
        "hardship.py",
        "ladder.py",
        "validation.py",
    }


@pytest.mark.parametrize("path", POLICY_FILES, ids=lambda p: p.name)
def test_policy_module_imports_nothing_impure(path: Path) -> None:
    tree = ast.parse(path.read_text(), filename=str(path))

    for node in ast.walk(tree):
        roots: list[str] = []
        if isinstance(node, ast.Import):
            roots = [alias.name.split(".")[0] for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            roots = [node.module.split(".")[0]]

        for root in roots:
            assert root not in FORBIDDEN_MODULES, (
                f"{path.name} imports '{root}'; policy/ must stay pure"
            )
            assert root not in FORBIDDEN_PACKAGES, (
                f"{path.name} imports '{root}'; policy/ may depend on domain/ only"
            )


@pytest.mark.parametrize("path", POLICY_FILES, ids=lambda p: p.name)
def test_policy_module_performs_no_io_calls(path: Path) -> None:
    tree = ast.parse(path.read_text(), filename=str(path))

    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            assert node.func.id not in FORBIDDEN_CALLS, (
                f"{path.name} calls {node.func.id}(); policy/ performs no I/O"
            )
