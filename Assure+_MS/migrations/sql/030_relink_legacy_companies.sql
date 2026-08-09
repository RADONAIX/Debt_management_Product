-- =====================================================================================
--  030_relink_legacy_companies.sql
--
--  The legacy organisations had companies and head-office branches created for
--  them, but customer.company_id and account.branch_id came back NULL, so those
--  companies showed "0 subscribers" and their branch view was empty. Re-links
--  both, and this time verifies the result. Idempotent.
-- =====================================================================================

BEGIN;

UPDATE customer_schema.customer c SET company_id = co.id
  FROM customer_schema.company co
 WHERE co.company_code = 'COMP-L' || lpad(c.id::text, 3, '0')
   AND c.company_id IS DISTINCT FROM co.id;

UPDATE customer_schema.account a SET branch_id = b.id
  FROM customer_schema.customer c
  JOIN customer_schema.company_branch b ON b.company_id = c.company_id AND b.is_head_office
 WHERE c.id = a.customer_id
   AND a.branch_id IS NULL;

-- The BAN belongs to the organisation, not to the person on the account.
UPDATE customer_schema.billing_account ba SET company_id = c.company_id, customer_id = NULL
  FROM customer_schema.customer c
 WHERE ba.customer_id = c.id AND c.company_id IS NOT NULL;

DO $$
DECLARE orphans INT;
BEGIN
    SELECT count(*) INTO orphans
      FROM customer_schema.company co
     WHERE NOT EXISTS (
        SELECT 1 FROM customer_schema.account a
          JOIN customer_schema.company_branch b ON b.id = a.branch_id
         WHERE b.company_id = co.id);
    RAISE NOTICE 'companies still without any subscriber line: %', orphans;
END $$;

COMMIT;
