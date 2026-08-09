-- =====================================================================================
--  031_prune_orphan_companies.sql
--
--  Deleting a legacy organisation through User Management removed the customer
--  but left its company, branch and BAN behind, so the picker listed 18
--  companies with no subscribers. Anything with no line under it is removed.
--  Idempotent.
-- =====================================================================================

BEGIN;

DELETE FROM customer_schema.billing_account ba
 WHERE ba.company_id IN (
    SELECT co.id FROM customer_schema.company co
     WHERE NOT EXISTS (
        SELECT 1 FROM customer_schema.account a
          JOIN customer_schema.company_branch b ON b.id = a.branch_id
         WHERE b.company_id = co.id));

DELETE FROM customer_schema.company co
 WHERE NOT EXISTS (
    SELECT 1 FROM customer_schema.account a
      JOIN customer_schema.company_branch b ON b.id = a.branch_id
     WHERE b.company_id = co.id);

COMMIT;
