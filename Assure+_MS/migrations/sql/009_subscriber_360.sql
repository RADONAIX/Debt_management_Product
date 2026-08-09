-- =====================================================================================
--  009_subscriber_360.sql  ·  Subscriber 360 data model
--
--  Models a telecom operator serving both retail consumers and enterprise
--  corporates, without disturbing the rest of the platform.
--
--  Shape
--      company ─< company_branch ─< department
--         │                │
--         │                └──────────────┐
--         └─< billing_account (BAN)        │
--                    │                     │
--      customer ─────┴──< account (SUBSCRIBER LINE) ──< invoice
--                                 │                       │
--                                 └── invoice_group_member ┘   (shared invoices)
--
--  `account` already carried plan, outstanding, DPD, aging, risk, strategy and
--  agent, so the subscriber line lives there rather than in a parallel table —
--  debt_case, ptp, payment and dispute keep pointing at the same row.
--  Idempotent.
-- =====================================================================================

BEGIN;

-- ---- 1. Enterprise hierarchy -------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_schema.company (
    id            BIGSERIAL     PRIMARY KEY,
    company_code  VARCHAR(30)   NOT NULL UNIQUE,        -- COMP-001 …
    name          VARCHAR(160)  NOT NULL,
    industry      VARCHAR(80),
    country_code  VARCHAR(60),
    hq_city       VARCHAR(80),
    account_manager_id BIGINT   REFERENCES administration.app_user(id) ON DELETE SET NULL,
    status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_schema.company_branch (
    id            BIGSERIAL     PRIMARY KEY,
    company_id    BIGINT        NOT NULL REFERENCES customer_schema.company(id) ON DELETE CASCADE,
    branch_code   VARCHAR(30)   NOT NULL UNIQUE,        -- BR-0001 …
    name          VARCHAR(120)  NOT NULL,
    city          VARCHAR(80),
    region_code   VARCHAR(60),
    region_category VARCHAR(40) GENERATED ALWAYS AS ('REGION') STORED,
    is_head_office BOOLEAN      NOT NULL DEFAULT FALSE,
    status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE','CLOSED')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT fk_branch_region FOREIGN KEY (region_category, region_code)
               REFERENCES administration.master_data (category, code),
    CONSTRAINT uq_branch_name UNIQUE (company_id, name)
);

-- Optional level: only the companies that bill per cost centre use it.
CREATE TABLE IF NOT EXISTS customer_schema.department (
    id            BIGSERIAL     PRIMARY KEY,
    branch_id     BIGINT        NOT NULL REFERENCES customer_schema.company_branch(id) ON DELETE CASCADE,
    name          VARCHAR(120)  NOT NULL,
    cost_centre   VARCHAR(40),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_department_name UNIQUE (branch_id, name)
);

-- ---- 2. Billing account (BAN) ------------------------------------------------------
-- Owned by a company (enterprise) or directly by a customer (consumer) — never both.
CREATE TABLE IF NOT EXISTS customer_schema.billing_account (
    id            BIGSERIAL     PRIMARY KEY,
    ban           VARCHAR(30)   NOT NULL UNIQUE,        -- BAN10001 …
    company_id    BIGINT        REFERENCES customer_schema.company(id) ON DELETE CASCADE,
    customer_id   BIGINT        REFERENCES customer_schema.customer(id) ON DELETE CASCADE,
    name          VARCHAR(160),                          -- "ABC Technologies — Corporate Voice"
    billing_cycle SMALLINT      NOT NULL DEFAULT 1 CHECK (billing_cycle BETWEEN 1 AND 28),
    payment_terms_days SMALLINT NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    currency_code VARCHAR(60)   NOT NULL DEFAULT 'AED',
    currency_category VARCHAR(40) GENERATED ALWAYS AS ('CURRENCY') STORED,
    credit_limit  NUMERIC(15,2) CHECK (credit_limit >= 0),
    status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT fk_ban_currency FOREIGN KEY (currency_category, currency_code)
               REFERENCES administration.master_data (category, code),
    CONSTRAINT ck_ban_owner CHECK (num_nonnulls(company_id, customer_id) = 1)
);

-- ---- 3. Subscriber line = account --------------------------------------------------
ALTER TABLE customer_schema.account
    ADD COLUMN IF NOT EXISTS subscriber_no      VARCHAR(30),
    ADD COLUMN IF NOT EXISTS service_type       VARCHAR(30),
    ADD COLUMN IF NOT EXISTS billing_account_id BIGINT
        REFERENCES customer_schema.billing_account(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS branch_id          BIGINT
        REFERENCES customer_schema.company_branch(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS department_id      BIGINT
        REFERENCES customer_schema.department(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS next_followup_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_subscriber_no
    ON customer_schema.account (subscriber_no) WHERE subscriber_no IS NOT NULL;

ALTER TABLE customer_schema.account DROP CONSTRAINT IF EXISTS ck_account_service_type;
ALTER TABLE customer_schema.account ADD CONSTRAINT ck_account_service_type CHECK (
    service_type IS NULL OR service_type IN
    ('Mobile Postpaid','Mobile Prepaid','Broadband','Fibre','IPTV','Leased Line','IoT/M2M'));

-- Employees of an enterprise point at their company.
ALTER TABLE customer_schema.customer
    ADD COLUMN IF NOT EXISTS company_id BIGINT
        REFERENCES customer_schema.company(id) ON DELETE SET NULL;

-- ---- 4. Invoice grouping -----------------------------------------------------------
-- A grouped invoice is raised against the BAN and covers many subscriber lines,
-- so account_id becomes optional and membership moves to its own table.
ALTER TABLE customer_schema.invoice
    ADD COLUMN IF NOT EXISTS billing_account_id BIGINT
        REFERENCES customer_schema.billing_account(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL';

ALTER TABLE customer_schema.invoice DROP CONSTRAINT IF EXISTS ck_invoice_type;
ALTER TABLE customer_schema.invoice ADD CONSTRAINT ck_invoice_type
    CHECK (invoice_type IN ('INDIVIDUAL','GROUPED'));

ALTER TABLE customer_schema.invoice ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE customer_schema.invoice DROP CONSTRAINT IF EXISTS ck_invoice_target;
ALTER TABLE customer_schema.invoice ADD CONSTRAINT ck_invoice_target CHECK (
    (invoice_type = 'INDIVIDUAL' AND account_id IS NOT NULL)
    OR (invoice_type = 'GROUPED' AND billing_account_id IS NOT NULL));

CREATE TABLE IF NOT EXISTS customer_schema.invoice_group_member (
    invoice_id   BIGINT        NOT NULL REFERENCES customer_schema.invoice(id) ON DELETE CASCADE,
    account_id   BIGINT        NOT NULL REFERENCES customer_schema.account(id) ON DELETE CASCADE,
    share_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (share_amount >= 0),
    PRIMARY KEY (invoice_id, account_id)
);

-- ---- 5. Indexes the 360 screen actually issues --------------------------------------
CREATE INDEX IF NOT EXISTS idx_branch_company     ON customer_schema.company_branch (company_id);
CREATE INDEX IF NOT EXISTS idx_ban_company        ON customer_schema.billing_account (company_id);
CREATE INDEX IF NOT EXISTS idx_account_ban        ON customer_schema.account (billing_account_id);
CREATE INDEX IF NOT EXISTS idx_account_branch     ON customer_schema.account (branch_id);
CREATE INDEX IF NOT EXISTS idx_account_dpd        ON customer_schema.account (dpd DESC, risk_level);
CREATE INDEX IF NOT EXISTS idx_invoice_ban        ON customer_schema.invoice (billing_account_id);
CREATE INDEX IF NOT EXISTS idx_igm_account        ON customer_schema.invoice_group_member (account_id);
CREATE INDEX IF NOT EXISTS idx_customer_company   ON customer_schema.customer (company_id);

GRANT ALL ON ALL TABLES IN SCHEMA customer_schema TO assure;
GRANT ALL ON ALL SEQUENCES IN SCHEMA customer_schema TO assure;

COMMIT;
