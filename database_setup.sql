-- =====================================================================================
--  RADONaix Assure+  ·  Debt Management Platform
--  database_setup.sql   —   PostgreSQL 14+   (tested on PostgreSQL 16)
--
--  Runs top-to-bottom with no modification:
--      psql -U postgres -f database_setup.sql
--
--  Contents
--      0.  Database creation
--      1.  Extensions & shared helpers
--      2.  Master / lookup data
--      3.  Authentication, authorisation & navigation
--      4.  Agents
--      5.  Configuration & settings
--      6.  Strategy (Dunning Strategy Studio)
--      7.  Portfolio (customer, account, invoice)
--      8.  Collections operations (case, PTP, payment, dispute, activity)
--      9.  Legal & agency
--     10.  Notifications & audit
--     11.  Indexes
--     12.  Deferred constraints (ALTER TABLE)
--     13.  Seed data  (roles, permissions, menu, admin user, masters, settings)
--     14.  Sample transactional data
--     15.  Verification
--
--  Design notes
--    * 27 tables. Every table is traceable to a screen — see docs/DATABASE_DESIGN.md.
--    * Dropdown values live in ONE reusable master table (`master_data`, keyed by
--      category+code). Columns that consume a dropdown store the plain code and are
--      integrity-checked with a composite FK on (category, code) using a constant
--      GENERATED column. This keeps API payloads identical to the current frontend
--      (plain strings — no joins needed to read a row) while still guaranteeing
--      referential integrity.
--    * Small, closed, code-driven state machines (record statuses, aging buckets,
--      risk levels) use CHECK constraints instead of lookup rows — cheaper and
--      self-documenting. Their display values are ALSO seeded into master_data so
--      filter dropdowns stay database-driven.
--    * Nothing that can be derived is stored twice: PTP counts, dispute counts,
--      collected-MTD, agency recovery totals and every report figure are computed
--      from the transactional tables (the frontend already derives them the same way).
-- =====================================================================================

-- =====================================================================================
-- 0.  DATABASE
-- =====================================================================================
-- The name is quoted so the mixed case requested is preserved verbatim.
-- Connect with:  jdbc:postgresql://localhost:5432/debt_management_db
DROP DATABASE IF EXISTS "debt_management_db";
CREATE DATABASE "debt_management_db"
    WITH ENCODING = 'UTF8'
         TEMPLATE  = template0
         LC_COLLATE = 'C'
         LC_CTYPE   = 'C';

\c "debt_management_db"

-- =====================================================================================
-- 1.  EXTENSIONS & SHARED HELPERS
-- =====================================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- bcrypt password hashing (crypt / gen_salt)

SET search_path = public;

-- Keeps updated_at honest without the application having to remember.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- 2.  MASTER / LOOKUP DATA
--     Screens: every filter bar, every <Select>, Admin Config → Currency Settings.
-- =====================================================================================
CREATE TABLE master_data (
    id            BIGSERIAL     PRIMARY KEY,
    category      VARCHAR(40)   NOT NULL,          -- SEGMENT, REGION, PRODUCT, CHANNEL …
    code          VARCHAR(60)   NOT NULL,          -- value stored on transactional rows
    label         VARCHAR(120)  NOT NULL,          -- what the dropdown shows
    description   VARCHAR(255),
    attributes    JSONB         NOT NULL DEFAULT '{}'::jsonb,  -- e.g. currency symbol/decimals
    sort_order    INTEGER       NOT NULL DEFAULT 0,
    is_default    BOOLEAN       NOT NULL DEFAULT FALSE,
    status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_master_data_category_code UNIQUE (category, code)
);
CREATE TRIGGER trg_master_data_updated BEFORE UPDATE ON master_data
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================================
-- 3.  AUTHENTICATION, AUTHORISATION & NAVIGATION
--     Screens: Login page, Admin Config → User Access, sidebar (navConfig.ts).
--
--     These live in their own `administration` schema, separate from the
--     business tables in `public`.
-- =====================================================================================
CREATE SCHEMA IF NOT EXISTS administration;
SET search_path TO administration, public;

