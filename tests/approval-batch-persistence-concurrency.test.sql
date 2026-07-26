-- APPROVAL BATCH PERSISTENCE CONCURRENCY CONTRACT
-- Proves sample locking excludes result inserts from an accepted snapshot.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

DO $contract$
BEGIN
    IF to_regprocedure(
        'public.create_approval_batch_server('
        'uuid,uuid,text,uuid[],text,uuid,timestamp with time zone,text)'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Migration 195 server-only batch creation contract is missing';
    END IF;
END;
$contract$;

DROP TRIGGER IF EXISTS approval_batch_concurrency_sleep_before_insert
ON public.approval_batches;
DROP FUNCTION IF EXISTS public.approval_batch_concurrency_sleep_probe();

CREATE FUNCTION pg_temp.cleanup_approval_batch_concurrency()
RETURNS VOID
LANGUAGE plpgsql
AS $cleanup$
DECLARE
    v_batch_ids UUID[] := ARRAY[]::UUID[];
    v_item_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO v_batch_ids
    FROM public.approval_batches
    WHERE requested_by =
        '93300000-0000-0000-0000-000000000001'::UUID
      AND request_key IN (
          '93300000-0000-0000-0000-000000000100'::UUID,
          '93300000-0000-0000-0000-000000000101'::UUID
      );

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO v_item_ids
    FROM public.approval_batch_items
    WHERE batch_id = ANY(v_batch_ids);

    EXECUTE
        'ALTER TABLE public.approval_batch_item_attempts '
        'DISABLE TRIGGER approval_batch_item_attempts_append_only';
    EXECUTE
        'ALTER TABLE public.approval_batch_items '
        'DISABLE TRIGGER approval_batch_items_no_hard_delete';
    EXECUTE
        'ALTER TABLE public.approval_batches '
        'DISABLE TRIGGER approval_batches_no_hard_delete';

    BEGIN
        DELETE FROM public.audit_logs
        WHERE record_id = ANY(v_batch_ids)
           OR record_id = ANY(v_item_ids);

        DELETE FROM public.approval_batch_item_attempts
        WHERE batch_item_id = ANY(v_item_ids);
        DELETE FROM public.approval_batch_items
        WHERE id = ANY(v_item_ids);
        DELETE FROM public.approval_batches
        WHERE id = ANY(v_batch_ids)
          AND parent_batch_id IS NOT NULL;
        DELETE FROM public.approval_batches
        WHERE id = ANY(v_batch_ids);
    EXCEPTION
        WHEN OTHERS THEN
            EXECUTE
                'ALTER TABLE public.approval_batch_item_attempts '
                'ENABLE TRIGGER approval_batch_item_attempts_append_only';
            EXECUTE
                'ALTER TABLE public.approval_batch_items '
                'ENABLE TRIGGER approval_batch_items_no_hard_delete';
            EXECUTE
                'ALTER TABLE public.approval_batches '
                'ENABLE TRIGGER approval_batches_no_hard_delete';
            RAISE;
    END;

    EXECUTE
        'ALTER TABLE public.approval_batch_item_attempts '
        'ENABLE TRIGGER approval_batch_item_attempts_append_only';
    EXECUTE
        'ALTER TABLE public.approval_batch_items '
        'ENABLE TRIGGER approval_batch_items_no_hard_delete';
    EXECUTE
        'ALTER TABLE public.approval_batches '
        'ENABLE TRIGGER approval_batches_no_hard_delete';

    DELETE FROM public.audit_logs
    WHERE record_id = ANY(v_batch_ids)
       OR record_id = ANY(v_item_ids)
       OR record_id::TEXT LIKE
           '93300000-0000-0000-0000-0000000000%';

    DELETE FROM public.results
    WHERE id IN (
        '93300000-0000-0000-0000-000000000020',
        '93300000-0000-0000-0000-000000000021',
        '93300000-0000-0000-0000-000000000022',
        '93300000-0000-0000-0000-000000000023'
    );
    DELETE FROM public.samples
    WHERE id IN (
        '93300000-0000-0000-0000-000000000010',
        '93300000-0000-0000-0000-000000000011'
    );
    DELETE FROM public.assay_definitions
    WHERE id IN (
        '93300000-0000-0000-0000-000000000005',
        '93300000-0000-0000-0000-000000000006'
    );
    DELETE FROM public.clients
    WHERE id = '93300000-0000-0000-0000-000000000004';
    DELETE FROM public.users
    WHERE id IN (
        '93300000-0000-0000-0000-000000000001',
        '93300000-0000-0000-0000-000000000003'
    );
    DELETE FROM auth.users
    WHERE id IN (
        '93300000-0000-0000-0000-000000000001',
        '93300000-0000-0000-0000-000000000003'
    );
    DELETE FROM public.audit_logs
    WHERE record_id::TEXT LIKE
        '93300000-0000-0000-0000-0000000000%';
END;
$cleanup$;

BEGIN;
SELECT pg_temp.cleanup_approval_batch_concurrency();

INSERT INTO auth.users (id, email)
VALUES
    (
        '93300000-0000-0000-0000-000000000001',
        'batch-concurrency-manager@lims.local'
    ),
    (
        '93300000-0000-0000-0000-000000000003',
        'batch-concurrency-analyst@lims.local'
    );

INSERT INTO public.users (
    id, username, full_name, role, email, can_access_confidential
)
VALUES
    (
        '93300000-0000-0000-0000-000000000001',
        'batch_concurrency_manager',
        'Batch Concurrency Manager',
        'manager',
        'batch-concurrency-manager@lims.local',
        TRUE
    ),
    (
        '93300000-0000-0000-0000-000000000003',
        'batch_concurrency_analyst',
        'Batch Concurrency Analyst',
        'analyst',
        'batch-concurrency-analyst@lims.local',
        TRUE
    );

INSERT INTO public.clients (
    id, id_card_num, name, date_of_birth, gender, phone, address
)
VALUES (
    '93300000-0000-0000-0000-000000000004',
    '079206093301',
    'Batch Concurrency Client',
    DATE '1990-01-01',
    'Nam',
    '0900093301',
    'CDC'
);

INSERT INTO public.assay_definitions (
    id, name, units, is_confidential, normal_range, method_name
)
VALUES
    (
        '93300000-0000-0000-0000-000000000005',
        'Batch Concurrency Normal Assay',
        'unit',
        FALSE,
        '0-10',
        'Batch Concurrency Method'
    ),
    (
        '93300000-0000-0000-0000-000000000006',
        'Batch Concurrency Confidential Assay',
        'unit',
        TRUE,
        'Negative',
        'Batch Concurrency Confidential Method'
    );

INSERT INTO public.samples (
    id, sample_id, client_id, client_name, status, received_by, type,
    sample_quality
)
VALUES
    (
        '93300000-0000-0000-0000-000000000010',
        'BATCH-P3-CONCURRENT-1',
        '93300000-0000-0000-0000-000000000004',
        'Batch Concurrency Client',
        'review',
        '93300000-0000-0000-0000-000000000003',
        'Máu',
        TRUE
    ),
    (
        '93300000-0000-0000-0000-000000000011',
        'BATCH-P3-CONCURRENT-2',
        '93300000-0000-0000-0000-000000000004',
        'Batch Concurrency Client',
        'review',
        '93300000-0000-0000-0000-000000000003',
        'Máu',
        TRUE
    );

INSERT INTO public.results (
    id, sample_id, assay_id, value, status, entered_by, entered_at
)
VALUES
    (
        '93300000-0000-0000-0000-000000000020',
        '93300000-0000-0000-0000-000000000010',
        '93300000-0000-0000-0000-000000000005',
        '5',
        'entered',
        '93300000-0000-0000-0000-000000000003',
        clock_timestamp()
    ),
    (
        '93300000-0000-0000-0000-000000000022',
        '93300000-0000-0000-0000-000000000011',
        '93300000-0000-0000-0000-000000000005',
        '6',
        'entered',
        '93300000-0000-0000-0000-000000000003',
        clock_timestamp()
    );
COMMIT;

CREATE FUNCTION public.approval_batch_concurrency_sleep_probe()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $trigger$
BEGIN
    IF NEW.request_key =
        '93300000-0000-0000-0000-000000000100'::UUID THEN
        PERFORM pg_advisory_xact_lock(193193001);
        PERFORM pg_sleep(2);
    ELSIF NEW.request_key =
        '93300000-0000-0000-0000-000000000101'::UUID THEN
        PERFORM pg_advisory_xact_lock(193193002);
        PERFORM pg_sleep(2);
    END IF;

    RETURN NEW;
END;
$trigger$;

CREATE TRIGGER approval_batch_concurrency_sleep_before_insert
BEFORE INSERT ON public.approval_batches
FOR EACH ROW
EXECUTE FUNCTION public.approval_batch_concurrency_sleep_probe();

\! rm -f /tmp/approval-batch-concurrency-a.out /tmp/approval-batch-concurrency-b.out /tmp/approval-batch-concurrency-status
\! timeout --kill-after=5s 40s sh -c "psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SET ROLE service_role; SET request.jwt.claims TO '{\\\"role\\\":\\\"service_role\\\"}'; SELECT public.create_approval_batch_server('93300000-0000-0000-0000-000000000001'::uuid, '93300000-0000-0000-0000-000000000100'::uuid, 'selected', ARRAY['93300000-0000-0000-0000-000000000010'::uuid, '93300000-0000-0000-0000-000000000011'::uuid], 'Concurrency snapshot', '93300000-0000-0000-0000-000000000008'::uuid, clock_timestamp(), 'manager_email_otp'); COMMIT;\" > /tmp/approval-batch-concurrency-a.out 2>&1 & first_pid=\$!; locked=f; for attempt in \$(seq 1 100); do locked=\$(psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = 193193001 AND granted);\"); [ \"\$locked\" = t ] && break; sleep 0.05; done; if [ \"\$locked\" = t ]; then psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"WITH started AS MATERIALIZED (SELECT clock_timestamp() AS started_at), inserted AS (INSERT INTO public.results (id, sample_id, assay_id, value, status, entered_by, entered_at) SELECT '93300000-0000-0000-0000-000000000021'::uuid, '93300000-0000-0000-0000-000000000010'::uuid, '93300000-0000-0000-0000-000000000006'::uuid, 'late-confidential', 'entered'::public.result_status, '93300000-0000-0000-0000-000000000003'::uuid, clock_timestamp() FROM started RETURNING 1) SELECT clock_timestamp() - (SELECT started_at FROM started) >= INTERVAL '1 second' FROM inserted;\" > /tmp/approval-batch-concurrency-b.out 2>&1; second_status=\$?; else second_status=1; fi; wait \$first_pid; first_status=\$?; [ \"\$first_status\" -eq 0 ] && [ \"\$second_status\" -eq 0 ] && grep -q '\"outcome_code\": \"BATCH_CREATED\"' /tmp/approval-batch-concurrency-a.out && grep -qx 't' /tmp/approval-batch-concurrency-b.out" && printf '0\n' > /tmp/approval-batch-concurrency-status || printf '1\n' > /tmp/approval-batch-concurrency-status
\set concurrency_shell_failed `cat /tmp/approval-batch-concurrency-status`

\if :concurrency_shell_failed
    \! cat /tmp/approval-batch-concurrency-a.out /tmp/approval-batch-concurrency-b.out
\else
    SELECT
        EXISTS (
            SELECT 1
            FROM public.approval_batches AS batch
            JOIN public.approval_batch_items AS item
              ON item.batch_id = batch.id
            WHERE batch.requested_by =
                '93300000-0000-0000-0000-000000000001'::UUID
              AND batch.request_key =
                '93300000-0000-0000-0000-000000000100'::UUID
              AND item.sample_id =
                '93300000-0000-0000-0000-000000000010'::UUID
              AND item.selected_result_ids = ARRAY[
                  '93300000-0000-0000-0000-000000000020'::UUID
              ]
        )
        AND EXISTS (
            SELECT 1
            FROM public.approval_batches AS batch
            JOIN public.approval_batch_items AS item
              ON item.batch_id = batch.id
            WHERE batch.request_key =
                '93300000-0000-0000-0000-000000000100'::UUID
              AND item.sample_id =
                '93300000-0000-0000-0000-000000000011'::UUID
              AND item.selected_result_ids = ARRAY[
                  '93300000-0000-0000-0000-000000000022'::UUID
              ]
        )
        AND EXISTS (
            SELECT 1
            FROM public.results AS result
            JOIN public.assay_definitions AS assay
              ON assay.id = result.assay_id
            WHERE result.id =
                '93300000-0000-0000-0000-000000000021'::UUID
              AND result.status = 'entered'
              AND assay.is_confidential
        ) AS concurrency_verified,
        'Concurrent confidential result must commit only after the immutable batch snapshot' AS concurrency_detail
    \gset
\endif

DO $prepare_retry$
DECLARE
    v_parent_batch_id UUID;
    v_denied JSONB;
BEGIN
    SELECT id
    INTO v_parent_batch_id
    FROM public.approval_batches
    WHERE requested_by =
        '93300000-0000-0000-0000-000000000001'::UUID
      AND request_key =
        '93300000-0000-0000-0000-000000000100'::UUID;

    UPDATE public.approval_batch_items
    SET status = 'failed',
        attempt_count = 1,
        started_at = clock_timestamp(),
        completed_at = clock_timestamp(),
        terminal_error_code = 'QC_BLOCKED',
        error_params = '{"blockedCount":1}'::JSONB
    WHERE batch_id = v_parent_batch_id;

    UPDATE public.approval_batches
    SET status = 'completed_with_failures',
        completed_at = clock_timestamp()
    WHERE id = v_parent_batch_id;

    UPDATE public.users
    SET can_access_confidential = FALSE
    WHERE id = '93300000-0000-0000-0000-000000000001';

    PERFORM set_config(
        'request.jwt.claims',
        '{"sub":"93300000-0000-0000-0000-000000000001",'
        '"role":"authenticated"}',
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        '93300000-0000-0000-0000-000000000001',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);

    IF public.approval_batch_owner_can_read(v_parent_batch_id) THEN
        RAISE EXCEPTION
            'Late confidential results must conceal owner batch reads';
    END IF;

    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

    v_denied := public.retry_failed_approval_batch_server(
        '93300000-0000-0000-0000-000000000001',
        v_parent_batch_id,
        '93300000-0000-0000-0000-000000000101',
        '93300000-0000-0000-0000-000000000009',
        clock_timestamp(),
        'manager_email_otp'
    );

    IF (v_denied ->> 'success')::BOOLEAN IS DISTINCT FROM FALSE
       OR v_denied ->> 'outcome_code'
           IS DISTINCT FROM 'CONFIDENTIAL_ACCESS_REQUIRED'
       OR EXISTS (
           SELECT 1
           FROM public.approval_batches
           WHERE request_key =
               '93300000-0000-0000-0000-000000000101'::UUID
       )
    THEN
        RAISE EXCEPTION
            'Late confidential results must block child retry creation';
    END IF;

    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = '93300000-0000-0000-0000-000000000001';
END;
$prepare_retry$;

\! rm -f /tmp/approval-batch-retry-concurrency-a.out /tmp/approval-batch-retry-concurrency-b-update.out /tmp/approval-batch-retry-concurrency-b-insert.out /tmp/approval-batch-retry-concurrency-status
\! timeout --kill-after=5s 40s sh -c "psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SET ROLE service_role; SET request.jwt.claims TO '{\\\"role\\\":\\\"service_role\\\"}'; SELECT public.retry_failed_approval_batch_server('93300000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM public.approval_batches WHERE requested_by = '93300000-0000-0000-0000-000000000001'::uuid AND request_key = '93300000-0000-0000-0000-000000000100'::uuid), '93300000-0000-0000-0000-000000000101'::uuid, '93300000-0000-0000-0000-000000000009'::uuid, clock_timestamp(), 'manager_email_otp'); COMMIT;\" > /tmp/approval-batch-retry-concurrency-a.out 2>&1 & first_pid=\$!; locked=f; for attempt in \$(seq 1 100); do locked=\$(psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = 193193002 AND granted);\"); [ \"\$locked\" = t ] && break; sleep 0.05; done; if [ \"\$locked\" = t ]; then psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"WITH started AS MATERIALIZED (SELECT clock_timestamp() AS started_at), updated AS (UPDATE public.results SET assay_id = '93300000-0000-0000-0000-000000000006'::uuid FROM started WHERE id = '93300000-0000-0000-0000-000000000020'::uuid RETURNING 1) SELECT clock_timestamp() - (SELECT started_at FROM started) >= INTERVAL '1 second' FROM updated;\" > /tmp/approval-batch-retry-concurrency-b-update.out 2>&1 & second_pid=\$!; psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"WITH started AS MATERIALIZED (SELECT clock_timestamp() AS started_at), inserted AS (INSERT INTO public.results (id, sample_id, assay_id, value, status, entered_by, entered_at) SELECT '93300000-0000-0000-0000-000000000023'::uuid, '93300000-0000-0000-0000-000000000011'::uuid, '93300000-0000-0000-0000-000000000005'::uuid, 'retry-late', 'entered'::public.result_status, '93300000-0000-0000-0000-000000000003'::uuid, clock_timestamp() FROM started RETURNING 1) SELECT clock_timestamp() - (SELECT started_at FROM started) >= INTERVAL '1 second' FROM inserted;\" > /tmp/approval-batch-retry-concurrency-b-insert.out 2>&1 & third_pid=\$!; wait \$second_pid; second_status=\$?; wait \$third_pid; third_status=\$?; else second_status=1; third_status=1; fi; wait \$first_pid; first_status=\$?; [ \"\$first_status\" -eq 0 ] && [ \"\$second_status\" -eq 0 ] && [ \"\$third_status\" -eq 0 ] && grep -q '\"outcome_code\": \"BATCH_CREATED\"' /tmp/approval-batch-retry-concurrency-a.out && grep -qx 't' /tmp/approval-batch-retry-concurrency-b-update.out && grep -qx 't' /tmp/approval-batch-retry-concurrency-b-insert.out" && printf '0\n' > /tmp/approval-batch-retry-concurrency-status || printf '1\n' > /tmp/approval-batch-retry-concurrency-status
\set retry_concurrency_shell_failed `cat /tmp/approval-batch-retry-concurrency-status`

\if :retry_concurrency_shell_failed
    \! cat /tmp/approval-batch-retry-concurrency-a.out /tmp/approval-batch-retry-concurrency-b-update.out /tmp/approval-batch-retry-concurrency-b-insert.out
\else
    SELECT
        EXISTS (
            SELECT 1
            FROM public.approval_batches AS child
            JOIN public.approval_batches AS parent
              ON parent.id = child.parent_batch_id
            WHERE child.request_key =
                '93300000-0000-0000-0000-000000000101'::UUID
              AND parent.request_key =
                '93300000-0000-0000-0000-000000000100'::UUID
              AND child.request_mode = 'retry_failed'
              AND (
                  SELECT count(*)
                  FROM public.approval_batch_items
                  WHERE batch_id = child.id
              ) = 2
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.approval_batch_items AS child_item
                  LEFT JOIN public.approval_batch_items AS parent_item
                    ON parent_item.batch_id = parent.id
                   AND parent_item.sample_id = child_item.sample_id
                  WHERE child_item.batch_id = child.id
                    AND child_item.selected_result_ids
                        IS DISTINCT FROM parent_item.selected_result_ids
              )
        )
        AND (
            SELECT assay_id =
                '93300000-0000-0000-0000-000000000006'::UUID
            FROM public.results
            WHERE id = '93300000-0000-0000-0000-000000000020'::UUID
        )
        AND EXISTS (
            SELECT 1
            FROM public.results
            WHERE id = '93300000-0000-0000-0000-000000000023'::UUID
              AND status = 'entered'
        ) AS retry_concurrency_verified,
        'Retry must lock affected samples and current results until child commit' AS retry_concurrency_detail
    \gset
