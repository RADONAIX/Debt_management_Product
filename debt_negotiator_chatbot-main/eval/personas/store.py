"""The seeded persona set (CLAUDE.md §8).

    "Fixed, seeded, version-controlled persona test set. Metrics across a
     changing set are meaningless."

So personas are generated **once**, written to ``fixtures/``, committed, and
loaded from disk by every run thereafter. Regeneration is an explicit,
deliberate act, not something a normal eval does.

The manifest carries a content hash per persona. If the set drifts — a fixture
edited, a persona added, a file lost — the hash check fails loudly, because
silently changing the denominator of every metric is the failure this guards
against. Comparing today's CR against last week's over a different set is worse
than having no number at all.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from domain.enums import Archetype
from domain.persona import Persona

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
MANIFEST_PATH = FIXTURES_DIR / "manifest.json"

# Stratified to the observed distribution (paper Table 3): 38/31/25/6.
STRATIFICATION: dict[Archetype, int] = {
    Archetype.CONFRONTATIONAL: 15,
    Archetype.AVOIDANT: 12,
    Archetype.HELPLESS: 10,
    Archetype.COOPERATIVE: 3,
}

QUICK_SIZE = 8
"""Smoke-test tier. Slices are too thin to compare agents on."""

STANDARD_SIZE = 16
"""The working comparison tier.

Deliberately the same set for every agent, so the baseline and the Phase 3
negotiator are scored on identical personas. Comparing two agents across
different persona sets measures the sets, not the agents.
"""


class DriftError(RuntimeError):
    """The committed persona set no longer matches its manifest."""


def persona_hash(persona: Persona) -> str:
    blob = json.dumps(persona.model_dump(mode="json"), sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


class Manifest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    hashes: dict[str, str]
    stratification: dict[str, int]

    @property
    def count(self) -> int:
        return len(self.hashes)


def save_set(personas: list[Persona]) -> None:
    """Write the fixtures and manifest. Regeneration only."""
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    for stale in FIXTURES_DIR.glob("*.json"):
        stale.unlink()

    for persona in personas:
        path = FIXTURES_DIR / f"{persona.persona_id}.json"
        path.write_text(json.dumps(persona.model_dump(mode="json"), indent=2))

    manifest = Manifest(
        hashes={p.persona_id: persona_hash(p) for p in personas},
        stratification={a.value: n for a, n in STRATIFICATION.items()},
    )
    MANIFEST_PATH.write_text(
        json.dumps(manifest.model_dump(), indent=2, sort_keys=True)
    )


def load_set(*, size: int | None = None, verify: bool = True) -> list[Persona]:
    """Load the committed set, verifying it has not drifted.

    ``size`` returns a stratified subset; ``None`` returns all 40.
    """
    if not MANIFEST_PATH.exists():
        raise DriftError(
            "no persona set committed yet — generate one with "
            "`uv run python -m eval.personas.generate`"
        )

    manifest = Manifest.model_validate_json(MANIFEST_PATH.read_text())
    personas: list[Persona] = []

    for persona_id in sorted(manifest.hashes):
        path = FIXTURES_DIR / f"{persona_id}.json"
        if not path.exists():
            raise DriftError(f"manifest lists {persona_id} but {path.name} is missing")
        persona = Persona.model_validate_json(path.read_text())
        if verify and persona_hash(persona) != manifest.hashes[persona_id]:
            raise DriftError(
                f"{persona_id} has been edited since it was committed; every "
                "metric computed over this set would be incomparable to previous "
                "runs. Restore it or regenerate the whole set deliberately."
            )
        personas.append(persona)

    stray = (
        {p.stem for p in FIXTURES_DIR.glob("*.json")}
        - set(manifest.hashes)
        - {"manifest"}
    )
    if verify and stray:
        raise DriftError(f"fixtures present but not in the manifest: {sorted(stray)}")

    if size is not None and size < len(personas):
        return stratified_subset(personas, size)
    return personas


def allocate(size: int) -> dict[Archetype, int]:
    """Split ``size`` across archetypes, holding the Table 3 distribution.

    Largest-remainder rather than plain rounding, so the parts always sum to
    ``size`` exactly. Every archetype keeps at least one slot — a subset that
    silently dropped cooperative or helpless would hide the slice most likely
    to be broken, which is the opposite of what a smaller run is for.
    """
    total = sum(STRATIFICATION.values())
    exact = {a: size * n / total for a, n in STRATIFICATION.items()}

    counts = {a: max(1, int(v)) for a, v in exact.items()}
    # Trim or top up to hit `size` exactly, always touching the archetype with
    # the largest (or smallest) fractional claim first.
    order = sorted(exact, key=lambda a: exact[a] - int(exact[a]), reverse=True)

    while sum(counts.values()) < size:
        for archetype in order:
            if sum(counts.values()) >= size:
                break
            if counts[archetype] < STRATIFICATION[archetype]:
                counts[archetype] += 1
    while sum(counts.values()) > size:
        for archetype in reversed(order):
            if sum(counts.values()) <= size:
                break
            if counts[archetype] > 1:
                counts[archetype] -= 1

    return counts


def stratified_subset(personas: list[Persona], size: int) -> list[Persona]:
    """A stable subset of ``size`` personas keeping the archetype mix.

    Stable because it walks the sorted set and takes the first N of each
    archetype: the same 16 personas every time, for every agent. A subset that
    varied between runs would make two agents' scores incomparable.
    """
    wanted = allocate(size)
    chosen: list[Persona] = []
    for persona in personas:
        if wanted.get(persona.archetype, 0) > 0:
            chosen.append(persona)
            wanted[persona.archetype] -= 1
    return chosen
