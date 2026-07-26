-- Migration 195: Add dark approval-batch database contracts.
--
-- Security impact:
-- - Requires the complete hardened storage baseline from migration 194.
-- - Adds service-role-only creation and child-retry mutation contracts.
-- - Adds authenticated manager-owner progress and outcome read contracts.
-- - Revalidates manager role and current confidential access and preserves the
--   manager as the audit actor without persisting OTPs, tokens, cookies, or JWTs.
-- - Registers focused approval-batch coverage in run_security_tests().
--
-- Application impact:
-- - Dark database contracts only. No API, UI, polling, or worker surface.
-- - Migrations 193 and 194 remain immutable after execution.

BEGIN;

SET LOCAL search_path TO public, extensions, pg_temp;

DO $baseline$
DECLARE
    v_runner_definition TEXT;
BEGIN
    IF to_regprocedure(
           'public.approve_sample_results_server(uuid,uuid,uuid[],text)'
       ) IS NULL
       OR to_regprocedure(
           'public.test_atomic_result_approval_rpc_security()'
       ) IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
       OR to_regprocedure(
           'public.approval_batch_storage_catalog_is_exact()'
       ) IS NULL
       OR (
           SELECT count(*)
           FROM pg_proc AS function_record
           JOIN pg_namespace AS namespace
             ON namespace.oid = function_record.pronamespace
           WHERE namespace.nspname = 'public'
             AND function_record.proname =
                 'approval_batch_storage_catalog_is_exact'
       ) <> 1
       OR NOT EXISTS (
           SELECT 1
           FROM pg_proc AS function_record
           JOIN pg_namespace AS namespace
             ON namespace.oid = function_record.pronamespace
           JOIN pg_language AS language_record
             ON language_record.oid = function_record.prolang
           WHERE namespace.nspname = 'public'
             AND function_record.proname =
                 'approval_batch_storage_catalog_is_exact'
             AND oidvectortypes(function_record.proargtypes) = ''
             AND format_type(function_record.prorettype, NULL) = 'boolean'
             AND language_record.lanname = 'plpgsql'
             AND function_record.provolatile = 's'
             AND NOT function_record.prosecdef
             AND function_record.proconfig IS NOT DISTINCT FROM ARRAY[
                 'search_path=public, extensions, pg_temp'
             ]::TEXT[]
             AND encode(
                 public.digest(function_record.prosrc, 'sha256'),
                 'hex'
             ) = 'eba54f449e017168fb4c8f2e5676575f1a8b6ebfe34223ceab59096e623a7f29'
       )
    THEN
        RAISE EXCEPTION
            'Migration 195 found an incomplete migration 194 function baseline';
    END IF;

    IF NOT public.approval_batch_storage_catalog_is_exact() THEN
        RAISE EXCEPTION
            'Migration 195 found a drifted migration 194 storage baseline';
    END IF;

    IF to_regclass('public.approval_batches') IS NULL
       OR to_regclass('public.approval_batch_items') IS NULL
       OR to_regclass('public.approval_batch_item_attempts') IS NULL
       OR (
           SELECT count(*)
           FROM pg_class
           WHERE oid = ANY(ARRAY[
               'public.approval_batches'::REGCLASS,
               'public.approval_batch_items'::REGCLASS,
               'public.approval_batch_item_attempts'::REGCLASS
           ])
             AND relrowsecurity
             AND relforcerowsecurity
       ) <> 3
       OR (
           SELECT count(*)
           FROM pg_constraint
           WHERE conname = ANY(ARRAY[
               'approval_batches_requested_by_request_key_key',
               'approval_batches_parent_not_self_check',
               'approval_batches_request_mode_check',
               'approval_batches_parent_mode_check',
               'approval_batches_request_fingerprint_check',
               'approval_batches_approval_note_check',
               'approval_batches_step_up_cohort_check',
               'approval_batches_step_up_time_check',
               'approval_batches_status_check',
               'approval_batches_status_timestamps_check',
               'approval_batch_items_batch_id_sample_id_key',
               'approval_batch_items_snapshot_check',
               'approval_batch_items_status_check',
               'approval_batch_items_attempt_count_check',
               'approval_batch_items_claim_check',
               'approval_batch_items_error_code_check',
               'approval_batch_items_error_params_check',
               'approval_batch_items_state_check',
               'approval_batch_item_attempts_event_key',
               'approval_batch_item_attempts_attempt_number_check',
               'approval_batch_item_attempts_event_type_check',
               'approval_batch_item_attempts_error_code_check',
               'approval_batch_item_attempts_error_params_check'
           ])
       ) <> 23
       OR (
           SELECT count(*)
           FROM pg_indexes
           WHERE schemaname = 'public'
             AND indexname = ANY(ARRAY[
                 'approval_batches_requested_by_created_at_idx',
                 'approval_batches_parent_batch_id_idx',
                 'approval_batch_items_batch_status_idx',
                 'approval_batch_items_batch_id_id_idx',
                 'approval_batch_items_sample_id_idx',
                 'approval_batch_item_attempts_item_time_idx'
             ])
       ) <> 6
       OR (
           SELECT count(*)
           FROM pg_trigger
           WHERE NOT tgisinternal
             AND tgname = ANY(ARRAY[
                 'approval_batches_immutable_request',
                 'approval_batches_no_hard_delete',
                 'audit_approval_batches_trigger',
                 'approval_batch_items_immutable_request',
                 'approval_batch_items_no_hard_delete',
                 'audit_approval_batch_items_trigger',
                 'approval_batch_item_attempts_append_only',
                 'audit_approval_batch_item_attempts_trigger'
             ])
       ) <> 8
       OR (
           SELECT count(*)
           FROM pg_policy
           WHERE polname = ANY(ARRAY[
               'approval_batches_owner_select',
               'approval_batch_items_owner_select',
               'approval_batch_item_attempts_owner_select'
           ])
             AND polcmd = 'r'
       ) <> 3
       OR EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = ANY(ARRAY[
               'public.approval_batches'::REGCLASS,
               'public.approval_batch_items'::REGCLASS,
               'public.approval_batch_item_attempts'::REGCLASS
           ])
             AND polcmd <> 'r'
       )
    THEN
        RAISE EXCEPTION
            'Migration 195 found an incomplete migration 194 storage catalog';
    END IF;

    IF (
           SELECT array_agg(column_name::TEXT ORDER BY column_name)
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'approval_batches'
             AND column_name LIKE 'step_up_%'
       ) IS DISTINCT FROM ARRAY[
           'step_up_authorization_id',
           'step_up_cohort',
           'step_up_verified_at'
       ]::TEXT[]
       OR EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name IN (
                 'approval_batches',
                 'approval_batch_items',
                 'approval_batch_item_attempts'
             )
             AND column_name ~
                 '(otp|cookie|access_token|refresh_token|jwt|authorization_header|step_up_metadata)'
       )
    THEN
        RAISE EXCEPTION
            'Migration 195 found an unsafe migration 194 storage surface';
    END IF;

    IF EXISTS (
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
    )
    THEN
        RAISE EXCEPTION
            'Migration 195 approval batch contracts already exist';
    END IF;

    IF NOT public.test_atomic_result_approval_rpc_security() THEN
        RAISE EXCEPTION
            'Migration 195 requires the Phase P2 atomic approval contract';
    END IF;

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    IF v_runner_definition NOT ILIKE
           '%Atomic Result Approval RPC Security%'
       OR v_runner_definition ILIKE
           '%Approval Batch Persistence Security%'
    THEN
        RAISE EXCEPTION
            'Migration 195 found an unexpected security registration baseline';
    END IF;
