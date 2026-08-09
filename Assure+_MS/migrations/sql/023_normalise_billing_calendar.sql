-- =====================================================================================
--  023_normalise_billing_calendar.sql
--
--  Some invoices still carried 2024/2025 due dates, so once DPD was derived
--  honestly from the oldest unpaid invoice it came out at 400+ days — a line no
--  operator would still have connected. Every invoice is re-dated onto the last
--  six monthly cycles, newest first, so ageing lands in believable bands.
--  Idempotent.
-- =====================================================================================

BEGIN;

-- ---- Individual invoices: one per month per line, newest = this month ---------------
WITH ordered AS (
    SELECT i.id,
           row_number() OVER (PARTITION BY i.account_id ORDER BY i.due_date DESC) - 1 AS n
      FROM customer_schema.invoice i
     WHERE i.invoice_type = 'INDIVIDUAL'
)
UPDATE customer_schema.invoice i SET
    bill_period_start = (date_trunc('month', CURRENT_DATE) - ((o.n + 1) || ' months')::interval)::date,
    bill_period_end   = (date_trunc('month', CURRENT_DATE) - (o.n || ' months')::interval - INTERVAL '1 day')::date,
    issue_date        = (date_trunc('month', CURRENT_DATE) - (o.n || ' months')::interval)::date,
    due_date          = (date_trunc('month', CURRENT_DATE) - (o.n || ' months')::interval + INTERVAL '14 days')::date
  FROM ordered o
 WHERE o.id = i.id AND o.n <= 5;

-- Anything older than six cycles is history: mark it settled and date it out.
WITH ordered AS (
    SELECT i.id, row_number() OVER (PARTITION BY i.account_id ORDER BY i.due_date DESC) - 1 AS n
      FROM customer_schema.invoice i WHERE i.invoice_type = 'INDIVIDUAL'
)
UPDATE customer_schema.invoice i SET
    bill_period_start = (date_trunc('month', CURRENT_DATE) - ((o.n + 1) || ' months')::interval)::date,
    bill_period_end   = (date_trunc('month', CURRENT_DATE) - (o.n || ' months')::interval - INTERVAL '1 day')::date,
    issue_date        = (date_trunc('month', CURRENT_DATE) - (o.n || ' months')::interval)::date,
    due_date          = (date_trunc('month', CURRENT_DATE) - (o.n || ' months')::interval + INTERVAL '14 days')::date,
    paid_amount       = i.amount + i.tax_amount,
    status            = 'PAID'
  FROM ordered o
 WHERE o.id = i.id AND o.n > 5;

-- ---- Consolidated invoices: current cycle ------------------------------------------
UPDATE customer_schema.invoice SET
    bill_period_start = (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date,
    bill_period_end   = (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date,
    issue_date        = date_trunc('month', CURRENT_DATE)::date,
    due_date          = (date_trunc('month', CURRENT_DATE) + INTERVAL '14 days')::date
 WHERE invoice_type = 'GROUPED';

-- ---- Payments land inside the cycle they settle ------------------------------------
UPDATE customer_schema.payment p SET payment_date = LEAST(
        CURRENT_DATE, (i.due_date - ((p.id % 5) || ' days')::interval)::date)
  FROM customer_schema.invoice i
 WHERE i.id = p.invoice_id;

COMMIT;