CREATE TABLE role (
    id            BIGSERIAL    PRIMARY KEY,
    code          VARCHAR(40)  NOT NULL UNIQUE,     -- SUPER_ADMIN, ADMIN, SUPERVISOR, AGENT, FINANCE
    name          VARCHAR(80)  NOT NULL,
    description   VARCHAR(255),
    is_system     BOOLEAN      NOT NULL DEFAULT FALSE,   -- system roles cannot be deleted
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE','INACTIVE')),
    -- What this role may see and change, keyed by permission.code:
    --   {"caseManagement": {"view": true, "edit": true}, ...}
    -- Held as one document rather than a grant table: it is always read and
    -- written whole (login builds the matrix, Role Management saves it back).
    permissions   JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_role_updated BEFORE UPDATE ON role
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Catalog of capability keys used by navConfig.ts. Referenced by menu_item
-- and by the keys inside role.permissions.
CREATE TABLE permission (
    id            BIGSERIAL    PRIMARY KEY,
    code          VARCHAR(60)  NOT NULL UNIQUE,     -- 'portfoliodashboard', 'caseManagement' …
    name          VARCHAR(120) NOT NULL,
    module_group  VARCHAR(60)  NOT NULL,            -- sidebar group the capability belongs to
    description   VARCHAR(255),
    sort_order    INTEGER      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
    id                     BIGSERIAL    PRIMARY KEY,
    email                  VARCHAR(160) NOT NULL UNIQUE,
    full_name              VARCHAR(120) NOT NULL,
    phone                  VARCHAR(30),
    password_hash          VARCHAR(120),            -- NULL for pure SSO accounts
    role_id                BIGINT       NOT NULL REFERENCES role(id),
    department_code        VARCHAR(60),
    department_category    VARCHAR(40)  GENERATED ALWAYS AS ('DEPARTMENT') STORED,
    auth_provider          VARCHAR(20)  NOT NULL DEFAULT 'LOCAL'
                           CHECK (auth_provider IN ('LOCAL','GOOGLE','MICROSOFT')),
    external_id            VARCHAR(160),            -- Google / Microsoft subject id
    status                 VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                           CHECK (status IN ('ACTIVE','INACTIVE','LOCKED','PENDING')),
    failed_login_attempts  SMALLINT     NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until           TIMESTAMPTZ,
    last_login_at          TIMESTAMPTZ,
    last_login_ip          INET,
    password_changed_at    TIMESTAMPTZ,
    must_change_password   BOOLEAN      NOT NULL DEFAULT FALSE,
    reset_token            VARCHAR(120) UNIQUE,
    reset_token_expires_at TIMESTAMPTZ,
    avatar_url             VARCHAR(255),
    locale                 VARCHAR(10)  NOT NULL DEFAULT 'en',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by             BIGINT,
    updated_by             BIGINT,
    CONSTRAINT fk_user_department FOREIGN KEY (department_category, department_code)
               REFERENCES master_data (category, code),
    CONSTRAINT ck_user_local_pwd CHECK (auth_provider <> 'LOCAL' OR password_hash IS NOT NULL)
);
CREATE TRIGGER trg_app_user_updated BEFORE UPDATE ON app_user
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_session (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash    VARCHAR(120) NOT NULL UNIQUE,     -- SHA-256 of the issued JWT / refresh token
    issued_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ  NOT NULL,
    revoked_at    TIMESTAMPTZ,
    ip_address    INET,
    user_agent    VARCHAR(255),
    CONSTRAINT ck_session_window CHECK (expires_at > issued_at)
);

-- Drives the sidebar. Groups are rows with parent_id IS NULL.
CREATE TABLE menu_item (
    id            BIGSERIAL    PRIMARY KEY,
    code          VARCHAR(60)  NOT NULL UNIQUE,     -- 'overview', 'dashboard', 'case_management' …
    label         VARCHAR(120) NOT NULL,
    icon          VARCHAR(60),                      -- lucide-react icon name
    parent_id     BIGINT       REFERENCES menu_item(id) ON DELETE CASCADE,
    permission_id BIGINT       REFERENCES permission(id),
    module_key    VARCHAR(60),                      -- value written to activeModule
    sort_order    INTEGER      NOT NULL DEFAULT 0,
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                  CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_menu_item_updated BEFORE UPDATE ON menu_item
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================================
-- 3b. SUBSCRIBER 360  ·  enterprise hierarchy, billing accounts, invoice grouping
--     Screens: Subscriber 360 / Customer 360.
--     These live in `customer_schema` together with customer / account / invoice.
-- =====================================================================================
CREATE SCHEMA IF NOT EXISTS customer_schema;

-- An enterprise customer is a company; a consumer customer is an individual.
CREATE TABLE customer_schema.company (
    id            BIGSERIAL     PRIMARY KEY,
    company_code  VARCHAR(30)   NOT NULL UNIQUE,
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

CREATE TABLE customer_schema.company_branch (
    id            BIGSERIAL     PRIMARY KEY,
    company_id    BIGINT        NOT NULL REFERENCES customer_schema.company(id) ON DELETE CASCADE,
    branch_code   VARCHAR(30)   NOT NULL UNIQUE,
    name          VARCHAR(120)  NOT NULL,
    city          VARCHAR(80),
    region_code   VARCHAR(60),
    region_category VARCHAR(40) GENERATED ALWAYS AS ('REGION') STORED,
    is_head_office BOOLEAN      NOT NULL DEFAULT FALSE,
    status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CLOSED')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT fk_branch_region FOREIGN KEY (region_category, region_code)
               REFERENCES administration.master_data (category, code),
    CONSTRAINT uq_branch_name UNIQUE (company_id, name)
);

-- Optional level: only companies that bill per cost centre populate it.
CREATE TABLE customer_schema.department (
    id            BIGSERIAL     PRIMARY KEY,
    branch_id     BIGINT        NOT NULL REFERENCES customer_schema.company_branch(id) ON DELETE CASCADE,
    name          VARCHAR(120)  NOT NULL,
    cost_centre   VARCHAR(40),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_department_name UNIQUE (branch_id, name)
);

-- Billing Account Number. Owned by a company OR a consumer — never both.
CREATE TABLE customer_schema.billing_account (
    id            BIGSERIAL     PRIMARY KEY,
    ban           VARCHAR(30)   NOT NULL UNIQUE,
    company_id    BIGINT        REFERENCES customer_schema.company(id)  ON DELETE CASCADE,
    customer_id   BIGINT        REFERENCES customer_schema.customer(id) ON DELETE CASCADE,
    name          VARCHAR(160),
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

-- Which subscriber lines a consolidated (GROUPED) invoice covers.
CREATE TABLE customer_schema.invoice_group_member (
    invoice_id   BIGINT        NOT NULL REFERENCES customer_schema.invoice(id) ON DELETE CASCADE,
    account_id   BIGINT        NOT NULL REFERENCES customer_schema.account(id) ON DELETE CASCADE,
    share_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (share_amount >= 0),
    PRIMARY KEY (invoice_id, account_id)
);

-- The subscriber line itself lives on `account` (it already carries plan,
-- outstanding, DPD, ageing, risk, strategy and agent); these columns add the
-- telecom identity and the enterprise hierarchy links:
--   account.subscriber_no, service_type, billing_account_id, branch_id,
--          department_id, next_followup_date
--   customer.company_id                     -- employee -> employer
--   invoice.billing_account_id, invoice_type ('INDIVIDUAL' | 'GROUPED')

-- =====================================================================================
-- 4.  AGENTS
--     Screens: Agent Performance, Agent Dashboard, case/dispute assignment dialogs.
-- =====================================================================================
-- 1:1 extension of app_user — only collections agents get a row.
CREATE TABLE agent_profile (
    user_id             BIGINT       PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    employee_code       VARCHAR(30)  NOT NULL UNIQUE,      -- AGENT-001 …
    skill_group         VARCHAR(60),                       -- Collections-A / Collections-B
    expertise           VARCHAR(120),
    specializations     TEXT[]       NOT NULL DEFAULT '{}',
    languages           TEXT[]       NOT NULL DEFAULT '{}',
    availability_status VARCHAR(20)  NOT NULL DEFAULT 'OFFLINE'
                        CHECK (availability_status IN ('AVAILABLE','BUSY','OFFLINE')),
    max_caseload        INTEGER      NOT NULL DEFAULT 20 CHECK (max_caseload > 0),
    monthly_target      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (monthly_target >= 0),
    performance_rating  NUMERIC(3,2) CHECK (performance_rating BETWEEN 0 AND 5),
    years_experience    SMALLINT     CHECK (years_experience >= 0),
    hired_on            DATE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_agent_profile_updated BEFORE UPDATE ON agent_profile
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Monthly roll-up powering the target-vs-actual charts. Current-month figures are
-- recomputed by a nightly job; history is what the trend chart reads.
CREATE TABLE agent_performance (
    id                  BIGSERIAL     PRIMARY KEY,
    agent_id            BIGINT        NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    period_month        DATE          NOT NULL,             -- always the 1st of the month
    target_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
    collected_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
    cases_assigned      INTEGER       NOT NULL DEFAULT 0,
    cases_resolved      INTEGER       NOT NULL DEFAULT 0,
    ptp_created         INTEGER       NOT NULL DEFAULT 0,
    ptp_kept            INTEGER       NOT NULL DEFAULT 0,
    disputes_handled    INTEGER       NOT NULL DEFAULT 0,
    contact_attempts    INTEGER       NOT NULL DEFAULT 0,
    contact_successes   INTEGER       NOT NULL DEFAULT 0,
    avg_resolution_hours NUMERIC(8,2),
    sla_breaches        INTEGER       NOT NULL DEFAULT 0,
    quality_score       NUMERIC(5,2)  CHECK (quality_score BETWEEN 0 AND 100),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_period UNIQUE (agent_id, period_month)
);
CREATE TRIGGER trg_agent_performance_updated BEFORE UPDATE ON agent_performance
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================================
-- 5.  CONFIGURATION & SETTINGS
--     Screens: Admin Config (SLA / Score Priority / Currency / Legal),
--              Risk Analysis rule builder, AI Guardrails.
-- =====================================================================================
-- Generic key/value store for every scalar switch on the configuration screens.
CREATE TABLE app_setting (
    id            BIGSERIAL     PRIMARY KEY,
    category      VARCHAR(40)   NOT NULL,           -- CURRENCY, SCORING, LEGAL, GUARDRAIL, SYSTEM
    setting_key   VARCHAR(80)   NOT NULL UNIQUE,
    setting_value JSONB         NOT NULL,
    data_type     VARCHAR(20)   NOT NULL DEFAULT 'STRING'
                  CHECK (data_type IN ('STRING','NUMBER','BOOLEAN','JSON','LIST')),
    description   VARCHAR(255),
    is_editable   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_by    BIGINT        REFERENCES app_user(id)
);
CREATE TRIGGER trg_app_setting_updated BEFORE UPDATE ON app_setting
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Admin Config → SLA Management (one row per risk band).
CREATE TABLE sla_config (
    id                    BIGSERIAL    PRIMARY KEY,
    code                  VARCHAR(30)  NOT NULL UNIQUE,     -- SLA001 …
    risk_level            VARCHAR(20)  NOT NULL
                          CHECK (risk_level IN ('Low','Medium','High','Critical')),
    applies_to            VARCHAR(20)  NOT NULL DEFAULT 'CASE'
                          CHECK (applies_to IN ('CASE','DISPUTE')),
    initial_response_hours INTEGER     NOT NULL CHECK (initial_response_hours > 0),
    escalation_hours      INTEGER      NOT NULL CHECK (escalation_hours > 0),
    max_resolution_hours  INTEGER      NOT NULL CHECK (max_resolution_hours > 0),
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by            BIGINT       REFERENCES app_user(id),
    CONSTRAINT uq_sla_band UNIQUE (risk_level, applies_to),
    CONSTRAINT ck_sla_order CHECK (initial_response_hours <= escalation_hours
                                   AND escalation_hours   <= max_resolution_hours)
);
CREATE TRIGGER trg_sla_config_updated BEFORE UPDATE ON sla_config
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Admin Config → Score Priority (drag-to-reorder list with weights).
CREATE TABLE risk_score_component (
    id             BIGSERIAL    PRIMARY KEY,
    code           VARCHAR(40)  NOT NULL UNIQUE,     -- external_credit, ml_model …
    name           VARCHAR(120) NOT NULL,
    description    VARCHAR(255),
    weight         SMALLINT     NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 100),
    priority_order SMALLINT     NOT NULL,
    is_enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by     BIGINT       REFERENCES app_user(id)
);
CREATE TRIGGER trg_risk_score_component_updated BEFORE UPDATE ON risk_score_component
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Risk Analysis → Rule Builder. Conditions stay as JSONB because the builder is a
-- free-form parameter/operator/value list; normalising it would buy nothing.
CREATE TABLE risk_rule (
    id           BIGSERIAL    PRIMARY KEY,
    rule_code    VARCHAR(30)  NOT NULL UNIQUE,       -- RULE001 …
    name         VARCHAR(160) NOT NULL,
    description  VARCHAR(500),
    risk_level   VARCHAR(20)  NOT NULL
                 CHECK (risk_level IN ('Low','Medium','High','Critical')),
    weight       SMALLINT     NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 100),
    conditions   JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- [{parameter,operator,value,connector}]
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    is_system    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by   BIGINT       REFERENCES app_user(id),
    updated_by   BIGINT       REFERENCES app_user(id)
);
CREATE TRIGGER trg_risk_rule_updated BEFORE UPDATE ON risk_rule
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AI Guardrails: input filters, output filters, escalation rules and prompt
-- templates are four lists with the same shape — one table, discriminated by type.
CREATE TABLE ai_guardrail (
    id          BIGSERIAL    PRIMARY KEY,
    config_type VARCHAR(30)  NOT NULL
                CHECK (config_type IN ('INPUT_FILTER','OUTPUT_FILTER','ESCALATION_RULE','PROMPT_TEMPLATE')),
    code        VARCHAR(60)  NOT NULL,
    label       VARCHAR(255) NOT NULL,
    config      JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- icon / condition / action / template / tone
    is_enabled  BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by  BIGINT       REFERENCES app_user(id),
    CONSTRAINT uq_guardrail UNIQUE (config_type, code)
);
CREATE TRIGGER trg_ai_guardrail_updated BEFORE UPDATE ON ai_guardrail
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================================
-- 6.  STRATEGY  (Dunning Strategy Studio)
--     Screens: Strategy Library, Strategy Designer canvas, Version History,
--              Approval Workflow, A/B Testing, Strategy Execution Summary.
-- =====================================================================================
CREATE TABLE strategy (
    id               BIGSERIAL    PRIMARY KEY,
    strategy_code    VARCHAR(40)  NOT NULL UNIQUE,
    name             VARCHAR(160) NOT NULL,
    description      VARCHAR(500),
    segment_code     VARCHAR(60),
    segment_category VARCHAR(40)  GENERATED ALWAYS AS ('SEGMENT') STORED,
    aging_bucket     VARCHAR(20)
                     CHECK (aging_bucket IN ('Current','1-30','31-60','61-90','90+')),
    risk_level       VARCHAR(20)
                     CHECK (risk_level IN ('Low','Medium','High','Critical')),
    status           VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                     CHECK (status IN ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
    current_version  VARCHAR(10)  NOT NULL DEFAULT 'v1.0',
    -- The canvas is persisted whole: { nodes: [...], edges: [{from,to}] }.
    workflow_json    JSONB        NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
    target_audience  JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- Target Audience panel
    ab_test_config   JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- A/B Testing panel variants
    is_default       BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Suitability profile: who this journey is written for. Suitable DPD and
    -- Suitable Risk are aging_bucket / risk_level above.
    behaviour_type   VARCHAR(40),          -- Willing, Forgetful, Evasive, Disputed, Hardship
    emotion_type     VARCHAR(40),          -- Cooperative, Neutral, Anxious, Frustrated, Hostile
    minimum_income   NUMERIC(14,2),
    maximum_income   NUMERIC(14,2),
    minimum_loan     NUMERIC(14,2),
    maximum_loan     NUMERIC(14,2),
    -- Outcome metrics. Failure % is not stored: it is 100 - success_rate.
    uplift_pct       NUMERIC(6,2),
    success_rate     NUMERIC(5,2) CHECK (success_rate BETWEEN 0 AND 100),
    average_collection NUMERIC(14,2),      -- average amount recovered per account
    average_turns    NUMERIC(6,2),         -- average negotiation turns to resolution
    CONSTRAINT ck_strategy_income_range CHECK (
        minimum_income IS NULL OR maximum_income IS NULL OR maximum_income >= minimum_income),
    CONSTRAINT ck_strategy_loan_range CHECK (
        minimum_loan IS NULL OR maximum_loan IS NULL OR maximum_loan >= minimum_loan),
    activated_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by       BIGINT       REFERENCES app_user(id),
    updated_by       BIGINT       REFERENCES app_user(id),
    CONSTRAINT fk_strategy_segment FOREIGN KEY (segment_category, segment_code)
               REFERENCES master_data (category, code)
);
CREATE TRIGGER trg_strategy_updated BEFORE UPDATE ON strategy
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Immutable snapshot per version: powers Version History + Approval Workflow.
CREATE TABLE strategy_version (
    id              BIGSERIAL    PRIMARY KEY,
    strategy_id     BIGINT       NOT NULL REFERENCES strategy(id) ON DELETE CASCADE,
    version_no      VARCHAR(10)  NOT NULL,
    workflow_json   JSONB        NOT NULL,
    change_summary  VARCHAR(500),
    status          VARCHAR(25)  NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','CHANGES_REQUESTED','PUBLISHED','REJECTED')),
    author_id       BIGINT       REFERENCES app_user(id),
    reviewer_id     BIGINT       REFERENCES app_user(id),
    review_comments VARCHAR(1000),
    reviewed_at     TIMESTAMPTZ,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_strategy_version UNIQUE (strategy_id, version_no)
);

-- =====================================================================================
-- 7.  PORTFOLIO  (customer → account → invoice)
--     Screens: Customer 360, Risk Analysis, Risk Grid Analytics, Portfolio Dashboard,
--              Performance Reports, Customer Search / Customer List dialog.
-- =====================================================================================
CREATE TABLE customer (
    id                BIGSERIAL     PRIMARY KEY,
    customer_code     VARCHAR(30)   NOT NULL UNIQUE,      -- CUST-CON-001 …
    customer_type     VARCHAR(20)   NOT NULL
                      CHECK (customer_type IN ('CONSUMER','SMB','ENTERPRISE','GOVERNMENT')),
    full_name         VARCHAR(160),                        -- consumers
    company_name      VARCHAR(160),                        -- SMB / enterprise / government
    email             VARCHAR(160),
    phone             VARCHAR(30),
    msisdn            VARCHAR(30),                         -- mobile number on the account
    ban               VARCHAR(30),                         -- billing account number (enterprise)
    segment_code      VARCHAR(60)   NOT NULL,
    segment_category  VARCHAR(40)   GENERATED ALWAYS AS ('SEGMENT') STORED,
    region_code       VARCHAR(60)   NOT NULL,
    region_category   VARCHAR(40)   GENERATED ALWAYS AS ('REGION') STORED,
    country_code      VARCHAR(60),
    country_category  VARCHAR(40)   GENERATED ALWAYS AS ('COUNTRY') STORED,
    city              VARCHAR(80),
    address           VARCHAR(255),
    credit_score      SMALLINT      CHECK (credit_score BETWEEN 300 AND 900),
    risk_score        NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    risk_level        VARCHAR(20)   NOT NULL DEFAULT 'Low'
                      CHECK (risk_level IN ('Low','Medium','High','Critical')),
    contactability    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (contactability BETWEEN 0 AND 100),
    best_contact_time VARCHAR(40),
    best_channel_code VARCHAR(60),
    best_channel_category VARCHAR(40) GENERATED ALWAYS AS ('CHANNEL') STORED,
    assigned_agent_id BIGINT        REFERENCES app_user(id) ON DELETE SET NULL,
    status            VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','PAST_DUE','SUSPENDED','CLOSED')),
    onboarded_on      DATE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by        BIGINT        REFERENCES app_user(id),
    updated_by        BIGINT        REFERENCES app_user(id),
    CONSTRAINT ck_customer_name  CHECK (full_name IS NOT NULL OR company_name IS NOT NULL),
    CONSTRAINT fk_customer_segment FOREIGN KEY (segment_category, segment_code)
               REFERENCES master_data (category, code),
    CONSTRAINT fk_customer_region  FOREIGN KEY (region_category, region_code)
               REFERENCES master_data (category, code),
    CONSTRAINT fk_customer_country FOREIGN KEY (country_category, country_code)
               REFERENCES master_data (category, code),
    CONSTRAINT fk_customer_channel FOREIGN KEY (best_channel_category, best_channel_code)
               REFERENCES master_data (category, code)
);
CREATE TRIGGER trg_customer_updated BEFORE UPDATE ON customer
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One delinquent-tracked account per product held by a customer.
-- This is the row that portfolio.json models today.
CREATE TABLE account (
    id                 BIGSERIAL     PRIMARY KEY,
    account_code       VARCHAR(30)   NOT NULL UNIQUE,      -- ACC-00001 …
    customer_id        BIGINT        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    product_code       VARCHAR(60)   NOT NULL,
    product_category   VARCHAR(40)   GENERATED ALWAYS AS ('PRODUCT') STORED,
    currency_code      VARCHAR(60)   NOT NULL DEFAULT 'USD',
    currency_category  VARCHAR(40)   GENERATED ALWAYS AS ('CURRENCY') STORED,
    contract_plan      VARCHAR(120),
    activation_date    DATE,
    tenure_months      SMALLINT      CHECK (tenure_months >= 0),
    credit_limit       NUMERIC(15,2) CHECK (credit_limit >= 0),
    outstanding        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (outstanding >= 0),
    prior_outstanding  NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (prior_outstanding >= 0),
    target_mtd         NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (target_mtd >= 0),
    dpd                INTEGER       NOT NULL DEFAULT 0 CHECK (dpd >= 0),
    aging_bucket       VARCHAR(20)   NOT NULL DEFAULT 'Current'
                       CHECK (aging_bucket IN ('Current','1-30','31-60','61-90','90+')),
    risk_score         NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    risk_level         VARCHAR(20)   NOT NULL DEFAULT 'Low'
                       CHECK (risk_level IN ('Low','Medium','High','Critical')),
    strategy_id        BIGINT        REFERENCES strategy(id) ON DELETE SET NULL,
    dunning_stage      SMALLINT      NOT NULL DEFAULT 0 CHECK (dunning_stage BETWEEN 0 AND 10),
    channel_code       VARCHAR(60),                        -- primary channel this cycle
    channel_category   VARCHAR(40)   GENERATED ALWAYS AS ('CHANNEL') STORED,
    contact_attempts   INTEGER       NOT NULL DEFAULT 0 CHECK (contact_attempts >= 0),
    contact_successes  INTEGER       NOT NULL DEFAULT 0 CHECK (contact_successes >= 0),
    channel_cost       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (channel_cost >= 0),
    contactability     NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (contactability BETWEEN 0 AND 100),
    last_contact_at    TIMESTAMPTZ,
    last_payment_at    TIMESTAMPTZ,
    assigned_agent_id  BIGINT        REFERENCES app_user(id) ON DELETE SET NULL,
    status             VARCHAR(20)   NOT NULL DEFAULT 'CURRENT'
                       CHECK (status IN ('CURRENT','DELINQUENT','SUSPENDED','WRITTEN_OFF','CLOSED')),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by         BIGINT        REFERENCES app_user(id),
    updated_by         BIGINT        REFERENCES app_user(id),
    CONSTRAINT ck_account_contact CHECK (contact_successes <= contact_attempts),
    CONSTRAINT fk_account_product  FOREIGN KEY (product_category, product_code)
               REFERENCES master_data (category, code),
    CONSTRAINT fk_account_currency FOREIGN KEY (currency_category, currency_code)
               REFERENCES master_data (category, code),
    CONSTRAINT fk_account_channel  FOREIGN KEY (channel_category, channel_code)
               REFERENCES master_data (category, code)
);
CREATE TRIGGER trg_account_updated BEFORE UPDATE ON account
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invoice (
    id                 BIGSERIAL     PRIMARY KEY,
    invoice_no         VARCHAR(30)   NOT NULL UNIQUE,      -- INV-2024-0001 …
    account_id         BIGINT        NOT NULL REFERENCES account(id)  ON DELETE CASCADE,
    customer_id        BIGINT        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    bill_period_start  DATE          NOT NULL,
    bill_period_end    DATE          NOT NULL,
    issue_date         DATE          NOT NULL,
    due_date           DATE          NOT NULL,
    amount             NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
    tax_amount         NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    paid_amount        NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    service_description VARCHAR(255),
    status             VARCHAR(20)   NOT NULL DEFAULT 'UNPAID'
                       CHECK (status IN ('PAID','PARTIAL','UNPAID','OVERDUE','DISPUTED')),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_invoice_period CHECK (bill_period_end >= bill_period_start),
    CONSTRAINT ck_invoice_paid   CHECK (paid_amount <= amount + tax_amount)
);
CREATE TRIGGER trg_invoice_updated BEFORE UPDATE ON invoice
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================================
-- 8.  COLLECTIONS OPERATIONS
--     Screens: Case Management workspace (+ all its tabs), PTP panel, Payments &
--              Settlement tab, Dispute Management, AI Dispute console,
--              AI Engagement Center, Activity Timeline, Interactions & Notes.
-- =====================================================================================
CREATE TABLE debt_case (
    id                 BIGSERIAL     PRIMARY KEY,
    case_code          VARCHAR(30)   NOT NULL UNIQUE,      -- C-12451 …
    customer_id        BIGINT        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    account_id         BIGINT        REFERENCES account(id) ON DELETE SET NULL,
    case_type_code     VARCHAR(60)   NOT NULL,
    case_type_category VARCHAR(40)   GENERATED ALWAYS AS ('CASE_TYPE') STORED,
    summary            VARCHAR(500),
    status             VARCHAR(25)   NOT NULL DEFAULT 'OPEN'
                       CHECK (status IN ('OPEN','IN_PROGRESS','AWAITING_RESPONSE','ESCALATED','LEGAL','RESOLVED','CLOSED')),
    priority           VARCHAR(20)   NOT NULL DEFAULT 'Medium'
                       CHECK (priority IN ('Low','Medium','High','Critical')),
    risk_level         VARCHAR(20)   NOT NULL DEFAULT 'Low'
                       CHECK (risk_level IN ('Low','Medium','High','Critical')),
    amount             NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    predicted_payment  NUMERIC(15,2) CHECK (predicted_payment >= 0),
    dpd                INTEGER       NOT NULL DEFAULT 0 CHECK (dpd >= 0),
    strategy_id        BIGINT        REFERENCES strategy(id) ON DELETE SET NULL,
    dunning_stage      SMALLINT      NOT NULL DEFAULT 0 CHECK (dunning_stage BETWEEN 0 AND 10),
    assigned_agent_id  BIGINT        REFERENCES app_user(id) ON DELETE SET NULL,
    opened_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    sla_deadline       TIMESTAMPTZ,
    first_response_at  TIMESTAMPTZ,
    last_activity_at   TIMESTAMPTZ,
    closed_at          TIMESTAMPTZ,
    resolution_code    VARCHAR(60),
    resolution_hours   NUMERIC(8,2)  CHECK (resolution_hours >= 0),
    sla_breached       BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by         BIGINT        REFERENCES app_user(id),
    updated_by         BIGINT        REFERENCES app_user(id),
    CONSTRAINT ck_case_closed CHECK (closed_at IS NULL OR closed_at >= opened_at),
    CONSTRAINT fk_case_type FOREIGN KEY (case_type_category, case_type_code)
               REFERENCES master_data (category, code)
);
CREATE TRIGGER trg_debt_case_updated BEFORE UPDATE ON debt_case
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE ptp (
    id                BIGSERIAL     PRIMARY KEY,
    ptp_code          VARCHAR(30)   NOT NULL UNIQUE,       -- PTP-00001 …
    customer_id       BIGINT        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    account_id        BIGINT        REFERENCES account(id)   ON DELETE SET NULL,
    case_id           BIGINT        REFERENCES debt_case(id) ON DELETE SET NULL,
    invoice_id        BIGINT        REFERENCES invoice(id)   ON DELETE SET NULL,
    promised_amount   NUMERIC(15,2) NOT NULL CHECK (promised_amount > 0),
    promised_date     DATE          NOT NULL,
    instalment_count  SMALLINT      NOT NULL DEFAULT 1 CHECK (instalment_count > 0),
    kept_amount       NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (kept_amount >= 0),
    status            VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','KEPT','BROKEN','CANCELLED')),
    channel_code      VARCHAR(60),
    channel_category  VARCHAR(40)   GENERATED ALWAYS AS ('CHANNEL') STORED,
    ai_probability    NUMERIC(5,2)  CHECK (ai_probability BETWEEN 0 AND 100),
    fulfilled_at      TIMESTAMPTZ,
    notes             VARCHAR(500),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by        BIGINT        REFERENCES app_user(id),
    updated_by        BIGINT        REFERENCES app_user(id),
    CONSTRAINT fk_ptp_channel FOREIGN KEY (channel_category, channel_code)
               REFERENCES master_data (category, code)
);
CREATE TRIGGER trg_ptp_updated BEFORE UPDATE ON ptp
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payment (
    id               BIGSERIAL     PRIMARY KEY,
    payment_ref      VARCHAR(40)   NOT NULL UNIQUE,        -- TXN-000001 …
    customer_id      BIGINT        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    account_id       BIGINT        REFERENCES account(id) ON DELETE SET NULL,
    invoice_id       BIGINT        REFERENCES invoice(id) ON DELETE SET NULL,
    ptp_id           BIGINT        REFERENCES ptp(id)     ON DELETE SET NULL,
    case_id          BIGINT        REFERENCES debt_case(id) ON DELETE SET NULL,
    amount           NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    payment_date     DATE          NOT NULL,
    method_code      VARCHAR(60)   NOT NULL,
    method_category  VARCHAR(40)   GENERATED ALWAYS AS ('PAYMENT_METHOD') STORED,
    status           VARCHAR(20)   NOT NULL DEFAULT 'COMPLETED'
                     CHECK (status IN ('COMPLETED','PENDING','FAILED','REVERSED')),
    payment_link_sent BOOLEAN      NOT NULL DEFAULT FALSE,
    notes            VARCHAR(255),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by       BIGINT        REFERENCES app_user(id),
    CONSTRAINT fk_payment_method FOREIGN KEY (method_category, method_code)
               REFERENCES master_data (category, code)
);
CREATE TRIGGER trg_payment_updated BEFORE UPDATE ON payment
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE dispute (
    id                 BIGSERIAL     PRIMARY KEY,
    dispute_code       VARCHAR(30)   NOT NULL UNIQUE,      -- DSP-0001 …
    customer_id        BIGINT        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    account_id         BIGINT        REFERENCES account(id)   ON DELETE SET NULL,
    invoice_id         BIGINT        REFERENCES invoice(id)   ON DELETE SET NULL,
    case_id            BIGINT        REFERENCES debt_case(id) ON DELETE SET NULL,
    reason_code        VARCHAR(60)   NOT NULL,
    reason_category    VARCHAR(40)   GENERATED ALWAYS AS ('DISPUTE_REASON') STORED,
    description        VARCHAR(1000),
    amount             NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    status             VARCHAR(20)   NOT NULL DEFAULT 'OPEN'
                       CHECK (status IN ('OPEN','INVESTIGATING','ESCALATED','APPROVED','REJECTED','RESOLVED')),
    priority           VARCHAR(20)   NOT NULL DEFAULT 'Medium'
                       CHECK (priority IN ('Low','Medium','High','Critical')),
    assigned_agent_id  BIGINT        REFERENCES app_user(id) ON DELETE SET NULL,
    filed_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    sla_deadline       TIMESTAMPTZ,
    resolved_at        TIMESTAMPTZ,
    resolution_note    VARCHAR(1000),
    ai_confidence      NUMERIC(5,2)  CHECK (ai_confidence BETWEEN 0 AND 100),
    ai_analysis        JSONB,                              -- AIReconciliationDialog payload
    attachments        JSONB         NOT NULL DEFAULT '[]'::jsonb,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by         BIGINT        REFERENCES app_user(id),
    updated_by         BIGINT        REFERENCES app_user(id),
    CONSTRAINT ck_dispute_resolved CHECK (resolved_at IS NULL OR resolved_at >= filed_at),
    CONSTRAINT fk_dispute_reason FOREIGN KEY (reason_category, reason_code)
               REFERENCES master_data (category, code)
);
CREATE TRIGGER trg_dispute_updated BEFORE UPDATE ON dispute
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ONE timeline table. Activity Timeline, Interactions & Notes, dunning actions,
-- dispute timeline events, AI Engagement chat turns and system events are the same
-- record with a different activity_type — modelling them separately would duplicate
-- the concept five times.
CREATE TABLE case_activity (
    id             BIGSERIAL    PRIMARY KEY,
    activity_type  VARCHAR(20)  NOT NULL
                   CHECK (activity_type IN ('SMS','EMAIL','WHATSAPP','CALL','VOICEBOT','CHAT',
                                            'NOTE','PTP','PAYMENT','DISPUTE','STATUS_CHANGE',
                                            'ESCALATION','SYSTEM')),
    customer_id    BIGINT       NOT NULL REFERENCES customer(id)  ON DELETE CASCADE,
    account_id     BIGINT       REFERENCES account(id)   ON DELETE SET NULL,
    case_id        BIGINT       REFERENCES debt_case(id) ON DELETE CASCADE,
    dispute_id     BIGINT       REFERENCES dispute(id)   ON DELETE CASCADE,
    channel_code   VARCHAR(60),
    channel_category VARCHAR(40) GENERATED ALWAYS AS ('CHANNEL') STORED,
    direction      VARCHAR(20)  NOT NULL DEFAULT 'INTERNAL'
                   CHECK (direction IN ('INBOUND','OUTBOUND','INTERNAL')),
    subject        VARCHAR(200) NOT NULL,
    body           TEXT,
    outcome        VARCHAR(160),
    visibility     VARCHAR(20)  NOT NULL DEFAULT 'INTERNAL'
                   CHECK (visibility IN ('INTERNAL','CUSTOMER_FACING')),
    is_automated   BOOLEAN      NOT NULL DEFAULT FALSE,
    attachments    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    agent_id       BIGINT       REFERENCES app_user(id) ON DELETE SET NULL,
    occurred_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by     BIGINT       REFERENCES app_user(id),
    CONSTRAINT fk_activity_channel FOREIGN KEY (channel_category, channel_code)
               REFERENCES master_data (category, code)
);

-- =====================================================================================
-- 9.  LEGAL & AGENCY
--     Screens: Admin Config → Agency & Legal, Legal modal in the case workspace.
-- =====================================================================================
CREATE TABLE collection_agency (
    id                 BIGSERIAL     PRIMARY KEY,
    agency_code        VARCHAR(30)   NOT NULL UNIQUE,      -- AGN001 …
    name               VARCHAR(160)  NOT NULL,
    contact_email      VARCHAR(160),
    phone              VARCHAR(30),
    specialization     VARCHAR(120),
    commission_rate    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (commission_rate BETWEEN 0 AND 100),
    performance_rating NUMERIC(5,2)  CHECK (performance_rating BETWEEN 0 AND 100),
    recovery_rate      NUMERIC(5,2)  CHECK (recovery_rate BETWEEN 0 AND 100),
    avg_response_days  NUMERIC(5,2)  CHECK (avg_response_days >= 0),
    status             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                       CHECK (status IN ('ACTIVE','UNDER_REVIEW','SUSPENDED','TERMINATED')),
    onboarded_on       DATE,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by         BIGINT        REFERENCES app_user(id),
    updated_by         BIGINT        REFERENCES app_user(id)
);
CREATE TRIGGER trg_collection_agency_updated BEFORE UPDATE ON collection_agency
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE legal_escalation (
    id                  BIGSERIAL     PRIMARY KEY,
    escalation_code     VARCHAR(30)   NOT NULL UNIQUE,     -- LEG001 …
    customer_id         BIGINT        NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    account_id          BIGINT        REFERENCES account(id)   ON DELETE SET NULL,
    case_id             BIGINT        REFERENCES debt_case(id) ON DELETE SET NULL,
    agency_id           BIGINT        REFERENCES collection_agency(id) ON DELETE SET NULL,
    attorney_name       VARCHAR(120),
    outstanding_amount  NUMERIC(15,2) NOT NULL CHECK (outstanding_amount >= 0),
    recovered_amount    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (recovered_amount >= 0),
    commission_amount   NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
    stage               VARCHAR(30)   NOT NULL DEFAULT 'INITIAL_FILING'
                        CHECK (stage IN ('INITIAL_FILING','PRE_TRIAL','POST_JUDGMENT','SETTLEMENT')),
    status              VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','ACTIVE','COMPLETED','WITHDRAWN')),
    success_probability NUMERIC(5,2)  CHECK (success_probability BETWEEN 0 AND 100),
    filing_date         DATE,
    court_date          DATE,
    next_review_date    DATE,
    notes               VARCHAR(1000),
    escalated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    closed_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by          BIGINT        REFERENCES app_user(id),
    updated_by          BIGINT        REFERENCES app_user(id)
);
CREATE TRIGGER trg_legal_escalation_updated BEFORE UPDATE ON legal_escalation
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================================
-- 10.  NOTIFICATIONS & AUDIT
--      Screens: NotificationCenter sheet (header bell), Admin Config → Audit Logs.
-- =====================================================================================
CREATE TABLE notification (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       REFERENCES app_user(id) ON DELETE CASCADE,  -- NULL = broadcast
    type          VARCHAR(30)  NOT NULL
                  CHECK (type IN ('HIGH_RISK','PAYMENT_ALERT','DISPUTE','SLA_BREACH','PTP_BROKEN','SYSTEM')),
    severity      VARCHAR(20)  NOT NULL DEFAULT 'INFO'
                  CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    title         VARCHAR(160) NOT NULL,
    message       VARCHAR(500) NOT NULL,
    customer_id   BIGINT       REFERENCES customer(id)  ON DELETE CASCADE,
    case_id       BIGINT       REFERENCES debt_case(id) ON DELETE CASCADE,
    is_read       BOOLEAN      NOT NULL DEFAULT FALSE,
    read_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       REFERENCES app_user(id) ON DELETE SET NULL,
    user_name     VARCHAR(120),                        -- snapshot: survives user deletion
    action        VARCHAR(120) NOT NULL,               -- 'Updated Risk Threshold'
    entity_type   VARCHAR(60),                         -- 'sla_config', 'role' …
    entity_id     VARCHAR(60),
    details       VARCHAR(1000),
    old_value     JSONB,
    new_value     JSONB,
    ip_address    INET,
    user_agent    VARCHAR(255),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =====================================================================================
-- 11.  INDEXES
--      Driven by the filters and sorts the screens actually issue.
-- =====================================================================================
CREATE INDEX idx_master_data_category      ON master_data (category, sort_order) WHERE status = 'ACTIVE';

CREATE INDEX idx_app_user_role             ON app_user (role_id);
CREATE INDEX idx_app_user_status           ON app_user (status);
CREATE INDEX idx_user_session_user         ON user_session (user_id, expires_at DESC);
CREATE INDEX idx_menu_item_parent          ON menu_item (parent_id, sort_order);

CREATE INDEX idx_agent_perf_period         ON agent_performance (period_month DESC, agent_id);

CREATE INDEX idx_customer_segment          ON customer (segment_code);
CREATE INDEX idx_customer_region           ON customer (region_code);
CREATE INDEX idx_customer_risk             ON customer (risk_level, risk_score DESC);
CREATE INDEX idx_customer_agent            ON customer (assigned_agent_id);
CREATE INDEX idx_customer_type             ON customer (customer_type);
-- Customer search box (name / email / code), case-insensitive prefix + substring.
CREATE INDEX idx_customer_search           ON customer
       (lower(coalesce(full_name, company_name)) varchar_pattern_ops);

CREATE INDEX idx_account_customer          ON account (customer_id);
CREATE INDEX idx_account_aging             ON account (aging_bucket);
CREATE INDEX idx_account_product           ON account (product_code);
CREATE INDEX idx_account_agent             ON account (assigned_agent_id);
CREATE INDEX idx_account_strategy          ON account (strategy_id);
CREATE INDEX idx_account_channel           ON account (channel_code);
-- The dashboard/report grids filter delinquent accounts and sort by exposure.
CREATE INDEX idx_account_delinquent        ON account (risk_level, outstanding DESC)
       WHERE aging_bucket <> 'Current';

CREATE INDEX idx_invoice_account           ON invoice (account_id, due_date DESC);
CREATE INDEX idx_invoice_customer_status   ON invoice (customer_id, status);

CREATE INDEX idx_case_customer             ON debt_case (customer_id);
CREATE INDEX idx_case_status               ON debt_case (status, priority);
CREATE INDEX idx_case_agent                ON debt_case (assigned_agent_id, status);
CREATE INDEX idx_case_sla                  ON debt_case (sla_deadline) WHERE closed_at IS NULL;

CREATE INDEX idx_ptp_customer              ON ptp (customer_id, promised_date DESC);
CREATE INDEX idx_ptp_status                ON ptp (status, promised_date);
CREATE INDEX idx_ptp_case                  ON ptp (case_id);

CREATE INDEX idx_payment_customer          ON payment (customer_id, payment_date DESC);
CREATE INDEX idx_payment_account           ON payment (account_id, payment_date DESC);
CREATE INDEX idx_payment_invoice           ON payment (invoice_id);
CREATE INDEX idx_payment_date              ON payment (payment_date DESC) WHERE status = 'COMPLETED';

CREATE INDEX idx_dispute_customer          ON dispute (customer_id, filed_at DESC);
CREATE INDEX idx_dispute_status            ON dispute (status, priority);
CREATE INDEX idx_dispute_agent             ON dispute (assigned_agent_id);
CREATE INDEX idx_dispute_sla               ON dispute (sla_deadline) WHERE resolved_at IS NULL;

CREATE INDEX idx_activity_case             ON case_activity (case_id, occurred_at DESC);
CREATE INDEX idx_activity_customer         ON case_activity (customer_id, occurred_at DESC);
CREATE INDEX idx_activity_dispute          ON case_activity (dispute_id, occurred_at DESC);
CREATE INDEX idx_activity_type             ON case_activity (activity_type, occurred_at DESC);

CREATE INDEX idx_legal_customer            ON legal_escalation (customer_id);
CREATE INDEX idx_legal_agency              ON legal_escalation (agency_id, status);

CREATE INDEX idx_notification_user         ON notification (user_id, is_read, created_at DESC);
CREATE INDEX idx_audit_log_created         ON audit_log (created_at DESC);
CREATE INDEX idx_audit_log_user            ON audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_log_entity          ON audit_log (entity_type, entity_id);

CREATE INDEX idx_strategy_status           ON strategy (status, segment_code);
CREATE INDEX idx_strategy_version_strategy ON strategy_version (strategy_id, created_at DESC);

-- =====================================================================================
-- 12.  DEFERRED CONSTRAINTS
--      app_user references itself for created_by/updated_by, so the FK is added
--      after the table exists.
-- =====================================================================================
ALTER TABLE app_user
    ADD CONSTRAINT fk_app_user_created_by FOREIGN KEY (created_by) REFERENCES app_user(id),
    ADD CONSTRAINT fk_app_user_updated_by FOREIGN KEY (updated_by) REFERENCES app_user(id);

-- =====================================================================================
-- 13.  SEED DATA
-- =====================================================================================

-- ---- 13.1 Master data -----------------------------------------------------------
INSERT INTO master_data (category, code, label, sort_order, is_default, attributes) VALUES
 ('SEGMENT','Consumer','Consumer',1,TRUE ,'{}'),
 ('SEGMENT','SMB','Small & Medium Business',2,FALSE,'{}'),
 ('SEGMENT','Enterprise','Enterprise',3,FALSE,'{}'),
 ('SEGMENT','Government','Government',4,FALSE,'{}'),

 ('REGION','North','North',1,FALSE,'{}'),
 ('REGION','South','South',2,FALSE,'{}'),
 ('REGION','East','East',3,FALSE,'{}'),
 ('REGION','West','West',4,FALSE,'{}'),

 ('COUNTRY','AE','United Arab Emirates',1,TRUE ,'{"dial_code":"+971"}'),
 ('COUNTRY','US','United States',2,FALSE,'{"dial_code":"+1"}'),
 ('COUNTRY','IN','India',3,FALSE,'{"dial_code":"+91"}'),
 ('COUNTRY','GB','United Kingdom',4,FALSE,'{"dial_code":"+44"}'),
 ('COUNTRY','SA','Saudi Arabia',5,FALSE,'{"dial_code":"+966"}'),

 ('PRODUCT','Mobile Postpaid','Mobile Postpaid',1,FALSE,'{"applies_to":"Consumer"}'),
 ('PRODUCT','Device Financing','Device Financing',2,FALSE,'{"applies_to":"Consumer"}'),
 ('PRODUCT','Business Fibre','Business Fibre',3,FALSE,'{"applies_to":"SMB"}'),
 ('PRODUCT','Enterprise Suite','Enterprise Suite',4,FALSE,'{"applies_to":"Enterprise"}'),
 ('PRODUCT','MPLS','MPLS',5,FALSE,'{"applies_to":"Enterprise"}'),
 ('PRODUCT','IoT Connectivity','IoT Connectivity',6,FALSE,'{"applies_to":"Enterprise"}'),
 ('PRODUCT','Government Connectivity','Government Connectivity',7,FALSE,'{"applies_to":"Government"}'),

 ('AGING_BUCKET','Current','Current',1,FALSE,'{"severe":false}'),
 ('AGING_BUCKET','1-30','1-30 DPD',2,FALSE,'{"severe":false}'),
 ('AGING_BUCKET','31-60','31-60 DPD',3,FALSE,'{"severe":false}'),
 ('AGING_BUCKET','61-90','61-90 DPD',4,FALSE,'{"severe":false}'),
 ('AGING_BUCKET','90+','90+ DPD',5,FALSE,'{"severe":true}'),

 ('RISK_LEVEL','Low','Low',1,FALSE,'{"max_score":25}'),
 ('RISK_LEVEL','Medium','Medium',2,FALSE,'{"max_score":50}'),
 ('RISK_LEVEL','High','High',3,FALSE,'{"max_score":75}'),
 ('RISK_LEVEL','Critical','Critical',4,FALSE,'{"max_score":100}'),

 ('PRIORITY','Low','Low',1,FALSE,'{}'),
 ('PRIORITY','Medium','Medium',2,TRUE ,'{}'),
 ('PRIORITY','High','High',3,FALSE,'{}'),
 ('PRIORITY','Critical','Critical',4,FALSE,'{}'),

 ('CHANNEL','SMS','SMS',1,FALSE,'{"cost":0.10,"voice":false}'),
 ('CHANNEL','Email','Email',2,FALSE,'{"cost":0.05,"voice":false}'),
 ('CHANNEL','WhatsApp','WhatsApp',3,FALSE,'{"cost":0.15,"voice":false}'),
 ('CHANNEL','Voicebot','AI Voicebot',4,FALSE,'{"cost":0.60,"voice":true}'),
 ('CHANNEL','Dialer','Predictive Dialer',5,FALSE,'{"cost":1.20,"voice":true}'),
 ('CHANNEL','IVR','IVR',6,FALSE,'{"cost":0.35,"voice":true}'),
 ('CHANNEL','Chat','Web Chat',7,FALSE,'{"cost":0.20,"voice":false}'),
 ('CHANNEL','Field Visit','Field Visit',8,FALSE,'{"cost":25.00,"voice":false}'),

 ('CASE_TYPE','Collection','Collection',1,TRUE ,'{}'),
 ('CASE_TYPE','Billing Issue','Billing Issue',2,FALSE,'{}'),
 ('CASE_TYPE','Broken PTP','Broken PTP',3,FALSE,'{}'),
 ('CASE_TYPE','Dispute','Dispute',4,FALSE,'{}'),
 ('CASE_TYPE','Payment Plan','Payment Plan',5,FALSE,'{}'),
 ('CASE_TYPE','Legal Followup','Legal Follow-up',6,FALSE,'{}'),

 ('DISPUTE_REASON','INCORRECT_AMOUNT','Incorrect amount charged',1,FALSE,'{}'),
 ('DISPUTE_REASON','SERVICE_NOT_DELIVERED','Service not delivered for billed period',2,FALSE,'{}'),
 ('DISPUTE_REASON','DUPLICATE_INVOICE','Duplicate invoice raised',3,FALSE,'{}'),
 ('DISPUTE_REASON','ROAMING_CHARGES','Roaming charges disputed',4,FALSE,'{}'),
 ('DISPUTE_REASON','DEVICE_INSTALMENT','Device financing instalment mismatch',5,FALSE,'{}'),
 ('DISPUTE_REASON','LATE_FEE','Late fee disputed',6,FALSE,'{}'),

 ('PAYMENT_METHOD','Bank Transfer','Bank Transfer',1,TRUE ,'{}'),
 ('PAYMENT_METHOD','Credit Card','Credit Card',2,FALSE,'{}'),
 ('PAYMENT_METHOD','Auto-Debit','Auto-Debit',3,FALSE,'{}'),
 ('PAYMENT_METHOD','Cheque','Cheque',4,FALSE,'{}'),
 ('PAYMENT_METHOD','Cash','Cash',5,FALSE,'{}'),
 ('PAYMENT_METHOD','Payment Link','Payment Link',6,FALSE,'{}'),

 ('RESOLUTION_CODE','PAID_IN_FULL','Paid in Full',1,FALSE,'{}'),
 ('RESOLUTION_CODE','PAYMENT_PLAN','Payment Plan Agreed',2,FALSE,'{}'),
 ('RESOLUTION_CODE','SETTLED','Settled',3,FALSE,'{}'),
 ('RESOLUTION_CODE','WRITTEN_OFF','Written Off',4,FALSE,'{}'),
 ('RESOLUTION_CODE','DISPUTE_UPHELD','Dispute Upheld',5,FALSE,'{}'),
 ('RESOLUTION_CODE','DISPUTE_REJECTED','Dispute Rejected',6,FALSE,'{}'),
 ('RESOLUTION_CODE','ESCALATED_LEGAL','Escalated to Legal',7,FALSE,'{}'),

 ('DEPARTMENT','Premium Collections','Premium Collections',1,FALSE,'{}'),
 ('DEPARTMENT','Business Collections','Business Collections',2,FALSE,'{}'),
 ('DEPARTMENT','Enterprise Relations','Enterprise Relations',3,FALSE,'{}'),
 ('DEPARTMENT','Standard Collections','Standard Collections',4,FALSE,'{}'),
 ('DEPARTMENT','Recovery','Recovery',5,FALSE,'{}'),
 ('DEPARTMENT','Customer Service','Customer Service',6,FALSE,'{}'),
 ('DEPARTMENT','Finance','Finance',7,FALSE,'{}'),
 ('DEPARTMENT','Legal','Legal',8,FALSE,'{}'),
 ('DEPARTMENT','Administration','Administration',9,FALSE,'{}'),

 ('SKILL_GROUP','Collections-A','Collections-A',1,FALSE,'{}'),
 ('SKILL_GROUP','Collections-B','Collections-B',2,FALSE,'{}'),
 ('SKILL_GROUP','Enterprise','Enterprise',3,FALSE,'{}'),
 ('SKILL_GROUP','Recovery','Recovery',4,FALSE,'{}'),

 ('LANGUAGE','English','English',1,TRUE ,'{}'),
 ('LANGUAGE','Arabic','Arabic',2,FALSE,'{}'),
 ('LANGUAGE','Hindi','Hindi',3,FALSE,'{}'),
 ('LANGUAGE','Spanish','Spanish',4,FALSE,'{}'),

 ('CURRENCY','USD','US Dollar',1,TRUE ,'{"symbol":"$","decimals":2}'),
 ('CURRENCY','EUR','Euro',2,FALSE,'{"symbol":"€","decimals":2}'),
 ('CURRENCY','GBP','British Pound',3,FALSE,'{"symbol":"£","decimals":2}'),
 ('CURRENCY','INR','Indian Rupee',4,FALSE,'{"symbol":"₹","decimals":2}'),
 ('CURRENCY','AED','UAE Dirham',5,FALSE,'{"symbol":"AED","decimals":2}'),
 ('CURRENCY','CAD','Canadian Dollar',6,FALSE,'{"symbol":"C$","decimals":2}'),
 ('CURRENCY','AUD','Australian Dollar',7,FALSE,'{"symbol":"A$","decimals":2}'),
 ('CURRENCY','JPY','Japanese Yen',8,FALSE,'{"symbol":"¥","decimals":0}'),
 ('CURRENCY','CNY','Chinese Yuan',9,FALSE,'{"symbol":"¥","decimals":2}');

-- ---- 13.2 Roles ------------------------------------------------------------------
INSERT INTO role (code, name, description, is_system) VALUES
 ('SUPER_ADMIN','Super Admin','Unrestricted access to every module and configuration', TRUE),
 ('ADMIN','Admin','Full operational access plus system configuration', TRUE),
 ('SUPERVISOR','Supervisor','Team oversight: portfolio, cases, agents; no designer or admin config', TRUE),
 ('AGENT','Agent','Front-line collections agent: own cases, customers and engagement', TRUE),
 ('FINANCE','Finance','Read-only portfolio, reporting and customer financial view', TRUE);

-- ---- 13.3 Permissions (the capability keys in navConfig.ts / accessrights.ts) -----
INSERT INTO permission (code, name, module_group, sort_order) VALUES
 ('portfoliodashboard'      ,'Portfolio Dashboard'        ,'Portfolio Pulseboard'  ,1),
 ('performancereports'      ,'Performance Reports'        ,'Portfolio Pulseboard'  ,2),
 ('riskanalysis'            ,'Risk Analysis'              ,'Customer Pulseboard'   ,3),
 ('riskGridAnalytics'       ,'Risk Grid Analytics'        ,'Customer Pulseboard'   ,4),
 ('customer360'             ,'Customer 360'               ,'Customer Pulseboard'   ,5),
 ('dunningStrategySummary'  ,'Strategy Execution Summary' ,'Dunning Strategy Studio',6),
 ('dunningStrategyDesigner' ,'Strategy Designer'          ,'Dunning Strategy Studio',7),
 ('caseManagement'          ,'Case Management'            ,'Operations Hub'        ,8),
 ('agentPerformance'        ,'Agent Performance'          ,'Operations Hub'        ,9),
 ('aiGuardrails'            ,'AI Guardrails'              ,'Operations Hub'        ,10),
 ('aiEngagementCenter'      ,'AI Engagement Center'       ,'Operations Hub'        ,11),
 ('agentdashboard'          ,'Agent Dashboard'            ,'Operations Hub'        ,12),
 ('selfServiceBI'           ,'Self Service BI'            ,'Operations Hub'        ,13),
 ('chatbotConfig'           ,'Chatbot Configuration'      ,'Administration'        ,14),
 ('adminconfig'             ,'Admin Configuration'        ,'Administration'        ,15),
 ('userManagement'          ,'User Management'            ,'Administration'        ,16),
 ('roleManagement'          ,'Role Management'            ,'Administration'        ,17);

-- ---- 13.4 Role → permission matrix -----------------------------------------------
-- Super Admin / Admin: everything, view and edit.
UPDATE role SET permissions = (
    SELECT jsonb_object_agg(p.code, jsonb_build_object('view', TRUE, 'edit', TRUE))
      FROM permission p
) WHERE code IN ('SUPER_ADMIN','ADMIN');

UPDATE role SET permissions = (
    SELECT jsonb_object_agg(p.code, jsonb_build_object('view', TRUE, 'edit', TRUE))
      FROM permission p WHERE p.code IN
       ('portfoliodashboard','performancereports','riskanalysis','riskGridAnalytics','customer360',
        'dunningStrategySummary','caseManagement','agentPerformance','aiGuardrails',
        'agentdashboard','selfServiceBI')
) WHERE code = 'SUPERVISOR';

UPDATE role SET permissions = (
    SELECT jsonb_object_agg(p.code, jsonb_build_object('view', TRUE, 'edit', TRUE))
      FROM permission p WHERE p.code IN
       ('customer360','caseManagement','aiEngagementCenter','aiGuardrails',
        'agentdashboard','selfServiceBI')
) WHERE code = 'AGENT';

-- Finance is a read-only role: view without edit.
UPDATE role SET permissions = (
    SELECT jsonb_object_agg(p.code, jsonb_build_object('view', TRUE, 'edit', FALSE))
      FROM permission p WHERE p.code IN
       ('portfoliodashboard','performancereports','customer360',
        'dunningStrategySummary','aiGuardrails')
) WHERE code = 'FINANCE';

-- ---- 13.5 Users ------------------------------------------------------------------
-- Every seeded account uses the password  Admin@123  (bcrypt, verifiable by
-- Spring Security's BCryptPasswordEncoder).
INSERT INTO app_user (email, full_name, phone, password_hash, role_id, department_code,
                      status, last_login_at, password_changed_at)
SELECT u.email, u.full_name, u.phone, crypt('Admin@123', gen_salt('bf', 10)),
       r.id, u.department_code, u.status, u.last_login_at, now()
FROM (VALUES
 ('superadmin@gmail.com'        ,'Super Admin'      ,'+971-50-000-0001','SUPER_ADMIN','Administration'       ,'ACTIVE'  , now() - INTERVAL '2 hours'),
 ('admin@gmail.com'             ,'System Admin'     ,'+971-50-000-0002','ADMIN'      ,'Administration'       ,'ACTIVE'  , now() - INTERVAL '1 day'),
 ('supervisor@gmail.com'        ,'Team Supervisor'  ,'+971-50-000-0003','SUPERVISOR' ,'Standard Collections' ,'ACTIVE'  , now() - INTERVAL '30 minutes'),
 ('john_smith@gmail.com'        ,'John Smith'       ,'+1-555-2001'     ,'AGENT'      ,'Premium Collections'  ,'ACTIVE'  , now() - INTERVAL '4 hours'),
 ('finance@gmail.com'           ,'Finance Officer'  ,'+971-50-000-0005','FINANCE'    ,'Finance'              ,'INACTIVE', now() - INTERVAL '2 days'),
 ('mike.johnson@company.com'    ,'Mike Johnson'     ,'+1-555-2002'     ,'AGENT'      ,'Business Collections' ,'ACTIVE'  , now() - INTERVAL '5 hours'),
 ('jennifer.lee@company.com'    ,'Jennifer Lee'     ,'+1-555-2003'     ,'AGENT'      ,'Enterprise Relations' ,'ACTIVE'  , now() - INTERVAL '6 hours'),
 ('lisa.davis@company.com'      ,'Lisa Davis'       ,'+1-555-2005'     ,'AGENT'      ,'Standard Collections' ,'ACTIVE'  , now() - INTERVAL '1 day'),
 ('robert.kim@company.com'      ,'Robert Kim'       ,'+1-555-2004'     ,'AGENT'      ,'Customer Service'     ,'ACTIVE'  , now() - INTERVAL '3 hours'),
 ('maria.garcia@company.com'    ,'Maria Garcia'     ,'+1-555-2007'     ,'AGENT'      ,'Recovery'             ,'ACTIVE'  , now() - INTERVAL '8 hours'),
 ('carlos.rodriguez@company.com','Carlos Rodriguez' ,'+1-555-2006'     ,'AGENT'      ,'Recovery'             ,'ACTIVE'  , now() - INTERVAL '9 hours')
) AS u(email, full_name, phone, role_code, department_code, status, last_login_at)
JOIN role r ON r.code = u.role_code;

UPDATE app_user SET created_by = (SELECT id FROM app_user WHERE email = 'superadmin@gmail.com');

-- Users inherit their permissions from role.permissions — nothing per-user to seed.

-- ---- 13.6 Menu (sidebar) ---------------------------------------------------------
INSERT INTO menu_item (code, label, icon, parent_id, permission_id, module_key, sort_order) VALUES
 ('overview'  ,'Portfolio Pulseboard'  ,'TrendingUp',NULL,NULL,NULL,1),
 ('pulseboard','Customer Pulseboard'   ,'Users'     ,NULL,NULL,NULL,2),
 ('strategy'  ,'Dunning Strategy Studio','BarChart3',NULL,NULL,NULL,3),
 ('operations','Operations Hub'        ,'CreditCard',NULL,NULL,NULL,4),
 ('admin_group','Administration'       ,'Settings'  ,NULL,NULL,NULL,5);

INSERT INTO menu_item (code, label, icon, parent_id, permission_id, module_key, sort_order)
SELECT m.code, m.label, m.icon, g.id, p.id, m.module_key, m.sort_order
FROM (VALUES
 ('dashboard'      ,'Portfolio Dashboard'       ,'Home'           ,'overview'   ,'portfoliodashboard'     ,'dashboard'       ,1),
 ('report'         ,'Performance Reports'       ,'FileBarChart2'  ,'overview'   ,'performancereports'     ,'report'          ,2),
 ('risks_analysis' ,'Risk Analysis'             ,'PieChart'       ,'pulseboard' ,'riskanalysis'           ,'risks_analysis'  ,1),
 ('risks_segmentation','Risk Grid Analytics'    ,'Grid3x3'        ,'pulseboard' ,'riskGridAnalytics'      ,'risks_segmentation',2),
 ('customer_360'   ,'Customer 360'              ,'UserSearch'     ,'pulseboard' ,'customer360'            ,'customer_360'    ,3),
 ('risk'           ,'Strategy Execution Summary','Target'         ,'strategy'   ,'dunningStrategySummary' ,'risk'            ,1),
 ('Designer'       ,'Strategy Designer'         ,'Workflow'       ,'strategy'   ,'dunningStrategyDesigner','Designer'        ,2),
 ('case_management','Case Management'           ,'Briefcase'      ,'operations' ,'caseManagement'         ,'case_management' ,1),
 ('agent_performance','Agent Performance'       ,'HandHeart'      ,'operations' ,'agentPerformance'       ,'agent_performance',2),
 ('ai_guardrails'  ,'AI Guardrails'             ,'ShieldCheck'    ,'operations' ,'aiGuardrails'           ,'ai_guardrails'   ,3),
 ('ai_dialer'      ,'AI Engagement Center'      ,'Bot'            ,'operations' ,'aiEngagementCenter'     ,'ai_dialer'       ,4),
 ('agent_dashboard','Agent Dashboard'           ,'LayoutDashboard','operations' ,'agentdashboard'         ,'agent_dashboard' ,5),
 ('admin'          ,'Admin Configuration'       ,'Settings'       ,'admin_group','adminconfig'            ,'admin'           ,1)
) AS m(code, label, icon, parent_code, perm_code, module_key, sort_order)
JOIN menu_item g ON g.code = m.parent_code
JOIN permission p ON p.code = m.perm_code;

-- ---- 13.7 Agent profiles ---------------------------------------------------------
INSERT INTO agent_profile (user_id, employee_code, skill_group, expertise, specializations,
                           languages, availability_status, max_caseload, monthly_target,
                           performance_rating, years_experience, hired_on)
SELECT u.id, a.employee_code, a.skill_group, a.expertise,
       a.specializations::text[], a.languages::text[], a.availability_status,
       a.max_caseload, a.monthly_target, a.performance_rating, a.years_experience, a.hired_on::date
FROM (VALUES
 ('john_smith@gmail.com'        ,'AGENT-001','Collections-A','Senior Collections Specialist','{"Premium Customers","Payment Plans","Medical Hardships"}','{English,Spanish}'           ,'AVAILABLE',15,30000,4.8,8 ,'2017-03-06'),
 ('mike.johnson@company.com'    ,'AGENT-002','Collections-B','Business Collections Manager' ,'{"Business Accounts","Dispute Resolution","Legal Issues"}','{English}'                    ,'BUSY'     ,15,22000,4.6,12,'2013-07-15'),
 ('jennifer.lee@company.com'    ,'AGENT-003','Enterprise'   ,'Enterprise Account Manager'   ,'{"Enterprise Accounts","Account Reviews","Contract Management"}','{English,Korean,Mandarin}','AVAILABLE',20,25000,4.9,10,'2015-01-12'),
 ('lisa.davis@company.com'      ,'AGENT-004','Collections-B','Collections Specialist'       ,'{"Standard Accounts","Payment Reminders","Early Intervention"}','{English}'               ,'OFFLINE'  ,80,22000,4.3,4 ,'2021-09-01'),
 ('robert.kim@company.com'      ,'AGENT-005','Collections-A','Senior Customer Service Rep'  ,'{"Service Upgrades","Technical Support","Account Modifications"}','{English,Korean}'      ,'AVAILABLE',70,22000,4.4,6 ,'2019-05-20'),
 ('maria.garcia@company.com'    ,'AGENT-006','Recovery'     ,'Recovery Specialist'          ,'{"High-Risk Accounts","Skip Tracing"}','{English,Spanish}'                                   ,'AVAILABLE',50,20000,4.5,7 ,'2018-11-05'),
 ('carlos.rodriguez@company.com','AGENT-007','Recovery'     ,'Recovery Specialist'          ,'{"High-Risk Accounts","Legal Recovery","Debt Settlement"}','{English,Spanish,Portuguese}','BUSY'     ,50,22000,4.7,9 ,'2016-02-29')
) AS a(email, employee_code, skill_group, expertise, specializations, languages,
       availability_status, max_caseload, monthly_target, performance_rating, years_experience, hired_on)
JOIN app_user u ON u.email = a.email;

-- ---- 13.8 SLA configuration ------------------------------------------------------
INSERT INTO sla_config (code, risk_level, applies_to, initial_response_hours, escalation_hours, max_resolution_hours, is_active) VALUES
 ('SLA001','Critical','CASE'   ,1,12,48 ,TRUE),
 ('SLA002','High'    ,'CASE'   ,2,24,72 ,TRUE),
 ('SLA003','Medium'  ,'CASE'   ,4,48,120,TRUE),
 ('SLA004','Low'     ,'CASE'   ,8,96,240,TRUE),
 ('SLA005','High'    ,'DISPUTE',2,24,48 ,TRUE),
 ('SLA006','Medium'  ,'DISPUTE',4,48,96 ,TRUE),
 ('SLA007','Low'     ,'DISPUTE',8,72,168,TRUE),
 ('SLA008','Critical','DISPUTE',1,8 ,24 ,TRUE);

-- ---- 13.9 Risk score priority ----------------------------------------------------
INSERT INTO risk_score_component (code, name, description, weight, priority_order, is_enabled) VALUES
 ('external_credit','External Credit Score','Bureau score pulled from the external provider',40,1,TRUE),
 ('ml_model'       ,'ML Risk Model Score'  ,'Probability of default from the in-house model' ,30,2,TRUE),
 ('system_rules'   ,'System Risk Rules'    ,'Deterministic rules configured in Risk Analysis',20,3,TRUE),
 ('payment_history','Payment History Score','Historical payment behaviour of the customer'   ,10,4,TRUE),
 ('industry_risk'  ,'Industry Risk Score'  ,'Sector-level risk applied to business customers', 0,5,FALSE);

-- ---- 13.10 Risk rules ------------------------------------------------------------
INSERT INTO risk_rule (rule_code, name, description, risk_level, weight, conditions, is_active, is_system) VALUES
 ('RULE001','High Risk - Poor Credit & High Outstanding','Bureau score below 650 with material exposure','High',40,
  '[{"parameter":"credit_score","operator":"lt","value":"650"},{"connector":"AND","parameter":"total_outstanding","operator":"gt","value":"25000"}]',TRUE,TRUE),
 ('RULE002','Critical Risk - Severe Delinquency','More than 90 days past due','Critical',50,
  '[{"parameter":"days_past_due","operator":"gt","value":"90"}]',TRUE,TRUE),
 ('RULE003','Medium Risk - Utilisation Pressure','Credit utilisation above 80 percent','Medium',25,
  '[{"parameter":"utilization_rate","operator":"gt","value":"80"}]',TRUE,TRUE),
 ('RULE004','High Risk - Broken Promise Pattern','Payment pattern score below 40','High',30,
  '[{"parameter":"payment_history","operator":"lt","value":"40"}]',TRUE,FALSE),
 ('RULE005','Low Risk - Stable Long Tenure','Account older than 36 months with clean history','Low',10,
  '[{"parameter":"account_age","operator":"gt","value":"36"},{"connector":"AND","parameter":"payment_history","operator":"gte","value":"80"}]',TRUE,FALSE),
 ('RULE006','Medium Risk - Elevated Debt to Income','Debt-to-income ratio above 0.45','Medium',20,
  '[{"parameter":"debt_to_income","operator":"gt","value":"0.45"}]',TRUE,FALSE);

-- ---- 13.11 AI guardrails ---------------------------------------------------------
INSERT INTO ai_guardrail (config_type, code, label, config, is_enabled, sort_order) VALUES
 ('INPUT_FILTER','block_profanity'      ,'Block Profanity'                                  ,'{"icon":"⛔"}',TRUE ,1),
 ('INPUT_FILTER','block_pii'            ,'Block Personal Data (PII)'                        ,'{"icon":"🕵️","types":["Full Name","Phone Number","Email Address","National ID","Credit Card Number","Address / Postal Code"]}',TRUE ,2),
 ('INPUT_FILTER','language_restrictions','Language Restrictions (English, Arabic only)'      ,'{"icon":"🌐","allowed":["English","Arabic"],"model":"Basic","auto_block_mixed":false}',TRUE ,3),
 ('INPUT_FILTER','limit_question_length','Limit Question Length'                            ,'{"icon":"🔠","min_chars":10,"max_chars":300,"max_words":50,"exceed_action":"Block Input"}',TRUE ,4),
 ('INPUT_FILTER','time_of_day'          ,'Time-of-Day Restrictions'                         ,'{"icon":"📅","from":"08:00","to":"21:00"}',FALSE,5),
 ('INPUT_FILTER','mask_sensitive'       ,'Mask Sensitive Keywords (Regex)'                  ,'{"icon":"🔐","patterns":[]}',FALSE,6),
 ('OUTPUT_FILTER','remove_financial'      ,'Remove Financial Disclosures'                   ,'{"icon":"💸"}',TRUE ,1),
 ('OUTPUT_FILTER','detect_hallucinations' ,'Detect Hallucinations (Factual Consistency)'    ,'{"icon":"🧠"}',TRUE ,2),
 ('OUTPUT_FILTER','detect_bias_toxicity'  ,'Bias / Toxicity Detection'                      ,'{"icon":"⚠️"}',TRUE ,3),
 ('OUTPUT_FILTER','tone_enforcement'      ,'Tone Enforcement'                               ,'{"icon":"🎯","tones":["Professional","Friendly","Neutral","Empathetic"]}',TRUE ,4),
 ('OUTPUT_FILTER','rewrite_unsafe'        ,'Rewriting Unsafe Responses'                     ,'{"icon":"🔄"}',FALSE,5),
 ('OUTPUT_FILTER','disallowed_phrases'    ,'Disallowed Phrases List'                        ,'{"icon":"📌","phrases":[]}',FALSE,6),
 ('ESCALATION_RULE','blocked_thrice','Output blocked 3+ times for a single user'            ,'{"action":"🚨 Notify Supervisor"}',TRUE,1),
 ('ESCALATION_RULE','sim_fraud_keywords','Keywords: SIM Block, Fraud, Lost Phone'           ,'{"action":"👤 Escalate to Human Agent"}',TRUE,2),
 ('ESCALATION_RULE','angry_toxic','Angry sentiment + toxic content'                         ,'{"action":"🤝 Offer live agent"}',TRUE,3),
 ('ESCALATION_RULE','legal_threat','Mentions legal action or threat'                        ,'{"action":"🛑 Alert Legal Team"}',TRUE,4),
 ('PROMPT_TEMPLATE','balance_inquiry','Balance Inquiry'   ,'{"template":"Hi {{name}}, your balance is {{balance}}.","tone":"Friendly"}',TRUE,1),
 ('PROMPT_TEMPLATE','roaming_complaint','Roaming Complaint','{"template":"We are checking this for you. Please wait.","tone":"Neutral"}',TRUE,2),
 ('PROMPT_TEMPLATE','sim_not_working','SIM Not Working'    ,'{"template":"Apologies. Let us help you right away.","tone":"Empathetic"}',TRUE,3),
 ('PROMPT_TEMPLATE','plan_expiry','Plan Expiry'            ,'{"template":"Your plan expires on {{expiry_date}}. Want to renew?","tone":"Friendly"}',TRUE,4);

-- ---- 13.12 Application settings ---------------------------------------------------
INSERT INTO app_setting (category, setting_key, setting_value, data_type, description) VALUES
 ('CURRENCY','currency.default'            ,'"USD"'            ,'STRING' ,'Default reporting currency'),
 ('CURRENCY','currency.display_format'     ,'"SYMBOL_BEFORE"'  ,'STRING' ,'SYMBOL_BEFORE | SYMBOL_AFTER | CODE'),
 ('CURRENCY','currency.thousand_separator' ,'true'             ,'BOOLEAN','Show thousand separators'),
 ('CURRENCY','currency.decimal_places'     ,'2'                ,'NUMBER' ,'Decimal places shown in money fields'),
 ('CURRENCY','currency.compact_large'      ,'true'             ,'BOOLEAN','Abbreviate large amounts as K / M'),
 ('SCORING' ,'scoring.conflict_resolution' ,'"highest_priority"','STRING','highest_priority | weighted_average | manual_review'),
 ('SCORING' ,'scoring.variance_threshold'  ,'50'               ,'NUMBER' ,'Flag for manual review when sources differ by more than this'),
 ('SCORING' ,'scoring.auto_refresh'        ,'true'             ,'BOOLEAN','Recalculate scores nightly'),
 ('SCORING' ,'scoring.manual_review'       ,'true'             ,'BOOLEAN','Route high-variance scores to a reviewer'),
 ('SCORING' ,'scoring.audit_changes'       ,'true'             ,'BOOLEAN','Write every score change to audit_log'),
 ('LEGAL'   ,'legal.escalation_amount'     ,'50000'            ,'NUMBER' ,'Minimum balance for legal escalation'),
 ('LEGAL'   ,'legal.escalation_dpd'        ,'120'              ,'NUMBER' ,'Minimum DPD for legal escalation'),
 ('LEGAL'   ,'legal.auto_assign_agency'    ,'true'             ,'BOOLEAN','Auto-assign an agency on escalation'),
 ('LEGAL'   ,'legal.agency_thresholds'     ,'{"small":10000,"medium":50000,"large":250000}','JSON','Debt amount bands used for agency routing'),
 ('LEGAL'   ,'legal.document_templates'    ,'["Demand Letter","Final Notice","Legal Filing","Settlement Agreement"]','LIST','Templates offered on the legal screen'),
 ('LEGAL'   ,'legal.compliance_checks'     ,'{"fdcpa":true,"contact_window":"08:00-21:00","recording_consent":true}','JSON','Compliance switches'),
 ('SYSTEM'  ,'system.cycle_days'           ,'30'               ,'NUMBER' ,'Days in the collections cycle'),
 ('SYSTEM'  ,'system.sla_default_hours'    ,'48'               ,'NUMBER' ,'Fallback SLA when no band matches'),
 ('SYSTEM'  ,'system.session_timeout_min'  ,'60'               ,'NUMBER' ,'Idle session timeout in minutes'),
 ('SYSTEM'  ,'system.max_login_attempts'   ,'5'                ,'NUMBER' ,'Failed attempts before the account locks'),
 ('SYSTEM'  ,'system.lockout_minutes'      ,'15'               ,'NUMBER' ,'Lockout duration after too many failures'),
 ('SYSTEM'  ,'system.cost_per_account'     ,'32'               ,'NUMBER' ,'Operating cost per touched account (cost-to-collect)');

-- ---- 13.13 Collection agencies ----------------------------------------------------
INSERT INTO collection_agency (agency_code, name, contact_email, phone, specialization,
                               commission_rate, performance_rating, recovery_rate, avg_response_days, status, onboarded_on) VALUES
 ('AGN001','Meridian Recovery Solutions','contact@meridianrecovery.com','+1-555-0123','Commercial Debt',15.00,92.00,68.50,3.20,'ACTIVE'      ,'2021-04-12'),
 ('AGN002','Elite Collection Agency'    ,'info@elitecollection.com'    ,'+1-555-0456','Consumer Debt'  ,18.00,87.00,72.10,2.80,'ACTIVE'      ,'2020-09-30'),
 ('AGN003','Regional Recovery Corp'     ,'support@regionalrecovery.com','+1-555-0789','Small Business' ,20.00,75.00,58.30,4.10,'UNDER_REVIEW','2022-01-18'),
 ('AGN004','Gulf Legal Partners'        ,'legal@gulflegal.ae'          ,'+971-4-555-0111','Enterprise Legal',12.00,89.00,64.00,3.60,'ACTIVE'   ,'2019-06-05');

-- ---- 13.14 Strategies -------------------------------------------------------------
INSERT INTO strategy (strategy_code, name, description, segment_code, aging_bucket, risk_level,
                      status, current_version, is_default, uplift_pct, success_rate,
                      target_audience, workflow_json, created_by, activated_at)
SELECT s.strategy_code, s.name, s.description, s.segment_code, s.aging_bucket, s.risk_level,
       s.status, s.current_version, s.is_default, s.uplift_pct, s.success_rate,
       s.target_audience::jsonb, s.workflow_json::jsonb,
       (SELECT id FROM app_user WHERE email='admin@gmail.com'),
       now() - (s.age_days || ' days')::interval
FROM (VALUES
 ('STR-001','Soft Reminder','Low-touch digital nudges for freshly due balances','Consumer','1-30','Low','ACTIVE','v1.2',TRUE,4.20,68.40,
  '{"segments":["Consumer"],"buckets":["1-30"],"riskLevels":["Low"]}',
  '{"nodes":[{"id":"n1","type":"SMS","label":"SMS Reminder","x":200,"y":60,"timing":"DPD 3","message":"Friendly payment reminder"},{"id":"n2","type":"Email","label":"Email Reminder","x":200,"y":170,"timing":"DPD 7","message":"Invoice copy and payment link"},{"id":"n3","type":"Create PTP","label":"Capture PTP","x":200,"y":280,"timing":"DPD 10"}],"edges":[{"from":"n1","to":"n2"},{"from":"n2","to":"n3"}]}',180),
 ('STR-002','Standard Dunning','Multi-channel dunning ladder for the 31-60 bucket','Consumer','31-60','Medium','ACTIVE','v2.0',FALSE,7.60,61.10,
  '{"segments":["Consumer","SMB"],"buckets":["31-60"],"riskLevels":["Medium"]}',
  '{"nodes":[{"id":"n1","type":"SMS","label":"SMS + WhatsApp","x":200,"y":60,"timing":"DPD 31"},{"id":"n2","type":"AI Dialer","label":"AI Voicebot","x":200,"y":170,"timing":"DPD 35"},{"id":"n3","type":"No Response?","label":"No Response?","x":200,"y":280,"condition":"no_contact_72h"},{"id":"n4","type":"Predictive Dialer","label":"Agent Call","x":200,"y":390,"timing":"DPD 40"}],"edges":[{"from":"n1","to":"n2"},{"from":"n2","to":"n3"},{"from":"n3","to":"n4"}]}',150),
 ('STR-003','AI Adaptive','Next-best-action driven engagement with channel and time optimisation','SMB','31-60','Medium','ACTIVE','v3.1',FALSE,12.80,74.30,
  '{"segments":["SMB","Enterprise"],"buckets":["31-60","61-90"],"riskLevels":["Medium","High"]}',
  '{"nodes":[{"id":"n1","type":"AI Next-Best-Action","label":"Next Best Action","x":200,"y":60},{"id":"n2","type":"AI Recommend Channel","label":"Recommend Channel","x":200,"y":170},{"id":"n3","type":"AI Recommend Time-of-Day","label":"Recommend Time","x":200,"y":280},{"id":"n4","type":"AI PTP Probability","label":"PTP Probability","x":200,"y":390},{"id":"n5","type":"Send Payment Link","label":"Payment Link","x":200,"y":500}],"edges":[{"from":"n1","to":"n2"},{"from":"n2","to":"n3"},{"from":"n3","to":"n4"},{"from":"n4","to":"n5"}]}',120),
 ('STR-004','Intensive Recovery','Hard-bucket recovery with supervisor escalation','Enterprise','61-90','High','ACTIVE','v1.4',FALSE,9.10,52.70,
  '{"segments":["Enterprise"],"buckets":["61-90"],"riskLevels":["High"]}',
  '{"nodes":[{"id":"n1","type":"SMS","label":"SMS + WhatsApp (Legal Tone)","x":200,"y":50,"timing":"DPD 60"},{"id":"n2","type":"AI Dialer","label":"AI Voicebot (Hard Script)","x":200,"y":140,"timing":"DPD 62"},{"id":"n3","type":"Predictive Dialer","label":"Agent Call (Hard Bucket)","x":200,"y":240,"timing":"DPD 63"},{"id":"n4","type":"Escalation","label":"Supervisor Escalation Queue","x":103,"y":340,"timing":"DPD 75"},{"id":"n5","type":"Supervisor Dialer","label":"Supervisor Dialer Call","x":200,"y":430,"timing":"DPD 80"}],"edges":[{"from":"n1","to":"n2"},{"from":"n2","to":"n3"},{"from":"n3","to":"n4"},{"from":"n4","to":"n5"}]}',95),
 ('STR-005','Pre-Legal','Final notice ladder before handover to legal or an agency','Enterprise','90+','Critical','ACTIVE','v1.1',FALSE,6.30,38.90,
  '{"segments":["Enterprise","Government"],"buckets":["90+"],"riskLevels":["Critical"]}',
  '{"nodes":[{"id":"n1","type":"SMS","label":"Pre-Legal Warning (SMS + Email)","x":200,"y":60,"timing":"DPD 85"},{"id":"n2","type":"Legal Pre-Notice","label":"Legal Pre-Notice","x":200,"y":170,"timing":"DPD 92"},{"id":"n3","type":"If >90 Bucket","label":"Still Unpaid?","x":200,"y":280},{"id":"n4","type":"Create Case","label":"Handover to Agency","x":200,"y":390,"timing":"DPD 100"}],"edges":[{"from":"n1","to":"n2"},{"from":"n2","to":"n3"},{"from":"n3","to":"n4"}]}',70),
 ('STR-006','Government Settlement Track','Slow-cycle reconciliation flow for public sector accounts','Government','61-90','Medium','DRAFT','v0.3',FALSE,NULL,NULL,
  '{"segments":["Government"],"buckets":["61-90"],"riskLevels":["Medium"]}',
  '{"nodes":[{"id":"n1","type":"Email","label":"Reconciliation Pack","x":200,"y":60},{"id":"n2","type":"Generate Settlement","label":"Settlement Proposal","x":200,"y":170}],"edges":[{"from":"n1","to":"n2"}]}',20)
) AS s(strategy_code, name, description, segment_code, aging_bucket, risk_level, status,
       current_version, is_default, uplift_pct, success_rate, target_audience, workflow_json, age_days);

-- Version history + approval trail for the two most-edited strategies.
INSERT INTO strategy_version (strategy_id, version_no, workflow_json, change_summary, status,
                              author_id, reviewer_id, review_comments, reviewed_at, published_at, created_at)
SELECT st.id, v.version_no, st.workflow_json, v.change_summary, v.status,
       (SELECT id FROM app_user WHERE email = v.author),
       (SELECT id FROM app_user WHERE email = v.reviewer),
       v.review_comments,
       now() - (v.age_days || ' days')::interval,
       CASE WHEN v.status = 'PUBLISHED' THEN now() - (v.age_days || ' days')::interval END,
       now() - ((v.age_days + 2) || ' days')::interval
FROM (VALUES
 ('STR-004','v1.0','Initial strategy created with AI nodes and channel configuration','PUBLISHED'        ,'supervisor@gmail.com','admin@gmail.com','Approved for pilot'                       ,120),
 ('STR-004','v1.1','Requested adjustment to dispute classification threshold'        ,'CHANGES_REQUESTED','supervisor@gmail.com','admin@gmail.com','Threshold too aggressive, please revisit'  ,95),
 ('STR-004','v1.2','Modified dialer time optimisation and VA routing'                ,'APPROVED'         ,'admin@gmail.com'      ,'superadmin@gmail.com','Looks good'                            ,60),
 ('STR-004','v1.3','Added AI PTP Probability node and updated risk scoring logic'    ,'PUBLISHED'        ,'admin@gmail.com'      ,'superadmin@gmail.com','Published to production'               ,20),
 ('STR-004','v1.4','Supervisor dialer stage added before pre-legal handover'         ,'PENDING_APPROVAL' ,'supervisor@gmail.com',NULL              ,NULL                                        , 3),
 ('STR-003','v3.0','Channel recommender replaced the static ladder'                  ,'PUBLISHED'        ,'admin@gmail.com'      ,'superadmin@gmail.com','Strong uplift in A/B test'             ,45),
 ('STR-003','v3.1','Time-of-day optimiser added'                                     ,'PUBLISHED'        ,'admin@gmail.com'      ,'superadmin@gmail.com','Published'                             ,10)
) AS v(strategy_code, version_no, change_summary, status, author, reviewer, review_comments, age_days)
JOIN strategy st ON st.strategy_code = v.strategy_code;

-- =====================================================================================
-- 14.  SAMPLE TRANSACTIONAL DATA
--      Deterministic (no random()) so the dataset is reproducible.
-- =====================================================================================

-- ---- 14.1 Customers (30) -----------------------------------------------------------
INSERT INTO customer (customer_code, customer_type, full_name, company_name, email, phone, msisdn, ban,
                      segment_code, region_code, country_code, city, address, credit_score, risk_score,
                      risk_level, contactability, best_contact_time, best_channel_code,
                      assigned_agent_id, status, onboarded_on)
SELECT
    'CUST-' || LPAD(g::text, 5, '0'),
    upper(d.segment),
    CASE WHEN d.segment = 'Consumer' THEN d.person END,
    CASE WHEN d.segment <> 'Consumer' THEN d.company END,
    lower(replace(COALESCE(CASE WHEN d.segment='Consumer' THEN d.person END, d.company), ' ', '.')) || '@example.com',
    '+971-5' || (g % 9) || '-' || LPAD((1000000 + g * 7919)::text, 7, '0'),
    '+9715' || LPAD((10000000 + g * 3571)::text, 8, '0'),
    CASE WHEN d.segment <> 'Consumer' THEN 'BAN-' || LPAD((5000 + g)::text, 6, '0') END,
    d.segment,
    (ARRAY['North','South','East','West'])[1 + (g % 4)],
    (ARRAY['AE','US','IN','GB','SA'])[1 + (g % 5)],
    (ARRAY['Dubai','Abu Dhabi','Sharjah','New York','London'])[1 + (g % 5)],
    (100 + g * 7)::text || ' Business Bay, Tower ' || (1 + (g % 12))::text,
    560 + ((g * 37) % 300),
    d.risk_score,
    CASE WHEN d.risk_score >= 75 THEN 'Critical'
         WHEN d.risk_score >= 50 THEN 'High'
         WHEN d.risk_score >= 25 THEN 'Medium'
         ELSE 'Low' END,
    45 + ((g * 13) % 55),
    (ARRAY['9:00 AM - 11:00 AM','11:00 AM - 1:00 PM','2:00 PM - 4:00 PM','5:00 PM - 7:00 PM'])[1 + (g % 4)],
    (ARRAY['SMS','Email','WhatsApp','Voicebot','Dialer'])[1 + (g % 5)],
    ag.id,
    CASE WHEN d.risk_score >= 50 THEN 'PAST_DUE' ELSE 'ACTIVE' END,
    DATE '2019-01-15' + (g * 47)
FROM generate_series(1, 30) AS g
CROSS JOIN LATERAL (
    SELECT
        (ARRAY['Consumer','Consumer','SMB','Enterprise','Government'])[1 + (g % 5)]              AS segment,
        (ARRAY['David Mitchell','Sarah Wilson','John Anderson','Rebecca Johnson','Michael Chen',
               'Priya Nair','Omar Haddad','Elena Petrova','James Carter','Fatima Al Zahra',
               'Daniel Brooks','Aisha Rahman','Thomas Meyer','Grace Okoro','Lucas Almeida'])[1 + (g % 15)] AS person,
        (ARRAY['Alpha Logistics LLC','Gulf PetroTech','TechCorp Industries','Retail Solutions LLC',
               'Global Manufacturing','Metro Construction','Emirates Freight Co','Nova Health Group',
               'BlueWave Marine','Sahara Energy','Civic Works Authority','National Transport Board'])[1 + (g % 12)] AS company,
        ((g * 17) % 96)::numeric AS risk_score
) d
LEFT JOIN LATERAL (
    SELECT u.id FROM app_user u JOIN agent_profile p ON p.user_id = u.id
    ORDER BY p.employee_code OFFSET ((g - 1) % 7) LIMIT 1
) ag ON TRUE;

-- ---- 14.2 Accounts (45) ------------------------------------------------------------
WITH cust AS (SELECT id, customer_type, segment_code, ROW_NUMBER() OVER (ORDER BY id) rn FROM customer)
INSERT INTO account (account_code, customer_id, product_code, currency_code, contract_plan,
                     activation_date, tenure_months, credit_limit, outstanding, prior_outstanding,
                     target_mtd, dpd, aging_bucket, risk_score, risk_level, strategy_id,
                     dunning_stage, channel_code, contact_attempts, contact_successes, channel_cost,
                     contactability, last_contact_at, last_payment_at, assigned_agent_id, status)
SELECT
    'ACC-' || LPAD(g::text, 5, '0'),
    c.id,
    CASE c.segment_code
        WHEN 'Consumer'   THEN (ARRAY['Mobile Postpaid','Device Financing'])[1 + (g % 2)]
        WHEN 'SMB'        THEN 'Business Fibre'
        WHEN 'Enterprise' THEN (ARRAY['Enterprise Suite','MPLS','IoT Connectivity'])[1 + (g % 3)]
        ELSE 'Government Connectivity' END,
    'USD',
    (ARRAY['Premium Package','Standard Package','Business Pro','Enterprise Platinum'])[1 + (g % 4)],
    DATE '2020-03-01' + (g * 29),
    24 + (g % 36),
    v.outstanding * 3,
    v.outstanding,
    ROUND(v.outstanding * 1.08, 2),
    ROUND(v.outstanding * 0.25, 2),
    v.dpd,
    CASE WHEN v.dpd = 0 THEN 'Current'
         WHEN v.dpd <= 30 THEN '1-30'
         WHEN v.dpd <= 60 THEN '31-60'
         WHEN v.dpd <= 90 THEN '61-90'
         ELSE '90+' END,
    v.risk_score,
    CASE WHEN v.risk_score >= 75 THEN 'Critical'
         WHEN v.risk_score >= 50 THEN 'High'
         WHEN v.risk_score >= 25 THEN 'Medium'
         ELSE 'Low' END,
    st.id,
    CASE WHEN v.dpd = 0 THEN 0 WHEN v.dpd <= 30 THEN 1 WHEN v.dpd <= 60 THEN 2
         WHEN v.dpd <= 90 THEN 3 ELSE 5 END,
    (ARRAY['SMS','Email','WhatsApp','Voicebot','Dialer'])[1 + (g % 5)],
    v.attempts,
    -- Connect rate varies by channel: voice channels connect far less often than
    -- delivery-confirmed digital channels, so the Channel Effectiveness report has shape.
    GREATEST(0, v.attempts - ((g % 5) + (g % 2))),
    (ARRAY[0.10,0.05,0.15,0.60,1.20])[1 + (g % 5)],
    40 + ((g * 11) % 60),
    now() - ((g % 14) || ' days')::interval,
    now() - ((10 + (g % 60)) || ' days')::interval,
    c2.assigned_agent_id,
    CASE WHEN v.dpd = 0 THEN 'CURRENT' WHEN v.dpd > 120 THEN 'SUSPENDED' ELSE 'DELINQUENT' END
FROM generate_series(1, 45) AS g
JOIN cust c ON c.rn = 1 + ((g - 1) % 30)
JOIN customer c2 ON c2.id = c.id
CROSS JOIN LATERAL (
    SELECT (ARRAY[0,12,25,44,58,72,88,105,133,7])[1 + (g % 10)]                       AS dpd,
           ROUND((780 + (g * 2137) % 240000)::numeric, 2)                             AS outstanding,
           ((g * 23) % 97)::numeric                                                   AS risk_score,
           1 + (g % 9)                                                                AS attempts
) v
LEFT JOIN strategy st ON st.strategy_code =
    CASE WHEN v.dpd = 0 THEN 'STR-001'
         WHEN v.dpd <= 30 THEN 'STR-001'
         WHEN v.dpd <= 60 THEN 'STR-002'
         WHEN v.dpd <= 90 THEN 'STR-004'
         ELSE 'STR-005' END;

-- ---- 14.3 Invoices (90 — 2 per account) ---------------------------------------------
WITH acc AS (SELECT id, customer_id, outstanding, dpd, ROW_NUMBER() OVER (ORDER BY id) rn FROM account)
INSERT INTO invoice (invoice_no, account_id, customer_id, bill_period_start, bill_period_end,
                     issue_date, due_date, amount, tax_amount, paid_amount, service_description, status)
SELECT
    'INV-2025-' || LPAD(g::text, 5, '0'),
    a.id,
    a.customer_id,
    (DATE '2025-01-01' + ((g % 6) * 30)),
    (DATE '2025-01-01' + ((g % 6) * 30) + 29),
    (DATE '2025-01-01' + ((g % 6) * 30) + 30),
    (DATE '2025-01-01' + ((g % 6) * 30) + 45),
    ROUND(a.outstanding / 2, 2),
    ROUND(a.outstanding / 2 * 0.05, 2),
    CASE WHEN g % 3 = 0 THEN ROUND(a.outstanding / 2 * 1.05, 2)
         WHEN g % 3 = 1 THEN ROUND(a.outstanding / 4, 2)
         ELSE 0 END,
    (ARRAY['Monthly service charges','Device instalment + service','Fibre and managed services',
           'Enterprise connectivity bundle','Roaming and value-added services'])[1 + (g % 5)],
    CASE WHEN g % 3 = 0 THEN 'PAID'
         WHEN g % 3 = 1 THEN 'PARTIAL'
         WHEN a.dpd > 30 THEN 'OVERDUE'
         ELSE 'UNPAID' END
FROM generate_series(1, 90) AS g
JOIN acc a ON a.rn = 1 + ((g - 1) % 45);

-- ---- 14.4 Cases (28) ----------------------------------------------------------------
WITH del AS (
    SELECT a.id AS account_id, a.customer_id, a.outstanding, a.dpd, a.risk_level,
           a.assigned_agent_id, a.strategy_id, a.dunning_stage,
           ROW_NUMBER() OVER (ORDER BY a.dpd DESC, a.outstanding DESC) rn
    FROM account a WHERE a.aging_bucket <> 'Current'
)
INSERT INTO debt_case (case_code, customer_id, account_id, case_type_code, summary, status, priority,
                       risk_level, amount, predicted_payment, dpd, strategy_id, dunning_stage,
                       assigned_agent_id, opened_at, sla_deadline, first_response_at, last_activity_at,
                       closed_at, resolution_code, resolution_hours, sla_breached)
SELECT
    'C-' || (12450 + g)::text,
    d.customer_id,
    d.account_id,
    (ARRAY['Collection','Billing Issue','Broken PTP','Dispute','Payment Plan','Legal Followup'])[1 + (g % 6)],
    (ARRAY['Customer unreachable on primary channel; escalating to dialer.',
           'Disputed roaming charges pending billing verification.',
           'Promise to pay broken twice; renegotiating instalment plan.',
           'Enterprise account awaiting purchase-order reconciliation.',
           'Payment plan agreed, first instalment scheduled.',
           'Pre-legal notice issued, awaiting customer response.'])[1 + (g % 6)],
    s.status,
    CASE WHEN d.risk_level IN ('Critical','High') THEN 'High'
         WHEN d.risk_level = 'Medium' THEN 'Medium' ELSE 'Low' END,
    d.risk_level,
    d.outstanding,
    ROUND(d.outstanding * 0.15, 2),
    d.dpd,
    d.strategy_id,
    d.dunning_stage,
    d.assigned_agent_id,
    now() - ((5 + g) || ' days')::interval,
    now() - ((5 + g) || ' days')::interval + (sla.max_resolution_hours || ' hours')::interval,
    now() - ((5 + g) || ' days')::interval + INTERVAL '3 hours',
    now() - ((g % 5) || ' days')::interval,
    CASE WHEN s.status IN ('RESOLVED','CLOSED') THEN now() - ((g % 4) || ' days')::interval END,
    CASE WHEN s.status IN ('RESOLVED','CLOSED')
         THEN (ARRAY['PAID_IN_FULL','PAYMENT_PLAN','SETTLED','DISPUTE_UPHELD'])[1 + (g % 4)] END,
    CASE WHEN s.status IN ('RESOLVED','CLOSED') THEN ROUND((12 + (g * 7) % 180)::numeric, 2) END,
    (g % 7 = 0)
FROM generate_series(1, 28) AS g
JOIN del d ON d.rn = g
CROSS JOIN LATERAL (
    SELECT (ARRAY['OPEN','IN_PROGRESS','AWAITING_RESPONSE','ESCALATED','LEGAL','RESOLVED','CLOSED'])[1 + (g % 7)] AS status
) s
LEFT JOIN sla_config sla ON sla.risk_level = d.risk_level AND sla.applies_to = 'CASE';

-- ---- 14.5 Promises to Pay (30) -------------------------------------------------------
WITH cs AS (SELECT id, customer_id, account_id, amount, assigned_agent_id,
                   ROW_NUMBER() OVER (ORDER BY id) rn FROM debt_case)
INSERT INTO ptp (ptp_code, customer_id, account_id, case_id, promised_amount, promised_date,
                 instalment_count, kept_amount, status, channel_code, ai_probability,
                 fulfilled_at, notes, created_by)
SELECT
    'PTP-' || LPAD(g::text, 5, '0'),
    c.customer_id,
    c.account_id,
    c.id,
    ROUND(c.amount * (0.10 + (g % 5) * 0.05), 2),
    CURRENT_DATE + ((g % 21) - 7),
    1 + (g % 3),
    CASE WHEN st.status = 'KEPT' THEN ROUND(c.amount * (0.10 + (g % 5) * 0.05), 2) ELSE 0 END,
    st.status,
    (ARRAY['Dialer','Voicebot','WhatsApp','SMS','Email'])[1 + (g % 5)],
    35 + ((g * 19) % 60),
    CASE WHEN st.status = 'KEPT' THEN now() - ((g % 10) || ' days')::interval END,
    (ARRAY['Customer confirmed salary date','Split into two instalments',
           'Awaiting purchase order approval','Payment link shared on WhatsApp',
           'Renegotiated after previous break'])[1 + (g % 5)],
    c.assigned_agent_id
FROM generate_series(1, 30) AS g
JOIN cs c ON c.rn = 1 + ((g - 1) % 28)
CROSS JOIN LATERAL (
    SELECT (ARRAY['PENDING','KEPT','BROKEN','KEPT','PENDING','CANCELLED'])[1 + (g % 6)] AS status
) st;

-- ---- 14.6 Payments (40) ---------------------------------------------------------------
WITH inv AS (SELECT i.id, i.account_id, i.customer_id, i.amount, i.tax_amount,
                    ROW_NUMBER() OVER (ORDER BY i.id) rn FROM invoice i)
INSERT INTO payment (payment_ref, customer_id, account_id, invoice_id, ptp_id, case_id, amount,
                     payment_date, method_code, status, payment_link_sent, notes, created_by)
SELECT
    'TXN-' || LPAD(g::text, 6, '0'),
    i.customer_id,
    i.account_id,
    i.id,
    p.id,
    p.case_id,
    ROUND((i.amount + i.tax_amount) * (ARRAY[1.00,0.50,0.25,0.75])[1 + (g % 4)], 2),
    CURRENT_DATE - (g % 45),
    (ARRAY['Bank Transfer','Credit Card','Auto-Debit','Payment Link','Cheque','Cash'])[1 + (g % 6)],
    (ARRAY['COMPLETED','COMPLETED','COMPLETED','PENDING','FAILED'])[1 + (g % 5)],
    (g % 4 = 0),
    (ARRAY['Auto-debit collection','Partial settlement','Payment link redeemed',
           'Branch counter payment','Cheque cleared'])[1 + (g % 5)],
    (SELECT id FROM app_user WHERE email = 'admin@gmail.com')
FROM generate_series(1, 40) AS g
JOIN inv i ON i.rn = 1 + ((g - 1) % 90)
LEFT JOIN LATERAL (
    SELECT x.id, x.case_id FROM ptp x
    WHERE x.account_id = i.account_id AND x.status = 'KEPT'
    ORDER BY x.id LIMIT 1
) p ON TRUE;

-- ---- 14.7 Disputes (24) ----------------------------------------------------------------
WITH inv AS (SELECT i.id, i.account_id, i.customer_id, i.amount,
                    ROW_NUMBER() OVER (ORDER BY i.id DESC) rn FROM invoice i)
INSERT INTO dispute (dispute_code, customer_id, account_id, invoice_id, case_id, reason_code,
                     description, amount, status, priority, assigned_agent_id, filed_at,
                     sla_deadline, resolved_at, resolution_note, ai_confidence, ai_analysis, attachments)
SELECT
    'DSP-' || LPAD(g::text, 5, '0'),
    i.customer_id,
    i.account_id,
    i.id,
    dc.id,
    (ARRAY['INCORRECT_AMOUNT','SERVICE_NOT_DELIVERED','DUPLICATE_INVOICE','ROAMING_CHARGES',
           'DEVICE_INSTALMENT','LATE_FEE'])[1 + (g % 6)],
    (ARRAY['Customer states the billed amount does not match the agreed tariff.',
           'Service outage during part of the billed period.',
           'Same invoice raised twice in the billing run.',
           'Roaming bundle was active but usage was charged at pay-as-you-go rates.',
           'Device instalment charged twice in the same cycle.',
           'Late fee applied although payment was made before the due date.'])[1 + (g % 6)],
    ROUND(i.amount * 0.20, 2),
    s.status,
    (ARRAY['Low','Medium','High','Critical'])[1 + (g % 4)],
    ag.id,
    now() - ((3 + g) || ' days')::interval,
    now() - ((3 + g) || ' days')::interval + INTERVAL '48 hours',
    CASE WHEN s.status IN ('APPROVED','REJECTED','RESOLVED') THEN now() - ((g % 3) || ' days')::interval END,
    CASE WHEN s.status = 'APPROVED' THEN 'Credit note issued to the customer account.'
         WHEN s.status = 'REJECTED' THEN 'Billing verified as correct; charges upheld.'
         WHEN s.status = 'RESOLVED' THEN 'Partial adjustment applied as a goodwill gesture.' END,
    55 + ((g * 7) % 45),
    jsonb_build_object(
        'is_valid', (g % 2 = 0),
        'validity_score', 40 + ((g * 11) % 60),
        'evidence_found', jsonb_build_array('Invoice line item matched', 'Payment ledger reviewed'),
        'contradictions', jsonb_build_array(),
        'conclusion', 'Automated reconciliation completed against invoice and payment history.'),
    jsonb_build_array(jsonb_build_object('name','invoice_copy.pdf','type','application/pdf'))
FROM generate_series(1, 24) AS g
JOIN inv i ON i.rn = g
CROSS JOIN LATERAL (
    SELECT (ARRAY['OPEN','INVESTIGATING','ESCALATED','APPROVED','REJECTED','RESOLVED'])[1 + (g % 6)] AS status
) s
LEFT JOIN LATERAL (
    SELECT u.id FROM app_user u JOIN agent_profile p ON p.user_id = u.id
    ORDER BY p.employee_code OFFSET ((g - 1) % 7) LIMIT 1
) ag ON TRUE
LEFT JOIN LATERAL (
    SELECT x.id FROM debt_case x WHERE x.account_id = i.account_id ORDER BY x.id LIMIT 1
) dc ON TRUE;

-- ---- 14.8 Case activity / timeline (112) ------------------------------------------------
WITH cs AS (SELECT id, customer_id, account_id, assigned_agent_id,
                   ROW_NUMBER() OVER (ORDER BY id) rn FROM debt_case)
INSERT INTO case_activity (activity_type, customer_id, account_id, case_id, channel_code, direction,
                           subject, body, outcome, visibility, is_automated, agent_id, occurred_at)
SELECT
    t.activity_type,
    c.customer_id,
    c.account_id,
    c.id,
    t.channel_code,
    t.direction,
    t.subject,
    t.body,
    t.outcome,
    CASE WHEN t.activity_type = 'NOTE' AND g % 2 = 0 THEN 'CUSTOMER_FACING' ELSE 'INTERNAL' END,
    t.is_automated,
    c.assigned_agent_id,
    now() - ((g % 30) || ' days')::interval - ((g % 12) || ' hours')::interval
FROM generate_series(1, 112) AS g
JOIN cs c ON c.rn = 1 + ((g - 1) % 28)
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
      ('CALL'    ,'Dialer'  ,'OUTBOUND','Outbound Call'   ,'Discussed the outstanding balance and payment options.','Promise to pay captured', FALSE),
      ('SMS'     ,'SMS'     ,'OUTBOUND','SMS Reminder'    ,'Your balance is overdue. Tap the link to pay.'         ,'Delivered'              , TRUE ),
      ('EMAIL'   ,'Email'   ,'OUTBOUND','Invoice Reminder','Invoice copy and payment link attached.'               ,'Opened'                 , TRUE ),
      ('NOTE'    ,NULL      ,'INTERNAL','Agent Note'      ,'Customer reports temporary cash-flow issue this month.','Logged'                 , FALSE),
      ('WHATSAPP','WhatsApp','OUTBOUND','WhatsApp Follow-up','Following up on the promise made last week.'         ,'Read'                   , TRUE ),
      ('VOICEBOT','Voicebot','OUTBOUND','AI Voicebot Attempt','Automated negotiation call placed.'                 ,'No answer'              , TRUE ),
      ('STATUS_CHANGE',NULL ,'INTERNAL','Status Updated'  ,'Case moved to the next dunning stage.'                 ,'Stage advanced'         , TRUE ),
      ('PAYMENT' ,NULL      ,'INBOUND' ,'Payment Received','Partial payment posted against the oldest invoice.'    ,'Posted'                 , TRUE )
    ) AS x(activity_type, channel_code, direction, subject, body, outcome, is_automated)
    OFFSET (g % 8) LIMIT 1
) t;

-- Dispute timeline events (48).
WITH dp AS (SELECT id, customer_id, account_id, assigned_agent_id,
                   ROW_NUMBER() OVER (ORDER BY id) rn FROM dispute)
INSERT INTO case_activity (activity_type, customer_id, account_id, dispute_id, direction, subject,
                           body, outcome, visibility, is_automated, agent_id, occurred_at)
SELECT
    (ARRAY['DISPUTE','NOTE','STATUS_CHANGE','SYSTEM'])[1 + (g % 4)],
    d.customer_id,
    d.account_id,
    d.id,
    'INTERNAL',
    (ARRAY['Dispute Filed','Investigation Note','Status Updated','AI Reconciliation Run'])[1 + (g % 4)],
    (ARRAY['Dispute raised by the customer through the contact centre.',
           'Billing team asked to confirm the tariff applied for the period.',
           'Status moved forward after evidence review.',
           'AI reconciliation compared invoices against the payment ledger.'])[1 + (g % 4)],
    (ARRAY['Acknowledged','Pending billing','Updated','Confidence 82%'])[1 + (g % 4)],
    'INTERNAL',
    (g % 4 = 3),
    d.assigned_agent_id,
    now() - ((g % 20) || ' days')::interval
FROM generate_series(1, 48) AS g
JOIN dp d ON d.rn = 1 + ((g - 1) % 24);

-- ---- 14.9 Legal escalations (10) -----------------------------------------------------
WITH hard AS (
    SELECT dc.id AS case_id, dc.customer_id, dc.account_id, dc.amount,
           ROW_NUMBER() OVER (ORDER BY dc.amount DESC) rn
    FROM debt_case dc WHERE dc.dpd > 60
)
INSERT INTO legal_escalation (escalation_code, customer_id, account_id, case_id, agency_id,
                              attorney_name, outstanding_amount, recovered_amount, commission_amount,
                              stage, status, success_probability, filing_date, court_date,
                              next_review_date, notes, escalated_at)
SELECT
    'LEG-' || LPAD(g::text, 4, '0'),
    h.customer_id,
    h.account_id,
    h.case_id,
    ag.id,
    (ARRAY['Sarah Mitchell','Michael Chang','Jennifer Rodriguez','David Thompson'])[1 + (g % 4)],
    h.amount,
    ROUND(h.amount * (ARRAY[0.00,0.15,0.35,0.60])[1 + (g % 4)], 2),
    ROUND(h.amount * (ARRAY[0.00,0.15,0.35,0.60])[1 + (g % 4)] * ag.commission_rate / 100, 2),
    (ARRAY['INITIAL_FILING','PRE_TRIAL','POST_JUDGMENT','SETTLEMENT'])[1 + (g % 4)],
    (ARRAY['PENDING','ACTIVE','ACTIVE','COMPLETED'])[1 + (g % 4)],
    55 + ((g * 9) % 40),
    CURRENT_DATE - (60 - g * 3),
    CURRENT_DATE + (20 + g * 4),
    CURRENT_DATE + (7 + g),
    'Handed to the agency after the pre-legal notice expired without response.',
    now() - ((20 + g) || ' days')::interval
FROM generate_series(1, 10) AS g
JOIN hard h ON h.rn = g
JOIN LATERAL (
    SELECT a.id, a.commission_rate FROM collection_agency a
    WHERE a.status = 'ACTIVE' ORDER BY a.agency_code OFFSET ((g - 1) % 3) LIMIT 1
) ag ON TRUE;

-- ---- 14.10 Agent monthly performance (7 agents × 4 months = 28) ------------------------
INSERT INTO agent_performance (agent_id, period_month, target_amount, collected_amount,
                               cases_assigned, cases_resolved, ptp_created, ptp_kept,
                               disputes_handled, contact_attempts, contact_successes,
                               avg_resolution_hours, sla_breaches, quality_score)
SELECT
    a.user_id,
    (date_trunc('month', CURRENT_DATE) - ((m - 1) || ' months')::interval)::date,
    a.monthly_target,
    ROUND(a.monthly_target * (0.72 + ((a.rn * 7 + m * 11) % 45)::numeric / 100), 2),
    18 + ((a.rn * 5 + m * 3) % 22),
    12 + ((a.rn * 3 + m * 7) % 16),
    14 + ((a.rn * 9 + m) % 18),
     8 + ((a.rn * 4 + m * 5) % 12),
     3 + ((a.rn + m) % 9),
    120 + ((a.rn * 31 + m * 17) % 180),
     60 + ((a.rn * 13 + m * 9) % 90),
    ROUND((28 + ((a.rn * 11 + m * 5) % 60))::numeric, 2),
    (a.rn + m) % 5,
    ROUND((78 + ((a.rn * 3 + m * 2) % 20))::numeric, 2)
FROM (SELECT user_id, monthly_target, ROW_NUMBER() OVER (ORDER BY employee_code) rn FROM agent_profile) a
CROSS JOIN generate_series(1, 4) AS m;

-- ---- 14.11 Notifications (24) -----------------------------------------------------------
WITH hot AS (
    SELECT c.id AS customer_id, c.risk_level,
           COALESCE(c.full_name, c.company_name) AS display_name,
           ROW_NUMBER() OVER (ORDER BY c.risk_score DESC) rn
    FROM customer c
)
INSERT INTO notification (user_id, type, severity, title, message, customer_id, case_id, is_read, created_at)
SELECT
    CASE WHEN g % 3 = 0 THEN NULL ELSE sup.id END,
    t.type, t.severity, t.title,
    t.msg_prefix || h.display_name || t.msg_suffix,
    h.customer_id,
    dc.id,
    (g % 4 = 0),
    now() - ((g % 15) || ' days')::interval - ((g % 20) || ' hours')::interval
FROM generate_series(1, 24) AS g
JOIN hot h ON h.rn = 1 + ((g - 1) % 30)
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
      ('HIGH_RISK'    ,'CRITICAL','High Risk Customer Alert','' ,' is marked as high risk. Immediate action required.'),
      ('PAYMENT_ALERT','WARNING' ,'Missed Payment Detected' ,'' ,' has a missed payment on the current cycle.'),
      ('DISPUTE'      ,'INFO'    ,'Dispute Filed'           ,'' ,' filed a new billing dispute.'),
      ('SLA_BREACH'   ,'CRITICAL','SLA Breach'              ,'Case for ',' has breached its resolution SLA.'),
      ('PTP_BROKEN'   ,'WARNING' ,'Promise to Pay Broken'   ,'' ,' did not honour the agreed promise to pay.'),
      ('SYSTEM'       ,'INFO'    ,'Strategy Published'      ,'A new dunning strategy now applies to ',' .')
    ) AS x(type, severity, title, msg_prefix, msg_suffix)
    OFFSET (g % 6) LIMIT 1
) t
LEFT JOIN LATERAL (SELECT x.id FROM debt_case x WHERE x.customer_id = h.customer_id ORDER BY x.id LIMIT 1) dc ON TRUE
CROSS JOIN LATERAL (SELECT id FROM app_user WHERE email = 'supervisor@gmail.com') sup;

-- ---- 14.12 Audit log (25) ----------------------------------------------------------------
INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, ip_address, created_at)
SELECT
    u.id, u.full_name, t.action, t.entity_type, t.entity_id, t.details,
    ('192.168.1.' || (100 + (g % 40)))::inet,
    now() - ((g % 20) || ' days')::interval - ((g % 23) || ' hours')::interval
FROM generate_series(1, 25) AS g
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
      ('Updated Risk Threshold' ,'risk_rule'      ,'RULE001','Changed high risk threshold from 10,000 to 15,000'),
      ('Created PTP'            ,'ptp'            ,'PTP-00007','Created a promise to pay for 750.00'),
      ('Approved Write-off'     ,'debt_case'      ,'C-12463','Approved write-off for 5,200.00'),
      ('Updated SLA'            ,'sla_config'     ,'SLA002','Escalation window reduced from 48h to 24h'),
      ('Edited Role Permissions','role','supervisor@gmail.com','Revoked dunningStrategyDesigner'),
      ('Published Strategy'     ,'strategy'       ,'STR-004','Published version v1.3'),
      ('Changed Default Currency','app_setting'   ,'currency.default','Default currency set to USD')
    ) AS x(action, entity_type, entity_id, details)
    OFFSET (g % 7) LIMIT 1
) t
JOIN LATERAL (
    SELECT id, full_name FROM app_user ORDER BY id OFFSET ((g - 1) % 5) LIMIT 1
) u ON TRUE;

