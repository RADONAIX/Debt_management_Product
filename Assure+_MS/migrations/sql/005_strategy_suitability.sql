-- =====================================================================================
--  005_strategy_suitability.sql
--
--  Adds the suitability profile and outcome metrics the Strategy Library shows:
--    Suitable Behaviour / Emotion / Loan Size / Income Range
--    Success %, Failure %, Average Recovery, Average Negotiation Time
--
--  Suitable DPD and Suitable Risk already exist as aging_bucket and risk_level.
--  Failure % is not stored — it is 100 - success_rate and would only ever drift.
--  Idempotent.
-- =====================================================================================

BEGIN;

ALTER TABLE public.strategy
    -- Who the strategy suits.
    ADD COLUMN IF NOT EXISTS behaviour_type   VARCHAR(40),
    ADD COLUMN IF NOT EXISTS emotion_type     VARCHAR(40),
    ADD COLUMN IF NOT EXISTS minimum_income   NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS maximum_income   NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS minimum_loan     NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS maximum_loan     NUMERIC(14,2),
    -- How it performs. success_rate already exists.
    ADD COLUMN IF NOT EXISTS average_collection NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS average_turns      NUMERIC(6,2);

-- Ranges must not be inverted.
ALTER TABLE public.strategy DROP CONSTRAINT IF EXISTS ck_strategy_income_range;
ALTER TABLE public.strategy ADD CONSTRAINT ck_strategy_income_range
    CHECK (minimum_income IS NULL OR maximum_income IS NULL OR maximum_income >= minimum_income);

ALTER TABLE public.strategy DROP CONSTRAINT IF EXISTS ck_strategy_loan_range;
ALTER TABLE public.strategy ADD CONSTRAINT ck_strategy_loan_range
    CHECK (minimum_loan IS NULL OR maximum_loan IS NULL OR maximum_loan >= minimum_loan);

COMMENT ON COLUMN public.strategy.behaviour_type IS
    'Payment behaviour the strategy suits, e.g. Willing, Evasive, Disputed';
COMMENT ON COLUMN public.strategy.emotion_type IS
    'Emotional tone the journey is written for, e.g. Cooperative, Anxious, Hostile';
COMMENT ON COLUMN public.strategy.average_collection IS
    'Average amount recovered per treated account';
COMMENT ON COLUMN public.strategy.average_turns IS
    'Average negotiation turns (contacts) before resolution';

COMMIT;
