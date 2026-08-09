"""Law 6, enforced mechanically.

    "The debtor simulator is test infrastructure. It scores the collector. It is
     never exposed to a real counterparty and never reachable from a production
     route."

Two layers, because either alone is insufficient:

- **Structural** — an AST walk proving nothing under ``src/`` imports ``eval/``.
  A convention that "we just don't do that" survives exactly until the first
  person in a hurry.
- **Runtime** — a gateway constructed with ``production=True`` refuses the three
  eval-only roles, so even a wired-up call path fails closed.

The obvious failure this prevents is someone reusing the simulator prompt to
"test" the live API against a fake debtor, and shipping it.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from gateway.client import Gateway
from gateway.config import GatewaySettings
from gateway.roles import PRODUCTION_ALLOWED, ModelRole, RoleNotReachableError

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"

SRC_FILES = sorted(SRC.rglob("*.py"))


def _settings() -> GatewaySettings:
    return GatewaySettings(OPENAI_API_KEY="sk-test-not-a-real-key")


def test_source_tree_is_not_empty() -> None:
    """Guards the guard — an empty glob makes the AST tests vacuous."""
    assert len(SRC_FILES) > 5


@pytest.mark.parametrize("path", SRC_FILES, ids=lambda p: str(p.relative_to(SRC)))
def test_production_code_never_imports_the_harness(path: Path) -> None:
    """Nothing under src/ may import eval/ — that includes the simulator, the
    judge, the persona factory and the metrics."""
    tree = ast.parse(path.read_text(), filename=str(path))

    for node in ast.walk(tree):
        roots: list[str] = []
        if isinstance(node, ast.Import):
            roots = [a.name.split(".")[0] for a in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            roots = [node.module.split(".")[0]]

        for root in roots:
            assert root != "eval", (
                f"{path.relative_to(ROOT)} imports the eval harness; law 6 says "
                "it is never reachable from production code"
            )


def test_only_the_collector_is_production_reachable() -> None:
    assert PRODUCTION_ALLOWED[ModelRole.COLLECTOR] is True
    for role in (ModelRole.JUDGE, ModelRole.SIMULATOR, ModelRole.SYNTHESIS):
        assert PRODUCTION_ALLOWED[role] is False


@pytest.mark.parametrize(
    "role", [ModelRole.JUDGE, ModelRole.SIMULATOR, ModelRole.SYNTHESIS]
)
def test_production_gateway_refuses_eval_roles(role: ModelRole) -> None:
    """Fails closed before any network call — note this passes with a junk API
    key, which is the point: the refusal happens first."""
    gateway = Gateway(_settings(), production=True)
    with pytest.raises(RoleNotReachableError):
        gateway.complete(role, [{"role": "user", "content": "hi"}])


def test_eval_gateway_permits_every_role() -> None:
    """The harness itself is unrestricted — it is not production."""
    from gateway.roles import assert_reachable

    for role in ModelRole:
        assert_reachable(role, production=False)


def test_budget_ceiling_is_enforced_before_the_call() -> None:
    """The harness runs hundreds of dialogues against a real key. A runaway
    loop must hit a wall in code, not on the invoice."""
    from gateway.client import BudgetExceededError

    settings = _settings().model_copy(update={"max_calls_per_run": 2})
    gateway = Gateway(settings, production=False)
    gateway.usage.calls = 2

    with pytest.raises(BudgetExceededError):
        gateway.complete(ModelRole.SIMULATOR, [{"role": "user", "content": "hi"}])
