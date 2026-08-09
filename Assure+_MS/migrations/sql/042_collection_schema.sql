-- Collection Workspace & Case Management — the `collection` schema.
--
-- DESIGN DECISION, stated plainly because it shapes everything else:
--
--   customer_schema.debt_case REMAINS the case record of truth.
--
-- It is already referenced by ptp, dispute, payment, legal_escalation,
-- notification and case_activity. A second `collection.case` table would
-- orphan every one of those relationships and give the system two conflicting
-- answers to "what is this case?". So this schema does NOT re-create the case;
-- it supplies everything a case needs that debt_case cannot express.
--
-- Likewise customer_schema.case_activity remains the activity/timeline record
-- (312 rows, written by the Agent Workspace) — collection.case_audit records
-- *field-level* change history, which is a different thing from an activity.
--
-- Nothing about a customer, account, invoice, payment, PTP, dispute, agency
-- placement or legal case is stored here. All of it is reached by foreign key.

CREATE SCHEMA IF NOT EXISTS collection;

-- ==========================================================================
-- 1. Configuration / reference data
-- ==========================================================================

-- Case type: what kind of work this is, and the rules that govern it.
CREATE TABLE IF NOT EXISTS collection.case_type (
    code                VARCHAR(40)  PRIMARY KEY,
    name                VARCHAR(120) NOT NULL,
    description         VARCHAR(300),
    -- Hours to first response / resolution, by priority, resolved at runtime.
    default_priority    VARCHAR(20)  NOT NULL DEFAULT 'Medium',
    default_queue       VARCHAR(40),
    sla_hours           INTEGER      NOT NULL DEFAULT 24,
    -- What to do when a case of this type already exists for the customer.
    duplicate_policy    VARCHAR(20)  NOT NULL DEFAULT 'OPEN_EXISTING',
    requires_approval   BOOLEAN      NOT NULL DEFAULT FALSE,
    auto_close_on_pay   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order          SMALLINT     NOT NULL DEFAULT 100,
    CONSTRAINT case_type_dup_ck CHECK (duplicate_policy IN
        ('OPEN_EXISTING','MERGE','CREATE_CHILD','CREATE_NEW'))
);

