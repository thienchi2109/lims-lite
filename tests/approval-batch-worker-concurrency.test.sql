-- APPROVAL BATCH WORKER CONCURRENCY CONTRACT
-- Verifies SKIP LOCKED claims and real transient lock-timeout retry recovery.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

DO $contract$
BEGIN
    IF to_regprocedure(
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

REVOKE approval_batch_worker FROM postgres;
GRANT approval_batch_worker TO postgres;

DROP TABLE IF EXISTS public.approval_batch_worker_claim_probe;
DROP TABLE IF EXISTS public.approval_batch_worker_retry_probe;

CREATE TABLE public.approval_batch_worker_claim_probe (
    worker_label TEXT NOT NULL,
    batch_item_id UUID NOT NULL,
    claim_token UUID NOT NULL,
    attempt_number SMALLINT NOT NULL,
    PRIMARY KEY (worker_label, batch_item_id)
);

CREATE TABLE public.approval_batch_worker_retry_probe (
    batch_item_id UUID PRIMARY KEY,
    claim_token UUID NOT NULL,
    result_id UUID NOT NULL
);

GRANT INSERT
ON public.approval_batch_worker_claim_probe
TO approval_batch_worker;

CREATE FUNCTION pg_temp.cleanup_approval_batch_worker_concurrency()
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
        '93500000-0000-0000-0000-000000000001'::UUID
      AND request_key =
        '93500000-0000-0000-0000-000000000100'::UUID;

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO v_item_ids
    FROM public.approval_batch_items
    WHERE batch_id = ANY(v_batch_ids);

    ALTER TABLE public.approval_batch_item_attempts
        DISABLE TRIGGER approval_batch_item_attempts_append_only;
    ALTER TABLE public.approval_batch_items
        DISABLE TRIGGER approval_batch_items_no_hard_delete;
    ALTER TABLE public.approval_batches
        DISABLE TRIGGER approval_batches_no_hard_delete;

    BEGIN
        DELETE FROM public.audit_logs
        WHERE record_id = ANY(v_batch_ids)
           OR record_id = ANY(v_item_ids)
           OR record_id::TEXT LIKE '935000%'
           OR changed_by IN (
               '93500000-0000-0000-0000-000000000001',
               '93500000-0000-0000-0000-000000000002'
           );

        DELETE FROM public.approval_batch_item_attempts
        WHERE batch_item_id = ANY(v_item_ids);
        DELETE FROM public.approval_batch_items
        WHERE id = ANY(v_item_ids);
        DELETE FROM public.approval_batches
        WHERE id = ANY(v_batch_ids);
    EXCEPTION
        WHEN OTHERS THEN
            ALTER TABLE public.approval_batch_item_attempts
                ENABLE TRIGGER approval_batch_item_attempts_append_only;
            ALTER TABLE public.approval_batch_items
                ENABLE TRIGGER approval_batch_items_no_hard_delete;
            ALTER TABLE public.approval_batches
                ENABLE TRIGGER approval_batches_no_hard_delete;
            RAISE;
    END;

    ALTER TABLE public.approval_batch_item_attempts
        ENABLE TRIGGER approval_batch_item_attempts_append_only;
    ALTER TABLE public.approval_batch_items
        ENABLE TRIGGER approval_batch_items_no_hard_delete;
    ALTER TABLE public.approval_batches
        ENABLE TRIGGER approval_batches_no_hard_delete;

    DELETE FROM public.results
    WHERE id::TEXT LIKE '93500020-0000-0000-0000-%';
    DELETE FROM public.samples
    WHERE id::TEXT LIKE '93500010-0000-0000-0000-%';
    DELETE FROM public.assay_definitions
    WHERE id = '93500000-0000-0000-0000-000000000004';
    DELETE FROM public.clients
    WHERE id = '93500000-0000-0000-0000-000000000003';
    DELETE FROM public.users
    WHERE id IN (
        '93500000-0000-0000-0000-000000000001',
        '93500000-0000-0000-0000-000000000002'
    );
    DELETE FROM auth.users
    WHERE id IN (
        '93500000-0000-0000-0000-000000000001',
        '93500000-0000-0000-0000-000000000002'
    );
    DELETE FROM public.audit_logs
    WHERE record_id::TEXT LIKE '935000%'
       OR changed_by IN (
           '93500000-0000-0000-0000-000000000001',
           '93500000-0000-0000-0000-000000000002'
       );

    TRUNCATE public.approval_batch_worker_claim_probe;
    TRUNCATE public.approval_batch_worker_retry_probe;
END;
$cleanup$;

SELECT pg_temp.cleanup_approval_batch_worker_concurrency();

DO $fixtures$
DECLARE
    v_manager_id UUID := '93500000-0000-0000-0000-000000000001';
    v_analyst_id UUID := '93500000-0000-0000-0000-000000000002';
    v_sample_ids UUID[];
    v_outcome JSONB;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_manager_id, 'approval-worker-concurrency-manager@lims.local'),
        (v_analyst_id, 'approval-worker-concurrency-analyst@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id, username, full_name, role, email,
        can_access_confidential, deleted_at
    )
    VALUES
        (
            v_manager_id, 'approval_worker_concurrency_manager',
            'Approval Worker Concurrency Manager', 'manager',
            'approval-worker-concurrency-manager@lims.local', TRUE, NULL
        ),
        (
            v_analyst_id, 'approval_worker_concurrency_analyst',
            'Approval Worker Concurrency Analyst', 'analyst',
            'approval-worker-concurrency-analyst@lims.local', TRUE, NULL
        )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    INSERT INTO public.clients (
        id, id_card_num, name, date_of_birth, gender, phone, address
    )
    VALUES (
        '93500000-0000-0000-0000-000000000003',
        '079206093501', 'Approval Worker Concurrency Client',
        DATE '1990-01-01', 'Nam', '0900093501', 'CDC'
    );

    INSERT INTO public.assay_definitions (
        id, name, units, is_confidential, normal_range, method_name
    )
    VALUES (
        '93500000-0000-0000-0000-000000000004',
        'Approval Worker Concurrency Assay', 'unit', FALSE, '0-10',
        'Approval Worker Concurrency Method'
    );

    INSERT INTO public.samples (
        id, sample_id, client_id, client_name, status, received_by,
        type, sample_quality
    )
    SELECT
        (
            '93500010-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        'BATCH-P5-CONCURRENCY-' || series,
        '93500000-0000-0000-0000-000000000003'::UUID,
        'Approval Worker Concurrency Client',
        'review'::public.sample_status,
        v_analyst_id,
        'Máu',
        TRUE
    FROM generate_series(1, 5) AS fixture(series);

    INSERT INTO public.results (
        id, sample_id, assay_id, value, status, entered_by, entered_at
    )
    SELECT
        (
            '93500020-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        (
            '93500010-0000-0000-0000-'
            || lpad(series::TEXT, 12, '0')
        )::UUID,
        '93500000-0000-0000-0000-000000000004'::UUID,
        series::TEXT,
        'entered'::public.result_status,
        v_analyst_id,
        clock_timestamp()
    FROM generate_series(1, 5) AS fixture(series);

    SELECT array_agg(id ORDER BY id)
    INTO v_sample_ids
    FROM public.samples
    WHERE sample_id LIKE 'BATCH-P5-CONCURRENCY-%';

    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

    v_outcome := public.create_approval_batch_server(
        v_manager_id,
        '93500000-0000-0000-0000-000000000100',
        'selected',
        v_sample_ids,
        'Duyệt lô cạnh tranh P5',
        '93500000-0000-0000-0000-000000000005',
        clock_timestamp(),
        'manager_email_otp'
    );

    IF NOT COALESCE((v_outcome ->> 'success')::BOOLEAN, FALSE) THEN
        RAISE EXCEPTION 'Could not create concurrency batch: %', v_outcome;
    END IF;
END;
$fixtures$;

\! rm -f /tmp/approval-worker-claim-a.out /tmp/approval-worker-claim-b.out /tmp/approval-worker-claim-status
\! timeout --kill-after=5s 30s sh -c "psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SET ROLE approval_batch_worker; WITH claimed AS (SELECT * FROM public.claim_approval_batch_items_worker(2, 60)) INSERT INTO public.approval_batch_worker_claim_probe (worker_label, batch_item_id, claim_token, attempt_number) SELECT 'a', batch_item_id, claim_token, attempt_number FROM claimed; RESET ROLE; SELECT pg_advisory_lock(196196001); SELECT pg_sleep(2); SELECT pg_advisory_unlock(196196001); COMMIT;\" > /tmp/approval-worker-claim-a.out 2>&1 & first_pid=\$!; locked=f; for attempt in \$(seq 1 100); do locked=\$(psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = 196196001 AND granted);\"); [ \"\$locked\" = t ] && break; sleep 0.05; done; if [ \"\$locked\" = t ]; then started=\$(date +%s%3N); psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SET ROLE approval_batch_worker; WITH claimed AS (SELECT * FROM public.claim_approval_batch_items_worker(2, 60)) INSERT INTO public.approval_batch_worker_claim_probe (worker_label, batch_item_id, claim_token, attempt_number) SELECT 'b', batch_item_id, claim_token, attempt_number FROM claimed; COMMIT;\" > /tmp/approval-worker-claim-b.out 2>&1; second_status=\$?; elapsed=\$((\$(date +%s%3N) - started)); else second_status=1; elapsed=9999; fi; wait \$first_pid; first_status=\$?; [ \"\$first_status\" -eq 0 ] && [ \"\$second_status\" -eq 0 ] && [ \"\$elapsed\" -lt 1500 ]" && printf '0\n' > /tmp/approval-worker-claim-status || printf '1\n' > /tmp/approval-worker-claim-status
\set claim_shell_failed `cat /tmp/approval-worker-claim-status`

\if :claim_shell_failed
    \! cat /tmp/approval-worker-claim-a.out /tmp/approval-worker-claim-b.out
    DO $failed$
    BEGIN
        RAISE EXCEPTION 'Concurrent worker claim sessions failed';
    END;
    $failed$;
\endif

DO $claim_assertions$
BEGIN
    IF (
        SELECT count(*)
        FROM public.approval_batch_worker_claim_probe
    ) <> 4
       OR EXISTS (
           SELECT batch_item_id
           FROM public.approval_batch_worker_claim_probe
           GROUP BY batch_item_id
           HAVING count(*) > 1
       )
       OR EXISTS (
           SELECT worker_label
           FROM public.approval_batch_worker_claim_probe
           GROUP BY worker_label
           HAVING count(*) <> 2
       )
    THEN
        RAISE EXCEPTION
            'SKIP LOCKED claims were blocking, duplicated, or unbounded';
    END IF;
END;
$claim_assertions$;

DO $prepare_retry$
DECLARE
    v_claim RECORD;
BEGIN
    EXECUTE 'SET LOCAL ROLE approval_batch_worker';
    SELECT *
    INTO v_claim
    FROM public.claim_approval_batch_items_worker(1, 60);
    EXECUTE 'RESET ROLE';

    INSERT INTO public.approval_batch_worker_retry_probe (
        batch_item_id,
        claim_token,
        result_id
    )
    SELECT
        v_claim.batch_item_id,
        v_claim.claim_token,
        item.selected_result_ids[1]
    FROM public.approval_batch_items AS item
    WHERE item.id = v_claim.batch_item_id;
END;
$prepare_retry$;

\! rm -f /tmp/approval-worker-locker.out /tmp/approval-worker-retry.out /tmp/approval-worker-retry-status
\! timeout --kill-after=5s 30s sh -c "result_id=\$(psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"SELECT result_id FROM public.approval_batch_worker_retry_probe;\"); item_id=\$(psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"SELECT batch_item_id FROM public.approval_batch_worker_retry_probe;\"); token=\$(psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"SELECT claim_token FROM public.approval_batch_worker_retry_probe;\"); psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SELECT 1 FROM public.results WHERE id = '\$result_id'::uuid FOR UPDATE; SELECT pg_advisory_lock(196196002); SELECT pg_sleep(2); SELECT pg_advisory_unlock(196196002); COMMIT;\" > /tmp/approval-worker-locker.out 2>&1 & locker_pid=\$!; locked=f; for attempt in \$(seq 1 100); do locked=\$(psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = 196196002 AND granted);\"); [ \"\$locked\" = t ] && break; sleep 0.05; done; if [ \"\$locked\" = t ]; then psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SET LOCAL lock_timeout = '200ms'; SET ROLE approval_batch_worker; SELECT public.execute_approval_batch_item_worker('\$item_id'::uuid, '\$token'::uuid); COMMIT;\" > /tmp/approval-worker-retry.out 2>&1; execute_status=\$?; else execute_status=1; fi; wait \$locker_pid; locker_status=\$?; [ \"\$locker_status\" -eq 0 ] && [ \"\$execute_status\" -eq 0 ] && grep -q 'RETRY_SCHEDULED' /tmp/approval-worker-retry.out" && printf '0\n' > /tmp/approval-worker-retry-status || printf '1\n' > /tmp/approval-worker-retry-status
\set retry_shell_failed `cat /tmp/approval-worker-retry-status`

\if :retry_shell_failed
    \! cat /tmp/approval-worker-locker.out /tmp/approval-worker-retry.out
    DO $failed$
    BEGIN
        RAISE EXCEPTION 'Transient lock-timeout worker session failed';
    END;
    $failed$;
\endif

DO $retry_assertions$
DECLARE
    v_probe public.approval_batch_worker_retry_probe%ROWTYPE;
    v_claim RECORD;
    v_outcome JSONB;
BEGIN
    SELECT batch_item_id, claim_token, result_id
    INTO v_probe
    FROM public.approval_batch_worker_retry_probe;

    IF NOT EXISTS (
        SELECT 1
        FROM public.approval_batch_items
        WHERE id = v_probe.batch_item_id
          AND status = 'retry_wait'
          AND attempt_count = 1
          AND next_attempt_at > clock_timestamp() - INTERVAL '1 minute'
    )
       OR NOT EXISTS (
           SELECT 1
           FROM public.approval_batch_item_attempts
           WHERE batch_item_id = v_probe.batch_item_id
             AND attempt_number = 1
             AND event_type = 'retry_scheduled'
             AND error_code = 'TRANSIENT_DATABASE_ERROR'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM public.results
           WHERE id = v_probe.result_id
             AND status = 'entered'
       )
    THEN
        RAISE EXCEPTION
            'Transient lock timeout was not persisted as a bounded retry';
    END IF;

    UPDATE public.approval_batch_items
    SET next_attempt_at = clock_timestamp() - INTERVAL '1 second'
    WHERE id = v_probe.batch_item_id;

    EXECUTE 'SET LOCAL ROLE approval_batch_worker';
    SELECT *
    INTO v_claim
    FROM public.claim_approval_batch_items_worker(1, 60);
    v_outcome := public.execute_approval_batch_item_worker(
        v_claim.batch_item_id,
        v_claim.claim_token
    );
    EXECUTE 'RESET ROLE';

    IF NOT COALESCE((v_outcome ->> 'success')::BOOLEAN, FALSE)
       OR NOT EXISTS (
           SELECT 1
           FROM public.results
           WHERE id = v_probe.result_id
             AND status = 'approved'
       )
       OR (
           SELECT count(*)
           FROM public.approval_batch_item_attempts
           WHERE batch_item_id = v_probe.batch_item_id
             AND event_type = 'succeeded'
       ) <> 1
    THEN
        RAISE EXCEPTION
            'A later retry did not produce exactly one approval outcome';
    END IF;
END;
$retry_assertions$;

SELECT
    'concurrent_skip_locked_claims' AS test_name,
    TRUE AS passed
UNION ALL
SELECT
    'transient_lock_timeout_retry',
    TRUE;

SELECT pg_temp.cleanup_approval_batch_worker_concurrency();
DO $cleanup_assertions$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.audit_logs
        WHERE record_id::TEXT LIKE '935000%'
           OR changed_by IN (
               '93500000-0000-0000-0000-000000000001',
               '93500000-0000-0000-0000-000000000002'
           )
    )
    THEN
        RAISE EXCEPTION
            'Approval worker concurrency fixtures left residual audit rows';
    END IF;
END;
$cleanup_assertions$;
DROP TABLE public.approval_batch_worker_retry_probe;
DROP TABLE public.approval_batch_worker_claim_probe;
REVOKE approval_batch_worker FROM postgres;
\! rm -f /tmp/approval-worker-claim-a.out /tmp/approval-worker-claim-b.out /tmp/approval-worker-claim-status /tmp/approval-worker-locker.out /tmp/approval-worker-retry.out /tmp/approval-worker-retry-status
