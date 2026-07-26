-- Migration 194: Recover dark approval-batch storage.
--
-- Migration 193 was committed and executed once, but its transaction rolled
-- back when a representation-sensitive catalog assertion rejected the newly
-- created schema. Migration 193 is immutable and must never be rerun.
--
-- Security impact:
-- - Adds durable batch, item, and append-only attempt relations with forced RLS.
-- - Denies direct table access to anon, authenticated, and service_role.
-- - Adds owner-scoped SELECT policies backed by a fail-closed authenticated
--   manager helper; no mutation or progress/outcome RPC is created here.
-- - Revokes default PUBLIC execute from every new internal helper.
-- - Stores typed server-derived step-up evidence and no OTP, cookie, token, JWT,
--   authorization-header, or generic step-up metadata column.
--
-- Application impact:
-- - Dark storage only. No API, UI, polling, worker, or batch contract surface.
-- - Migrations 192 and 193 remain immutable. This forward-only migration
--   validates the unchanged Phase P2 baseline before recreating dark storage.

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
       OR to_regprocedure('public.trigger_audit_log()') IS NULL
       OR to_regprocedure('public.update_updated_at_column()') IS NULL
       OR to_regprocedure('public.get_user_role()') IS NULL
       OR to_regprocedure('public.digest(text,text)') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 194 found an unexpected Phase P2 baseline';
    END IF;

    IF to_regclass('public.approval_batches') IS NOT NULL
       OR to_regclass('public.approval_batch_items') IS NOT NULL
       OR to_regclass('public.approval_batch_item_attempts') IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 194 approval batch relations already exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_proc AS function_record
        JOIN pg_namespace AS namespace
          ON namespace.oid = function_record.pronamespace
        WHERE namespace.nspname = 'public'
          AND function_record.proname = ANY(ARRAY[
              'approval_batch_uuid_array_is_canonical',
              'approval_batch_error_params_are_safe',
              'approval_batch_request_fingerprint',
              'prevent_approval_batch_request_change',
              'prevent_approval_batch_item_request_change',
              'prevent_approval_batch_hard_delete',
              'prevent_approval_batch_attempt_mutation',
              'approval_batch_owner_can_read',
              'approval_batch_storage_catalog_is_exact',
              'create_approval_batch_server',
              'retry_failed_approval_batch_server',
              'get_approval_batch_progress',
              'get_approval_batch_outcomes',
              'test_approval_batch_persistence_security'
          ])
    )
    THEN
        RAISE EXCEPTION
            'Migration 194 approval batch functions already exist';
    END IF;

    IF NOT public.test_atomic_result_approval_rpc_security() THEN
        RAISE EXCEPTION
            'Migration 194 requires the Phase P2 atomic approval contract';
    END IF;

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    IF v_runner_definition NOT ILIKE
           '%Atomic Result Approval RPC Security%'
       OR v_runner_definition ILIKE
           '%Approval Batch Persistence Security%'
    THEN
        RAISE EXCEPTION
            'Migration 194 found an unexpected run_security_tests baseline';
    END IF;
END;
$baseline$;