-- Where a case came from. Kept as data so a new integration does not need a
-- code change to be attributable.
CREATE TABLE IF NOT EXISTS collection.case_source (
    code                VARCHAR(40)  PRIMARY KEY,
    name                VARCHAR(120) NOT NULL,
    description         VARCHAR(300),
    is_automated        BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order          SMALLINT     NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS collection.case_priority (
    code                VARCHAR(20)  PRIMARY KEY,
    name                VARCHAR(60)  NOT NULL,
    rank                SMALLINT     NOT NULL,          -- 1 = most urgent
    sla_hours           INTEGER      NOT NULL,
    colour              VARCHAR(20),
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE
);

-- A queue is a pool of work. Cases land in one and agents draw from it.
CREATE TABLE IF NOT EXISTS collection.case_queue (
    code                VARCHAR(40)  PRIMARY KEY,
    name                VARCHAR(120) NOT NULL,
    description         VARCHAR(300),
    -- Which bucket of the book this queue is for.
    dpd_min             INTEGER,
    dpd_max             INTEGER,
    amount_min          NUMERIC(15,2),
    amount_max          NUMERIC(15,2),
    risk_levels         TEXT[]       NOT NULL DEFAULT '{}',
    customer_types      TEXT[]       NOT NULL DEFAULT '{}',
    -- How work is handed out of this queue.
    assignment_mode     VARCHAR(20)  NOT NULL DEFAULT 'ROUND_ROBIN',
    max_per_agent       INTEGER      NOT NULL DEFAULT 50,
    business_hours      VARCHAR(60),
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order          SMALLINT     NOT NULL DEFAULT 100,
    CONSTRAINT queue_mode_ck CHECK (assignment_mode IN
        ('ROUND_ROBIN','LEAST_LOADED','SKILL_BASED','MANUAL'))
);

-- ==========================================================================
-- 2. Workflow — configurable case lifecycle
-- ==========================================================================
CREATE TABLE IF NOT EXISTS collection.workflow (
    code                VARCHAR(40)  PRIMARY KEY,
    name                VARCHAR(120) NOT NULL,
    description         VARCHAR(300),
    is_default          BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE
);

-- A state a case may occupy. `category` lets reporting group states without
-- hard-coding the list.
CREATE TABLE IF NOT EXISTS collection.workflow_state (
    id                  BIGSERIAL PRIMARY KEY,
    workflow_code       VARCHAR(40)  NOT NULL REFERENCES collection.workflow(code) ON DELETE CASCADE,
    code                VARCHAR(40)  NOT NULL,
    name                VARCHAR(120) NOT NULL,
    category            VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    is_initial          BOOLEAN      NOT NULL DEFAULT FALSE,
    is_terminal         BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Work sitting in this state stops the SLA clock (e.g. Pending Customer).
    pauses_sla          BOOLEAN      NOT NULL DEFAULT FALSE,
    colour              VARCHAR(20),
    sort_order          SMALLINT     NOT NULL DEFAULT 100,
    UNIQUE (workflow_code, code),
    CONSTRAINT state_category_ck CHECK (category IN ('OPEN','PENDING','ESCALATED','CLOSED','CANCELLED'))
);

-- Which moves are legal, who may make them, and what they demand.
CREATE TABLE IF NOT EXISTS collection.workflow_transition (
    id                  BIGSERIAL PRIMARY KEY,
    workflow_code       VARCHAR(40)  NOT NULL REFERENCES collection.workflow(code) ON DELETE CASCADE,
    from_state          VARCHAR(40)  NOT NULL,
    to_state            VARCHAR(40)  NOT NULL,
    label               VARCHAR(120) NOT NULL,
    -- Permission key required to make this move (app.core.rbac PermKey).
    required_permission VARCHAR(60),
    requires_note       BOOLEAN      NOT NULL DEFAULT FALSE,
    requires_approval   BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order          SMALLINT     NOT NULL DEFAULT 100,
    UNIQUE (workflow_code, from_state, to_state)
);

-- ==========================================================================
-- 3. Case metadata — the 1:1 extension of customer_schema.debt_case
-- ==========================================================================
CREATE TABLE IF NOT EXISTS collection.case_meta (
    case_id             BIGINT PRIMARY KEY
                        REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    -- Provenance
    source_code         VARCHAR(40)  NOT NULL REFERENCES collection.case_source(code),
    trigger_detail      VARCHAR(300),
    created_by_user     BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    created_by_role     VARCHAR(40),
    external_ref        VARCHAR(120),
    -- Routing
    queue_code          VARCHAR(40)  REFERENCES collection.case_queue(code) ON DELETE SET NULL,
    workflow_code       VARCHAR(40)  NOT NULL DEFAULT 'STANDARD'
                        REFERENCES collection.workflow(code),
    workflow_state      VARCHAR(40)  NOT NULL DEFAULT 'NEW',
    due_date            DATE,
    -- What the case is about, beyond the account: the specific invoice, promise,
    -- dispute, agency placement or legal case that triggered it. All by FK.
    invoice_id          BIGINT REFERENCES customer_schema.invoice(id) ON DELETE SET NULL,
    ptp_id              BIGINT REFERENCES customer_schema.ptp(id) ON DELETE SET NULL,
    dispute_id          BIGINT REFERENCES customer_schema.dispute(id) ON DELETE SET NULL,
    placement_id        BIGINT REFERENCES recovery_schema.placement(id) ON DELETE SET NULL,
    legal_case_id       BIGINT REFERENCES recovery_schema.legal_case(id) ON DELETE SET NULL,
    strategy_id         BIGINT REFERENCES public.strategy(id) ON DELETE SET NULL,
    -- Relationships between cases: merge and parent/child.
    parent_case_id      BIGINT REFERENCES customer_schema.debt_case(id) ON DELETE SET NULL,
    merged_into_case_id BIGINT REFERENCES customer_schema.debt_case(id) ON DELETE SET NULL,
    merged_at           TIMESTAMPTZ,
    -- Reopen tracking
    reopen_count        SMALLINT     NOT NULL DEFAULT 0,
    last_reopened_at    TIMESTAMPTZ,
    -- SLA accounting, so a paused state does not count against the agent.
    sla_paused_seconds  INTEGER      NOT NULL DEFAULT 0,
    sla_paused_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT meta_no_self_parent CHECK (parent_case_id IS DISTINCT FROM case_id),
    CONSTRAINT meta_no_self_merge  CHECK (merged_into_case_id IS DISTINCT FROM case_id)
);

CREATE INDEX IF NOT EXISTS case_meta_queue_idx    ON collection.case_meta (queue_code, workflow_state);
CREATE INDEX IF NOT EXISTS case_meta_source_idx   ON collection.case_meta (source_code);
CREATE INDEX IF NOT EXISTS case_meta_state_idx    ON collection.case_meta (workflow_state);
CREATE INDEX IF NOT EXISTS case_meta_parent_idx   ON collection.case_meta (parent_case_id);
CREATE INDEX IF NOT EXISTS case_meta_due_idx      ON collection.case_meta (due_date)
    WHERE merged_into_case_id IS NULL;

-- ==========================================================================
-- 4. Assignment history — who held the case, and when
-- ==========================================================================
CREATE TABLE IF NOT EXISTS collection.case_assignment (
    id                  BIGSERIAL PRIMARY KEY,
    case_id             BIGINT NOT NULL REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    agent_id            BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    queue_code          VARCHAR(40) REFERENCES collection.case_queue(code) ON DELETE SET NULL,
    assigned_by         BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    assignment_type     VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    reason              VARCHAR(300),
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- NULL while this is the current holder.
    released_at         TIMESTAMPTZ,
    CONSTRAINT assignment_type_ck CHECK (assignment_type IN
        ('MANUAL','AUTO','TRANSFER','ESCALATION','REBALANCE','QUEUE'))
);

CREATE INDEX IF NOT EXISTS case_assignment_case_idx  ON collection.case_assignment (case_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS case_assignment_agent_idx ON collection.case_assignment (agent_id)
    WHERE released_at IS NULL;

-- Rules that route a new case to a queue and an agent without a human deciding.
CREATE TABLE IF NOT EXISTS collection.assignment_rule (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(120) NOT NULL,
    description         VARCHAR(300),
    priority            SMALLINT     NOT NULL DEFAULT 100,  -- lower wins
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    -- Conditions. NULL means "any".
    case_type_code      VARCHAR(40) REFERENCES collection.case_type(code) ON DELETE CASCADE,
    source_code         VARCHAR(40) REFERENCES collection.case_source(code) ON DELETE CASCADE,
    dpd_min             INTEGER,
    dpd_max             INTEGER,
    amount_min          NUMERIC(15,2),
    amount_max          NUMERIC(15,2),
    risk_levels         TEXT[]       NOT NULL DEFAULT '{}',
    customer_types      TEXT[]       NOT NULL DEFAULT '{}',
    -- Outcome
    target_queue        VARCHAR(40) REFERENCES collection.case_queue(code) ON DELETE SET NULL,
    target_agent_id     BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    set_priority        VARCHAR(20),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignment_rule_order_idx ON collection.assignment_rule (priority)
    WHERE is_active;

-- ==========================================================================
-- 5. Notes and attachments
-- ==========================================================================
CREATE TABLE IF NOT EXISTS collection.case_note (
    id                  BIGSERIAL PRIMARY KEY,
    case_id             BIGINT NOT NULL REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    author_id           BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    body                TEXT   NOT NULL,
    note_type           VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
    -- An internal note must never be exposed on a customer-facing surface.
    visibility          VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    is_pinned           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT note_visibility_ck CHECK (visibility IN ('INTERNAL','CUSTOMER_FACING','SUPERVISOR_ONLY')),
    CONSTRAINT note_type_ck CHECK (note_type IN ('GENERAL','CALL','NEGOTIATION','ESCALATION','RESOLUTION','HANDOVER'))
);

CREATE INDEX IF NOT EXISTS case_note_case_idx ON collection.case_note (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS collection.case_attachment (
    id                  BIGSERIAL PRIMARY KEY,
    case_id             BIGINT NOT NULL REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    file_name           VARCHAR(255) NOT NULL,
    file_type           VARCHAR(80),
    file_size_bytes     BIGINT,
    storage_uri         VARCHAR(500) NOT NULL,
    document_type       VARCHAR(40) NOT NULL DEFAULT 'OTHER',
    uploaded_by         BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT attachment_doc_ck CHECK (document_type IN
        ('OTHER','ID_PROOF','PAYMENT_PROOF','SETTLEMENT_LETTER','DISPUTE_EVIDENCE',
         'LEGAL_NOTICE','AGENCY_HANDOVER','CORRESPONDENCE','CONTRACT'))
);

CREATE INDEX IF NOT EXISTS case_attachment_case_idx ON collection.case_attachment (case_id, uploaded_at DESC);

-- ==========================================================================
-- 6. Audit — field-level change history
-- ==========================================================================
-- Distinct from customer_schema.case_activity, which records *work done*.
-- This records *what changed*, for compliance and dispute defence.
CREATE TABLE IF NOT EXISTS collection.case_audit (
    id                  BIGSERIAL PRIMARY KEY,
    case_id             BIGINT NOT NULL REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    action              VARCHAR(40)  NOT NULL,
    field_name          VARCHAR(60),
    old_value           VARCHAR(500),
    new_value           VARCHAR(500),
    actor_id            BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    actor_role          VARCHAR(40),
    reason              VARCHAR(300),
    ip_address          VARCHAR(60),
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_audit_case_idx ON collection.case_audit (case_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS case_audit_actor_idx ON collection.case_audit (actor_id, occurred_at DESC);

-- ==========================================================================
-- Grants
-- ==========================================================================
GRANT USAGE ON SCHEMA collection TO assure;
GRANT ALL ON ALL TABLES IN SCHEMA collection TO assure;
GRANT ALL ON ALL SEQUENCES IN SCHEMA collection TO assure;
ALTER DEFAULT PRIVILEGES IN SCHEMA collection GRANT ALL ON TABLES TO assure;
ALTER DEFAULT PRIVILEGES IN SCHEMA collection GRANT ALL ON SEQUENCES TO assure;
