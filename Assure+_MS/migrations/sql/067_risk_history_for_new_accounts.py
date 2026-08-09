"""Give every account six months of risk history, so no 360 opens with a gap.

The Risk Trend chart plots customer_schema.risk_history. Accounts created after
that table was seeded had none, so their chart drew an empty box — the three
lifecycle customers among them.

History is reconstructed from what the account has actually done rather than
invented: the balance for each month comes from the invoices raised and the
payments received by then, DPD from how long the oldest unpaid bill had been
outstanding, and the risk score is interpolated to land exactly on the score the
account carries today. The last point on the chart therefore always equals the
figure in the header above it.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import SessionFactory


async def main() -> None:
    async with SessionFactory() as db:
        missing = (await db.execute(text("""
            SELECT a.id, a.account_code, a.risk_score, a.dpd, a.outstanding,
                   a.risk_level
            FROM customer_schema.account a
            WHERE NOT EXISTS (SELECT 1 FROM customer_schema.risk_history h
                               WHERE h.account_id = a.id)
            ORDER BY a.account_code"""))).mappings().all()

        if not missing:
            print("  every account already has history")

        for a in missing:
            # Six month-ends, oldest first.
            rows = (await db.execute(text("""
                WITH months AS (
                    SELECT generate_series(
                        date_trunc('month', CURRENT_DATE) - interval '5 months',
                        date_trunc('month', CURRENT_DATE), interval '1 month')::date AS m
                )
                SELECT m.m AS as_of,
                       -- What the account owed at the end of that month.
                       COALESCE((SELECT sum(i.amount) FROM customer_schema.invoice i
                                  WHERE i.account_id = :acc
                                    AND i.issue_date < m.m + interval '1 month'), 0)
                     - COALESCE((SELECT sum(p.amount) FROM customer_schema.payment p
                                  WHERE p.account_id = :acc AND p.status = 'COMPLETED'
                                    AND p.payment_date < m.m + interval '1 month'), 0)
                         AS balance,
                       -- How long the oldest still-unpaid bill had been due.
                       COALESCE((SELECT ((m.m + interval '1 month' - interval '1 day')::date - min(i.due_date))::int
                                   FROM customer_schema.invoice i
                                  WHERE i.account_id = :acc
                                    AND i.due_date < m.m + interval '1 month'
                                    AND i.amount > i.paid_amount), 0) AS dpd
                FROM months m ORDER BY m.m"""), {"acc": a["id"]})).mappings().all()

            today = float(a["risk_score"])
            # Risk tracks the balance and the ageing; the series is scaled so it
            # arrives exactly at the score the account carries now.
            raw = []
            for r in rows:
                bal, dpd = max(float(r["balance"]), 0.0), max(int(r["dpd"]), 0)
                raw.append(min(95.0, 8 + dpd * 0.45 + (bal / 400.0)))
            shift = today - raw[-1] if raw else 0.0

            for r, base in zip(rows, raw, strict=True):
                score = max(3.0, min(97.0, base + shift))
                await db.execute(text("""
                    INSERT INTO customer_schema.risk_history
                      (account_id, as_of_month, risk_score, dpd, outstanding)
                    VALUES (:acc, :m, :score, :dpd, :bal)
                    ON CONFLICT (account_id, as_of_month) DO UPDATE SET
                      risk_score = EXCLUDED.risk_score, dpd = EXCLUDED.dpd,
                      outstanding = EXCLUDED.outstanding"""),
                    {"acc": a["id"], "m": r["as_of"], "score": round(score, 2),
                     "dpd": max(int(r["dpd"]), 0),
                     "bal": round(max(float(r["balance"]), 0.0), 2)})

            trail = " → ".join(
                f"{max(3.0, min(97.0, b + shift)):.0f}" for b in raw)
            print(f"  {a['account_code']:<12} {trail}   (now {today:.1f}, "
                  f"{a['risk_level']})")

        await db.commit()

        gaps = (await db.execute(text("""
            SELECT count(*) FROM customer_schema.account a
            WHERE NOT EXISTS (SELECT 1 FROM customer_schema.risk_history h
                               WHERE h.account_id = a.id)"""))).scalar_one()
        drift = (await db.execute(text("""
            SELECT count(*) FROM customer_schema.account a
            JOIN LATERAL (SELECT risk_score FROM customer_schema.risk_history h
                          WHERE h.account_id = a.id
                          ORDER BY h.as_of_month DESC LIMIT 1) last ON TRUE
            WHERE abs(last.risk_score - a.risk_score) > 0.05"""))).scalar_one()
        print(f"\n  accounts with no history: {gaps}")
        print(f"  accounts whose last point disagrees with today's score: {drift}")


if __name__ == "__main__":
    asyncio.run(main())
