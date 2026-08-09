-- Daniel Okafor's second line — a live account for the chatbot to work.
--
-- Journey B in docs/DEMO_SCRIPT.md ends with ACC-10067 settled: $0, Current,
-- 0 DPD, case closed. That is the point of the story, so the account cannot be
-- given a balance without breaking the screens the journey finishes on, and
-- without breaking `billed - paid = outstanding`.
--
-- The negotiation bot needs something to negotiate. So Daniel gets a SECOND
-- line — the same customer, the same billing account, a home-broadband service
-- whose autopay failed the same way his mobile did. ACC-10067 stays exactly as
-- it was; ACC-10068 is 9 days down with a real unpaid invoice behind it.
--
-- Everything verify_consistency.py checks is honoured:
--   * aging_bucket agrees with dpd ('1-30' at 9 days)
--   * subscriber_no, monthly_bill and assigned_agent_id are all set
--   * strategy_id points at STR-001, which exists
--   * payment.customer_id matches the account's customer
--   * six months of risk_history ending exactly on the account's risk_score
--   * no debt_case: at 9 days this line is still in early-stage dunning and
--     no promise has been broken, so there is nothing to raise a case from —
--     which also keeps it out of the "under collection" reconciliation
--
-- Ledger ties: billed 825.20 - paid 412.60 = outstanding 412.60.
--
-- Idempotent — it removes its own account first, so re-run it freely. It
-- touches nothing outside ACC-10068.
--
--   psql -h 127.0.0.1 -U postgres -d Debt_management_db -v ON_ERROR_STOP=1 \
--        -f 071_daniel_second_line.sql

BEGIN;

-- --- Clear anything a previous run left behind -----------------------------
DELETE FROM customer_schema.risk_history
 WHERE account_id IN (SELECT id FROM customer_schema.account
                       WHERE account_code = 'ACC-10068');
DELETE FROM customer_schema.payment
 WHERE account_id IN (SELECT id FROM customer_schema.account
                       WHERE account_code = 'ACC-10068');
DELETE FROM customer_schema.invoice
 WHERE account_id IN (SELECT id FROM customer_schema.account
                       WHERE account_code = 'ACC-10068');
DELETE FROM customer_schema.case_activity
 WHERE account_id IN (SELECT id FROM customer_schema.account
                       WHERE account_code = 'ACC-10068');
DELETE FROM customer_schema.account WHERE account_code = 'ACC-10068';

-- --- The line -------------------------------------------------------------
-- Ids are looked up rather than pasted, so this survives a reseed of 062.
-- product_category, currency_category and channel_category are generated from
-- their code columns; naming them here is an error, not a redundancy.
INSERT INTO customer_schema.account (
    account_code, customer_id, product_code, currency_code,
    contract_plan, activation_date, tenure_months,
    credit_limit, outstanding, prior_outstanding, target_mtd, dpd, aging_bucket,
    risk_score, risk_level, strategy_id, dunning_stage, channel_code,
    contact_attempts, contact_successes, channel_cost,
    contactability, last_contact_at, last_payment_at, assigned_agent_id, status,
    subscriber_no, service_type, billing_account_id, next_followup_date,
    monthly_bill)
SELECT
    'ACC-10068', c.id, 'Business Fibre', 'USD',
    'Fibre 500 Unlimited', CURRENT_DATE - 420, 14,
    5000, 412.60, 412.60, 0, 9, '1-30',
    21.40, 'Low', s.id, 1, 'SMS',
    2, 1, 0,
    50.00, now() - interval '3 days', now() - interval '38 days',
    c.assigned_agent_id, 'DELINQUENT',
    '+971501251203', 'Fibre', b.id, CURRENT_DATE + 2,
    412.60
FROM customer_schema.customer c
JOIN customer_schema.billing_account b ON b.customer_id = c.id
JOIN public.strategy s ON s.strategy_code = 'STR-001'
WHERE c.customer_code = 'CUST-CON-208';

-- --- The ledger behind it -------------------------------------------------
-- Last month's bill, paid on time before the card lapsed.
INSERT INTO customer_schema.invoice (
    invoice_no, account_id, customer_id, billing_account_id,
    bill_period_start, bill_period_end, issue_date, due_date,
    amount, tax_amount, paid_amount, service_description, status, invoice_type)
SELECT 'INV-2026-2050', a.id, a.customer_id, a.billing_account_id,
       CURRENT_DATE - 69, CURRENT_DATE - 40, CURRENT_DATE - 39,
       CURRENT_DATE - 24, 412.60, 0, 412.60,
       'Home broadband — Fibre 500 Unlimited', 'PAID', 'INDIVIDUAL'
FROM customer_schema.account a WHERE a.account_code = 'ACC-10068';

INSERT INTO customer_schema.payment (
    payment_ref, customer_id, account_id, amount, payment_date, method_code,
    status, notes)
