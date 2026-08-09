-- =====================================================================================
--  015_engagement_history.sql  ·  Cases, interactions, promises and disputes
--
--  Gives the Borrower 360 tabs real content for the new subscriber lines, shaped
--  by how far behind each line is:
--    Current      → no case, a couple of courtesy contacts
--    1-30 / 31-60 → open case, reminder contacts, a promise that was kept
--    61-90        → escalated case, more contact attempts, a broken promise
--    90+          → legal case, heavy contact history, broken promise + dispute
--  Deterministic and idempotent.
-- =====================================================================================

BEGIN;

-- ---- 1. Cases for delinquent lines -------------------------------------------------
INSERT INTO customer_schema.debt_case (
    case_code, customer_id, account_id, case_type_code, summary, status, priority,
    risk_level, amount, dpd, strategy_id, dunning_stage, assigned_agent_id,
    opened_at, last_activity_at)
SELECT 'CASE-1' || lpad(a.id::text, 5, '0'),
       a.customer_id, a.id,
       CASE WHEN a.dpd > 90 THEN 'Legal Followup'
            WHEN a.dpd > 60 THEN 'Collection'
            WHEN a.dpd > 30 THEN 'Collection' ELSE 'Billing Issue' END,
       CASE WHEN a.dpd > 90 THEN 'Pre-legal recovery — repeated payment failure'
            WHEN a.dpd > 60 THEN 'Escalated collection — no response to reminders'
            ELSE 'Standard collection follow-up' END,
       CASE WHEN a.dpd > 90 THEN 'LEGAL' WHEN a.dpd > 60 THEN 'ESCALATED'
            WHEN a.dpd > 30 THEN 'IN_PROGRESS' ELSE 'OPEN' END,
       CASE WHEN a.dpd > 90 THEN 'Critical' WHEN a.dpd > 60 THEN 'High'
            WHEN a.dpd > 30 THEN 'Medium' ELSE 'Low' END,
       a.risk_level, a.outstanding, a.dpd, a.strategy_id, a.dunning_stage,
       a.assigned_agent_id,
       now() - ((a.dpd + 5) || ' days')::interval,
       now() - ((1 + a.id % 9) || ' days')::interval
  FROM customer_schema.account a
 WHERE a.account_code LIKE 'ACC-1%' AND a.dpd > 0
ON CONFLICT (case_code) DO NOTHING;

-- ---- 2. Interaction history --------------------------------------------------------
-- Contact attempts grow with delinquency; outcomes get worse as DPD rises.
INSERT INTO customer_schema.case_activity (
    activity_type, customer_id, account_id, case_id, channel_code, direction,
    subject, body, outcome, is_automated, agent_id, occurred_at)
SELECT
  CASE WHEN n.i % 4 = 0 THEN 'CALL' WHEN n.i % 4 = 1 THEN 'SMS'
       WHEN n.i % 4 = 2 THEN 'EMAIL' ELSE 'WHATSAPP' END,
  a.customer_id, a.id, dc.id,
  (ARRAY['SMS','Email','WhatsApp','Dialer','IVR'])[1 + (a.id + n.i) % 5],
  CASE WHEN n.i % 5 = 0 THEN 'INBOUND' ELSE 'OUTBOUND' END,
  CASE WHEN a.dpd = 0 THEN 'Payment confirmation'
       WHEN a.dpd <= 30 THEN 'Friendly payment reminder'
       WHEN a.dpd <= 60 THEN 'Overdue balance — second reminder'
       WHEN a.dpd <= 90 THEN 'Final notice before escalation'
       ELSE 'Pre-legal notification' END,
  'Regarding invoice balance of AED ' || round(a.outstanding, 2)
    || ' on subscriber ' || COALESCE(a.subscriber_no, a.account_code) || '.',
  CASE WHEN a.dpd = 0 THEN 'RESOLVED'
       WHEN n.i % 3 = 0 THEN 'NO_ANSWER'
       WHEN n.i % 3 = 1 THEN 'PROMISE_MADE' ELSE 'CONTACTED' END,
  (n.i % 2 = 0),
  a.assigned_agent_id,
  now() - ((n.i * 6 + a.id % 5) || ' days')::interval
  FROM customer_schema.account a
  LEFT JOIN customer_schema.debt_case dc ON dc.account_id = a.id
  CROSS JOIN generate_series(1, 6) AS n(i)
 WHERE a.account_code LIKE 'ACC-1%'
   -- Two touches for a healthy line, up to six for the worst.
   AND n.i <= GREATEST(2, LEAST(6, 2 + a.dpd / 30));

-- ---- 3. Promises to pay ------------------------------------------------------------
INSERT INTO customer_schema.ptp (
    ptp_code, customer_id, account_id, case_id, promised_amount, promised_date,
    instalment_count, kept_amount, status, channel_code, ai_probability, notes)
SELECT 'PTP-1' || lpad(a.id::text, 5, '0'),
       a.customer_id, a.id, dc.id,
       round(a.outstanding * 0.6, 2),
       (CURRENT_DATE - (a.dpd / 3))::date,
       CASE WHEN a.outstanding > 10000 THEN 3 ELSE 1 END,
       CASE WHEN a.dpd <= 60 THEN round(a.outstanding * 0.6, 2) ELSE 0 END,
       CASE WHEN a.dpd <= 60 THEN 'KEPT' WHEN a.dpd <= 90 THEN 'BROKEN' ELSE 'BROKEN' END,
       (ARRAY['Dialer','WhatsApp','SMS','Email'])[1 + a.id % 4],
       round((30 + (100 - a.risk_score) * 0.6)::numeric, 2),
       CASE WHEN a.dpd <= 60 THEN 'Customer settled as promised.'
            ELSE 'Promise not honoured — follow-up required.' END
  FROM customer_schema.account a
  JOIN customer_schema.debt_case dc ON dc.account_id = a.id
 WHERE a.account_code LIKE 'ACC-1%' AND a.dpd > 15
ON CONFLICT (ptp_code) DO NOTHING;

-- ---- 4. Disputes on the worst accounts ---------------------------------------------
INSERT INTO customer_schema.dispute (
    dispute_code, customer_id, account_id, case_id, reason_code, description,
    amount, status, priority, assigned_agent_id, filed_at, sla_deadline, ai_confidence)
SELECT 'DSP-1' || lpad(a.id::text, 5, '0'),
       a.customer_id, a.id, dc.id,
       (ARRAY['INCORRECT_AMOUNT','SERVICE_NOT_DELIVERED','DUPLICATE_INVOICE',
              'ROAMING_CHARGES','DEVICE_INSTALMENT','LATE_FEE'])[1 + a.id % 6],
       'Customer disputes charges on the latest bill and has asked for a breakdown.',
       round(a.outstanding * 0.25, 2),
       CASE WHEN a.id % 3 = 0 THEN 'INVESTIGATING' WHEN a.id % 3 = 1 THEN 'OPEN' ELSE 'ESCALATED' END,
       CASE WHEN a.dpd > 90 THEN 'High' ELSE 'Medium' END,
       a.assigned_agent_id,
       now() - ((10 + a.id % 30) || ' days')::interval,
       now() + ((3 + a.id % 7) || ' days')::interval,
       round((55 + a.id % 40)::numeric, 2)
  FROM customer_schema.account a
  JOIN customer_schema.debt_case dc ON dc.account_id = a.id
 WHERE a.account_code LIKE 'ACC-1%' AND a.dpd > 60 AND a.id % 2 = 0
ON CONFLICT (dispute_code) DO NOTHING;

COMMIT;
