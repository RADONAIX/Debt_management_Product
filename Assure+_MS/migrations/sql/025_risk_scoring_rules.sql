-- =====================================================================================
--  025_risk_scoring_rules.sql  ·  Configurable risk scoring
--
--  Each component score (Financial Stress, Responsibility, …) is either
--  RULE-based — a ladder of thresholds over one field — or ML-based, decided by
--  a switch per score. Thresholds are rows, so they can be edited or added from
--  the Risk Analysis screen without a code change.
--
--      risk_score_definition   one row per score: mode, driver field, weight
--      risk_score_band         the threshold ladder for a rule-based score
--
--  Seeded from the scoring SQL currently in use. Idempotent.
-- =====================================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS administration.risk_score_definition (
    id           BIGSERIAL    PRIMARY KEY,
    code         VARCHAR(40)  NOT NULL UNIQUE,     -- financial_stress, responsibility …
    name         VARCHAR(80)  NOT NULL,
    description  VARCHAR(255),
    mode         VARCHAR(10)  NOT NULL DEFAULT 'RULE' CHECK (mode IN ('RULE','ML')),
    -- The account/customer field the ladder is evaluated against.
    driver_field VARCHAR(60),
    -- Share of the overall risk score (0 = not part of the roll-up).
    weight_pct   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (weight_pct BETWEEN 0 AND 100),
    direction    VARCHAR(20)  NOT NULL DEFAULT 'HIGHER_WORSE'
                 CHECK (direction IN ('HIGHER_WORSE','HIGHER_BETTER')),
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One rung of the ladder: "field >= min_value  →  score".
CREATE TABLE IF NOT EXISTS administration.risk_score_band (
    id            BIGSERIAL    PRIMARY KEY,
    definition_id BIGINT       NOT NULL
                  REFERENCES administration.risk_score_definition(id) ON DELETE CASCADE,
    sort_order    INTEGER      NOT NULL DEFAULT 0,
    min_value     NUMERIC(14,2),                   -- NULL = the catch-all "else"
    score         NUMERIC(6,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
    label         VARCHAR(80),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_band_definition
    ON administration.risk_score_band (definition_id, sort_order);

-- ---- Definitions -------------------------------------------------------------------
INSERT INTO administration.risk_score_definition
       (code, name, description, driver_field, weight_pct, direction, sort_order)
VALUES
 ('financial_stress','Financial Stress','Exposure carried by the account','outstanding',20,'HIGHER_WORSE',1),
 ('responsibility','Responsibility','Broken promises, disputes and late settlement','broken_ptp_count',15,'HIGHER_BETTER',2),
 ('cooperation','Cooperation','Share of contact attempts that reached the customer','contact_success_rate',15,'HIGHER_BETTER',3),
 ('credit_awareness','Credit Awareness','How promptly bills are settled','dpd',0,'HIGHER_BETTER',4),
 ('legal_awareness','Legal Awareness','Disputes raised against the account','dispute_count',0,'HIGHER_BETTER',5),
 ('employment_stability','Employment Stability','Stability implied by the customer type','customer_type',0,'HIGHER_BETTER',6),
 ('overall_risk','Overall Risk','Weighted roll-up of the components above','dpd',25,'HIGHER_WORSE',7)
ON CONFLICT (code) DO NOTHING;

-- ---- Bands, taken from the scoring SQL in use ---------------------------------------
INSERT INTO administration.risk_score_band (definition_id, sort_order, min_value, score, label)
SELECT d.id, b.ord, b.min_value, b.score, b.label
  FROM administration.risk_score_definition d
  JOIN (VALUES
    -- Financial stress: outstanding exposure
    ('financial_stress', 1, 200000, 100, '≥ 200,000'),
    ('financial_stress', 2, 100000,  80, '≥ 100,000'),
    ('financial_stress', 3,  50000,  60, '≥ 50,000'),
    ('financial_stress', 4,  25000,  40, '≥ 25,000'),
    ('financial_stress', 5,   NULL,  20, 'below 25,000'),
    -- Responsibility: penalties per broken promise
    ('responsibility', 1, 3, 20, '3+ broken promises'),
    ('responsibility', 2, 2, 50, '2 broken promises'),
    ('responsibility', 3, 1, 70, '1 broken promise'),
    ('responsibility', 4, NULL, 100, 'none'),
    -- Cooperation: contact success rate
    ('cooperation', 1, 80, 95, '≥ 80% reached'),
    ('cooperation', 2, 60, 80, '≥ 60% reached'),
    ('cooperation', 3, 40, 60, '≥ 40% reached'),
    ('cooperation', 4, 20, 40, '≥ 20% reached'),
    ('cooperation', 5, NULL, 20, 'below 20%'),
    -- Credit awareness: days past due
    ('credit_awareness', 1, 90, 20, '90+ days'),
    ('credit_awareness', 2, 60, 45, '60-89 days'),
    ('credit_awareness', 3, 30, 65, '30-59 days'),
    ('credit_awareness', 4, 15, 80, '15-29 days'),
    ('credit_awareness', 5, NULL, 95, 'under 15 days'),
    -- Legal awareness: disputes raised
    ('legal_awareness', 1, 3, 20, '3+ disputes'),
    ('legal_awareness', 2, 2, 50, '2 disputes'),
    ('legal_awareness', 3, 1, 70, '1 dispute'),
    ('legal_awareness', 4, NULL, 90, 'no disputes'),
    -- Employment stability: by customer type (0=consumer, 1=enterprise, 2=government)
    ('employment_stability', 1, 2, 95, 'Government'),
    ('employment_stability', 2, 1, 90, 'Enterprise'),
    ('employment_stability', 3, NULL, 70, 'Consumer'),
    -- Overall risk: days past due ladder
    ('overall_risk', 1, 180, 100, '180+ days'),
    ('overall_risk', 2, 120,  90, '120-179 days'),
    ('overall_risk', 3,  90,  80, '90-119 days'),
    ('overall_risk', 4,  60,  60, '60-89 days'),
    ('overall_risk', 5,  30,  40, '30-59 days'),
    ('overall_risk', 6, NULL,  20, 'under 30 days')
  ) AS b(code, ord, min_value, score, label) ON b.code = d.code
 WHERE NOT EXISTS (
   SELECT 1 FROM administration.risk_score_band x WHERE x.definition_id = d.id
 );

GRANT ALL ON administration.risk_score_definition, administration.risk_score_band TO assure;
GRANT ALL ON SEQUENCE administration.risk_score_definition_id_seq,
                      administration.risk_score_band_id_seq TO assure;

COMMIT;
