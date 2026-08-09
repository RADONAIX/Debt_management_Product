-- =====================================================================================
--  029_reseed_strategies.sql
--
--  The six reference collection strategies (deleted while testing the designer).
--  Each carries the suitability profile the Strategy Designer edits, so the risk
--  grid can match a line's ageing band to the right journey.
--  Idempotent.
-- =====================================================================================

BEGIN;

INSERT INTO public.strategy (
    strategy_code, name, description, segment_code, aging_bucket, risk_level, status,
    current_version, behaviour_type, emotion_type, minimum_income, maximum_income,
    minimum_loan, maximum_loan, success_rate, average_collection, average_turns,
    workflow_json, activated_at)
VALUES
 ('STR-001','Soft Reminder','Courtesy reminder before the account ages',
  'Consumer', ARRAY['Current','1-30'], ARRAY['Low'], 'ACTIVE','v1.8',
  ARRAY['Willing','Forgetful'], ARRAY['Cooperative'], 4000, 30000, 0, 2000,
  78.5, 240, 1.4, '{"nodes":[],"edges":[]}'::jsonb, now()),
 ('STR-002','Standard Dunning','Reminder cycle across SMS, email and dialer',
  'Consumer', ARRAY['1-30','31-60'], ARRAY['Low','Medium'], 'ACTIVE','v2.4',
  ARRAY['Forgetful'], ARRAY['Neutral'], 4000, 30000, 0, 3000,
  64.2, 410, 2.6, '{"nodes":[],"edges":[]}'::jsonb, now()),
 ('STR-003','AI Adaptive','Model-selected channel and timing per subscriber',
  'Enterprise', ARRAY['31-60'], ARRAY['Medium'], 'ACTIVE','v3.1',
  ARRAY['Evasive'], ARRAY['Anxious'], 6000, 60000, 0, 8000,
  58.9, 780, 3.2, '{"nodes":[],"edges":[]}'::jsonb, now()),
 ('STR-004','Intensive Recovery','Supervisor calls and settlement offers',
  'Enterprise', ARRAY['61-90'], ARRAY['High'], 'ACTIVE','v3.0',
  ARRAY['Evasive','Disputed'], ARRAY['Frustrated'], 6000, 90000, 0, 15000,
  46.3, 1450, 4.8, '{"nodes":[],"edges":[]}'::jsonb, now()),
 ('STR-005','Pre-Legal','Final notice ahead of legal escalation',
  'Enterprise', ARRAY['90+'], ARRAY['High','Critical'], 'ACTIVE','v1.5',
  ARRAY['Disputed'], ARRAY['Hostile'], 0, 200000, 0, 50000,
  31.7, 2600, 6.1, '{"nodes":[],"edges":[]}'::jsonb, now()),
 ('STR-006','Agency Allocation','Handed to an external recovery agency',
  'Consumer', ARRAY['90+'], ARRAY['Critical'], 'ACTIVE','v1.3',
  ARRAY['Disputed'], ARRAY['Hostile'], 0, 200000, 0, 50000,
  27.4, 1900, 5.4, '{"nodes":[],"edges":[]}'::jsonb, now())
ON CONFLICT (strategy_code) DO NOTHING;

-- Match every line to the strategy built for its ageing band.
UPDATE customer_schema.account a SET strategy_id = s.id
  FROM public.strategy s
 WHERE s.strategy_code = CASE
        WHEN a.dpd = 0   THEN 'STR-001'
        WHEN a.dpd <= 30 THEN 'STR-002'
        WHEN a.dpd <= 60 THEN 'STR-003'
        WHEN a.dpd <= 90 THEN 'STR-004'
        ELSE CASE WHEN a.outstanding >= 3000 THEN 'STR-005' ELSE 'STR-006' END
       END;

COMMIT;
