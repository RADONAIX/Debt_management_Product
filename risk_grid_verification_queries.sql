-- =====================================================================================
--  risk_grid_verification_queries.sql
--
--  One query per widget on the Risk Grid Analysis screen, mirroring exactly what
--  Assure+_MS/app/modules/riskgrid/service.py sends to Postgres.
--
--  Every widget aggregates the SAME fact view:
--      customer_schema.risk_grid_account_view   (one row per subscriber line)
--
--  The screen's filter bar becomes one shared WHERE clause. Below, each query is
--  written unfiltered (WHERE TRUE). To reproduce a filtered screen, replace
--  "WHERE TRUE" with the clauses in §0 that match what is selected in the UI.
--
--  Run any block on its own. Nothing here writes.
-- =====================================================================================


-- =====================================================================================
-- §0  THE SHARED FILTER CLAUSE  (service.py::_where)
--     Uncomment the lines matching the UI selection and paste in place of "TRUE".
-- =====================================================================================
--   AND v.customer_type   = 'CONSUMER'          -- Customer Type (upper-cased by the API)
--   AND v.risk_level      = 'High'              -- Risk Level: Low|Medium|High|Critical
--   AND v.dpd_bucket      = '31-60'             -- DPD Bucket: 0-30|31-60|61-90|90+
--   AND v.region          = 'NCR'               -- Region
--   AND v.account_status  = 'ACTIVE'            -- Account Status
--   AND COALESCE(v.strategy_name,'Unassigned') = 'Soft Reminder'   -- Strategy
--   AND v.behaviour_profile = 'Strategic Defaulters'               -- Behaviour
--   -- Date range applies to ACTIVITY, not to the account:
--   AND (v.last_contact_at >= DATE '2026-01-01' OR v.last_payment_at >= DATE '2026-01-01')
--   AND (v.last_contact_at <= DATE '2026-08-06' OR v.last_payment_at <= DATE '2026-08-06')


-- =====================================================================================
-- §0.1  SANITY: does the view exist and is it populated?
-- =====================================================================================
SELECT count(*)                             AS rows_in_view,
       count(DISTINCT v.customer_id)        AS distinct_customers,
       count(*) FILTER (WHERE v.risk_level IS NULL)          AS null_risk_level,
       count(*) FILTER (WHERE v.risk_score IS NULL)          AS null_risk_score,
       count(*) FILTER (WHERE v.outstanding IS NULL)         AS null_outstanding,
       count(*) FILTER (WHERE v.recovery_probability IS NULL) AS null_recovery_prob,
       count(*) FILTER (WHERE v.strategy_name IS NULL)       AS unassigned_strategy,
       min(v.dpd) AS min_dpd, max(v.dpd) AS max_dpd,
       min(v.risk_score) AS min_risk, max(v.risk_score) AS max_risk
  FROM customer_schema.risk_grid_account_view v;

-- Row-count reconciliation: the view must not drop or duplicate accounts.
-- engagement + customer are INNER JOINs, so a mismatch means orphaned accounts.
SELECT (SELECT count(*) FROM customer_schema.account)                    AS accounts_table,
       (SELECT count(*) FROM customer_schema.risk_grid_account_view)     AS accounts_in_view,
       (SELECT count(*) FROM customer_schema.account a
          LEFT JOIN customer_schema.customer c ON c.id = a.customer_id
         WHERE c.id IS NULL)                                             AS accounts_without_customer;


