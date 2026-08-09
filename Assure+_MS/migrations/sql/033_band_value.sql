-- =====================================================================================
--  033_band_value.sql
--
--  A band already carries a human description ("≥ 2,000", "3+ broken promises").
--  The Subscriber Profile needs a qualitative grade instead — Low / Medium /
--  High — so that is its own editable field rather than being parsed out of the
--  description. Whatever is typed here is what the 360 screen displays.
--  Idempotent.
-- =====================================================================================

BEGIN;

ALTER TABLE administration.risk_score_band
    ADD COLUMN IF NOT EXISTS band_value VARCHAR(40);

COMMENT ON COLUMN administration.risk_score_band.band_value IS
    'Qualitative grade shown on Subscriber 360 (Low / Medium / High, or any wording)';

-- Seed from the score so nothing displays blank; higher-is-better components
-- are graded on their own scale, so the score maps directly either way.
UPDATE administration.risk_score_band b SET band_value = CASE
        WHEN b.score >= 75 THEN 'High'
        WHEN b.score >= 45 THEN 'Medium'
        ELSE 'Low'
    END
 WHERE b.band_value IS NULL;

COMMIT;
