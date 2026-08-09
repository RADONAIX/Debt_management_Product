-- =====================================================================================
--  021_reconcile_billing.sql  ·  Make invoices, payments and balances agree
--
--  Invoices, payments and `outstanding` were generated independently, so an
--  invoice could show Overdue while a payment for that month sat unlinked in
--  the payments tab, and the balance matched neither. Everything now derives
--  from one chain:
--
--      invoice raised  →  payment settles it  →  what's left is outstanding
--
--  Steps
--    1. attach every payment to the invoice for its billing month
--    2. recompute invoice.paid_amount from those payments; status follows
--    3. outstanding = unpaid invoice balances (a line's share of a grouped one)
--    4. DPD = age of the oldest unpaid invoice; ageing / dunning / status follow
--    5. risk, history, cases and promises re-derived from the corrected figures
--
--  Deterministic and idempotent.
-- =====================================================================================

BEGIN;

-- ---- 1. Link payments to the invoice they settle ------------------------------------
-- A line's own invoice for that month wins; otherwise the consolidated invoice
-- covering the line for that month.
UPDATE customer_schema.payment p SET invoice_id = i.id
  FROM customer_schema.invoice i
 WHERE i.account_id = p.account_id
   AND i.invoice_type = 'INDIVIDUAL'
   AND date_trunc('month', i.due_date) = date_trunc('month', p.payment_date);

UPDATE customer_schema.payment p SET invoice_id = gi.id
  FROM customer_schema.invoice_group_member m
  JOIN customer_schema.invoice gi ON gi.id = m.invoice_id
 WHERE m.account_id = p.account_id
   AND p.invoice_id IS NULL
   AND date_trunc('month', gi.due_date) = date_trunc('month', p.payment_date);

-- Anything still unlinked settled a month we never raised an invoice for; drop
-- it rather than leave a payment that belongs to nothing.
DELETE FROM customer_schema.payment WHERE invoice_id IS NULL AND status = 'COMPLETED';

-- ---- 2. Invoice paid amount and status come from the payments ----------------------
UPDATE customer_schema.invoice i SET paid_amount = COALESCE(paid.total, 0)
  FROM (SELECT invoice_id, LEAST(sum(amount), 1e12) AS total
          FROM customer_schema.payment
         WHERE status = 'COMPLETED' AND invoice_id IS NOT NULL
         GROUP BY invoice_id) paid
 WHERE paid.invoice_id = i.id;

UPDATE customer_schema.invoice SET paid_amount = 0
 WHERE id NOT IN (SELECT invoice_id FROM customer_schema.payment
                   WHERE invoice_id IS NOT NULL AND status = 'COMPLETED');

-- Never record more paid than billed.
UPDATE customer_schema.invoice SET paid_amount = amount + tax_amount
 WHERE paid_amount > amount + tax_amount;

UPDATE customer_schema.invoice SET status = CASE
    WHEN paid_amount >= amount + tax_amount - 0.01 THEN 'PAID'
    WHEN paid_amount > 0                           THEN 'PARTIAL'
    WHEN due_date < CURRENT_DATE                   THEN 'OVERDUE'
    ELSE 'UNPAID' END;

-- ---- 3. Outstanding = what the invoices say is still owed ---------------------------
WITH own AS (
    SELECT i.account_id, sum(i.amount + i.tax_amount - i.paid_amount) AS due
      FROM customer_schema.invoice i
     WHERE i.invoice_type = 'INDIVIDUAL' AND i.status <> 'PAID'
     GROUP BY i.account_id
), shared AS (
    -- A line owes its share of any consolidated invoice still outstanding.
    SELECT m.account_id,
           sum((i.amount + i.tax_amount - i.paid_amount)
               * m.share_amount / NULLIF(tot.total_share, 0)) AS due
      FROM customer_schema.invoice_group_member m
      JOIN customer_schema.invoice i ON i.id = m.invoice_id
      JOIN (SELECT invoice_id, sum(share_amount) AS total_share
              FROM customer_schema.invoice_group_member GROUP BY invoice_id) tot
        ON tot.invoice_id = m.invoice_id
     WHERE i.status <> 'PAID'
     GROUP BY m.account_id
)
UPDATE customer_schema.account a
   SET outstanding = round(GREATEST(0,
         COALESCE((SELECT due FROM own    WHERE own.account_id = a.id), 0)
       + COALESCE((SELECT due FROM shared WHERE shared.account_id = a.id), 0)), 2);

-- ---- 4. DPD follows the oldest unpaid invoice ---------------------------------------
UPDATE customer_schema.account a SET
    dpd = COALESCE((
        SELECT GREATEST(0, (CURRENT_DATE - min(i.due_date))::int)
          FROM customer_schema.invoice i
         WHERE i.status IN ('OVERDUE', 'PARTIAL')
           AND (i.account_id = a.id
                OR i.id IN (SELECT invoice_id FROM customer_schema.invoice_group_member
                             WHERE account_id = a.id))
    ), 0);

UPDATE customer_schema.account SET
    aging_bucket = CASE WHEN dpd = 0 THEN 'Current' WHEN dpd <= 30 THEN '1-30'
                        WHEN dpd <= 60 THEN '31-60'  WHEN dpd <= 90 THEN '61-90' ELSE '90+' END,
    dunning_stage = LEAST(10, dpd / 30),
    status = CASE WHEN outstanding = 0 THEN 'CURRENT'
                  WHEN dpd > 90 THEN 'SUSPENDED'
                  WHEN dpd > 0  THEN 'DELINQUENT' ELSE 'CURRENT' END,
    last_payment_at = COALESCE((SELECT max(p.payment_date)::timestamptz
                                  FROM customer_schema.payment p
                                 WHERE p.account_id = account.id), last_payment_at);

COMMIT;