-- Denormalised convenience: keep account.last_payment_at in step with the payment table.
UPDATE account a
SET last_payment_at = p.last_paid
FROM (SELECT account_id, MAX(payment_date)::timestamptz AS last_paid
      FROM payment WHERE status = 'COMPLETED' GROUP BY account_id) p
WHERE p.account_id = a.id;

-- Invoice status reconciliation against posted payments.
UPDATE invoice i
SET paid_amount = LEAST(i.amount + i.tax_amount, agg.paid),
    status = CASE WHEN agg.paid >= i.amount + i.tax_amount THEN 'PAID'
                  WHEN agg.paid > 0 THEN 'PARTIAL'
                  WHEN i.due_date < CURRENT_DATE THEN 'OVERDUE'
                  ELSE 'UNPAID' END
FROM (SELECT invoice_id, SUM(amount) AS paid FROM payment
      WHERE status = 'COMPLETED' AND invoice_id IS NOT NULL GROUP BY invoice_id) agg
WHERE agg.invoice_id = i.id;

-- =====================================================================================
-- 15.  VERIFICATION
-- =====================================================================================
ANALYZE;

SELECT 'Tables created' AS check, count(*)::text AS value
FROM information_schema.tables
 WHERE table_schema IN ('public','administration') AND table_type = 'BASE TABLE'