-- =====================================================================================
-- §1  KPI CARDS  (GET /risk-grid/summary)
--     Portfolio Health · Total Outstanding · Expected Recovery 30d ·
--     High-Risk Accounts · Avg Recovery Probability · Accounts / Customers
-- =====================================================================================
SELECT
  count(*)                                              AS total_accounts,
  count(DISTINCT v.customer_id)                         AS total_customers,
  COALESCE(sum(v.outstanding), 0)                       AS total_outstanding,
  COALESCE(sum(v.outstanding) FILTER (WHERE v.customer_type = 'CONSUMER'), 0)
                                                        AS consumer_outstanding,
  COALESCE(sum(v.outstanding) FILTER (WHERE v.customer_type <> 'CONSUMER'), 0)
                                                        AS enterprise_outstanding,
  -- Expected recovery: every balance weighted by its own probability.
  COALESCE(sum(v.outstanding * v.recovery_probability / 100), 0)
                                                        AS expected_recovery_30d,
  ROUND(100 * COALESCE(sum(v.outstanding * v.recovery_probability / 100), 0)
        / NULLIF(sum(v.outstanding), 0), 1)             AS expected_recovery_pct,
  COALESCE(avg(v.recovery_probability), 0)              AS avg_recovery_probability,
  count(*) FILTER (WHERE v.risk_level IN ('High','Critical'))            AS high_risk_accounts,
  COALESCE(sum(v.outstanding) FILTER (WHERE v.risk_level IN ('High','Critical')), 0)
                                                        AS high_risk_outstanding,
  -- Portfolio health 0-100: 40% currency, 25% reachability, 20% collectability, 15% risk.
  COALESCE(avg(
      0.40 * GREATEST(0, 100 - LEAST(180, v.dpd) * 100.0 / 180)
    + 0.25 * v.contactability
    + 0.20 * v.recovery_probability
    + 0.15 * (100 - v.risk_score)
  ), 0)                                                 AS portfolio_health,
  -- Last month's health from the snapshot table (drives the trend arrow).
  COALESCE((
    SELECT avg(0.40 * GREATEST(0, 100 - LEAST(180, h.dpd) * 100.0 / 180)
             + 0.60 * (100 - h.risk_score))
      FROM customer_schema.risk_history h
     WHERE h.as_of_month = date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 month'
  ), 0)                                                 AS portfolio_health_prev_month
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE;

-- 1a. Cross-check the KPI totals straight off the base table (bypasses the view).
--     total_outstanding here must equal the KPI card when no filter is applied.
SELECT count(*)                    AS accounts,
       sum(a.outstanding)          AS outstanding,
       avg(a.contactability)       AS avg_contactability,
       avg(a.dpd)                  AS avg_dpd
  FROM customer_schema.account a
  JOIN customer_schema.customer c ON c.id = a.customer_id;

-- 1b. Is the previous-month snapshot actually there? If this returns 0 rows the
--     health trend renders as 0.0 by design, not by bug.
SELECT h.as_of_month, count(*) AS accounts, avg(h.risk_score) AS avg_risk, avg(h.dpd) AS avg_dpd
  FROM customer_schema.risk_history h
 GROUP BY h.as_of_month
 ORDER BY h.as_of_month DESC
 LIMIT 6;


-- =====================================================================================
-- §2  RISK MATRIX HEATMAP  (GET /risk-grid/matrix)
--     Risk Level (rows) × DPD Bucket (columns)
-- =====================================================================================
SELECT v.risk_level, v.dpd_bucket,
       count(*)                                 AS accounts,
       count(DISTINCT v.customer_id)            AS customers,
       COALESCE(sum(v.outstanding), 0)          AS outstanding,
       COALESCE(avg(v.recovery_probability), 0) AS avg_recovery
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE
 GROUP BY v.risk_level, v.dpd_bucket
 ORDER BY CASE v.risk_level WHEN 'Critical' THEN 0 WHEN 'High' THEN 1
                            WHEN 'Medium' THEN 2 ELSE 3 END,
          CASE v.dpd_bucket WHEN '0-30' THEN 0 WHEN '31-60' THEN 1
                            WHEN '61-90' THEN 2 ELSE 3 END;

-- 2a. Matrix must sum back to the KPI card. Both columns should match §1.
SELECT sum(accounts) AS matrix_accounts, sum(outstanding) AS matrix_outstanding
  FROM (
    SELECT count(*) AS accounts, sum(v.outstanding) AS outstanding
      FROM customer_schema.risk_grid_account_view v
     WHERE TRUE
     GROUP BY v.risk_level, v.dpd_bucket
  ) m;

-- 2b. Verify the DPD bucket derivation itself — no row may land in the wrong column.
SELECT v.dpd_bucket, min(v.dpd) AS min_dpd, max(v.dpd) AS max_dpd, count(*) AS accounts
  FROM customer_schema.risk_grid_account_view v
 GROUP BY v.dpd_bucket
 ORDER BY 1;
--   Expected: 0-30 → 0..30 | 31-60 → 31..60 | 61-90 → 61..90 | 90+ → 91..∞

-- 2c. Verify the risk band matches the score cut-offs (75 / 55 / 30).
--     Rows returned here are inconsistencies between risk_profile.risk_band and the score.
SELECT v.risk_level, v.risk_score, count(*) AS accounts
  FROM customer_schema.risk_grid_account_view v
 WHERE v.risk_level <> CASE WHEN v.risk_score >= 75 THEN 'Critical'
                            WHEN v.risk_score >= 55 THEN 'High'
                            WHEN v.risk_score >= 30 THEN 'Medium'
                            ELSE 'Low' END
 GROUP BY 1, 2
 ORDER BY 3 DESC;


