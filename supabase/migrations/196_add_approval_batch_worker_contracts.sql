-- Migration 196: Add dark approval-batch worker claim and execution contracts
-- Security Impact: HIGH
-- Changes:
--   - Adds a dedicated least-privilege approval_batch_worker database login.
--   - Adds bounded SKIP LOCKED claims with opaque expiring claim tokens.
--   - Adds item-bound execution with manager-attributed audit context.
--   - Adds append-only retry, terminal failure, and crash-recovery evidence.
--   - Keeps all table DML behind pinned SECURITY DEFINER functions.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
BEGIN
    IF to_regclass('public.approval_batches') IS NULL
       OR to_regclass('public.approval_batch_items') IS NULL
       OR to_regclass('public.approval_batch_item_attempts') IS NULL
       OR to_regprocedure(
           'public.approve_sample_results_server(uuid,uuid,uuid[],text)'
       ) IS NULL
       OR to_regprocedure(
           'public.create_approval_batch_server('
           'uuid,uuid,text,uuid[],text,uuid,timestamp with time zone,text)'
       ) IS NULL
       OR to_regprocedure(
           'public.test_approval_batch_persistence_security()'
       ) IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 196 requires applied migrations 192 through 195';
    END IF;

    IF NOT public.approval_batch_storage_catalog_is_exact()
       OR NOT public.test_approval_batch_persistence_security()
    THEN
        RAISE EXCEPTION
            'Migration 196 found an invalid approval-batch baseline';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'approval_batch_worker'
          AND (
              NOT rolcanlogin
              OR rolsuper
              OR rolcreaterole
              OR rolcreatedb
              OR rolinherit
              OR rolreplication
              OR rolbypassrls
          )
    )
    THEN
        RAISE EXCEPTION
            'Migration 196 found an unsafe approval_batch_worker role';
    END IF;
END;
$baseline$;

DO $worker_role$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'approval_batch_worker'
    )
    THEN
        CREATE ROLE approval_batch_worker
            LOGIN
            NOINHERIT
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOREPLICATION
            NOBYPASSRLS;
    END IF;

    EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO approval_batch_worker',
        current_database()
    );
END;
$worker_role$;

GRANT USAGE ON SCHEMA public TO approval_batch_worker;

REVOKE ALL PRIVILEGES
ON TABLE
    public.approval_batches,
    public.approval_batch_items,
    public.approval_batch_item_attempts
FROM approval_batch_worker;

REVOKE ALL PRIVILEGES
ON ALL SEQUENCES IN SCHEMA public
FROM approval_batch_worker;

