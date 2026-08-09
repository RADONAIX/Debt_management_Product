-- =====================================================================================
--  028_assign_strategies.sql
--
--  No subscriber line pointed at a strategy, so Strategy Effectiveness had a
--  single "Unassigned" bar. Each line is matched to the seeded strategy whose
--  ageing bucket it falls in — the same rule the designer's suitability fields
--  express. Idempotent.
-- =====================================================================================

BEGIN;

UPDATE customer_schema.account a SET strategy_id = s.id
  FROM public.strategy s
 WHERE s.strategy_code = CASE
        WHEN a.dpd = 0   THEN 'STR-001'   -- Soft Reminder
        WHEN a.dpd <= 30 THEN 'STR-002'   -- Standard Dunning
        WHEN a.dpd <= 60 THEN 'STR-003'   -- AI Adaptive
        WHEN a.dpd <= 90 THEN 'STR-004'   -- Intensive Recovery
        ELSE 'STR-005'                    -- Pre-Legal
       END;

COMMIT;
