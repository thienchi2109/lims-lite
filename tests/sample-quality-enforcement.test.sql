-- SAMPLE QUALITY ENFORCEMENT RUNTIME CONTRACT
-- Run only after migration 190 has been applied.
--
-- Usage from the home-server checkout:
--   sudo -n docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 \
--     -U postgres -d postgres < tests/sample-quality-enforcement.test.sql
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE sample_quality_enforcement_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE sample_quality_rpc_result (
    payload JSONB NOT NULL
) ON COMMIT DROP;

GRANT SELECT, INSERT ON sample_quality_rpc_result TO authenticated;

DO $$
DECLARE
    v_analyst_id UUID := '94000000-0000-0000-0000-000000000001';
    v_client_id UUID := '94000000-0000-0000-0000-000000000002';
    v_historical_sample_id UUID := '94000000-0000-0000-0000-000000000003';
    v_missing_quality_rejected BOOLEAN := FALSE;
    v_historical_update_preserved BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES (v_analyst_id, 'sample-quality-enforcement@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id,
        username,
        full_name,
        role,
        email,
        can_access_confidential,
        deleted_at
    )
    VALUES (
        v_analyst_id,
        'sample_quality_enforcement',
        'Sample Quality Enforcement',
        'analyst',
        'sample-quality-enforcement@lims.local',
        FALSE,
        NULL
    )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        deleted_at = NULL;

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address
    )
    VALUES (
        v_client_id,
        '079204009401',
        'Sample Quality Enforcement Client',
        DATE '1990-01-01',
        'Nam',
        '0900000401',
        'CDC'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO sample_quality_enforcement_results
    VALUES (
        'legacy accession signatures removed',
        to_regprocedure(
            'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)'
        ) IS NULL
        AND to_regprocedure(
            'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)'
        ) IS NULL,
        'legacy RPC overloads must not remain executable'
    );

    INSERT INTO sample_quality_enforcement_results
    VALUES (
        'quality-aware RPC grants preserved',
        has_function_privilege(
            'authenticated',
            'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
            'EXECUTE'
        )
        AND has_function_privilege(
            'authenticated',
            'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'service_role',
            'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
            'EXECUTE'
        ),
        'authenticated keeps EXECUTE while anon and service_role remain denied'
    );

    ALTER TABLE public.samples
    DISABLE TRIGGER samples_require_quality_on_insert;

    INSERT INTO public.samples (
        id,
        sample_id,
        client_id,
        client_name,
        status,
        received_by,
        type,
        description,
        sample_quality
    )
    VALUES (
        v_historical_sample_id,
        'QUALITY-HISTORICAL-NULL',
        v_client_id,
        'Sample Quality Enforcement Client',
        'received',
        v_analyst_id,
        'Máu',
        'Historical row before enforcement',
        NULL
    );

    ALTER TABLE public.samples
    ENABLE TRIGGER samples_require_quality_on_insert;

    UPDATE public.samples
    SET description = 'Historical row updated after enforcement'
    WHERE id = v_historical_sample_id;

    SELECT EXISTS (
        SELECT 1
        FROM public.samples
        WHERE id = v_historical_sample_id
          AND description = 'Historical row updated after enforcement'
          AND sample_quality IS NULL
    )
    INTO v_historical_update_preserved;

    INSERT INTO sample_quality_enforcement_results
    VALUES (
        'historical NULL unrelated update preserved',
        v_historical_update_preserved,
        'INSERT-only guard must not block unrelated updates to historical NULL rows'
    );

    BEGIN
        INSERT INTO public.samples (
            sample_id,
            client_id,
            client_name,
            status,
            received_by,
            type,
            sample_quality
        )
        VALUES (
            'QUALITY-MISSING-REJECTED',
            v_client_id,
            'Sample Quality Enforcement Client',
            'received',
            v_analyst_id,
            'Máu',
            NULL
        );
    EXCEPTION
        WHEN not_null_violation THEN
            v_missing_quality_rejected :=
                SQLSTATE = '23502'
                AND SQLERRM ILIKE '%sample quality is required%';
    END;

    INSERT INTO sample_quality_enforcement_results
    VALUES (
        'new NULL sample quality rejected',
        v_missing_quality_rejected,
        'new direct INSERT must fail with SQLSTATE 23502'
    );
END;
$$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
    '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated"}';

INSERT INTO sample_quality_rpc_result (payload)
SELECT public.create_sample_atomic(
        '94000000-0000-0000-0000-000000000002'::UUID,
        'Sample Quality Enforcement Client',
        TIMESTAMPTZ '2026-07-20 00:00:00+00',
        '94000000-0000-0000-0000-000000000001'::UUID,
        'Máu',
        FALSE
    );

RESET ROLE;
RESET request.jwt.claims;

DO $$
DECLARE
    v_analyst_id UUID := '94000000-0000-0000-0000-000000000001';
    v_valid_sample_id UUID;
    v_valid_audit_quality JSONB;
    v_valid_audit_changed_by UUID;
    v_security_runner_passed BOOLEAN;
BEGIN
    SELECT (payload->>'id')::UUID
    INTO v_valid_sample_id
    FROM sample_quality_rpc_result;

    SELECT new_values->'sample_quality', changed_by
    INTO v_valid_audit_quality, v_valid_audit_changed_by
    FROM public.audit_logs
    WHERE table_name = 'samples'
      AND record_id = v_valid_sample_id
      AND operation = 'INSERT'
    ORDER BY changed_at DESC
    LIMIT 1;

    INSERT INTO sample_quality_enforcement_results
    VALUES (
        'valid quality RPC insert remains audited for analyst',
        v_valid_audit_quality = 'false'::JSONB
        AND v_valid_audit_changed_by = v_analyst_id,
        format(
            'expected quality=false and changed_by=%s, found quality=%s changed_by=%s',
            v_analyst_id,
            COALESCE(v_valid_audit_quality::TEXT, '<null>'),
            COALESCE(v_valid_audit_changed_by::TEXT, '<null>')
        )
    );

    SELECT EXISTS (
        SELECT 1
        FROM public.run_security_tests()
        WHERE test_name = 'Sample Quality Enforcement'
          AND passed
    )
    INTO v_security_runner_passed;

    INSERT INTO sample_quality_enforcement_results
    VALUES (
        'security runner preserves RLS and enforcement coverage',
        v_security_runner_passed
        AND public.test_samples_insert_policy_requires_analyst_receiver()
        AND public.test_sample_receiver_guard()
        AND public.test_sample_accession_rpcs_require_analyst_role(),
        'run_security_tests and existing sample RLS/trigger/RPC checks must pass'
    );
END;
$$;

TABLE sample_quality_enforcement_results;

DO $$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(
        format('%s: %s', test_name, detail),
        E'\n' ORDER BY test_name
    )
    INTO v_failed
    FROM sample_quality_enforcement_results
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION
            'Sample quality enforcement runtime tests failed:%',
            E'\n' || v_failed;
    END IF;
END;
$$;

ROLLBACK;
