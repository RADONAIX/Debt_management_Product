"""Generate and commit the seeded persona set. Run deliberately, not routinely.

    uv run python -m eval.personas.generate           # refuses to clobber
    uv run python -m eval.personas.generate --force   # regenerate

Regenerating changes the denominator of every metric in the project, so metrics
either side of a regeneration are not comparable. Hence the guard.
"""

from __future__ import annotations

import argparse
import sys

from domain.enums import Archetype
from domain.persona import Persona
from eval.personas.factory import PersonaQualityError, generate_persona
from eval.personas.spec import build_spec
from eval.personas.store import MANIFEST_PATH, STRATIFICATION, save_set
from gateway.client import Gateway


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the seeded persona set.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="regenerate even though a set is already committed",
    )
    args = parser.parse_args()

    if MANIFEST_PATH.exists() and not args.force:
        print(
            f"A persona set is already committed at {MANIFEST_PATH}.\n"
            "Regenerating makes every previously recorded metric incomparable.\n"
            "Pass --force if that is genuinely what you want.",
            file=sys.stderr,
        )
        return 1

    gateway = Gateway()
    gateway.verify_models()

    personas: list[Persona] = []
    seq = 0
    for archetype in Archetype:
        for i in range(STRATIFICATION[archetype]):
            spec = build_spec(archetype, i, seq)
            seq += 1
            try:
                persona = generate_persona(gateway, spec)
            except PersonaQualityError as exc:
                print(f"  ! {spec.persona_id} rejected: {exc}", file=sys.stderr)
                continue
            personas.append(persona)
            print(
                f"  {persona.persona_id:<22} "
                f"cog(L{persona.cognition.legal_awareness.level} "
                f"F{persona.cognition.financial_literacy.level} "
                f"R{persona.cognition.responsibility.level} "
                f"C{persona.cognition.credit_awareness.level}) "
                f"age {spec.age:>2} debt {spec.overdue_amount:>6,} "
                f"{spec.debt_to_monthly_income:.1f}x  {spec.overdue_reason}"
            )

    save_set(personas)
    print(f"\nCommitted {len(personas)} personas.")
    print(f"Spend: {gateway.usage.calls} calls, {gateway.usage.total_tokens:,} tokens")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
