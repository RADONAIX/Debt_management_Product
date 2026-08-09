"""Versioned prompt templates (CLAUDE.md §9, §12).

§12: "No prompts as inline string literals." §9: "Every audit record stores the
prompt version and model identifier that produced it."

Both point the same way — a prompt is a versioned artefact, not a string buried
in a function. When someone asks in six months why a particular offer was made,
"which prompt was live" has to be answerable from the audit row alone.

Templates are ``<name>_v<N>.md``. :func:`load` returns the newest version unless
one is named explicitly, so pinning a session to an older prompt stays possible.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

PROMPT_DIR = Path(__file__).resolve().parent
_PATTERN = re.compile(r"^(?P<name>.+)_v(?P<version>\d+)\.md$")


class PromptNotFoundError(FileNotFoundError):
    """No template matched. Fatal: a turn without a prompt is not a turn."""


@lru_cache(maxsize=32)
def load(name: str, version: int | None = None) -> tuple[str, str]:
    """Return ``(text, version_label)`` — e.g. ``("You are...", "collector_v1")``."""
    candidates: dict[int, Path] = {}
    for path in PROMPT_DIR.glob("*.md"):
        match = _PATTERN.match(path.name)
        if match and match.group("name") == name:
            candidates[int(match.group("version"))] = path

    if not candidates:
        raise PromptNotFoundError(f"no prompt template '{name}_v*.md' in {PROMPT_DIR}")

    chosen = version if version is not None else max(candidates)
    if chosen not in candidates:
        raise PromptNotFoundError(
            f"prompt '{name}' has no version {chosen}; have {sorted(candidates)}"
        )

    return candidates[chosen].read_text().strip(), f"{name}_v{chosen}"


def available() -> dict[str, list[int]]:
    """Every template and its versions. Used by ``/healthz``."""
    found: dict[str, list[int]] = {}
    for path in PROMPT_DIR.glob("*.md"):
        match = _PATTERN.match(path.name)
        if match:
            found.setdefault(match.group("name"), []).append(
                int(match.group("version"))
            )
    return {k: sorted(v) for k, v in found.items()}