-- =====================================================================================
-- §3  RISK DISTRIBUTION  (GET /risk-grid/distribution)
--     Donut / bar of accounts and exposure per risk band.
-- =====================================================================================
SELECT v.risk_level,
       count(*)                                  AS accounts,
       count(DISTINCT v.customer_id)             AS customers,
       COALESCE(sum(v.outstanding), 0)           AS outstanding,
       COALESCE(avg(v.dpd), 0)                   AS avg_dpd,
       COALESCE(avg(v.recovery_probability), 0)  AS avg_recovery,
       ROUND(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 1)          AS share_pct,
       ROUND(100.0 * sum(v.outstanding)
             / NULLIF(sum(sum(v.outstanding)) OVER (), 0), 1)                 AS exposure_pct
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE
 GROUP BY v.risk_level
 ORDER BY CASE v.risk_level WHEN 'Critical' THEN 0 WHEN 'High' THEN 1
                            WHEN 'Medium' THEN 2 ELSE 3 END;
--   share_pct and exposure_pct must each total 100.0 (±0.1 from rounding).


-- =====================================================================================
-- §4  CUSTOMER BEHAVIOUR SEGMENTS  (GET /risk-grid/customer-behaviour)
-- =====================================================================================
SELECT v.behaviour_profile,
       count(*)                                  AS accounts,
       COALESCE(sum(v.outstanding), 0)           AS outstanding,
       COALESCE(avg(v.recovery_probability), 0)  AS avg_recovery,
       COALESCE(avg(v.risk_score), 0)            AS avg_risk,
       ROUND(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 1) AS share_pct
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE
 GROUP BY v.behaviour_profile
 ORDER BY sum(v.outstanding) DESC;

-- 4a. Verify the segmentation rules from the raw inputs (first match wins).
--     "recomputed" must equal "behaviour_profile" on every row.
SELECT v.behaviour_profile,
       CASE
         WHEN v.dpd = 0 AND v.ptp_broken = 0                    THEN 'Reliable Payers'
         WHEN v.dpd <= 30 AND v.ptp_broken <= 1                 THEN 'Occasional Delayers'
         WHEN v.outstanding >= 2000 AND v.dpd > 30              THEN 'High Value Risk'
         WHEN v.dpd > 30 AND (v.ptp_broken >= 2 OR v.contactability >= 60)
                                                                THEN 'Strategic Defaulters'
         WHEN v.dpd > 30                                        THEN 'Financially Distressed'
         ELSE 'Occasional Delayers'
       END                                       AS recomputed,
       count(*)                                  AS accounts,
       round(avg(v.dpd), 1)                      AS avg_dpd,
       round(avg(v.ptp_broken), 2)               AS avg_broken_ptp,
       round(avg(v.contactability), 1)           AS avg_contactability,
       round(avg(v.outstanding), 2)              AS avg_outstanding
  FROM customer_schema.risk_grid_account_view v
 GROUP BY 1, 2
 ORDER BY 1;
--   Any row where behaviour_profile <> recomputed is a defect.


