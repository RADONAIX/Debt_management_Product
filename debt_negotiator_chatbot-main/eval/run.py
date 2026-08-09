"""Run the evaluation and print the nine-metric report.

uv run python -m eval.run --quick     # 8 personas, all four archetypes
uv run python -m eval.run             # the full seeded set
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from eval.agents.baseline import NaiveBaselineCollector
from eval.agents.production import ProductionCollectorAgent
from eval.calibrate.store import calibration_status
from eval.metrics import experience, report
from eval.personas.store import QUICK_SIZE, STANDARD_SIZE, load_set
from eval.runner import T_MAX, run_dialogue
from eval.types import DialogueResult
from gateway.client import BudgetExceededError, Gateway
from gateway.roles import ModelRole

TRANSCRIPT_DIR = Path("eval/transcripts")
REPORT_DIR = Path("eval/reports")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the negotiation evaluation.")
    parser.add_argument(
        "--quick", action="store_true", help=f"{QUICK_SIZE}-persona smoke test"
    )
    parser.add_argument(
        "--standard",
        action="store_true",
        help=f"{STANDARD_SIZE}-persona comparison set (use this to compare agents)",
    )
    parser.add_argument(
        "--size", type=int, default=None, help="explicit stratified subset size"
    )
    parser.add_argument(
        "--agent",
        choices=["baseline", "production"],
        default="baseline",
        help="which collector to score",
    )
    parser.add_argument("--t-max", type=int, default=T_MAX)
    parser.add_argument("--no-judge", action="store_true", help="skip US/ES/CA")
    parser.add_argument(
        "--limit", type=int, default=None, help="cap dialogues (debugging)"
    )
    args = parser.parse_args()

    gateway = Gateway()
    gateway.verify_models()

    size = args.size
    if size is None and args.standard:
        size = STANDARD_SIZE
    if size is None and args.quick:
        size = QUICK_SIZE

    personas = load_set(size=size)
    if args.limit:
        personas = personas[: args.limit]

    agent = (
        ProductionCollectorAgent(gateway)
        if args.agent == "production"
        else NaiveBaselineCollector(gateway)
    )
    print(
        f"Running {agent.name} over {len(personas)} personas (T_max={args.t_max})...",
        file=sys.stderr,
    )

    results: list[DialogueResult] = []
    failures: list[tuple[str, str]] = []

    for i, persona in enumerate(personas, 1):
        # One flaky dialogue must not discard the whole run. The first
        # head-to-head died at 3 of 16 on a transient connection error and
        # threw away ~90 paid calls; a run that costs real money should
        # degrade to a smaller sample, not to nothing.
        #
        # BudgetExceededError is deliberately NOT caught — that is a ceiling
        # we chose, and continuing past it would defeat the point.
        try:
            result = run_dialogue(gateway, agent, persona, t_max=args.t_max)

            if not args.no_judge:
                scores = experience.score_dialogue(gateway, persona, result.trajectory)
                result = result.model_copy(update={"judge": scores})
        except BudgetExceededError:
            raise
        except Exception as exc:
            failures.append((persona.persona_id, f"{type(exc).__name__}: {exc}"))
            print(
                f"  [{i:>3}/{len(personas)}] {persona.persona_id:<22} "
                f"FAILED  {type(exc).__name__}: {str(exc)[:60]}",
                file=sys.stderr,
            )
            continue

        results.append(result)
        outcome = result.trajectory.outcome
        print(
            f"  [{i:>3}/{len(personas)}] {persona.persona_id:<22} "
            f"{outcome.value if outcome else '?':<12} "
            f"{result.trajectory.turn_count:>2} turns "
            f"({gateway.usage.calls} calls so far)",
            file=sys.stderr,
        )

    if failures:
        # Never let a partial run masquerade as a complete one: every metric
        # below is computed over a smaller denominator than was requested.
        print(
            f"\n{len(failures)} of {len(personas)} dialogues FAILED and are "
            f"excluded from every metric below:",
            file=sys.stderr,
        )
        for persona_id, detail in failures:
            print(f"    {persona_id}: {detail}", file=sys.stderr)

    if not results:
        print("no dialogues completed — nothing to report", file=sys.stderr)
        return 1

    calibrated, ratings = calibration_status()
    built = report.build(
        results,
        agent_name=agent.name,
        t_max=args.t_max,
        models={
            role.value: gateway.settings.role_config(role).model for role in ModelRole
        },
        usage={
            "calls": gateway.usage.calls,
            "total_tokens": gateway.usage.total_tokens,
        },
        judge_calibrated=calibrated,
        human_ratings=ratings,
    )

    print(built.render())
    _persist(results, built)
    return 0


def _persist(results: list[DialogueResult], built: report.Report) -> None:
    """Transcripts are what the calibration CLI rates, and what anyone
    debugging a surprising metric actually needs to read."""
    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
    for result in results:
        path = TRANSCRIPT_DIR / f"{result.persona.persona_id}.json"
        path.write_text(json.dumps(result.model_dump(mode="json"), indent=2))
    payload = json.dumps(built.model_dump(mode="json"), indent=2)
    (TRANSCRIPT_DIR / "report.json").write_text(payload)
    # Keep a per-agent copy so a later run cannot silently overwrite the
    # record the comparison is being made against.
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / f"{built.agent_name}-{built.overall.n}.json").write_text(payload)
    print(f"\nTranscripts written to {TRANSCRIPT_DIR}/", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
