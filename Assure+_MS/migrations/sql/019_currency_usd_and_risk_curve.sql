-- =====================================================================================
--  019_currency_usd_and_risk_curve.sql
--
--  1. Bill in USD so the stored currency matches what the screens display.
--  2. Give the risk trend a realistic shape. It was a straight climb — every
--     customer's score rising month on month — because it was generated as a
--     linear ramp. Real scores drift: they wobble month to month around a trend
--     that only turns sharply when the account actually deteriorates.
--  Idempotent.
-- =====================================================================================

BEGIN;

UPDATE customer_schema.account         SET currency_code = 'USD' WHERE currency_code <> 'USD';
UPDATE customer_schema.billing_account SET currency_code = 'USD' WHERE currency_code <> 'USD';

-- ---- Risk trend -------------------------------------------------------------------
-- Six months ending at today's score. `drift` is the underlying direction (a
-- healthy line improves slightly, a delinquent one worsens); `wobble` is the
-- month-to-month noise, deterministic per account so it never re-rolls.
UPDATE customer_schema.risk_history h SET risk_score = calc.score
  FROM (
    SELECT h2.account_id, h2.as_of_month,
           GREATEST(1, LEAST(100, round((
               a.risk_score
               -- Wind back from today along the account's underlying direction:
               -- a delinquent line has been worsening, a current one improving.
               - (CASE WHEN a.dpd > 30 THEN 1 ELSE -1 END)
                 * (CASE WHEN a.dpd > 90 THEN 6.5 WHEN a.dpd > 30 THEN 4.0 ELSE 1.5 END)
                 * mb.months_back
               -- Month-to-month noise of ±6 points, fixed per account.
               + (((a.id * 7 + mb.months_back * 13) % 13) - 6)
           )::numeric, 2))) AS score
      FROM customer_schema.risk_history h2
      JOIN customer_schema.account a ON a.id = h2.account_id
      CROSS JOIN LATERAL (
        SELECT (date_part('year',  age(date_trunc('month', CURRENT_DATE), h2.as_of_month)) * 12
              + date_part('month', age(date_trunc('month', CURRENT_DATE), h2.as_of_month)))::int
               AS months_back
      ) mb
  ) calc
 WHERE calc.account_id = h.account_id AND calc.as_of_month = h.as_of_month;

-- The most recent month must equal the score the account carries today.
UPDATE customer_schema.risk_history h SET risk_score = a.risk_score
  FROM customer_schema.account a
 WHERE a.id = h.account_id
   AND h.as_of_month = date_trunc('month', CURRENT_DATE)::date;

COMMIT;