-- =====================================================================================
-- §5  RISK MIGRATION  (GET /risk-grid/migration)
--     Movement between bands, last month → this month, from risk_history.
-- =====================================================================================
WITH banded AS (
    SELECT h.account_id, h.as_of_month,
           CASE WHEN h.risk_score >= 75 THEN 'Critical'
                WHEN h.risk_score >= 55 THEN 'High'
                WHEN h.risk_score >= 30 THEN 'Medium'
                ELSE 'Low' END AS band
      FROM customer_schema.risk_history h
     WHERE h.as_of_month >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
),
moves AS (
    SELECT prev.account_id, prev.band AS from_band, cur.band AS to_band
      FROM banded prev
      JOIN banded cur
        ON cur.account_id = prev.account_id
       AND cur.as_of_month = date_trunc('month', CURRENT_DATE)::date
     WHERE prev.as_of_month = (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
)
SELECT m.from_band, m.to_band,
       count(*)                        AS accounts,
       COALESCE(sum(v.outstanding), 0) AS outstanding,
       CASE WHEN m.from_band = m.to_band THEN 'stable'
            WHEN (CASE m.to_band   WHEN 'Low' THEN 0 WHEN 'Medium' THEN 1
                                   WHEN 'High' THEN 2 ELSE 3 END)
               > (CASE m.from_band WHEN 'Low' THEN 0 WHEN 'Medium' THEN 1
                                   WHEN 'High' THEN 2 ELSE 3 END)
            THEN 'deteriorated' ELSE 'improved' END AS direction
  FROM moves m
  JOIN customer_schema.risk_grid_account_view v ON v.account_id = m.account_id
 WHERE TRUE
 GROUP BY m.from_band, m.to_band
 ORDER BY 1, 2;

-- 5a. Migration is empty unless BOTH months exist in risk_history. Check coverage first.
SELECT date_trunc('month', CURRENT_DATE)::date                            AS this_month,
       (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date     AS last_month,
       count(*) FILTER (WHERE h.as_of_month = date_trunc('month', CURRENT_DATE)::date)
                                                                          AS rows_this_month,
       count(*) FILTER (WHERE h.as_of_month
                        = (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date)
                                                                          AS rows_last_month,
       count(DISTINCT h.account_id)                                       AS accounts_covered
  FROM customer_schema.risk_history h;

-- 5b. Accounts present this month but missing last month — silently excluded from the chart.
SELECT count(*) AS accounts_missing_prior_month
  FROM customer_schema.risk_history cur
 WHERE cur.as_of_month = date_trunc('month', CURRENT_DATE)::date
   AND NOT EXISTS (
       SELECT 1 FROM customer_schema.risk_history prv
        WHERE prv.account_id = cur.account_id
          AND prv.as_of_month = (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date);


-- =====================================================================================
-- §6  RISK DRIVERS  (GET /risk-grid/drivers)
--     Weighted contribution of each score component. Two parts: weights, then averages.
-- =====================================================================================
-- 6a. The configured weights.
SELECT code, weight_pct
  FROM administration.risk_score_definition
 ORDER BY weight_pct DESC;
--   These should total 100.

-- 6b. Component averages over the filtered slice.
SELECT COALESCE(avg(v.financial_stress_score), 0)      AS financial_stress,
       count(v.financial_stress_score)                 AS financial_stress_n,
       COALESCE(avg(v.responsibility_score), 0)        AS responsibility,
       count(v.responsibility_score)                   AS responsibility_n,
       COALESCE(avg(v.cooperation_score), 0)           AS cooperation,
       count(v.cooperation_score)                      AS cooperation_n,
       COALESCE(avg(v.credit_awareness_score), 0)      AS credit_awareness,
       count(v.credit_awareness_score)                 AS credit_awareness_n,
       COALESCE(avg(v.legal_awareness_score), 0)       AS legal_awareness,
       count(v.legal_awareness_score)                  AS legal_awareness_n,
       COALESCE(avg(v.employment_stability_score), 0)  AS employment_stability,
       count(v.employment_stability_score)             AS employment_stability_n
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE;

-- 6c. The full driver chart in one query — average, weight, and % contribution,
--     matching the API's arithmetic (higher-is-better components contribute their
--     complement; financial stress contributes directly).
WITH avgs AS (
    SELECT COALESCE(avg(v.financial_stress_score), 0)     AS financial_stress,
           COALESCE(avg(v.responsibility_score), 0)       AS responsibility,
           COALESCE(avg(v.cooperation_score), 0)          AS cooperation,
           COALESCE(avg(v.credit_awareness_score), 0)     AS credit_awareness,
           COALESCE(avg(v.legal_awareness_score), 0)      AS legal_awareness,
           COALESCE(avg(v.employment_stability_score), 0) AS employment_stability,
           count(v.financial_stress_score)     AS n_financial_stress,
           count(v.responsibility_score)       AS n_responsibility,
           count(v.cooperation_score)          AS n_cooperation,
           count(v.credit_awareness_score)     AS n_credit_awareness,
           count(v.legal_awareness_score)      AS n_legal_awareness,
           count(v.employment_stability_score) AS n_employment_stability
      FROM customer_schema.risk_grid_account_view v
     WHERE TRUE
),
comp AS (
    SELECT 'Financial Stress'     AS driver, 'financial_stress'     AS code,
           financial_stress     AS avg_score, financial_stress            AS risk_contrib,
           n_financial_stress     AS accounts FROM avgs
    UNION ALL SELECT 'Responsibility',       'responsibility',
           responsibility,       100 - responsibility,       n_responsibility       FROM avgs
    UNION ALL SELECT 'Cooperation',          'cooperation',
           cooperation,          100 - cooperation,          n_cooperation          FROM avgs
    UNION ALL SELECT 'Credit Awareness',     'credit_awareness',
           credit_awareness,     100 - credit_awareness,     n_credit_awareness     FROM avgs
    UNION ALL SELECT 'Legal Awareness',      'legal_awareness',
           legal_awareness,      100 - legal_awareness,      n_legal_awareness      FROM avgs
    UNION ALL SELECT 'Employment Stability', 'employment_stability',
           employment_stability, 100 - employment_stability, n_employment_stability FROM avgs
),
weighted AS (
    SELECT c.driver, round(c.avg_score::numeric, 1) AS avg_score,
           COALESCE(d.weight_pct, 0)               AS weight_pct,
           c.risk_contrib * COALESCE(d.weight_pct, 0) AS weighted,
           c.accounts
      FROM comp c
      LEFT JOIN administration.risk_score_definition d ON d.code = c.code
)
SELECT driver, avg_score, weight_pct, accounts,
       round((100 * weighted / NULLIF(sum(weighted) OVER (), 0))::numeric, 1) AS contribution_pct
  FROM weighted
 ORDER BY contribution_pct DESC;
--   contribution_pct totals 100. A driver with weight_pct = 0 means the component
--   code is missing from administration.risk_score_definition.


-- =====================================================================================
-- §7  STRATEGY EFFECTIVENESS  (GET /risk-grid/strategies)
-- =====================================================================================
SELECT COALESCE(v.strategy_name, 'Unassigned') AS strategy,
       v.strategy_code,
       count(*)                                AS accounts,
       COALESCE(sum(v.outstanding), 0)         AS outstanding,
       COALESCE(sum(v.collected_90d), 0)       AS collected_90d,
       ROUND(100.0 * sum(v.collected_90d)
             / NULLIF(sum(v.collected_90d) + sum(v.outstanding), 0), 1) AS recovery_rate,
       COALESCE(avg(v.recovery_probability), 0) AS avg_recovery_probability
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE
 GROUP BY 1, 2
 ORDER BY recovery_rate DESC NULLS LAST;

-- 7a. Cross-check against the pre-built strategy view (unfiltered only — must match).
SELECT * FROM customer_schema.risk_grid_strategy_view ORDER BY recovery_rate DESC NULLS LAST;

-- 7b. collected_90d traced to source payments. Totals must equal §7's collected_90d.
SELECT COALESCE(s.name, 'Unassigned') AS strategy,
       count(DISTINCT a.id)           AS accounts,
       COALESCE(sum(p.amount), 0)     AS collected_last_90d,
       min(p.payment_date)            AS earliest_payment,
       max(p.payment_date)            AS latest_payment
  FROM customer_schema.account a
  LEFT JOIN public.strategy s ON s.id = a.strategy_id
  LEFT JOIN customer_schema.payment p
         ON p.account_id = a.id AND p.payment_date >= CURRENT_DATE - 90
 GROUP BY 1
 ORDER BY 3 DESC;


-- =====================================================================================
-- §8  COLLECTION FUNNEL  (GET /risk-grid/funnel)
--     Portfolio → Contacted → PTP Created → Payment Received → Closed
-- =====================================================================================
SELECT count(*)                                          AS portfolio_accounts,
       COALESCE(sum(v.outstanding), 0)                   AS portfolio_amount,
       count(*) FILTER (WHERE v.contact_events > 0)      AS contacted_accounts,
       COALESCE(sum(v.outstanding) FILTER (WHERE v.contact_events > 0), 0)
                                                         AS contacted_amount,
       count(*) FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0)
                                                         AS ptp_accounts,
       COALESCE(sum(v.outstanding)
                FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0), 0)
                                                         AS ptp_amount,
       count(*) FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0
                          AND v.payments_90d > 0)        AS paid_accounts,
       COALESCE(sum(v.collected_90d)
                FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0
                          AND v.payments_90d > 0), 0)    AS paid_amount,
       count(*) FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0
                          AND v.payments_90d > 0
                          AND (v.outstanding = 0 OR v.case_status = 'CLOSED'))
                                                         AS closed_accounts,
       COALESCE(sum(v.collected_90d) FILTER (WHERE v.outstanding = 0), 0)
                                                         AS closed_amount
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE;

