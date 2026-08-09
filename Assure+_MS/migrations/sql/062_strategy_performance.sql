-- =====================================================================================
--  062_strategy_performance.sql · Making strategy performance measurable
--
--  The problem this solves: `account.strategy_id` is a pointer, not a history. It
--  says which strategy an account is on *now* — not when it joined, whether it
--  ever left, or why. `case_activity` records every message sent but has no idea
--  which strategy or which workflow step produced it. So no question a collections
--  head actually asks ("did this strategy work?", "which step converts?", "what did
--  it cost us to recover that dollar?") could be answered at all.
--
--  Three tables close that gap:
--
--      strategy_schema.enrolment     an account's stay in a strategy, with a start,
--                                    an end and a reason for leaving — the spine
--                                    that makes cohort and version analysis possible
--      strategy_schema.step_event    one row per workflow step actually executed,
--                                    so drop-off and per-step cost become visible
--      strategy_schema.channel_cost  what a touch costs, by channel — without this
--                                    cost per dollar recovered cannot be computed
--
--  Idempotent.
-- =====================================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS strategy_schema;

-- --------------------------------------------------------------------------
-- Enrolment — one stay of one account in one strategy
--
-- A row is opened when an account is put on a strategy and closed when it
-- leaves. Keeping closed rows is the whole point: it is what lets you compare
-- how a strategy performed before and after a version was published, and to
-- measure accounts a strategy has already finished with.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS strategy_schema.enrolment (
    id              BIGSERIAL PRIMARY KEY,
    strategy_id     BIGINT NOT NULL REFERENCES public.strategy(id) ON DELETE CASCADE,
    account_id      BIGINT NOT NULL REFERENCES customer_schema.account(id) ON DELETE CASCADE,
    customer_id     BIGINT NOT NULL REFERENCES customer_schema.customer(id) ON DELETE CASCADE,
    -- The version in force when the account joined, so a later publish does not
    -- rewrite the history of what this account was actually put through.
    version_no      VARCHAR(20),
    -- A/B arm. NULL when the strategy is not being split-tested.
    variant         VARCHAR(20),
    entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    exited_at       TIMESTAMPTZ,
    exit_reason     VARCHAR(30),
    -- What the account owed on the way in, so recovery can be measured against
    -- the balance the strategy was actually handed.
    opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    opening_dpd     INTEGER NOT NULL DEFAULT 0,
    opening_risk    VARCHAR(20),
    -- How the account came to be on this strategy.
    assigned_by     BIGINT REFERENCES administration.app_user(id) ON DELETE SET NULL,
    assignment_mode VARCHAR(20) NOT NULL DEFAULT 'AUTO',
    notes           VARCHAR(400),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT enrolment_exit_ck CHECK (exited_at IS NULL OR exited_at >= entered_at),
    CONSTRAINT enrolment_reason_ck CHECK (exit_reason IS NULL OR exit_reason IN
        ('PAID','SETTLED','ESCALATED_LEGAL','ESCALATED_AGENCY','REASSIGNED',
         'COMPLETED','ABANDONED','WITHDRAWN')),
    CONSTRAINT enrolment_mode_ck CHECK (assignment_mode IN ('AUTO','MANUAL','BACKFILL'))
);

-- An account is on at most one strategy at a time; closed stays may repeat.
CREATE UNIQUE INDEX IF NOT EXISTS enrolment_one_open_per_account
    ON strategy_schema.enrolment (account_id) WHERE exited_at IS NULL;
CREATE INDEX IF NOT EXISTS enrolment_strategy_idx ON strategy_schema.enrolment (strategy_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS enrolment_account_idx  ON strategy_schema.enrolment (account_id, entered_at DESC);

-- --------------------------------------------------------------------------
-- Step events — the workflow actually executing
--
-- `node_id` is the id of the node in strategy.workflow_json that fired. That is
-- what turns a flat list of messages into a funnel: how many accounts reached
-- step 4, and how many fell out before it.
--
-- Rows written by the backfill below carry a NULL node_id, because nothing in
-- the existing data records which node produced a message. The dashboard reads
-- that as "not instrumented" rather than as "no drop-off".
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS strategy_schema.step_event (
    id              BIGSERIAL PRIMARY KEY,
    enrolment_id    BIGINT NOT NULL REFERENCES strategy_schema.enrolment(id) ON DELETE CASCADE,
    strategy_id     BIGINT NOT NULL REFERENCES public.strategy(id) ON DELETE CASCADE,
    account_id      BIGINT NOT NULL REFERENCES customer_schema.account(id) ON DELETE CASCADE,
    -- Which node of the workflow, and what kind it is ('SMS', 'AI Dialer', …).
    node_id         VARCHAR(60),
    node_type       VARCHAR(60),
    node_label      VARCHAR(160),
    -- Position in the flow, so steps sort even when node ids are opaque.
    step_no         SMALLINT,
    channel_code    VARCHAR(60),
    outcome         VARCHAR(60),
    -- What this single execution cost, stamped at execution time so a later
    -- price change cannot rewrite historic cost.
    cost            NUMERIC(10,4) NOT NULL DEFAULT 0,
    -- The activity row this step produced, when it produced one.
    activity_id     BIGINT REFERENCES customer_schema.case_activity(id) ON DELETE SET NULL,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT step_event_cost_ck CHECK (cost >= 0)
);

CREATE INDEX IF NOT EXISTS step_event_enrolment_idx ON strategy_schema.step_event (enrolment_id, occurred_at);
CREATE INDEX IF NOT EXISTS step_event_strategy_idx  ON strategy_schema.step_event (strategy_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS step_event_node_idx      ON strategy_schema.step_event (strategy_id, node_id);

-- --------------------------------------------------------------------------
-- Channel cost — what one touch costs
--
-- Deliberately a table and not a constant: the rate differs by tenant and moves
-- over time, and cost per dollar recovered is only as honest as this number.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS strategy_schema.channel_cost (
    channel_code    VARCHAR(60) PRIMARY KEY,
    label           VARCHAR(80) NOT NULL,
    cost_per_touch  NUMERIC(10,4) NOT NULL DEFAULT 0,
    -- Roughly how much of a person's time one touch consumes, for load planning.
    agent_minutes   NUMERIC(6,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT channel_cost_ck CHECK (cost_per_touch >= 0)
);

-- Starting rates. These are placeholders an administrator is expected to replace
-- with the tenant's real contracted rates — every cost figure on the dashboard
-- is only as good as this table.
INSERT INTO strategy_schema.channel_cost (channel_code, label, cost_per_touch, agent_minutes) VALUES
    ('SMS',      'SMS',              0.0150, 0),
    ('Email',    'Email',            0.0020, 0),
    ('WhatsApp', 'WhatsApp',         0.0350, 0),
    ('IVR',      'IVR',              0.0800, 0),
    ('Voicebot', 'AI Voicebot',      0.1200, 0),
    ('Dialer',   'Predictive Dialer',0.4500, 4.5),
    ('Letter',   'Letter',           0.9000, 1.0),
    ('Field',    'Field Visit',     12.0000, 90.0)
ON CONFLICT (channel_code) DO NOTHING;

-- --------------------------------------------------------------------------
-- Backfill: open one enrolment per account that currently sits on a strategy
--
-- Only what the data can actually support. `entered_at` is the earliest hard
-- evidence of the strategy working the account — its first automated touch —
-- falling back to when the strategy went live. It is marked BACKFILL so nobody
-- mistakes a reconstructed start date for a recorded one.
-- --------------------------------------------------------------------------
INSERT INTO strategy_schema.enrolment (
    strategy_id, account_id, customer_id, version_no, entered_at,
    opening_balance, opening_dpd, opening_risk, assignment_mode, notes)
SELECT a.strategy_id, a.id, a.customer_id, s.current_version,
       COALESCE(
           (SELECT min(ca.occurred_at) FROM customer_schema.case_activity ca
             WHERE ca.account_id = a.id AND ca.is_automated),
           s.activated_at,
           a.created_at),
       a.outstanding, a.dpd, a.risk_level, 'BACKFILL',
       'Reconstructed from the current strategy assignment; start date inferred.'
  FROM customer_schema.account a
  JOIN public.strategy s ON s.id = a.strategy_id
 WHERE NOT EXISTS (SELECT 1 FROM strategy_schema.enrolment e
                    WHERE e.account_id = a.id AND e.exited_at IS NULL);

-- --------------------------------------------------------------------------
-- Backfill: one step event per automated touch already on record
--
-- node_id stays NULL — nothing in the existing data says which node fired. The
-- channel, outcome, timing and cost are all real, so channel economics work
-- immediately; only the per-node funnel waits for the engine to start writing.
-- --------------------------------------------------------------------------
INSERT INTO strategy_schema.step_event (
    enrolment_id, strategy_id, account_id, node_type, channel_code,
    outcome, cost, activity_id, occurred_at)
SELECT e.id, e.strategy_id, e.account_id, ca.activity_type, ca.channel_code,
       ca.outcome, COALESCE(cc.cost_per_touch, 0), ca.id, ca.occurred_at
  FROM customer_schema.case_activity ca
  JOIN strategy_schema.enrolment e ON e.account_id = ca.account_id AND e.exited_at IS NULL
  LEFT JOIN strategy_schema.channel_cost cc ON cc.channel_code = ca.channel_code
 WHERE ca.is_automated
   AND ca.occurred_at >= e.entered_at
   AND NOT EXISTS (SELECT 1 FROM strategy_schema.step_event se WHERE se.activity_id = ca.id);

-- --------------------------------------------------------------------------
-- One view the dashboard reads, so every widget aggregates the same definitions
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW strategy_schema.strategy_account_view AS
SELECT e.id                              AS enrolment_id,
       e.strategy_id,
       s.strategy_code,
       s.name                            AS strategy_name,
       s.status                          AS strategy_status,
       s.current_version,
       s.risk_level                      AS target_risk,
       s.aging_bucket                    AS target_bucket,
       e.account_id,
       e.customer_id,
       e.entered_at,
       e.exited_at,
       e.exit_reason,
       e.variant,
       e.opening_balance,
       e.opening_dpd,
       a.account_code,
       a.outstanding,
       a.dpd,
       a.aging_bucket,
       a.risk_level,
       c.customer_type,
       -- Does the account actually match what the strategy says it targets? An
       -- account outside its strategy's declared audience is being worked by
       -- the wrong playbook, and nothing else in the system notices.
       (a.risk_level = ANY(s.risk_level) AND a.aging_bucket = ANY(s.aging_bucket))
                                         AS on_target,
       -- Money in since the account joined this strategy: what the strategy can
       -- actually claim credit for.
       COALESCE((SELECT sum(pm.amount) FROM customer_schema.payment pm
                  WHERE pm.account_id = e.account_id AND pm.status = 'COMPLETED'
                    AND pm.payment_date >= e.entered_at::date), 0) AS collected_since,
       COALESCE((SELECT min(pm.payment_date) FROM customer_schema.payment pm
                  WHERE pm.account_id = e.account_id AND pm.status = 'COMPLETED'
                    AND pm.payment_date >= e.entered_at::date), NULL) AS first_payment_on,
       -- Effort and what it cost.
       COALESCE((SELECT count(*) FROM strategy_schema.step_event se
                  WHERE se.enrolment_id = e.id), 0)                AS touches,
       COALESCE((SELECT sum(se.cost) FROM strategy_schema.step_event se
                  WHERE se.enrolment_id = e.id), 0)                AS touch_cost,
       -- Did the customer engage at all?
       COALESCE((SELECT count(*) FROM customer_schema.case_activity ca
                  WHERE ca.account_id = e.account_id
                    AND ca.occurred_at >= e.entered_at
                    AND (ca.direction = 'INBOUND'
                         OR ca.outcome IN ('CONTACTED','PROMISE_MADE','RESOLVED'))), 0)
                                                                   AS responses,
       COALESCE((SELECT count(*) FROM customer_schema.ptp t
                  WHERE t.account_id = e.account_id AND t.created_at >= e.entered_at), 0)
                                                                   AS promises,
       COALESCE((SELECT count(*) FROM customer_schema.ptp t
                  WHERE t.account_id = e.account_id AND t.created_at >= e.entered_at
                    AND t.status = 'KEPT'), 0)                     AS promises_kept,
       COALESCE((SELECT count(*) FROM customer_schema.ptp t
                  WHERE t.account_id = e.account_id AND t.created_at >= e.entered_at
                    AND t.status = 'BROKEN'), 0)                   AS promises_broken,
       -- Did the strategy fail and hand the account on?
       EXISTS (SELECT 1 FROM recovery_schema.placement pl
                WHERE pl.account_id = e.account_id AND pl.status IN ('ACTIVE','LEGAL'))
                                                                   AS escalated_agency,
       EXISTS (SELECT 1 FROM recovery_schema.legal_case lc
                WHERE lc.customer_id = e.customer_id AND lc.status = 'OPEN')
                                                                   AS escalated_legal
  FROM strategy_schema.enrolment e
  JOIN public.strategy s            ON s.id = e.strategy_id
  JOIN customer_schema.account a    ON a.id = e.account_id
  JOIN customer_schema.customer c   ON c.id = e.customer_id;

GRANT USAGE ON SCHEMA strategy_schema TO assure;
GRANT ALL ON ALL TABLES IN SCHEMA strategy_schema TO assure;
GRANT ALL ON ALL SEQUENCES IN SCHEMA strategy_schema TO assure;
ALTER DEFAULT PRIVILEGES IN SCHEMA strategy_schema GRANT ALL ON TABLES TO assure;
ALTER DEFAULT PRIVILEGES IN SCHEMA strategy_schema GRANT ALL ON SEQUENCES TO assure;

COMMIT;