END;
$baseline$;

CREATE FUNCTION public.create_approval_batch_server(
    p_manager_id UUID,
    p_request_key UUID,
    p_selection_mode TEXT,
    p_sample_ids UUID[],
    p_approval_note TEXT,
    p_step_up_authorization_id UUID,
    p_step_up_verified_at TIMESTAMPTZ,
    p_step_up_cohort TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_caller_role TEXT := auth.role();
    v_manager_role public.user_role;
    v_manager_confidential BOOLEAN;
    v_normalized_note TEXT := CASE
        WHEN btrim(COALESCE(p_approval_note, '')) = '' THEN NULL
        ELSE btrim(p_approval_note)
    END;
    v_canonical_sample_ids UUID[];
    v_requested_count INTEGER;
    v_distinct_count INTEGER;
    v_null_count INTEGER;
    v_locked_count INTEGER;
    v_review_count INTEGER;
    v_snapshot_count INTEGER;
    v_has_confidential BOOLEAN;
    v_fingerprint TEXT;
    v_existing public.approval_batches%ROWTYPE;
    v_batch_id UUID;
    v_item_count INTEGER;
    v_previous_claims TEXT :=
        current_setting('request.jwt.claims', TRUE);
    v_previous_sub TEXT :=
        current_setting('request.jwt.claim.sub', TRUE);
    v_previous_role TEXT :=
        current_setting('request.jwt.claim.role', TRUE);
BEGIN
    IF v_caller_role IS DISTINCT FROM 'service_role' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'NOT_AUTHENTICATED'
        );
    END IF;

    SELECT
        array_agg(DISTINCT sample_id ORDER BY sample_id),
        count(*),
        count(DISTINCT sample_id),
        count(*) FILTER (WHERE sample_id IS NULL)
    INTO
        v_canonical_sample_ids,
        v_requested_count,
        v_distinct_count,
        v_null_count
    FROM unnest(COALESCE(p_sample_ids, ARRAY[]::UUID[]))
        AS selected(sample_id);

    IF p_manager_id IS NULL
       OR p_request_key IS NULL
       OR p_selection_mode IS NULL
       OR p_selection_mode NOT IN ('selected', 'all_pending')
       OR v_requested_count NOT BETWEEN 2 AND 200
       OR v_distinct_count <> v_requested_count
       OR v_null_count > 0
       OR char_length(v_normalized_note) > 500
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'INVALID_REQUEST'
        );
    END IF;

    IF p_step_up_authorization_id IS NULL
       OR p_step_up_verified_at IS NULL
       OR p_step_up_cohort IS DISTINCT FROM 'manager_email_otp'
       OR p_step_up_verified_at < clock_timestamp() - INTERVAL '15 minutes'
       OR p_step_up_verified_at > clock_timestamp() + INTERVAL '1 minute'
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'INVALID_STEP_UP_METADATA'
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

    v_fingerprint := public.approval_batch_request_fingerprint(
        v_canonical_sample_ids,
        v_normalized_note,
        p_selection_mode
    );

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            p_manager_id::TEXT || ':' || p_request_key::TEXT,
            193
        )
    );

    SELECT existing_batch.*
    INTO v_existing
    FROM public.approval_batches AS existing_batch
    WHERE existing_batch.requested_by = p_manager_id
      AND existing_batch.request_key = p_request_key;

    IF FOUND THEN
        IF v_existing.request_fingerprint = v_fingerprint THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'outcome_code', 'BATCH_REPLAYED',
                'batch_id', v_existing.id,
                'item_count', (
                    SELECT count(*)
                    FROM public.approval_batch_items
                    WHERE batch_id = v_existing.id
                )
            );
        END IF;

        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'IDEMPOTENCY_CONFLICT'
        );
    END IF;

    SELECT
        count(*),
        count(*) FILTER (
            WHERE locked_sample.status = 'review'::public.sample_status
        )
    INTO v_locked_count, v_review_count
    FROM (
        SELECT sample.id, sample.status
        FROM public.samples AS sample
        WHERE sample.id = ANY(v_canonical_sample_ids)
          AND sample.deleted_at IS NULL
        ORDER BY sample.id
        FOR UPDATE
    ) AS locked_sample;

    IF v_locked_count <> v_requested_count
       OR v_review_count <> v_requested_count
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'SAMPLE_NOT_ELIGIBLE'
        );
    END IF;

    PERFORM result.id
    FROM public.results AS result
    WHERE result.sample_id = ANY(v_canonical_sample_ids)
    ORDER BY result.sample_id, result.id
    FOR SHARE;

    SELECT count(DISTINCT result.sample_id)
    INTO v_snapshot_count
    FROM public.results AS result
    WHERE result.sample_id = ANY(v_canonical_sample_ids)
      AND result.status = 'entered'::public.result_status;

    IF v_snapshot_count <> v_requested_count THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'SAMPLE_NOT_ELIGIBLE'
        );
    END IF;

    PERFORM assay.id
    FROM public.assay_definitions AS assay
    WHERE assay.id IN (
        SELECT DISTINCT result.assay_id
        FROM public.results AS result
        WHERE result.sample_id = ANY(v_canonical_sample_ids)
    )
    ORDER BY assay.id
    FOR SHARE;

    SELECT COALESCE(bool_or(assay.is_confidential), FALSE)
    INTO v_has_confidential
    FROM public.results AS result
    JOIN public.assay_definitions AS assay
      ON assay.id = result.assay_id
    WHERE result.sample_id = ANY(v_canonical_sample_ids);

    IF v_has_confidential
       AND v_manager_confidential IS DISTINCT FROM TRUE
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'CONFIDENTIAL_ACCESS_REQUIRED'
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
        p_manager_id::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.role',
        'authenticated',
        TRUE
    );

    BEGIN
        INSERT INTO public.approval_batches (
            requested_by,
            request_key,
            request_mode,
            request_fingerprint,
            approval_note,
            step_up_authorization_id,
            step_up_verified_at,
            step_up_cohort
        )
        VALUES (
            p_manager_id,
            p_request_key,
            p_selection_mode,
            v_fingerprint,
            v_normalized_note,
            p_step_up_authorization_id,
            p_step_up_verified_at,
            p_step_up_cohort
        )
        RETURNING id INTO v_batch_id;

        INSERT INTO public.approval_batch_items (
            batch_id,
            sample_id,
            selected_result_ids
        )
        SELECT
            v_batch_id,
            result.sample_id,
            array_agg(result.id ORDER BY result.id)
        FROM public.results AS result
        WHERE result.sample_id = ANY(v_canonical_sample_ids)
          AND result.status = 'entered'::public.result_status
        GROUP BY result.sample_id
        ORDER BY result.sample_id;

        GET DIAGNOSTICS v_item_count = ROW_COUNT;
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

    RETURN jsonb_build_object(
        'success', TRUE,
        'outcome_code', 'BATCH_CREATED',
        'batch_id', v_batch_id,
        'item_count', v_item_count
    );
