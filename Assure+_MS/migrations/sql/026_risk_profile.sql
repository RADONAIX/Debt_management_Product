-- =====================================================================================
--  026_risk_profile.sql  ·  Scored output of the risk rules
--
--  The rules in administration.risk_score_* are evaluated per subscriber line
--  and written here, so reports, strategies and case rules can read the scores
--  from a table instead of re-deriving them:
--
--      SELECT * FROM customer_schema.risk_profile rp WHERE rp.overall_risk_score > 70;
--
--  One row per account, refreshed whenever the rules are recalculated.
--  Idempotent.
-- =====================================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS customer_schema.risk_profile (
    account_id                  BIGINT       PRIMARY KEY
                                REFERENCES customer_schema.account(id) ON DELETE CASCADE,
    customer_id                 BIGINT       NOT NULL
                                REFERENCES customer_schema.customer(id) ON DELETE CASCADE,
    financial_stress_score      NUMERIC(6,2),
    responsibility_score        NUMERIC(6,2),
    cooperation_score           NUMERIC(6,2),
    credit_awareness_score      NUMERIC(6,2),
    legal_awareness_score       NUMERIC(6,2),
    employment_stability_score  NUMERIC(6,2),
    overall_risk_score          NUMERIC(6,2),
    risk_band                   VARCHAR(20)
                                CHECK (risk_band IN ('Low','Medium','High','Critical')),
    -- What the score was computed from, for auditability.
    rules_version               TIMESTAMPTZ,
    computed_at                 TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_profile_customer
    ON customer_schema.risk_profile (customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_profile_overall
    ON customer_schema.risk_profile (overall_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_risk_profile_band
    ON customer_schema.risk_profile (risk_band);

GRANT ALL ON customer_schema.risk_profile TO assure;

COMMIT;
