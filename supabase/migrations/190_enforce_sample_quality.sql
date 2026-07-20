-- Migration 190: Enforce sample quality after the compatibility rollout.
--
-- Security impact: removes legacy accession RPC bypasses, preserves the
-- authenticated-only quality-aware RPC grants, and rejects new samples without
-- an explicit quality assessment.
-- Historical data impact: existing NULL values are not backfilled. The guard is
-- INSERT-only, so unrelated updates to historical rows remain allowed.

BEGIN;
SET LOCAL search_path TO public, extensions;
DO $baseline$
DECLARE
    v_create_legacy REGPROCEDURE := to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)'
    );
    v_assign_legacy REGPROCEDURE := to_regprocedure(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)'
    );
    v_create_quality REGPROCEDURE := to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'
    );
    v_assign_quality REGPROCEDURE := to_regprocedure(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
    );
    v_execute_checker REGPROCEDURE := to_regprocedure(
        'public.test_security_definer_rpc_execute_privileges()'
    );
    v_search_path_checker REGPROCEDURE := to_regprocedure(
        'public.test_security_definer_rpc_search_path()'
    );
    v_analyst_role_checker REGPROCEDURE := to_regprocedure(
        'public.test_sample_accession_rpcs_require_analyst_role()'
    );
    v_create_definition TEXT;
    v_assign_definition TEXT;
    v_execute_checker_definition TEXT;
    v_search_path_checker_definition TEXT;
    v_analyst_role_checker_definition TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'samples'
          AND column_name = 'sample_quality'
          AND data_type = 'boolean'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'Migration 190 requires nullable public.samples.sample_quality';
    END IF;
    IF v_create_quality IS NULL OR v_assign_quality IS NULL THEN
        RAISE EXCEPTION 'Migration 190 requires both quality-aware accession RPCs';
    END IF;

    SELECT regexp_replace(
        pg_get_functiondef(v_create_quality),
        '[[:space:]]+',
        ' ',
        'g'
    )
    INTO v_create_definition;
    SELECT regexp_replace(
        pg_get_functiondef(v_assign_quality),
        '[[:space:]]+',
        ' ',
        'g'
    )
    INTO v_assign_definition;

    IF v_create_definition NOT ILIKE '%p_sample_quality IS NULL%'
       OR v_create_definition !~*
          'INSERT INTO public\.samples \([^;]*sample_quality[^;]*\) VALUES \([^;]*p_sample_quality'
       OR v_create_definition NOT ILIKE
          '%''sample_quality'', sample_quality%'
    THEN
        RAISE EXCEPTION
            'Migration 190 create_sample_atomic behavior baseline is invalid';
    END IF;

    IF v_assign_definition NOT ILIKE '%p_sample_quality IS NULL%'
       OR v_assign_definition !~*
          'INSERT INTO public\.samples \([^;]*sample_quality[^;]*\) VALUES \([^;]*p_sample_quality'
       OR v_assign_definition NOT ILIKE
          '%''sample_quality'', p_sample_quality%'
    THEN
        RAISE EXCEPTION
            'Migration 190 accession_and_assign_tests behavior baseline is invalid';
    END IF;

    IF v_create_legacy IS NULL OR v_assign_legacy IS NULL THEN
        RAISE EXCEPTION 'Migration 190 requires both legacy accession RPCs before removal';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE oid IN (v_create_quality, v_assign_quality)
          AND (
              NOT prosecdef
              OR NOT (
                  COALESCE(proconfig, ARRAY[]::TEXT[])
                  @> ARRAY['search_path=public, extensions']
              )
          )
    ) THEN
        RAISE EXCEPTION 'Migration 190 quality-aware RPC baseline is not hardened';
    END IF;
    IF NOT has_function_privilege(
        'authenticated', v_create_quality, 'EXECUTE'
    )
       OR NOT has_function_privilege(
           'authenticated', v_assign_quality, 'EXECUTE'
       )
       OR has_function_privilege('anon', v_create_quality, 'EXECUTE')
       OR has_function_privilege('anon', v_assign_quality, 'EXECUTE')
       OR has_function_privilege('service_role', v_create_quality, 'EXECUTE')
       OR has_function_privilege('service_role', v_assign_quality, 'EXECUTE')
    THEN
        RAISE EXCEPTION 'Migration 190 quality-aware RPC grant baseline is invalid';
    END IF;
    IF v_execute_checker IS NULL
       OR v_search_path_checker IS NULL
       OR v_analyst_role_checker IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
    THEN
        RAISE EXCEPTION 'Migration 190 requires the existing security test harness';
    END IF;

    SELECT regexp_replace(
        pg_get_functiondef(v_execute_checker),
        '[[:space:]]+',
        ' ',
        'g'
    )
    INTO v_execute_checker_definition;
    SELECT regexp_replace(
        pg_get_functiondef(v_search_path_checker),
        '[[:space:]]+',
        ' ',
        'g'
    )
    INTO v_search_path_checker_definition;
    SELECT regexp_replace(
        pg_get_functiondef(v_analyst_role_checker),
        '[[:space:]]+',
        ' ',
        'g'
    )
    INTO v_analyst_role_checker_definition;

    IF v_execute_checker_definition NOT ILIKE
           '%v_anon_denied_functions TEXT[] := ARRAY[%'
       OR v_execute_checker_definition NOT ILIKE
           '%public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)%'
       OR v_execute_checker_definition NOT ILIKE
           '%public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)%'
       OR v_execute_checker_definition NOT ILIKE
           '%public.claim_coa_report_regeneration(uuid,integer)%'
       OR v_execute_checker_definition NOT ILIKE
           '%FOREACH v_function IN ARRAY v_authenticated_functions LOOP%'
    THEN
        RAISE EXCEPTION
            'Migration 190 execute-privilege checker baseline is invalid';
    END IF;

    IF v_search_path_checker_definition NOT ILIKE
           '%p.oid::regprocedure::TEXT IN (%'
       OR v_search_path_checker_definition NOT ILIKE
           '%create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)%'
       OR v_search_path_checker_definition NOT ILIKE
           '%accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)%'
       OR v_search_path_checker_definition NOT ILIKE
           '%search_path=public, extensions%'
    THEN
        RAISE EXCEPTION
            'Migration 190 search-path checker baseline is invalid';
    END IF;

    IF v_analyst_role_checker_definition NOT ILIKE
           '%pg_get_functiondef(%create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)%'
       OR v_analyst_role_checker_definition NOT ILIKE
           '%pg_get_functiondef(%accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)%'
       OR v_analyst_role_checker_definition NOT ILIKE
           '%v_user_role <> ''analyst''%'
    THEN
        RAISE EXCEPTION
            'Migration 190 analyst-role checker baseline is invalid';
    END IF;

    IF to_regprocedure(
        'public.enforce_sample_quality_on_insert()'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.test_sample_quality_enforcement()'
       ) IS NOT NULL
       OR EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.samples'::regclass
             AND tgname = 'samples_require_quality_on_insert'
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION 'Migration 190 expected the sample quality guard to be absent';
    END IF;
