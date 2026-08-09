-- =====================================================================================
--  018_currency_and_legacy_payments.sql
--
--  The operator bills in AED, but the original demo accounts were created in
--  USD, so the 360 header showed "USD" for them while every table said AED.
--  Also gives the legacy lines the same six months of billing history the new
--  subscribers have, so their payment chart isn't a single lonely bar.
--  Idempotent.
-- =====================================================================================

BEGIN;

UPDATE customer_schema.account SET currency_code = 'AED' WHERE currency_code <> 'AED';
UPDATE customer_schema.billing_account SET currency_code = 'AED' WHERE currency_code <> 'AED';

-- Monthly settlements for the legacy lines, stopping as delinquency deepens.
INSERT INTO customer_schema.payment
       (payment_ref, customer_id, account_id, amount, payment_date, method_code, status, notes)
SELECT 'PAY-L' || lpad((a.id * 10 + m.n)::text, 6, '0'),
       a.customer_id, a.id,
       round(a.monthly_bill * 1.05, 2),
       (date_trunc('month', CURRENT_DATE) - ((5 - m.n) || ' months')::interval
        + ((a.id % 18) || ' days')::interval)::date,
       (ARRAY['Bank Transfer','Credit Card','Auto-Debit','Cheque','Cash','Payment Link'])[1 + (a.id + m.n) % 6],
       'COMPLETED',
       'Monthly bill settlement'
  FROM customer_schema.account a
  CROSS JOIN generate_series(0, 5) AS m(n)
 WHERE a.account_code NOT LIKE 'ACC-1%'
   AND m.n < 6 - LEAST(5, a.dpd / 30)
ON CONFLICT (payment_ref) DO NOTHING;

COMMIT;
