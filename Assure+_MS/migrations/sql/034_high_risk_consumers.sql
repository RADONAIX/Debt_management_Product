-- =====================================================================================
--  034_high_risk_consumers.sql
--
--  The portfolio had no customer scoring High or Critical, so those bands were
--  empty everywhere. Six consumers are added whose behaviour genuinely earns
--  those bands — deep delinquency, weak credit, poor reachability and broken
--  promises — with matching rows in every table the screens read:
--
--    customer · billing_account · account · invoice · payment · ptp · dispute
--    debt_case · case_activity · risk_history
--
--  Balances are kept consistent with their unpaid invoices, so the billing
--  reconciliation still holds. Idempotent.
-- =====================================================================================

BEGIN;

-- ---- 1. The customers ---------------------------------------------------------------
CREATE TEMP TABLE new_risk(seq INT, code TEXT, name TEXT, city TEXT, region TEXT,
                           credit INT, contactability NUMERIC, months_behind INT,
                           bill NUMERIC, broken INT, disputes INT, band TEXT) ON COMMIT DROP;
INSERT INTO new_risk VALUES
 -- Critical: half a year behind, poor credit, barely reachable, promises broken
 (1,'CUST-CON-201','Faisal Al Nuaimi','Dubai','North',    352, 12, 7, 420, 4, 2, 'Critical'),
 (2,'CUST-CON-202','Rania Haddad','Sharjah','East',       388, 15, 6, 560, 3, 1, 'Critical'),
 (3,'CUST-CON-203','Vikas Chandran','Abu Dhabi','West',   410, 18, 6, 390, 3, 2, 'Critical'),
 -- High: three to four months behind, weak credit, hard to reach
 (4,'CUST-CON-204','Lubna Farsi','Dubai','North',         505, 34, 4, 480, 2, 1, 'High'),
 (5,'CUST-CON-205','Gopal Menon','Al Ain','South',        528, 38, 4, 350, 2, 0, 'High'),
 (6,'CUST-CON-206','Yara Suleiman','Sharjah','East',      544, 41, 3, 620, 2, 1, 'High');

INSERT INTO customer_schema.customer
       (customer_code, customer_type, full_name, email, phone, msisdn,
        segment_code, region_code, country_code, city, credit_score, risk_score, risk_level,
        contactability, best_contact_time, best_channel_code, status, onboarded_on,
        behaviour_type, preferred_language, communication_preference, occupation,
        monthly_income, financial_stress, legal_awareness, financial_literacy,
        responsibility_score, credit_awareness, risk_appetite, emotional_state,
        life_event, employment_stability, cooperation_score, preferred_contact_time)
SELECT n.code, 'CONSUMER', n.name,
       lower(replace(n.name, ' ', '.')) || '@example.ae',
       '+971 5' || (n.seq % 9)::text || ' ' || lpad((n.seq * 417 % 1000)::text, 3, '0')
                || ' ' || lpad((n.seq * 913 % 10000)::text, 4, '0'),
       '+9715' || lpad((70000000 + n.seq * 137)::text, 8, '0'),
       'Consumer', n.region, 'AE', n.city, n.credit,
       0, 'Low', n.contactability,
       '5 PM-8 PM',
       (ARRAY['Dialer','SMS','IVR'])[1 + n.seq % 3],
       'PAST_DUE', CURRENT_DATE - (400 + n.seq * 30),
       'Disputed', 'English', 'Dialer',
       (ARRAY['Driver','Retail Associate','Self-Employed'])[1 + n.seq % 3],
       4500 + n.seq * 450, 'High', 'Low', 'Low', 20, 'Low', 'High',
       'Frustrated', 'Salary delay', 'Low', n.contactability, '5 PM-8 PM'
  FROM new_risk n
ON CONFLICT (customer_code) DO NOTHING;

-- ---- 2. Their billing accounts ------------------------------------------------------
INSERT INTO customer_schema.billing_account
       (ban, customer_id, name, billing_cycle, payment_terms_days, currency_code, credit_limit)
SELECT 'BAN' || (40000 + n.seq)::text, c.id, c.full_name || ' — Personal',
       ((n.seq * 3) % 28) + 1, 15, 'USD', 3000
  FROM new_risk n
  JOIN customer_schema.customer c ON c.customer_code = n.code
ON CONFLICT (ban) DO NOTHING;

-- ---- 3. The subscriber line ---------------------------------------------------------
INSERT INTO customer_schema.account
       (account_code, customer_id, subscriber_no, service_type, product_code, currency_code,
        contract_plan, monthly_bill, activation_date, tenure_months, credit_limit,
        outstanding, prior_outstanding, target_mtd, dpd, aging_bucket,
        risk_score, risk_level, dunning_stage, channel_code,
        contact_attempts, contact_successes, contactability,
        billing_account_id, last_payment_at, last_contact_at, next_followup_date,
        assigned_agent_id, status)
