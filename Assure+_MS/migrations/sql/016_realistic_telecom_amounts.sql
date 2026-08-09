-- =====================================================================================
--  016_realistic_telecom_amounts.sql
--
--  This is mobile / connectivity billing, not lending. Balances were generated
--  as if they were loans (AED 90k against a 15k salary), which no telecom
--  account would ever carry. Every amount is now derived from one honest
--  figure: the line's monthly recurring charge.
--
--      monthly_bill        = the plan's price
--      outstanding         = unpaid months (capped at 5) x monthly_bill
--      invoice.amount      = one month's charge
--      payment.amount      = one month's charge
--
--  A consumer therefore owes at most a few hundred to ~2k; an enterprise line
--  a few thousand; a whole company the sum of its lines. Idempotent.
-- =====================================================================================

BEGIN;

ALTER TABLE customer_schema.account
    ADD COLUMN IF NOT EXISTS monthly_bill NUMERIC(10,2);

COMMENT ON COLUMN customer_schema.account.monthly_bill IS
    'Monthly recurring charge for this line — the basis for every other amount';

-- ---- 1. Monthly charge from the plan, falling back to the product ------------------
UPDATE customer_schema.account a SET monthly_bill = COALESCE(
    -- Most plan names carry their price ("Smart 149", "Business Elite 499").
    NULLIF(regexp_replace(COALESCE(a.contract_plan, ''), '\D', '', 'g'), '')::numeric,
    CASE a.product_code
        WHEN 'Mobile Postpaid'         THEN 149
        WHEN 'Device Financing'        THEN 249
        WHEN 'Business Fibre'          THEN 599
        WHEN 'Enterprise Suite'        THEN 899
        WHEN 'MPLS'                    THEN 1200
        WHEN 'IoT Connectivity'        THEN 99
        WHEN 'Government Connectivity' THEN 750
        ELSE 199
    END)
WHERE a.monthly_bill IS NULL;

-- Guard against a silly value slipping out of a plan name.
UPDATE customer_schema.account SET monthly_bill = 199
 WHERE monthly_bill IS NULL OR monthly_bill < 25 OR monthly_bill > 2500;

-- ---- 2. Outstanding = the months actually unpaid ------------------------------------
UPDATE customer_schema.account a SET
    outstanding = round(a.monthly_bill * (
        CASE WHEN a.dpd = 0 THEN 1                       -- current month only
             ELSE LEAST(5, GREATEST(1, ceil(a.dpd / 30.0))) + 1
        END), 2),
    prior_outstanding = round(a.monthly_bill, 2),
    credit_limit = round(a.monthly_bill * 6, 2),
    target_mtd = round(a.monthly_bill * 1.2, 2);

-- ---- 3. Invoices carry one month's charge ------------------------------------------
UPDATE customer_schema.invoice i SET
    amount = round(a.monthly_bill, 2),
    tax_amount = round(a.monthly_bill * 0.05, 2),
    paid_amount = CASE WHEN i.status = 'PAID' THEN round(a.monthly_bill * 1.05, 2)
                       WHEN i.status = 'PARTIAL' THEN round(a.monthly_bill * 0.5, 2)
                       ELSE 0 END
  FROM customer_schema.account a
 WHERE a.id = i.account_id AND i.invoice_type = 'INDIVIDUAL';

-- A consolidated invoice is the sum of the lines it covers.
UPDATE customer_schema.invoice i SET
    amount = g.total,
    tax_amount = round(g.total * 0.05, 2),
    paid_amount = CASE WHEN i.status = 'PARTIAL' THEN round(g.total * 0.4, 2) ELSE 0 END
  FROM (SELECT m.invoice_id, round(sum(a.monthly_bill), 2) AS total
          FROM customer_schema.invoice_group_member m
          JOIN customer_schema.account a ON a.id = m.account_id
         GROUP BY m.invoice_id) g
 WHERE g.invoice_id = i.id;

UPDATE customer_schema.invoice_group_member m SET share_amount = a.monthly_bill
  FROM customer_schema.account a WHERE a.id = m.account_id;

-- ---- 4. Payments are monthly settlements -------------------------------------------
UPDATE customer_schema.payment p SET amount = round(a.monthly_bill * 1.05, 2)
  FROM customer_schema.account a WHERE a.id = p.account_id;

-- ---- 5. History follows the same scale ---------------------------------------------
UPDATE customer_schema.risk_history h SET
    outstanding = round(a.monthly_bill * GREATEST(1, LEAST(5, (h.dpd / 30) + 1)), 2)
  FROM customer_schema.account a WHERE a.id = h.account_id;

-- ---- 6. Cases, promises and disputes quote the corrected balance --------------------
UPDATE customer_schema.debt_case dc SET amount = a.outstanding
  FROM customer_schema.account a WHERE a.id = dc.account_id;

UPDATE customer_schema.ptp t SET
    promised_amount = round(a.outstanding * 0.6, 2),
    kept_amount = CASE WHEN t.status = 'KEPT' THEN round(a.outstanding * 0.6, 2) ELSE 0 END
  FROM customer_schema.account a WHERE a.id = t.account_id;

UPDATE customer_schema.dispute d SET amount = round(a.monthly_bill * 0.4, 2)
  FROM customer_schema.account a WHERE a.id = d.account_id;

-- ---- 7. Income must comfortably cover a phone bill ----------------------------------
UPDATE customer_schema.customer SET monthly_income = CASE
    WHEN customer_type = 'CONSUMER' THEN 4500 + (id % 16) * 950      -- 4.5k – 19.7k
    ELSE 9000 + (id % 14) * 1600                                     -- 9k – 30k
END;

COMMIT;