END;
$function$;

CREATE FUNCTION public.retry_failed_approval_batch_server(
    p_manager_id UUID,
    p_parent_batch_id UUID,
    p_request_key UUID,
    p_step_up_authorization_id UUID,
    p_step_up_verified_at TIMESTAMPTZ,
    p_step_up_cohort TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_caller_role TEXT := auth.role();
    v_manager_role public.user_role;
    v_manager_confidential BOOLEAN;
    v_parent public.approval_batches%ROWTYPE;
    v_failed_sample_ids UUID[];
    v_failed_count INTEGER;
    v_locked_sample_count INTEGER;
    v_expected_result_count INTEGER;
    v_locked_result_count INTEGER;
    v_has_confidential BOOLEAN;
    v_fingerprint TEXT;
    v_existing public.approval_batches%ROWTYPE;
    v_batch_id UUID;
    v_item_count INTEGER;
    v_previous_claims TEXT :=
        current_setting('request.jwt.claims', TRUE);
    v_previous_sub TEXT :=
        current_setting('request.jwt.claim.sub', TRUE);
    v_previous_role TEXT :=
        current_setting('request.jwt.claim.role', TRUE);
BEGIN
    IF v_caller_role IS DISTINCT FROM 'service_role' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'NOT_AUTHENTICATED'
        );
    END IF;

    IF p_manager_id IS NULL
       OR p_parent_batch_id IS NULL
       OR p_request_key IS NULL
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'INVALID_REQUEST'
        );
    END IF;

    IF p_step_up_authorization_id IS NULL
       OR p_step_up_verified_at IS NULL
       OR p_step_up_cohort IS DISTINCT FROM 'manager_email_otp'
       OR p_step_up_verified_at < clock_timestamp() - INTERVAL '15 minutes'
       OR p_step_up_verified_at > clock_timestamp() + INTERVAL '1 minute'
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'INVALID_STEP_UP_METADATA'
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

    SELECT parent_batch.*
    INTO v_parent
    FROM public.approval_batches AS parent_batch
    WHERE parent_batch.id = p_parent_batch_id
      AND parent_batch.requested_by = p_manager_id
      AND parent_batch.status = 'completed_with_failures'
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'PARENT_BATCH_NOT_FOUND'
        );
    END IF;

    SELECT
        array_agg(item.sample_id ORDER BY item.sample_id),
        count(*)
    INTO v_failed_sample_ids, v_failed_count
    FROM public.approval_batch_items AS item
    WHERE item.batch_id = p_parent_batch_id
      AND item.status = 'failed';

    IF v_failed_count < 1 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'NO_FAILED_ITEMS'
        );
    END IF;

    SELECT count(*)
    INTO v_locked_sample_count
    FROM (
        SELECT sample.id
        FROM public.samples AS sample
        WHERE sample.id = ANY(v_failed_sample_ids)
          AND sample.deleted_at IS NULL
        ORDER BY sample.id
        FOR UPDATE
    ) AS locked_sample;

    IF v_locked_sample_count <> v_failed_count THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'PARENT_BATCH_NOT_FOUND'
        );
    END IF;

    PERFORM result.id
    FROM public.results AS result
    WHERE result.sample_id = ANY(v_failed_sample_ids)
    ORDER BY result.sample_id, result.id
    FOR SHARE;

    SELECT count(*)
    INTO v_expected_result_count
    FROM public.approval_batch_items AS failed_item
    CROSS JOIN LATERAL unnest(
        failed_item.selected_result_ids
    ) AS selected(result_id)
    WHERE failed_item.batch_id = p_parent_batch_id
      AND failed_item.status = 'failed';

    SELECT count(*)
    INTO v_locked_result_count
    FROM (
        SELECT result.id
        FROM public.results AS result
        JOIN (
            SELECT
                failed_item.sample_id,
                selected.result_id
            FROM public.approval_batch_items AS failed_item
            CROSS JOIN LATERAL unnest(
                failed_item.selected_result_ids
            ) AS selected(result_id)
            WHERE failed_item.batch_id = p_parent_batch_id
              AND failed_item.status = 'failed'
        ) AS snapshot
         ON snapshot.result_id = result.id
         AND snapshot.sample_id = result.sample_id
        ORDER BY result.id
        FOR SHARE OF result
    ) AS locked_result;

    IF v_locked_result_count <> v_expected_result_count THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'PARENT_BATCH_NOT_FOUND'
        );
    END IF;

    PERFORM assay.id
    FROM public.assay_definitions AS assay
    WHERE assay.id IN (
        SELECT DISTINCT result.assay_id
        FROM public.results AS result
        WHERE result.sample_id = ANY(v_failed_sample_ids)
    )
    ORDER BY assay.id
    FOR SHARE;

    SELECT COALESCE(bool_or(assay.is_confidential), FALSE)
    INTO v_has_confidential
    FROM public.results AS result
    JOIN public.assay_definitions AS assay
      ON assay.id = result.assay_id
    WHERE result.sample_id = ANY(v_failed_sample_ids);

    IF v_has_confidential
       AND v_manager_confidential IS DISTINCT FROM TRUE
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'CONFIDENTIAL_ACCESS_REQUIRED'
        );
    END IF;

    v_fingerprint := public.approval_batch_request_fingerprint(
        v_failed_sample_ids,
        v_parent.approval_note,
        'retry_failed'
    );

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            p_manager_id::TEXT || ':' || p_request_key::TEXT,
            193
        )
    );

    SELECT existing_batch.*
    INTO v_existing
    FROM public.approval_batches AS existing_batch
    WHERE existing_batch.requested_by = p_manager_id
      AND existing_batch.request_key = p_request_key;

    IF FOUND THEN
        IF v_existing.request_fingerprint = v_fingerprint
           AND v_existing.parent_batch_id = p_parent_batch_id
        THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'outcome_code', 'BATCH_REPLAYED',
                'batch_id', v_existing.id,
                'item_count', (
                    SELECT count(*)
                    FROM public.approval_batch_items
                    WHERE batch_id = v_existing.id
                )
            );
        END IF;

        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'IDEMPOTENCY_CONFLICT'
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
        p_manager_id::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.role',
        'authenticated',
        TRUE
    );

    BEGIN
        INSERT INTO public.approval_batches (
            requested_by,
            parent_batch_id,
            request_key,
            request_mode,
            request_fingerprint,
            approval_note,
            step_up_authorization_id,
            step_up_verified_at,
            step_up_cohort
        )
        VALUES (
            p_manager_id,
            p_parent_batch_id,
            p_request_key,
            'retry_failed',
            v_fingerprint,
            v_parent.approval_note,
            p_step_up_authorization_id,
            p_step_up_verified_at,
            p_step_up_cohort
        )
        RETURNING id INTO v_batch_id;

        INSERT INTO public.approval_batch_items (
            batch_id,
            sample_id,
            selected_result_ids
        )
        SELECT
            v_batch_id,
            parent_item.sample_id,
            parent_item.selected_result_ids
        FROM public.approval_batch_items AS parent_item
        WHERE parent_item.batch_id = p_parent_batch_id
          AND parent_item.status = 'failed'
        ORDER BY parent_item.sample_id;

        GET DIAGNOSTICS v_item_count = ROW_COUNT;
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

    RETURN jsonb_build_object(
        'success', TRUE,
        'outcome_code', 'BATCH_CREATED',
        'batch_id', v_batch_id,
        'item_count', v_item_count
    );
