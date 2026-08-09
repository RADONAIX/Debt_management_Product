-- A version has to hold the whole strategy, not just its canvas.
--
-- Rolling back or cloning from a version means restoring what the strategy WAS:
-- its targeting, its suitability profile, its settings — not only the workflow
-- diagram. One JSONB snapshot keeps that faithful without pinning this table to
-- the strategy table's column list, which would need a migration every time a
-- strategy gains a field.
ALTER TABLE public.strategy_version
  ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Why this version exists: an edit, the baseline, or a restore of an older one.
  ADD COLUMN IF NOT EXISTS change_kind varchar(20) NOT NULL DEFAULT 'EDIT',
  -- Which fields moved, so the history reads without opening every version.
  ADD COLUMN IF NOT EXISTS changed_fields text[],
  -- Set when this version was produced by restoring an earlier one.
  ADD COLUMN IF NOT EXISTS restored_from varchar(10);

ALTER TABLE public.strategy_version
  DROP CONSTRAINT IF EXISTS strategy_version_kind_check;
ALTER TABLE public.strategy_version
  ADD CONSTRAINT strategy_version_kind_check
  CHECK (change_kind IN ('BASELINE', 'EDIT', 'RESTORE', 'ACTIVATION', 'CLONE'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_version TO assure;
GRANT USAGE, SELECT ON SEQUENCE public.strategy_version_id_seq TO assure;
