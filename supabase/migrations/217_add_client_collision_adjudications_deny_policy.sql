-- Purpose: Make the internal collision-adjudication table's deny-all RLS
-- boundary explicit so the repository security runner can verify it.
-- Security impact: No client role receives direct table access. The restrictive
-- policy keeps all direct reads and writes denied, including if a permissive
-- policy is added later without an intentional forward migration.

BEGIN;

SET LOCAL search_path TO pg_catalog, public;

DO $baseline$
BEGIN
    IF to_regclass('public.client_collision_adjudications') IS NULL THEN
        RAISE EXCEPTION
            'Migration 217 requires client_collision_adjudications';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.client_collision_adjudications'::REGCLASS
          AND relrowsecurity
    ) THEN
        RAISE EXCEPTION
            'Migration 217 requires row-level security to be enabled';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polrelid =
            'public.client_collision_adjudications'::REGCLASS
    ) THEN
        RAISE EXCEPTION
            'Migration 217 expected no existing adjudication policies';
    END IF;

    IF has_table_privilege(
        'anon',
        'public.client_collision_adjudications',
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
    )
       OR has_table_privilege(
           'authenticated',
           'public.client_collision_adjudications',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
       OR has_table_privilege(
           'service_role',
           'public.client_collision_adjudications',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
    THEN
        RAISE EXCEPTION
            'Migration 217 requires the existing direct-access revocation';
    END IF;
END;
$baseline$;

DROP POLICY IF EXISTS
    "No direct access to client collision adjudications"
ON public.client_collision_adjudications;

CREATE POLICY "No direct access to client collision adjudications"
ON public.client_collision_adjudications
AS RESTRICTIVE
FOR ALL
TO PUBLIC
USING (false)
WITH CHECK (false);

COMMENT ON POLICY
    "No direct access to client collision adjudications"
ON public.client_collision_adjudications IS
    'Deny-all boundary: lifecycle RPCs are the only supported access path.';

DO $verify$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT count(*)
    INTO v_policy_count
    FROM pg_policy AS policy
    WHERE policy.polrelid =
        'public.client_collision_adjudications'::REGCLASS;

    IF v_policy_count <> 1
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy AS policy
           WHERE policy.polrelid =
               'public.client_collision_adjudications'::REGCLASS
             AND policy.polname =
                 'No direct access to client collision adjudications'
             AND policy.polpermissive IS FALSE
             AND policy.polroles = ARRAY[0::OID]
             AND policy.polcmd = '*'
             AND pg_get_expr(policy.polqual, policy.polrelid) = 'false'
             AND pg_get_expr(policy.polwithcheck, policy.polrelid) = 'false'
       )
    THEN
        RAISE EXCEPTION
            'Migration 217 adjudication policy postcondition failed';
    END IF;

    IF has_table_privilege(
        'anon',
        'public.client_collision_adjudications',
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
    )
       OR has_table_privilege(
           'authenticated',
           'public.client_collision_adjudications',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
       OR has_table_privilege(
           'service_role',
           'public.client_collision_adjudications',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
    THEN
        RAISE EXCEPTION
            'Migration 217 changed the direct-access boundary';
    END IF;
END;
$verify$;

COMMIT;