END;
$baseline$;
CREATE OR REPLACE FUNCTION public.test_security_definer_rpc_execute_privileges()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_function TEXT;
    v_anon_denied_functions TEXT[] := ARRAY[
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
        'public.get_assay_definitions(text,uuid,uuid,integer,integer)',
        'public.get_assay_definition_by_id(uuid)',
        'public.get_active_qc_session(uuid)',
        'public.check_qc_approval_status(uuid[])',
        'public.get_user_email_by_username(text)',
        'public.get_active_signature(uuid)',
        'public.calculate_z_score()',
        'public.log_methodless_assignment()',
        'public.trigger_audit_log()',
        'public.queue_coa_report_for_generation(uuid,integer)',
        'public.claim_coa_report_regeneration(uuid,integer)',
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)',
        'public.fail_coa_report_generation(uuid,uuid,text,boolean)'
    ];
    v_authenticated_functions TEXT[] := ARRAY[
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
        'public.get_assay_definitions(text,uuid,uuid,integer,integer)',
        'public.get_assay_definition_by_id(uuid)',
        'public.get_active_qc_session(uuid)',
        'public.check_qc_approval_status(uuid[])',
        'public.queue_coa_report_for_generation(uuid,integer)',
        'public.claim_coa_report_regeneration(uuid,integer)',
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)',
        'public.fail_coa_report_generation(uuid,uuid,text,boolean)'
    ];
    v_service_role_functions TEXT[] := ARRAY[
        'public.get_user_email_by_username(text)',
        'public.get_active_signature(uuid)'
    ];
    v_authenticated_denied_functions TEXT[] := ARRAY[
        'public.get_user_email_by_username(text)',
        'public.get_active_signature(uuid)'
    ];
