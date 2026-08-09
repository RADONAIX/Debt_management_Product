-- =====================================================================================
--  024_delinquency_spread.sql
--
--  Reconciling the billing made every balance honest but collapsed the ageing
--  spread — nothing sat beyond 60 days, so Legal Escalation and High Risk
--  Recovery had no candidates. Delinquency is now decided per line first, and
--  the payments follow from it:
--
--      a line "N months behind" simply has no payment against its last N bills
--
--  Spread: ~45% current, 20% one cycle, 15% two, 10% three, 10% four or five.
--  Deterministic and idempotent.
-- =====================================================================================

BEGIN;

-- ---- 1. How many cycles is each line behind? ---------------------------------------
CREATE TEMP TABLE behind AS
SELECT a.id AS account_id,
       CASE
         WHEN (a.id * 37) % 100 < 45 THEN 0
         WHEN (a.id * 37) % 100 < 65 THEN 1
         WHEN (a.id * 37) % 100 < 80 THEN 2
         WHEN (a.id * 37) % 100 < 90 THEN 3
         WHEN (a.id * 37) % 100 < 95 THEN 4
         ELSE 5
       END AS months
  FROM customer_schema.account a;

-- ---- 2. Rank each line's invoices, newest first -------------------------------------
CREATE TEMP TABLE ranked AS
SELECT i.id AS invoice_id, i.account_id,
       row_number() OVER (PARTITION BY i.account_id ORDER BY i.due_date DESC) - 1 AS age_rank
  FROM customer_schema.invoice i
 WHERE i.invoice_type = 'INDIVIDUAL';

-- ---- 3. Clear payments on the unpaid cycles, restore them on the settled ones -------
DELETE FROM customer_schema.payment p
 USING ranked r, behind b
 WHERE p.invoice_id = r.invoice_id AND b.account_id = r.account_id
   AND r.age_rank < b.months;

INSERT INTO customer_schema.payment
       (payment_ref, customer_id, account_id, invoice_id, amount, payment_date,
        method_code, status, notes)
SELECT 'PAY-R' || lpad(r.invoice_id::text, 7, '0'),
       i.customer_id, i.account_id, i.id,
       round(i.amount + i.tax_amount, 2),
       LEAST(CURRENT_DATE, (i.due_date - ((i.id % 5) || ' days')::interval)::date),
       (ARRAY['Bank Transfer','Credit Card','Auto-Debit','Cheque','Cash','Payment Link'])[1 + i.id % 6],
       'COMPLETED',
       'Monthly bill settlement'
  FROM ranked r
  JOIN behind b ON b.account_id = r.account_id
  JOIN customer_schema.invoice i ON i.id = r.invoice_id
 WHERE r.age_rank >= b.months
   AND NOT EXISTS (SELECT 1 FROM customer_schema.payment p WHERE p.invoice_id = i.id)
ON CONFLICT (payment_ref) DO NOTHING;

-- ---- 4. Consolidated invoices follow their members ----------------------------------
DELETE FROM customer_schema.payment p
 USING customer_schema.invoice i
 WHERE p.invoice_id = i.id AND i.invoice_type = 'GROUPED'
   AND EXISTS (SELECT 1 FROM customer_schema.invoice_group_member m
                 JOIN behind b ON b.account_id = m.account_id
                WHERE m.invoice_id = i.id AND b.months > 0);

COMMIT;
