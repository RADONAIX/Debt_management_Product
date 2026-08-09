-- Recovery Workspace: external agency placement, recovery ledger and legal cases.
--
-- The lifecycle this models: an account that in-house collection could not
-- recover is PLACED with an agency; the agency remits RECOVERIES against that
-- placement; a placement may be REASSIGNED to another agency or RECALLED when
-- it goes stale; anything still unrecovered can be escalated to a LEGAL CASE.

CREATE SCHEMA IF NOT EXISTS recovery_schema;

-- --------------------------------------------------------------------------
-- Agencies
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_schema.agency (
    id                  BIGSERIAL PRIMARY KEY,
    agency_code         VARCHAR(30)  NOT NULL UNIQUE,
    name                VARCHAR(160) NOT NULL,
    agency_type         VARCHAR(40)  NOT NULL DEFAULT 'Consumer Debt',
    status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    -- Commercials
    commission_pct      NUMERIC(5,2) NOT NULL DEFAULT 15,
    -- A placement not recovered within this many days is eligible for recall.
    recall_days         SMALLINT     NOT NULL DEFAULT 90,
    -- How many open placements the agency will accept at once.
    capacity            INTEGER      NOT NULL DEFAULT 250,
    min_placement       NUMERIC(14,2) NOT NULL DEFAULT 0,
    max_placement       NUMERIC(14,2),
    -- Contact
    contact_name        VARCHAR(120),
    contact_email       VARCHAR(160),
    contact_phone       VARCHAR(40),
    city                VARCHAR(80),
    country             VARCHAR(80),
    -- Coverage: which risk bands / buckets this agency is allowed to work.
    covers_risk         TEXT[],
    covers_bucket       TEXT[],
    onboarded_on        DATE,
    contract_end        DATE,
    notes               VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT agency_status_ck CHECK (status IN ('ACTIVE','SUSPENDED','UNDER_REVIEW','TERMINATED')),
    CONSTRAINT agency_commission_ck CHECK (commission_pct >= 0 AND commission_pct <= 100)
);