BEGIN
    FOREACH v_function IN ARRAY v_anon_denied_functions LOOP
        IF has_function_privilege('anon', v_function, 'EXECUTE') THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_authenticated_functions LOOP
        IF NOT has_function_privilege(
            'authenticated',
            v_function,
            'EXECUTE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_service_role_functions LOOP
        IF NOT has_function_privilege(
            'service_role',
            v_function,
            'EXECUTE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_authenticated_denied_functions LOOP
        IF has_function_privilege(
            'authenticated',
            v_function,
            'EXECUTE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;
CREATE OR REPLACE FUNCTION public.test_security_definer_rpc_search_path()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_missing_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_missing_count
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.oid::regprocedure::TEXT IN (
          'create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
          'accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) AS cfg
          WHERE cfg = 'search_path=public, extensions'
      );

    IF v_missing_count <> 0 THEN
        RAISE WARNING
            'SECURITY TEST FAILED: % sample accession SECURITY DEFINER RPC(s) lack fixed search_path',
            v_missing_count;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;
CREATE OR REPLACE FUNCTION public.test_sample_accession_rpcs_require_analyst_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_create_def TEXT;
    v_accession_def TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'::regprocedure
    )
    INTO v_create_def;
    SELECT pg_get_functiondef(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'::regprocedure
    )
    INTO v_accession_def;

    IF v_create_def IS NULL
       OR v_create_def NOT ILIKE '%v_user_role <> ''analyst''%'
       OR v_create_def ILIKE '%manager%' THEN
        RAISE WARNING
            'SECURITY TEST FAILED: create_sample_atomic is not analyst-only';
        RETURN FALSE;
    END IF;

    IF v_accession_def IS NULL
       OR v_accession_def NOT ILIKE '%v_user_role <> ''analyst''%'
       OR v_accession_def ILIKE '%manager%' THEN
        RAISE WARNING
            'SECURITY TEST FAILED: accession_and_assign_tests is not analyst-only';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT);
DROP FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT);
REVOKE ALL ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN) TO authenticated;
CREATE FUNCTION public.enforce_sample_quality_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    IF NEW.sample_quality IS NULL THEN
        RAISE EXCEPTION 'Sample quality is required' USING ERRCODE = '23502';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_sample_quality_on_insert()
FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER samples_require_quality_on_insert
BEFORE INSERT ON public.samples
FOR EACH ROW
EXECUTE FUNCTION public.enforce_sample_quality_on_insert();
CREATE OR REPLACE FUNCTION public.test_sample_quality_enforcement()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_create_quality REGPROCEDURE := to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'
    );
    v_assign_quality REGPROCEDURE := to_regprocedure(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
    );
    v_guard_definition TEXT;
    v_guard_trigger_definition TEXT;
    v_audit_definition TEXT;
    v_audit_trigger_definition TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'samples'
          AND column_name = 'sample_quality'
          AND data_type = 'boolean'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    )
       OR to_regprocedure(
           'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)'
       ) IS NOT NULL
       OR v_create_quality IS NULL
       OR v_assign_quality IS NULL
    THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE oid IN (v_create_quality, v_assign_quality)
          AND (
              NOT prosecdef
              OR NOT (
                  COALESCE(proconfig, ARRAY[]::TEXT[])
                  @> ARRAY['search_path=public, extensions']
              )
          )
    )
       OR NOT has_function_privilege(
           'authenticated', v_create_quality, 'EXECUTE'
       )
       OR NOT has_function_privilege(
           'authenticated', v_assign_quality, 'EXECUTE'
       )
       OR has_function_privilege('anon', v_create_quality, 'EXECUTE')
       OR has_function_privilege('anon', v_assign_quality, 'EXECUTE')
       OR has_function_privilege('service_role', v_create_quality, 'EXECUTE')
       OR has_function_privilege('service_role', v_assign_quality, 'EXECUTE')
    THEN
        RETURN FALSE;
    END IF;

    SELECT pg_get_triggerdef(t.oid), pg_get_functiondef(t.tgfoid)
    INTO v_guard_trigger_definition, v_guard_definition
    FROM pg_trigger AS t
    WHERE t.tgrelid = 'public.samples'::regclass
      AND t.tgname = 'samples_require_quality_on_insert'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D';

    IF v_guard_trigger_definition IS NULL
       OR v_guard_definition IS NULL
       OR v_guard_trigger_definition NOT ILIKE '%BEFORE INSERT ON public.samples%'
       OR v_guard_trigger_definition ILIKE '% UPDATE %'
       OR v_guard_definition NOT ILIKE '%NEW.sample_quality IS NULL%'
       OR v_guard_definition NOT ILIKE '%23502%'
       OR EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.samples'::regclass
             AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%sample_quality%'
       )
    THEN
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.samples'::regclass
          AND relrowsecurity
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.samples'::regclass
             AND polname = 'Analysts can insert own samples'
             AND polcmd = 'a'
       )
    THEN
        RETURN FALSE;
    END IF;

    SELECT pg_get_triggerdef(t.oid), pg_get_functiondef(t.tgfoid)
    INTO v_audit_trigger_definition, v_audit_definition
    FROM pg_trigger AS t
    JOIN pg_proc AS p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.samples'::regclass
      AND t.tgname = 'audit_samples_trigger'
      AND p.proname = 'trigger_audit_log'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D';

    RETURN COALESCE(
        v_audit_trigger_definition ILIKE '%AFTER%'
        AND v_audit_trigger_definition ILIKE '%INSERT%'
        AND v_audit_trigger_definition ILIKE '%UPDATE%'
        AND v_audit_trigger_definition ILIKE '%DELETE%'
        AND v_audit_definition ILIKE '%to_jsonb(NEW)%'
        AND v_audit_definition ILIKE '%changed_by%'
        AND v_audit_definition ILIKE '%auth.uid()%',
        FALSE
    );
END;
$$;
REVOKE ALL ON FUNCTION public.test_sample_quality_enforcement()
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_sample_quality_enforcement()
TO authenticated;
DO $register_security_test$
DECLARE
    v_definition TEXT;
    v_anchor TEXT :=
        '(''CoA Report Provenance Guard''::TEXT, test_coa_report_provenance_guard(), ''Verifies final CoA source binding, immutability, restrictive FK, RLS, and least-privilege queue RPC''::TEXT);';
    v_replacement TEXT :=
        '(''CoA Report Provenance Guard''::TEXT, test_coa_report_provenance_guard(), ''Verifies final CoA source binding, immutability, restrictive FK, RLS, and least-privilege queue RPC''::TEXT),'
        || E'\n        '
        || '(''Sample Quality Enforcement''::TEXT, test_sample_quality_enforcement(), ''Verifies quality-aware RPC grants, insert-only enforcement, RLS, historical NULL compatibility, and audit coverage''::TEXT);';
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;
    IF v_definition NOT LIKE '%' || v_anchor || '%'
       OR v_definition LIKE '%Sample Quality Enforcement%'
    THEN
        RAISE EXCEPTION 'Migration 190 found an unexpected run_security_tests baseline';
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
    IF to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)'
       ) IS NOT NULL
       OR NOT public.test_security_definer_rpc_execute_privileges()
       OR NOT public.test_security_definer_rpc_search_path()
       OR NOT public.test_sample_accession_rpcs_require_analyst_role()
       OR NOT public.test_sample_quality_enforcement()
       OR v_runner_definition NOT ILIKE '%Sample Quality Enforcement%'
       OR NOT EXISTS (
           SELECT 1
           FROM public.run_security_tests()
           WHERE test_name = 'Sample Quality Enforcement'
             AND passed
       )
    THEN
        RAISE EXCEPTION 'Migration 190 sample quality enforcement verification failed';
    END IF;
END;
$verification$;
COMMENT ON FUNCTION public.enforce_sample_quality_on_insert()
IS 'Rejects new samples without an explicit sample quality assessment while leaving historical updates unaffected.';
COMMENT ON FUNCTION public.test_sample_quality_enforcement()
IS 'Verifies quality-aware accession RPCs, grants, insert-only enforcement, RLS, historical NULL compatibility, and audit coverage.';
COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including sample quality enforcement coverage.';
NOTIFY pgrst, 'reload schema';
COMMIT;
