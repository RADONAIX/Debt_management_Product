-- =====================================================================================
--  004_app_user_deletable.sql
--
--  Deleting a user from Admin Config → User Access failed because every
--  provenance stamp (created_by / updated_by / author_id / reviewer_id) pointed
--  at app_user with ON DELETE NO ACTION, so the row could never go.
--
--  Those columns record who touched a record, not business data — when the
--  account goes, the stamp becomes NULL and the record itself is untouched.
--  Assignment columns (assigned_agent_id …) were already SET NULL; owned
--  extensions (agent_profile, agent_performance, notification, user_session)
--  already CASCADE. This only rewrites the NO ACTION ones, and only where the
--  column is nullable.
--
--  Idempotent.
-- =====================================================================================

BEGIN;

DO $$
DECLARE
    fk RECORD;
BEGIN
    FOR fk IN
        SELECT con.oid,
               con.conname,
               ns.nspname   AS schema_name,
               cl.relname   AS table_name,
               att.attname  AS column_name
          FROM pg_constraint con
          JOIN pg_class cl      ON cl.oid = con.conrelid
          JOIN pg_namespace ns  ON ns.oid = cl.relnamespace
          JOIN pg_class ref     ON ref.oid = con.confrelid
          JOIN pg_attribute att ON att.attrelid = con.conrelid
                               AND att.attnum = con.conkey[1]
         WHERE con.contype = 'f'
           AND ref.relname = 'app_user'
           AND con.confdeltype = 'a'          -- NO ACTION
           AND array_length(con.conkey, 1) = 1
           AND NOT att.attnotnull             -- can actually hold NULL
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                       fk.schema_name, fk.table_name, fk.conname);
        EXECUTE format(
            'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) '
            'REFERENCES administration.app_user(id) ON DELETE SET NULL',
            fk.schema_name, fk.table_name, fk.conname, fk.column_name);
        RAISE NOTICE 'ON DELETE SET NULL: %.%(%)',
                     fk.schema_name, fk.table_name, fk.column_name;
    END LOOP;
END $$;

COMMIT;
