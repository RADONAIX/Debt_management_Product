-- =====================================================================================
--  007_strategy_multi_select.sql
--
--  A strategy can suit more than one behaviour, DPD bucket, risk band or
--  emotional tone, so those four become arrays. Existing single values are
--  preserved as one-element arrays. The CHECK constraints are replaced with
--  element-wise ones so the vocabularies still hold.
--  Idempotent.
-- =====================================================================================

BEGIN;

ALTER TABLE public.strategy DROP CONSTRAINT IF EXISTS strategy_aging_bucket_check;
ALTER TABLE public.strategy DROP CONSTRAINT IF EXISTS strategy_risk_level_check;

DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
         WHERE table_name = 'strategy' AND column_name = 'aging_bucket') <> 'ARRAY' THEN
        ALTER TABLE public.strategy
            ALTER COLUMN aging_bucket TYPE TEXT[]
                USING (CASE WHEN aging_bucket IS NULL THEN NULL ELSE ARRAY[aging_bucket] END),
            ALTER COLUMN risk_level TYPE TEXT[]
                USING (CASE WHEN risk_level IS NULL THEN NULL ELSE ARRAY[risk_level] END),
            ALTER COLUMN behaviour_type TYPE TEXT[]
                USING (CASE WHEN behaviour_type IS NULL THEN NULL ELSE ARRAY[behaviour_type] END),
            ALTER COLUMN emotion_type TYPE TEXT[]
                USING (CASE WHEN emotion_type IS NULL THEN NULL ELSE ARRAY[emotion_type] END);
    END IF;
END $$;

ALTER TABLE public.strategy DROP CONSTRAINT IF EXISTS ck_strategy_aging;
ALTER TABLE public.strategy ADD CONSTRAINT ck_strategy_aging CHECK (
    aging_bucket IS NULL OR aging_bucket <@ ARRAY['Current','1-30','31-60','61-90','90+']::TEXT[]);

ALTER TABLE public.strategy DROP CONSTRAINT IF EXISTS ck_strategy_risk;
ALTER TABLE public.strategy ADD CONSTRAINT ck_strategy_risk CHECK (
    risk_level IS NULL OR risk_level <@ ARRAY['Low','Medium','High','Critical']::TEXT[]);

ALTER TABLE public.strategy DROP CONSTRAINT IF EXISTS ck_strategy_behaviour;
ALTER TABLE public.strategy ADD CONSTRAINT ck_strategy_behaviour CHECK (
    behaviour_type IS NULL OR behaviour_type <@
    ARRAY['Willing','Forgetful','Evasive','Disputed','Hardship']::TEXT[]);

ALTER TABLE public.strategy DROP CONSTRAINT IF EXISTS ck_strategy_emotion;
ALTER TABLE public.strategy ADD CONSTRAINT ck_strategy_emotion CHECK (
    emotion_type IS NULL OR emotion_type <@
    ARRAY['Cooperative','Neutral','Anxious','Frustrated','Hostile']::TEXT[]);

COMMIT;
