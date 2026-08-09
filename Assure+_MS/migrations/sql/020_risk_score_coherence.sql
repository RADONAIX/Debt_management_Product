-- =====================================================================================
--  020_risk_score_coherence.sql
--
--  Risk was seeded independently of behaviour, so a line 40 days overdue could
--  score 7/100 while a line paid up scored 80. The score is now derived from
--  what the account actually does:
--
--      55%  delinquency (DPD)
--      25%  credit score (inverted)
--      20%  reachability (inverted contactability)
--
--  The customer inherits the worst of their lines, and the six-month history is
--  rebuilt on top. Idempotent.
-- =====================================================================================

BEGIN;

UPDATE customer_schema.account a SET
    risk_score = GREATEST(1, LEAST(100, round((
          0.55 * LEAST(100, a.dpd * 100.0 / 120)                       -- 120+ days = full weight
        + 0.25 * GREATEST(0, (900 - COALESCE(c.credit_score, 650)) * 100.0 / 600)
        + 0.20 * (100 - a.contactability)
    )::numeric, 2))),
    risk_level = CASE
        WHEN a.dpd > 90 THEN 'Critical'
        WHEN a.dpd > 60 THEN 'High'
        WHEN a.dpd > 30 THEN 'Medium'
        WHEN a.dpd > 0  THEN 'Medium'
        ELSE 'Low' END
  FROM customer_schema.customer c
 WHERE c.id = a.customer_id;

-- Recompute the band from the finished score where it disagrees with the DPD view.
UPDATE customer_schema.account SET risk_level = CASE
    WHEN risk_score >= 75 THEN 'Critical'
    WHEN risk_score >= 55 THEN 'High'
    WHEN risk_score >= 30 THEN 'Medium'
    ELSE 'Low' END;

-- The customer carries the worst of their lines.
UPDATE customer_schema.customer c SET
    risk_score = agg.worst,
    risk_level = CASE
        WHEN agg.worst >= 75 THEN 'Critical'
        WHEN agg.worst >= 55 THEN 'High'
        WHEN agg.worst >= 30 THEN 'Medium'
        ELSE 'Low' END
  FROM (SELECT customer_id, max(risk_score) AS worst
          FROM customer_schema.account GROUP BY customer_id) agg
 WHERE agg.customer_id = c.id;

-- Behavioural attributes follow the corrected score.
UPDATE customer_schema.customer SET
    financial_stress = CASE WHEN risk_score >= 66 THEN 'High' WHEN risk_score >= 33 THEN 'Medium' ELSE 'Low' END,
    risk_appetite    = CASE WHEN risk_score >= 66 THEN 'High' WHEN risk_score >= 33 THEN 'Medium' ELSE 'Low' END,
    employment_stability = CASE WHEN risk_score >= 66 THEN 'Low' WHEN risk_score >= 33 THEN 'Medium' ELSE 'High' END,
    responsibility_score = GREATEST(5, LEAST(100, 100 - risk_score)),
    behaviour_type = CASE risk_level
        WHEN 'Low' THEN 'Willing' WHEN 'Medium' THEN 'Forgetful'
        WHEN 'High' THEN 'Evasive' ELSE 'Disputed' END,
    emotional_state = CASE risk_level
        WHEN 'Low' THEN 'Cooperative' WHEN 'Medium' THEN 'Neutral'
        WHEN 'High' THEN 'Anxious' ELSE 'Frustrated' END;

UPDATE customer_schema.debt_case dc SET risk_level = a.risk_level
  FROM customer_schema.account a WHERE a.id = dc.account_id;

-- ---- Rebuild the six-month curve on the corrected scores ----------------------------
UPDATE customer_schema.risk_history h SET risk_score = calc.score
  FROM (
    SELECT h2.account_id, h2.as_of_month,
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
               AS months_back
      ) mb
  ) calc
 WHERE calc.account_id = h.account_id AND calc.as_of_month = h.as_of_month;

UPDATE customer_schema.risk_history h SET risk_score = a.risk_score
  FROM customer_schema.account a
 WHERE a.id = h.account_id AND h.as_of_month = date_trunc('month', CURRENT_DATE)::date;

COMMIT;