CREATE OR REPLACE FUNCTION public.refresh_approval_batch_status_internal(
    p_batch_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_current_status TEXT;
    v_has_nonterminal BOOLEAN;
    v_has_failure BOOLEAN;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    SELECT batch.status
    INTO v_current_status
    FROM public.approval_batches AS batch
    WHERE batch.id = p_batch_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_current_status IN ('completed', 'completed_with_failures')
    THEN
        RETURN;
    END IF;

    SELECT
        COALESCE(
            bool_or(item.status IN ('queued', 'processing', 'retry_wait')),
            FALSE
        ),
        COALESCE(bool_or(item.status = 'failed'), FALSE)
    INTO v_has_nonterminal, v_has_failure
    FROM public.approval_batch_items AS item
    WHERE item.batch_id = p_batch_id;

    IF v_has_nonterminal THEN
        UPDATE public.approval_batches
        SET status = 'processing',
            started_at = COALESCE(started_at, v_now),
            completed_at = NULL
        WHERE id = p_batch_id;
    ELSE
        UPDATE public.approval_batches
        SET status = CASE
                WHEN v_has_failure THEN 'completed_with_failures'
                ELSE 'completed'
            END,
            started_at = COALESCE(started_at, v_now),
            completed_at = COALESCE(completed_at, v_now)
        WHERE id = p_batch_id;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_approval_batch_items_worker(
    p_claim_limit INTEGER DEFAULT 8,
    p_lease_seconds INTEGER DEFAULT 60
) RETURNS TABLE (
    batch_item_id UUID,
    claim_token UUID,
    claim_expires_at TIMESTAMPTZ,
    attempt_number SMALLINT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_item RECORD;
    v_batch_id UUID;
    v_batch_ids UUID[] := ARRAY[]::UUID[];
    v_now TIMESTAMPTZ := clock_timestamp();
    v_new_claim_token UUID;
BEGIN
    IF p_claim_limit IS NULL
       OR p_claim_limit NOT BETWEEN 1 AND 16
    THEN
        RAISE EXCEPTION 'claim limit must be between 1 and 16'
            USING ERRCODE = '22023';
    END IF;

    IF p_lease_seconds IS NULL
       OR p_lease_seconds NOT BETWEEN 5 AND 900
    THEN
        RAISE EXCEPTION 'lease seconds must be between 5 and 900'
            USING ERRCODE = '22023';
    END IF;

    FOR v_item IN
        SELECT
            item.id,
            item.batch_id,
            item.attempt_count,
            item.claim_token
        FROM public.approval_batch_items AS item
        WHERE item.status = 'processing'
          AND item.claim_expires_at <= v_now
          AND item.attempt_count = 3
        ORDER BY item.claim_expires_at, item.created_at, item.id
        LIMIT p_claim_limit
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.approval_batch_items
        SET status = 'failed',
            next_attempt_at = NULL,
            claim_token = NULL,
            claimed_at = NULL,
            claim_expires_at = NULL,
            terminal_error_code = 'AUTOMATIC_RETRIES_EXHAUSTED',
            error_params = '{}'::JSONB,
            completed_at = v_now
        WHERE id = v_item.id;

        INSERT INTO public.approval_batch_item_attempts (
            batch_item_id,
            attempt_number,
            event_type,
            claim_token,
            error_code,
            error_params,
            occurred_at
        )
        VALUES (
            v_item.id,
            v_item.attempt_count,
            'terminal_failure',
            v_item.claim_token,
            'AUTOMATIC_RETRIES_EXHAUSTED',
            '{}'::JSONB,
            v_now
        )
        ON CONFLICT (
            batch_item_id,
            attempt_number,
            event_type
        ) DO NOTHING;

        v_batch_ids := array_append(v_batch_ids, v_item.batch_id);
    END LOOP;

    FOR v_item IN
        SELECT
            item.id,
            item.batch_id,
            item.status,
            item.attempt_count,
            item.claim_token
        FROM public.approval_batch_items AS item
        WHERE (
                item.status = 'queued'
                AND item.attempt_count = 0
            )
           OR (
                item.status = 'retry_wait'
                AND item.attempt_count < 3
                AND item.next_attempt_at <= v_now
            )
           OR (
                item.status = 'processing'
                AND item.attempt_count < 3
                AND item.claim_expires_at <= v_now
            )
        ORDER BY
            CASE item.status
                WHEN 'queued' THEN 0
                WHEN 'retry_wait' THEN 1
                ELSE 2
            END,
            COALESCE(
                item.next_attempt_at,
                item.claim_expires_at,
                item.created_at
            ),
            item.created_at,
            item.id
        LIMIT p_claim_limit
        FOR UPDATE SKIP LOCKED
    LOOP
        IF v_item.status = 'processing' THEN
            INSERT INTO public.approval_batch_item_attempts (
                batch_item_id,
                attempt_number,
                event_type,
                claim_token,
                error_code,
                error_params,
                occurred_at
            )
            VALUES (
                v_item.id,
                v_item.attempt_count,
                'retry_scheduled',
                v_item.claim_token,
                'LEASE_EXPIRED',
                '{}'::JSONB,
                v_now
            )
            ON CONFLICT (
                batch_item_id,
                attempt_number,
                event_type
            ) DO NOTHING;
        END IF;

        v_new_claim_token := public.gen_random_uuid();

        UPDATE public.approval_batch_items AS item
        SET status = 'processing',
            attempt_count = (v_item.attempt_count + 1)::SMALLINT,
            next_attempt_at = NULL,
            claim_token = v_new_claim_token,
            claimed_at = v_now,
            claim_expires_at =
                v_now + make_interval(secs => p_lease_seconds),
            terminal_error_code = NULL,
            error_params = '{}'::JSONB,
            started_at = COALESCE(item.started_at, v_now),
            completed_at = NULL
        WHERE item.id = v_item.id;

        INSERT INTO public.approval_batch_item_attempts (
            batch_item_id,
            attempt_number,
            event_type,
            claim_token,
            error_params,
            occurred_at
        )
        VALUES (
            v_item.id,
            (v_item.attempt_count + 1)::SMALLINT,
            'claimed',
            v_new_claim_token,
            '{}'::JSONB,
            v_now
        );

        v_batch_ids := array_append(v_batch_ids, v_item.batch_id);
        batch_item_id := v_item.id;
        claim_token := v_new_claim_token;
        claim_expires_at :=
            v_now + make_interval(secs => p_lease_seconds);
        attempt_number := (v_item.attempt_count + 1)::SMALLINT;
        RETURN NEXT;
    END LOOP;

    FOR v_batch_id IN
        SELECT DISTINCT claimed_batch.batch_id
        FROM unnest(v_batch_ids) AS claimed_batch(batch_id)
        ORDER BY claimed_batch.batch_id
    LOOP
        PERFORM public.refresh_approval_batch_status_internal(v_batch_id);
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_approval_batch_item_worker(
    p_batch_item_id UUID,
    p_claim_token UUID
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_item RECORD;
    v_approval_outcome JSONB;
    v_outcome_code TEXT;
    v_error_params JSONB := '{}'::JSONB;
    v_previous_claims TEXT :=
        current_setting('request.jwt.claims', TRUE);
    v_previous_sub TEXT :=
        current_setting('request.jwt.claim.sub', TRUE);
    v_previous_role TEXT :=
        current_setting('request.jwt.claim.role', TRUE);
    v_now TIMESTAMPTZ := clock_timestamp();
    v_next_attempt_at TIMESTAMPTZ;
    v_retry_delay_seconds INTEGER;
BEGIN
    IF p_batch_item_id IS NULL OR p_claim_token IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'STALE_CLAIM'
        );
    END IF;

    SELECT
        item.id,
        item.batch_id,
        item.sample_id,
        item.selected_result_ids,
        item.status,
        item.attempt_count,
        item.claim_token,
        item.claim_expires_at,
        item.terminal_error_code,
        batch.requested_by,
        batch.approval_note
    INTO v_item
    FROM public.approval_batch_items AS item
    JOIN public.approval_batches AS batch
      ON batch.id = item.batch_id
    WHERE item.id = p_batch_item_id
    FOR UPDATE OF item;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'ITEM_NOT_FOUND'
        );
    END IF;

    IF v_item.status = 'succeeded'
       AND EXISTS (
           SELECT 1
           FROM public.approval_batch_item_attempts AS attempt
           WHERE attempt.batch_item_id = v_item.id
             AND attempt.claim_token = p_claim_token
             AND attempt.event_type = 'succeeded'
       )
    THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'outcome_code', 'ITEM_ALREADY_SUCCEEDED',
            'batch_item_id', v_item.id,
            'replayed', TRUE
        );
    END IF;

    IF v_item.status = 'failed'
       AND EXISTS (
           SELECT 1
           FROM public.approval_batch_item_attempts AS attempt
           WHERE attempt.batch_item_id = v_item.id
             AND attempt.claim_token = p_claim_token
             AND attempt.event_type = 'terminal_failure'
       )
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code',
                COALESCE(v_item.terminal_error_code, 'ITEM_FAILED'),
            'batch_item_id', v_item.id,
            'terminal', TRUE,
            'replayed', TRUE
        );
    END IF;

    IF v_item.status <> 'processing'
       OR v_item.claim_token IS DISTINCT FROM p_claim_token
       OR v_item.claim_expires_at <= v_now
    THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'outcome_code', 'STALE_CLAIM',
            'batch_item_id', v_item.id
        );
    END IF;

    INSERT INTO public.approval_batch_item_attempts (
        batch_item_id,
        attempt_number,
        event_type,
        claim_token,
        error_params,
        occurred_at
    )
    VALUES (
        v_item.id,
        v_item.attempt_count,
        'started',
        p_claim_token,
        '{}'::JSONB,
        v_now
    )
    ON CONFLICT (
        batch_item_id,
        attempt_number,
        event_type
    ) DO NOTHING;

    BEGIN
        PERFORM set_config(
            'request.jwt.claims',
            '{"role":"service_role"}',
            TRUE
        );
        PERFORM set_config('request.jwt.claim.sub', '', TRUE);
        PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

        v_approval_outcome := public.approve_sample_results_server(
            v_item.requested_by,
            v_item.sample_id,
            v_item.selected_result_ids,
            v_item.approval_note
        );
    EXCEPTION
        WHEN lock_not_available
          OR deadlock_detected
          OR serialization_failure
          OR query_canceled
        THEN
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

            IF v_item.attempt_count < 3 THEN
                v_retry_delay_seconds := LEAST(
                    60,
                    (
                        5 * power(2, v_item.attempt_count - 1)
                    )::INTEGER
                    + floor(random() * 5)::INTEGER
                );
                v_next_attempt_at :=
                    clock_timestamp()
                    + make_interval(secs => v_retry_delay_seconds);

                UPDATE public.approval_batch_items
                SET status = 'retry_wait',
                    next_attempt_at = v_next_attempt_at,
                    claim_token = NULL,
                    claimed_at = NULL,
                    claim_expires_at = NULL,
                    terminal_error_code = NULL,
                    error_params = '{}'::JSONB,
                    completed_at = NULL
                WHERE id = v_item.id;

                INSERT INTO public.approval_batch_item_attempts (
                    batch_item_id,
                    attempt_number,
                    event_type,
                    claim_token,
                    error_code,
                    error_params
                )
                VALUES (
                    v_item.id,
                    v_item.attempt_count,
                    'retry_scheduled',
                    p_claim_token,
                    'TRANSIENT_DATABASE_ERROR',
                    '{}'::JSONB
                )
                ON CONFLICT (
                    batch_item_id,
                    attempt_number,
                    event_type
                ) DO NOTHING;

                PERFORM public.refresh_approval_batch_status_internal(
                    v_item.batch_id
                );

                RETURN jsonb_build_object(
                    'success', FALSE,
                    'outcome_code', 'RETRY_SCHEDULED',
                    'batch_item_id', v_item.id,
                    'retryable', TRUE,
                    'next_attempt_at', v_next_attempt_at
                );
            END IF;

            UPDATE public.approval_batch_items
            SET status = 'failed',
                next_attempt_at = NULL,
                claim_token = NULL,
                claimed_at = NULL,
                claim_expires_at = NULL,
                terminal_error_code = 'AUTOMATIC_RETRIES_EXHAUSTED',
                error_params = '{}'::JSONB,
                completed_at = clock_timestamp()
            WHERE id = v_item.id;

            INSERT INTO public.approval_batch_item_attempts (
                batch_item_id,
                attempt_number,
                event_type,
                claim_token,
                error_code,
                error_params
            )
            VALUES (
                v_item.id,
                v_item.attempt_count,
                'terminal_failure',
                p_claim_token,
                'AUTOMATIC_RETRIES_EXHAUSTED',
                '{}'::JSONB
            )
            ON CONFLICT (
                batch_item_id,
                attempt_number,
                event_type
            ) DO NOTHING;

            PERFORM public.refresh_approval_batch_status_internal(
                v_item.batch_id
            );

            RETURN jsonb_build_object(
                'success', FALSE,
                'outcome_code', 'AUTOMATIC_RETRIES_EXHAUSTED',
                'batch_item_id', v_item.id,
                'terminal', TRUE
            );
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

    v_outcome_code := upper(
        COALESCE(v_approval_outcome ->> 'outcome_code', 'APPROVAL_FAILED')
    );

    IF COALESCE(
        (v_approval_outcome ->> 'success')::BOOLEAN,
        FALSE
    )
    THEN
        UPDATE public.approval_batch_items
        SET status = 'succeeded',
            next_attempt_at = NULL,
            claim_token = NULL,
            claimed_at = NULL,
            claim_expires_at = NULL,
            terminal_error_code = NULL,
            error_params = '{}'::JSONB,
            completed_at = clock_timestamp()
        WHERE id = v_item.id;

        INSERT INTO public.approval_batch_item_attempts (
            batch_item_id,
            attempt_number,
            event_type,
            claim_token,
            error_params
        )
        VALUES (
            v_item.id,
            v_item.attempt_count,
            'succeeded',
            p_claim_token,
            '{}'::JSONB
        )
        ON CONFLICT (
            batch_item_id,
            attempt_number,
            event_type
        ) DO NOTHING;

        PERFORM public.refresh_approval_batch_status_internal(
            v_item.batch_id
        );

        RETURN v_approval_outcome || jsonb_build_object(
            'batch_item_id', v_item.id,
            'replayed', COALESCE(
                (v_approval_outcome ->> 'replayed')::BOOLEAN,
                FALSE
            )
        );
    END IF;

    v_error_params := COALESCE(
        v_approval_outcome -> 'error_params',
        '{}'::JSONB
    );

    UPDATE public.approval_batch_items
    SET status = 'failed',
        next_attempt_at = NULL,
        claim_token = NULL,
        claimed_at = NULL,
        claim_expires_at = NULL,
        terminal_error_code = v_outcome_code,
        error_params = v_error_params,
        completed_at = clock_timestamp()
    WHERE id = v_item.id;

    INSERT INTO public.approval_batch_item_attempts (
        batch_item_id,
        attempt_number,
        event_type,
        claim_token,
        error_code,
        error_params
    )
    VALUES (
        v_item.id,
        v_item.attempt_count,
        'terminal_failure',
        p_claim_token,
        v_outcome_code,
        v_error_params
    )
    ON CONFLICT (
        batch_item_id,
        attempt_number,
        event_type
    ) DO NOTHING;

    PERFORM public.refresh_approval_batch_status_internal(v_item.batch_id);

    RETURN v_approval_outcome || jsonb_build_object(
        'batch_item_id', v_item.id,
        'terminal', TRUE
    );
