-- =====================================================================================
--  006_strategy_settings.sql
--
--  Free-form strategy-level defaults edited from the designer's Configuration
--  panel (dialer type, contact window, languages, retries, voicemail and PTP
--  handling). Kept as one document because the panel reads and writes it whole.
--  Idempotent.
-- =====================================================================================
ALTER TABLE public.strategy
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
