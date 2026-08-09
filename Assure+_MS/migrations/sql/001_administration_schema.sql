-- =====================================================================================
--  001_administration_schema.sql
--
--  Moves the auth / admin tables defined in database_setup.sql out of `public`
--  and into a dedicated `administration` schema, and extends the two grant
--  tables with the view/edit distinction the Role Management screen needs.
--
--  Idempotent: safe to re-run.
--      psql -U <owner> -d Debt_management_db -f 001_administration_schema.sql
-- =====================================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS administration;

-- ---- 1. Move the admin-owned tables ------------------------------------------------
-- Business tables (customer, account, invoice, debt_case, payment, ptp, dispute,
-- strategy, …) deliberately stay in `public`.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'role', 'permission', 'role_permission',
        'app_user', 'user_permission', 'user_session',
        'menu_item', 'audit_log', 'app_setting', 'sla_config', 'master_data'
    ]
    LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER TABLE public.%I SET SCHEMA administration', t);
            RAISE NOTICE 'moved public.% -> administration.%', t, t;
        END IF;
    END LOOP;
END $$;

-- Unqualified references (psql, reporting tools, the business tables' composite
-- FKs onto master_data) keep resolving after the move.
ALTER DATABASE "Debt_management_db" SET search_path TO public, administration;

-- ---- 2. view / edit granularity ----------------------------------------------------
-- database_setup.sql models a grant as a single row. The Role Management matrix
-- distinguishes "can see the module" from "can change things in it", so the
-- grant carries an explicit edit flag; a plain row still means view-only.
ALTER TABLE administration.role_permission
    ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE administration.user_permission
    ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill the seeded roles: administrators and operational roles may edit what
-- they can see; Finance is a read-only role by design.
UPDATE administration.role_permission rp
   SET can_edit = TRUE
  FROM administration.role r
 WHERE r.id = rp.role_id
   AND r.code IN ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'AGENT');

-- ---- 3. Permission keys the admin screens gate on ----------------------------------
-- database_setup.sql ships `adminconfig`; the API enforces finer-grained keys for
-- the two identity screens, which the UI navigation also references.
INSERT INTO administration.permission (code, name, module_group, description, sort_order)
VALUES
  ('userManagement', 'User Management', 'Administration',
   'Create, edit, deactivate and delete user accounts', 16),
  ('roleManagement', 'Role Management', 'Administration',
   'Create and edit roles and their permission matrix', 17)
ON CONFLICT (code) DO NOTHING;

-- Every role that already has admin configuration access gets them.
INSERT INTO administration.role_permission (role_id, permission_id, can_edit)
SELECT r.id, p.id, TRUE
  FROM administration.role r
  CROSS JOIN administration.permission p
 WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
   AND p.code IN ('userManagement', 'roleManagement')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
