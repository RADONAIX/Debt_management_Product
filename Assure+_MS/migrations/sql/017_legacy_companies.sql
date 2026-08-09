-- =====================================================================================
--  017_legacy_companies.sql
--
--  The original demo customers that are really organisations (Retail Solutions
--  LLC, TechCorp Industries, …) had no company record, so opening one showed no
--  branch or sibling subscribers at all. Each becomes a company with a head
--  office, and its lines are attached to that branch.
--  Idempotent.
-- =====================================================================================

BEGIN;

-- ---- 1. A company per organisation-shaped legacy customer --------------------------
INSERT INTO customer_schema.company (company_code, name, industry, country_code, hq_city)
SELECT 'COMP-L' || lpad(c.id::text, 3, '0'),
       COALESCE(c.company_name, c.full_name),
       CASE c.customer_type WHEN 'GOVERNMENT' THEN 'Public Sector'
                            WHEN 'SMB' THEN 'Small & Medium Business'
                            ELSE 'Enterprise Services' END,
       COALESCE(c.country_code, 'AE'),
       COALESCE(c.city, 'Dubai')
  FROM customer_schema.customer c
 WHERE c.customer_type IN ('ENTERPRISE', 'SMB', 'GOVERNMENT')
   AND c.company_id IS NULL
   AND c.customer_code NOT LIKE 'CUST-ENT-%'
ON CONFLICT (company_code) DO NOTHING;

-- ---- 2. Head office branch for each ------------------------------------------------
INSERT INTO customer_schema.company_branch
       (company_id, branch_code, name, city, region_code, is_head_office)
SELECT co.id, 'BR-L' || lpad(co.id::text, 4, '0'),
       'Head Office', co.hq_city,
       COALESCE((SELECT c.region_code FROM customer_schema.customer c
                  WHERE 'COMP-L' || lpad(c.id::text, 3, '0') = co.company_code), 'North'),
       TRUE
  FROM customer_schema.company co
 WHERE co.company_code LIKE 'COMP-L%'
ON CONFLICT (branch_code) DO NOTHING;

-- ---- 3. Point the customer and its lines at them ------------------------------------
UPDATE customer_schema.customer c SET company_id = co.id
  FROM customer_schema.company co
 WHERE co.company_code = 'COMP-L' || lpad(c.id::text, 3, '0')
   AND c.company_id IS NULL;

UPDATE customer_schema.account a SET branch_id = b.id
  FROM customer_schema.customer c
  JOIN customer_schema.company_branch b ON b.company_id = c.company_id
 WHERE c.id = a.customer_id AND a.branch_id IS NULL AND b.is_head_office;

-- ---- 4. Their BANs belong to the company, not the person ---------------------------
UPDATE customer_schema.billing_account ba SET company_id = c.company_id, customer_id = NULL
  FROM customer_schema.customer c
 WHERE ba.customer_id = c.id AND c.company_id IS NOT NULL;

COMMIT;
