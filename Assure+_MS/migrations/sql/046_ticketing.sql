-- Jira-style ticketing for Case Management.
--
-- Reuses what already exists rather than re-creating it:
--   the ticket itself        customer_schema.debt_case
--   activities / timeline    customer_schema.case_activity
--   comments / notes         collection.case_note
--   attachments              collection.case_attachment
--   assignments              collection.case_assignment
--   audit                    collection.case_audit
--   workflow                 collection.workflow_state / workflow_transition
--   legal transfers          recovery_schema.legal_case
--   agency transfers         recovery_schema.placement
--   collectors               administration.app_user   (never duplicated)
--
-- Only the genuinely missing pieces are added below.

-- --------------------------------------------------------------------------
-- Tags
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection.tag (
    code            VARCHAR(40)  PRIMARY KEY,
    label           VARCHAR(80)  NOT NULL,
    colour          VARCHAR(20)  NOT NULL DEFAULT 'muted',
    description     VARCHAR(200),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order      SMALLINT     NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS collection.case_tag (
    case_id         BIGINT NOT NULL REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    tag_code        VARCHAR(40) NOT NULL REFERENCES collection.tag(code) ON DELETE CASCADE,
    tagged_by       BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    tagged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (case_id, tag_code)
);

CREATE INDEX IF NOT EXISTS case_tag_tag_idx ON collection.case_tag (tag_code);

-- --------------------------------------------------------------------------
-- Watchers — who gets notified about this ticket
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection.case_watcher (
    case_id         BIGINT NOT NULL REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES administration.app_user(id) ON DELETE CASCADE,
    watch_type      VARCHAR(20) NOT NULL DEFAULT 'WATCHING',
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (case_id, user_id),
    CONSTRAINT watcher_type_ck CHECK (watch_type IN ('WATCHING','FOLLOWING','MENTIONED'))
);

CREATE INDEX IF NOT EXISTS case_watcher_user_idx ON collection.case_watcher (user_id);

-- --------------------------------------------------------------------------
-- Tasks and scheduled callbacks — the day-by-day work plan
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection.case_task (
    id              BIGSERIAL PRIMARY KEY,
    case_id         BIGINT REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    customer_id     BIGINT NOT NULL REFERENCES customer_schema.customer(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    detail          VARCHAR(500),
    task_type       VARCHAR(30) NOT NULL DEFAULT 'FOLLOW_UP',
    due_date        DATE NOT NULL,
    due_time        TIME,
    assigned_to     BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    priority        VARCHAR(20) NOT NULL DEFAULT 'Medium',
    completed_at    TIMESTAMPTZ,
    completed_by    BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    outcome         VARCHAR(300),
    created_by      BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT task_type_ck CHECK (task_type IN
        ('FOLLOW_UP','CALLBACK','PTP_FOLLOW_UP','DISPUTE_REVIEW','LEGAL_REVIEW',
         'AGENCY_REVIEW','DOCUMENT_CHASE','FIELD_VISIT','OTHER')),
    CONSTRAINT task_status_ck CHECK (status IN ('OPEN','DONE','CANCELLED'))
);

CREATE INDEX IF NOT EXISTS case_task_due_idx  ON collection.case_task (due_date, status);
CREATE INDEX IF NOT EXISTS case_task_user_idx ON collection.case_task (assigned_to, due_date)
    WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS case_task_case_idx ON collection.case_task (case_id);

-- --------------------------------------------------------------------------
-- Escalation history — who it went to, why, and what happened
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection.case_escalation (
    id              BIGSERIAL PRIMARY KEY,
    case_id         BIGINT NOT NULL REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    escalate_to     VARCHAR(40) NOT NULL,
    reason          VARCHAR(500),
    from_state      VARCHAR(40),
    to_state        VARCHAR(40),
    from_queue      VARCHAR(40),
    to_queue        VARCHAR(40),
    raised_by       BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    assigned_to     BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    -- Where the escalation landed in the system that owns it.
    legal_case_id   BIGINT REFERENCES recovery_schema.legal_case(id) ON DELETE SET NULL,
    placement_id    BIGINT REFERENCES recovery_schema.placement(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    resolved_at     TIMESTAMPTZ,
    resolution      VARCHAR(300),
    raised_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT escalation_target_ck CHECK (escalate_to IN
        ('LEGAL','RECOVERY_AGENCY','SUPERVISOR','FRAUD_TEAM','INVESTIGATION',
         'COLLECTIONS_MANAGER','RISK_TEAM','COMPLIANCE')),
    CONSTRAINT escalation_status_ck CHECK (status IN ('OPEN','ACCEPTED','REJECTED','RESOLVED'))
);

CREATE INDEX IF NOT EXISTS case_escalation_case_idx ON collection.case_escalation (case_id, raised_at DESC);
CREATE INDEX IF NOT EXISTS case_escalation_open_idx ON collection.case_escalation (escalate_to, status);

-- --------------------------------------------------------------------------
-- Case relationships — beyond the parent/merge already on case_meta
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection.case_relationship (
    id              BIGSERIAL PRIMARY KEY,
    from_case_id    BIGINT NOT NULL REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    to_case_id      BIGINT NOT NULL REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    relation        VARCHAR(30) NOT NULL DEFAULT 'RELATES_TO',
    note            VARCHAR(300),
    created_by      BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_case_id, to_case_id, relation),
    CONSTRAINT relation_ck CHECK (relation IN
        ('RELATES_TO','BLOCKS','BLOCKED_BY','DUPLICATES','SPLIT_FROM','CAUSED_BY')),
    CONSTRAINT relation_not_self CHECK (from_case_id <> to_case_id)
);

CREATE INDEX IF NOT EXISTS case_rel_from_idx ON collection.case_relationship (from_case_id);
CREATE INDEX IF NOT EXISTS case_rel_to_idx   ON collection.case_relationship (to_case_id);

-- --------------------------------------------------------------------------
-- Per-user board preferences (group by, view mode, saved filters)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection.board_preference (
    user_id         BIGINT PRIMARY KEY REFERENCES administration.app_user(id) ON DELETE CASCADE,
    view_mode       VARCHAR(20) NOT NULL DEFAULT 'LIST',
    group_by        VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER',
    sort_by         VARCHAR(30) NOT NULL DEFAULT 'PRIORITY',
    saved_filters   JSONB NOT NULL DEFAULT '{}',
    visible_columns TEXT[] NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT view_mode_ck CHECK (view_mode IN ('LIST','BOARD'))
);

-- --------------------------------------------------------------------------
-- Notifications — reuses app_user, holds no user detail of its own
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection.case_notification (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES administration.app_user(id) ON DELETE CASCADE,
    case_id         BIGINT REFERENCES customer_schema.debt_case(id) ON DELETE CASCADE,
    event           VARCHAR(40) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    detail          VARCHAR(500),
    actor_id        BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_notification_user_idx
    ON collection.case_notification (user_id, is_read, created_at DESC);

GRANT USAGE ON SCHEMA collection TO assure;
GRANT ALL ON ALL TABLES IN SCHEMA collection TO assure;
GRANT ALL ON ALL SEQUENCES IN SCHEMA collection TO assure;
