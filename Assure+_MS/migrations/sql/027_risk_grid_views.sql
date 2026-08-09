-- =====================================================================================
--  027_risk_grid_views.sql  ·  Risk Grid Analysis data layer
--
--  One fact row per subscriber line, joining the tables the dashboard needs so
--  every widget aggregates from the same definition instead of each endpoint
--  re-deriving DPD buckets, behaviour or recovery probability.
--
--      customer_schema.risk_grid_account_view   per-line facts (the grain)
--      customer_schema.risk_grid_funnel_view    collection funnel stages
--      customer_schema.risk_grid_strategy_view  strategy effectiveness
--
--  Plain views, not materialised: the portfolio is tens of thousands of rows,
--  so they stay live and correct. Swap to MATERIALIZED + a refresh job when the
--  line count reaches the millions (noted at the foot).
--  Idempotent.
-- =====================================================================================

BEGIN;

CREATE OR REPLACE VIEW customer_schema.risk_grid_account_view AS
WITH engagement AS (
    SELECT a.id AS account_id,
           (SELECT count(*) FROM customer_schema.ptp t
             WHERE t.account_id = a.id) AS ptp_total,
           (SELECT count(*) FROM customer_schema.ptp t
             WHERE t.account_id = a.id AND t.status = 'KEPT') AS ptp_kept,
           (SELECT count(*) FROM customer_schema.ptp t
             WHERE t.account_id = a.id AND t.status = 'BROKEN') AS ptp_broken,
           (SELECT count(*) FROM customer_schema.dispute d
             WHERE d.account_id = a.id) AS dispute_count,
           (SELECT count(*) FROM customer_schema.case_activity ca
             WHERE ca.account_id = a.id) AS contact_events,
           (SELECT count(*) FROM customer_schema.payment p
             WHERE p.account_id = a.id
               AND p.payment_date >= CURRENT_DATE - 90) AS payments_90d,
           (SELECT COALESCE(sum(p.amount), 0) FROM customer_schema.payment p
             WHERE p.account_id = a.id
               AND p.payment_date >= CURRENT_DATE - 90) AS collected_90d,
           (SELECT dc.status FROM customer_schema.debt_case dc
             WHERE dc.account_id = a.id ORDER BY dc.opened_at DESC LIMIT 1) AS case_status
      FROM customer_schema.account a
)
SELECT
    a.id                                   AS account_id,
    a.account_code,
    a.subscriber_no,
    c.id                                   AS customer_id,
    c.customer_code,
    COALESCE(c.full_name, c.company_name, c.customer_code) AS customer_name,
    c.customer_type,
    c.segment_code                         AS segment,
    c.region_code                          AS region,
    c.credit_score,
    co.company_code,
    co.name                                AS company_name,
    b.branch_code,
    b.name                                 AS branch_name,
    ba.ban,
    a.service_type,
    a.contract_plan,
    a.monthly_bill,
    a.status                               AS account_status,
    a.outstanding,
    a.dpd,
    -- The bucket every widget filters and groups on.
    CASE WHEN a.dpd = 0 THEN '0-30'
         WHEN a.dpd <= 30 THEN '0-30'
         WHEN a.dpd <= 60 THEN '31-60'
         WHEN a.dpd <= 90 THEN '61-90'
         ELSE '90+' END                    AS dpd_bucket,
    COALESCE(rp.risk_band, a.risk_level)   AS risk_level,
    COALESCE(rp.overall_risk_score, a.risk_score) AS risk_score,
    rp.financial_stress_score,
    rp.responsibility_score,
    rp.cooperation_score,
    rp.credit_awareness_score,
    rp.legal_awareness_score,
    rp.employment_stability_score,
    a.contactability,
    a.contact_attempts,
    a.contact_successes,
    e.contact_events,
    e.ptp_total, e.ptp_kept, e.ptp_broken,
    e.dispute_count,
    e.payments_90d,
    e.collected_90d,
    e.case_status,
    a.last_contact_at,
    a.last_payment_at,
    a.next_followup_date,
    a.assigned_agent_id,
    u.full_name                            AS agent_name,
    s.strategy_code,
    s.name                                 AS strategy_name,

    -- Likelihood of collecting this balance in the next cycle. Weighted from
    -- what actually predicts payment: whether we can reach them, how overdue it
    -- is, whether past promises were honoured, and the overall risk score.
    ROUND(LEAST(100, GREATEST(0,
          0.40 * COALESCE(a.contactability, 0)
        + 0.25 * GREATEST(0, 100 - LEAST(180, a.dpd) * 100.0 / 180)
        + 0.20 * CASE WHEN e.ptp_total > 0
                      THEN e.ptp_kept * 100.0 / e.ptp_total
                      ELSE 60 END
        + 0.15 * (100 - COALESCE(rp.overall_risk_score, a.risk_score))
    ))::numeric, 1)                        AS recovery_probability,

    -- Behavioural segment. Read top to bottom: the first match wins.
    CASE
        WHEN a.dpd = 0 AND e.ptp_broken = 0                     THEN 'Reliable Payers'
        WHEN a.dpd <= 30 AND e.ptp_broken <= 1                  THEN 'Occasional Delayers'
        WHEN a.outstanding >= 2000 AND a.dpd > 30               THEN 'High Value Risk'
        -- Able to be reached but still not paying: a choice, not hardship.
        WHEN a.dpd > 30 AND (e.ptp_broken >= 2 OR a.contactability >= 60)
                                                                THEN 'Strategic Defaulters'
        WHEN a.dpd > 30                                         THEN 'Financially Distressed'
        ELSE 'Occasional Delayers'
    END                                    AS behaviour_profile
  FROM customer_schema.account a
  JOIN customer_schema.customer c        ON c.id = a.customer_id
  JOIN engagement e                      ON e.account_id = a.id
  LEFT JOIN customer_schema.risk_profile rp ON rp.account_id = a.id
  LEFT JOIN customer_schema.company_branch b ON b.id = a.branch_id
  LEFT JOIN customer_schema.company co     ON co.id = b.company_id
  LEFT JOIN customer_schema.billing_account ba ON ba.id = a.billing_account_id
  LEFT JOIN administration.app_user u      ON u.id = a.assigned_agent_id
  LEFT JOIN public.strategy s              ON s.id = a.strategy_id;