END;
$function$;

REVOKE ALL
ON FUNCTION public.refresh_approval_batch_status_internal(UUID)
FROM PUBLIC, anon, authenticated, service_role, approval_batch_worker;

REVOKE ALL
ON FUNCTION public.claim_approval_batch_items_worker(INTEGER, INTEGER)
FROM PUBLIC, anon, authenticated, service_role, approval_batch_worker;

REVOKE ALL
ON FUNCTION public.execute_approval_batch_item_worker(UUID, UUID)
FROM PUBLIC, anon, authenticated, service_role, approval_batch_worker;

GRANT EXECUTE
ON FUNCTION public.claim_approval_batch_items_worker(INTEGER, INTEGER)
TO approval_batch_worker;

GRANT EXECUTE
ON FUNCTION public.execute_approval_batch_item_worker(UUID, UUID)
TO approval_batch_worker;

CREATE OR REPLACE FUNCTION public.test_approval_batch_worker_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
    v_claim_function REGPROCEDURE :=
        to_regprocedure(
            'public.claim_approval_batch_items_worker(integer,integer)'
        );
    v_execute_function REGPROCEDURE :=
        to_regprocedure(
            'public.execute_approval_batch_item_worker(uuid,uuid)'
        );
    v_refresh_function REGPROCEDURE :=
        to_regprocedure(
            'public.refresh_approval_batch_status_internal(uuid)'
        );
    v_function REGPROCEDURE;
    v_config TEXT[];
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'approval_batch_worker'
          AND rolcanlogin
          AND NOT rolsuper
          AND NOT rolcreaterole
          AND NOT rolcreatedb
          AND NOT rolinherit
          AND NOT rolreplication
          AND NOT rolbypassrls
    )
       OR EXISTS (
           SELECT 1
           FROM pg_auth_members AS membership
           JOIN pg_roles AS member_role
             ON member_role.oid = membership.member
           WHERE member_role.rolname = 'approval_batch_worker'
       )
    THEN
        RETURN FALSE;
    END IF;

    IF v_claim_function IS NULL
       OR v_execute_function IS NULL
       OR v_refresh_function IS NULL
    THEN
        RETURN FALSE;
    END IF;

    FOREACH v_function IN ARRAY ARRAY[
        v_claim_function,
        v_execute_function,
        v_refresh_function
    ]::REGPROCEDURE[]
    LOOP
        SELECT function_record.proconfig
        INTO v_config
        FROM pg_proc AS function_record
        WHERE function_record.oid = v_function::OID
          AND function_record.prosecdef;

        IF NOT FOUND
           OR NOT (
               v_config @>
               ARRAY['search_path=public, extensions, pg_temp']
           )
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    IF NOT has_function_privilege(
        'approval_batch_worker',
        v_claim_function,
        'EXECUTE'
    )
       OR NOT has_function_privilege(
           'approval_batch_worker',
           v_execute_function,
           'EXECUTE'
       )
       OR has_function_privilege(
           'approval_batch_worker',
           v_refresh_function,
           'EXECUTE'
       )
       OR has_function_privilege(
           'approval_batch_worker',
           'public.approve_sample_results_server(uuid,uuid,uuid[],text)',
           'EXECUTE'
       )
    THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(ARRAY['anon', 'authenticated', 'service_role'])
            AS api_role(role_name)
        CROSS JOIN unnest(ARRAY[
            v_claim_function,
            v_execute_function
        ]::REGPROCEDURE[]) AS worker_function(function_oid)
        WHERE has_function_privilege(
            api_role.role_name,
            worker_function.function_oid,
            'EXECUTE'
        )
    )
    THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
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
    )
    THEN
        RETURN FALSE;
    END IF;

    IF pg_get_functiondef(v_claim_function::OID) NOT ILIKE
           '%FOR UPDATE SKIP LOCKED%'
       OR pg_get_functiondef(v_execute_function::OID) NOT ILIKE
           '%approve_sample_results_server(%'
    THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING
            'Approval batch worker security test failed: %',
            SQLERRM;
        RETURN FALSE;
