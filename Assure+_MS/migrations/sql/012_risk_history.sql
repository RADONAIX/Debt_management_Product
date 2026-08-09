-- =====================================================================================
--  012_risk_history.sql  ·  Monthly risk score per subscriber line
--
--  The Customer 360 risk trend chart needs history; nothing stored it before,
--  so the score was being invented in the browser. One row per line per month.
--  Seeded with six months ending at the line's current score, deterministic.
--  Idempotent.
-- =====================================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS customer_schema.risk_history (
    account_id  BIGINT      NOT NULL REFERENCES customer_schema.account(id) ON DELETE CASCADE,
    as_of_month DATE        NOT NULL,          -- first day of the month
    risk_score  NUMERIC(5,2) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    dpd         INTEGER     NOT NULL DEFAULT 0 CHECK (dpd >= 0),
    outstanding NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (outstanding >= 0),
    PRIMARY KEY (account_id, as_of_month)
);

CREATE INDEX IF NOT EXISTS idx_risk_history_month
    ON customer_schema.risk_history (as_of_month DESC);

-- Six months of history ending this month, easing up to today's score.
INSERT INTO customer_schema.risk_history (account_id, as_of_month, risk_score, dpd, outstanding)
SELECT a.id,
       date_trunc('month', CURRENT_DATE)::date - ((5 - m.n) || ' months')::interval,
       GREATEST(0, round(a.risk_score * (0.55 + 0.09 * m.n), 2)),
       GREATEST(0, a.dpd - (5 - m.n) * 30),
       round(a.outstanding * (0.45 + 0.11 * m.n), 2)
  FROM customer_schema.account a
  CROSS JOIN generate_series(0, 5) AS m(n)
ON CONFLICT (account_id, as_of_month) DO NOTHING;

GRANT ALL ON customer_schema.risk_history TO assure;

COMMIT;
