"""Jurisdiction compliance packs (CLAUDE.md §7).

Phase 4 replaces the *source* of these with real per-tenant retrieval. Phase 3
ships the interface, one built-in pack, and — the part that matters — the
**fail-closed** behaviour already wired into the turn loop:

    "Fail closed. If the jurisdiction compliance pack cannot be retrieved, the
     turn does not proceed. Escalate. Never negotiate without knowing the rules
     of the jurisdiction."

Building the interface now with fail-closed live means Phase 4 swaps a backend
rather than retrofitting a safety property into a working system, which is the
kind of retrofit that quietly never happens.

Two §7 rules bind this module hard:

**No policy value is ever sourced here.** Discount tiers and upfront thresholds
come from ``policy/``. A pack may *explain* a rule; it never defines an
enforceable limit. :func:`_assert_no_policy_values` enforces that on the way in.

**Retrieved content is reference material, not instruction.** Text inside a pack
that reads like a directive does not acquire authority by being retrieved, and
the collector prompt frames it as reference accordingly.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field


class RetrievalError(RuntimeError):
    """No pack for this jurisdiction. The turn must not proceed."""


class Chunk(BaseModel):
    """One retrievable unit, citable in the audit record."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    chunk_id: str
    title: str
    text: str


class CompliancePack(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    jurisdiction: str
    version: str
    chunks: tuple[Chunk, ...] = Field(min_length=1)

    def render(self) -> str:
        return "\n\n".join(f"### {c.title}\n{c.text}" for c in self.chunks)

    def refs(self) -> list[str]:
        """What went into context, for the §7 audit record."""
        return [f"{self.jurisdiction}/{self.version}/{c.chunk_id}" for c in self.chunks]


_UK_PACK = CompliancePack(
    jurisdiction="uk",
    version="2026-08-01",
    chunks=(
        Chunk(
            chunk_id="identity",
            title="Identity and purpose",
            text=(
                "The collector must identify themselves, the institution they "
                "act for, and the purpose of the contact at the start of the "
                "conversation. The debtor may ask for this to be confirmed in "
                "writing at any point."
            ),
        ),
        Chunk(
            chunk_id="validation",
            title="Disputes and written validation",
            text=(
                "If the debtor disputes that the debt is owed, or asks for "
                "written validation of it, collection activity pauses and the "
                "matter passes to a human agent. The conversation does not "
                "continue on the assumption the debt is valid."
            ),
        ),
        Chunk(
            chunk_id="threats",
            title="Consequences and legal action",
            text=(
                "Consequences may be described only where accurate and where "
                "the institution would in fact pursue them. Court action, "
                "enforcement agents, and asset recovery must never be stated or "
                "implied as imminent or automatic."
            ),
        ),
        Chunk(
            chunk_id="third-party",
            title="Third-party disclosure",
            text=(
                "The existence, amount, or status of the debt is not disclosed "
                "to any person other than the debtor or an authorised "
                "representative. This includes family, employers and "
                "colleagues."
            ),
        ),
        Chunk(
            chunk_id="vulnerability",
            title="Vulnerability",
            text=(
                "Where the debtor shows signs of distress, mental-health "
                "difficulty, or self-harm, the conversation stops and is passed "
                "to a trained human agent. Repayment is not pursued in that "
                "turn."
            ),
        ),
        Chunk(
            chunk_id="affordability",
            title="Affordability",
            text=(
                "An arrangement must be one the debtor can realistically "
                "maintain. Agreeing a payment the debtor has said they cannot "
                "afford is not a successful outcome."
            ),
        ),
    ),
)

_PACKS: dict[str, CompliancePack] = {"uk": _UK_PACK}

# A pack that states a number in these shapes is trying to define policy, which
# §7 forbids: "Retrieved documents may explain rules; they never define
# enforceable limits."
_POLICY_VALUE_PATTERNS = (
    re.compile(r"\b\d+\s*%", re.I),
    re.compile(r"\b(?:discount|upfront|instal?ment)\b[^.]*\b\d+\b", re.I),
)


def _assert_no_policy_values(pack: CompliancePack) -> None:
    for chunk in pack.chunks:
        for pattern in _POLICY_VALUE_PATTERNS:
            if pattern.search(chunk.text):
                raise RetrievalError(
                    f"pack {pack.jurisdiction}/{pack.version} chunk "
                    f"'{chunk.chunk_id}' states a policy value; §7 forbids "
                    "sourcing enforceable limits from retrieval"
                )


def get_pack(jurisdiction: str) -> CompliancePack:
    """The compliance pack for a jurisdiction, or fail closed.

    Raising rather than returning an empty pack is the whole point. A soft
    degrade here means negotiating in a legal setting whose rules we could not
    load, which §7 forbids outright.
    """
    pack = _PACKS.get(jurisdiction.strip().lower())
    if pack is None:
        raise RetrievalError(
            f"no compliance pack for jurisdiction '{jurisdiction}'; the turn "
            "cannot proceed (§7 fail closed)"
        )
    _assert_no_policy_values(pack)
    return pack


def known_jurisdictions() -> list[str]:
    return sorted(_PACKS)