END;
$function$;

CREATE FUNCTION public.get_approval_batch_progress(
    p_batch_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_progress JSONB;
BEGIN
    IF p_batch_id IS NULL
       OR NOT public.approval_batch_owner_can_read(p_batch_id)
    THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        'batch_id', batch.id,
        'status', batch.status,
        'created_at', batch.created_at,
        'started_at', batch.started_at,
        'completed_at', batch.completed_at,
        'total', count(item.id),
        'queued', count(*) FILTER (WHERE item.status = 'queued'),
        'processing', count(*) FILTER (WHERE item.status = 'processing'),
        'retry_wait', count(*) FILTER (WHERE item.status = 'retry_wait'),
        'succeeded', count(*) FILTER (WHERE item.status = 'succeeded'),
        'failed', count(*) FILTER (WHERE item.status = 'failed')
    )
    INTO v_progress
    FROM public.approval_batches AS batch
    JOIN public.approval_batch_items AS item
      ON item.batch_id = batch.id
    WHERE batch.id = p_batch_id
    GROUP BY
        batch.id,
        batch.status,
        batch.created_at,
        batch.started_at,
        batch.completed_at;

    RETURN v_progress;
END;
$function$;

CREATE FUNCTION public.get_approval_batch_outcomes(
    p_batch_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_total INTEGER;
    v_items JSONB;
BEGIN
    IF p_batch_id IS NULL
       OR p_limit IS NULL
       OR p_offset IS NULL
       OR p_limit NOT BETWEEN 1 AND 100
       OR p_offset < 0
       OR NOT public.approval_batch_owner_can_read(p_batch_id)
    THEN
        RETURN NULL;
    END IF;

    SELECT count(*)
    INTO v_total
    FROM public.approval_batch_items
    WHERE batch_id = p_batch_id;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'item_id', page.id,
                'sample_id', page.sample_id,
                'status', page.status,
                'attempt_count', page.attempt_count,
                'terminal_error_code', page.terminal_error_code,
                'error_params', page.error_params,
                'completed_at', page.completed_at
            )
            ORDER BY page.sample_id
        ),
        '[]'::JSONB
    )
    INTO v_items
    FROM (
        SELECT item.*
        FROM public.approval_batch_items AS item
        WHERE item.batch_id = p_batch_id
        ORDER BY item.sample_id
        LIMIT p_limit
        OFFSET p_offset
    ) AS page;

    RETURN jsonb_build_object(
        'batch_id', p_batch_id,
        'total', v_total,
        'limit', p_limit,
        'offset', p_offset,
        'items', v_items
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_approval_batch_server(
    UUID,
    UUID,
    TEXT,
    UUID[],
    TEXT,
    UUID,
    TIMESTAMPTZ,
    TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_approval_batch_server(
    UUID,
    UUID,
    TEXT,
    UUID[],
    TEXT,
    UUID,
    TIMESTAMPTZ,
    TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.retry_failed_approval_batch_server(
    UUID,
    UUID,
    UUID,
    UUID,
    TIMESTAMPTZ,
    TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_failed_approval_batch_server(
    UUID,
    UUID,
    UUID,
    UUID,
    TIMESTAMPTZ,
    TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.get_approval_batch_progress(UUID)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_approval_batch_progress(UUID)
TO authenticated;

REVOKE ALL ON FUNCTION public.get_approval_batch_outcomes(
    UUID,
    INTEGER,
    INTEGER
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_approval_batch_outcomes(
    UUID,
    INTEGER,
    INTEGER
) TO authenticated;

CREATE FUNCTION public.test_approval_batch_persistence_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $checker$
DECLARE
    v_table_name TEXT;
    v_function REGPROCEDURE;
    v_definition TEXT;
    v_config TEXT[];
BEGIN
    IF NOT public.approval_batch_storage_catalog_is_exact() THEN
        RAISE WARNING
            'SECURITY TEST FAILED: migration 194 storage catalog changed';
        RETURN FALSE;
    END IF;

    FOREACH v_table_name IN ARRAY ARRAY[
        'approval_batches',
        'approval_batch_items',
        'approval_batch_item_attempts'
    ]
    LOOP
        IF to_regclass('public.' || v_table_name) IS NULL
           OR NOT (
               SELECT relrowsecurity AND relforcerowsecurity
               FROM pg_class
               WHERE oid = ('public.' || v_table_name)::REGCLASS
           )
           OR EXISTS (
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
           )
        THEN
            RAISE WARNING
                'SECURITY TEST FAILED: % RLS or grants changed',
                v_table_name;
            RETURN FALSE;
        END IF;
    END LOOP;

    IF EXISTS (
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
    )
       OR (
           SELECT array_agg(column_name::TEXT ORDER BY ordinal_position)
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'approval_batches'
             AND column_name LIKE 'step_up_%'
       ) IS DISTINCT FROM ARRAY[
           'step_up_authorization_id',
           'step_up_verified_at',
           'step_up_cohort'
       ]::TEXT[]
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: unsafe step-up persistence surface';
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'approval_batch_items'
          AND indexname = 'approval_batch_items_batch_status_idx'
          AND indexdef ILIKE '%(batch_id, status)%'
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.approval_batches'::REGCLASS
             AND conname = 'approval_batches_parent_mode_check'
             AND pg_get_constraintdef(oid) ILIKE '%retry_failed%'
             AND pg_get_constraintdef(oid) ILIKE '%parent_batch_id%'
       )
       OR (
           SELECT count(*)
           FROM pg_policy
           WHERE polrelid IN (
               'public.approval_batches'::REGCLASS,
               'public.approval_batch_items'::REGCLASS,
               'public.approval_batch_item_attempts'::REGCLASS
           )
             AND polcmd = 'r'
       ) <> 3
       OR EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid IN (
               'public.approval_batches'::REGCLASS,
               'public.approval_batch_items'::REGCLASS,
               'public.approval_batch_item_attempts'::REGCLASS
           )
             AND polcmd <> 'r'
       )
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: batch index or RLS policies changed';
        RETURN FALSE;
    END IF;

    FOREACH v_function IN ARRAY ARRAY[
        to_regprocedure(
            'public.create_approval_batch_server('
            'uuid,uuid,text,uuid[],text,uuid,'
            'timestamp with time zone,text)'
        ),
        to_regprocedure(
            'public.retry_failed_approval_batch_server('
            'uuid,uuid,uuid,uuid,timestamp with time zone,text)'
        ),
        to_regprocedure('public.approval_batch_owner_can_read(uuid)'),
        to_regprocedure('public.get_approval_batch_progress(uuid)'),
        to_regprocedure(
            'public.get_approval_batch_outcomes(uuid,integer,integer)'
        )
    ]
    LOOP
        IF v_function IS NULL THEN
            RAISE WARNING
                'SECURITY TEST FAILED: approval batch contract missing';
            RETURN FALSE;
        END IF;

        SELECT
            pg_get_functiondef(p.oid),
            p.proconfig
        INTO v_definition, v_config
        FROM pg_proc AS p
        WHERE p.oid = v_function;

        IF v_definition NOT ILIKE '%SECURITY DEFINER%'
           OR NOT (
               COALESCE(v_config, ARRAY[]::TEXT[])
               @> ARRAY['search_path=public, extensions, pg_temp']
           )
        THEN
            RAISE WARNING
                'SECURITY TEST FAILED: % hardening changed',
                v_function::TEXT;
            RETURN FALSE;
        END IF;
    END LOOP;

    SELECT pg_get_functiondef(
        'public.approval_batch_owner_can_read(uuid)'::REGPROCEDURE
    )
    INTO v_definition;

    IF v_definition NOT ILIKE '%auth.role() = ''authenticated''%'
       OR v_definition NOT ILIKE
           '%owned_batch.requested_by = auth.uid()%'
       OR v_definition NOT ILIKE '%owner.can_access_confidential%'
       OR v_definition NOT ILIKE '%owned_item.selected_result_ids%'
       OR v_definition NOT ILIKE '%JOIN public.results%'
       OR v_definition NOT ILIKE '%JOIN public.assay_definitions%'
       OR v_definition NOT ILIKE '%assay.is_confidential%'
       OR v_definition NOT ILIKE '%result.id IS NULL%'
       OR v_definition NOT ILIKE
           '%result.sample_id IS DISTINCT FROM%owned_item.sample_id%'
       OR v_definition NOT ILIKE '%assay.id IS NULL%'
       OR v_definition NOT ILIKE
           '%current_result.sample_id = current_item.sample_id%'
       OR v_definition NOT ILIKE '%current_assay.is_confidential%'
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: owner read confidentiality guard changed';
        RETURN FALSE;
    END IF;

    IF NOT has_function_privilege(
           'service_role',
           'public.create_approval_batch_server('
           'uuid,uuid,text,uuid[],text,uuid,'
           'timestamp with time zone,text)',
           'EXECUTE'
       )
       OR NOT has_function_privilege(
           'service_role',
           'public.retry_failed_approval_batch_server('
           'uuid,uuid,uuid,uuid,timestamp with time zone,text)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'anon',
           'public.create_approval_batch_server('
           'uuid,uuid,text,uuid[],text,uuid,'
           'timestamp with time zone,text)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'authenticated',
           'public.create_approval_batch_server('
           'uuid,uuid,text,uuid[],text,uuid,'
           'timestamp with time zone,text)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'anon',
           'public.retry_failed_approval_batch_server('
           'uuid,uuid,uuid,uuid,timestamp with time zone,text)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'authenticated',
           'public.retry_failed_approval_batch_server('
           'uuid,uuid,uuid,uuid,timestamp with time zone,text)',
           'EXECUTE'
       )
       OR NOT has_function_privilege(
           'authenticated',
           'public.approval_batch_owner_can_read(uuid)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'anon',
           'public.approval_batch_owner_can_read(uuid)',
           'EXECUTE'
       )
       OR NOT has_function_privilege(
           'authenticated',
           'public.get_approval_batch_progress(uuid)',
           'EXECUTE'
       )
       OR NOT has_function_privilege(
           'authenticated',
           'public.get_approval_batch_outcomes(uuid,integer,integer)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'anon',
           'public.get_approval_batch_progress(uuid)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'service_role',
           'public.get_approval_batch_progress(uuid)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'anon',
           'public.get_approval_batch_outcomes(uuid,integer,integer)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'service_role',
           'public.get_approval_batch_outcomes(uuid,integer,integer)',
           'EXECUTE'
       )
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: approval batch function grants changed';
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef(
        'public.create_approval_batch_server('
        'uuid,uuid,text,uuid[],text,uuid,'
        'timestamp with time zone,text)'
        ::REGPROCEDURE
    )
    INTO v_definition;

    IF v_definition NOT ILIKE
           '%v_caller_role IS DISTINCT FROM ''service_role''%'
       OR v_definition NOT ILIKE
           '%v_manager_role IS DISTINCT FROM ''manager''%'
       OR v_definition NOT ILIKE
           '%CONFIDENTIAL_ACCESS_REQUIRED%'
       OR v_definition NOT ILIKE
           '%request.jwt.claims%'
       OR v_definition NOT ILIKE
           '%approval_batch_request_fingerprint%'
       OR v_definition NOT ILIKE
           '%p_selection_mode NOT IN (''selected'', ''all_pending'')%'
       OR v_definition NOT ILIKE
           '%ORDER BY sample.id%FOR UPDATE%'
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: batch create authorization changed';
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef(
        'public.retry_failed_approval_batch_server('
        'uuid,uuid,uuid,uuid,timestamp with time zone,text)'
        ::REGPROCEDURE
    )
    INTO v_definition;

    IF v_definition NOT ILIKE
           '%v_caller_role IS DISTINCT FROM ''service_role''%'
       OR v_definition NOT ILIKE
           '%parent_batch.requested_by = p_manager_id%'
       OR v_definition NOT ILIKE
           '%parent_item.status = ''failed''%'
       OR v_definition NOT ILIKE
           '%v_manager_confidential IS DISTINCT FROM TRUE%'
       OR v_definition NOT ILIKE
           '%v_existing.parent_batch_id = p_parent_batch_id%'
       OR v_definition NOT ILIKE
           '%ORDER BY sample.id%FOR UPDATE%'
       OR v_definition NOT ILIKE
           '%result.sample_id = ANY(v_failed_sample_ids)%'
       OR v_definition NOT ILIKE '%ORDER BY result.id%FOR SHARE%'
       OR v_definition NOT ILIKE
           '%v_locked_result_count <> v_expected_result_count%'
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: batch retry authorization changed';
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.approval_batches'::REGCLASS
          AND tgname = 'approval_batches_no_hard_delete'
          AND NOT tgisinternal
          AND tgenabled <> 'D'
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.approval_batch_items'::REGCLASS
             AND tgname = 'approval_batch_items_no_hard_delete'
             AND NOT tgisinternal
             AND tgenabled <> 'D'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid =
               'public.approval_batch_item_attempts'::REGCLASS
             AND tgname =
               'approval_batch_item_attempts_append_only'
             AND NOT tgisinternal
             AND tgenabled <> 'D'
       )
       OR (
           SELECT count(*)
           FROM pg_trigger
           WHERE tgrelid IN (
               'public.approval_batches'::REGCLASS,
               'public.approval_batch_items'::REGCLASS,
               'public.approval_batch_item_attempts'::REGCLASS
           )
             AND tgfoid =
                 'public.trigger_audit_log()'::REGPROCEDURE::OID
             AND NOT tgisinternal
             AND tgenabled <> 'D'
       ) <> 3
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: append-only or audit triggers changed';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$checker$;

REVOKE ALL ON FUNCTION public.test_approval_batch_persistence_security()
FROM PUBLIC;
GRANT EXECUTE
ON FUNCTION public.test_approval_batch_persistence_security()
TO authenticated;

DO $register_security_test$
DECLARE
    v_definition TEXT;
    v_anchor TEXT :=
        '(''Atomic Result Approval RPC Security''::TEXT, test_atomic_result_approval_rpc_security(), ''Verifies dark server-only execution, manager revalidation, deterministic locking, RLS preservation, audit triggers, grants, and pinned search_path''::TEXT);';
    v_replacement TEXT :=
        '(''Atomic Result Approval RPC Security''::TEXT, test_atomic_result_approval_rpc_security(), ''Verifies dark server-only execution, manager revalidation, deterministic locking, RLS preservation, audit triggers, grants, and pinned search_path''::TEXT),'
        || E'\n        '
        || '(''Approval Batch Persistence Security''::TEXT, test_approval_batch_persistence_security(), ''Verifies dark batch RLS, no direct DML, typed step-up evidence, append-only history, server-only mutations, owner reads, audit triggers, and pinned search_path''::TEXT);';
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;

    IF v_definition NOT LIKE '%' || v_anchor || '%'
       OR v_definition LIKE '%Approval Batch Persistence Security%'
    THEN
        RAISE EXCEPTION
            'Migration 195 found an unexpected security registration baseline';
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

    IF NOT public.test_approval_batch_persistence_security()
       OR v_runner_definition NOT ILIKE
           '%Approval Batch Persistence Security%'
       OR NOT EXISTS (
           SELECT 1
           FROM public.run_security_tests()
           WHERE test_name = 'Approval Batch Persistence Security'
             AND passed
       )
    THEN
        RAISE EXCEPTION
            'Migration 195 approval batch persistence verification failed';
    END IF;
END;
$verification$;

COMMENT ON FUNCTION public.create_approval_batch_server(
    UUID,
    UUID,
    TEXT,
    UUID[],
    TEXT,
    UUID,
    TIMESTAMPTZ,
    TEXT
) IS 'Server-only dark batch creation. Revalidates manager authority, snapshots entered results, and sets the manager audit actor.';

COMMENT ON FUNCTION public.retry_failed_approval_batch_server(
    UUID,
    UUID,
    UUID,
    UUID,
    TIMESTAMPTZ,
    TEXT
) IS 'Server-only child retry creation from immutable failed parent items.';

COMMENT ON FUNCTION public.get_approval_batch_progress(UUID)
IS 'Authenticated manager-owner aggregate progress read from durable item rows.';

COMMENT ON FUNCTION public.get_approval_batch_outcomes(
    UUID,
    INTEGER,
    INTEGER
) IS 'Authenticated manager-owner paginated sample outcome read.';

COMMENT ON FUNCTION public.test_approval_batch_persistence_security()
IS 'Verifies dark batch RLS, grants, typed step-up evidence, append-only history, server-only mutations, owner reads, and audit triggers.';

COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including dark approval-batch persistence coverage.';

NOTIFY pgrst, 'reload schema';

COMMIT;
