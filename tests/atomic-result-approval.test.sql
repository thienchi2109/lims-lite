-- ATOMIC RESULT APPROVAL RUNTIME AND SECURITY CONTRACT
-- Run after migration 192 through the approved home-server Docker path.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE atomic_approval_assertions (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE atomic_approval_outcomes (
    test_name TEXT PRIMARY KEY,
    outcome JSONB NOT NULL
) ON COMMIT DROP;

GRANT SELECT, INSERT ON atomic_approval_assertions
TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON atomic_approval_outcomes TO service_role;

CREATE FUNCTION pg_temp.assert_atomic(
    p_name TEXT,
    p_passed BOOLEAN,
    p_detail TEXT
) RETURNS VOID
LANGUAGE sql
AS $$
    INSERT INTO atomic_approval_assertions
    VALUES (p_name, COALESCE(p_passed, FALSE), p_detail);
$$;

CREATE FUNCTION pg_temp.assert_outcome(
    p_name TEXT,
    p_outcome JSONB,
    p_expected_code TEXT
) RETURNS VOID
LANGUAGE sql
AS $$
    INSERT INTO atomic_approval_assertions
    VALUES (
        p_name,
        p_outcome->>'outcome_code' = p_expected_code,
        p_outcome::TEXT
    );
$$;

DO $contract$
DECLARE
    v_core REGPROCEDURE := to_regprocedure(
        'public.approve_sample_results_atomic(uuid,uuid,uuid[],text)'
    );
    v_wrapper REGPROCEDURE := to_regprocedure(
        'public.approve_sample_results_server(uuid,uuid,uuid[],text)'
    );
    v_core_definition TEXT;
BEGIN
    IF v_core IS NULL OR v_wrapper IS NULL THEN
        RAISE EXCEPTION 'Migration 192 atomic approval functions are missing';
    END IF;

    SELECT regexp_replace(
        pg_get_functiondef(v_core),
        '[[:space:]]+',
        ' ',
        'g'
    ) INTO v_core_definition;

    PERFORM pg_temp.assert_atomic(
        'deterministic row locking',
        v_core_definition ILIKE
            '%FROM public.samples AS sample%FOR UPDATE%'
        AND v_core_definition ILIKE
            '%ORDER BY result.id%FOR UPDATE%',
        'sample and all sample results must be locked deterministically'
    );
    PERFORM pg_temp.assert_atomic(
        'QC response is fail-closed',
        v_core_definition ILIKE
            '%v_qc_row_count <> v_selected_count%'
        AND v_core_definition ILIKE '%QC_RESPONSE_INVALID%',
        'missing or malformed QC checker rows must fail closed'
    );
    PERFORM pg_temp.assert_atomic(
        'submission snapshots remain immutable',
        v_core_definition NOT SIMILAR TO
            '%(UPDATE|DELETE FROM) public.(sample_submissions|result_reference_assessments)%',
        'approval core must not mutate immutable review evidence'
    );
    PERFORM pg_temp.assert_atomic(
        'function grants are server-only',
        NOT has_function_privilege('anon', v_core, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', v_core, 'EXECUTE')
        AND NOT has_function_privilege('service_role', v_core, 'EXECUTE')
        AND NOT has_function_privilege('anon', v_wrapper, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', v_wrapper, 'EXECUTE')
        AND has_function_privilege('service_role', v_wrapper, 'EXECUTE'),
        'only service_role may execute the wrapper; API roles cannot execute core'
    );
    PERFORM pg_temp.assert_atomic(
        'RLS remains enabled',
        (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.samples'::regclass)
        AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.results'::regclass),
        'migration must preserve samples/results RLS'
    );
    PERFORM pg_temp.assert_atomic(
        'mandatory security checker is registered',
        to_regprocedure(
            'public.test_atomic_result_approval_rpc_security()'
        ) IS NOT NULL
        AND pg_get_functiondef(
            'public.run_security_tests()'::regprocedure
        ) ILIKE '%Atomic Result Approval RPC Security%',
        'run_security_tests must include the P1 approval checker'
    );
END;
$contract$;

DO $base_fixtures$
DECLARE
    v_manager UUID := '92000000-0000-0000-0000-000000000001';
    v_restricted_manager UUID := '92000000-0000-0000-0000-000000000002';
    v_analyst UUID := '92000000-0000-0000-0000-000000000003';
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_manager, 'atomic-approval-manager@lims.local'),
        (v_restricted_manager, 'atomic-approval-restricted@lims.local'),
        (v_analyst, 'atomic-approval-analyst@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id, username, full_name, role, email,
        can_access_confidential, deleted_at
    )
    VALUES
        (
            v_manager, 'atomic_approval_manager', 'Atomic Approval Manager',
            'manager', 'atomic-approval-manager@lims.local', TRUE, NULL
        ),
        (
            v_restricted_manager, 'atomic_approval_restricted',
            'Atomic Approval Restricted Manager', 'manager',
            'atomic-approval-restricted@lims.local', FALSE, NULL
        ),
        (
            v_analyst, 'atomic_approval_analyst', 'Atomic Approval Analyst',
            'analyst', 'atomic-approval-analyst@lims.local', TRUE, NULL
        )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    INSERT INTO public.clients (
        id, id_card_num, name, date_of_birth, gender, phone, address
    )
    VALUES (
        '92000000-0000-0000-0000-000000000004',
        '079206009201', 'Atomic Approval Client', DATE '1990-01-01',
        'Nam', '0900009201', 'CDC'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.assay_definitions (
        id, name, units, is_confidential, normal_range, method_name
    )
    VALUES
        (
            '92000000-0000-0000-0000-000000000005',
            'Atomic Approval Normal Assay', 'unit', FALSE, '0-10',
            'Atomic Method'
        ),
        (
            '92000000-0000-0000-0000-000000000006',
            'Atomic Approval Confidential Assay', 'unit', TRUE, 'Negative',
            'Atomic Confidential Method'
        )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.qc_sessions (
        id, assay_id, qc_status, notes, created_by
    )
    VALUES (
        '92000000-0000-0000-0000-000000000030',
        '92000000-0000-0000-0000-000000000005',
        'blocked', 'Atomic approval blocked QC fixture', v_analyst
    )
    ON CONFLICT (id) DO UPDATE SET qc_status = 'blocked';
END;
$base_fixtures$;

CREATE FUNCTION pg_temp.create_atomic_fixture(
    p_sample_id UUID,
    p_sample_code TEXT,
    p_sample_status public.sample_status,
    p_result_id UUID,
    p_assay_id UUID,
    p_qc_session_id UUID DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.samples (
        id, sample_id, client_id, client_name, status, received_by, type,
        sample_quality, rejection_reason, rejected_at, rejected_by
    )
    VALUES (
        p_sample_id, p_sample_code,
        '92000000-0000-0000-0000-000000000004',
        'Atomic Approval Client', p_sample_status,
        '92000000-0000-0000-0000-000000000003',
        'Máu', TRUE, p_rejection_reason,
        CASE WHEN p_rejection_reason IS NULL THEN NULL ELSE NOW() END,
        CASE
            WHEN p_rejection_reason IS NULL THEN NULL
            ELSE '92000000-0000-0000-0000-000000000001'::UUID
        END
    )
    ON CONFLICT (id) DO UPDATE
    SET status = EXCLUDED.status,
        rejection_reason = EXCLUDED.rejection_reason,
        rejected_at = EXCLUDED.rejected_at,
        rejected_by = EXCLUDED.rejected_by;

    INSERT INTO public.results (
        id, sample_id, assay_id, value, status, entered_by, entered_at,
        approved_by, approved_at, approval_note, qc_session_id
    )
    VALUES (
        p_result_id, p_sample_id, p_assay_id, '1.0', 'entered',
        '92000000-0000-0000-0000-000000000003', NOW(),
        NULL, NULL, NULL, p_qc_session_id
    )
    ON CONFLICT (id) DO UPDATE
    SET sample_id = EXCLUDED.sample_id,
        assay_id = EXCLUDED.assay_id,
        status = 'entered',
        approved_by = NULL,
        approved_at = NULL,
        approval_note = NULL,
        qc_session_id = EXCLUDED.qc_session_id;
END;
$$;

SELECT pg_temp.create_atomic_fixture(
    '92000000-0000-0000-0000-000000000010', 'ATOMIC-PARTIAL', 'review',
    '92000000-0000-0000-0000-000000000020',
    '92000000-0000-0000-0000-000000000005', NULL,
    'Preserve while still under review'
);
INSERT INTO public.results (
    id, sample_id, assay_id, value, status, entered_by, entered_at
)
VALUES (
    '92000000-0000-0000-0000-000000000021',
    '92000000-0000-0000-0000-000000000010',
    '92000000-0000-0000-0000-000000000005',
    '2.0', 'entered',
    '92000000-0000-0000-0000-000000000003', NOW()
)
ON CONFLICT (id) DO UPDATE
SET status = 'entered', approved_by = NULL, approved_at = NULL,
    approval_note = NULL;
SELECT pg_temp.create_atomic_fixture(
    '92000000-0000-0000-0000-000000000011', 'ATOMIC-COMPLETE', 'review',
    '92000000-0000-0000-0000-000000000022',
    '92000000-0000-0000-0000-000000000005', NULL, 'Clear when completed'
);
SELECT pg_temp.create_atomic_fixture(
    '92000000-0000-0000-0000-000000000012', 'ATOMIC-CONFIDENTIAL', 'review',
    '92000000-0000-0000-0000-000000000023',
    '92000000-0000-0000-0000-000000000006'
);
SELECT pg_temp.create_atomic_fixture(
    '92000000-0000-0000-0000-000000000013', 'ATOMIC-QC-BLOCKED', 'review',
    '92000000-0000-0000-0000-000000000024',
    '92000000-0000-0000-0000-000000000005',
    '92000000-0000-0000-0000-000000000030'
);
SELECT pg_temp.create_atomic_fixture(
    '92000000-0000-0000-0000-000000000014', 'ATOMIC-ROLLBACK', 'review',
    '92000000-0000-0000-0000-000000000025',
    '92000000-0000-0000-0000-000000000005'
);
SELECT pg_temp.create_atomic_fixture(
    '92000000-0000-0000-0000-000000000015', 'ATOMIC-NOT-REVIEW',
    'in_progress', '92000000-0000-0000-0000-000000000026',
    '92000000-0000-0000-0000-000000000005'
);

DELETE FROM public.audit_logs
WHERE record_id::TEXT LIKE '92000000-0000-0000-0000-0000000000%';

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims TO '{"role":"service_role"}';
INSERT INTO atomic_approval_outcomes
SELECT 'partial', public.approve_sample_results_server(
    '92000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000010',
    ARRAY['92000000-0000-0000-0000-000000000020'::UUID],
    'Reviewed atomically'
);
SELECT pg_temp.assert_atomic(
    'server wrapper restores caller claims',
    NULLIF(
        current_setting('request.jwt.claim.sub', TRUE),
        ''
    ) IS NULL
    AND NULLIF(
        current_setting('request.jwt.claim.role', TRUE),
        ''
    ) IS NULL
    AND current_setting('request.jwt.claims', TRUE)::JSONB
        ->> 'role' = 'service_role',
    'service_role claims must survive one protected wrapper call'
);
RESET ROLE;
RESET request.jwt.claims;
RESET request.jwt.claim.sub;

DO $partial$
DECLARE
    v_outcome JSONB := (
        SELECT outcome FROM atomic_approval_outcomes WHERE test_name = 'partial'
    );
    v_audits INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_audits
    FROM public.audit_logs
    WHERE operation = 'UPDATE'
      AND record_id IN (
          '92000000-0000-0000-0000-000000000010',
          '92000000-0000-0000-0000-000000000020'
      );

    PERFORM pg_temp.assert_atomic(
        'partial approval outcome',
        v_outcome @> '{
            "success":true,"outcome_code":"APPROVED","approved_count":1,
            "sample_completed":false,"replayed":false
        }'::JSONB,
        v_outcome::TEXT
    );
    PERFORM pg_temp.assert_atomic(
        'exact selected-result snapshot',
        EXISTS (
            SELECT 1 FROM public.results
            WHERE id = '92000000-0000-0000-0000-000000000020'
              AND status = 'approved'
              AND approved_by = '92000000-0000-0000-0000-000000000001'
              AND approval_note = 'Reviewed atomically'
        ) AND EXISTS (
            SELECT 1 FROM public.results
            WHERE id = '92000000-0000-0000-0000-000000000021'
              AND status = 'entered' AND approved_by IS NULL
        ),
        'only the selected result may be approved'
    );
    PERFORM pg_temp.assert_atomic(
        'partial approval preserves rejection state',
        EXISTS (
            SELECT 1 FROM public.samples
            WHERE id = '92000000-0000-0000-0000-000000000010'
              AND status = 'review'
              AND rejection_reason = 'Preserve while still under review'
        ),
        'review sample rejection fields must remain unchanged'
    );
    PERFORM pg_temp.assert_atomic(
        'approval audit rows use manager actor',
        v_audits = 1 AND NOT EXISTS (
            SELECT 1 FROM public.audit_logs
            WHERE operation = 'UPDATE'
              AND record_id IN (
                  '92000000-0000-0000-0000-000000000010',
                  '92000000-0000-0000-0000-000000000020'
              )
              AND changed_by IS DISTINCT FROM
                  '92000000-0000-0000-0000-000000000001'
        ),
        format('expected one manager-attributed result audit, found %s', v_audits)
    );
END;
$partial$;

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims TO '{"role":"service_role"}';
INSERT INTO atomic_approval_outcomes
SELECT 'replay', public.approve_sample_results_server(
    '92000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000010',
    ARRAY['92000000-0000-0000-0000-000000000020'::UUID],
    'Reviewed atomically'
);
INSERT INTO atomic_approval_outcomes
SELECT 'complete', public.approve_sample_results_server(
    '92000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000011',
    ARRAY['92000000-0000-0000-0000-000000000022'::UUID],
    NULL
);
RESET ROLE;
RESET request.jwt.claims;
RESET request.jwt.claim.sub;

DO $success_outcomes$
DECLARE
    v_replay JSONB := (
        SELECT outcome FROM atomic_approval_outcomes WHERE test_name = 'replay'
    );
    v_complete JSONB := (
        SELECT outcome FROM atomic_approval_outcomes WHERE test_name = 'complete'
    );
BEGIN
    PERFORM pg_temp.assert_atomic(
        'idempotent replay creates no duplicate evidence',
        v_replay @> '{
            "success":true,"outcome_code":"ALREADY_APPROVED",
            "approved_count":1,"sample_completed":false,"replayed":true
        }'::JSONB
        AND (
            SELECT COUNT(*) FROM public.audit_logs
            WHERE operation = 'UPDATE'
              AND record_id IN (
                  '92000000-0000-0000-0000-000000000010',
                  '92000000-0000-0000-0000-000000000020'
              )
        ) = 1,
        v_replay::TEXT
    );
    PERFORM pg_temp.assert_atomic(
        'completion resets rejection state atomically',
        v_complete @> '{
            "success":true,"outcome_code":"APPROVED",
            "approved_count":1,"sample_completed":true
        }'::JSONB
        AND EXISTS (
            SELECT 1 FROM public.samples
            WHERE id = '92000000-0000-0000-0000-000000000011'
              AND status = 'completed'
              AND rejection_reason IS NULL
              AND rejected_at IS NULL
              AND rejected_by IS NULL
        ),
        v_complete::TEXT
    );
END;
$success_outcomes$;

SELECT pg_temp.assert_outcome(
    'manager role is required',
    public.approve_sample_results_atomic(
        '92000000-0000-0000-0000-000000000003',
        '92000000-0000-0000-0000-000000000012',
        ARRAY['92000000-0000-0000-0000-000000000023'::UUID], NULL
    ),
    'MANAGER_REQUIRED'
);
SELECT pg_temp.assert_outcome(
    'confidential access is required',
    public.approve_sample_results_atomic(
        '92000000-0000-0000-0000-000000000002',
        '92000000-0000-0000-0000-000000000012',
        ARRAY['92000000-0000-0000-0000-000000000023'::UUID], NULL
    ),
    'CONFIDENTIAL_ACCESS_REQUIRED'
);
SELECT pg_temp.assert_outcome(
    'duplicate result IDs are rejected',
    public.approve_sample_results_atomic(
        '92000000-0000-0000-0000-000000000001',
        '92000000-0000-0000-0000-000000000010',
        ARRAY[
            '92000000-0000-0000-0000-000000000021'::UUID,
            '92000000-0000-0000-0000-000000000021'::UUID
        ], NULL
    ),
    'REQUEST_CONFLICT'
);
SELECT pg_temp.assert_outcome(
    'missing selected result is rejected',
    public.approve_sample_results_atomic(
        '92000000-0000-0000-0000-000000000001',
        '92000000-0000-0000-0000-000000000010',
        ARRAY['92000000-0000-0000-0000-000000000099'::UUID], NULL
    ),
    'RESULT_NOT_FOUND'
);
SELECT pg_temp.assert_outcome(
    'selected result must belong to sample',
    public.approve_sample_results_atomic(
        '92000000-0000-0000-0000-000000000001',
        '92000000-0000-0000-0000-000000000010',
        ARRAY['92000000-0000-0000-0000-000000000022'::UUID], NULL
    ),
    'RESULT_SAMPLE_MISMATCH'
);
SELECT pg_temp.assert_outcome(
    'sample must remain under review',
    public.approve_sample_results_atomic(
        '92000000-0000-0000-0000-000000000001',
        '92000000-0000-0000-0000-000000000015',
        ARRAY['92000000-0000-0000-0000-000000000026'::UUID], NULL
    ),
    'SAMPLE_NOT_REVIEW'
);
SELECT pg_temp.assert_outcome(
    'approval note is bounded',
    public.approve_sample_results_atomic(
        '92000000-0000-0000-0000-000000000001',
        '92000000-0000-0000-0000-000000000010',
        ARRAY['92000000-0000-0000-0000-000000000021'::UUID],
        repeat('x', 501)
    ),
    'REQUEST_CONFLICT'
);

DO $qc_block$
DECLARE
    v_outcome JSONB := public.approve_sample_results_atomic(
        '92000000-0000-0000-0000-000000000001',
        '92000000-0000-0000-0000-000000000013',
        ARRAY['92000000-0000-0000-0000-000000000024'::UUID],
        NULL
    );
BEGIN
    PERFORM pg_temp.assert_atomic(
        'blocked QC fails closed',
        v_outcome->>'outcome_code' = 'QC_BLOCKED'
        AND (v_outcome#>>'{error_params,blocked_count}')::INTEGER = 1
        AND EXISTS (
            SELECT 1 FROM public.results
            WHERE id = '92000000-0000-0000-0000-000000000024'
              AND status = 'entered'
        ),
        v_outcome::TEXT
    );
END;
$qc_block$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
    '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated"}';
DO $authenticated_denial$
DECLARE
    v_denied BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM public.approve_sample_results_server(
            '92000000-0000-0000-0000-000000000001',
            '92000000-0000-0000-0000-000000000010',
            ARRAY['92000000-0000-0000-0000-000000000021'::UUID], NULL
        );
    EXCEPTION WHEN insufficient_privilege THEN
        v_denied := TRUE;
    END;
    PERFORM pg_temp.assert_atomic(
        'password-only manager JWT cannot call wrapper',
        v_denied,
        'authenticated role must receive permission denied'
    );
END;
$authenticated_denial$;
RESET ROLE;
RESET request.jwt.claims;

CREATE FUNCTION public.atomic_approval_test_fail_sample_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.id = '92000000-0000-0000-0000-000000000014'::UUID THEN
        RAISE EXCEPTION 'atomic approval rollback probe';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER atomic_approval_test_fail_sample_update
BEFORE UPDATE ON public.samples
FOR EACH ROW
EXECUTE FUNCTION public.atomic_approval_test_fail_sample_update();

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims TO '{"role":"service_role"}';
DO $rollback_probe$
DECLARE
    v_failed BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM public.approve_sample_results_server(
            '92000000-0000-0000-0000-000000000001',
            '92000000-0000-0000-0000-000000000014',
            ARRAY['92000000-0000-0000-0000-000000000025'::UUID], NULL
        );
    EXCEPTION WHEN OTHERS THEN
        v_failed := SQLERRM ILIKE '%atomic approval rollback probe%';
    END;

    INSERT INTO atomic_approval_outcomes
    VALUES (
        'rollback_probe',
        jsonb_build_object('failed', v_failed)
    );
END;
$rollback_probe$;
RESET ROLE;
RESET request.jwt.claims;
RESET request.jwt.claim.sub;

DO $rollback_assertion$
DECLARE
    v_failed BOOLEAN := COALESCE(
        (
            SELECT (outcome->>'failed')::BOOLEAN
            FROM atomic_approval_outcomes
            WHERE test_name = 'rollback_probe'
        ),
        FALSE
    );
BEGIN
    PERFORM pg_temp.assert_atomic(
        'result sample and audit writes roll back together',
        v_failed
        AND EXISTS (
            SELECT 1 FROM public.results
            WHERE id = '92000000-0000-0000-0000-000000000025'
              AND status = 'entered' AND approved_by IS NULL
        )
        AND EXISTS (
            SELECT 1 FROM public.samples
            WHERE id = '92000000-0000-0000-0000-000000000014'
              AND status = 'review'
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.audit_logs
            WHERE operation = 'UPDATE'
              AND record_id IN (
                  '92000000-0000-0000-0000-000000000014',
                  '92000000-0000-0000-0000-000000000025'
              )
        ),
        'forced sample failure must leave no approval or audit evidence'
    );
END;
$rollback_assertion$;

DROP TRIGGER atomic_approval_test_fail_sample_update ON public.samples;
DROP FUNCTION public.atomic_approval_test_fail_sample_update();

DO $final$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(
        format('%s: %s', test_name, detail),
        E'\n' ORDER BY test_name
    )
    INTO v_failed
    FROM atomic_approval_assertions
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION
            'Atomic result approval tests failed:%',
            E'\n' || v_failed;
    END IF;
END;
$final$;

ROLLBACK;
SELECT 'atomic-result-approval: ok' AS result;