-- 8a. Same funnel pivoted into rows with the conversion percentages the UI shows.
WITH f AS (
  SELECT count(*)                                                          AS portfolio,
         COALESCE(sum(v.outstanding), 0)                                   AS portfolio_amt,
         count(*) FILTER (WHERE v.contact_events > 0)                      AS contacted,
         COALESCE(sum(v.outstanding) FILTER (WHERE v.contact_events > 0), 0) AS contacted_amt,
         count(*) FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0)  AS ptp,
         COALESCE(sum(v.outstanding)
                  FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0), 0) AS ptp_amt,
         count(*) FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0
                            AND v.payments_90d > 0)                        AS paid,
         COALESCE(sum(v.collected_90d)
                  FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0
                            AND v.payments_90d > 0), 0)                    AS paid_amt,
         count(*) FILTER (WHERE v.contact_events > 0 AND v.ptp_total > 0
                            AND v.payments_90d > 0
                            AND (v.outstanding = 0 OR v.case_status = 'CLOSED')) AS closed,
         COALESCE(sum(v.collected_90d) FILTER (WHERE v.outstanding = 0), 0) AS closed_amt
    FROM customer_schema.risk_grid_account_view v
   WHERE TRUE
),
stages AS (
  SELECT 1 AS ord, 'Total Portfolio'  AS stage, portfolio AS accounts, portfolio_amt AS amount, portfolio AS prev, portfolio AS total FROM f
  UNION ALL SELECT 2, 'Contacted',        contacted, contacted_amt, portfolio, portfolio FROM f
  UNION ALL SELECT 3, 'PTP Created',      ptp,       ptp_amt,       contacted, portfolio FROM f
  UNION ALL SELECT 4, 'Payment Received', paid,      paid_amt,      ptp,       portfolio FROM f
  UNION ALL SELECT 5, 'Closed',           closed,    closed_amt,    paid,      portfolio FROM f
)
SELECT stage, accounts, amount,
       round(100.0 * accounts / NULLIF(prev, 0), 1)  AS conversion_pct,
       round(100.0 * accounts / NULLIF(total, 0), 1) AS of_portfolio_pct
  FROM stages ORDER BY ord;