-- --------------------------------------------------------------------------
-- Placements — one account handed to one agency
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_schema.placement (
    id                  BIGSERIAL PRIMARY KEY,
    placement_code      VARCHAR(30)  NOT NULL UNIQUE,
    agency_id           BIGINT       NOT NULL REFERENCES recovery_schema.agency(id) ON DELETE RESTRICT,
    customer_id         BIGINT       NOT NULL REFERENCES customer_schema.customer(id) ON DELETE CASCADE,
    account_id          BIGINT       REFERENCES customer_schema.account(id) ON DELETE SET NULL,
    -- Amount handed over, and what is still open on it.
    placed_amount       NUMERIC(14,2) NOT NULL,
    recovered_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    commission_pct      NUMERIC(5,2)  NOT NULL,
    commission_accrued  NUMERIC(14,2) NOT NULL DEFAULT 0,
    status              VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    priority            VARCHAR(10)   NOT NULL DEFAULT 'Medium',
    dpd_at_placement    INTEGER       NOT NULL DEFAULT 0,
    risk_at_placement   VARCHAR(20),
    placed_on           DATE          NOT NULL DEFAULT CURRENT_DATE,
    recall_due          DATE,
    closed_on           DATE,
    last_activity       DATE,
    close_reason        VARCHAR(120),
    notes               VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT placement_status_ck CHECK (status IN ('ACTIVE','RECALLED','SETTLED','CLOSED','LEGAL')),
    CONSTRAINT placement_priority_ck CHECK (priority IN ('Low','Medium','High','Critical')),
    CONSTRAINT placement_amount_ck CHECK (placed_amount > 0),
    -- An account is with at most one agency at a time; recalled/closed rows may repeat.
    CONSTRAINT placement_recovered_ck CHECK (recovered_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS placement_one_open_per_account
    ON recovery_schema.placement (account_id)
    WHERE status IN ('ACTIVE','LEGAL');

CREATE INDEX IF NOT EXISTS placement_agency_idx  ON recovery_schema.placement (agency_id, status);
CREATE INDEX IF NOT EXISTS placement_customer_idx ON recovery_schema.placement (customer_id);

-- --------------------------------------------------------------------------
-- Recovery ledger — money the agency actually remitted
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_schema.recovery (
    id                  BIGSERIAL PRIMARY KEY,
    placement_id        BIGINT NOT NULL REFERENCES recovery_schema.placement(id) ON DELETE CASCADE,
    recovered_on        DATE   NOT NULL DEFAULT CURRENT_DATE,
    amount              NUMERIC(14,2) NOT NULL,
    commission          NUMERIC(14,2) NOT NULL DEFAULT 0,
    method              VARCHAR(40) NOT NULL DEFAULT 'Bank Transfer',
    reference           VARCHAR(60),
    remitted            BOOLEAN NOT NULL DEFAULT FALSE,
    note                VARCHAR(300),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recovery_amount_ck CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS recovery_placement_idx ON recovery_schema.recovery (placement_id, recovered_on DESC);

-- --------------------------------------------------------------------------
-- Placement audit trail — every assign, reassign, recall and close
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_schema.placement_event (
    id                  BIGSERIAL PRIMARY KEY,
    placement_id        BIGINT NOT NULL REFERENCES recovery_schema.placement(id) ON DELETE CASCADE,
    event_type          VARCHAR(30) NOT NULL,
    from_agency_id      BIGINT REFERENCES recovery_schema.agency(id) ON DELETE SET NULL,
    to_agency_id        BIGINT REFERENCES recovery_schema.agency(id) ON DELETE SET NULL,
    detail              VARCHAR(400),
    actor               VARCHAR(160),
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS placement_event_idx ON recovery_schema.placement_event (placement_id, occurred_at DESC);

-- --------------------------------------------------------------------------
-- Legal cases — escalation beyond agency recovery
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_schema.legal_case (
    id                  BIGSERIAL PRIMARY KEY,
    case_code           VARCHAR(30) NOT NULL UNIQUE,
    customer_id         BIGINT NOT NULL REFERENCES customer_schema.customer(id) ON DELETE CASCADE,
    placement_id        BIGINT REFERENCES recovery_schema.placement(id) ON DELETE SET NULL,
    claim_amount        NUMERIC(14,2) NOT NULL,
    legal_cost          NUMERIC(14,2) NOT NULL DEFAULT 0,
    recovered_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    stage               VARCHAR(30) NOT NULL DEFAULT 'Pre-Legal',
    status              VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    law_firm            VARCHAR(160),
    attorney            VARCHAR(120),
    court               VARCHAR(160),
    filed_on            DATE,
    next_hearing        DATE,
    success_probability NUMERIC(5,2),
    outcome             VARCHAR(120),
    notes               VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT legal_stage_ck CHECK (stage IN
        ('Pre-Legal','Notice Served','Filed','Discovery','Hearing','Judgment','Post-Judgment','Settled','Withdrawn')),
    CONSTRAINT legal_status_ck CHECK (status IN ('OPEN','WON','LOST','SETTLED','WITHDRAWN'))
);

CREATE INDEX IF NOT EXISTS legal_case_customer_idx ON recovery_schema.legal_case (customer_id);

-- Case timeline
CREATE TABLE IF NOT EXISTS recovery_schema.legal_event (
    id                  BIGSERIAL PRIMARY KEY,
    case_id             BIGINT NOT NULL REFERENCES recovery_schema.legal_case(id) ON DELETE CASCADE,
    event_type          VARCHAR(40) NOT NULL,
    detail              VARCHAR(400),
    actor               VARCHAR(160),
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_event_idx ON recovery_schema.legal_event (case_id, occurred_at DESC);

-- --------------------------------------------------------------------------
-- Workspace configuration — the rules the workspace runs by
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_schema.recovery_config (
    key                 VARCHAR(60) PRIMARY KEY,
    value               VARCHAR(200) NOT NULL,
    label               VARCHAR(160) NOT NULL,
    description         VARCHAR(300),
    value_type          VARCHAR(20) NOT NULL DEFAULT 'number',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA recovery_schema TO assure;
GRANT ALL ON ALL TABLES IN SCHEMA recovery_schema TO assure;
GRANT ALL ON ALL SEQUENCES IN SCHEMA recovery_schema TO assure;
ALTER DEFAULT PRIVILEGES IN SCHEMA recovery_schema GRANT ALL ON TABLES TO assure;
ALTER DEFAULT PRIVILEGES IN SCHEMA recovery_schema GRANT ALL ON SEQUENCES TO assure;