\endif

DROP TRIGGER approval_batch_concurrency_sleep_before_insert
ON public.approval_batches;
DROP FUNCTION public.approval_batch_concurrency_sleep_probe();
SELECT pg_temp.cleanup_approval_batch_concurrency();
\! rm -f /tmp/approval-batch-concurrency-a.out /tmp/approval-batch-concurrency-b.out /tmp/approval-batch-concurrency-status /tmp/approval-batch-retry-concurrency-a.out /tmp/approval-batch-retry-concurrency-b-update.out /tmp/approval-batch-retry-concurrency-b-insert.out /tmp/approval-batch-retry-concurrency-status

\if :concurrency_shell_failed
    DO $failed$
    BEGIN
        RAISE EXCEPTION
            'Approval batch persistence concurrency sessions failed';
    END;
    $failed$;
\else
    \if :concurrency_verified
    \else
        DO $failed$
        BEGIN
            RAISE EXCEPTION :'concurrency_detail';
        END;
        $failed$;
    \endif
\endif

\if :retry_concurrency_shell_failed
    DO $failed$
    BEGIN
        RAISE EXCEPTION
            'Approval batch retry concurrency sessions failed';
    END;
    $failed$;
\else
    \if :retry_concurrency_verified
    \else
        DO $failed$
        BEGIN
            RAISE EXCEPTION :'retry_concurrency_detail';
        END;
        $failed$;
    \endif
\endif

SELECT 'approval-batch-persistence-concurrency: ok' AS result;