--   Stage counts must be monotonically non-increasing; each stage is a strict
--   subset of the one above it. NOTE: closed_amount is deliberately measured over
--   all zero-balance lines, so it need not be a subset of paid_amount.

-- 8b. Funnel inputs traced to source tables.
SELECT (SELECT count(DISTINCT account_id) FROM customer_schema.case_activity) AS accts_with_activity,
       (SELECT count(DISTINCT account_id) FROM customer_schema.ptp)           AS accts_with_ptp,
       (SELECT count(DISTINCT account_id) FROM customer_schema.payment
         WHERE payment_date >= CURRENT_DATE - 90)                             AS accts_paid_90d,
       (SELECT count(*) FROM customer_schema.account WHERE outstanding = 0)   AS accts_zero_balance,
       (SELECT count(*) FROM customer_schema.debt_case WHERE status = 'CLOSED') AS closed_cases;


-- =====================================================================================
-- §9  PRIORITY TARGETS TABLE  (GET /risk-grid/priority-targets)
--     Ranked by money at risk = outstanding × (100 − recovery probability) / 100.
-- =====================================================================================
SELECT ROW_NUMBER() OVER (ORDER BY v.outstanding * (100 - v.recovery_probability) / 100 DESC)
                                                                    AS rank,
       v.customer_code, v.customer_name, v.customer_type,
       v.account_code, v.subscriber_no,
       v.outstanding, v.dpd, v.risk_level, v.behaviour_profile,
       v.recovery_probability,
       COALESCE(v.strategy_name,
                CASE WHEN v.dpd > 90 THEN 'Legal Escalation'
                     WHEN v.dpd > 60 THEN 'Settlement Offer'
                     WHEN v.dpd > 30 AND COALESCE(v.contactability, 0) >= 55 THEN 'Dialer + SMS'
                     WHEN v.dpd > 30 THEN 'Installment Plan'
                     WHEN v.dpd > 0  THEN 'SMS Reminder'
                     ELSE 'Monitor' END)                            AS recommended_strategy,
       v.last_contact_at, v.next_followup_date,
       ROUND((v.outstanding * (100 - v.recovery_probability) / 100)::numeric, 2)
                                                                    AS priority_score
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE
 ORDER BY priority_score DESC
 LIMIT 10 OFFSET 0;

-- 9a. The paging total shown beside the table.
SELECT count(*) AS total_rows
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE;

-- 9b. With the search box filled (the API lower-cases and wraps in %…%).
SELECT v.customer_code, v.customer_name, v.account_code, v.subscriber_no, v.outstanding
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE
   AND (lower(v.customer_name) LIKE lower('%acme%')
     OR lower(v.account_code)  LIKE lower('%acme%')
     OR lower(COALESCE(v.subscriber_no, '')) LIKE lower('%acme%'))
 ORDER BY v.outstanding * (100 - v.recovery_probability) / 100 DESC
 LIMIT 10;


