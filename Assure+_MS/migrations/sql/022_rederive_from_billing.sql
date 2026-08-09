-- =====================================================================================
--  022_rederive_from_billing.sql
--
--  Risk, history, cases and promises were computed from the old balances, so
--  they are re-derived once the billing reconciliation in 021 has settled.
--  Idempotent.
-- =====================================================================================

BEGIN;

-- ---- Risk from behaviour (same weighting as 020) ------------------------------------
UPDATE customer_schema.account a SET
    risk_score = GREATEST(1, LEAST(100, round((
          0.55 * LEAST(100, a.dpd * 100.0 / 120)
        + 0.25 * GREATEST(0, (900 - COALESCE(c.credit_score, 650)) * 100.0 / 600)
        + 0.20 * (100 - a.contactability)
    )::numeric, 2)))
  FROM customer_schema.customer c
 WHERE c.id = a.customer_id;

UPDATE customer_schema.account SET risk_level = CASE
    WHEN risk_score >= 75 THEN 'Critical' WHEN risk_score >= 55 THEN 'High'
    WHEN risk_score >= 30 THEN 'Medium'   ELSE 'Low' END;

UPDATE customer_schema.customer c SET
    risk_score = agg.worst,
    risk_level = CASE WHEN agg.worst >= 75 THEN 'Critical' WHEN agg.worst >= 55 THEN 'High'
                      WHEN agg.worst >= 30 THEN 'Medium'   ELSE 'Low' END
  FROM (SELECT customer_id, max(risk_score) AS worst
          FROM customer_schema.account GROUP BY customer_id) agg
 WHERE agg.customer_id = c.id;

UPDATE customer_schema.customer SET
    financial_stress     = CASE WHEN risk_score >= 66 THEN 'High' WHEN risk_score >= 33 THEN 'Medium' ELSE 'Low' END,
    risk_appetite        = CASE WHEN risk_score >= 66 THEN 'High' WHEN risk_score >= 33 THEN 'Medium' ELSE 'Low' END,
    employment_stability = CASE WHEN risk_score >= 66 THEN 'Low'  WHEN risk_score >= 33 THEN 'Medium' ELSE 'High' END,
    responsibility_score = GREATEST(5, LEAST(100, 100 - risk_score)),
    behaviour_type  = CASE risk_level WHEN 'Low' THEN 'Willing' WHEN 'Medium' THEN 'Forgetful'
                                      WHEN 'High' THEN 'Evasive' ELSE 'Disputed' END,
    emotional_state = CASE risk_level WHEN 'Low' THEN 'Cooperative' WHEN 'Medium' THEN 'Neutral'
                                      WHEN 'High' THEN 'Anxious' ELSE 'Frustrated' END;

-- ---- History follows the corrected balances -----------------------------------------
UPDATE customer_schema.risk_history h SET
    outstanding = calc.outstanding, dpd = calc.dpd, risk_score = calc.score
  FROM (
    SELECT h2.account_id, h2.as_of_month,
           round(a.monthly_bill * GREATEST(1, LEAST(5, 6 - mb.months_back)), 2) AS outstanding,
           GREATEST(0, a.dpd - mb.months_back * 30) AS dpd,
           GREATEST(1, LEAST(100, round((
               a.risk_score
               - (CASE WHEN a.dpd > 30 THEN 1 ELSE -1 END)
                 * (CASE WHEN a.dpd > 90 THEN 6.5 WHEN a.dpd > 30 THEN 4.0 ELSE 1.5 END)
                 * mb.months_back
               + (((a.id * 7 + mb.months_back * 13) % 13) - 6)
           )::numeric, 2))) AS score
      FROM customer_schema.risk_history h2
      JOIN customer_schema.account a ON a.id = h2.account_id
      CROSS JOIN LATERAL (
        SELECT (date_part('year',  age(date_trunc('month', CURRENT_DATE), h2.as_of_month)) * 12
              + date_part('month', age(date_trunc('month', CURRENT_DATE), h2.as_of_month)))::int
               AS months_back) mb
  ) calc
 WHERE calc.account_id = h.account_id AND calc.as_of_month = h.as_of_month;

UPDATE customer_schema.risk_history h SET risk_score = a.risk_score, dpd = a.dpd,
       outstanding = a.outstanding
  FROM customer_schema.account a
 WHERE a.id = h.account_id AND h.as_of_month = date_trunc('month', CURRENT_DATE)::date;

-- ---- Cases, promises and disputes quote the corrected balance -----------------------
UPDATE customer_schema.debt_case dc SET
    amount = a.outstanding, dpd = a.dpd, risk_level = a.risk_level,
    dunning_stage = a.dunning_stage,
    status = CASE WHEN a.dpd > 90 THEN 'LEGAL' WHEN a.dpd > 60 THEN 'ESCALATED'
                  WHEN a.dpd > 30 THEN 'IN_PROGRESS' ELSE 'OPEN' END
  FROM customer_schema.account a WHERE a.id = dc.account_id;

-- A line that no longer owes anything has no open case.
DELETE FROM customer_schema.case_activity
 WHERE case_id IN (SELECT dc.id FROM customer_schema.debt_case dc
                     JOIN customer_schema.account a ON a.id = dc.account_id
                    WHERE a.outstanding = 0 AND a.dpd = 0);
DELETE FROM customer_schema.ptp
 WHERE account_id IN (SELECT id FROM customer_schema.account WHERE dpd = 0 AND outstanding = 0);
DELETE FROM customer_schema.dispute
 WHERE account_id IN (SELECT id FROM customer_schema.account WHERE dpd = 0 AND outstanding = 0);
DELETE FROM customer_schema.debt_case dc
 USING customer_schema.account a
 WHERE a.id = dc.account_id AND a.outstanding = 0 AND a.dpd = 0;

UPDATE customer_schema.ptp t SET
    promised_amount = round(a.outstanding * 0.6, 2),
    kept_amount = CASE WHEN t.status = 'KEPT' THEN round(a.outstanding * 0.6, 2) ELSE 0 END
  FROM customer_schema.account a WHERE a.id = t.account_id AND a.outstanding > 0;

UPDATE customer_schema.dispute d SET amount = round(a.monthly_bill * 0.4, 2)
  FROM customer_schema.account a WHERE a.id = d.account_id;

COMMIT;
