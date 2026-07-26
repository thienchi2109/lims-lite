-- DARK APPROVAL BATCH STORAGE SCHEMA AND SECURITY CONTRACT
-- Run after migration 194 through the approved home-server Docker path.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE approval_batch_schema_assertions (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.assert_approval_batch_schema(
    p_test_name TEXT,
    p_condition BOOLEAN,
    p_detail TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO approval_batch_schema_assertions
    VALUES (p_test_name, COALESCE(p_condition, FALSE), p_detail);
END;
$$;

CREATE FUNCTION pg_temp.assert_approval_batch_statement_fails(
    p_test_name TEXT,
    p_statement TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_failed BOOLEAN := FALSE;
BEGIN
    BEGIN
        EXECUTE p_statement;
    EXCEPTION
        WHEN OTHERS THEN
            v_failed := TRUE;
    END;

    PERFORM pg_temp.assert_approval_batch_schema(
        p_test_name,
        v_failed,
        'Expected statement to fail: ' || p_statement
    );
END;
$$;

DO $catalog$
DECLARE
    v_table_name TEXT;
    v_function REGPROCEDURE;
    v_function_definition TEXT;
    v_function_config TEXT[];
BEGIN
    FOREACH v_table_name IN ARRAY ARRAY[
        'approval_batches',
        'approval_batch_items',
        'approval_batch_item_attempts'
    ]
    LOOP
        IF to_regclass('public.' || v_table_name) IS NULL THEN
            RAISE EXCEPTION
                'Migration 194 relation public.% is missing',
                v_table_name;
        END IF;

        PERFORM pg_temp.assert_approval_batch_schema(
            v_table_name || '_rls_enabled_and_forced',
            (
                SELECT relrowsecurity AND relforcerowsecurity
                FROM pg_class
                WHERE oid = ('public.' || v_table_name)::REGCLASS
            ),
            'Batch relations must enable and force RLS'
        );

        PERFORM pg_temp.assert_approval_batch_schema(
            v_table_name || '_client_table_grants_absent',
            NOT EXISTS (
                SELECT 1
                FROM (VALUES
                    ('anon'::TEXT),
                    ('authenticated'),
                    ('service_role')
                ) AS api_role(role_name)
                CROSS JOIN (VALUES
                    ('SELECT'::TEXT),
                    ('INSERT'),
                    ('UPDATE'),
                    ('DELETE'),
                    ('TRUNCATE'),
                    ('REFERENCES'),
                    ('TRIGGER')
                ) AS table_privilege(privilege_name)
                WHERE has_table_privilege(
                    api_role.role_name,
                    format('public.%I', v_table_name),
                    table_privilege.privilege_name
                )
            ),
            'API roles must have no direct batch-table privileges'
        );
    END LOOP;

    PERFORM pg_temp.assert_approval_batch_schema(
        'safe_step_up_columns_only',
        (
            SELECT array_agg(column_name ORDER BY ordinal_position)
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'approval_batches'
              AND column_name LIKE 'step_up_%'
        ) = ARRAY[
            'step_up_authorization_id',
            'step_up_verified_at',
            'step_up_cohort'
        ]::TEXT[],
        'Step-up evidence must use only typed server-derived columns'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'forbidden_secret_columns_absent',
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN (
                  'approval_batches',
                  'approval_batch_items',
                  'approval_batch_item_attempts'
              )
              AND column_name ~* (
                  'otp|cookie|access_token|refresh_token|jwt|'
                  'authorization_header|step_up_metadata'
              )
        ),
        'OTP values, cookies, tokens, JWTs, and generic step-up JSON are forbidden'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'batch_status_constraint',
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.approval_batches'::REGCLASS
              AND conname = 'approval_batches_status_check'
              AND pg_get_constraintdef(oid) ILIKE '%completed_with_failures%'
        ),
        'Batch status constraint must include all four durable states'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'batch_parent_mode_constraint',
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.approval_batches'::REGCLASS
              AND conname = 'approval_batches_parent_mode_check'
              AND pg_get_constraintdef(oid) ILIKE '%retry_failed%'
              AND pg_get_constraintdef(oid) ILIKE '%parent_batch_id%'
        ),
        'Only retry_failed batches may have a parent, and every retry must have one'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'item_status_constraint',
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.approval_batch_items'::REGCLASS
              AND conname = 'approval_batch_items_status_check'
              AND pg_get_constraintdef(oid) ILIKE '%retry_wait%'
        ),
        'Item status constraint must include queued through terminal states'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'unique_manager_request_key',
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.approval_batches'::REGCLASS
              AND conname = 'approval_batches_requested_by_request_key_key'
              AND contype = 'u'
        ),
        'A manager request key must identify at most one batch'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'unique_batch_sample',
        EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.approval_batch_items'::REGCLASS
              AND conname = 'approval_batch_items_batch_id_sample_id_key'
              AND contype = 'u'
        ),
        'A sample must appear at most once in a batch'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'batch_status_index',
        EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'approval_batch_items'
              AND indexname = 'approval_batch_items_batch_status_idx'
              AND indexdef ILIKE '%(batch_id, status)%'
        ),
        'Progress aggregation requires an index beginning with (batch_id, status)'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'owner_select_policies',
        (
            SELECT count(*)
            FROM pg_policy
            WHERE polrelid IN (
                'public.approval_batches'::REGCLASS,
                'public.approval_batch_items'::REGCLASS,
                'public.approval_batch_item_attempts'::REGCLASS
            )
              AND polcmd = 'r'
        ) = 3
        AND NOT EXISTS (
            SELECT 1
            FROM pg_policy
            WHERE polrelid IN (
                'public.approval_batches'::REGCLASS,
                'public.approval_batch_items'::REGCLASS,
                'public.approval_batch_item_attempts'::REGCLASS
            )
              AND polcmd <> 'r'
        ),
        'Batch RLS must expose owner-scoped manager reads and no DML policy'
    );

    FOREACH v_function IN ARRAY ARRAY[
        to_regprocedure('public.approval_batch_owner_can_read(uuid)')
    ]
    LOOP
        IF v_function IS NULL THEN
            RAISE EXCEPTION 'Migration 194 storage helper function is missing';
        END IF;

        SELECT
            pg_get_functiondef(p.oid),
            p.proconfig
        INTO v_function_definition, v_function_config
        FROM pg_proc AS p
        WHERE p.oid = v_function;

        PERFORM pg_temp.assert_approval_batch_schema(
            v_function::TEXT || '_security_definer',
            v_function_definition ILIKE '%SECURITY DEFINER%',
            'Owner-read helper must be SECURITY DEFINER'
        );

        PERFORM pg_temp.assert_approval_batch_schema(
            v_function::TEXT || '_search_path',
            COALESCE(v_function_config, ARRAY[]::TEXT[])
                @> ARRAY['search_path=public, extensions, pg_temp'],
            'Owner-read helper must pin search_path'
        );
    END LOOP;
    SELECT pg_get_functiondef(
        'public.approval_batch_owner_can_read(uuid)'::REGPROCEDURE
    )
    INTO v_function_definition;

    PERFORM pg_temp.assert_approval_batch_schema(
        'owner_read_rechecks_confidential_access',
        v_function_definition ILIKE
            '%owned_batch.requested_by = auth.uid()%'
        AND v_function_definition ILIKE '%owner.can_access_confidential%'
        AND v_function_definition ILIKE '%owned_item.selected_result_ids%'
        AND v_function_definition ILIKE '%JOIN public.results%'
        AND v_function_definition ILIKE '%JOIN public.assay_definitions%'
        AND v_function_definition ILIKE '%assay.is_confidential%'
        AND v_function_definition ILIKE '%result.id IS NULL%'
        AND v_function_definition ILIKE
            '%result.sample_id IS DISTINCT FROM%owned_item.sample_id%'
        AND v_function_definition ILIKE '%assay.id IS NULL%'
        AND v_function_definition ILIKE
            '%current_result.sample_id = current_item.sample_id%'
        AND v_function_definition ILIKE
            '%current_assay.is_confidential%',
        'Owner reads must recheck current access to confidential snapshots'
    );


    PERFORM pg_temp.assert_approval_batch_schema(
        'authenticated_owner_helper_grant',
        has_function_privilege(
            'authenticated',
            'public.approval_batch_owner_can_read(uuid)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            'public.approval_batch_owner_can_read(uuid)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'service_role',
            'public.approval_batch_owner_can_read(uuid)',
            'EXECUTE'
        ),
        'Only authenticated callers may execute the owner-read helper'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'internal_helper_grants_absent',
        NOT EXISTS (
            SELECT 1
            FROM (VALUES
                ('anon'::TEXT),
                ('authenticated'),
                ('service_role')
            ) AS api_role(role_name)
            CROSS JOIN (VALUES
                ('public.approval_batch_uuid_array_is_canonical(uuid[])'::TEXT),
                ('public.approval_batch_error_params_are_safe(jsonb)'),
                ('public.approval_batch_request_fingerprint(uuid[],text,text)'),
                ('public.prevent_approval_batch_request_change()'),
                ('public.prevent_approval_batch_item_request_change()'),
                ('public.prevent_approval_batch_hard_delete()'),
                ('public.prevent_approval_batch_attempt_mutation()'),
                ('public.approval_batch_storage_catalog_is_exact()')
            ) AS internal_function(signature)
            WHERE has_function_privilege(
                api_role.role_name,
                internal_function.signature,
                'EXECUTE'
            )
        ),
        'Migration 194 helpers must not retain API-role execute privileges'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'storage_catalog_is_exact',
        public.approval_batch_storage_catalog_is_exact(),
        'Migration 194 exact storage catalog checker must pass'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'contract_functions_absent_after_storage',
        NOT EXISTS (
            SELECT 1
            FROM pg_proc AS function_record
            JOIN pg_namespace AS namespace
              ON namespace.oid = function_record.pronamespace
            WHERE namespace.nspname = 'public'
              AND function_record.proname = ANY(ARRAY[
                  'create_approval_batch_server',
                  'retry_failed_approval_batch_server',
                  'get_approval_batch_progress',
                  'get_approval_batch_outcomes',
                  'test_approval_batch_persistence_security'
              ])
        ),
        'Migration 194 must leave all approval batch contracts absent'
    );

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_function_definition;

    PERFORM pg_temp.assert_approval_batch_schema(
        'phase_p2_security_runner_unchanged',
        v_function_definition ILIKE '%Atomic Result Approval RPC Security%'
        AND v_function_definition NOT ILIKE
            '%Approval Batch Persistence Security%',
        'Migration 194 must not register approval batch persistence security'
    );