SELECT 'ACC-2' || lpad(n.seq::text, 4, '0'), c.id,
       '+9715' || lpad((80000000 + n.seq * 211)::text, 8, '0'),
       'Mobile Postpaid', 'Mobile Postpaid', 'USD',
       'Smart ' || n.bill::int, n.bill,
       CURRENT_DATE - (400 + n.seq * 30), 24 + n.seq, n.bill * 6,
       -- Balance equals the unpaid cycles, matching the invoices raised below.
       round(n.bill * 1.05 * n.months_behind, 2),
       round(n.bill, 2), round(n.bill * 1.2, 2),
       -- Oldest unpaid invoice is `months_behind` cycles old.
       (CURRENT_DATE - (date_trunc('month', CURRENT_DATE)
                        - ((n.months_behind - 1) || ' months')::interval
                        + INTERVAL '14 days')::date)::int,
       '90+', 0, 'Low',
       LEAST(10, n.months_behind), 'Dialer',
       12 + n.seq, GREATEST(1, (n.contactability / 10)::int), n.contactability,
       ba.id,
       now() - ((n.months_behind * 30 + 10) || ' days')::interval,
       now() - ((2 + n.seq) || ' days')::interval,
       CURRENT_DATE + (1 + n.seq),
       (ARRAY[4,5,6,7,8,10])[1 + n.seq % 6]::bigint,
       'SUSPENDED'
  FROM new_risk n
  JOIN customer_schema.customer c ON c.customer_code = n.code
  JOIN customer_schema.billing_account ba ON ba.ban = 'BAN' || (40000 + n.seq)::text
ON CONFLICT (account_code) DO NOTHING;

-- ---- 4. Invoices: unpaid cycles, plus older settled ones ----------------------------
INSERT INTO customer_schema.invoice (
    invoice_no, account_id, customer_id, billing_account_id, invoice_type,
    bill_period_start, bill_period_end, issue_date, due_date,
    amount, tax_amount, paid_amount, service_description, status)
SELECT 'INV-R' || lpad((a.id * 100 + m.n)::text, 7, '0'),
       a.id, a.customer_id, a.billing_account_id, 'INDIVIDUAL',
       (date_trunc('month', CURRENT_DATE) - ((m.n + 1) || ' months')::interval)::date,
       (date_trunc('month', CURRENT_DATE) - (m.n || ' months')::interval - INTERVAL '1 day')::date,
       (date_trunc('month', CURRENT_DATE) - (m.n || ' months')::interval)::date,
       (date_trunc('month', CURRENT_DATE) - (m.n || ' months')::interval + INTERVAL '14 days')::date,
       round(n.bill, 2), round(n.bill * 0.05, 2),
       CASE WHEN m.n >= n.months_behind THEN round(n.bill * 1.05, 2) ELSE 0 END,
       'Mobile Postpaid — Smart ' || n.bill::int,
       CASE WHEN m.n >= n.months_behind THEN 'PAID' ELSE 'OVERDUE' END
  FROM new_risk n
  JOIN customer_schema.account a ON a.account_code = 'ACC-2' || lpad(n.seq::text, 4, '0')
  CROSS JOIN generate_series(0, 9) AS m(n)
ON CONFLICT (invoice_no) DO NOTHING;

-- ---- 5. Payments only against the settled cycles ------------------------------------
INSERT INTO customer_schema.payment
       (payment_ref, customer_id, account_id, invoice_id, amount, payment_date,
        method_code, status, notes)
SELECT 'PAY-R' || lpad(i.id::text, 7, '0'), i.customer_id, i.account_id, i.id,
       i.amount + i.tax_amount,
       (i.due_date - ((i.id % 4) || ' days')::interval)::date,
       (ARRAY['Bank Transfer','Credit Card','Cash'])[1 + i.id % 3],
       'COMPLETED', 'Monthly bill settlement'
  FROM customer_schema.invoice i
 WHERE i.invoice_no LIKE 'INV-R%' AND i.status = 'PAID'
ON CONFLICT (payment_ref) DO NOTHING;

-- ---- 6. Cases, broken promises, disputes and contact history ------------------------
INSERT INTO customer_schema.debt_case (
    case_code, customer_id, account_id, case_type_code, summary, status, priority,
    risk_level, amount, dpd, dunning_stage, assigned_agent_id, opened_at, last_activity_at)
