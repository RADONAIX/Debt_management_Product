"""Move the guardrail rules into operations, and give them a history to show.

``public.ai_guardrail`` held the rules but nothing read or wrote it — the screen
ran off a TypeScript file. This carries those rows across into
``operations.guardrail`` with the fields the screen now needs (what the rule
does when it matches, and how serious a match is), and seeds a fortnight of
guardrail events so the activity view is not empty on first open.
"""

from __future__ import annotations

import asyncio
import json
import random

from sqlalchemy import text

from app.core.database import SessionFactory

# What each seeded rule does when it matches, and how serious that is. The old
# table recorded neither, so both are set deliberately here rather than guessed
# at runtime.
BEHAVIOUR = {
    "block_profanity":       ("BLOCK", "High", "Abusive language in a customer message."),
    "block_pii":             ("MASK", "Critical", "Personal data must never reach the model."),
    "language_restrictions": ("BLOCK", "Medium", "Only languages the team can service."),
    "limit_question_length": ("BLOCK", "Low", "Overlong input the model handles badly."),
    "time_of_day":           ("BLOCK", "Low", "Collection contact outside permitted hours."),
    "mask_sensitive":        ("MASK", "High", "Account and card numbers hidden by pattern."),
    "remove_financial":      ("REWRITE", "Critical", "No balance or settlement figure unverified."),
    "detect_hallucinations": ("FLAG", "High", "Answers not grounded in account data."),
    "detect_bias_toxicity":  ("BLOCK", "High", "Discriminatory or hostile wording."),
    "tone_enforcement":      ("REWRITE", "Medium", "Keeps collection language compliant."),
    "rewrite_unsafe":        ("REWRITE", "Medium", "Softens an unsafe answer instead of dropping it."),
    "disallowed_phrases":    ("BLOCK", "High", "Phrases legal has ruled out."),
    "blocked_thrice":        ("ESCALATE", "Medium", "Repeated blocks mean the bot is not coping."),
    "sim_fraud_keywords":    ("ESCALATE", "High", "Fraud and SIM loss need a person."),
    "angry_toxic":           ("ESCALATE", "High", "An angry customer should not be left with a bot."),
    "legal_threat":          ("ESCALATE", "Critical", "Anything touching litigation goes to legal."),
}

# Realistic traffic for the activity view: what was seen, and what was done.
SAMPLES = [
    ("block_pii", "MASKED", "My card is 4551 •••• •••• 8842, take it from there"),
    ("block_pii", "MASKED", "Emirates ID 784-•••• if that helps"),
    ("block_profanity", "BLOCKED", "[abusive message withheld]"),
    ("mask_sensitive", "MASKED", "Account ACC-•••• still shows the old balance"),
    ("remove_financial", "REWRITTEN", "Bot offered to write off the balance"),
    ("detect_bias_toxicity", "BLOCKED", "[hostile message withheld]"),
    ("legal_threat", "ESCALATED", "I am speaking to my solicitor about this"),
    ("sim_fraud_keywords", "ESCALATED", "My SIM was blocked, I think this is fraud"),
    ("angry_toxic", "ESCALATED", "This is the fourth time I have called!!"),
    ("detect_hallucinations", "FLAGGED", "Bot quoted a payment plan that does not exist"),
    ("tone_enforcement", "REWRITTEN", "Reply reworded from demanding to neutral"),
    ("limit_question_length", "BLOCKED", "[820-character message]"),
    ("blocked_thrice", "ESCALATED", "Third block in one conversation"),
    ("language_restrictions", "BLOCKED", "Message sent in an unsupported language"),
]

CHANNELS = ["CHATBOT", "CHATBOT", "CHATBOT", "VOICE_BOT", "SMS", "EMAIL"]


async def main() -> None:
    random.seed(20260807)
    async with SessionFactory() as db:
        rows = (await db.execute(text("""
            SELECT config_type, code, label, config, is_enabled, sort_order
            FROM public.ai_guardrail ORDER BY config_type, sort_order"""))).mappings().all()

        for r in rows:
            action, severity, why = BEHAVIOUR.get(
                r["code"], ("FLAG", "Medium", None))
            if r["config_type"] == "PROMPT_TEMPLATE":
                action, severity, why = "ALLOW", "Low", "Wording the bot uses for this intent."
            await db.execute(text("""
                INSERT INTO operations.guardrail
                  (kind, code, label, description, action, severity, config,
                   is_enabled, is_system, sort_order)
                VALUES (:k, :c, :l, :d, :a, :s, CAST(:cfg AS jsonb), :on, true, :o)
                ON CONFLICT (kind, code) DO UPDATE SET
                  label = EXCLUDED.label, description = EXCLUDED.description,
                  action = EXCLUDED.action, severity = EXCLUDED.severity"""),
                {"k": r["config_type"], "c": r["code"], "l": r["label"], "d": why,
                 "a": action, "s": severity, "cfg": json.dumps(r["config"] or {}),
                 "on": r["is_enabled"], "o": r["sort_order"]})
        print(f"  {len(rows)} rules carried into operations.guardrail")

        ids = {c: (i, k) for i, c, k in (await db.execute(text(
            "SELECT id, code, kind FROM operations.guardrail"))).all()}

        # Two weeks of traffic, thinning out towards today so the trend is not flat.
        seeded = 0
        for day in range(14, -1, -1):
            for _ in range(random.randint(2, 7)):
                code, outcome, sample = random.choice(SAMPLES)
                gid, kind = ids.get(code, (None, "INPUT_FILTER"))
                await db.execute(text("""
                    INSERT INTO operations.guardrail_event
                      (guardrail_id, code, kind, outcome, channel, sample, created_at)
                    VALUES (:g, :c, :k, :o, :ch, :s,
                            now() - make_interval(days => :d, hours => :h))"""),
                    {"g": gid, "c": code, "k": kind, "o": outcome,
                     "ch": random.choice(CHANNELS), "s": sample,
                     "d": day, "h": random.randint(0, 12)})
                seeded += 1
        print(f"  {seeded} guardrail events over the last 14 days")

        await db.commit()

        summary = (await db.execute(text("""
            SELECT kind, count(*) AS rules, count(*) FILTER (WHERE is_enabled) AS on
            FROM operations.guardrail GROUP BY 1 ORDER BY 1"""))).all()
        for k, n, on in summary:
            print(f"  {k:<16} {n} rules, {on} enabled")
        top = (await db.execute(text("""
            SELECT outcome, count(*) FROM operations.guardrail_event
            GROUP BY 1 ORDER BY 2 DESC"""))).all()
        print("  events:", ", ".join(f"{o} {n}" for o, n in top))


if __name__ == "__main__":
    asyncio.run(main())
