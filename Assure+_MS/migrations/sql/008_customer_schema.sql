-- =====================================================================================
--  008_customer_schema.sql
--
--  1. Moves the customer-facing tables Customer 360 reads into `customer_schema`,
--     leaving operations/strategy tables in `public` and admin tables in
--     `administration`.
--  2. Adds the subscriber profile attributes the 360 screen shows.
--  Idempotent.
-- =====================================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS customer_schema;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'customer', 'account', 'invoice', 'payment',
        'debt_case', 'case_activity', 'ptp', 'dispute'
    ]
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
            EXECUTE format('ALTER TABLE public.%I SET SCHEMA customer_schema', t);
            RAISE NOTICE 'moved public.% -> customer_schema.%', t, t;
        END IF;
    END LOOP;
END $$;

-- Unqualified references keep resolving for psql and reporting tools.
ALTER DATABASE "Debt_management_db"
    SET search_path TO public, customer_schema, administration;

-- ---- Subscriber 360 profile --------------------------------------------------------
ALTER TABLE customer_schema.customer
    ADD COLUMN IF NOT EXISTS behaviour_type          VARCHAR(40),
    ADD COLUMN IF NOT EXISTS preferred_language      VARCHAR(40),
    ADD COLUMN IF NOT EXISTS communication_preference VARCHAR(40),
    ADD COLUMN IF NOT EXISTS occupation              VARCHAR(80),
    ADD COLUMN IF NOT EXISTS monthly_income          NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS financial_stress        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS legal_awareness         VARCHAR(20),
    ADD COLUMN IF NOT EXISTS financial_literacy      VARCHAR(20),
    ADD COLUMN IF NOT EXISTS responsibility_score    NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS credit_awareness        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS risk_appetite           VARCHAR(20),
    ADD COLUMN IF NOT EXISTS emotional_state         VARCHAR(40),
    ADD COLUMN IF NOT EXISTS life_event              VARCHAR(80),
    ADD COLUMN IF NOT EXISTS employment_stability    VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cooperation_score       NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS preferred_contact_time  VARCHAR(40);

-- Scores are percentages; the graded attributes share one Low/Medium/High scale.
ALTER TABLE customer_schema.customer DROP CONSTRAINT IF EXISTS ck_customer_scores;
ALTER TABLE customer_schema.customer ADD CONSTRAINT ck_customer_scores CHECK (
    (responsibility_score IS NULL OR responsibility_score BETWEEN 0 AND 100) AND
    (cooperation_score   IS NULL OR cooperation_score   BETWEEN 0 AND 100));

ALTER TABLE customer_schema.customer DROP CONSTRAINT IF EXISTS ck_customer_grades;
ALTER TABLE customer_schema.customer ADD CONSTRAINT ck_customer_grades CHECK (
    (financial_stress     IS NULL OR financial_stress     IN ('Low','Medium','High')) AND
    (legal_awareness      IS NULL OR legal_awareness      IN ('Low','Medium','High')) AND
    (financial_literacy   IS NULL OR financial_literacy   IN ('Low','Medium','High')) AND
    (credit_awareness     IS NULL OR credit_awareness     IN ('Low','Medium','High')) AND
    (risk_appetite        IS NULL OR risk_appetite        IN ('Low','Medium','High')) AND
    (employment_stability IS NULL OR employment_stability IN ('Low','Medium','High')));

GRANT USAGE ON SCHEMA customer_schema TO assure;
GRANT ALL ON ALL TABLES IN SCHEMA customer_schema TO assure;
GRANT ALL ON ALL SEQUENCES IN SCHEMA customer_schema TO assure;
ALTER DEFAULT PRIVILEGES IN SCHEMA customer_schema GRANT ALL ON TABLES TO assure;

COMMIT;
