-- =====================================================================================
--  002_migrate_identity_data.sql
--
--  One-off: moves the identity data the service created in its own tables
--  (public.roles / users / user_sessions / audit_logs, a JSONB permission
--  matrix per role) into the schema designed in database_setup.sql
--  (administration.role / permission / role_permission / app_user /
--  user_session / audit_log), then drops the old tables.
--
--  Mapping decisions
--    * roles      : admin -> ADMIN, supervisor -> SUPERVISOR (existing seeded
--                   roles); analyst / viewer / ml_engineer are created as new
--                   roles because database_setup.sql has no equivalent.
--    * matrices   : {key: {view, edit}} becomes one role_permission row per
--                   viewable key, with can_edit carrying the edit flag.
--    * users      : only live accounts move. Rows the administrator had already
--                   deleted are not resurrected — app_user has no soft-delete.
--    * departments: values absent from master_data are added as DEPARTMENT
--                   codes rather than dropped.
--    * sessions   : live sessions move so nobody is signed out by the migration.
--
--  Safe to re-run: every step is guarded and skips if the old tables are gone.
-- =====================================================================================

BEGIN;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users') THEN
    RAISE NOTICE 'legacy identity tables already migrated — nothing to do';
    RETURN;
END IF;

-- ---- 1. Departments referenced by migrating users ----------------------------------
INSERT INTO administration.master_data (category, code, label, sort_order, is_default)
SELECT DISTINCT 'DEPARTMENT', u.department, u.department,
       100 + row_number() OVER (ORDER BY u.department), FALSE
  FROM public.users u
 WHERE u.deleted_at IS NULL
   AND u.department IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM administration.master_data m
        WHERE m.category = 'DEPARTMENT' AND m.code = u.department
   );

-- ---- 2. Roles ----------------------------------------------------------------------
-- Legacy slug -> designed role code.
CREATE TEMP TABLE role_map (legacy_id TEXT PRIMARY KEY, code TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO role_map (legacy_id, code)
SELECT r.id,
       CASE r.id
           WHEN 'admin'      THEN 'ADMIN'
           WHEN 'supervisor' THEN 'SUPERVISOR'
           ELSE upper(regexp_replace(r.id, '[^a-zA-Z0-9]+', '_', 'g'))
       END
  FROM public.roles r;

-- Create the roles that have no counterpart in database_setup.sql.
INSERT INTO administration.role (code, name, description, is_system, status, created_at, updated_at)
SELECT m.code, r.name, COALESCE(NULLIF(r.description, ''), r.name),
       r.is_system,
       CASE WHEN lower(r.status) = 'active' THEN 'ACTIVE' ELSE 'INACTIVE' END,
       r.created_at, r.updated_at
  FROM public.roles r
  JOIN role_map m ON m.legacy_id = r.id
 WHERE NOT EXISTS (
     SELECT 1 FROM administration.role ar WHERE ar.code = m.code
 );

-- ---- 3. Permission grants from the JSONB matrices ----------------------------------
-- A key is granted when it is viewable; can_edit carries the edit flag. Keys the
-- designed permission catalog does not know are ignored.
INSERT INTO administration.role_permission (role_id, permission_id, can_edit)
SELECT ar.id, p.id, COALESCE((kv.value ->> 'edit')::boolean, FALSE)
  FROM public.roles r
  JOIN role_map m           ON m.legacy_id = r.id
  JOIN administration.role ar ON ar.code = m.code
  CROSS JOIN LATERAL jsonb_each(r.permissions) AS kv(key, value)
  JOIN administration.permission p ON p.code = kv.key
 WHERE COALESCE((kv.value ->> 'view')::boolean, FALSE)
    OR COALESCE((kv.value ->> 'edit')::boolean, FALSE)
ON CONFLICT (role_id, permission_id)
DO UPDATE SET can_edit = administration.role_permission.can_edit OR EXCLUDED.can_edit;

-- ---- 4. Users ----------------------------------------------------------------------
CREATE TEMP TABLE user_map (legacy_id TEXT PRIMARY KEY, new_id BIGINT NOT NULL) ON COMMIT DROP;

WITH inserted AS (
    INSERT INTO administration.app_user (
        email, full_name, phone, password_hash, role_id, department_code,
        auth_provider, status, failed_login_attempts, locked_until,
        last_login_at, password_changed_at, must_change_password,
        created_at, updated_at
    )
    SELECT u.email, u.full_name, u.phone, u.hashed_password, ar.id, u.department,
           'LOCAL',
           CASE WHEN lower(u.status) = 'active' THEN 'ACTIVE' ELSE 'INACTIVE' END,
           u.failed_login_count, u.locked_until,
           u.last_login, u.password_changed_at, u.must_reset_password,
           u.created_at, u.updated_at
      FROM public.users u
      JOIN role_map m             ON m.legacy_id = u.role_id
      JOIN administration.role ar ON ar.code = m.code
     WHERE u.deleted_at IS NULL
       AND NOT EXISTS (
           SELECT 1 FROM administration.app_user a WHERE a.email = u.email
       )
    RETURNING id, email
)
INSERT INTO user_map (legacy_id, new_id)
SELECT u.id, i.id FROM inserted i JOIN public.users u ON u.email = i.email;

-- ---- 5. Live sessions --------------------------------------------------------------
INSERT INTO administration.user_session (
    user_id, token_hash, issued_at, expires_at, revoked_at, ip_address, user_agent
)
SELECT um.new_id, s.refresh_jti, s.issued_at, s.expires_at, s.revoked_at,
       s.ip_address, left(s.user_agent, 255)
  FROM public.user_sessions s
  JOIN user_map um ON um.legacy_id = s.user_id
 WHERE s.revoked_at IS NULL
   AND s.expires_at > now()
ON CONFLICT (token_hash) DO NOTHING;

-- ---- 6. Audit trail ----------------------------------------------------------------
INSERT INTO administration.audit_log (
    user_id, user_name, action, entity_type, entity_id, ip_address, user_agent, created_at
)
SELECT um.new_id, a.actor, a.action, 'identity', a.target,
       a.ip_address, left(a.user_agent, 255), a.at
  FROM public.audit_logs a
  LEFT JOIN user_map um ON um.legacy_id = a.actor_id;

-- ---- 7. Retire the service's own tables --------------------------------------------
-- Renamed rather than dropped, so the migration is reversible. Once the new
-- schema has proven itself:
--     DROP TABLE public.legacy_audit_logs, public.legacy_user_sessions,
--                public.legacy_users, public.legacy_roles;
-- A plain dump also lives in Assure+_MS/backups/.
ALTER TABLE public.audit_logs    RENAME TO legacy_audit_logs;
ALTER TABLE public.user_sessions RENAME TO legacy_user_sessions;
ALTER TABLE public.users         RENAME TO legacy_users;
ALTER TABLE public.roles         RENAME TO legacy_roles;

RAISE NOTICE 'identity data migrated into the administration schema';
END $$;

COMMIT;
