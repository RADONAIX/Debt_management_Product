"""Blind human rating of transcripts.

    uv run python -m eval.calibrate

Shows a transcript and the persona it was run against, **hides the judge's
scores**, and records yours. Showing them would anchor the rating and quietly
manufacture the agreement we are trying to measure.

At 30 ratings the harness computes Spearman correlation per dimension and drops
the PROVISIONAL tag if all three hold at rho >= 0.6.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from eval.calibrate.store import (
    MIN_RATINGS,
    MIN_RHO,
    HumanRating,
    calibration_status,
    load_ratings,
    save_ratings,
    spearman,
)

TRANSCRIPT_DIR = Path("eval/transcripts")

DIMENSIONS = [
    ("user_satisfaction", "User satisfaction — did they feel fairly treated?"),
    ("emotional_support", "Emotional support — appropriate to THIS persona?"),
    (
        "communication_appropriateness",
        "Communication — clear, honest, non-coercive?",
    ),
]


def _ask(prompt: str) -> int | None:
    while True:
        raw = input(f"  {prompt}\n  1-10 (or 's' to skip, 'q' to quit): ").strip()
        if raw.lower() == "q":
            raise KeyboardInterrupt
        if raw.lower() == "s":
            return None
        if raw.isdigit() and 1 <= int(raw) <= 10:
            return int(raw)
        print("  ...1 to 10 please.")


def _show(payload: dict[str, Any]) -> None:
    persona = payload["persona"]
    cognition = persona["cognition"]
    print("=" * 78)
    print(f"PERSONA {persona['persona_id']}  [{persona['archetype']}]")
    print("=" * 78)
    print(persona["scenario"])
    print(
        "  cognition: "
        + ", ".join(
            f"{k.replace('_', ' ')} {v['level']}/5" for k, v in cognition.items()
        )
    )
    print("-" * 78)
    for turn in payload["trajectory"]["turns"]:
        who = turn["speaker"].upper()
        print(f"[{who:<9}] {turn['dialogue']}")
    outcome = payload["trajectory"]["outcome"]
    print("-" * 78)
    print(f"OUTCOME: {outcome}")
    if payload["trajectory"].get("agreement"):
        print(f"AGREEMENT: {payload['trajectory']['agreement']}")
    print()


def main() -> int:
    if not TRANSCRIPT_DIR.exists():
        print(
            "No transcripts yet. Run `uv run python -m eval.run --quick` first.",
            file=sys.stderr,
        )
        return 1

    ratings = load_ratings()
    already = {r.persona_id for r in ratings}

    pending = [
        p
        for p in sorted(TRANSCRIPT_DIR.glob("*.json"))
        if p.name != "report.json" and p.stem not in already
    ]
    if not pending:
        print(f"All {len(ratings)} available transcripts already rated.")
        return _summarise(ratings)

    print(
        f"{len(ratings)} rated so far, {MIN_RATINGS} needed. "
        f"{len(pending)} unrated transcripts available.\n"
        "Judge scores are hidden until you have rated.\n"
    )

    try:
        for path in pending:
            payload = json.loads(path.read_text())
            _show(payload)

            scores: dict[str, int] = {}
            skipped = False
            for key, prompt in DIMENSIONS:
                value = _ask(prompt)
                if value is None:
                    skipped = True
                    break
                scores[key] = value
            if skipped:
                continue

            ratings.append(
                HumanRating(persona_id=payload["persona"]["persona_id"], **scores)
            )
            save_ratings(ratings)

            if payload.get("judge"):
                judge = payload["judge"]
                print(
                    f"  (judge said "
                    f"US {judge['user_satisfaction']} "
                    f"ES {judge['emotional_support']} "
                    f"CA {judge['communication_appropriateness']})\n"
                )
    except (KeyboardInterrupt, EOFError):
        print("\nStopped. Progress saved.")

    return _summarise(ratings)


def _summarise(ratings: list[HumanRating]) -> int:
    from eval.calibrate.store import _load_judge_scores

    save_ratings(ratings)
    calibrated, count = calibration_status()

    print("\n" + "=" * 60)
    print(f"Human ratings collected: {count} / {MIN_RATINGS}")

    judged = _load_judge_scores()
    paired = [(r, judged[r.persona_id]) for r in ratings if r.persona_id in judged]
    if len(paired) >= 2:
        for key, _ in DIMENSIONS:
            human = [float(getattr(h, key)) for h, _ in paired]
            model = [float(m[key]) for _, m in paired]
            rho = spearman(human, model)
            shown = "n/a" if rho is None else f"{rho:+.3f}"
            print(f"  {key:<32} rho {shown}  (need >= {MIN_RHO})")

    print(
        f"\nJudge is {'CALIBRATED' if calibrated else 'still PROVISIONAL'}."
        if count
        else ""
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
