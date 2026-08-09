-- =====================================================================================
--  032_subscriber_profile_scoring.sql
--
--  Prepares customer_schema.subscriber_risk_profile to be the output of the
--  configurable rules rather than a one-off insert:
--
--    * de-duplicates it (some lines had several rows) and adds a unique key so
--      the engine can upsert
--    * adds financial_literacy to the rule catalog, with a band ladder, so all
--      seven scores in the table are configurable
--    * every band gets a qualitative label (Low / Medium / High) — that label is
--      what the Subscriber Profile shows, instead of the static customer column
--
--  Idempotent.
-- =====================================================================================

BEGIN;

-- ---- 1. One row per subscriber line -------------------------------------------------
DELETE FROM customer_schema.subscriber_risk_profile s
 USING customer_schema.subscriber_risk_profile keep
 WHERE s.subscriber_id = keep.subscriber_id
   AND (keep.last_calculated, keep.id) > (s.last_calculated, s.id);

-- Rows pointing at a line that no longer exists are dead weight.
DELETE FROM customer_schema.subscriber_risk_profile s
 WHERE NOT EXISTS (SELECT 1 FROM customer_schema.account a WHERE a.id = s.subscriber_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriber_risk_profile_subscriber
    ON customer_schema.subscriber_risk_profile (subscriber_id);

-- ---- 2. Financial literacy joins the configurable scores ----------------------------
INSERT INTO administration.risk_score_definition
       (code, name, description, driver_field, weight_pct, direction, sort_order)
VALUES ('financial_literacy', 'Financial Literacy',
        'Understanding of billing and credit, inferred from the credit score',
        'credit_score', 0, 'HIGHER_BETTER', 7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO administration.risk_score_band (definition_id, sort_order, min_value, score, label)
SELECT d.id, b.ord, b.min_value, b.score, b.label
  FROM administration.risk_score_definition d
  JOIN (VALUES
    (1, 720, 90, 'High'),
    (2, 580, 65, 'Medium'),
    (3, NULL, 35, 'Low')
  ) AS b(ord, min_value, score, label) ON TRUE
 WHERE d.code = 'financial_literacy'
   AND NOT EXISTS (SELECT 1 FROM administration.risk_score_band x WHERE x.definition_id = d.id);

-- ---- 3. Give every existing band a qualitative label --------------------------------
-- The label is the value the 360 screen displays, so it must never be blank.
UPDATE administration.risk_score_band b SET label = CASE
        WHEN b.score >= 75 THEN 'High'
        WHEN b.score >= 45 THEN 'Medium'
        ELSE 'Low'
    END
 WHERE b.label IS NULL OR btrim(b.label) = '';

COMMIT;