-- ---- Collection funnel --------------------------------------------------------------
CREATE OR REPLACE VIEW customer_schema.risk_grid_funnel_view AS
SELECT v.account_id, v.customer_type, v.risk_level, v.dpd_bucket, v.region,
       v.account_status, v.strategy_code, v.outstanding,
       TRUE                                   AS in_portfolio,
       (v.contact_events > 0)                 AS contacted,
       (v.ptp_total > 0)                      AS ptp_created,
       (v.payments_90d > 0)                   AS payment_received,
       (v.outstanding = 0 OR v.case_status = 'CLOSED') AS closed
  FROM customer_schema.risk_grid_account_view v;

-- ---- Strategy effectiveness ---------------------------------------------------------
-- Recovery rate = collected in the last 90 days over what was collectable
-- (collected + still outstanding) for the lines the strategy is applied to.
CREATE OR REPLACE VIEW customer_schema.risk_grid_strategy_view AS
SELECT COALESCE(v.strategy_name, 'Unassigned') AS strategy_name,
       v.strategy_code,
       count(*)                                AS accounts,
       sum(v.outstanding)                      AS outstanding,
       sum(v.collected_90d)                    AS collected_90d,
       ROUND(100.0 * sum(v.collected_90d)
             / NULLIF(sum(v.collected_90d) + sum(v.outstanding), 0), 1) AS recovery_rate,
       ROUND(avg(v.recovery_probability), 1)   AS avg_recovery_probability,
       ROUND(avg(v.risk_score), 1)             AS avg_risk_score
  FROM customer_schema.risk_grid_account_view v
 GROUP BY v.strategy_name, v.strategy_code;

-- ---- Indexes the dashboard's filters and joins rely on ------------------------------
CREATE INDEX IF NOT EXISTS idx_account_risk_dpd    ON customer_schema.account (risk_level, dpd);
CREATE INDEX IF NOT EXISTS idx_account_outstanding ON customer_schema.account (outstanding DESC);
CREATE INDEX IF NOT EXISTS idx_account_strategy    ON customer_schema.account (strategy_id);
CREATE INDEX IF NOT EXISTS idx_account_status_v    ON customer_schema.account (status);
CREATE INDEX IF NOT EXISTS idx_customer_type_region ON customer_schema.customer (customer_type, region_code);
CREATE INDEX IF NOT EXISTS idx_payment_account_date ON customer_schema.payment (account_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_ptp_account_status   ON customer_schema.ptp (account_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_account     ON customer_schema.case_activity (account_id);
CREATE INDEX IF NOT EXISTS idx_dispute_account      ON customer_schema.dispute (account_id);

GRANT SELECT ON customer_schema.risk_grid_account_view,
               customer_schema.risk_grid_funnel_view,
               customer_schema.risk_grid_strategy_view TO assure;

COMMIT;
