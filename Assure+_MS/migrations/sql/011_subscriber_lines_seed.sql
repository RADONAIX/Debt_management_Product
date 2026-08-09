-- =====================================================================================
--  011_subscriber_lines_seed.sql  ·  Subscriber lines and invoices
--
--  One subscriber line (customer_schema.account) per subscriber created in 010,
--  then invoices: enterprise BANs get one consolidated invoice covering their
--  lines, while consumers and a deliberate minority of enterprise lines are
--  billed individually.
--
--  DPD and outstanding are spread across the ageing bands on purpose so every
--  downstream module has natural candidates — see the notes at the foot.
--  Deterministic and safe to re-run.
-- =====================================================================================

BEGIN;

-- ---- 1. Subscriber lines -----------------------------------------------------------
WITH sub AS (
    SELECT cu.id AS customer_id,
           cu.customer_code,
           cu.customer_type,
           cu.company_id,
           cu.risk_score,
           cu.contactability,
           cu.best_channel_code,
           row_number() OVER (ORDER BY cu.customer_code) AS seq
      FROM customer_schema.customer cu
     WHERE cu.customer_code LIKE 'CUST-ENT-%' OR cu.customer_code LIKE 'CUST-CON-1%'
), placed AS (
    SELECT s.*,
           -- Enterprise lines sit on a branch of their own company, round-robin
           -- so every branch is populated; departments only where they exist.
           (SELECT b.id FROM customer_schema.company_branch b
             WHERE b.company_id = s.company_id
             ORDER BY b.id OFFSET (s.seq % GREATEST(1,
                   (SELECT count(*) FROM customer_schema.company_branch b2
                     WHERE b2.company_id = s.company_id))) LIMIT 1) AS branch_id,
           (SELECT ba.id FROM customer_schema.billing_account ba
             WHERE ba.company_id = s.company_id
             ORDER BY ba.id OFFSET (s.seq % GREATEST(1,
                   (SELECT count(*) FROM customer_schema.billing_account ba2
                     WHERE ba2.company_id = s.company_id))) LIMIT 1) AS ent_ban_id,
           (SELECT ba.id FROM customer_schema.billing_account ba
             WHERE ba.customer_id = s.customer_id LIMIT 1) AS con_ban_id,
           -- Ageing band: ~30% current, then 1-30 / 31-60 / 61-90 / 90+.
           CASE
             WHEN (s.seq * 7) % 100 < 30 THEN 0
             WHEN (s.seq * 7) % 100 < 50 THEN 5  + (s.seq % 25)
             WHEN (s.seq * 7) % 100 < 68 THEN 31 + (s.seq % 29)
             WHEN (s.seq * 7) % 100 < 85 THEN 61 + (s.seq % 29)
             ELSE 91 + (s.seq % 120)
           END AS dpd
      FROM sub s
)
INSERT INTO customer_schema.account (
    account_code, customer_id, subscriber_no, service_type, product_code, currency_code,
    contract_plan, activation_date, tenure_months, credit_limit,
    outstanding, prior_outstanding, target_mtd, dpd, aging_bucket,
    risk_score, risk_level, dunning_stage, channel_code,
    contact_attempts, contact_successes, contactability,
    billing_account_id, branch_id, department_id,
    last_payment_at, last_contact_at, next_followup_date,
    assigned_agent_id, status)
SELECT
    'ACC-1' || lpad(p.seq::text, 4, '0'),
    p.customer_id,
    '+9715' || lpad(((p.seq * 8123) % 100000000)::text, 8, '0'),
    CASE WHEN p.customer_type = 'CONSUMER'
         THEN (ARRAY['Mobile Postpaid','Mobile Prepaid','Broadband','IPTV'])[1 + p.seq % 4]
         ELSE (ARRAY['Mobile Postpaid','Fibre','Leased Line','IoT/M2M'])[1 + p.seq % 4] END,
    CASE WHEN p.customer_type = 'CONSUMER'
         THEN (ARRAY['Mobile Postpaid','Device Financing'])[1 + p.seq % 2]
         ELSE (ARRAY['Enterprise Suite','Business Fibre','MPLS','IoT Connectivity'])[1 + p.seq % 4] END,
    'AED',
    CASE WHEN p.customer_type = 'CONSUMER'
         THEN (ARRAY['Freedom 99','Smart 149','Family Share 249','Data Max 199'])[1 + p.seq % 4]
         ELSE (ARRAY['Business Elite 499','Corporate Voice 299','Enterprise Data 999',
                     'IoT Bundle 149'])[1 + p.seq % 4] END,
    DATE '2022-03-01' + (p.seq * 13)::int,
    (12 + p.seq % 25)::int,
    CASE WHEN p.customer_type = 'CONSUMER' THEN 5000 ELSE 150000 END,
    -- Balance grows with the ageing band.
    round((CASE WHEN p.dpd = 0 THEN 120 + (p.seq % 40) * 15
                WHEN p.dpd <= 30 THEN 400 + (p.seq % 60) * 25
                WHEN p.dpd <= 60 THEN 1500 + (p.seq % 50) * 90
                WHEN p.dpd <= 90 THEN 4200 + (p.seq % 45) * 180
                ELSE 9500 + (p.seq % 40) * 420 END
           * CASE WHEN p.customer_type = 'ENTERPRISE' THEN 3.5 ELSE 1 END)::numeric, 2),
    round((200 + (p.seq % 30) * 45)::numeric, 2),
    round((500 + (p.seq % 20) * 120)::numeric, 2),
    p.dpd::int,
    CASE WHEN p.dpd = 0 THEN 'Current' WHEN p.dpd <= 30 THEN '1-30'
         WHEN p.dpd <= 60 THEN '31-60'  WHEN p.dpd <= 90 THEN '61-90' ELSE '90+' END,
    p.risk_score,
    CASE WHEN p.risk_score >= 80 THEN 'Critical' WHEN p.risk_score >= 60 THEN 'High'
         WHEN p.risk_score >= 30 THEN 'Medium' ELSE 'Low' END,
    LEAST(10, (p.dpd / 30))::int,
    p.best_channel_code,
    (4 + p.seq % 9)::int,
    (1 + p.seq % 4)::int,
    p.contactability,
    COALESCE(p.ent_ban_id, p.con_ban_id),
    p.branch_id,
    (SELECT d.id FROM customer_schema.department d
      WHERE d.branch_id = p.branch_id ORDER BY d.id OFFSET (p.seq % 3) LIMIT 1),
    now() - ((30 + p.seq % 90) || ' days')::interval,
    now() - ((1 + p.seq % 21) || ' days')::interval,
    CURRENT_DATE + (1 + p.seq % 14)::int,
    (ARRAY[4,5,6,7,8,10])[1 + p.seq % 6]::bigint,
    CASE WHEN p.dpd = 0 THEN 'CURRENT' WHEN p.dpd > 90 THEN 'SUSPENDED' ELSE 'DELINQUENT' END
  FROM placed p