CREATE FUNCTION public.approval_batch_uuid_array_is_canonical(
    p_values UUID[]
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $function$
    SELECT p_values IS NOT NULL
       AND cardinality(p_values) > 0
       AND NOT EXISTS (
           SELECT 1
           FROM unnest(p_values) AS value(item)
           WHERE item IS NULL
       )
       AND p_values = (
           SELECT array_agg(DISTINCT item ORDER BY item)
           FROM unnest(p_values) AS value(item)
       );
$function$;

CREATE FUNCTION public.approval_batch_error_params_are_safe(
    p_error_params JSONB
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $function$
    SELECT p_error_params IS NOT NULL
       AND jsonb_typeof(p_error_params) = 'object'
       AND NOT EXISTS (
           SELECT 1
           FROM jsonb_object_keys(p_error_params) AS parameter(key)
           WHERE key NOT IN ('blockedCount', 'retryAfterSeconds')
       )
       AND (
           NOT (p_error_params ? 'blockedCount')
           OR (
               jsonb_typeof(p_error_params -> 'blockedCount') = 'number'
               AND p_error_params ->> 'blockedCount' ~ '^[1-9][0-9]*$'
           )
       )
       AND (
           NOT (p_error_params ? 'retryAfterSeconds')
           OR (
               jsonb_typeof(
                   p_error_params -> 'retryAfterSeconds'
               ) = 'number'
               AND p_error_params ->> 'retryAfterSeconds'
                   ~ '^[0-9]+$'
           )
       );
$function$;

CREATE FUNCTION public.approval_batch_request_fingerprint(
    p_sample_ids UUID[],
    p_approval_note TEXT,
    p_request_mode TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $function$
    WITH canonical_request AS (
        SELECT
            array_agg(DISTINCT sample_id ORDER BY sample_id) AS sample_ids,
            CASE
                WHEN btrim(COALESCE(p_approval_note, '')) = '' THEN NULL
                ELSE btrim(p_approval_note)
            END AS approval_note,
            p_request_mode AS request_mode
        FROM unnest(COALESCE(p_sample_ids, ARRAY[]::UUID[]))
            AS selected(sample_id)
    )
    SELECT encode(
        public.digest(
            jsonb_build_object(
                'sample_ids', to_jsonb(sample_ids),
                'approval_note', approval_note,
                'request_mode', request_mode
            )::TEXT,
            'sha256'
        ),
        'hex'
    )
    FROM canonical_request;
$function$;

CREATE TABLE public.approval_batches (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    requested_by UUID NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,
    parent_batch_id UUID
        REFERENCES public.approval_batches(id) ON DELETE RESTRICT,
    request_key UUID NOT NULL,
    request_mode TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    approval_note TEXT,
    step_up_authorization_id UUID NOT NULL,
    step_up_verified_at TIMESTAMPTZ NOT NULL,
    step_up_cohort TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT approval_batches_requested_by_request_key_key
        UNIQUE (requested_by, request_key),
    CONSTRAINT approval_batches_parent_not_self_check
        CHECK (parent_batch_id IS NULL OR parent_batch_id <> id),
    CONSTRAINT approval_batches_request_mode_check
        CHECK (
            request_mode IN ('selected', 'all_pending', 'retry_failed')
        ),
    CONSTRAINT approval_batches_parent_mode_check
        CHECK (
            (
                request_mode = 'retry_failed'
                AND parent_batch_id IS NOT NULL
            )
            OR (
                request_mode IN ('selected', 'all_pending')
                AND parent_batch_id IS NULL
            )
        ),
    CONSTRAINT approval_batches_request_fingerprint_check
        CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT approval_batches_approval_note_check
        CHECK (
            approval_note IS NULL
            OR (
                approval_note = btrim(approval_note)
                AND char_length(approval_note) BETWEEN 1 AND 500
            )
        ),
    CONSTRAINT approval_batches_step_up_cohort_check
        CHECK (step_up_cohort = 'manager_email_otp'),
    CONSTRAINT approval_batches_step_up_time_check
        CHECK (
            step_up_verified_at >= created_at - INTERVAL '15 minutes'
            AND step_up_verified_at <= created_at + INTERVAL '1 minute'
        ),
    CONSTRAINT approval_batches_status_check
        CHECK (
            status IN (
                'queued',
                'processing',
                'completed',
                'completed_with_failures'
            )
        ),
    CONSTRAINT approval_batches_status_timestamps_check
        CHECK (
            (
                status = 'queued'
                AND started_at IS NULL
                AND completed_at IS NULL
            )
            OR (
                status = 'processing'
                AND started_at IS NOT NULL
                AND completed_at IS NULL
            )
            OR (
                status IN ('completed', 'completed_with_failures')
                AND completed_at IS NOT NULL
            )
        )
);

CREATE TABLE public.approval_batch_items (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    batch_id UUID NOT NULL
        REFERENCES public.approval_batches(id) ON DELETE RESTRICT,
    sample_id UUID NOT NULL
        REFERENCES public.samples(id) ON DELETE RESTRICT,
    selected_result_ids UUID[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempt_count SMALLINT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    claim_token UUID,
    claimed_at TIMESTAMPTZ,
    claim_expires_at TIMESTAMPTZ,
    terminal_error_code TEXT,
    error_params JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT approval_batch_items_batch_id_sample_id_key
        UNIQUE (batch_id, sample_id),
    CONSTRAINT approval_batch_items_snapshot_check
        CHECK (
            public.approval_batch_uuid_array_is_canonical(
                selected_result_ids
            )
        ),
    CONSTRAINT approval_batch_items_status_check
        CHECK (
            status IN (
                'queued',
                'processing',
                'retry_wait',
                'succeeded',
                'failed'
            )
        ),
    CONSTRAINT approval_batch_items_attempt_count_check
        CHECK (attempt_count BETWEEN 0 AND 3),
    CONSTRAINT approval_batch_items_claim_check
        CHECK (
            (
                claim_token IS NULL
                AND claimed_at IS NULL
                AND claim_expires_at IS NULL
            )
            OR (
                claim_token IS NOT NULL
                AND claimed_at IS NOT NULL
                AND claim_expires_at > claimed_at
            )
        ),
    CONSTRAINT approval_batch_items_error_code_check
        CHECK (
            terminal_error_code IS NULL
            OR (
                terminal_error_code = upper(terminal_error_code)
                AND terminal_error_code ~ '^[A-Z][A-Z0-9_]{1,79}$'
            )
        ),
    CONSTRAINT approval_batch_items_error_params_check
        CHECK (
            public.approval_batch_error_params_are_safe(error_params)
        ),
    CONSTRAINT approval_batch_items_state_check
        CHECK (
            (
                status = 'queued'
                AND attempt_count = 0
                AND next_attempt_at IS NULL
                AND claim_token IS NULL
                AND terminal_error_code IS NULL
                AND started_at IS NULL
                AND completed_at IS NULL
            )
            OR (
                status = 'processing'
                AND attempt_count BETWEEN 1 AND 3
                AND next_attempt_at IS NULL
                AND claim_token IS NOT NULL
                AND terminal_error_code IS NULL
                AND started_at IS NOT NULL
                AND completed_at IS NULL
            )
            OR (
                status = 'retry_wait'
                AND attempt_count BETWEEN 1 AND 2
                AND next_attempt_at IS NOT NULL
                AND claim_token IS NULL
                AND terminal_error_code IS NULL
                AND started_at IS NOT NULL
                AND completed_at IS NULL
            )
            OR (
                status = 'succeeded'
                AND attempt_count BETWEEN 1 AND 3
                AND next_attempt_at IS NULL
                AND claim_token IS NULL
                AND terminal_error_code IS NULL
                AND started_at IS NOT NULL
                AND completed_at IS NOT NULL
            )
            OR (
                status = 'failed'
                AND attempt_count BETWEEN 1 AND 3
                AND next_attempt_at IS NULL
                AND claim_token IS NULL
                AND terminal_error_code IS NOT NULL
                AND started_at IS NOT NULL
                AND completed_at IS NOT NULL
            )
        )
);

CREATE TABLE public.approval_batch_item_attempts (
    id UUID PRIMARY KEY DEFAULT public.gen_random_uuid(),
    batch_item_id UUID NOT NULL
        REFERENCES public.approval_batch_items(id) ON DELETE RESTRICT,
    attempt_number SMALLINT NOT NULL,
    event_type TEXT NOT NULL,
    claim_token UUID NOT NULL,
    error_code TEXT,
    error_params JSONB NOT NULL DEFAULT '{}'::JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT approval_batch_item_attempts_event_key
        UNIQUE (batch_item_id, attempt_number, event_type),
    CONSTRAINT approval_batch_item_attempts_attempt_number_check
        CHECK (attempt_number BETWEEN 1 AND 3),
    CONSTRAINT approval_batch_item_attempts_event_type_check
        CHECK (
            event_type IN (
                'claimed',
                'started',
                'retry_scheduled',
                'succeeded',
                'terminal_failure'
            )
        ),
    CONSTRAINT approval_batch_item_attempts_error_code_check
        CHECK (
            error_code IS NULL
            OR (
                error_code = upper(error_code)
                AND error_code ~ '^[A-Z][A-Z0-9_]{1,79}$'
            )
        ),
    CONSTRAINT approval_batch_item_attempts_error_params_check
        CHECK (
            public.approval_batch_error_params_are_safe(error_params)
        )
);

CREATE INDEX approval_batches_requested_by_created_at_idx
ON public.approval_batches (requested_by, created_at DESC, id);

CREATE INDEX approval_batches_parent_batch_id_idx
ON public.approval_batches (parent_batch_id)
WHERE parent_batch_id IS NOT NULL;

CREATE INDEX approval_batch_items_batch_status_idx
ON public.approval_batch_items (batch_id, status);

CREATE INDEX approval_batch_items_batch_id_id_idx
ON public.approval_batch_items (batch_id, id);

CREATE INDEX approval_batch_items_sample_id_idx
ON public.approval_batch_items (sample_id);

CREATE INDEX approval_batch_item_attempts_item_time_idx
ON public.approval_batch_item_attempts (
    batch_item_id,
    attempt_number,
    occurred_at
);

COMMENT ON TABLE public.approval_batches
IS 'Dark durable approval-batch request identity and aggregate lifecycle. Rows are never hard-deleted.';

COMMENT ON COLUMN public.approval_batches.request_fingerprint
IS 'SHA-256 of sorted sample IDs, normalized note, and server-derived request mode.';

COMMENT ON COLUMN public.approval_batches.step_up_authorization_id
IS 'Opaque server-derived step-up authorization reference. It is not an OTP, cookie, token, or JWT.';

COMMENT ON COLUMN public.approval_batches.step_up_verified_at
IS 'Server-derived time at which manager email OTP step-up was verified.';

COMMENT ON COLUMN public.approval_batches.step_up_cohort
IS 'Fixed server-derived step-up cohort. Phase P3 accepts manager_email_otp only.';

COMMENT ON TABLE public.approval_batch_items
IS 'One immutable sample and entered-result snapshot per approval batch.';

COMMENT ON COLUMN public.approval_batch_items.error_params
IS 'Sanitized Vietnamese-safe error parameters without secret-bearing keys.';

COMMENT ON TABLE public.approval_batch_item_attempts
IS 'Append-only claim and execution evidence. UPDATE and DELETE are prohibited.';

CREATE FUNCTION public.prevent_approval_batch_request_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $trigger$
BEGIN
    IF OLD.status IN ('completed', 'completed_with_failures') THEN
        IF NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION
                'terminal approval batch is immutable'
                USING ERRCODE = '55000';
        END IF;

        RETURN OLD;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.parent_batch_id IS DISTINCT FROM OLD.parent_batch_id
       OR NEW.request_key IS DISTINCT FROM OLD.request_key
       OR NEW.request_mode IS DISTINCT FROM OLD.request_mode
       OR NEW.request_fingerprint IS DISTINCT FROM OLD.request_fingerprint
       OR NEW.approval_note IS DISTINCT FROM OLD.approval_note
       OR NEW.step_up_authorization_id IS DISTINCT FROM
           OLD.step_up_authorization_id
       OR NEW.step_up_verified_at IS DISTINCT FROM OLD.step_up_verified_at
       OR NEW.step_up_cohort IS DISTINCT FROM OLD.step_up_cohort
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'approval batch request identity is immutable'
            USING ERRCODE = '55000';
    END IF;

    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$trigger$;

CREATE FUNCTION public.prevent_approval_batch_item_request_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $trigger$
BEGIN
    IF OLD.status IN ('succeeded', 'failed') THEN
        IF NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION
                'terminal approval batch item is immutable'
                USING ERRCODE = '55000';
        END IF;

        RETURN OLD;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
       OR NEW.sample_id IS DISTINCT FROM OLD.sample_id
       OR NEW.selected_result_ids IS DISTINCT FROM OLD.selected_result_ids
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'approval batch item request snapshot is immutable'
            USING ERRCODE = '55000';
    END IF;

    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$trigger$;

CREATE FUNCTION public.prevent_approval_batch_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $trigger$
BEGIN
    RAISE EXCEPTION
        '% rows cannot be hard-deleted',
        TG_TABLE_NAME
        USING ERRCODE = '55000';
END;
$trigger$;

CREATE FUNCTION public.prevent_approval_batch_attempt_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $trigger$
BEGIN
    RAISE EXCEPTION
        'approval batch item attempts are append-only'
        USING ERRCODE = '55000';
END;
$trigger$;

CREATE TRIGGER approval_batches_immutable_request
BEFORE UPDATE ON public.approval_batches
FOR EACH ROW
EXECUTE FUNCTION public.prevent_approval_batch_request_change();

CREATE TRIGGER approval_batches_no_hard_delete
BEFORE DELETE ON public.approval_batches
FOR EACH ROW
EXECUTE FUNCTION public.prevent_approval_batch_hard_delete();

CREATE TRIGGER audit_approval_batches_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.approval_batches
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

CREATE TRIGGER approval_batch_items_immutable_request
BEFORE UPDATE ON public.approval_batch_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_approval_batch_item_request_change();

CREATE TRIGGER approval_batch_items_no_hard_delete
BEFORE DELETE ON public.approval_batch_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_approval_batch_hard_delete();

CREATE TRIGGER audit_approval_batch_items_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.approval_batch_items
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

CREATE TRIGGER approval_batch_item_attempts_append_only
BEFORE UPDATE OR DELETE ON public.approval_batch_item_attempts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_approval_batch_attempt_mutation();

CREATE TRIGGER audit_approval_batch_item_attempts_trigger
AFTER INSERT ON public.approval_batch_item_attempts
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

ALTER TABLE public.approval_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approval_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_batch_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approval_batch_item_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_batch_item_attempts FORCE ROW LEVEL SECURITY;

CREATE FUNCTION public.approval_batch_owner_can_read(
    p_batch_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
    SELECT auth.role() = 'authenticated'
       AND EXISTS (
           SELECT 1
           FROM public.approval_batches AS owned_batch
           JOIN public.users AS owner
             ON owner.id = owned_batch.requested_by
           WHERE owned_batch.id = p_batch_id
             AND owned_batch.requested_by = auth.uid()
             AND owner.deleted_at IS NULL
             AND owner.role = 'manager'::public.user_role
             AND NOT EXISTS (
                 SELECT 1
                 FROM public.approval_batch_items AS owned_item
                 CROSS JOIN LATERAL unnest(
                     owned_item.selected_result_ids
                 ) AS selected(result_id)
                 LEFT JOIN public.results AS result
                   ON result.id = selected.result_id
                 LEFT JOIN public.assay_definitions AS assay
                   ON assay.id = result.assay_id
                 WHERE owned_item.batch_id = owned_batch.id
                   AND (
                       result.id IS NULL
                       OR result.sample_id IS DISTINCT FROM
                           owned_item.sample_id
                       OR assay.id IS NULL
                   )
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM public.approval_batch_items AS current_item
                 JOIN public.results AS current_result
                   ON current_result.sample_id = current_item.sample_id
                 LEFT JOIN public.assay_definitions AS current_assay
                   ON current_assay.id = current_result.assay_id
                 WHERE current_item.batch_id = owned_batch.id
                   AND (
                       current_assay.id IS NULL
                       OR (
                           current_assay.is_confidential
                           AND owner.can_access_confidential
                               IS DISTINCT FROM TRUE
                       )
                   )
             )
       );
$function$;

COMMENT ON FUNCTION public.approval_batch_owner_can_read(UUID)
IS 'Authenticated manager-owner read guard that rechecks current confidential-result access.';

DROP POLICY IF EXISTS approval_batches_owner_select
ON public.approval_batches;
CREATE POLICY approval_batches_owner_select
ON public.approval_batches
FOR SELECT
TO authenticated
USING (
    (SELECT public.approval_batch_owner_can_read(id))
);

DROP POLICY IF EXISTS approval_batch_items_owner_select
ON public.approval_batch_items;
CREATE POLICY approval_batch_items_owner_select
ON public.approval_batch_items
FOR SELECT
TO authenticated
USING (
    (
        SELECT public.approval_batch_owner_can_read(
            approval_batch_items.batch_id
        )
    )
);

DROP POLICY IF EXISTS approval_batch_item_attempts_owner_select
ON public.approval_batch_item_attempts;
CREATE POLICY approval_batch_item_attempts_owner_select
ON public.approval_batch_item_attempts
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.approval_batch_items AS owned_item
        WHERE owned_item.id =
            approval_batch_item_attempts.batch_item_id
          AND (
              SELECT public.approval_batch_owner_can_read(
                  owned_item.batch_id
              )
          )
    )
);

REVOKE ALL ON TABLE public.approval_batches
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.approval_batch_items
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.approval_batch_item_attempts
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.approval_batch_uuid_array_is_canonical(UUID[])
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.approval_batch_error_params_are_safe(JSONB)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.approval_batch_request_fingerprint(
    UUID[],
    TEXT,
    TEXT
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_approval_batch_request_change()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_approval_batch_item_request_change()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_approval_batch_hard_delete()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_approval_batch_attempt_mutation()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.approval_batch_owner_can_read(UUID)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.approval_batch_owner_can_read(UUID)
TO authenticated;

CREATE FUNCTION public.approval_batch_storage_catalog_is_exact()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions, pg_temp
AS $checker$
BEGIN
    IF to_regclass('public.approval_batches') IS NULL
       OR to_regclass('public.approval_batch_items') IS NULL
       OR to_regclass('public.approval_batch_item_attempts') IS NULL
    THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        WITH expected(
            function_name,
            argument_types,
            return_type,
            language_name,
            volatility,
            security_definer,
            function_config
        ) AS (
            VALUES
                (
                    'approval_batch_uuid_array_is_canonical'::TEXT,
                    'uuid[]'::TEXT,
                    'boolean'::TEXT,
                    'sql'::TEXT,
                    'i'::"char",
                    FALSE,
                    ARRAY['search_path=public, extensions, pg_temp']::TEXT[]
                ),
                (
                    'approval_batch_error_params_are_safe',
                    'jsonb',
                    'boolean',
                    'sql',
                    'i',
                    FALSE,
                    ARRAY['search_path=public, extensions, pg_temp']
                ),
                (
                    'approval_batch_request_fingerprint',
                    'uuid[], text, text',
                    'text',
                    'sql',
                    'i',
                    FALSE,
                    ARRAY['search_path=public, extensions, pg_temp']
                ),
                (
                    'prevent_approval_batch_request_change',
                    '',
                    'trigger',
                    'plpgsql',
                    'v',
                    FALSE,
                    ARRAY['search_path=public, extensions, pg_temp']
                ),
                (
                    'prevent_approval_batch_item_request_change',
                    '',
                    'trigger',
                    'plpgsql',
                    'v',
                    FALSE,
                    ARRAY['search_path=public, extensions, pg_temp']
                ),
                (
                    'prevent_approval_batch_hard_delete',
                    '',
                    'trigger',
                    'plpgsql',
                    'v',
                    FALSE,
                    ARRAY['search_path=public, extensions, pg_temp']
                ),
                (
                    'prevent_approval_batch_attempt_mutation',
                    '',
                    'trigger',
                    'plpgsql',
                    'v',
                    FALSE,
                    ARRAY['search_path=public, extensions, pg_temp']
                ),
                (
                    'approval_batch_owner_can_read',
                    'uuid',
                    'boolean',
                    'sql',
                    's',
                    TRUE,
                    ARRAY['search_path=public, extensions, pg_temp']
                ),
                (
                    'approval_batch_storage_catalog_is_exact',
                    '',
                    'boolean',
                    'plpgsql',
                    's',
                    FALSE,
                    ARRAY['search_path=public, extensions, pg_temp']
                )
        ),
        actual AS (
            SELECT
                function_record.proname::TEXT,
                oidvectortypes(function_record.proargtypes)::TEXT,
                format_type(function_record.prorettype, NULL)::TEXT,
                language_record.lanname::TEXT,
                function_record.provolatile,
                function_record.prosecdef,
                function_record.proconfig
            FROM pg_proc AS function_record
            JOIN pg_namespace AS namespace
              ON namespace.oid = function_record.pronamespace
            JOIN pg_language AS language_record
              ON language_record.oid = function_record.prolang
            WHERE namespace.nspname = 'public'
              AND function_record.proname = ANY(ARRAY[
                  'approval_batch_uuid_array_is_canonical',
                  'approval_batch_error_params_are_safe',
                  'approval_batch_request_fingerprint',
                  'prevent_approval_batch_request_change',
                  'prevent_approval_batch_item_request_change',
                  'prevent_approval_batch_hard_delete',
                  'prevent_approval_batch_attempt_mutation',
                  'approval_batch_owner_can_read',
                  'approval_batch_storage_catalog_is_exact'
              ])
        )
        SELECT 1
        FROM (
            (SELECT * FROM expected EXCEPT SELECT * FROM actual)
            UNION ALL
            (SELECT * FROM actual EXCEPT SELECT * FROM expected)
        ) AS difference
    ) THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        WITH expected(
            table_name,
            ordinal_position,
            column_name,
            type_name,
            not_null,
            default_kind
        ) AS (
            VALUES
                ('approval_batches'::TEXT, 1::SMALLINT, 'id'::TEXT, 'uuid'::TEXT, TRUE, 'uuid'::TEXT),
                ('approval_batches', 2, 'requested_by', 'uuid', TRUE, 'none'),
                ('approval_batches', 3, 'parent_batch_id', 'uuid', FALSE, 'none'),
                ('approval_batches', 4, 'request_key', 'uuid', TRUE, 'none'),
                ('approval_batches', 5, 'request_mode', 'text', TRUE, 'none'),
                ('approval_batches', 6, 'request_fingerprint', 'text', TRUE, 'none'),
                ('approval_batches', 7, 'approval_note', 'text', FALSE, 'none'),
                ('approval_batches', 8, 'step_up_authorization_id', 'uuid', TRUE, 'none'),
                ('approval_batches', 9, 'step_up_verified_at', 'timestamp with time zone', TRUE, 'none'),
                ('approval_batches', 10, 'step_up_cohort', 'text', TRUE, 'none'),
                ('approval_batches', 11, 'status', 'text', TRUE, 'queued'),
                ('approval_batches', 12, 'created_at', 'timestamp with time zone', TRUE, 'clock'),
                ('approval_batches', 13, 'started_at', 'timestamp with time zone', FALSE, 'none'),
                ('approval_batches', 14, 'completed_at', 'timestamp with time zone', FALSE, 'none'),
                ('approval_batches', 15, 'updated_at', 'timestamp with time zone', TRUE, 'clock'),
                ('approval_batch_items', 1, 'id', 'uuid', TRUE, 'uuid'),
                ('approval_batch_items', 2, 'batch_id', 'uuid', TRUE, 'none'),
                ('approval_batch_items', 3, 'sample_id', 'uuid', TRUE, 'none'),
                ('approval_batch_items', 4, 'selected_result_ids', 'uuid[]', TRUE, 'none'),
                ('approval_batch_items', 5, 'status', 'text', TRUE, 'queued'),
                ('approval_batch_items', 6, 'attempt_count', 'smallint', TRUE, 'zero'),
                ('approval_batch_items', 7, 'next_attempt_at', 'timestamp with time zone', FALSE, 'none'),
                ('approval_batch_items', 8, 'claim_token', 'uuid', FALSE, 'none'),
                ('approval_batch_items', 9, 'claimed_at', 'timestamp with time zone', FALSE, 'none'),
                ('approval_batch_items', 10, 'claim_expires_at', 'timestamp with time zone', FALSE, 'none'),
                ('approval_batch_items', 11, 'terminal_error_code', 'text', FALSE, 'none'),
                ('approval_batch_items', 12, 'error_params', 'jsonb', TRUE, 'empty_object'),
                ('approval_batch_items', 13, 'created_at', 'timestamp with time zone', TRUE, 'clock'),
                ('approval_batch_items', 14, 'started_at', 'timestamp with time zone', FALSE, 'none'),
                ('approval_batch_items', 15, 'completed_at', 'timestamp with time zone', FALSE, 'none'),
                ('approval_batch_items', 16, 'updated_at', 'timestamp with time zone', TRUE, 'clock'),
                ('approval_batch_item_attempts', 1, 'id', 'uuid', TRUE, 'uuid'),
                ('approval_batch_item_attempts', 2, 'batch_item_id', 'uuid', TRUE, 'none'),
                ('approval_batch_item_attempts', 3, 'attempt_number', 'smallint', TRUE, 'none'),
                ('approval_batch_item_attempts', 4, 'event_type', 'text', TRUE, 'none'),
                ('approval_batch_item_attempts', 5, 'claim_token', 'uuid', TRUE, 'none'),
                ('approval_batch_item_attempts', 6, 'error_code', 'text', FALSE, 'none'),
                ('approval_batch_item_attempts', 7, 'error_params', 'jsonb', TRUE, 'empty_object'),
                ('approval_batch_item_attempts', 8, 'occurred_at', 'timestamp with time zone', TRUE, 'clock')
        ),
        actual AS (
            SELECT
                relation.relname::TEXT,
                attribute.attnum,
                attribute.attname::TEXT,
                format_type(attribute.atttypid, attribute.atttypmod),
                attribute.attnotnull,
                CASE
                    WHEN attribute_default.oid IS NULL THEN 'none'
                    WHEN pg_get_expr(
                        attribute_default.adbin,
                        attribute_default.adrelid
                    ) ILIKE '%gen_random_uuid()%' THEN 'uuid'
                    WHEN pg_get_expr(
                        attribute_default.adbin,
                        attribute_default.adrelid
                    ) = 'clock_timestamp()' THEN 'clock'
                    WHEN pg_get_expr(
                        attribute_default.adbin,
                        attribute_default.adrelid
                    ) = '''queued''::text' THEN 'queued'
                    WHEN pg_get_expr(
                        attribute_default.adbin,
                        attribute_default.adrelid
                    ) = '0' THEN 'zero'
                    WHEN pg_get_expr(
                        attribute_default.adbin,
                        attribute_default.adrelid
                    ) = '''{}''::jsonb' THEN 'empty_object'
                    ELSE pg_get_expr(
                        attribute_default.adbin,
                        attribute_default.adrelid
                    )
                END
            FROM pg_class AS relation
            JOIN pg_namespace AS namespace
              ON namespace.oid = relation.relnamespace
            JOIN pg_attribute AS attribute
              ON attribute.attrelid = relation.oid
             AND attribute.attnum > 0
             AND NOT attribute.attisdropped
            LEFT JOIN pg_attrdef AS attribute_default
              ON attribute_default.adrelid = relation.oid
             AND attribute_default.adnum = attribute.attnum
            WHERE namespace.nspname = 'public'
              AND relation.relname IN (
                  'approval_batches',
                  'approval_batch_items',
                  'approval_batch_item_attempts'
              )
        )
        SELECT 1
        FROM (
            (SELECT * FROM expected EXCEPT SELECT * FROM actual)
            UNION ALL
            (SELECT * FROM actual EXCEPT SELECT * FROM expected)
        ) AS difference
    ) THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        WITH expected(table_name, constraint_name, constraint_type) AS (
            VALUES
                ('approval_batches'::TEXT, 'approval_batches_pkey'::TEXT, 'p'::"char"),
                ('approval_batches', 'approval_batches_requested_by_fkey', 'f'),
                ('approval_batches', 'approval_batches_parent_batch_id_fkey', 'f'),
                ('approval_batches', 'approval_batches_requested_by_request_key_key', 'u'),
                ('approval_batches', 'approval_batches_parent_not_self_check', 'c'),
                ('approval_batches', 'approval_batches_request_mode_check', 'c'),
                ('approval_batches', 'approval_batches_parent_mode_check', 'c'),
                ('approval_batches', 'approval_batches_request_fingerprint_check', 'c'),
                ('approval_batches', 'approval_batches_approval_note_check', 'c'),
                ('approval_batches', 'approval_batches_step_up_cohort_check', 'c'),
                ('approval_batches', 'approval_batches_step_up_time_check', 'c'),
                ('approval_batches', 'approval_batches_status_check', 'c'),
                ('approval_batches', 'approval_batches_status_timestamps_check', 'c'),
                ('approval_batch_items', 'approval_batch_items_pkey', 'p'),
                ('approval_batch_items', 'approval_batch_items_batch_id_fkey', 'f'),
                ('approval_batch_items', 'approval_batch_items_sample_id_fkey', 'f'),
                ('approval_batch_items', 'approval_batch_items_batch_id_sample_id_key', 'u'),
                ('approval_batch_items', 'approval_batch_items_snapshot_check', 'c'),
                ('approval_batch_items', 'approval_batch_items_status_check', 'c'),
                ('approval_batch_items', 'approval_batch_items_attempt_count_check', 'c'),
                ('approval_batch_items', 'approval_batch_items_claim_check', 'c'),
                ('approval_batch_items', 'approval_batch_items_error_code_check', 'c'),
                ('approval_batch_items', 'approval_batch_items_error_params_check', 'c'),
                ('approval_batch_items', 'approval_batch_items_state_check', 'c'),
                ('approval_batch_item_attempts', 'approval_batch_item_attempts_pkey', 'p'),
                ('approval_batch_item_attempts', 'approval_batch_item_attempts_batch_item_id_fkey', 'f'),
                ('approval_batch_item_attempts', 'approval_batch_item_attempts_event_key', 'u'),
                ('approval_batch_item_attempts', 'approval_batch_item_attempts_attempt_number_check', 'c'),
                ('approval_batch_item_attempts', 'approval_batch_item_attempts_event_type_check', 'c'),
                ('approval_batch_item_attempts', 'approval_batch_item_attempts_error_code_check', 'c'),
                ('approval_batch_item_attempts', 'approval_batch_item_attempts_error_params_check', 'c')
        ),
        actual AS (
            SELECT
                relation.relname::TEXT,
                constraint_record.conname::TEXT,
                constraint_record.contype
            FROM pg_constraint AS constraint_record
            JOIN pg_class AS relation
              ON relation.oid = constraint_record.conrelid
            JOIN pg_namespace AS namespace
              ON namespace.oid = relation.relnamespace
            WHERE namespace.nspname = 'public'
              AND relation.relname IN (
                  'approval_batches',
                  'approval_batch_items',
                  'approval_batch_item_attempts'
              )
        )
        SELECT 1
        FROM (
            (SELECT * FROM expected EXCEPT SELECT * FROM actual)
            UNION ALL
            (SELECT * FROM actual EXCEPT SELECT * FROM expected)
        ) AS difference
    ) THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        WITH expected(
            constraint_name,
            source_columns,
            target_schema,
            target_table,
            target_columns,
            delete_action
        ) AS (
            VALUES
                ('approval_batches_pkey'::TEXT, ARRAY['id']::TEXT[], NULL::TEXT, NULL::TEXT, NULL::TEXT[], NULL::"char"),
                ('approval_batches_requested_by_fkey', ARRAY['requested_by'], 'public', 'users', ARRAY['id'], 'r'),
                ('approval_batches_parent_batch_id_fkey', ARRAY['parent_batch_id'], 'public', 'approval_batches', ARRAY['id'], 'r'),
                ('approval_batches_requested_by_request_key_key', ARRAY['requested_by', 'request_key'], NULL, NULL, NULL, NULL),
                ('approval_batch_items_pkey', ARRAY['id'], NULL, NULL, NULL, NULL),
                ('approval_batch_items_batch_id_fkey', ARRAY['batch_id'], 'public', 'approval_batches', ARRAY['id'], 'r'),
                ('approval_batch_items_sample_id_fkey', ARRAY['sample_id'], 'public', 'samples', ARRAY['id'], 'r'),
                ('approval_batch_items_batch_id_sample_id_key', ARRAY['batch_id', 'sample_id'], NULL, NULL, NULL, NULL),
                ('approval_batch_item_attempts_pkey', ARRAY['id'], NULL, NULL, NULL, NULL),
                ('approval_batch_item_attempts_batch_item_id_fkey', ARRAY['batch_item_id'], 'public', 'approval_batch_items', ARRAY['id'], 'r'),
                ('approval_batch_item_attempts_event_key', ARRAY['batch_item_id', 'attempt_number', 'event_type'], NULL, NULL, NULL, NULL)
        ),
        actual AS (
            SELECT
                constraint_record.conname::TEXT,
                ARRAY(
                    SELECT attribute.attname::TEXT
                    FROM unnest(constraint_record.conkey)
                        WITH ORDINALITY AS key_column(attnum, position)
                    JOIN pg_attribute AS attribute
                      ON attribute.attrelid = constraint_record.conrelid
                     AND attribute.attnum = key_column.attnum
                    ORDER BY key_column.position
                ),
                target_namespace.nspname::TEXT,
                target_relation.relname::TEXT,
                CASE
                    WHEN constraint_record.confrelid = 0 THEN NULL::TEXT[]
                    ELSE ARRAY(
                        SELECT attribute.attname::TEXT
                        FROM unnest(constraint_record.confkey)
                            WITH ORDINALITY AS key_column(attnum, position)
                        JOIN pg_attribute AS attribute
                          ON attribute.attrelid = constraint_record.confrelid
                         AND attribute.attnum = key_column.attnum
                        ORDER BY key_column.position
                    )
                END,
                CASE
                    WHEN constraint_record.contype = 'f'
                    THEN constraint_record.confdeltype
                    ELSE NULL::"char"
                END
            FROM pg_constraint AS constraint_record
            JOIN pg_class AS source_relation
              ON source_relation.oid = constraint_record.conrelid
            JOIN pg_namespace AS namespace
              ON namespace.oid = source_relation.relnamespace
            LEFT JOIN pg_class AS target_relation
              ON target_relation.oid = constraint_record.confrelid
            LEFT JOIN pg_namespace AS target_namespace
              ON target_namespace.oid = target_relation.relnamespace
            WHERE namespace.nspname = 'public'
              AND constraint_record.contype IN ('p', 'u', 'f')
              AND source_relation.relname IN (
                  'approval_batches',
                  'approval_batch_items',
                  'approval_batch_item_attempts'
              )
        )
        SELECT 1
        FROM (
            (SELECT * FROM expected EXCEPT SELECT * FROM actual)
            UNION ALL
            (SELECT * FROM actual EXCEPT SELECT * FROM expected)
        ) AS difference
    ) THEN
        RETURN FALSE;
    END IF;

    IF (
        SELECT count(*)
        FROM pg_class AS relation
        JOIN pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname IN (
              'approval_batches',
              'approval_batch_items',
              'approval_batch_item_attempts'
          )
          AND relation.relkind = 'r'
          AND relation.relrowsecurity
          AND relation.relforcerowsecurity
    ) <> 3
       OR EXISTS (
           WITH expected(
               index_name,
               table_name,
               key_columns,
               descending_keys,
               has_predicate
           ) AS (
               VALUES
                   (
                       'approval_batches_requested_by_created_at_idx'::TEXT,
                       'approval_batches'::TEXT,
                       ARRAY['requested_by', 'created_at', 'id']::TEXT[],
                       ARRAY[FALSE, TRUE, FALSE]::BOOLEAN[],
                       FALSE
                   ),
                   (
                       'approval_batches_parent_batch_id_idx',
                       'approval_batches',
                       ARRAY['parent_batch_id'],
                       ARRAY[FALSE],
                       TRUE
                   ),
                   (
                       'approval_batch_items_batch_status_idx',
                       'approval_batch_items',
                       ARRAY['batch_id', 'status'],
                       ARRAY[FALSE, FALSE],
                       FALSE
                   ),
                   (
                       'approval_batch_items_batch_id_id_idx',
                       'approval_batch_items',
                       ARRAY['batch_id', 'id'],
                       ARRAY[FALSE, FALSE],
                       FALSE
                   ),
                   (
                       'approval_batch_items_sample_id_idx',
                       'approval_batch_items',
                       ARRAY['sample_id'],
                       ARRAY[FALSE],
                       FALSE
                   ),
                   (
                       'approval_batch_item_attempts_item_time_idx',
                       'approval_batch_item_attempts',
                       ARRAY['batch_item_id', 'attempt_number', 'occurred_at'],
                       ARRAY[FALSE, FALSE, FALSE],
                       FALSE
                   )
           ),
           actual AS (
               SELECT
                   index_relation.relname::TEXT,
                   table_relation.relname::TEXT,
                   ARRAY(
                       SELECT attribute.attname::TEXT
                       FROM unnest(index_record.indkey)
                           WITH ORDINALITY AS key_column(attnum, position)
                       JOIN pg_attribute AS attribute
                         ON attribute.attrelid = index_record.indrelid
                        AND attribute.attnum = key_column.attnum
                       WHERE key_column.position <= index_record.indnkeyatts
                       ORDER BY key_column.position
                   ),
                   ARRAY(
                       SELECT (key_option.option_value & 1) = 1
                       FROM unnest(index_record.indoption)
                           WITH ORDINALITY AS key_option(
                               option_value,
                               position
                           )
                       WHERE key_option.position <= index_record.indnkeyatts
                       ORDER BY key_option.position
                   ),
                   index_record.indpred IS NOT NULL
               FROM pg_index AS index_record
               JOIN pg_class AS index_relation
                 ON index_relation.oid = index_record.indexrelid
               JOIN pg_namespace AS index_namespace
                 ON index_namespace.oid = index_relation.relnamespace
               JOIN pg_class AS table_relation
                 ON table_relation.oid = index_record.indrelid
               WHERE index_namespace.nspname = 'public'
                 AND index_relation.relname = ANY(ARRAY[
                     'approval_batches_requested_by_created_at_idx',
                     'approval_batches_parent_batch_id_idx',
                     'approval_batch_items_batch_status_idx',
                     'approval_batch_items_batch_id_id_idx',
                     'approval_batch_items_sample_id_idx',
                     'approval_batch_item_attempts_item_time_idx'
                 ])
                 AND NOT index_record.indisunique
                 AND index_record.indisvalid
                 AND index_record.indisready
                 AND index_record.indexprs IS NULL
                 AND index_record.indnatts = index_record.indnkeyatts
           )
           SELECT 1
           FROM (
               (SELECT * FROM expected EXCEPT SELECT * FROM actual)
               UNION ALL
               (SELECT * FROM actual EXCEPT SELECT * FROM expected)
           ) AS difference
       )
    THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        WITH expected(
            trigger_name,
            table_name,
            function_schema,
            function_name,
            trigger_type
        ) AS (
            VALUES
                ('approval_batches_immutable_request'::TEXT, 'approval_batches'::TEXT, 'public'::TEXT, 'prevent_approval_batch_request_change'::TEXT, 19::SMALLINT),
                ('approval_batches_no_hard_delete', 'approval_batches', 'public', 'prevent_approval_batch_hard_delete', 11),
                ('audit_approval_batches_trigger', 'approval_batches', 'public', 'trigger_audit_log', 29),
                ('approval_batch_items_immutable_request', 'approval_batch_items', 'public', 'prevent_approval_batch_item_request_change', 19),
                ('approval_batch_items_no_hard_delete', 'approval_batch_items', 'public', 'prevent_approval_batch_hard_delete', 11),
                ('audit_approval_batch_items_trigger', 'approval_batch_items', 'public', 'trigger_audit_log', 29),
                ('approval_batch_item_attempts_append_only', 'approval_batch_item_attempts', 'public', 'prevent_approval_batch_attempt_mutation', 27),
                ('audit_approval_batch_item_attempts_trigger', 'approval_batch_item_attempts', 'public', 'trigger_audit_log', 5)
        ),
        actual AS (
            SELECT
                trigger_record.tgname::TEXT,
                relation.relname::TEXT,
                function_namespace.nspname::TEXT,
                function_record.proname::TEXT,
                trigger_record.tgtype
            FROM pg_trigger AS trigger_record
            JOIN pg_class AS relation
              ON relation.oid = trigger_record.tgrelid
            JOIN pg_namespace AS namespace
              ON namespace.oid = relation.relnamespace
            JOIN pg_proc AS function_record
              ON function_record.oid = trigger_record.tgfoid
            JOIN pg_namespace AS function_namespace
              ON function_namespace.oid = function_record.pronamespace
            WHERE namespace.nspname = 'public'
              AND NOT trigger_record.tgisinternal
              AND trigger_record.tgenabled = 'O'
              AND relation.relname IN (
                  'approval_batches',
                  'approval_batch_items',
                  'approval_batch_item_attempts'
              )
        )
        SELECT 1
        FROM (
            (SELECT * FROM expected EXCEPT SELECT * FROM actual)
            UNION ALL
            (SELECT * FROM actual EXCEPT SELECT * FROM expected)
        ) AS difference
    ) THEN
        RETURN FALSE;
    END IF;

    IF (
        SELECT count(*)
        FROM pg_policy
        WHERE polrelid IN (
            'public.approval_batches'::REGCLASS,
            'public.approval_batch_items'::REGCLASS,
            'public.approval_batch_item_attempts'::REGCLASS
        )
    ) <> 3
       OR EXISTS (
           WITH expected(policy_name, table_name) AS (
               VALUES
                   ('approval_batches_owner_select'::TEXT, 'approval_batches'::TEXT),
                   ('approval_batch_items_owner_select', 'approval_batch_items'),
                   ('approval_batch_item_attempts_owner_select', 'approval_batch_item_attempts')
           )
           SELECT 1
           FROM expected
           LEFT JOIN pg_policy AS policy_record
             ON policy_record.polname = expected.policy_name
           LEFT JOIN pg_class AS relation
             ON relation.oid = policy_record.polrelid
           WHERE policy_record.oid IS NULL
              OR relation.relname <> expected.table_name
              OR policy_record.polcmd <> 'r'
              OR NOT policy_record.polpermissive
              OR policy_record.polroles IS DISTINCT FROM ARRAY[
                  (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
              ]::OID[]
              OR policy_record.polwithcheck IS NOT NULL
              OR pg_get_expr(
                  policy_record.polqual,
                  policy_record.polrelid
              ) NOT ILIKE '%approval_batch_owner_can_read%'
       )
    THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
           SELECT 1
           FROM (VALUES
               ('anon'::TEXT),
               ('authenticated'),
               ('service_role')
           ) AS api_role(role_name)
           CROSS JOIN (VALUES
               ('approval_batches'::TEXT),
               ('approval_batch_items'),
               ('approval_batch_item_attempts')
           ) AS batch_table(table_name)
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
               format('public.%I', batch_table.table_name),
               table_privilege.privilege_name
           )
       )
       OR EXISTS (
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
       OR has_function_privilege(
           'service_role',
           'public.approval_batch_owner_can_read(uuid)',
           'EXECUTE'
       )
    THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$checker$;

REVOKE ALL
ON FUNCTION public.approval_batch_storage_catalog_is_exact()
FROM PUBLIC, anon, authenticated, service_role;


DO $verification$
DECLARE
    v_runner_definition TEXT;
BEGIN
    IF NOT public.test_atomic_result_approval_rpc_security() THEN
        RAISE EXCEPTION
            'Migration 194 atomic approval baseline verification failed';
    END IF;

    IF NOT public.approval_batch_storage_catalog_is_exact() THEN
        RAISE EXCEPTION
            'Migration 194 exact storage catalog verification failed';
    END IF;

    IF (
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
            'Migration 194 storage catalog verification failed';
    END IF;

    IF NOT has_function_privilege(
           'authenticated',
           'public.approval_batch_owner_can_read(uuid)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'anon',
           'public.approval_batch_owner_can_read(uuid)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'service_role',
           'public.approval_batch_owner_can_read(uuid)',
           'EXECUTE'
       )
    THEN
        RAISE EXCEPTION
            'Migration 194 storage privilege verification failed';
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
            'Migration 194 must leave approval batch contracts absent';
    END IF;

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    IF v_runner_definition NOT ILIKE
           '%Atomic Result Approval RPC Security%'
       OR v_runner_definition ILIKE
           '%Approval Batch Persistence Security%'
    THEN
        RAISE EXCEPTION
            'Migration 194 changed the Phase P2 security registration';
    END IF;
END;
$verification$;

NOTIFY pgrst, 'reload schema';

COMMIT;
