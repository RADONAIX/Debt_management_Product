-- =====================================================================================
--  014_demo_completeness.sql  ·  Fill every gap the Subscriber 360 screen exposes
--
--  1. Subscriber profile for the 65 new customers (the earlier backfill ran
--     before they existed, so every attribute was NULL on screen).
--  2. The 45 original accounts get a BAN, subscriber number and service type,
--     so legacy customers render the same as new ones.
--  3. Invoices, cases, interactions, PTPs and disputes for the new subscriber
--     lines, shaped by how delinquent each line is — a current line has a clean
--     history, a 90+ line has broken promises, escalated cases and disputes.
--  Deterministic and idempotent.
-- =====================================================================================

BEGIN;

-- ---- 1. Subscriber profile for every customer that lacks one -----------------------
UPDATE customer_schema.customer SET
  behaviour_type = CASE risk_level
      WHEN 'Low' THEN 'Willing' WHEN 'Medium' THEN 'Forgetful'
      WHEN 'High' THEN 'Evasive' ELSE 'Disputed' END,
  preferred_language = CASE WHEN id % 5 = 0 THEN 'Arabic' WHEN id % 7 = 0 THEN 'Hindi' ELSE 'English' END,
  communication_preference = COALESCE(best_channel_code, 'SMS'),
  occupation = CASE
      WHEN customer_type = 'CONSUMER' THEN
        (ARRAY['Salaried Professional','Teacher','Nurse','Driver','Retail Associate',
               'Engineer','Self-Employed','Accountant'])[1 + id % 8]
      ELSE (ARRAY['Operations Manager','Sales Lead','Field Engineer','Finance Controller',
                  'Procurement Officer'])[1 + id % 5] END,
  monthly_income = CASE WHEN customer_type = 'CONSUMER'
      THEN 6000 + (id % 14) * 1750 ELSE 18000 + (id % 12) * 4500 END,
  financial_stress = CASE WHEN risk_score >= 66 THEN 'High' WHEN risk_score >= 33 THEN 'Medium' ELSE 'Low' END,
  legal_awareness = CASE WHEN credit_score >= 700 THEN 'High' WHEN credit_score >= 550 THEN 'Medium' ELSE 'Low' END,
  financial_literacy = CASE WHEN credit_score >= 720 THEN 'High' WHEN credit_score >= 580 THEN 'Medium' ELSE 'Low' END,
  responsibility_score = GREATEST(5, LEAST(100, 100 - risk_score)),
  credit_awareness = CASE WHEN credit_score >= 700 THEN 'High' WHEN credit_score >= 550 THEN 'Medium' ELSE 'Low' END,
  risk_appetite = CASE WHEN risk_score >= 66 THEN 'High' WHEN risk_score >= 33 THEN 'Medium' ELSE 'Low' END,
  emotional_state = CASE risk_level
      WHEN 'Low' THEN 'Cooperative' WHEN 'Medium' THEN 'Neutral'
      WHEN 'High' THEN 'Anxious' ELSE 'Frustrated' END,
  life_event = (ARRAY['None reported','Job change','Medical expense','Relocation',
                      'New dependant','Salary delay'])[1 + id % 6],
  employment_stability = CASE WHEN risk_score >= 66 THEN 'Low' WHEN risk_score >= 33 THEN 'Medium' ELSE 'High' END,
  cooperation_score = GREATEST(10, LEAST(100, contactability)),
  preferred_contact_time = COALESCE(best_contact_time,
      (ARRAY['9 AM-12 PM','1 PM-4 PM','5 PM-8 PM'])[1 + id % 3])
WHERE behaviour_type IS NULL;

-- ---- 2. Legacy accounts become proper subscriber lines ------------------------------
INSERT INTO customer_schema.billing_account
       (ban, customer_id, name, billing_cycle, payment_terms_days, currency_code, credit_limit)
SELECT 'BAN' || (30000 + c.id)::text, c.id,
       COALESCE(c.full_name, c.company_name) || ' — Primary',
       ((c.id * 7) % 28) + 1, 30, 'AED', 25000
  FROM customer_schema.customer c
 WHERE NOT EXISTS (SELECT 1 FROM customer_schema.billing_account b WHERE b.customer_id = c.id)
   AND NOT EXISTS (SELECT 1 FROM customer_schema.billing_account b2
                    WHERE b2.company_id IS NOT NULL AND c.company_id = b2.company_id)
ON CONFLICT (ban) DO NOTHING;

UPDATE customer_schema.account a SET
  subscriber_no = '+9715' || lpad(((a.id * 6607) % 100000000)::text, 8, '0'),
  service_type = CASE a.product_code
      WHEN 'Mobile Postpaid' THEN 'Mobile Postpaid'
      WHEN 'Device Financing' THEN 'Mobile Postpaid'
      WHEN 'Business Fibre' THEN 'Fibre'
      WHEN 'Enterprise Suite' THEN 'Leased Line'
      WHEN 'MPLS' THEN 'Leased Line'
      WHEN 'IoT Connectivity' THEN 'IoT/M2M'
      ELSE 'Broadband' END,
  billing_account_id = (SELECT b.id FROM customer_schema.billing_account b
                         WHERE b.customer_id = a.customer_id LIMIT 1),
  next_followup_date = CURRENT_DATE + ((1 + a.id % 21))::int
WHERE a.subscriber_no IS NULL;

-- ---- 3. Invoice history: six monthly bills per new line -----------------------------
INSERT INTO customer_schema.invoice (
    invoice_no, account_id, customer_id, billing_account_id, invoice_type,
    bill_period_start, bill_period_end, issue_date, due_date,
    amount, tax_amount, paid_amount, service_description, status)
SELECT 'INV-H' || lpad((a.id * 10 + m.n)::text, 6, '0'),
       a.id, a.customer_id, a.billing_account_id, 'INDIVIDUAL',
       (date_trunc('month', CURRENT_DATE) - ((m.n + 1) || ' months')::interval)::date,
       (date_trunc('month', CURRENT_DATE) - (m.n || ' months')::interval - INTERVAL '1 day')::date,
       (date_trunc('month', CURRENT_DATE) - (m.n || ' months')::interval)::date,
       (date_trunc('month', CURRENT_DATE) - (m.n || ' months')::interval + INTERVAL '14 days')::date,
       round((90 + (a.id % 18) * 24) * CASE WHEN c.customer_type = 'ENTERPRISE' THEN 6 ELSE 1 END, 2),
       round((90 + (a.id % 18) * 24) * CASE WHEN c.customer_type = 'ENTERPRISE' THEN 6 ELSE 1 END * 0.05, 2),
       CASE WHEN m.n >= LEAST(5, a.dpd / 30)
            THEN round((90 + (a.id % 18) * 24) * CASE WHEN c.customer_type='ENTERPRISE' THEN 6 ELSE 1 END * 1.05, 2)
            ELSE 0 END,
       a.service_type || ' — ' || a.contract_plan,
       CASE WHEN m.n >= LEAST(5, a.dpd / 30) THEN 'PAID'
            WHEN a.dpd > 60 THEN 'OVERDUE' ELSE 'UNPAID' END
  FROM customer_schema.account a
  JOIN customer_schema.customer c ON c.id = a.customer_id
  CROSS JOIN generate_series(1, 5) AS m(n)
 WHERE a.account_code LIKE 'ACC-1%'
ON CONFLICT (invoice_no) DO NOTHING;

COMMIT;