-- =====================================================================================
-- §10  ENTERPRISE EXPOSURE TREE  (GET /risk-grid/enterprise-exposure)
--      Company → Branch → BAN → Account. Only lines with a company are in scope.
-- =====================================================================================
-- 10a. Top level: companies (what loads first).
SELECT v.company_code                        AS id,
       max(v.company_name)                   AS name,
       count(*)                              AS accounts,
       COALESCE(sum(v.outstanding), 0)       AS outstanding,
       COALESCE(avg(v.dpd), 0)               AS avg_dpd,
       COALESCE(avg(v.recovery_probability), 0) AS recovery_probability,
       COALESCE(max(v.risk_score), 0)        AS worst_risk_score,
       CASE WHEN max(v.risk_score) >= 75 THEN 'Critical'
            WHEN max(v.risk_score) >= 55 THEN 'High'
            WHEN max(v.risk_score) >= 30 THEN 'Medium'
            ELSE 'Low' END                   AS risk_level
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE
   AND v.company_code IS NOT NULL
 GROUP BY v.company_code
 ORDER BY outstanding DESC;

-- 10b. Drill-down for one company: branches, BANs and accounts.
--      Replace 'COMP001' with the company_code being expanded.
SELECT 'branch' AS level, v.branch_code AS id, max(v.branch_name) AS name,
       max(v.company_code) AS parent_id, count(*) AS accounts,
       COALESCE(sum(v.outstanding), 0) AS outstanding,
       round(COALESCE(avg(v.dpd), 0), 1) AS avg_dpd,
       round(COALESCE(avg(v.recovery_probability), 0), 1) AS recovery_probability,
       COALESCE(max(v.risk_score), 0) AS worst_risk_score
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE AND v.company_code = 'COMP001' AND v.branch_code IS NOT NULL
 GROUP BY v.branch_code
UNION ALL
SELECT 'ban', v.ban, max(v.ban), max(v.branch_code), count(*),
       COALESCE(sum(v.outstanding), 0), round(COALESCE(avg(v.dpd), 0), 1),
       round(COALESCE(avg(v.recovery_probability), 0), 1), COALESCE(max(v.risk_score), 0)
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE AND v.company_code = 'COMP001' AND v.ban IS NOT NULL
 GROUP BY v.ban
UNION ALL
SELECT 'account', v.account_code, max(v.customer_name), max(v.ban), count(*),
       COALESCE(sum(v.outstanding), 0), round(COALESCE(avg(v.dpd), 0), 1),
       round(COALESCE(avg(v.recovery_probability), 0), 1), COALESCE(max(v.risk_score), 0)
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE AND v.company_code = 'COMP001' AND v.account_code IS NOT NULL
 GROUP BY v.account_code
 ORDER BY 1, 6 DESC;

-- 10c. Hierarchy integrity: branches without a company, BANs without a branch,
--      enterprise lines with no company attached at all.
SELECT count(*) FILTER (WHERE v.customer_type <> 'CONSUMER' AND v.company_code IS NULL)
           AS enterprise_lines_without_company,
       count(*) FILTER (WHERE v.company_code IS NOT NULL AND v.branch_code IS NULL)
           AS company_lines_without_branch,
       count(*) FILTER (WHERE v.branch_code IS NOT NULL AND v.ban IS NULL)
           AS branch_lines_without_ban
  FROM customer_schema.risk_grid_account_view v;

-- 10d. Enterprise tree total must reconcile with the KPI card's enterprise outstanding.
SELECT COALESCE(sum(v.outstanding) FILTER (WHERE v.company_code IS NOT NULL), 0) AS tree_total,
       COALESCE(sum(v.outstanding) FILTER (WHERE v.customer_type <> 'CONSUMER'), 0) AS kpi_enterprise_total
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE;


-- =====================================================================================
-- §11  RECOMMENDED ACTION PANEL  (GET /risk-grid/recommendation)
--      The API picks the action in Python from these six aggregates.
-- =====================================================================================
SELECT count(*)                                 AS coverage_accounts,
       COALESCE(sum(v.outstanding), 0)          AS outstanding,
       COALESCE(avg(v.dpd), 0)                  AS avg_dpd,
       COALESCE(avg(v.contactability), 0)       AS avg_contactability,
       COALESCE(avg(v.recovery_probability), 0) AS avg_recovery,
       COALESCE(avg(v.ptp_broken), 0)           AS avg_broken_ptp,
       COALESCE(avg(v.dispute_count), 0)        AS avg_disputes,
       -- The decision tree, reproduced so you can verify the panel's text.
       CASE WHEN COALESCE(avg(v.dpd), 0) > 90 THEN 'Escalate to legal / agency allocation'
            WHEN COALESCE(avg(v.dpd), 0) > 60 THEN 'Settlement offer with supervisor call'
            WHEN COALESCE(avg(v.dpd), 0) > 30 AND COALESCE(avg(v.contactability), 0) >= 55
                 THEN 'Prioritise dialer + SMS reminder'
            WHEN COALESCE(avg(v.dpd), 0) > 30 THEN 'Offer an instalment plan via WhatsApp'
            WHEN COALESCE(avg(v.dispute_count), 0) > 0.5 THEN 'Resolve disputes before collecting'
            ELSE 'Automated reminder cycle' END AS expected_action
  FROM customer_schema.risk_grid_account_view v
 WHERE TRUE;


