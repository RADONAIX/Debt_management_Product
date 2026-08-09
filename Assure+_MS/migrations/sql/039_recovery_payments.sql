-- A recovery is a payment.
--
-- Money an agency collects is money the customer paid, so every recovery now
-- points at the customer_schema.payment row it created. Subscriber 360 reads
-- that table, which is what closes the gap between "recovered" in the Recovery
-- Workspace and "paid" on the customer's own screen.

ALTER TABLE recovery_schema.recovery
  ADD COLUMN IF NOT EXISTS payment_id BIGINT
    REFERENCES customer_schema.payment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recovery_payment_idx ON recovery_schema.recovery (payment_id);

-- Historical placements were closed before the current billing cycle, so the
-- account balance already absorbed them. Flagging them keeps the ledger honest
-- rather than silently double-counting old money against today's debt.
ALTER TABLE recovery_schema.recovery
  ADD COLUMN IF NOT EXISTS applied_to_account BOOLEAN NOT NULL DEFAULT FALSE;