END;
$catalog$;

DO $fixtures_and_guards$
DECLARE
    v_manager_id UUID := '93100000-0000-0000-0000-000000000001';
    v_sample_id UUID := '93100000-0000-0000-0000-000000000002';
    v_result_id UUID := '93100000-0000-0000-0000-000000000003';
    v_batch_id UUID := '93100000-0000-0000-0000-000000000004';
    v_item_id UUID := '93100000-0000-0000-0000-000000000005';
    v_attempt_id UUID := '93100000-0000-0000-0000-000000000006';
    v_unresolved_batch_id UUID :=
        '93100000-0000-0000-0000-000000000013';
    v_unresolved_item_id UUID :=
        '93100000-0000-0000-0000-000000000014';
    v_terminal_updated_at TIMESTAMPTZ;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES (v_manager_id, 'approval-batch-schema@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id, username, full_name, role, email,
        can_access_confidential, deleted_at
    )
    VALUES (
        v_manager_id, 'approval_batch_schema_manager',
        'Approval Batch Schema Manager', 'manager',
        'approval-batch-schema@lims.local', TRUE, NULL
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'manager',
        can_access_confidential = TRUE,
        deleted_at = NULL;

    INSERT INTO public.clients (
        id, id_card_num, name, date_of_birth, gender, phone, address
    )
    VALUES (
        '93100000-0000-0000-0000-000000000007',
        '079206093101', 'Approval Batch Schema Client',
        DATE '1990-01-01', 'Nam', '0900093101', 'CDC'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.assay_definitions (
        id, name, units, is_confidential, normal_range, method_name
    )
    VALUES (
        '93100000-0000-0000-0000-000000000008',
        'Approval Batch Schema Assay', 'unit', FALSE, '0-10',
        'Approval Batch Method'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.samples (
        id, sample_id, client_id, client_name, status, received_by,
        type, sample_quality
    )
    VALUES (
        v_sample_id, 'BATCH-SCHEMA-001',
        '93100000-0000-0000-0000-000000000007',
        'Approval Batch Schema Client', 'review', v_manager_id,
        'Máu', TRUE
    );

    INSERT INTO public.results (
        id, sample_id, assay_id, value, status, entered_by, entered_at
    )
    VALUES (
        v_result_id, v_sample_id,
        '93100000-0000-0000-0000-000000000008',
        '1.0', 'entered', v_manager_id, NOW()
    );

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_manager_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_manager_id::TEXT, TRUE);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);

    INSERT INTO public.approval_batches (
        id, requested_by, request_key, request_mode, request_fingerprint,
        approval_note, step_up_authorization_id, step_up_verified_at,
        step_up_cohort
    )
    VALUES (
        v_batch_id, v_manager_id,
        '93100000-0000-0000-0000-000000000012', 'selected',
        repeat('0', 64), 'Immutable schema intent',
        '93100000-0000-0000-0000-000000000009',
        clock_timestamp(), 'manager_email_otp'
    );

    INSERT INTO public.approval_batch_items (
        id, batch_id, sample_id, selected_result_ids
    )
    VALUES (v_item_id, v_batch_id, v_sample_id, ARRAY[v_result_id]);

    INSERT INTO public.approval_batch_item_attempts (
        id, batch_item_id, attempt_number, event_type, claim_token
    )
    VALUES (
        v_attempt_id, v_item_id, 1, 'claimed',
        '93100000-0000-0000-0000-000000000010'
    );

    PERFORM pg_temp.assert_approval_batch_statement_fails(
        'retry_batch_requires_parent',
        format(
            'INSERT INTO public.approval_batches ('
            'id, requested_by, request_key, request_mode, '
            'request_fingerprint, step_up_authorization_id, '
            'step_up_verified_at, step_up_cohort) VALUES ('
            '%L, %L, %L, %L, repeat(''1'', 64), %L, '
            'clock_timestamp(), %L)',
            '93100000-0000-0000-0000-000000000015',
            v_manager_id,
            '93100000-0000-0000-0000-000000000016',
            'retry_failed',
            '93100000-0000-0000-0000-000000000017',
            'manager_email_otp'
        )
    );
    PERFORM pg_temp.assert_approval_batch_statement_fails(
        'normal_batch_forbids_parent',
        format(
            'INSERT INTO public.approval_batches ('
            'id, requested_by, parent_batch_id, request_key, request_mode, '
            'request_fingerprint, step_up_authorization_id, '
            'step_up_verified_at, step_up_cohort) VALUES ('
            '%L, %L, %L, %L, %L, repeat(''2'', 64), %L, '
            'clock_timestamp(), %L)',
            '93100000-0000-0000-0000-000000000018',
            v_manager_id,
            v_batch_id,
            '93100000-0000-0000-0000-000000000019',
            'selected',
            '93100000-0000-0000-0000-000000000020',
            'manager_email_otp'
        )
    );

    INSERT INTO public.approval_batches (
        id, requested_by, request_key, request_mode, request_fingerprint,
        step_up_authorization_id, step_up_verified_at, step_up_cohort
    )
    VALUES (
        v_unresolved_batch_id,
        v_manager_id,
        '93100000-0000-0000-0000-000000000021',
        'selected',
        repeat('3', 64),
        '93100000-0000-0000-0000-000000000022',
        clock_timestamp(),
        'manager_email_otp'
    );
    INSERT INTO public.approval_batch_items (
        id, batch_id, sample_id, selected_result_ids
    )
    VALUES (
        v_unresolved_item_id,
        v_unresolved_batch_id,
        v_sample_id,
        ARRAY['93100000-0000-0000-0000-000000000023'::UUID]
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'owner_read_fails_closed_for_unresolved_snapshot',
        public.approval_batch_owner_can_read(v_unresolved_batch_id) IS FALSE,
        'Owner reads must conceal a batch when any snapshot result is unresolved'
    );

    PERFORM pg_temp.assert_approval_batch_statement_fails(
        'batch_request_is_immutable',
        format(
            'UPDATE public.approval_batches '
            'SET approval_note = %L WHERE id = %L',
            'changed',
            v_batch_id
        )
    );
    PERFORM pg_temp.assert_approval_batch_statement_fails(
        'item_snapshot_is_immutable',
        format(
            'UPDATE public.approval_batch_items '
            'SET selected_result_ids = ARRAY[%L::uuid] WHERE id = %L',
            '93100000-0000-0000-0000-000000000011',
            v_item_id
        )
    );
    PERFORM pg_temp.assert_approval_batch_statement_fails(
        'unsafe_error_params_are_rejected',
        format(
            'UPDATE public.approval_batch_items '
            'SET error_params = %L::jsonb WHERE id = %L',
            jsonb_build_object(
                'otp_code', '123456',
                'accessToken', 'secret',
                'authorizationHeader', 'Bearer secret',
                'session_token', 'secret'
            )::TEXT,
            v_item_id
        )
    );
    PERFORM pg_temp.assert_approval_batch_statement_fails(
        'attempt_is_append_only',
        format(
            'UPDATE public.approval_batch_item_attempts '
            'SET event_type = %L WHERE id = %L',
            'started',
            v_attempt_id
        )
    );

    UPDATE public.approval_batch_items
    SET status = 'succeeded',
        attempt_count = 1,
        started_at = clock_timestamp(),
        completed_at = clock_timestamp()
    WHERE id = v_item_id;

    SELECT updated_at
    INTO v_terminal_updated_at
    FROM public.approval_batch_items
    WHERE id = v_item_id;

    UPDATE public.approval_batch_items
    SET status = status
    WHERE id = v_item_id;

    PERFORM pg_temp.assert_approval_batch_schema(
        'terminal_item_noop_is_immutable',
        (
            SELECT updated_at = v_terminal_updated_at
            FROM public.approval_batch_items
            WHERE id = v_item_id
        ),
        'A terminal no-op update must not mutate updated_at'
    );

    PERFORM pg_temp.assert_approval_batch_statement_fails(
        'batch_has_no_hard_delete',
        format(
            'DELETE FROM public.approval_batches WHERE id = %L',
            v_batch_id
        )
    );
    PERFORM pg_temp.assert_approval_batch_statement_fails(
        'item_has_no_hard_delete',
        format(
            'DELETE FROM public.approval_batch_items WHERE id = %L',
            v_item_id
        )
    );
    PERFORM pg_temp.assert_approval_batch_statement_fails(
        'attempt_has_no_hard_delete',
        format(
            'DELETE FROM public.approval_batch_item_attempts WHERE id = %L',
            v_attempt_id
        )
    );
END;
$fixtures_and_guards$;

DO $final$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(
        test_name || ': ' || detail,
        E'\n'
        ORDER BY test_name
    )
    INTO v_failed
    FROM approval_batch_schema_assertions
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION
            'Approval batch schema tests failed:%',
            E'\n' || v_failed;
    END IF;
END;
$final$;

ROLLBACK;
SELECT 'approval-batch-storage-schema: ok' AS result;
