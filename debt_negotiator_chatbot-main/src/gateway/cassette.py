"""Record and replay model responses.

The evaluation harness is the test suite, and a test suite that costs money and
returns different answers each run is not one. Cassettes make every harness test
runnable offline, deterministically, at zero spend.

Keyed on everything that could change the response — role, model, temperature,
messages, and schema — so an edited prompt misses the cache rather than silently
replaying a stale answer for a question nobody asked.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


class CassetteMissError(RuntimeError):
    """A replay-mode lookup found no recording.

    Deliberately fatal: silently falling through to a live call would turn an
    offline test run into a billable one.
    """


def _key(payload: dict[str, Any]) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()[:32]


class Cassette:
    """A directory of recorded responses, one JSON file per interaction."""

    def __init__(self, directory: str | Path) -> None:
        self.directory = Path(directory)

    def path_for(self, payload: dict[str, Any]) -> Path:
        return self.directory / f"{_key(payload)}.json"

    def load(self, payload: dict[str, Any]) -> dict[str, Any]:
        path = self.path_for(payload)
        if not path.exists():
            raise CassetteMissError(
                f"no recording for {payload.get('role')} / {payload.get('model')} "
                f"at {path.name}. Re-record with NEGOTIATOR_CASSETTE_MODE=record."
            )
        loaded: dict[str, Any] = json.loads(path.read_text())
        return loaded

    def save(self, payload: dict[str, Any], response: dict[str, Any]) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.path_for(payload)
        path.write_text(json.dumps(response, indent=2, sort_keys=True))
