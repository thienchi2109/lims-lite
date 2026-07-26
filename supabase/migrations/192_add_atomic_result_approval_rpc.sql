-- Migration 192: Add the dark atomic result-approval RPC.
--
-- Security impact:
-- - Adds one internal SECURITY DEFINER approval command with no API-role grants.
-- - Adds one server-only wrapper executable only by service_role.
-- - Explicitly denies anon/authenticated execution so a password-only manager
--   JWT cannot bypass the existing Next.js OTP step-up guard.
-- - Preserves existing RLS policies and attributes audit triggers to the
--   manager supplied by the protected server after PostgreSQL revalidation.
--
-- Application impact:
-- - None in Phase P1. The existing single-approval action remains unchanged.
-- - The wrapper is deployed dark for the Phase P2 application refactor.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_runner_definition TEXT;
BEGIN
    IF to_regprocedure(
        'public.approve_sample_results_atomic(uuid,uuid,uuid[],text)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.approve_sample_results_server(uuid,uuid,uuid[],text)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.test_atomic_result_approval_rpc_security()'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 192 atomic approval functions already exist';
    END IF;

    IF to_regclass('public.samples') IS NULL
       OR to_regclass('public.results') IS NULL
       OR to_regclass('public.users') IS NULL
       OR to_regclass('public.assay_definitions') IS NULL
       OR to_regclass('public.qc_sessions') IS NULL
       OR to_regclass('public.audit_logs') IS NULL
       OR to_regprocedure('public.check_qc_approval_status(uuid[])') IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
       OR to_regprocedure(
           'public.test_analyst_otp_preflight_rpc_authorization()'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 192 found an incomplete approval security baseline';
    END IF;

    IF EXISTS (
        SELECT required.table_name, required.column_name
        FROM (
            VALUES
                ('samples', 'id'),
                ('samples', 'status'),
                ('samples', 'deleted_at'),
                ('samples', 'rejection_reason'),
                ('samples', 'rejected_at'),
                ('samples', 'rejected_by'),
                ('results', 'id'),
                ('results', 'sample_id'),
                ('results', 'assay_id'),
                ('results', 'status'),
                ('results', 'approved_by'),
                ('results', 'approved_at'),
                ('results', 'approval_note'),
                ('results', 'qc_session_id'),
                ('users', 'id'),
                ('users', 'role'),
                ('users', 'can_access_confidential'),
                ('users', 'deleted_at'),
                ('assay_definitions', 'id'),
                ('assay_definitions', 'is_confidential'),
                ('qc_sessions', 'id'),
                ('qc_sessions', 'qc_status')
        ) AS required(table_name, column_name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM information_schema.columns AS actual
            WHERE actual.table_schema = 'public'
              AND actual.table_name = required.table_name
              AND actual.column_name = required.column_name
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 192 found missing approval columns';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'service_role'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.results'::regclass
          AND tgname = 'audit_results_trigger'
          AND NOT tgisinternal
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::regclass
          AND tgname = 'audit_samples_trigger'
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION
            'Migration 192 found an unexpected role or audit-trigger baseline';
    END IF;

    IF NOT (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.samples'::regclass
    ) OR NOT (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.results'::regclass
    ) THEN
        RAISE EXCEPTION
            'Migration 192 requires samples and results RLS to remain enabled';
    END IF;

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    IF v_runner_definition NOT ILIKE
           '%Analyst OTP Preflight RPC Authorization%'
       OR v_runner_definition ILIKE
           '%Atomic Result Approval RPC Security%'
    THEN
        RAISE EXCEPTION
            'Migration 192 found an unexpected run_security_tests baseline';
    END IF;
END;
$baseline$;

CREATE FUNCTION public.approve_sample_results_atomic(
    p_manager_id UUID,
    p_sample_id UUID,
    p_result_ids UUID[],
    p_approval_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $core$
DECLARE
    v_manager_role public.user_role;
    v_manager_confidential BOOLEAN;
    v_sample_status public.sample_status;
    v_normalized_note TEXT;
    v_selected_count INTEGER;
    v_distinct_count INTEGER;
    v_existing_count INTEGER;
    v_mismatch_count INTEGER;
    v_locked_selected_count INTEGER := 0;
    v_entered_count INTEGER := 0;
    v_replay_count INTEGER := 0;
    v_invalid_count INTEGER := 0;
    v_qc_row_count INTEGER;
    v_qc_malformed_count INTEGER;
    v_qc_blocked_count INTEGER;
    v_updated_count INTEGER;
    v_has_confidential BOOLEAN := FALSE;
    v_sample_completed BOOLEAN;
    v_result RECORD;
    v_assay RECORD;
    v_qc_session RECORD;
BEGIN
    v_selected_count := cardinality(p_result_ids);
    v_normalized_note := CASE
        WHEN p_approval_note IS NULL OR p_approval_note = '' THEN NULL
        ELSE p_approval_note
    END;

    IF p_manager_id IS NULL
       OR p_sample_id IS NULL
       OR p_result_ids IS NULL
       OR v_selected_count IS NULL
       OR v_selected_count < 1
       OR char_length(v_normalized_note) > 500
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'REQUEST_CONFLICT'
        );
    END IF;

    SELECT COUNT(DISTINCT result_id)
    INTO v_distinct_count
    FROM unnest(p_result_ids) AS selected(result_id);

    IF v_distinct_count <> v_selected_count THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'REQUEST_CONFLICT'
        );
    END IF;

    SELECT target_user.role, target_user.can_access_confidential
    INTO v_manager_role, v_manager_confidential
    FROM public.users AS target_user
    WHERE target_user.id = p_manager_id
      AND target_user.deleted_at IS NULL
    FOR SHARE;

    IF NOT FOUND
       OR v_manager_role IS DISTINCT FROM 'manager'::public.user_role
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'MANAGER_REQUIRED'
        );
    END IF;

    SELECT sample.status
    INTO v_sample_status
    FROM public.samples AS sample
    WHERE sample.id = p_sample_id
      AND sample.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'SAMPLE_NOT_REVIEW'
        );
    END IF;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE result.sample_id <> p_sample_id)
    INTO
        v_existing_count,
        v_mismatch_count
    FROM public.results AS result
    WHERE result.id = ANY(p_result_ids);

    IF v_existing_count <> v_selected_count THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'RESULT_NOT_FOUND'
        );
    END IF;

    IF v_mismatch_count > 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'RESULT_SAMPLE_MISMATCH'
        );
    END IF;

    FOR v_result IN
        SELECT
            result.id,
            result.status,
            result.approved_by,
            result.approval_note,
            result.assay_id,
            result.qc_session_id
        FROM public.results AS result
        WHERE result.sample_id = p_sample_id
        ORDER BY result.id
        FOR UPDATE
    LOOP
        IF v_result.id = ANY(p_result_ids) THEN
            v_locked_selected_count := v_locked_selected_count + 1;

            IF v_result.status = 'entered'::public.result_status THEN
                v_entered_count := v_entered_count + 1;
            ELSIF v_result.status = 'approved'::public.result_status
                  AND v_result.approved_by = p_manager_id
                  AND v_result.approval_note IS NOT DISTINCT FROM
                      v_normalized_note
            THEN
                v_replay_count := v_replay_count + 1;
            ELSE
                v_invalid_count := v_invalid_count + 1;
            END IF;
        END IF;
    END LOOP;

    IF v_locked_selected_count <> v_selected_count THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'RESULT_NOT_FOUND'
        );
    END IF;

    IF v_replay_count = v_selected_count
       AND v_sample_status IN (
           'review'::public.sample_status,
           'completed'::public.sample_status
       )
    THEN
        SELECT NOT EXISTS (
            SELECT 1
            FROM public.results AS remaining
            WHERE remaining.sample_id = p_sample_id
              AND remaining.status <> 'approved'::public.result_status
        )
        INTO v_sample_completed;

        RETURN jsonb_build_object(
            'success', TRUE,
            'outcome_code', 'ALREADY_APPROVED',
            'approved_count', v_selected_count,
            'sample_completed', v_sample_completed,
            'replayed', TRUE
        );
    END IF;

    IF v_replay_count > 0
       OR v_invalid_count > 0
       OR v_entered_count <> v_selected_count
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'RESULT_NOT_ENTERED'
        );
    END IF;

    IF v_sample_status IS DISTINCT FROM 'review'::public.sample_status THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'SAMPLE_NOT_REVIEW'
        );
    END IF;

    FOR v_assay IN
        SELECT assay.id, assay.is_confidential
        FROM public.assay_definitions AS assay
        WHERE assay.id IN (
            SELECT result.assay_id
            FROM public.results AS result
            WHERE result.sample_id = p_sample_id
        )
        ORDER BY assay.id
        FOR SHARE
    LOOP
        v_has_confidential :=
            v_has_confidential OR COALESCE(v_assay.is_confidential, FALSE);
    END LOOP;

    IF v_has_confidential
       AND v_manager_confidential IS DISTINCT FROM TRUE
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'CONFIDENTIAL_ACCESS_REQUIRED'
        );
    END IF;

    FOR v_qc_session IN
        SELECT session.id
        FROM public.qc_sessions AS session
        WHERE session.id IN (
            SELECT result.qc_session_id
            FROM public.results AS result
            WHERE result.id = ANY(p_result_ids)
              AND result.qc_session_id IS NOT NULL
        )
        ORDER BY session.id
        FOR SHARE
    LOOP
        NULL;
    END LOOP;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (
            WHERE qc_status.can_approve IS NULL
        ),
        COUNT(*) FILTER (
            WHERE qc_status.can_approve IS FALSE
        )
    INTO
        v_qc_row_count,
        v_qc_malformed_count,
        v_qc_blocked_count
    FROM public.check_qc_approval_status(p_result_ids) AS qc_status;

    IF v_qc_row_count <> v_selected_count
       OR v_qc_malformed_count > 0
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'QC_RESPONSE_INVALID'
        );
    END IF;

    IF v_qc_blocked_count > 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'QC_BLOCKED',
            'error_params', jsonb_build_object(
                'blocked_count',
                v_qc_blocked_count
            )
        );
    END IF;

    UPDATE public.results
    SET status = 'approved'::public.result_status,
        approved_by = p_manager_id,
        approved_at = statement_timestamp(),
        approval_note = v_normalized_note
    WHERE id = ANY(p_result_ids)
      AND sample_id = p_sample_id
      AND status = 'entered'::public.result_status;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count <> v_selected_count THEN
        RAISE EXCEPTION
            'Atomic approval update count changed after locking'
            USING ERRCODE = '40001';
    END IF;

    SELECT NOT EXISTS (
        SELECT 1
        FROM public.results AS remaining
        WHERE remaining.sample_id = p_sample_id
          AND remaining.status <> 'approved'::public.result_status
    )
    INTO v_sample_completed;

    UPDATE public.samples
    SET status = CASE
            WHEN v_sample_completed
                THEN 'completed'::public.sample_status
            ELSE 'review'::public.sample_status
        END,
        rejection_reason = CASE
            WHEN v_sample_completed THEN NULL
            ELSE rejection_reason
        END,
        rejected_at = CASE
            WHEN v_sample_completed THEN NULL
            ELSE rejected_at
        END,
        rejected_by = CASE
            WHEN v_sample_completed THEN NULL
            ELSE rejected_by
        END
    WHERE id = p_sample_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'outcome_code', 'APPROVED',
        'approved_count', v_updated_count,
        'sample_completed', v_sample_completed,
        'replayed', FALSE
    );