UNION ALL SELECT 'master_data',        count(*)::text FROM master_data
UNION ALL SELECT 'role',               count(*)::text FROM role
UNION ALL SELECT 'permission',         count(*)::text FROM permission
UNION ALL SELECT 'app_user',           count(*)::text FROM app_user
UNION ALL SELECT 'menu_item',          count(*)::text FROM menu_item
UNION ALL SELECT 'agent_profile',      count(*)::text FROM agent_profile
UNION ALL SELECT 'agent_performance',  count(*)::text FROM agent_performance
UNION ALL SELECT 'app_setting',        count(*)::text FROM app_setting
UNION ALL SELECT 'sla_config',         count(*)::text FROM sla_config
UNION ALL SELECT 'risk_score_component',count(*)::text FROM risk_score_component
UNION ALL SELECT 'risk_rule',          count(*)::text FROM risk_rule
UNION ALL SELECT 'ai_guardrail',       count(*)::text FROM ai_guardrail
UNION ALL SELECT 'strategy',           count(*)::text FROM strategy
UNION ALL SELECT 'strategy_version',   count(*)::text FROM strategy_version
UNION ALL SELECT 'customer',           count(*)::text FROM customer
UNION ALL SELECT 'account',            count(*)::text FROM account
UNION ALL SELECT 'invoice',            count(*)::text FROM invoice
UNION ALL SELECT 'debt_case',          count(*)::text FROM debt_case
UNION ALL SELECT 'ptp',                count(*)::text FROM ptp
UNION ALL SELECT 'payment',            count(*)::text FROM payment
UNION ALL SELECT 'dispute',            count(*)::text FROM dispute
UNION ALL SELECT 'case_activity',      count(*)::text FROM case_activity
UNION ALL SELECT 'collection_agency',  count(*)::text FROM collection_agency
UNION ALL SELECT 'legal_escalation',   count(*)::text FROM legal_escalation
UNION ALL SELECT 'notification',       count(*)::text FROM notification
UNION ALL SELECT 'audit_log',          count(*)::text FROM audit_log;

-- Smoke test: the login query the backend will run.
SELECT u.email, r.code AS role, u.status,
       (u.password_hash = crypt('Admin@123', u.password_hash)) AS password_ok
FROM app_user u JOIN role r ON r.id = u.role_id
ORDER BY u.id;