ON CONFLICT (account_code) DO NOTHING;

-- ---- 2. Grouped invoices: one per enterprise BAN -----------------------------------
-- Every enterprise BAN with 2+ lines is billed as a single consolidated invoice.
WITH grouped AS (
    SELECT ba.id AS ban_id, ba.company_id, count(a.id) AS lines,
           sum(a.outstanding) AS total,
           row_number() OVER (ORDER BY ba.id) AS n
      FROM customer_schema.billing_account ba
      JOIN customer_schema.account a ON a.billing_account_id = ba.id
     WHERE ba.company_id IS NOT NULL AND a.account_code LIKE 'ACC-1%'
     GROUP BY ba.id, ba.company_id
    HAVING count(a.id) >= 2
)
INSERT INTO customer_schema.invoice (
    invoice_no, account_id, customer_id, billing_account_id, invoice_type,
    bill_period_start, bill_period_end, issue_date, due_date,
    amount, tax_amount, paid_amount, service_description, status)
SELECT 'INV-2026-' || lpad((1000 + g.n)::text, 4, '0'),
       NULL,
       -- A grouped invoice still needs a billed party: the first line's customer.
       (SELECT a.customer_id FROM customer_schema.account a
         WHERE a.billing_account_id = g.ban_id ORDER BY a.id LIMIT 1),
       g.ban_id, 'GROUPED',
       DATE '2026-06-01', DATE '2026-06-30', DATE '2026-07-01', DATE '2026-07-15',
       round(g.total, 2), round(g.total * 0.05, 2), 0,
       'Consolidated corporate billing — ' || g.lines || ' subscriber lines',
       CASE WHEN g.n % 3 = 0 THEN 'PARTIAL' ELSE 'OVERDUE' END
  FROM grouped g
ON CONFLICT (invoice_no) DO NOTHING;

INSERT INTO customer_schema.invoice_group_member (invoice_id, account_id, share_amount)
SELECT i.id, a.id, a.outstanding
  FROM customer_schema.invoice i
  JOIN customer_schema.account a ON a.billing_account_id = i.billing_account_id
 WHERE i.invoice_type = 'GROUPED' AND a.account_code LIKE 'ACC-1%'
ON CONFLICT DO NOTHING;

-- ---- 3. Individual invoices --------------------------------------------------------
-- Consumers, plus enterprise lines on a single-line BAN.
INSERT INTO customer_schema.invoice (
    invoice_no, account_id, customer_id, billing_account_id, invoice_type,
    bill_period_start, bill_period_end, issue_date, due_date,
    amount, tax_amount, paid_amount, service_description, status)
SELECT 'INV-2026-' || lpad((2000 + row_number() OVER (ORDER BY a.id))::text, 4, '0'),
       a.id, a.customer_id, a.billing_account_id, 'INDIVIDUAL',
       DATE '2026-06-01', DATE '2026-06-30', DATE '2026-07-01', DATE '2026-07-15',
       round(a.outstanding, 2), round(a.outstanding * 0.05, 2),
       CASE WHEN a.dpd = 0 THEN round(a.outstanding, 2) ELSE 0 END,
       a.service_type || ' — ' || a.contract_plan,
       CASE WHEN a.dpd = 0 THEN 'PAID' WHEN a.dpd > 60 THEN 'OVERDUE' ELSE 'UNPAID' END
  FROM customer_schema.account a
 WHERE a.account_code LIKE 'ACC-1%'
   AND NOT EXISTS (
        SELECT 1 FROM customer_schema.invoice_group_member m WHERE m.account_id = a.id)
ON CONFLICT (invoice_no) DO NOTHING;

COMMIT;