END;
$core$;

CREATE FUNCTION public.approve_sample_results_server(
    p_manager_id UUID,
    p_sample_id UUID,
    p_result_ids UUID[],
    p_approval_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $wrapper$
DECLARE
    v_caller_role TEXT := auth.role();
    v_previous_claims TEXT :=
        current_setting('request.jwt.claims', TRUE);
    v_previous_sub TEXT :=
        current_setting('request.jwt.claim.sub', TRUE);
    v_previous_role TEXT :=
        current_setting('request.jwt.claim.role', TRUE);
    v_outcome JSONB;
BEGIN
    IF v_caller_role IS DISTINCT FROM 'service_role' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'NOT_AUTHENTICATED'
        );
    END IF;

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', p_manager_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        COALESCE(p_manager_id::TEXT, ''),
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.role',
        'authenticated',
        TRUE
    );

    BEGIN
        v_outcome := public.approve_sample_results_atomic(
            p_manager_id,
            p_sample_id,
            p_result_ids,
            p_approval_note
        );
    EXCEPTION
        WHEN OTHERS THEN
            PERFORM set_config(
                'request.jwt.claims',
                COALESCE(v_previous_claims, ''),
                TRUE
            );
            PERFORM set_config(
                'request.jwt.claim.sub',
                COALESCE(v_previous_sub, ''),
                TRUE
            );
            PERFORM set_config(
                'request.jwt.claim.role',
                COALESCE(v_previous_role, ''),
                TRUE
            );
            RAISE;
    END;

    PERFORM set_config(
        'request.jwt.claims',
        COALESCE(v_previous_claims, ''),
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        COALESCE(v_previous_sub, ''),
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.role',
        COALESCE(v_previous_role, ''),
        TRUE
    );

    RETURN v_outcome;
