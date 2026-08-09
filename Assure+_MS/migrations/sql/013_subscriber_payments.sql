-- =====================================================================================
--  013_subscriber_payments.sql  ·  Six months of payment history per subscriber
--
--  The Customer 360 payment chart had nothing to read for the new subscriber
--  lines. Payments follow the line's behaviour: healthy lines pay every month,
--  delinquent ones stop paying as their DPD grows.
--  Deterministic and idempotent.
-- =====================================================================================

BEGIN;

INSERT INTO customer_schema.payment
       (payment_ref, customer_id, account_id, amount, payment_date, method_code, status, notes)
SELECT 'PAY-1' || lpad((a.id * 10 + m.n)::text, 6, '0'),
       a.customer_id,
       a.id,
       -- Bills roughly the plan value, with a little month-to-month variation.
       round((80 + (a.id % 15) * 22 + m.n * 7)
             * CASE WHEN c.customer_type = 'ENTERPRISE' THEN 6 ELSE 1 END, 2),
       (date_trunc('month', CURRENT_DATE) - ((5 - m.n) || ' months')::interval
        + ((a.id % 20) || ' days')::interval)::date,
       (ARRAY['Bank Transfer','Credit Card','Auto-Debit','Cheque','Cash','Payment Link'])[1 + (a.id + m.n) % 6],
       'COMPLETED',
       'Monthly bill settlement'
  FROM customer_schema.account a
  JOIN customer_schema.customer c ON c.id = a.customer_id
  CROSS JOIN generate_series(0, 5) AS m(n)
 WHERE a.account_code LIKE 'ACC-1%'
   -- Payments stop once the account fell behind: a line 90+ days down paid
   -- only in the earliest months, a current line paid every month.
   AND m.n < 6 - LEAST(5, a.dpd / 30)
ON CONFLICT (payment_ref) DO NOTHING;

COMMIT;
