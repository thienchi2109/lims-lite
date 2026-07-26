-- DARK APPROVAL BATCH PERSISTENCE RUNTIME CONTRACT
-- Verifies exact 200-item snapshots, idempotency, progress, reads, and retry.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE approval_batch_runtime_assertions (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.assert_approval_batch_runtime(
    p_test_name TEXT,
    p_condition BOOLEAN,
    p_detail TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO approval_batch_runtime_assertions
    VALUES (p_test_name, COALESCE(p_condition, FALSE), p_detail);
END;
$$;

DO $contract$
BEGIN
    IF to_regprocedure(
        'public.create_approval_batch_server('
        'uuid,uuid,text,uuid[],text,uuid,'
        'timestamp with time zone,text)'
    ) IS NULL
       OR to_regprocedure(
           'public.retry_failed_approval_batch_server('
           'uuid,uuid,uuid,uuid,timestamp with time zone,text)'
       ) IS NULL
       OR to_regprocedure(
           'public.get_approval_batch_progress(uuid)'
       ) IS NULL
       OR to_regprocedure(
           'public.get_approval_batch_outcomes(uuid,integer,integer)'
       ) IS NULL
    THEN
        RAISE EXCEPTION 'Migration 195 approval batch contracts are missing';
    END IF;
END;
$contract$;

DO $base_fixtures$
DECLARE
    v_manager_id UUID := '93200000-0000-0000-0000-000000000001';
    v_restricted_manager_id UUID :=
        '93200000-0000-0000-0000-000000000002';
    v_other_manager_id UUID := '93200000-0000-0000-0000-000000000003';
    v_analyst_id UUID := '93200000-0000-0000-0000-000000000004';
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_manager_id, 'approval-batch-manager@lims.local'),
        (
            v_restricted_manager_id,
            'approval-batch-restricted@lims.local'
        ),
        (v_other_manager_id, 'approval-batch-other@lims.local'),
        (v_analyst_id, 'approval-batch-analyst@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id, username, full_name, role, email,
        can_access_confidential, deleted_at
    )
    VALUES
        (
            v_manager_id, 'approval_batch_manager',
            'Approval Batch Manager', 'manager',
            'approval-batch-manager@lims.local', TRUE, NULL
        ),
        (
            v_restricted_manager_id, 'approval_batch_restricted',
            'Approval Batch Restricted Manager', 'manager',
            'approval-batch-restricted@lims.local', FALSE, NULL
        ),
        (
            v_other_manager_id, 'approval_batch_other',
            'Approval Batch Other Manager', 'manager',
            'approval-batch-other@lims.local', TRUE, NULL
        ),
        (
            v_analyst_id, 'approval_batch_analyst',
            'Approval Batch Analyst', 'analyst',
            'approval-batch-analyst@lims.local', TRUE, NULL
        )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    INSERT INTO public.clients (
        id, id_card_num, name, date_of_birth, gender, phone, address
    )
    VALUES (
        '93200000-0000-0000-0000-000000000005',
        '079206093201', 'Approval Batch Client',
        DATE '1990-01-01', 'Nam', '0900093201', 'CDC'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.assay_definitions (
        id, name, units, is_confidential, normal_range, method_name
    )
    VALUES
        (
            '93200000-0000-0000-0000-000000000006',
            'Approval Batch Normal Assay', 'unit', FALSE, '0-10',
            'Approval Batch Method'
        ),
        (
            '93200000-0000-0000-0000-000000000007',
            'Approval Batch Confidential Assay', 'unit', TRUE, 'Negative',
            'Approval Batch Confidential Method'
        )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.samples (
        id, sample_id, client_id, client_name, status, received_by,
        type, sample_quality
    )
    SELECT
        (
            '93200010-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        'BATCH-P3-' || lpad(series::TEXT, 3, '0'),
        '93200000-0000-0000-0000-000000000005'::UUID,
        'Approval Batch Client',
        'review'::public.sample_status,
        v_analyst_id,
        'Máu',
        TRUE
    FROM generate_series(1, 200) AS fixtures(series);

    INSERT INTO public.results (
        id, sample_id, assay_id, value, status, entered_by, entered_at
    )
    SELECT
        (
            '93200020-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        (
            '93200010-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        CASE
            WHEN series = 200 THEN
                '93200000-0000-0000-0000-000000000007'::UUID
            ELSE
                '93200000-0000-0000-0000-000000000006'::UUID
        END,
        series::TEXT,
        'entered'::public.result_status,
        v_analyst_id,
        NOW()
    FROM generate_series(1, 200) AS fixtures(series);

    INSERT INTO public.results (
        id, sample_id, assay_id, value, status, entered_by, entered_at,
        approved_by, approved_at
    )
    VALUES (
        '93200021-0000-0000-0000-000000000001',
        '93200010-0000-0000-0000-000000000001',
        '93200000-0000-0000-0000-000000000006',
        'historic', 'approved', v_analyst_id, NOW(),
        v_manager_id, NOW()
    );
END;
$base_fixtures$;

DO $create_batch$
DECLARE
    v_manager_id UUID := '93200000-0000-0000-0000-000000000001';
    v_sample_ids UUID[];
    v_outcome JSONB;
    v_invalid_selection_outcome JSONB;
    v_batch_id UUID;
    v_expected_fingerprint TEXT;
BEGIN
    SELECT array_agg(id ORDER BY id DESC)
    INTO v_sample_ids
    FROM public.samples
    WHERE sample_id LIKE 'BATCH-P3-%';

    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

    v_invalid_selection_outcome := public.create_approval_batch_server(
        v_manager_id,
        '93200000-0000-0000-0000-000000000099',
        NULL,
        v_sample_ids,
        'Duyệt lô P3',
        '93200000-0000-0000-0000-000000000007',
        clock_timestamp(),
        'manager_email_otp'
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'null_selection_mode_is_invalid',
        (v_invalid_selection_outcome ->> 'success')::BOOLEAN IS FALSE
            AND v_invalid_selection_outcome ->> 'outcome_code'
                = 'INVALID_REQUEST'
            AND NOT EXISTS (
                SELECT 1
                FROM public.approval_batches
                WHERE requested_by = v_manager_id
                  AND request_key =
                      '93200000-0000-0000-0000-000000000099'::UUID
            ),
        'A null selection mode must be rejected before persistence'
    );

    v_outcome := public.create_approval_batch_server(
        v_manager_id,
        '93200000-0000-0000-0000-000000000100',
        'all_pending',
        v_sample_ids,
        '  Duyệt lô P3  ',
        '93200000-0000-0000-0000-000000000008',
        clock_timestamp(),
        'manager_email_otp'
    );
    v_batch_id := (v_outcome ->> 'batch_id')::UUID;

    PERFORM pg_temp.assert_approval_batch_runtime(
        'create_200_item_batch',
        (v_outcome ->> 'success')::BOOLEAN
            AND v_outcome ->> 'outcome_code' = 'BATCH_CREATED'
            AND (v_outcome ->> 'item_count')::INTEGER = 200
            AND v_batch_id IS NOT NULL
            AND (
                SELECT count(*)
                FROM public.approval_batch_items
                WHERE batch_id = v_batch_id
            ) = 200,
        'A valid 200-sample request must create exactly one batch and 200 items'
    );

    SELECT public.approval_batch_request_fingerprint(
        array_agg(id ORDER BY id),
        'Duyệt lô P3',
        'all_pending'
    )
    INTO v_expected_fingerprint
    FROM public.samples
    WHERE sample_id LIKE 'BATCH-P3-%';

    PERFORM pg_temp.assert_approval_batch_runtime(
        'canonical_request_fingerprint',
        (
            SELECT request_fingerprint = v_expected_fingerprint
                AND approval_note = 'Duyệt lô P3'
                AND request_mode = 'all_pending'
            FROM public.approval_batches
            WHERE id = v_batch_id
        ),
        'Fingerprint must include sorted IDs, normalized note, and selectionMode'
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'exact_entered_result_snapshot',
        NOT EXISTS (
            SELECT 1
            FROM public.approval_batch_items AS item
            WHERE item.batch_id = v_batch_id
              AND (
                  cardinality(item.selected_result_ids) <> 1
                  OR item.selected_result_ids[1] <> (
                      '93200020-0000-0000-0000-'
                      || right(item.sample_id::TEXT, 12)
                  )::UUID
              )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.approval_batch_items
            WHERE batch_id = v_batch_id
              AND '93200021-0000-0000-0000-000000000001'::UUID
                  = ANY(selected_result_ids)
        ),
        'Items must snapshot only results currently in entered status'
    );

    INSERT INTO public.results (
        id, sample_id, assay_id, value, status, entered_by, entered_at
    )
    VALUES (
        '93200022-0000-0000-0000-000000000001',
        '93200010-0000-0000-0000-000000000001',
        '93200000-0000-0000-0000-000000000006',
        'later', 'entered',
        '93200000-0000-0000-0000-000000000004',
        NOW()
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'snapshot_does_not_expand',
        (
            SELECT cardinality(selected_result_ids) = 1
            FROM public.approval_batch_items
            WHERE batch_id = v_batch_id
              AND sample_id =
                  '93200010-0000-0000-0000-000000000001'
        ),
        'Results created after acceptance must not enter the immutable snapshot'
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'create_audit_actor_is_requesting_manager',
        (
            SELECT count(*) = 1
            FROM public.audit_logs
            WHERE table_name = 'approval_batches'
              AND record_id = v_batch_id
              AND operation = 'INSERT'
              AND changed_by = v_manager_id
        )
        AND (
            SELECT count(*) = 200
            FROM public.audit_logs
            WHERE table_name = 'approval_batch_items'
              AND operation = 'INSERT'
              AND changed_by = v_manager_id
              AND (new_values ->> 'batch_id')::UUID = v_batch_id
        ),
        'Batch and item insert audits must attribute the requesting manager'
    );

    CREATE TEMP TABLE approval_batch_runtime_state (
        batch_id UUID PRIMARY KEY
    ) ON COMMIT DROP;
    INSERT INTO approval_batch_runtime_state VALUES (v_batch_id);
END;
$create_batch$;

DO $idempotency_and_atomicity$
DECLARE
    v_manager_id UUID := '93200000-0000-0000-0000-000000000001';
    v_restricted_manager_id UUID :=
        '93200000-0000-0000-0000-000000000002';
    v_sample_ids UUID[];
    v_original_batch_id UUID := (
        SELECT batch_id FROM approval_batch_runtime_state
    );
    v_replay JSONB;
    v_conflict JSONB;
    v_denied JSONB;
    v_before_count BIGINT;
BEGIN
    SELECT array_agg(id ORDER BY id)
    INTO v_sample_ids
    FROM public.samples
    WHERE sample_id LIKE 'BATCH-P3-%';

    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

    v_replay := public.create_approval_batch_server(
        v_manager_id,
        '93200000-0000-0000-0000-000000000100',
        'all_pending',
        v_sample_ids,
        'Duyệt lô P3',
        '93200000-0000-0000-0000-000000000008',
        clock_timestamp(),
        'manager_email_otp'
    );
    PERFORM pg_temp.assert_approval_batch_runtime(
        'idempotent_replay',
        (v_replay ->> 'success')::BOOLEAN
            AND v_replay ->> 'outcome_code' = 'BATCH_REPLAYED'
            AND (v_replay ->> 'batch_id')::UUID = v_original_batch_id
            AND (
                SELECT count(*)
                FROM public.approval_batches
                WHERE requested_by = v_manager_id
                  AND request_key =
                      '93200000-0000-0000-0000-000000000100'
            ) = 1,
        'Matching key and fingerprint must return the original batch'
    );

    v_conflict := public.create_approval_batch_server(
        v_manager_id,
        '93200000-0000-0000-0000-000000000100',
        'selected',
        v_sample_ids,
        'Duyệt lô P3',
        '93200000-0000-0000-0000-000000000009',
        clock_timestamp(),
        'manager_email_otp'
    );
    PERFORM pg_temp.assert_approval_batch_runtime(
        'idempotency_key_mismatch_conflict',
        (v_conflict ->> 'success')::BOOLEAN IS FALSE
            AND v_conflict ->> 'outcome_code' = 'IDEMPOTENCY_CONFLICT',
        'Reusing a request key for different intent must fail without mutation'
    );

    SELECT count(*) INTO v_before_count
    FROM public.approval_batches;

    v_denied := public.create_approval_batch_server(
        v_restricted_manager_id,
        '93200000-0000-0000-0000-000000000101',
        'selected',
        ARRAY[
            '93200010-0000-0000-0000-000000000001'::UUID,
            '93200010-0000-0000-0000-000000000200'::UUID
        ],
        NULL,
        '93200000-0000-0000-0000-000000000010',
        clock_timestamp(),
        'manager_email_otp'
    );
    PERFORM pg_temp.assert_approval_batch_runtime(
        'all_or_nothing_confidential_denial',
        (v_denied ->> 'success')::BOOLEAN IS FALSE
            AND v_denied ->> 'outcome_code'
                = 'CONFIDENTIAL_ACCESS_REQUIRED'
            AND (SELECT count(*) FROM public.approval_batches) = v_before_count,
        'One concealed sample must reject the whole request without partial rows'
    );

    v_denied := public.create_approval_batch_server(
        v_manager_id,
        '93200000-0000-0000-0000-000000000102',
        'selected',
        ARRAY[
            '93200010-0000-0000-0000-000000000001'::UUID,
            '93200010-0000-0000-0000-000000000002'::UUID
        ],
        NULL,
        '93200000-0000-0000-0000-000000000011',
        clock_timestamp(),
        'Bearer token'
    );
    PERFORM pg_temp.assert_approval_batch_runtime(
        'unsafe_step_up_metadata_rejected',
        (v_denied ->> 'success')::BOOLEAN IS FALSE
            AND v_denied ->> 'outcome_code' = 'INVALID_STEP_UP_METADATA'
            AND (SELECT count(*) FROM public.approval_batches) = v_before_count,
        'Only the fixed server-derived OTP cohort may be persisted'
    );
END;
$idempotency_and_atomicity$;

CREATE FUNCTION pg_temp.fail_second_approval_batch_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.sample_id =
        '93200010-0000-0000-0000-000000000002'::UUID
    THEN
        RAISE EXCEPTION 'approval batch item rollback probe';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER approval_batch_runtime_fail_second_item
BEFORE INSERT ON public.approval_batch_items
FOR EACH ROW
EXECUTE FUNCTION pg_temp.fail_second_approval_batch_item();

DO $post_insert_rollback$
DECLARE
    v_manager_id UUID := '93200000-0000-0000-0000-000000000001';
    v_failed BOOLEAN := FALSE;
    v_batch_count_before BIGINT;
    v_item_count_before BIGINT;
    v_audit_count_before BIGINT;
BEGIN
    SELECT count(*) INTO v_batch_count_before
    FROM public.approval_batches;
    SELECT count(*) INTO v_item_count_before
    FROM public.approval_batch_items;
    SELECT count(*) INTO v_audit_count_before
    FROM public.audit_logs
    WHERE table_name IN ('approval_batches', 'approval_batch_items');

    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

    BEGIN
        PERFORM public.create_approval_batch_server(
            v_manager_id,
            '93200000-0000-0000-0000-000000000103',
            'selected',
            ARRAY[
                '93200010-0000-0000-0000-000000000001'::UUID,
                '93200010-0000-0000-0000-000000000002'::UUID
            ],
            'Rollback after batch insert',
            '93200000-0000-0000-0000-000000000013',
            clock_timestamp(),
            'manager_email_otp'
        );
    EXCEPTION
        WHEN OTHERS THEN
            v_failed := TRUE;
    END;

    PERFORM pg_temp.assert_approval_batch_runtime(
        'item_insert_failure_rolls_back_batch_and_audit',
        v_failed
            AND (SELECT count(*) FROM public.approval_batches)
                = v_batch_count_before
            AND (SELECT count(*) FROM public.approval_batch_items)
                = v_item_count_before
            AND (
                SELECT count(*)
                FROM public.audit_logs
                WHERE table_name IN (
                    'approval_batches',
                    'approval_batch_items'
                )
            ) = v_audit_count_before,
        'A failure after batch insert must roll back batch, items, and audits'
    );
END;
$post_insert_rollback$;

DROP TRIGGER approval_batch_runtime_fail_second_item
ON public.approval_batch_items;
DROP FUNCTION pg_temp.fail_second_approval_batch_item();

DO $progress_and_owner_reads$
DECLARE
    v_batch_id UUID := (
        SELECT batch_id FROM approval_batch_runtime_state
    );
    v_manager_id UUID := '93200000-0000-0000-0000-000000000001';
    v_other_manager_id UUID := '93200000-0000-0000-0000-000000000003';
    v_progress JSONB;
    v_outcomes JSONB;
    v_plan JSON;
BEGIN
    WITH ranked AS (
        SELECT
            id,
            row_number() OVER (ORDER BY sample_id) AS item_number
        FROM public.approval_batch_items
        WHERE batch_id = v_batch_id
    )
    UPDATE public.approval_batch_items AS item
    SET status = CASE
            WHEN ranked.item_number <= 120 THEN 'queued'
            WHEN ranked.item_number <= 150 THEN 'processing'
            WHEN ranked.item_number <= 170 THEN 'retry_wait'
            WHEN ranked.item_number <= 190 THEN 'succeeded'
            ELSE 'failed'
        END,
        attempt_count = CASE
            WHEN ranked.item_number <= 120 THEN 0
            ELSE 1
        END,
        started_at = CASE
            WHEN ranked.item_number <= 120 THEN NULL
            ELSE clock_timestamp()
        END,
        claim_token = CASE
            WHEN ranked.item_number BETWEEN 121 AND 150 THEN (
                '93200030-0000-0000-0000-'
                || lpad(ranked.item_number::TEXT, 12, '0')
            )::UUID
            ELSE NULL
        END,
        claimed_at = CASE
            WHEN ranked.item_number BETWEEN 121 AND 150
                THEN clock_timestamp()
            ELSE NULL
        END,
        claim_expires_at = CASE
            WHEN ranked.item_number BETWEEN 121 AND 150
                THEN clock_timestamp() + INTERVAL '5 minutes'
            ELSE NULL
        END,
        next_attempt_at = CASE
            WHEN ranked.item_number BETWEEN 151 AND 170
                THEN clock_timestamp() + INTERVAL '1 minute'
            ELSE NULL
        END,
        terminal_error_code = CASE
            WHEN ranked.item_number > 190 THEN 'QC_BLOCKED'
            ELSE NULL
        END,
        error_params = CASE
            WHEN ranked.item_number > 190 THEN '{"blockedCount":1}'::JSONB
            ELSE '{}'::JSONB
        END,
        completed_at = CASE
            WHEN ranked.item_number > 170 THEN clock_timestamp()
            ELSE NULL
        END
    FROM ranked
    WHERE item.id = ranked.id;

    UPDATE public.approval_batches
    SET status = 'processing',
        started_at = clock_timestamp()
    WHERE id = v_batch_id;

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

    v_progress := public.get_approval_batch_progress(v_batch_id);
    v_outcomes := public.get_approval_batch_outcomes(v_batch_id, 25, 0);

    PERFORM pg_temp.assert_approval_batch_runtime(
        'progress_aggregates_item_state',
        (v_progress ->> 'total')::INTEGER = 200
            AND (v_progress ->> 'queued')::INTEGER = 120
            AND (v_progress ->> 'processing')::INTEGER = 30
            AND (v_progress ->> 'retry_wait')::INTEGER = 20
            AND (v_progress ->> 'succeeded')::INTEGER = 20
            AND (v_progress ->> 'failed')::INTEGER = 10,
        'Progress must aggregate durable item rows instead of stored counters'
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'paginated_owner_outcomes',
        (v_outcomes ->> 'total')::INTEGER = 200
            AND jsonb_array_length(v_outcomes -> 'items') = 25
            AND (v_outcomes ->> 'limit')::INTEGER = 25
            AND (v_outcomes ->> 'offset')::INTEGER = 0,
        'Owner outcomes must be durable and paginated'
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'null_pagination_is_concealed',
        public.get_approval_batch_outcomes(v_batch_id, NULL, 0) IS NULL
            AND public.get_approval_batch_outcomes(
                v_batch_id,
                25,
                NULL
            ) IS NULL,
        'Null pagination arguments must not disable the read bounds'
    );

    UPDATE public.users
    SET can_access_confidential = FALSE
    WHERE id = v_manager_id;

    PERFORM pg_temp.assert_approval_batch_runtime(
        'owner_reads_recheck_confidential_access',
        public.get_approval_batch_progress(v_batch_id) IS NULL
            AND public.get_approval_batch_outcomes(v_batch_id, 25, 0) IS NULL,
        'Owner reads must be concealed after confidential access is revoked'
    );

    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = v_manager_id;

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_other_manager_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        v_other_manager_id::TEXT,
        TRUE
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'non_owner_reads_are_concealed',
        public.get_approval_batch_progress(v_batch_id) IS NULL
            AND public.get_approval_batch_outcomes(v_batch_id, 25, 0) IS NULL,
        'A manager who did not request the batch must learn nothing'
    );

    SET LOCAL enable_seqscan = off;
    EXECUTE format(
        'EXPLAIN (FORMAT JSON) '
        'SELECT count(*) FROM public.approval_batch_items '
        'WHERE batch_id = %L AND status = %L',
        v_batch_id,
        'failed'
    )
    INTO v_plan;

    PERFORM pg_temp.assert_approval_batch_runtime(
        'batch_status_index_used_for_progress',
        v_plan::TEXT ILIKE '%approval_batch_items_batch_status_idx%',
        'Representative 200-item aggregation must use the batch/status index'
    );
END;
$progress_and_owner_reads$;

DO $child_retry$
DECLARE
    v_parent_batch_id UUID := (
        SELECT batch_id FROM approval_batch_runtime_state
    );
    v_manager_id UUID := '93200000-0000-0000-0000-000000000001';
    v_retry_request_key UUID :=
        '93200000-0000-0000-0000-000000000104';
    v_failed_sample_ids UUID[];
    v_outcome JSONB;
    v_child_batch_id UUID;
    v_second_parent_outcome JSONB;
    v_second_parent_id UUID;
    v_lineage_conflict JSONB;
BEGIN
    UPDATE public.approval_batches
    SET status = 'completed_with_failures',
        completed_at = clock_timestamp()
    WHERE id = v_parent_batch_id;

    SELECT array_agg(sample_id ORDER BY sample_id)
    INTO v_failed_sample_ids
    FROM public.approval_batch_items
    WHERE batch_id = v_parent_batch_id
      AND status = 'failed';

    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

    UPDATE public.users
    SET can_access_confidential = FALSE
    WHERE id = v_manager_id;

    v_outcome := public.retry_failed_approval_batch_server(
        v_manager_id,
        v_parent_batch_id,
        v_retry_request_key,
        '93200000-0000-0000-0000-000000000012',
        clock_timestamp(),
        'manager_email_otp'
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'retry_rechecks_confidential_access',
        (v_outcome ->> 'success')::BOOLEAN IS FALSE
            AND v_outcome ->> 'outcome_code'
                = 'CONFIDENTIAL_ACCESS_REQUIRED'
            AND NOT EXISTS (
                SELECT 1
                FROM public.approval_batches
                WHERE requested_by = v_manager_id
                  AND request_key = v_retry_request_key
            ),
        'Retry must fail without child rows after confidential access is revoked'
    );

    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = v_manager_id;

    v_outcome := public.retry_failed_approval_batch_server(
        v_manager_id,
        v_parent_batch_id,
        v_retry_request_key,
        '93200000-0000-0000-0000-000000000012',
        clock_timestamp(),
        'manager_email_otp'
    );
    v_child_batch_id := (v_outcome ->> 'batch_id')::UUID;

    PERFORM pg_temp.assert_approval_batch_runtime(
        'retry_creates_child_from_failed_items',
        (v_outcome ->> 'success')::BOOLEAN
            AND v_outcome ->> 'outcome_code' = 'BATCH_CREATED'
            AND (v_outcome ->> 'item_count')::INTEGER = 10
            AND (
                SELECT parent_batch_id = v_parent_batch_id
                    AND request_mode = 'retry_failed'
                    AND status = 'queued'
                FROM public.approval_batches
                WHERE id = v_child_batch_id
            )
            AND (
                SELECT count(*)
                FROM public.approval_batch_items
                WHERE batch_id = v_child_batch_id
            ) = 10,
        'Manual retry must create a queued child batch from failed samples only'
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'retry_preserves_failed_snapshots',
        NOT EXISTS (
            SELECT 1
            FROM public.approval_batch_items AS child
            LEFT JOIN public.approval_batch_items AS parent
              ON parent.batch_id = v_parent_batch_id
             AND parent.sample_id = child.sample_id
             AND parent.status = 'failed'
            WHERE child.batch_id = v_child_batch_id
              AND (
                  parent.id IS NULL
                  OR child.selected_result_ids
                      IS DISTINCT FROM parent.selected_result_ids
              )
        ),
        'Child items must copy only immutable failed-item result snapshots'
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'retry_audit_actor_is_requesting_manager',
        (
            SELECT count(*) = 1
            FROM public.audit_logs
            WHERE table_name = 'approval_batches'
              AND record_id = v_child_batch_id
              AND operation = 'INSERT'
              AND changed_by = v_manager_id
        )
        AND (
            SELECT count(*) = 10
            FROM public.audit_logs
            WHERE table_name = 'approval_batch_items'
              AND operation = 'INSERT'
              AND changed_by = v_manager_id
              AND (new_values ->> 'batch_id')::UUID = v_child_batch_id
        ),
        'Child batch and item insert audits must attribute the requesting manager'
    );

    v_second_parent_outcome := public.create_approval_batch_server(
        v_manager_id,
        '93200000-0000-0000-0000-000000000105',
        'selected',
        v_failed_sample_ids,
        'Duyệt lô P3',
        '93200000-0000-0000-0000-000000000015',
        clock_timestamp(),
        'manager_email_otp'
    );
    v_second_parent_id :=
        (v_second_parent_outcome ->> 'batch_id')::UUID;

    UPDATE public.approval_batch_items
    SET status = 'failed',
        attempt_count = 1,
        started_at = clock_timestamp(),
        completed_at = clock_timestamp(),
        terminal_error_code = 'QC_BLOCKED',
        error_params = '{"blockedCount":1}'::JSONB
    WHERE batch_id = v_second_parent_id;

    UPDATE public.approval_batches
    SET status = 'completed_with_failures',
        completed_at = clock_timestamp()
    WHERE id = v_second_parent_id;

    v_lineage_conflict := public.retry_failed_approval_batch_server(
        v_manager_id,
        v_second_parent_id,
        v_retry_request_key,
        '93200000-0000-0000-0000-000000000016',
        clock_timestamp(),
        'manager_email_otp'
    );

    PERFORM pg_temp.assert_approval_batch_runtime(
        'retry_idempotency_binds_parent_lineage',
        (v_second_parent_outcome ->> 'success')::BOOLEAN
            AND (v_lineage_conflict ->> 'success')::BOOLEAN IS FALSE
            AND v_lineage_conflict ->> 'outcome_code'
                = 'IDEMPOTENCY_CONFLICT'
            AND (
                SELECT count(*)
                FROM public.approval_batches
                WHERE requested_by = v_manager_id
                  AND request_key = v_retry_request_key
            ) = 1,
        'A retry key cannot replay a child created for a different parent batch'
    );
END;
$child_retry$;

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
    FROM approval_batch_runtime_assertions
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION
            'Approval batch runtime tests failed:%',
            E'\n' || v_failed;
    END IF;
END;
$final$;

ROLLBACK;
SELECT 'approval-batch-persistence-runtime: ok' AS result;