END;
$wrapper$;

REVOKE ALL ON FUNCTION public.approve_sample_results_atomic(
    UUID,
    UUID,
    UUID[],
    TEXT
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_sample_results_server(
    UUID,
    UUID,
    UUID[],
    TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_sample_results_server(
    UUID,
    UUID,
    UUID[],
    TEXT
) TO service_role;

CREATE FUNCTION public.test_atomic_result_approval_rpc_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $checker$
DECLARE
    v_core REGPROCEDURE := to_regprocedure(
        'public.approve_sample_results_atomic(uuid,uuid,uuid[],text)'
    );
    v_wrapper REGPROCEDURE := to_regprocedure(
        'public.approve_sample_results_server(uuid,uuid,uuid[],text)'
    );
    v_audit_function REGPROCEDURE :=
        to_regprocedure('public.trigger_audit_log()');
    v_core_definition TEXT;
    v_wrapper_definition TEXT;
    v_audit_definition TEXT;
    v_core_security_definer BOOLEAN;
    v_wrapper_security_definer BOOLEAN;
    v_core_config TEXT[];
    v_wrapper_config TEXT[];
BEGIN
    IF v_core IS NULL
       OR v_wrapper IS NULL
       OR v_audit_function IS NULL
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: atomic approval RPC or audit function is missing';
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
        v_core_definition,
        v_core_security_definer,
        v_core_config
    FROM pg_proc AS p
    WHERE p.oid = v_core;

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
        v_wrapper_definition,
        v_wrapper_security_definer,
        v_wrapper_config
    FROM pg_proc AS p
    WHERE p.oid = v_wrapper;

    SELECT regexp_replace(
        pg_get_functiondef(p.oid),
        '[[:space:]]+',
        ' ',
        'g'
    )
    INTO v_audit_definition
    FROM pg_proc AS p
    WHERE p.oid = v_audit_function;

    IF NOT v_core_security_definer
       OR NOT v_wrapper_security_definer
       OR NOT (
           COALESCE(v_core_config, ARRAY[]::TEXT[])
           @> ARRAY['search_path=public, extensions, pg_temp']
       )
       OR NOT (
           COALESCE(v_wrapper_config, ARRAY[]::TEXT[])
           @> ARRAY['search_path=public, extensions, pg_temp']
       )
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: atomic approval SECURITY DEFINER search_path is invalid';
        RETURN FALSE;
    END IF;

    IF has_function_privilege('anon', v_core, 'EXECUTE')
       OR has_function_privilege('authenticated', v_core, 'EXECUTE')
       OR has_function_privilege('service_role', v_core, 'EXECUTE')
       OR has_function_privilege('anon', v_wrapper, 'EXECUTE')
       OR has_function_privilege('authenticated', v_wrapper, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_wrapper, 'EXECUTE')
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: atomic approval function grants are invalid';
        RETURN FALSE;
    END IF;

    IF v_wrapper_definition NOT ILIKE
           '%v_caller_role TEXT := auth.role()%'
       OR v_wrapper_definition NOT ILIKE
           '%v_caller_role IS DISTINCT FROM ''service_role''%'
       OR v_wrapper_definition NOT ILIKE
           '%request.jwt.claims%'
       OR v_wrapper_definition NOT ILIKE
           '%v_previous_claims TEXT := current_setting(%'
       OR v_wrapper_definition NOT ILIKE
           '%RETURN v_outcome%'
       OR v_wrapper_definition NOT ILIKE
           '%public.approve_sample_results_atomic(%'
       OR v_core_definition NOT ILIKE
           '%v_manager_role IS DISTINCT FROM ''manager''::public.user_role%'
       OR v_core_definition NOT ILIKE
           '%ORDER BY result.id FOR UPDATE%'
       OR v_core_definition NOT ILIKE
           '%public.check_qc_approval_status(p_result_ids)%'
       OR v_core_definition NOT ILIKE
           '%CONFIDENTIAL_ACCESS_REQUIRED%'
       OR v_audit_definition NOT ILIKE '%changed_by%'
       OR v_audit_definition NOT ILIKE '%auth.uid()%'
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: atomic approval authorization or locking guard is incomplete';
        RETURN FALSE;
    END IF;

    IF NOT (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.samples'::regclass
    ) OR NOT (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.results'::regclass
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polrelid = 'public.samples'::regclass
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polrelid = 'public.results'::regclass
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::regclass
          AND tgname = 'audit_samples_trigger'
          AND tgenabled <> 'D'
          AND tgfoid = v_audit_function::OID
          AND NOT tgisinternal
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.results'::regclass
          AND tgname = 'audit_results_trigger'
          AND tgenabled <> 'D'
          AND tgfoid = v_audit_function::OID
          AND NOT tgisinternal
    ) THEN
        RAISE WARNING
            'SECURITY TEST FAILED: atomic approval RLS or audit baseline changed';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$checker$;

REVOKE ALL ON FUNCTION public.test_atomic_result_approval_rpc_security()
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_atomic_result_approval_rpc_security()
TO authenticated;

DO $register_security_test$
DECLARE
    v_definition TEXT;
    v_anchor TEXT :=
        '(''Analyst OTP Preflight RPC Authorization''::TEXT, test_analyst_otp_preflight_rpc_authorization(), ''Verifies manager/service-role authorization, fail-closed non-manager rejection, least-privilege grants, and pinned search_path''::TEXT);';
    v_replacement TEXT :=
        '(''Analyst OTP Preflight RPC Authorization''::TEXT, test_analyst_otp_preflight_rpc_authorization(), ''Verifies manager/service-role authorization, fail-closed non-manager rejection, least-privilege grants, and pinned search_path''::TEXT),'
        || E'\n        '
        || '(''Atomic Result Approval RPC Security''::TEXT, test_atomic_result_approval_rpc_security(), ''Verifies dark server-only execution, manager revalidation, deterministic locking, RLS preservation, audit triggers, grants, and pinned search_path''::TEXT);';
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;

    IF v_definition NOT LIKE '%' || v_anchor || '%'
       OR v_definition LIKE '%Atomic Result Approval RPC Security%'
    THEN
        RAISE EXCEPTION
            'Migration 192 found an unexpected run_security_tests registration baseline';
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

    IF NOT public.test_atomic_result_approval_rpc_security()
       OR v_runner_definition NOT ILIKE
           '%Atomic Result Approval RPC Security%'
       OR NOT EXISTS (
           SELECT 1
           FROM public.run_security_tests()
           WHERE test_name = 'Atomic Result Approval RPC Security'
             AND passed
       )
    THEN
        RAISE EXCEPTION
            'Migration 192 atomic approval RPC verification failed';
    END IF;
END;
$verification$;

COMMENT ON FUNCTION public.approve_sample_results_atomic(
    UUID,
    UUID,
    UUID[],
    TEXT
) IS 'Internal per-sample atomic approval command. API roles receive no EXECUTE grant.';

COMMENT ON FUNCTION public.approve_sample_results_server(
    UUID,
    UUID,
    UUID[],
    TEXT
) IS 'Dark server-only approval wrapper. Revalidates manager authority and sets the manager audit actor.';

COMMENT ON FUNCTION public.test_atomic_result_approval_rpc_security()
IS 'Verifies atomic approval authorization, deterministic locking, RLS, audit triggers, grants, and pinned search_path.';

COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including dark atomic result-approval RPC coverage.';

NOTIFY pgrst, 'reload schema';

COMMIT;