-- =====================================================================================
-- §12  FILTER BAR DROPDOWNS  (GET /risk-grid/options)
--      Risk levels and DPD buckets are hard-coded in the API; the rest come from data.
-- =====================================================================================
SELECT DISTINCT v.customer_type   AS v FROM customer_schema.risk_grid_account_view v
 WHERE v.customer_type IS NOT NULL ORDER BY 1;

SELECT DISTINCT v.region          AS v FROM customer_schema.risk_grid_account_view v
 WHERE v.region IS NOT NULL ORDER BY 1;

SELECT DISTINCT v.account_status  AS v FROM customer_schema.risk_grid_account_view v
 WHERE v.account_status IS NOT NULL ORDER BY 1;

SELECT DISTINCT COALESCE(v.strategy_name, 'Unassigned') AS v
  FROM customer_schema.risk_grid_account_view v ORDER BY 1;

SELECT DISTINCT v.behaviour_profile AS v FROM customer_schema.risk_grid_account_view v
 WHERE v.behaviour_profile IS NOT NULL ORDER BY 1;
--   Hard-coded in the API (should be covered by the data above):
--     riskLevels = Low, Medium, High, Critical
--     dpdBuckets = 0-30, 31-60, 61-90, 90+


-- =====================================================================================
-- §13  DERIVED-FIELD AUDIT
--      Recovery probability is computed in the view and drives the KPI cards, the
--      matrix, behaviour, strategies and the priority ranking. Verify it here.
-- =====================================================================================
SELECT v.account_code,
       v.contactability, v.dpd, v.ptp_total, v.ptp_kept, v.risk_score,
       v.recovery_probability                       AS stored,
       ROUND(LEAST(100, GREATEST(0,
             0.40 * COALESCE(v.contactability, 0)
           + 0.25 * GREATEST(0, 100 - LEAST(180, v.dpd) * 100.0 / 180)
           + 0.20 * CASE WHEN v.ptp_total > 0 THEN v.ptp_kept * 100.0 / v.ptp_total ELSE 60 END
           + 0.15 * (100 - v.risk_score)
       ))::numeric, 1)                              AS recomputed
  FROM customer_schema.risk_grid_account_view v
 WHERE ROUND(LEAST(100, GREATEST(0,
             0.40 * COALESCE(v.contactability, 0)
           + 0.25 * GREATEST(0, 100 - LEAST(180, v.dpd) * 100.0 / 180)
           + 0.20 * CASE WHEN v.ptp_total > 0 THEN v.ptp_kept * 100.0 / v.ptp_total ELSE 60 END
           + 0.15 * (100 - v.risk_score)
       ))::numeric, 1) <> v.recovery_probability
 LIMIT 50;
--   Should return zero rows.

-- 13a. Out-of-range values that would distort every average on the screen.
SELECT count(*) FILTER (WHERE v.contactability        < 0 OR v.contactability        > 100) AS bad_contactability,
       count(*) FILTER (WHERE v.risk_score            < 0 OR v.risk_score            > 100) AS bad_risk_score,
       count(*) FILTER (WHERE v.recovery_probability  < 0 OR v.recovery_probability  > 100) AS bad_recovery_prob,
       count(*) FILTER (WHERE v.dpd < 0)                                                    AS negative_dpd,
       count(*) FILTER (WHERE v.outstanding < 0)                                            AS negative_outstanding,
       count(*) FILTER (WHERE v.ptp_kept + v.ptp_broken > v.ptp_total)                      AS ptp_status_mismatch,
       count(*) FILTER (WHERE v.contact_successes > v.contact_attempts)                     AS contact_mismatch
  FROM customer_schema.risk_grid_account_view v;

-- 13b. Accounts with no risk_profile row — these fall back to account.risk_score /
--      risk_level and have NULL score components, so they are silently absent from
--      the Risk Drivers chart (§6) while still counting everywhere else.
SELECT count(*) AS accounts_without_risk_profile
  FROM customer_schema.account a
 WHERE NOT EXISTS (SELECT 1 FROM customer_schema.risk_profile rp WHERE rp.account_id = a.id);
