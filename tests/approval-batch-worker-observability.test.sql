-- APPROVAL BATCH WORKER OBSERVABILITY CONTRACT
-- Verifies authoritative queue-age semantics and the worker-only access boundary.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE approval_batch_worker_observability_assertions (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.assert_worker_observability(
    p_test_name TEXT,
    p_condition BOOLEAN,
    p_detail TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO approval_batch_worker_observability_assertions
    VALUES (p_test_name, COALESCE(p_condition, FALSE), p_detail);
END;
$$;

DO $contract$
BEGIN
    IF to_regprocedure(
        'public.get_approval_batch_worker_observability()'
    ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 200 approval batch worker observability RPC is missing';
    END IF;
END;
$contract$;

DO $security$
DECLARE
    v_observability_function REGPROCEDURE :=
        'public.get_approval_batch_worker_observability()'::REGPROCEDURE;
BEGIN
    PERFORM pg_temp.assert_worker_observability(
        'observability_rpc_is_pinned_security_definer',
        (
            SELECT function_record.prosecdef
               AND function_record.provolatile = 'v'
               AND function_record.proconfig @>
                   ARRAY['search_path=public, extensions, pg_temp']
            FROM pg_proc AS function_record
            WHERE function_record.oid = v_observability_function::OID
        ),
        'The RPC must use SECURITY DEFINER with a pinned search_path'
    );

    PERFORM pg_temp.assert_worker_observability(
        'observability_rpc_returns_only_time_and_age',
        pg_get_function_result(v_observability_function) =
            'TABLE(observed_at timestamp with time zone, '
            || 'oldest_eligible_queue_age_seconds double precision)',
        'The RPC must not return item, manager, sample, result, or note data'
    );

    PERFORM pg_temp.assert_worker_observability(
        'only_worker_role_can_execute_observability_rpc',
        has_function_privilege(
            'approval_batch_worker',
            v_observability_function,
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            v_observability_function,
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'authenticated',
            v_observability_function,
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'service_role',
            v_observability_function,
            'EXECUTE'
        ),
        'Only approval_batch_worker may execute the observability RPC'
    );

    PERFORM pg_temp.assert_worker_observability(
        'worker_still_has_no_direct_batch_table_privileges',
        NOT EXISTS (
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
        ),
        'Observability must not add direct table access to the worker role'
    );
END;
$security$;

GRANT approval_batch_worker TO postgres;

CREATE FUNCTION pg_temp.observe_worker_queue()
RETURNS TABLE (
    observed_at TIMESTAMPTZ,
    oldest_eligible_queue_age_seconds DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE 'SET LOCAL ROLE approval_batch_worker';
    RETURN QUERY
    SELECT observation.observed_at,
           observation.oldest_eligible_queue_age_seconds
    FROM public.get_approval_batch_worker_observability() AS observation;
    EXECUTE 'RESET ROLE';
EXCEPTION
    WHEN OTHERS THEN
        EXECUTE 'RESET ROLE';
        RAISE;
END;
$$;

DO $fixtures$
DECLARE
    v_manager_id UUID := '93600000-0000-0000-0000-000000000001';
    v_analyst_id UUID := '93600000-0000-0000-0000-000000000002';
    v_sample_ids UUID[];
    v_outcome JSONB;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_manager_id, 'approval-observability-manager@lims.local'),
        (v_analyst_id, 'approval-observability-analyst@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id, username, full_name, role, email,
        can_access_confidential, deleted_at
    )
    VALUES
        (
            v_manager_id, 'approval_observability_manager',
            'Approval Observability Manager', 'manager',
            'approval-observability-manager@lims.local', TRUE, NULL
        ),
        (
            v_analyst_id, 'approval_observability_analyst',
            'Approval Observability Analyst', 'analyst',
            'approval-observability-analyst@lims.local', TRUE, NULL
        )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    INSERT INTO public.clients (
        id, id_card_num, name, date_of_birth, gender, phone, address
    )
    VALUES (
        '93600000-0000-0000-0000-000000000003',
        '079206093601', 'Approval Observability Client',
        DATE '1990-01-01', 'Nam', '0900093601', 'CDC'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.assay_definitions (
        id, name, units, is_confidential, normal_range, method_name
    )
    VALUES (
        '93600000-0000-0000-0000-000000000004',
        'Approval Observability Assay', 'unit', FALSE, '0-10',
        'Approval Observability Method'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.samples (
        id, sample_id, client_id, client_name, status, received_by,
        type, sample_quality
    )
    SELECT
        (
            '93600010-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        'BATCH-P6-OBS-' || series,
        '93600000-0000-0000-0000-000000000003'::UUID,
        'Approval Observability Client',
        'review'::public.sample_status,
        v_analyst_id,
        'Máu',
        TRUE
    FROM generate_series(1, 8) AS fixture(series);

    INSERT INTO public.results (
        id, sample_id, assay_id, value, status, entered_by, entered_at
    )
    SELECT
        (
            '93600020-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        (
            '93600010-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        '93600000-0000-0000-0000-000000000004'::UUID,
        series::TEXT,
        'entered'::public.result_status,
        v_analyst_id,
        clock_timestamp()
    FROM generate_series(1, 8) AS fixture(series);

    SELECT array_agg(id ORDER BY id)
    INTO v_sample_ids
    FROM public.samples
    WHERE sample_id LIKE 'BATCH-P6-OBS-%';

    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

    v_outcome := public.create_approval_batch_server(
        v_manager_id,
        '93600000-0000-0000-0000-000000000100',
        'selected',
        v_sample_ids,
        'Duyệt lô quan sát P6',
        '93600000-0000-0000-0000-000000000005',
        clock_timestamp(),
        'manager_email_otp'
    );

    IF NOT COALESCE((v_outcome ->> 'success')::BOOLEAN, FALSE) THEN
        RAISE EXCEPTION
            'Could not create observability batch: %',
            v_outcome;
    END IF;
END;
$fixtures$;

DO $queue_age_semantics$
DECLARE
    v_batch_id UUID;
    v_item_ids UUID[];
    v_expected_created_at TIMESTAMPTZ;
    v_observed_at TIMESTAMPTZ;
    v_age_seconds DOUBLE PRECISION;
BEGIN
    SELECT id
    INTO v_batch_id
    FROM public.approval_batches
    WHERE requested_by =
        '93600000-0000-0000-0000-000000000001'::UUID
      AND request_key =
        '93600000-0000-0000-0000-000000000100'::UUID;

    SELECT array_agg(item.id ORDER BY item.created_at, item.id)
    INTO v_item_ids
    FROM public.approval_batch_items AS item
    WHERE item.batch_id = v_batch_id;

    UPDATE public.approval_batch_items
    SET status = 'retry_wait',
        attempt_count = 1,
        next_attempt_at = clock_timestamp() + INTERVAL '60 seconds',
        started_at = clock_timestamp() - INTERVAL '1 second'
    WHERE id = v_item_ids[1];

    UPDATE public.approval_batch_items
    SET status = 'processing',
        attempt_count = 1,
        claim_token = '93600000-0000-4000-8000-000000000002',
        claimed_at = clock_timestamp() - INTERVAL '1 second',
        claim_expires_at = clock_timestamp() + INTERVAL '60 seconds',
        started_at = clock_timestamp() - INTERVAL '1 second'
    WHERE id = v_item_ids[2];

    UPDATE public.approval_batch_items
    SET status = 'succeeded',
        attempt_count = 1,
        started_at = clock_timestamp() - INTERVAL '1 second',
        completed_at = clock_timestamp()
    WHERE id = v_item_ids[3];

    UPDATE public.approval_batch_items
    SET status = 'processing',
        attempt_count = 3,
        claim_token = '93600000-0000-4000-8000-000000000004',
        claimed_at = clock_timestamp() - INTERVAL '60 seconds',
        claim_expires_at = clock_timestamp() - INTERVAL '1 second',
        started_at = clock_timestamp() - INTERVAL '60 seconds'
    WHERE id = v_item_ids[4];

    UPDATE public.approval_batch_items
    SET status = 'retry_wait',
        attempt_count = 1,
        next_attempt_at = clock_timestamp() - INTERVAL '1 second',
        started_at = clock_timestamp() - INTERVAL '1 second'
    WHERE id = v_item_ids[7];

    UPDATE public.approval_batch_items
    SET status = 'processing',
        attempt_count = 1,
        claim_token = '93600000-0000-4000-8000-000000000008',
        claimed_at = clock_timestamp() - INTERVAL '60 seconds',
        claim_expires_at = clock_timestamp() - INTERVAL '1 second',
        started_at = clock_timestamp() - INTERVAL '60 seconds'
    WHERE id = v_item_ids[8];

    SELECT created_at
    INTO v_expected_created_at
    FROM public.approval_batch_items
    WHERE id = v_item_ids[5];

    SELECT observation.observed_at,
           observation.oldest_eligible_queue_age_seconds
    INTO v_observed_at, v_age_seconds
    FROM pg_temp.observe_worker_queue() AS observation;

    PERFORM pg_temp.assert_worker_observability(
        'oldest_eligible_age_uses_item_creation_time',
        abs(
            v_age_seconds
            - extract(EPOCH FROM v_observed_at - v_expected_created_at)
        ) < 0.001,
        'Age must use created_at of the oldest currently eligible item'
    );

    UPDATE public.approval_batch_items
    SET status = 'succeeded',
        attempt_count = 1,
        started_at = clock_timestamp() - INTERVAL '1 second',
        completed_at = clock_timestamp()
    WHERE id = ANY(ARRAY[v_item_ids[5], v_item_ids[6]]);

    UPDATE public.approval_batch_items
    SET next_attempt_at = clock_timestamp() + INTERVAL '60 seconds'
    WHERE id = v_item_ids[7];

    UPDATE public.approval_batch_items
    SET claimed_at = clock_timestamp(),
        claim_expires_at = clock_timestamp() + INTERVAL '60 seconds'
    WHERE id = v_item_ids[8];

    SELECT observation.oldest_eligible_queue_age_seconds
    INTO v_age_seconds
    FROM pg_temp.observe_worker_queue() AS observation;

    PERFORM pg_temp.assert_worker_observability(
        'empty_eligible_queue_reports_zero',
        v_age_seconds = 0,
        'No eligible items must report zero rather than stale queue age'
    );
END;
$queue_age_semantics$;

REVOKE approval_batch_worker FROM postgres;

DO $security_runner$
DECLARE
    v_registered_passed BOOLEAN;
BEGIN
    SELECT security_test.passed
    INTO v_registered_passed
    FROM public.run_security_tests() AS security_test
    WHERE security_test.test_name =
        'Approval Batch Worker Observability Security';

    PERFORM pg_temp.assert_worker_observability(
        'registered_observability_security_checker_passes',
        public.test_approval_batch_worker_observability_security()
        AND COALESCE(v_registered_passed, FALSE),
        'The migration 200 checker must pass through run_security_tests()'
    );
END;
$security_runner$;

DO $report$
DECLARE
    v_failures TEXT;
BEGIN
    SELECT string_agg(test_name || ': ' || detail, E'\n' ORDER BY test_name)
    INTO v_failures
    FROM approval_batch_worker_observability_assertions
    WHERE NOT passed;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION
            E'Approval batch worker observability failures:\n%',
            v_failures;
    END IF;
END;
$report$;

SELECT test_name, passed, detail
FROM approval_batch_worker_observability_assertions
ORDER BY test_name;

ROLLBACK;
