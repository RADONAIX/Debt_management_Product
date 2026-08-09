-- The operations schema: how the platform itself is configured to behave.
--
-- AI Guardrails were a screen full of local state over a TypeScript file, so
-- nothing an operator changed survived a refresh. The rules live here now,
-- alongside the record of who changed them and of every message the guardrails
-- have judged — a rule nobody can see firing is a rule nobody can trust.

CREATE SCHEMA IF NOT EXISTS operations;
GRANT USAGE ON SCHEMA operations TO assure;

-- One rule. `kind` says what part of the conversation it governs; `config`
-- holds the settings that differ per rule, so a new rule type needs no DDL.
CREATE TABLE IF NOT EXISTS operations.guardrail (
    id           bigserial PRIMARY KEY,
    kind         varchar(30)  NOT NULL,
    code         varchar(60)  NOT NULL,
    label        varchar(255) NOT NULL,
    description  varchar(500),
    -- What happens when the rule matches.
    action       varchar(40)  NOT NULL DEFAULT 'BLOCK',
    severity     varchar(20)  NOT NULL DEFAULT 'Medium',
    config       jsonb        NOT NULL DEFAULT '{}'::jsonb,
    is_enabled   boolean      NOT NULL DEFAULT true,
    -- Seeded rules cannot be deleted; an operator may still disable them.
    is_system    boolean      NOT NULL DEFAULT false,
    sort_order   integer      NOT NULL DEFAULT 0,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    updated_by   bigint       REFERENCES administration.app_user(id) ON DELETE SET NULL,
    CONSTRAINT guardrail_kind_ck CHECK (kind IN
        ('INPUT_FILTER', 'OUTPUT_FILTER', 'ESCALATION_RULE', 'PROMPT_TEMPLATE')),
    CONSTRAINT guardrail_action_ck CHECK (action IN
        ('BLOCK', 'MASK', 'REWRITE', 'FLAG', 'ESCALATE', 'ALLOW')),
    CONSTRAINT guardrail_severity_ck CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    CONSTRAINT uq_guardrail_code UNIQUE (kind, code)
);

-- Who changed a rule, and from what to what.
CREATE TABLE IF NOT EXISTS operations.guardrail_audit (
    id           bigserial PRIMARY KEY,
    guardrail_id bigint       REFERENCES operations.guardrail(id) ON DELETE CASCADE,
    code         varchar(60)  NOT NULL,
    action       varchar(30)  NOT NULL,
    field_name   varchar(60),
    old_value    text,
    new_value    text,
    reason       varchar(500),
    actor_id     bigint       REFERENCES administration.app_user(id) ON DELETE SET NULL,
    created_at   timestamptz  NOT NULL DEFAULT now()
);

-- Every message the guardrails have judged, so the screen can show what the
-- rules actually do rather than only what they are set to.
CREATE TABLE IF NOT EXISTS operations.guardrail_event (
    id           bigserial PRIMARY KEY,
    guardrail_id bigint       REFERENCES operations.guardrail(id) ON DELETE SET NULL,
    code         varchar(60)  NOT NULL,
    kind         varchar(30)  NOT NULL,
    outcome      varchar(20)  NOT NULL,
    channel      varchar(40)  NOT NULL DEFAULT 'CHATBOT',
    sample       varchar(500),
    detail       varchar(500),
    customer_id  bigint       REFERENCES customer_schema.customer(id) ON DELETE SET NULL,
    actor_id     bigint       REFERENCES administration.app_user(id) ON DELETE SET NULL,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT guardrail_outcome_ck CHECK (outcome IN
        ('BLOCKED', 'MASKED', 'REWRITTEN', 'FLAGGED', 'ESCALATED', 'PASSED'))
);

CREATE INDEX IF NOT EXISTS idx_guardrail_kind ON operations.guardrail (kind, sort_order);
CREATE INDEX IF NOT EXISTS idx_guardrail_event_time ON operations.guardrail_event (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardrail_audit_rule ON operations.guardrail_audit (guardrail_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA operations TO assure;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA operations TO assure;
ALTER DEFAULT PRIVILEGES IN SCHEMA operations
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO assure;
ALTER DEFAULT PRIVILEGES IN SCHEMA operations GRANT USAGE, SELECT ON SEQUENCES TO assure;
