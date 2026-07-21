-- Migration 191: Harden analyst OTP preflight RPC authorization.
--
-- Security impact:
-- - Keeps the operational preflight available to authenticated managers.
-- - Preserves trusted service_role access.
-- - Rejects analysts, doctors, anonymous callers, and missing/invalid JWT
--   contexts before the SECURITY DEFINER query reads analyst identifiers.
-- - Registers the authorization contract in run_security_tests().
--
-- Non-goals:
-- - Does not change public.manager_otp_settings columns, grants, or RLS policies.
-- - Does not change the RPC signature or returned columns.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_rpc REGPROCEDURE :=
        to_regprocedure('public.get_confidential_analysts_missing_otp_email()');
    v_rpc_definition TEXT;
    v_is_security_definer BOOLEAN;
    v_config TEXT[];
    v_runner_definition TEXT;
BEGIN
    IF v_rpc IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
       OR to_regprocedure(
           'public.test_analyst_otp_management_prerequisites()'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 191 found an unexpected analyst OTP security baseline';
    END IF;

    SELECT
        pg_get_functiondef(p.oid),
        p.prosecdef,
        p.proconfig
    INTO
        v_rpc_definition,
        v_is_security_definer,
        v_config
    FROM pg_proc AS p
    WHERE p.oid = v_rpc;

    IF NOT v_is_security_definer
       OR NOT (
           COALESCE(v_config, ARRAY[]::TEXT[])
           @> ARRAY['search_path=public, extensions']
       )
       OR v_rpc_definition NOT ILIKE '%LANGUAGE sql%'
       OR v_rpc_definition ILIKE '%auth.role()%'
       OR v_rpc_definition ILIKE '%public.get_user_role()%'
       OR has_function_privilege('anon', v_rpc, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_rpc, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_rpc, 'EXECUTE')
    THEN
        RAISE EXCEPTION
            'Migration 191 found an unexpected OTP preflight RPC baseline';
    END IF;

    IF to_regprocedure(
        'public.test_analyst_otp_preflight_rpc_authorization()'
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 191 authorization checker already exists';
    END IF;

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    IF v_runner_definition NOT ILIKE '%Sample Quality Enforcement%'
       OR v_runner_definition ILIKE
           '%Analyst OTP Preflight RPC Authorization%'
    THEN
        RAISE EXCEPTION
            'Migration 191 found an unexpected run_security_tests baseline';
    END IF;
END;
$baseline$;

CREATE OR REPLACE FUNCTION public.get_confidential_analysts_missing_otp_email()
RETURNS TABLE(
    user_id UUID,
    username TEXT,
    full_name TEXT,
    email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_auth_role TEXT := auth.role();
    v_user_id UUID := auth.uid();
    v_user_role public.user_role;
BEGIN
    IF v_auth_role = 'service_role' THEN
        NULL;
    ELSIF v_auth_role = 'authenticated' AND v_user_id IS NOT NULL THEN
        v_user_role := public.get_user_role();

        IF v_user_role IS DISTINCT FROM 'manager'::public.user_role THEN
            RAISE EXCEPTION 'Insufficient permissions'
                USING ERRCODE = '42501';
        END IF;
    ELSE
        RAISE EXCEPTION 'Insufficient permissions'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        target_user.id AS user_id,
        target_user.username,
        target_user.full_name,
        target_user.email
    FROM public.users AS target_user
    LEFT JOIN public.manager_otp_settings AS otp_settings
        ON otp_settings.user_id = target_user.id
    WHERE target_user.role = 'analyst'::public.user_role
      AND target_user.can_access_confidential IS TRUE
      AND target_user.deleted_at IS NULL
      AND otp_settings.user_id IS NULL
    ORDER BY target_user.username;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_confidential_analysts_missing_otp_email()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_confidential_analysts_missing_otp_email()
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.test_analyst_otp_preflight_rpc_authorization()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $checker$
DECLARE
    v_rpc REGPROCEDURE :=
        to_regprocedure('public.get_confidential_analysts_missing_otp_email()');
    v_definition TEXT;
    v_is_security_definer BOOLEAN;
    v_config TEXT[];
BEGIN
    IF v_rpc IS NULL THEN
        RAISE WARNING
            'SECURITY TEST FAILED: analyst OTP preflight RPC is missing';
        RETURN FALSE;
    END IF;

    SELECT
        regexp_replace(
            pg_get_functiondef(p.oid),
            '[[:space:]]+',
            ' ',
            'g'
        ),
        p.prosecdef,
        p.proconfig
    INTO
        v_definition,
        v_is_security_definer,
        v_config
    FROM pg_proc AS p
    WHERE p.oid = v_rpc;

    IF NOT v_is_security_definer THEN
        RAISE WARNING
            'SECURITY TEST FAILED: analyst OTP preflight RPC must remain SECURITY DEFINER';
        RETURN FALSE;
    END IF;

    IF NOT (
        COALESCE(v_config, ARRAY[]::TEXT[])
        @> ARRAY['search_path=public, extensions']
    ) THEN
        RAISE WARNING
            'SECURITY TEST FAILED: analyst OTP preflight RPC search_path is not pinned';
        RETURN FALSE;
    END IF;

    IF has_function_privilege('anon', v_rpc, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_rpc, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_rpc, 'EXECUTE')
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: analyst OTP preflight RPC grants are invalid';
        RETURN FALSE;
    END IF;

    IF v_definition NOT ILIKE '%v_auth_role TEXT := auth.role()%'
       OR v_definition NOT ILIKE '%v_user_id UUID := auth.uid()%'
       OR v_definition NOT ILIKE
           '%v_user_role := public.get_user_role()%'
       OR v_definition NOT ILIKE
           '%v_auth_role = ''service_role''%'
       OR v_definition NOT ILIKE
           '%v_auth_role = ''authenticated'' AND v_user_id IS NOT NULL%'
       OR v_definition NOT ILIKE
           '%v_user_role IS DISTINCT FROM ''manager''::public.user_role%'
       OR v_definition NOT ILIKE
           '%RAISE EXCEPTION ''Insufficient permissions''%'
       OR v_definition NOT ILIKE '%ERRCODE = ''42501''%'
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: analyst OTP preflight RPC manager guard is incomplete';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$checker$;

REVOKE ALL ON FUNCTION public.test_analyst_otp_preflight_rpc_authorization()
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_analyst_otp_preflight_rpc_authorization()
TO authenticated;

DO $register_security_test$
DECLARE
    v_definition TEXT;
    v_anchor TEXT :=
        '(''Sample Quality Enforcement''::TEXT, test_sample_quality_enforcement(), ''Verifies quality-aware RPC grants, insert-only enforcement, RLS, historical NULL compatibility, and audit coverage''::TEXT);';
    v_replacement TEXT :=
        '(''Sample Quality Enforcement''::TEXT, test_sample_quality_enforcement(), ''Verifies quality-aware RPC grants, insert-only enforcement, RLS, historical NULL compatibility, and audit coverage''::TEXT),'
        || E'\n        '
        || '(''Analyst OTP Preflight RPC Authorization''::TEXT, test_analyst_otp_preflight_rpc_authorization(), ''Verifies manager/service-role authorization, fail-closed non-manager rejection, least-privilege grants, and pinned search_path''::TEXT);';
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;

    IF v_definition NOT LIKE '%' || v_anchor || '%'
       OR v_definition LIKE '%Analyst OTP Preflight RPC Authorization%'
    THEN
        RAISE EXCEPTION
            'Migration 191 found an unexpected run_security_tests registration baseline';
    END IF;

    EXECUTE replace(v_definition, v_anchor, v_replacement);
END;
$register_security_test$;

DO $verification$
DECLARE
    v_runner_definition TEXT;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    IF NOT public.test_analyst_otp_preflight_rpc_authorization()
       OR v_runner_definition NOT ILIKE
           '%Analyst OTP Preflight RPC Authorization%'
       OR NOT EXISTS (
           SELECT 1
           FROM public.run_security_tests()
           WHERE test_name = 'Analyst OTP Preflight RPC Authorization'
             AND passed
       )
    THEN
        RAISE EXCEPTION
            'Migration 191 analyst OTP preflight authorization verification failed';
    END IF;
END;
$verification$;

COMMENT ON FUNCTION public.get_confidential_analysts_missing_otp_email()
IS 'Returns confidential analysts missing OTP destinations to authenticated managers and trusted service-role callers only.';

COMMENT ON FUNCTION public.test_analyst_otp_preflight_rpc_authorization()
IS 'Verifies analyst OTP preflight authorization, grants, SECURITY DEFINER mode, and pinned search_path.';

COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including analyst OTP preflight RPC authorization coverage.';

NOTIFY pgrst, 'reload schema';

COMMIT;
