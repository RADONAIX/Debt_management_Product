-- =====================================================================================
--  003_role_permissions_json.sql
--
--  Replaces the composite-key grant tables (role_permission / user_permission)
--  with a single JSONB matrix on administration.role:
--
--      {"caseManagement": {"view": true, "edit": true}, ...}
--
--  administration.permission stays as the catalog of capability keys (it also
--  backs menu_item.permission_id). app_user keeps its plain FK to role(id).
--  Idempotent.
-- =====================================================================================

BEGIN;

ALTER TABLE administration.role
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Carry the existing grants over before the tables go away.
DO $$
BEGIN
IF EXISTS (SELECT 1 FROM pg_tables
            WHERE schemaname='administration' AND tablename='role_permission') THEN
    UPDATE administration.role r
       SET permissions = COALESCE((
           SELECT jsonb_object_agg(p.code,
                      jsonb_build_object('view', TRUE, 'edit', rp.can_edit))
             FROM administration.role_permission rp
             JOIN administration.permission p ON p.id = rp.permission_id
            WHERE rp.role_id = r.id
       ), '{}'::jsonb);
END IF;
END $$;

DROP TABLE IF EXISTS administration.user_permission;
DROP TABLE IF EXISTS administration.role_permission;

COMMIT;
