-- ===========================================================================
-- Three demo customers for the negotiator showcase.
--
-- Load into Debt_management_db. Touches ONLY rows whose codes begin
-- 'CUST-DEMO-' or 'CASE-DEMO-'. Nothing existing is altered or deleted.
-- Safe to re-run — it clears its own rows first (debt_case cascades from
-- customer).
--
-- Each customer is built to exercise a different guarantee:
--
--   DEMO-001  Karim Al Mansoori   CONFRONTATIONAL  envelope holds under pressure
--   DEMO-002  Noura Al Balushi    HELPLESS         evidence opens it legitimately
--   DEMO-003  Tariq Haddad        AVOIDANT         escalation / hard handoff
--
-- Why these field values specifically
-- -----------------------------------
-- The negotiator derives the archetype from behaviour_type, financial_stress
-- and emotional_state (src/domain/customer.py):
--
--   High stress + Anxious                    -> HELPLESS   (distress wins outright)
--   Frustrated + not Willing/Forgetful       -> CONFRONTATIONAL
--   otherwise Disputed/Evasive/Forgetful/Willing -> mapped directly
--
-- So the three rows below are tuned to land on three different archetypes
-- rather than all collapsing into one, which is what happens on the current
-- Critical-risk book (all High-stress + Frustrated).
--
-- Debt is set at roughly 2-4x monthly income on purpose. On the existing rows
-- the balance is around 0.3-0.5x monthly income, which makes every case
-- trivially affordable and gives the agent nothing to negotiate.
--
-- The *_category columns (segment_category, region_category,
-- country_category, best_channel_category, case_type_category) are GENERATED
-- ALWAYS in this schema, so they are deliberately absent from the column
-- lists below — Postgres fills them and rejects any attempt to supply them.
--
-- Amounts are AED.
-- ===========================================================================

BEGIN;

-- Clear only our own demo rows. debt_case has ON DELETE CASCADE from customer.
DELETE FROM customer_schema.debt_case
 WHERE case_code LIKE 'CASE-DEMO-%';
DELETE FROM customer_schema.customer
 WHERE customer_code LIKE 'CUST-DEMO-%';


-- ---------------------------------------------------------------------------
-- DEMO-001 — Karim Al Mansoori — CONFRONTATIONAL, strategic defaulter
--
-- Comfortable income (9,500/mo) against a 21,400 balance, employment stable,
-- no adverse life event, and HIGH awareness on all three axes. He knows
-- exactly what he owes and what the consequences are. This is unwillingness,
-- not inability — so hardship is not credible and the envelope must not move.
--
-- Demo: push hard for a discount. Expect disc<=0%, upfront>=25% every turn.
-- ---------------------------------------------------------------------------
WITH new_customer AS (
    INSERT INTO customer_schema.customer (
        customer_code, customer_type, full_name, email, phone, msisdn,
        segment_code, region_code, country_code, city,
        credit_score, risk_score, risk_level, contactability,
        best_contact_time, best_channel_code, status,
        behaviour_type, preferred_language, communication_preference,
        occupation, monthly_income, financial_stress,
        legal_awareness, financial_literacy, responsibility_score,
        credit_awareness, risk_appetite, emotional_state, life_event,
        employment_stability, cooperation_score, preferred_contact_time,
        onboarded_on
    ) VALUES (
        'CUST-DEMO-001', 'CONSUMER', 'Karim Al Mansoori',
        'k.almansoori@example.ae', '+971 50 118 4402', '+971580001001',
        'Consumer', 'West', 'AE', 'Dubai',
        612, 88.5, 'Critical', 0.82,
        '5 PM-8 PM', 'Dialer', 'PAST_DUE',
        'Disputed', 'English', 'Dialer',
        'Sales Manager', 9500.00, 'Low',
        'High', 'High', 0.35,
        'High', 'High', 'Frustrated', 'None reported',
        'High', 0.28, '5 PM-8 PM',
        DATE '2022-03-14'
    )
    RETURNING id
)
INSERT INTO customer_schema.debt_case (
    case_code, customer_id, case_type_code,
    summary, status, priority, risk_level, amount, predicted_payment,
    dpd, dunning_stage, opened_at, sla_breached
)
SELECT
    'CASE-DEMO-001', id, 'Collection',
    'High-value balance, customer refuses full settlement despite capacity',
    'IN_PROGRESS', 'Critical', 'Critical', 21400.00, 3210.00,
    96, 3, now() - INTERVAL '96 days', TRUE
FROM new_customer;