END;
$function$;

REVOKE ALL
ON FUNCTION public.test_approval_batch_worker_security()
FROM PUBLIC, anon, approval_batch_worker, service_role;

GRANT EXECUTE
ON FUNCTION public.test_approval_batch_worker_security()
TO authenticated;

DO $register_security_test$
DECLARE
    v_definition TEXT;
    v_anchor TEXT :=
        '(''Approval Batch Persistence Security''::TEXT, test_approval_batch_persistence_security(), ''Verifies dark batch RLS, no direct DML, typed step-up evidence, append-only history, server-only mutations, owner reads, audit triggers, and pinned search_path''::TEXT);';
    v_replacement TEXT :=
        '(''Approval Batch Persistence Security''::TEXT, test_approval_batch_persistence_security(), ''Verifies dark batch RLS, no direct DML, typed step-up evidence, append-only history, server-only mutations, owner reads, audit triggers, and pinned search_path''::TEXT),'
        || E'\n        '
        || '(''Approval Batch Worker Security''::TEXT, test_approval_batch_worker_security(), ''Verifies the dedicated no-DML worker role, bounded SKIP LOCKED claims, item-bound execution grants, manager audit attribution, and pinned search_path''::TEXT);';
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;

    IF v_definition ILIKE '%Approval Batch Worker Security%' THEN
        RETURN;
    END IF;

    IF v_definition NOT LIKE '%' || v_anchor || '%' THEN
        RAISE EXCEPTION
            'Migration 196 could not locate the security runner anchor';
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

    IF NOT public.test_approval_batch_worker_security()
       OR v_runner_definition NOT ILIKE
           '%Approval Batch Worker Security%'
    THEN
        RAISE EXCEPTION
            'Migration 196 worker contract verification failed';
    END IF;
END;
$verification$;

COMMENT ON ROLE approval_batch_worker
IS 'Dedicated dark approval-batch worker login. Credentials are managed outside source control.';

COMMENT ON FUNCTION public.refresh_approval_batch_status_internal(UUID)
IS 'Private serialized aggregate-status derivation for approval batches.';

COMMENT ON FUNCTION public.claim_approval_batch_items_worker(
    INTEGER,
    INTEGER
) IS 'Worker-only bounded SKIP LOCKED claims with opaque expiring tokens.';

COMMENT ON FUNCTION public.execute_approval_batch_item_worker(UUID, UUID)
IS 'Worker-only item-bound approval execution with manager-attributed audit context.';

COMMENT ON FUNCTION public.test_approval_batch_worker_security()
IS 'Verifies the P5 worker role, grants, no-DML boundary, and pinned worker functions.';

COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including dark approval-batch worker coverage.';

NOTIFY pgrst, 'reload schema';

COMMIT;
