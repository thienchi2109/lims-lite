-- Migration 200: Add authoritative approval-batch worker queue observability.
--
-- Security impact:
-- - Adds one worker-only SECURITY DEFINER RPC returning only observation time
--   and oldest eligible queue age in seconds.
-- - Keeps approval_batch_worker without direct table privileges.
-- - Revokes execution from PUBLIC and all API roles, including service_role.
-- - Registers focused verification in run_security_tests().
--
-- Application impact:
-- - Enables the existing dark worker to replace claim-saturation inference
--   with a database-authoritative queue-age gauge.
-- - Adds no UI, polling, feature enablement, deployment, or Phase P7 work.
-- - Migrations 192 through 199 remain immutable.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_claim_definition TEXT;
BEGIN
    IF to_regprocedure(
        'public.claim_approval_batch_items_worker(integer,integer)'
    ) IS NULL
       OR to_regprocedure(
           'public.execute_approval_batch_item_worker(uuid,uuid)'
       ) IS NULL
       OR to_regprocedure(
           'public.test_approval_batch_worker_security()'
       ) IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
       OR to_regclass('public.approval_batch_items') IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM pg_roles
           WHERE rolname = 'approval_batch_worker'
             AND rolcanlogin
             AND NOT rolsuper
             AND NOT rolcreaterole
             AND NOT rolcreatedb
             AND NOT rolinherit
             AND NOT rolreplication
             AND NOT rolbypassrls
       )
    THEN
        RAISE EXCEPTION
            'Migration 200 requires the applied migration 199 worker baseline';
    END IF;

    IF to_regprocedure(
        'public.get_approval_batch_worker_observability()'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.test_approval_batch_worker_observability_security()'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 200 approval-batch observability already exists';
    END IF;

    SELECT pg_get_functiondef(
        'public.claim_approval_batch_items_worker(integer,integer)'
            ::REGPROCEDURE
    )
    INTO v_claim_definition;

    IF v_claim_definition NOT ILIKE '%item.status = ''queued''%'
       OR v_claim_definition NOT ILIKE '%item.status = ''retry_wait''%'
       OR v_claim_definition NOT ILIKE
           '%item.next_attempt_at <= v_now%'
       OR v_claim_definition NOT ILIKE '%item.status = ''processing''%'
       OR v_claim_definition NOT ILIKE
           '%item.claim_expires_at <= v_now%'
       OR v_claim_definition NOT ILIKE '%item.attempt_count < 3%'
       OR NOT public.test_approval_batch_worker_security()
    THEN
        RAISE EXCEPTION
            'Migration 200 found an invalid migration 199 worker baseline';
    END IF;
END;
$baseline$;

CREATE FUNCTION public.get_approval_batch_worker_observability()
RETURNS TABLE (
    observed_at TIMESTAMPTZ,
    oldest_eligible_queue_age_seconds DOUBLE PRECISION
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
ROWS 1
AS $function$
    WITH observation AS MATERIALIZED (
        SELECT clock_timestamp() AS observed_at
    ),
    oldest_eligible AS (
        SELECT min(item.created_at) AS created_at
        FROM public.approval_batch_items AS item
        CROSS JOIN observation
        WHERE (
                item.status = 'queued'
                AND item.attempt_count = 0
            )
           OR (
                item.status = 'retry_wait'
                AND item.attempt_count < 3
                AND item.next_attempt_at <= observation.observed_at
            )
           OR (
                item.status = 'processing'
                AND item.attempt_count < 3
                AND item.claim_expires_at <= observation.observed_at
            )
    )
    SELECT
        observation.observed_at,
        COALESCE(
            GREATEST(
                0::DOUBLE PRECISION,
                extract(
                    EPOCH FROM
                    observation.observed_at - oldest_eligible.created_at
                )::DOUBLE PRECISION
            ),
            0::DOUBLE PRECISION
        ) AS oldest_eligible_queue_age_seconds
    FROM observation
    CROSS JOIN oldest_eligible;
$function$;

REVOKE ALL
ON FUNCTION public.get_approval_batch_worker_observability()
FROM PUBLIC, anon, authenticated, service_role, approval_batch_worker;

GRANT EXECUTE
ON FUNCTION public.get_approval_batch_worker_observability()
TO approval_batch_worker;

CREATE FUNCTION public.test_approval_batch_worker_observability_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_observability_function REGPROCEDURE :=
        to_regprocedure(
            'public.get_approval_batch_worker_observability()'
        );
    v_function_owner OID;
    v_worker_role OID;
    v_config TEXT[];
    v_definition TEXT;
BEGIN
    IF v_observability_function IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT function_record.proowner, function_record.proconfig
    INTO v_function_owner, v_config
    FROM pg_proc AS function_record
    WHERE function_record.oid = v_observability_function::OID
      AND function_record.prosecdef
      AND function_record.provolatile = 'v';

    SELECT role_record.oid
    INTO v_worker_role
    FROM pg_roles AS role_record
    WHERE role_record.rolname = 'approval_batch_worker';

    IF NOT FOUND
       OR v_config IS NULL
       OR NOT (
           v_config @>
           ARRAY['search_path=public, extensions, pg_temp']
       )
       OR pg_get_function_result(v_observability_function) <>
           'TABLE(observed_at timestamp with time zone, '
           || 'oldest_eligible_queue_age_seconds double precision)'
    THEN
        RETURN FALSE;
    END IF;

    IF NOT has_function_privilege(
        'approval_batch_worker',
        v_observability_function,
        'EXECUTE'
    )
       OR EXISTS (
           SELECT 1
           FROM unnest(ARRAY['anon', 'authenticated', 'service_role'])
               AS api_role(role_name)
           WHERE has_function_privilege(
               api_role.role_name,
               v_observability_function,
               'EXECUTE'
           )
       )
       OR EXISTS (
           SELECT 1
           FROM pg_proc AS function_record
           CROSS JOIN LATERAL aclexplode(
               COALESCE(
                   function_record.proacl,
                   acldefault('f', function_record.proowner)
               )
           ) AS function_acl
           WHERE function_record.oid =
               v_observability_function::OID
             AND function_acl.privilege_type = 'EXECUTE'
             AND function_acl.grantee NOT IN (
                 v_function_owner,
                 v_worker_role
             )
       )
       OR EXISTS (
           SELECT 1
           FROM pg_auth_members AS membership
           WHERE membership.roleid = v_worker_role
              OR membership.member = v_worker_role
       )
    THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(ARRAY[
            'approval_batches',
            'approval_batch_items',
            'approval_batch_item_attempts'
        ]) AS protected_table(table_name)
        CROSS JOIN unnest(ARRAY[
            'SELECT',
            'INSERT',
            'UPDATE',
            'DELETE',
            'TRUNCATE',
            'REFERENCES',
            'TRIGGER'
        ]) AS protected_privilege(privilege_name)
        WHERE has_table_privilege(
            'approval_batch_worker',
            format('public.%I', protected_table.table_name),
            protected_privilege.privilege_name
        )
    )
    THEN
        RETURN FALSE;
    END IF;

    SELECT regexp_replace(
        pg_get_functiondef(v_observability_function::OID),
        '[[:space:]]+',
        ' ',
        'g'
    )
    INTO v_definition;

    IF v_definition NOT ILIKE '%min(item.created_at)%'
       OR v_definition NOT ILIKE
           '%item.status = ''queued'' AND item.attempt_count = 0%'
       OR v_definition NOT ILIKE
           '%item.status = ''retry_wait'' '
           || 'AND item.attempt_count < 3 '
           || 'AND item.next_attempt_at <= observation.observed_at%'
       OR v_definition NOT ILIKE
           '%item.status = ''processing'' '
           || 'AND item.attempt_count < 3 '
           || 'AND item.claim_expires_at <= observation.observed_at%'
    THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING
            'Approval batch worker observability security test failed: %',
            SQLERRM;
        RETURN FALSE;
END;
$function$;

REVOKE ALL
ON FUNCTION public.test_approval_batch_worker_observability_security()
FROM PUBLIC, anon, approval_batch_worker, service_role;

GRANT EXECUTE
ON FUNCTION public.test_approval_batch_worker_observability_security()
TO authenticated;

DO $register_security_test$
DECLARE
    v_definition TEXT;
    v_anchor TEXT :=
        '(''Approval Batch Worker Security''::TEXT, '
        || 'test_approval_batch_worker_security(), '
        || '''Verifies the dedicated no-DML worker role, bounded SKIP LOCKED '
        || 'claims, item-bound execution grants, manager audit attribution, '
        || 'and pinned search_path''::TEXT);';
    v_replacement TEXT :=
        '(''Approval Batch Worker Security''::TEXT, '
        || 'test_approval_batch_worker_security(), '
        || '''Verifies the dedicated no-DML worker role, bounded SKIP LOCKED '
        || 'claims, item-bound execution grants, manager audit attribution, '
        || 'and pinned search_path''::TEXT),'
        || E'\n        '
        || '(''Approval Batch Worker Observability Security''::TEXT, '
        || 'test_approval_batch_worker_observability_security(), '
        || '''Verifies authoritative privacy-safe queue age, worker-only '
        || 'execution, no direct table access, and pinned search_path'''
        || '::TEXT);';
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;

    IF v_definition ILIKE
       '%Approval Batch Worker Observability Security%'
    THEN
        RETURN;
    END IF;

    IF v_definition NOT LIKE '%' || v_anchor || '%' THEN
        RAISE EXCEPTION
            'Migration 200 could not locate the security runner anchor';
    END IF;

    EXECUTE replace(v_definition, v_anchor, v_replacement);
END;
$register_security_test$;

DO $verification$
DECLARE
    v_observation RECORD;
    v_runner_definition TEXT;
BEGIN
    SELECT *
    INTO v_observation
    FROM public.get_approval_batch_worker_observability();

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    IF v_observation.observed_at IS NULL
       OR v_observation.oldest_eligible_queue_age_seconds < 0
       OR NOT public.test_approval_batch_worker_observability_security()
       OR v_runner_definition NOT ILIKE
           '%Approval Batch Worker Observability Security%'
    THEN
        RAISE EXCEPTION
            'Migration 200 worker observability verification failed';
    END IF;
END;
$verification$;

COMMENT ON FUNCTION public.get_approval_batch_worker_observability()
IS 'Worker-only authoritative oldest eligible approval queue age without business data.';

COMMENT ON FUNCTION public.test_approval_batch_worker_observability_security()
IS 'Verifies migration 200 queue-age semantics and least-privilege worker access.';

COMMIT;