-- ---------------------------------------------------------------------------
-- DEMO-002 — Noura Al Balushi — HELPLESS, genuine hardship
--
-- Income collapsed to 2,800/mo after a job change, employment unstable, high
-- financial stress and ANXIOUS — which is the distress signal that outranks
-- her 'Willing' label. LOW awareness on all three axes, so the agent should
-- switch to plain language and check understanding before asking her to
-- commit (Appendix B.1).
--
-- Debt is 11,600 against 2,800/mo — 4.1x monthly income. Genuinely hard.
--
-- Demo: she claims hardship (buys NOTHING, tier -> 'claimed'), then ops
-- verifies a document out of band and the discount axis opens to 30%.
-- ---------------------------------------------------------------------------
WITH new_customer AS (
    INSERT INTO customer_schema.customer (
        customer_code, customer_type, full_name, email, phone, msisdn,
        segment_code, region_code, country_code, city,
        credit_score, risk_score, risk_level, contactability,
        best_contact_time, best_channel_code, status,
        behaviour_type, preferred_language, communication_preference,
        occupation, monthly_income, financial_stress,
        legal_awareness, financial_literacy, responsibility_score,
        credit_awareness, risk_appetite, emotional_state, life_event,
        employment_stability, cooperation_score, preferred_contact_time,
        onboarded_on
    ) VALUES (
        'CUST-DEMO-002', 'CONSUMER', 'Noura Al Balushi',
        'n.albalushi@example.ae', '+971 52 447 9130', '+971580001002',
        'Consumer', 'North', 'AE', 'Sharjah',
        438, 91.2, 'Critical', 0.64,
        '9:00 AM - 11:00 AM', 'WhatsApp', 'PAST_DUE',
        'Willing', 'English', 'WhatsApp',
        'Retail Associate', 2800.00, 'High',
        'Low', 'Low', 0.78,
        'Low', 'Low', 'Anxious', 'Job change',
        'Low', 0.71, '9:00 AM - 11:00 AM',
        DATE '2021-11-02'
    )
    RETURNING id
)
INSERT INTO customer_schema.debt_case (
    case_code, customer_id, case_type_code,
    summary, status, priority, risk_level, amount, predicted_payment,
    dpd, dunning_stage, opened_at, sla_breached
)
SELECT
    'CASE-DEMO-002', id, 'Payment Plan',
    'Income loss following job change; affordability review required',
    'IN_PROGRESS', 'High', 'Critical', 11600.00, 1740.00,
    154, 4, now() - INTERVAL '154 days', TRUE
FROM new_customer;


-- ---------------------------------------------------------------------------
-- DEMO-003 — Tariq Haddad — AVOIDANT, deflects then disputes
--
-- Evasive, emotionally neutral, medium stress — so no distress override and
-- no frustration; he maps straight through to AVOIDANT. Income 6,200/mo
-- against 14,900 (2.4x), so he could pay something but avoids committing.
--
-- Demo: he deflects for two or three turns, then asks for written validation
-- of the debt. That is a §6 hard-handoff trigger — the agent must stop and
-- escalate, NOT argue that the debt is valid. The session then returns 409
-- to any further turn.
-- ---------------------------------------------------------------------------
WITH new_customer AS (
    INSERT INTO customer_schema.customer (
        customer_code, customer_type, full_name, email, phone, msisdn,
        segment_code, region_code, country_code, city,
        credit_score, risk_score, risk_level, contactability,
        best_contact_time, best_channel_code, status,
        behaviour_type, preferred_language, communication_preference,
        occupation, monthly_income, financial_stress,
        legal_awareness, financial_literacy, responsibility_score,
        credit_awareness, risk_appetite, emotional_state, life_event,
        employment_stability, cooperation_score, preferred_contact_time,
        onboarded_on
    ) VALUES (
        'CUST-DEMO-003', 'CONSUMER', 'Tariq Haddad',
        't.haddad@example.ae', '+971 55 903 2277', '+971580001003',
        'Consumer', 'East', 'AE', 'Abu Dhabi',
        527, 79.4, 'Critical', 0.41,
        '1 PM-4 PM', 'SMS', 'PAST_DUE',
        'Evasive', 'English', 'SMS',
        'Logistics Coordinator', 6200.00, 'Medium',
        'Medium', 'Medium', 0.52,
        'Low', 'Medium', 'Neutral', 'Salary delay',
        'Medium', 0.44, '1 PM-4 PM',
        DATE '2023-01-19'
    )
    RETURNING id
)
INSERT INTO customer_schema.debt_case (
    case_code, customer_id, case_type_code,
    summary, status, priority, risk_level, amount, predicted_payment,
    dpd, dunning_stage, opened_at, sla_breached
)
SELECT
    'CASE-DEMO-003', id, 'Dispute',
    'Repeated non-engagement; customer questions validity of balance',
    'IN_PROGRESS', 'High', 'Critical', 14900.00, 1490.00,
    122, 3, now() - INTERVAL '122 days', TRUE
FROM new_customer;

COMMIT;


-- ===========================================================================
-- Verify
-- ===========================================================================
-- SELECT d.case_code, c.full_name, d.amount, d.dpd, d.status,
--        c.behaviour_type, c.financial_stress, c.emotional_state,
--        c.monthly_income,
--        round(d.amount / NULLIF(c.monthly_income, 0), 2) AS debt_to_income
--   FROM customer_schema.debt_case d
--   JOIN customer_schema.customer c ON c.id = d.customer_id
--  WHERE d.case_code LIKE 'CASE-DEMO-%'
--  ORDER BY d.case_code;
--
-- Expected archetype after loading (the negotiator derives this, it is not
-- stored):
--   CASE-DEMO-001 -> confrontational
--   CASE-DEMO-002 -> helpless
--   CASE-DEMO-003 -> avoidant
--
-- ===========================================================================
-- Remove
-- ===========================================================================
-- DELETE FROM customer_schema.debt_case  WHERE case_code   LIKE 'CASE-DEMO-%';
-- DELETE FROM customer_schema.customer   WHERE customer_code LIKE 'CUST-DEMO-%';