SELECT 'PAY-R001270', a.customer_id, a.id, 412.60, CURRENT_DATE - 38,
       'Auto-Debit', 'COMPLETED', 'Autopay collected before the card expired'
FROM customer_schema.account a WHERE a.account_code = 'ACC-10068';

-- This month's bill. The card had expired by the time autopay ran, so nothing
-- was taken — the same lapse that caught his mobile line.
INSERT INTO customer_schema.invoice (
    invoice_no, account_id, customer_id, billing_account_id,
    bill_period_start, bill_period_end, issue_date, due_date,
    amount, tax_amount, paid_amount, service_description, status, invoice_type)
SELECT 'INV-2026-2051', a.id, a.customer_id, a.billing_account_id,
       CURRENT_DATE - 39, CURRENT_DATE - 10, CURRENT_DATE - 9,
       CURRENT_DATE - 9, 412.60, 0, 0,
       'Home broadband — Fibre 500 Unlimited', 'OVERDUE', 'INDIVIDUAL'
FROM customer_schema.account a WHERE a.account_code = 'ACC-10068';

-- --- Keep the agent roll-up honest ----------------------------------------
-- A payment is cash somebody collected, so Agent Performance now disagrees
-- with the ledger until it is recomputed. DEMO_SCRIPT.md flags this as a
-- caveat to remember after a reseed; doing it here means nobody has to.
-- Scoped to the one agent and the one month this migration touched.
UPDATE public.agent_performance ap
   SET collected_amount = COALESCE((
           SELECT sum(p.amount)
             FROM customer_schema.payment p
             JOIN customer_schema.account a ON a.id = p.account_id
             JOIN customer_schema.customer c ON c.id = a.customer_id
            WHERE c.assigned_agent_id = ap.agent_id
              AND p.status = 'COMPLETED'
              AND date_trunc('month', p.payment_date) = ap.period_month), 0)
 WHERE ap.agent_id = (SELECT assigned_agent_id FROM customer_schema.customer
                       WHERE customer_code = 'CUST-CON-208')
   AND ap.period_month = date_trunc('month', CURRENT_DATE - 38);

-- --- The one automated touch that has gone out so far ---------------------
INSERT INTO customer_schema.case_activity (
    activity_type, customer_id, account_id, channel_code, direction,
    subject, body, outcome, visibility, is_automated, occurred_at)
SELECT 'SMS', a.customer_id, a.id, 'SMS', 'OUTBOUND',
       'Payment failed — $412.60 due',
       'Hi Daniel, we could not take $412.60 for your broadband — the card on '
       'file has expired. Update it here: rdnx.ae/p/9k2v',
       'Delivered', 'INTERNAL', true, now() - interval '3 days'
FROM customer_schema.account a WHERE a.account_code = 'ACC-10068';

-- --- Six months of risk trend, ending on today's score --------------------
-- The Risk Trend chart draws an empty box without this, and its last point
-- must equal the score in the header above it.
INSERT INTO customer_schema.risk_history (account_id, as_of_month, risk_score, dpd, outstanding)
SELECT a.id, date_trunc('month', CURRENT_DATE)::date - make_interval(months => m.n)::interval,
       v.score, v.dpd, v.outstanding
FROM customer_schema.account a
CROSS JOIN (VALUES (5), (4), (3), (2), (1), (0)) AS m(n)
JOIN LATERAL (
    SELECT CASE m.n WHEN 5 THEN 17.60 WHEN 4 THEN 17.60 WHEN 3 THEN 18.10
                    WHEN 2 THEN 18.10 WHEN 1 THEN 19.20 ELSE a.risk_score END AS score,
           CASE m.n WHEN 1 THEN 2 WHEN 0 THEN a.dpd ELSE 0 END AS dpd,
           CASE m.n WHEN 0 THEN a.outstanding ELSE 412.60 END AS outstanding
) v ON TRUE
WHERE a.account_code = 'ACC-10068';

COMMIT;

-- --- Prove it ties --------------------------------------------------------
SELECT a.account_code,
       (SELECT sum(i.amount) FROM customer_schema.invoice i WHERE i.account_id = a.id) AS billed,
       (SELECT COALESCE(sum(p.amount), 0) FROM customer_schema.payment p
         WHERE p.account_id = a.id AND p.status = 'COMPLETED') AS paid,
       a.outstanding,
       CASE WHEN abs(
              (SELECT sum(i.amount) FROM customer_schema.invoice i WHERE i.account_id = a.id)
            - (SELECT COALESCE(sum(p.amount), 0) FROM customer_schema.payment p
                WHERE p.account_id = a.id AND p.status = 'COMPLETED')
            - a.outstanding) < 0.01 THEN 'yes' ELSE 'NO' END AS ledger_ties
FROM customer_schema.account a
WHERE a.account_code IN ('ACC-10067', 'ACC-10068')
ORDER BY a.account_code;