SELECT 'CASE-R' || lpad(a.id::text, 5, '0'), a.customer_id, a.id, 'Legal Followup',
       'Pre-legal recovery — repeated failure to settle after promises',
       'LEGAL', 'Critical', 'Critical', a.outstanding, a.dpd, a.dunning_stage,
       a.assigned_agent_id, now() - ((a.dpd + 10) || ' days')::interval,
       now() - INTERVAL '3 days'
  FROM customer_schema.account a
 WHERE a.account_code LIKE 'ACC-2%'
ON CONFLICT (case_code) DO NOTHING;

INSERT INTO customer_schema.ptp (
    ptp_code, customer_id, account_id, case_id, promised_amount, promised_date,
    instalment_count, kept_amount, status, channel_code, ai_probability, notes)
SELECT 'PTP-R' || lpad((a.id * 10 + g.n)::text, 6, '0'),
       a.customer_id, a.id, dc.id,
       round(a.outstanding / GREATEST(1, n.broken), 2),
       (CURRENT_DATE - (20 * g.n))::date,
       1, 0, 'BROKEN', 'Dialer', round((20 + g.n * 5)::numeric, 2),
       'Promise not honoured — no payment received'
  FROM new_risk n
  JOIN customer_schema.account a ON a.account_code = 'ACC-2' || lpad(n.seq::text, 4, '0')
  JOIN customer_schema.debt_case dc ON dc.account_id = a.id
  CROSS JOIN generate_series(1, 4) AS g(n)
 WHERE g.n <= n.broken
ON CONFLICT (ptp_code) DO NOTHING;

INSERT INTO customer_schema.dispute (
    dispute_code, customer_id, account_id, case_id, reason_code, description,
    amount, status, priority, assigned_agent_id, filed_at, sla_deadline, ai_confidence)
SELECT 'DSP-R' || lpad((a.id * 10 + g.n)::text, 6, '0'),
       a.customer_id, a.id, dc.id,
       (ARRAY['INCORRECT_AMOUNT','LATE_FEE','ROAMING_CHARGES'])[1 + g.n % 3],
       'Customer disputes the outstanding balance and has withheld payment.',
       round(n.bill * 0.4, 2), 'ESCALATED', 'High', a.assigned_agent_id,
       now() - ((30 * g.n) || ' days')::interval,
       now() + INTERVAL '5 days', 70
  FROM new_risk n
  JOIN customer_schema.account a ON a.account_code = 'ACC-2' || lpad(n.seq::text, 4, '0')
  JOIN customer_schema.debt_case dc ON dc.account_id = a.id
  CROSS JOIN generate_series(1, 2) AS g(n)
 WHERE g.n <= n.disputes
ON CONFLICT (dispute_code) DO NOTHING;

INSERT INTO customer_schema.case_activity (
    activity_type, customer_id, account_id, case_id, channel_code, direction,
    subject, body, outcome, is_automated, agent_id, occurred_at)
SELECT (ARRAY['CALL','SMS','EMAIL','WHATSAPP'])[1 + g.n % 4],
       a.customer_id, a.id, dc.id,
       (ARRAY['Dialer','SMS','Email','WhatsApp'])[1 + g.n % 4],
       'OUTBOUND',
       CASE WHEN g.n <= 2 THEN 'Pre-legal notification' ELSE 'Final notice before escalation' END,
       'Balance of $' || round(a.outstanding, 2) || ' remains unpaid after ' || a.dpd || ' days.',
       CASE WHEN g.n % 3 = 0 THEN 'PROMISE_MADE' ELSE 'NO_ANSWER' END,
       (g.n % 2 = 0), a.assigned_agent_id,
       now() - ((g.n * 9) || ' days')::interval
  FROM customer_schema.account a
  JOIN customer_schema.debt_case dc ON dc.account_id = a.id
  CROSS JOIN generate_series(1, 8) AS g(n)
 WHERE a.account_code LIKE 'ACC-2%';

-- ---- 7. Six months of deteriorating history -----------------------------------------
INSERT INTO customer_schema.risk_history (account_id, as_of_month, risk_score, dpd, outstanding)
SELECT a.id,
       (date_trunc('month', CURRENT_DATE) - ((5 - m.n) || ' months')::interval)::date,
       GREATEST(1, LEAST(100, round((35 + m.n * 11)::numeric, 2))),
       GREATEST(0, a.dpd - (5 - m.n) * 30),
       round(a.monthly_bill * GREATEST(1, m.n + 1), 2)
  FROM customer_schema.account a
  CROSS JOIN generate_series(0, 5) AS m(n)
 WHERE a.account_code LIKE 'ACC-2%'
ON CONFLICT (account_id, as_of_month) DO NOTHING;

COMMIT;
