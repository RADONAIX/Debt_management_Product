-- Strategy simulation runs, kept so a result can be reopened and compared.
--
-- A simulation is a model, not a measurement, so every run stores the exact
-- assumptions and the seed it was driven by. Re-running with the same inputs
-- reproduces the same outcome, and a run from last month can still be read
-- alongside the numbers it was arguing about.

CREATE TABLE IF NOT EXISTS strategy_schema.simulation_run (
    id              bigserial PRIMARY KEY,
    strategy_id     bigint      NOT NULL REFERENCES public.strategy(id) ON DELETE CASCADE,
    strategy_code   varchar(40) NOT NULL,
    strategy_version varchar(10),
    label           varchar(160),
    -- What was fed in: population filter and the rate assumptions.
    inputs          jsonb       NOT NULL DEFAULT '{}'::jsonb,
    -- What came out: funnel, per-step, per-channel, day curve, totals.
    outputs         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    -- Reproducibility.
    seed            integer     NOT NULL,
    accounts        integer     NOT NULL DEFAULT 0,
    horizon_days    integer     NOT NULL DEFAULT 30,
    exposure        numeric(15,2) NOT NULL DEFAULT 0,
    recovered       numeric(15,2) NOT NULL DEFAULT 0,
    cost            numeric(14,2) NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      bigint      REFERENCES administration.app_user(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_simulation_strategy
    ON strategy_schema.simulation_run (strategy_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON strategy_schema.simulation_run TO assure;
GRANT USAGE, SELECT ON SEQUENCE strategy_schema.simulation_run_id_seq TO assure;
