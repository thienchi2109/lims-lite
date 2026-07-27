-- APPROVAL BATCH WORKER DATABASE CONTRACT
-- Verifies least-privilege worker access, leases, execution, retries, and crash recovery.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE approval_batch_worker_assertions (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.assert_worker_contract(
    p_test_name TEXT,
    p_condition BOOLEAN,
    p_detail TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO approval_batch_worker_assertions
    VALUES (p_test_name, COALESCE(p_condition, FALSE), p_detail);
END;
$$;

DO $contract$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'approval_batch_worker'
    )
       OR to_regprocedure(
           'public.claim_approval_batch_items_worker(integer,integer)'
       ) IS NULL
       OR to_regprocedure(
           'public.execute_approval_batch_item_worker(uuid,uuid)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Phase P5 approval batch worker contracts are missing';
    END IF;
END;
$contract$;

DO $schema$
DECLARE
    v_claim_function REGPROCEDURE :=
        'public.claim_approval_batch_items_worker(integer,integer)'::REGPROCEDURE;
    v_execute_function REGPROCEDURE :=
        'public.execute_approval_batch_item_worker(uuid,uuid)'::REGPROCEDURE;
BEGIN
    PERFORM pg_temp.assert_worker_contract(
        'worker_role_is_restricted_login',
        (
            SELECT rolcanlogin
               AND NOT rolsuper
               AND NOT rolcreaterole
               AND NOT rolcreatedb
               AND NOT rolinherit
               AND NOT rolreplication
               AND NOT rolbypassrls
            FROM pg_roles
            WHERE rolname = 'approval_batch_worker'
        ),
        'The worker role must be a dedicated non-privileged login'
    );

    PERFORM pg_temp.assert_worker_contract(
        'worker_role_has_no_memberships',
        NOT EXISTS (
            SELECT 1
            FROM pg_auth_members AS membership
            JOIN pg_roles AS member_role
              ON member_role.oid = membership.member
            WHERE member_role.rolname = 'approval_batch_worker'
        ),
        'The worker role must not inherit unrelated database roles'
    );

    PERFORM pg_temp.assert_worker_contract(
        'worker_functions_are_pinned_security_definers',
        (
            SELECT bool_and(
                function_record.prosecdef
                AND function_record.proconfig @>
                    ARRAY['search_path=public, extensions, pg_temp']
            )
            FROM pg_proc AS function_record
            WHERE function_record.oid IN (
                v_claim_function::OID,
                v_execute_function::OID
            )
        ),
        'Worker functions must be SECURITY DEFINER with a pinned search_path'
    );

    PERFORM pg_temp.assert_worker_contract(
        'only_worker_role_can_execute_worker_functions',
        has_function_privilege(
            'approval_batch_worker',
            v_claim_function,
            'EXECUTE'
        )
        AND has_function_privilege(
            'approval_batch_worker',
            v_execute_function,
            'EXECUTE'
        )
        AND NOT has_function_privilege('anon', v_claim_function, 'EXECUTE')
        AND NOT has_function_privilege(
            'authenticated',
            v_claim_function,
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'service_role',
            v_claim_function,
            'EXECUTE'
        )
        AND NOT has_function_privilege('anon', v_execute_function, 'EXECUTE')
        AND NOT has_function_privilege(
            'authenticated',
            v_execute_function,
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'service_role',
            v_execute_function,
            'EXECUTE'
        ),
        'Only approval_batch_worker may execute claim and execution RPCs'
    );

    PERFORM pg_temp.assert_worker_contract(
        'worker_cannot_call_web_approval_wrapper',
        NOT has_function_privilege(
            'approval_batch_worker',
            'public.approve_sample_results_server(uuid,uuid,uuid[],text)',
            'EXECUTE'
        ),
        'The worker must only reach approval through its item-bound wrapper'
    );

    PERFORM pg_temp.assert_worker_contract(
        'worker_has_no_batch_table_dml',
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
        'The worker role must not have direct table privileges'
    );
END;
$schema$;

CREATE FUNCTION pg_temp.create_worker_batch(
    p_manager_id UUID,
    p_request_key UUID,
    p_sample_ids UUID[]
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_outcome JSONB;
BEGIN
    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

    v_outcome := public.create_approval_batch_server(
        p_manager_id,
        p_request_key,
        'selected',
        p_sample_ids,
        'Duyệt lô nền P5',
        public.gen_random_uuid(),
        clock_timestamp(),
        'manager_email_otp'
    );

    IF NOT COALESCE((v_outcome ->> 'success')::BOOLEAN, FALSE) THEN
        RAISE EXCEPTION 'Could not create worker test batch: %', v_outcome;
    END IF;

    RETURN (v_outcome ->> 'batch_id')::UUID;
END;
$$;

CREATE FUNCTION pg_temp.claim_worker_items(
    p_limit INTEGER,
    p_lease_seconds INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_claims JSONB;
BEGIN
    EXECUTE 'SET LOCAL ROLE approval_batch_worker';

    SELECT COALESCE(jsonb_agg(to_jsonb(claimed)), '[]'::JSONB)
    INTO v_claims
    FROM public.claim_approval_batch_items_worker(
        p_limit,
        p_lease_seconds
    ) AS claimed;

    EXECUTE 'RESET ROLE';
    RETURN v_claims;
EXCEPTION
    WHEN OTHERS THEN
        EXECUTE 'RESET ROLE';
        RAISE;
END;
$$;

CREATE FUNCTION pg_temp.execute_worker_item(
    p_item_id UUID,
    p_claim_token UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_outcome JSONB;
BEGIN
    EXECUTE 'SET LOCAL ROLE approval_batch_worker';
    v_outcome := public.execute_approval_batch_item_worker(
        p_item_id,
        p_claim_token
    );
    EXECUTE 'RESET ROLE';
    RETURN v_outcome;
EXCEPTION
    WHEN OTHERS THEN
        EXECUTE 'RESET ROLE';
        RAISE;
END;
$$;

DO $fixtures$
DECLARE
    v_manager_id UUID := '93400000-0000-0000-0000-000000000001';
    v_analyst_id UUID := '93400000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_manager_id, 'approval-worker-manager@lims.local'),
        (v_analyst_id, 'approval-worker-analyst@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id, username, full_name, role, email,
        can_access_confidential, deleted_at
    )
    VALUES
        (
            v_manager_id, 'approval_worker_manager',
            'Approval Worker Manager', 'manager',
            'approval-worker-manager@lims.local', TRUE, NULL
        ),
        (
            v_analyst_id, 'approval_worker_analyst',
            'Approval Worker Analyst', 'analyst',
            'approval-worker-analyst@lims.local', TRUE, NULL
        )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    INSERT INTO public.clients (
        id, id_card_num, name, date_of_birth, gender, phone, address
    )
    VALUES (
        '93400000-0000-0000-0000-000000000003',
        '079206093401', 'Approval Worker Client',
        DATE '1990-01-01', 'Nam', '0900093401', 'CDC'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.assay_definitions (
        id, name, units, is_confidential, normal_range, method_name
    )
    VALUES (
        '93400000-0000-0000-0000-000000000004',
        'Approval Worker Assay', 'unit', FALSE, '0-10',
        'Approval Worker Method'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.samples (
        id, sample_id, client_id, client_name, status, received_by,
        type, sample_quality
    )
    SELECT
        (
            '93400010-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        'BATCH-P5-' || series,
        '93400000-0000-0000-0000-000000000003'::UUID,
        'Approval Worker Client',
        'review'::public.sample_status,
        v_analyst_id,
        'Máu',
        TRUE
    FROM generate_series(1, 4) AS fixture(series);

    INSERT INTO public.results (
        id, sample_id, assay_id, value, status, entered_by, entered_at
    )
    SELECT
        (
            '93400020-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        (
            '93400010-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        '93400000-0000-0000-0000-000000000004'::UUID,
        series::TEXT,
        'entered'::public.result_status,
        v_analyst_id,
        clock_timestamp()
    FROM generate_series(1, 4) AS fixture(series);
END;
$fixtures$;

DO $claim_bounds$
DECLARE
    v_failed BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM pg_temp.claim_worker_items(17, 60);
    EXCEPTION
        WHEN SQLSTATE '22023' THEN
            v_failed := TRUE;
    END;

    PERFORM pg_temp.assert_worker_contract(
        'claim_limit_is_bounded',
        v_failed,
        'Claim requests above the hard maximum of 16 must fail'
    );
END;
$claim_bounds$;

DO $success_and_replay$
DECLARE
    v_manager_id UUID := '93400000-0000-0000-0000-000000000001';
    v_sample_id UUID := '93400010-0000-0000-0000-000000000001';
    v_result_id UUID := '93400020-0000-0000-0000-000000000001';
    v_batch_id UUID;
    v_claim JSONB;
    v_item_id UUID;
    v_claim_token UUID;
    v_outcome JSONB;
    v_replay JSONB;
    v_audit_count BIGINT;
BEGIN
    v_batch_id := pg_temp.create_worker_batch(
        v_manager_id,
        '93400000-0000-0000-0000-000000000101',
        ARRAY[v_sample_id]
    );
    v_claim := pg_temp.claim_worker_items(1, 60) -> 0;
    v_item_id := (v_claim ->> 'batch_item_id')::UUID;
    v_claim_token := (v_claim ->> 'claim_token')::UUID;

    PERFORM pg_temp.assert_worker_contract(
        'claim_derives_opaque_execution_identity',
        v_item_id = (
            SELECT id
            FROM public.approval_batch_items
            WHERE batch_id = v_batch_id
        )
        AND v_claim_token IS NOT NULL
        AND (v_claim ->> 'attempt_number')::INTEGER = 1
        AND (v_claim ->> 'claim_expires_at')::TIMESTAMPTZ >
            clock_timestamp(),
        'Claim output must contain only database-derived execution identity'
    );

    v_outcome := pg_temp.execute_worker_item(v_item_id, v_claim_token);

    SELECT count(*)
    INTO v_audit_count
    FROM public.audit_logs
    WHERE record_id IN (v_sample_id, v_result_id)
      AND operation = 'UPDATE';

    PERFORM pg_temp.assert_worker_contract(
        'execution_commits_manager_attributed_approval',
        COALESCE((v_outcome ->> 'success')::BOOLEAN, FALSE)
        AND v_outcome ->> 'outcome_code' = 'APPROVED'
        AND EXISTS (
            SELECT 1
            FROM public.results
            WHERE id = v_result_id
              AND status = 'approved'
              AND approved_by = v_manager_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.audit_logs
            WHERE record_id IN (v_sample_id, v_result_id)
              AND operation = 'UPDATE'
              AND changed_by = v_manager_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.approval_batch_items
            WHERE id = v_item_id
              AND status = 'succeeded'
              AND claim_token IS NULL
        )
        AND EXISTS (
            SELECT 1
            FROM public.approval_batches
            WHERE id = v_batch_id
              AND status = 'completed'
        ),
        'Execution must derive inputs, approve atomically, and attribute audits to requested_by'
    );

    v_replay := pg_temp.execute_worker_item(v_item_id, v_claim_token);

    PERFORM pg_temp.assert_worker_contract(
        'committed_execution_replay_is_idempotent',
        COALESCE((v_replay ->> 'success')::BOOLEAN, FALSE)
        AND v_replay ->> 'outcome_code' = 'ITEM_ALREADY_SUCCEEDED'
        AND (
            SELECT count(*)
            FROM public.audit_logs
            WHERE record_id IN (v_sample_id, v_result_id)
              AND operation = 'UPDATE'
        ) = v_audit_count
        AND (
            SELECT count(*)
            FROM public.approval_batch_item_attempts
            WHERE batch_item_id = v_item_id
              AND event_type = 'succeeded'
        ) = 1,
        'A response-loss replay must not duplicate approval or audit evidence'
    );
END;
$success_and_replay$;

DO $business_failure$
DECLARE
    v_manager_id UUID := '93400000-0000-0000-0000-000000000001';
    v_sample_id UUID := '93400010-0000-0000-0000-000000000002';
    v_result_id UUID := '93400020-0000-0000-0000-000000000002';
    v_batch_id UUID;
    v_claim JSONB;
    v_outcome JSONB;
BEGIN
    v_batch_id := pg_temp.create_worker_batch(
        v_manager_id,
        '93400000-0000-0000-0000-000000000102',
        ARRAY[v_sample_id]
    );
    v_claim := pg_temp.claim_worker_items(1, 60) -> 0;

    UPDATE public.users
    SET role = 'analyst'
    WHERE id = v_manager_id;

    v_outcome := pg_temp.execute_worker_item(
        (v_claim ->> 'batch_item_id')::UUID,
        (v_claim ->> 'claim_token')::UUID
    );

    UPDATE public.users
    SET role = 'manager'
    WHERE id = v_manager_id;

    PERFORM pg_temp.assert_worker_contract(
        'authorization_failure_is_terminal',
        NOT COALESCE((v_outcome ->> 'success')::BOOLEAN, TRUE)
        AND v_outcome ->> 'outcome_code' = 'MANAGER_REQUIRED'
        AND EXISTS (
            SELECT 1
            FROM public.approval_batch_items
            WHERE batch_id = v_batch_id
              AND status = 'failed'
              AND terminal_error_code = 'MANAGER_REQUIRED'
              AND next_attempt_at IS NULL
        )
        AND EXISTS (
            SELECT 1
            FROM public.results
            WHERE id = v_result_id
              AND status = 'entered'
        ),
        'Current manager authorization must be revalidated without automatic retry'
    );
END;
$business_failure$;

DO $lease_replacement$
DECLARE
    v_manager_id UUID := '93400000-0000-0000-0000-000000000001';
    v_sample_id UUID := '93400010-0000-0000-0000-000000000003';
    v_batch_id UUID;
    v_first JSONB;
    v_second JSONB;
    v_third JSONB;
    v_stale JSONB;
    v_item_id UUID;
BEGIN
    v_batch_id := pg_temp.create_worker_batch(
        v_manager_id,
        '93400000-0000-0000-0000-000000000103',
        ARRAY[v_sample_id]
    );
    v_first := pg_temp.claim_worker_items(1, 60) -> 0;
    v_item_id := (v_first ->> 'batch_item_id')::UUID;

    UPDATE public.approval_batch_items
    SET claim_expires_at = clock_timestamp() - INTERVAL '1 second'
    WHERE id = v_item_id;

    v_second := pg_temp.claim_worker_items(1, 60) -> 0;
    v_stale := pg_temp.execute_worker_item(
        v_item_id,
        (v_first ->> 'claim_token')::UUID
    );

    PERFORM pg_temp.assert_worker_contract(
        'expired_lease_is_replaced_and_stale_token_rejected',
        (v_second ->> 'batch_item_id')::UUID = v_item_id
        AND (v_second ->> 'attempt_number')::INTEGER = 2
        AND v_second ->> 'claim_token' <> v_first ->> 'claim_token'
        AND NOT COALESCE((v_stale ->> 'success')::BOOLEAN, TRUE)
        AND v_stale ->> 'outcome_code' = 'STALE_CLAIM'
        AND (
            SELECT count(*)
            FROM public.approval_batch_item_attempts
            WHERE batch_item_id = v_item_id
              AND event_type = 'retry_scheduled'
              AND error_code = 'LEASE_EXPIRED'
        ) = 1,
        'Lease recovery must rotate tokens and preserve interruption evidence'
    );

    UPDATE public.approval_batch_items
    SET claim_expires_at = clock_timestamp() - INTERVAL '1 second'
    WHERE id = v_item_id;
    v_third := pg_temp.claim_worker_items(1, 60) -> 0;

    UPDATE public.approval_batch_items
    SET claim_expires_at = clock_timestamp() - INTERVAL '1 second'
    WHERE id = v_item_id;
    PERFORM pg_temp.claim_worker_items(1, 60);

    PERFORM pg_temp.assert_worker_contract(
        'automatic_attempts_stop_after_three',
        (v_third ->> 'attempt_number')::INTEGER = 3
        AND EXISTS (
            SELECT 1
            FROM public.approval_batch_items
            WHERE id = v_item_id
              AND status = 'failed'
              AND attempt_count = 3
              AND terminal_error_code = 'AUTOMATIC_RETRIES_EXHAUSTED'
        )
        AND EXISTS (
            SELECT 1
            FROM public.approval_batches
            WHERE id = v_batch_id
              AND status = 'completed_with_failures'
        ),
        'An expired third attempt must become terminal instead of being reclaimed'
    );
END;
$lease_replacement$;

CREATE FUNCTION public.approval_batch_worker_test_fail_terminal_refresh()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IN ('completed', 'completed_with_failures')
    THEN
        RAISE EXCEPTION 'terminal refresh interruption';
    END IF;

    RETURN NEW;
END;
$$;

DO $terminal_refresh_setup$
DECLARE
    v_manager_id UUID := '93400000-0000-0000-0000-000000000001';
    v_sample_id UUID := '93400010-0000-0000-0000-000000000004';
    v_batch_id UUID;
BEGIN
    SELECT id
    INTO v_batch_id
    FROM public.approval_batches
    WHERE requested_by = v_manager_id
      AND request_key = '93400000-0000-0000-0000-000000000104';

    IF v_batch_id IS NULL THEN
        v_batch_id := pg_temp.create_worker_batch(
            v_manager_id,
            '93400000-0000-0000-0000-000000000104',
            ARRAY[v_sample_id]
        );
    END IF;

    CREATE TEMP TABLE approval_batch_worker_crash_state (
        batch_id UUID PRIMARY KEY,
        item_id UUID NOT NULL,
        claim_token UUID NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO approval_batch_worker_crash_state
    SELECT
        v_batch_id,
        (claim ->> 'batch_item_id')::UUID,
        (claim ->> 'claim_token')::UUID
    FROM (
        SELECT pg_temp.claim_worker_items(1, 60) -> 0 AS claim
    ) AS claimed;

    EXECUTE format(
        'CREATE TRIGGER approval_batch_worker_test_terminal_refresh '
        'BEFORE UPDATE ON public.approval_batches '
        'FOR EACH ROW WHEN ('
        'OLD.id = %L::uuid '
        'AND NEW.status IN (''completed'', ''completed_with_failures'')) '
        'EXECUTE FUNCTION public.approval_batch_worker_test_fail_terminal_refresh()',
        v_batch_id
    );
END;
$terminal_refresh_setup$;

DO $terminal_refresh_assertions$
DECLARE
    v_state approval_batch_worker_crash_state%ROWTYPE;
    v_result_id UUID := '93400020-0000-0000-0000-000000000004';
    v_failed BOOLEAN := FALSE;
    v_outcome JSONB;
BEGIN
    SELECT batch_id, item_id, claim_token
    INTO v_state
    FROM approval_batch_worker_crash_state;

    BEGIN
        PERFORM pg_temp.execute_worker_item(
            v_state.item_id,
            v_state.claim_token
        );
    EXCEPTION
        WHEN OTHERS THEN
            v_failed := SQLERRM = 'terminal refresh interruption';
    END;

    PERFORM pg_temp.assert_worker_contract(
        'terminal_status_interruption_rolls_back_approval',
        v_failed
        AND EXISTS (
            SELECT 1
            FROM public.results
            WHERE id = v_result_id
              AND status = 'entered'
        )
        AND EXISTS (
            SELECT 1
            FROM public.approval_batch_items
            WHERE id = v_state.item_id
              AND status = 'processing'
              AND claim_token = v_state.claim_token
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.approval_batch_item_attempts
            WHERE batch_item_id = v_state.item_id
              AND event_type IN ('started', 'succeeded', 'terminal_failure')
        ),
        'Approval and item completion must roll back if terminal derivation fails'
    );

    DROP TRIGGER approval_batch_worker_test_terminal_refresh
        ON public.approval_batches;

    v_outcome := pg_temp.execute_worker_item(
        v_state.item_id,
        v_state.claim_token
    );

    PERFORM pg_temp.assert_worker_contract(
        'same_claim_recovers_after_terminal_refresh_crash',
        COALESCE((v_outcome ->> 'success')::BOOLEAN, FALSE)
        AND EXISTS (
            SELECT 1
            FROM public.results
            WHERE id = v_result_id
              AND status = 'approved'
        ),
        'The still-active claim must remain executable after rollback'
    );
END;
$terminal_refresh_assertions$;

DROP FUNCTION public.approval_batch_worker_test_fail_terminal_refresh();

DO $security_runner$
BEGIN
    PERFORM pg_temp.assert_worker_contract(
        'registered_worker_security_checker_passes',
        public.test_approval_batch_worker_security(),
        'The registered P5 worker security checker must pass'
    );
END;
$security_runner$;

DO $report$
DECLARE
    v_failures TEXT;
BEGIN
    SELECT string_agg(test_name || ': ' || detail, E'\n' ORDER BY test_name)
    INTO v_failures
    FROM approval_batch_worker_assertions
    WHERE NOT passed;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION E'Approval batch worker contract failures:\n%', v_failures;
    END IF;
END;
$report$;

SELECT test_name, passed, detail
FROM approval_batch_worker_assertions
ORDER BY test_name;

ROLLBACK;
