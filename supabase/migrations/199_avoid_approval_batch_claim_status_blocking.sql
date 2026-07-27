-- Migration 199: Avoid shared batch-status blocking during worker claims
-- Security Impact: HIGH
-- Changes:
--   - Keeps item claims concurrent with FOR UPDATE SKIP LOCKED.
--   - Makes queued-to-processing batch transition non-blocking.
--   - Keeps terminal batch derivation serialized where correctness requires it.
-- Migrations 196 through 198 are immutable.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_definition TEXT;
BEGIN
    IF to_regprocedure(
        'public.claim_approval_batch_items_worker(integer,integer)'
    ) IS NULL
       OR to_regprocedure(
           'public.refresh_approval_batch_status_internal(uuid)'
       ) IS NULL
       OR NOT public.test_approval_batch_worker_security()
    THEN
        RAISE EXCEPTION
            'Migration 199 requires the applied P5 worker contracts';
    END IF;

    SELECT pg_get_functiondef(
        'public.claim_approval_batch_items_worker(integer,integer)'
            ::REGPROCEDURE
    )
    INTO v_definition;

    IF v_definition NOT ILIKE
        '%ON CONFLICT ON CONSTRAINT%'
        || 'approval_batch_item_attempts_event_key%'
    THEN
        RAISE EXCEPTION
            'Migration 199 requires migration 198 conflict recovery';
    END IF;
END;
$baseline$;

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
    v_locked_batch_id UUID;
    v_terminal_batch_ids UUID[] := ARRAY[]::UUID[];
    v_claimed_batch_ids UUID[] := ARRAY[]::UUID[];
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
        ON CONFLICT ON CONSTRAINT
            approval_batch_item_attempts_event_key
        DO NOTHING;

        v_terminal_batch_ids :=
            array_append(v_terminal_batch_ids, v_item.batch_id);
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
            ON CONFLICT ON CONSTRAINT
                approval_batch_item_attempts_event_key
            DO NOTHING;
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

        v_claimed_batch_ids :=
            array_append(v_claimed_batch_ids, v_item.batch_id);
        batch_item_id := v_item.id;
        claim_token := v_new_claim_token;
        claim_expires_at :=
            v_now + make_interval(secs => p_lease_seconds);
        attempt_number := (v_item.attempt_count + 1)::SMALLINT;
        RETURN NEXT;
    END LOOP;

    FOR v_batch_id IN
        SELECT DISTINCT terminal_batch.batch_id
        FROM unnest(v_terminal_batch_ids) AS terminal_batch(batch_id)
        ORDER BY terminal_batch.batch_id
    LOOP
        PERFORM public.refresh_approval_batch_status_internal(v_batch_id);
    END LOOP;

    FOR v_batch_id IN
        SELECT DISTINCT claimed_batch.batch_id
        FROM unnest(v_claimed_batch_ids) AS claimed_batch(batch_id)
        ORDER BY claimed_batch.batch_id
    LOOP
        v_locked_batch_id := NULL;

        SELECT batch.id
        INTO v_locked_batch_id
        FROM public.approval_batches AS batch
        WHERE batch.id = v_batch_id
          AND batch.status = 'queued'
        FOR UPDATE SKIP LOCKED;

        IF v_locked_batch_id IS NOT NULL THEN
            UPDATE public.approval_batches
            SET status = 'processing',
                started_at = COALESCE(started_at, v_now),
                completed_at = NULL
            WHERE id = v_locked_batch_id;
        END IF;
    END LOOP;
END;
$function$;

DO $verification$
DECLARE
    v_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.claim_approval_batch_items_worker(integer,integer)'
            ::REGPROCEDURE
    )
    INTO v_definition;

    IF NOT public.test_approval_batch_worker_security()
       OR v_definition NOT ILIKE
           '%FROM public.approval_batches AS batch%'
       OR v_definition NOT ILIKE
           '%FOR UPDATE SKIP LOCKED%'
       OR v_definition NOT ILIKE
           '%v_locked_batch_id IS NOT NULL%'
    THEN
        RAISE EXCEPTION
            'Migration 199 non-blocking claim verification failed';
    END IF;
END;
$verification$;

COMMENT ON FUNCTION public.claim_approval_batch_items_worker(
    INTEGER,
    INTEGER
) IS 'Worker-only bounded item claims with non-blocking queued-to-processing batch transition.';

NOTIFY pgrst, 'reload schema';

COMMIT;
