-- Migration 213: Enforce assay and sample-type compatibility at the database.
--
-- Security impact:
-- - Retires the three legacy assignment RPC signatures after the reviewed v2
--   cutover and preserves authenticated-only execution for the v2 contracts.
-- - Adds SECURITY DEFINER trigger guards with fixed search_path and no direct
--   API-role execution.
-- - Extends run_security_tests() with exact function, trigger, grant, audit,
--   and RLS-adjacent enforcement checks.
--
-- Historical data impact:
-- - Existing result rows are never updated, deleted, or reinterpreted.
-- - Compatibility is checked only for new results INSERTs.
-- - A sample may change active sample type before its first result; the
--   existing samples audit trigger records actor and before/after values.
-- - After the first result, sample_type_id and its legacy type projection are
--   immutable. Sample-type master renames update only result-free samples.
--
-- Rollback strategy:
-- - This migration is forward-only. Any correction must use migration 214 or
--   later; never edit or re-run this file after persistent execution.
--
-- Apply precondition:
-- - Phase 9 must provide the four lims.migration_213_* custom settings from a
--   fresh runtime telemetry review in the same PostgreSQL session.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $telemetry_precondition$
DECLARE
    v_expected_release_commit CONSTANT TEXT :=
        '95aebce2b009914694717e51103e24cfd1ee99e5';
    v_release_commit TEXT := NULLIF(
        current_setting('lims.migration_213_release_commit', TRUE),
        ''
    );
    v_window_started_at TIMESTAMPTZ := NULLIF(
        current_setting(
            'lims.migration_213_telemetry_window_started_at',
            TRUE
        ),
        ''
    )::TIMESTAMPTZ;
    v_window_ended_at TIMESTAMPTZ := NULLIF(
        current_setting(
            'lims.migration_213_telemetry_window_ended_at',
            TRUE
        ),
        ''
    )::TIMESTAMPTZ;
    v_successful_legacy_assignments BIGINT := NULLIF(
        current_setting(
            'lims.migration_213_successful_legacy_assignments',
            TRUE
        ),
        ''
    )::BIGINT;
BEGIN
    IF v_release_commit IS NULL
       OR v_release_commit IS DISTINCT FROM v_expected_release_commit
       OR v_window_started_at IS NULL
       OR v_window_ended_at IS NULL
       OR v_window_started_at >
          TIMESTAMPTZ '2026-08-21T09:16:38Z'
       OR v_window_ended_at <
          TIMESTAMPTZ '2026-08-21T09:23:28Z'
       OR v_window_ended_at <= v_window_started_at
       OR v_window_ended_at > clock_timestamp()
       OR clock_timestamp() - v_window_ended_at > INTERVAL '15 minutes'
       OR v_successful_legacy_assignments IS DISTINCT FROM 0
    THEN
        RAISE EXCEPTION
            'Migration 213 requires fresh reviewed cutover telemetry';
    END IF;
END;
$telemetry_precondition$;

DO $schema_baseline$
BEGIN
    IF to_regclass('public.samples') IS NULL
       OR to_regclass('public.results') IS NULL
       OR to_regclass('public.sample_types') IS NULL
       OR to_regclass(
           'public.assay_sample_type_catalog_revisions'
       ) IS NULL
       OR to_regclass('public.assay_sample_type_reviews') IS NULL
       OR to_regclass(
           'public.assay_sample_type_compatibilities'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 213 requires the complete compatibility schema';
    END IF;

    IF to_regprocedure(
        'public.resolve_assay_sample_type_compatibility(uuid,uuid,bigint)'
    ) IS NULL
       OR to_regprocedure(
           'public.test_assay_sample_type_assignment_v2_security()'
       ) IS NULL
       OR to_regprocedure(
           'public.test_security_definer_rpc_execute_privileges()'
       ) IS NULL
       OR to_regprocedure(
           'public.test_security_definer_rpc_search_path()'
       ) IS NULL
       OR to_regprocedure(
           'public.test_sample_accession_rpcs_require_analyst_role()'
       ) IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 213 requires resolver and security-test baselines';
    END IF;

    IF to_regprocedure(
        'public.enforce_result_sample_type_compatibility()'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.prevent_sample_type_change_after_result()'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.test_assay_sample_type_enforcement()'
       ) IS NOT NULL
       OR EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid IN (
               'public.samples'::REGCLASS,
               'public.results'::REGCLASS
           )
             AND tgname IN (
                 'results_enforce_sample_type_compatibility',
                 'samples_prevent_sample_type_change_after_result'
             )
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION
            'Migration 213 found existing Phase 8 enforcement objects';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::REGCLASS
          AND tgname = 'samples_apply_sample_type_projection'
          AND tgfoid =
              'public.sync_sample_type_projection()'::REGPROCEDURE
          AND NOT tgisinternal
          AND tgenabled = 'O'
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.samples'::REGCLASS
             AND tgname = 'audit_samples_trigger'
             AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
             AND NOT tgisinternal
             AND tgenabled = 'O'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.sample_types'::REGCLASS
             AND tgname = 'sample_types_sync_sample_projection'
             AND tgfoid =
                 'public.sync_sample_type_name_to_samples()'::REGPROCEDURE
             AND NOT tgisinternal
             AND tgenabled = 'O'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.results'::REGCLASS
             AND tgname = 'audit_results_trigger'
             AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
             AND NOT tgisinternal
             AND tgenabled = 'O'
       )
    THEN
        RAISE EXCEPTION
            'Migration 213 requires exact sample/result audit baselines';
    END IF;
END;
$schema_baseline$;

LOCK TABLE
    public.assay_sample_type_catalog_revisions,
    public.assay_sample_type_reviews,
    public.assay_sample_type_compatibilities,
    public.assay_definitions,
    public.sample_types
IN SHARE MODE;

DO $catalog_precondition$
DECLARE
    v_revision_id UUID;
    v_published_count BIGINT;
    v_missing_review_count BIGINT;
    v_configured_without_pair_count BIGINT;
    v_invalid_pair_count BIGINT;
BEGIN
    SELECT count(*)
    INTO v_published_count
    FROM public.assay_sample_type_catalog_revisions
    WHERE status = 'published';

    IF v_published_count <> 1 THEN
        RAISE EXCEPTION
            'Migration 213 requires exactly one published revision';
    END IF;

    SELECT id
    INTO v_revision_id
    FROM public.assay_sample_type_catalog_revisions
    WHERE status = 'published'
    FOR SHARE;

    SELECT count(*)
    INTO v_missing_review_count
    FROM public.assay_definitions AS assay_definition
    LEFT JOIN public.assay_sample_type_reviews AS review
      ON review.revision_id = v_revision_id
     AND review.assay_definition_id = assay_definition.id
    WHERE assay_definition.deleted_at IS NULL
      AND (
          review.assay_definition_id IS NULL
          OR review.assay_compatibility_generation
             IS DISTINCT FROM assay_definition.compatibility_generation
      );

    IF v_missing_review_count <> 0 THEN
        RAISE EXCEPTION
            'Migration 213 published revision has missing or stale reviews';
    END IF;

    SELECT count(*)
    INTO v_configured_without_pair_count
    FROM public.assay_sample_type_reviews AS review
    JOIN public.assay_definitions AS assay_definition
      ON assay_definition.id = review.assay_definition_id
     AND assay_definition.deleted_at IS NULL
    WHERE review.revision_id = v_revision_id
      AND review.disposition = 'configured'
      AND NOT EXISTS (
          SELECT 1
          FROM public.assay_sample_type_compatibilities AS compatibility
          JOIN public.sample_types AS sample_type
            ON sample_type.id = compatibility.sample_type_id
           AND sample_type.deleted_at IS NULL
          WHERE compatibility.revision_id = v_revision_id
            AND compatibility.assay_definition_id =
                review.assay_definition_id
            AND compatibility.removed_at IS NULL
            AND compatibility.assay_compatibility_generation =
                assay_definition.compatibility_generation
            AND compatibility.sample_type_compatibility_generation =
                sample_type.compatibility_generation
      );

    IF v_configured_without_pair_count <> 0 THEN
        RAISE EXCEPTION
            'Migration 213 published revision has configured assays without current pairs';
    END IF;

    SELECT count(*)
    INTO v_invalid_pair_count
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_definitions AS assay_definition
      ON assay_definition.id = compatibility.assay_definition_id
    JOIN public.sample_types AS sample_type
      ON sample_type.id = compatibility.sample_type_id
    JOIN public.assay_sample_type_reviews AS review
      ON review.revision_id = compatibility.revision_id
     AND review.assay_definition_id = compatibility.assay_definition_id
    WHERE compatibility.revision_id = v_revision_id
      AND compatibility.removed_at IS NULL
      AND (
          assay_definition.deleted_at IS NOT NULL
          OR sample_type.deleted_at IS NOT NULL
          OR review.disposition IS DISTINCT FROM 'configured'
          OR review.assay_compatibility_generation
             IS DISTINCT FROM assay_definition.compatibility_generation
          OR compatibility.assay_compatibility_generation
             IS DISTINCT FROM assay_definition.compatibility_generation
          OR compatibility.sample_type_compatibility_generation
             IS DISTINCT FROM sample_type.compatibility_generation
      );

    IF v_invalid_pair_count <> 0 THEN
        RAISE EXCEPTION
            'Migration 213 published revision has inactive or stale pairs';
    END IF;
END;
$catalog_precondition$;

DO $rpc_baseline$
DECLARE
    v_legacy REGPROCEDURE;
    v_v2 REGPROCEDURE;
    v_signature TEXT;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
        'public.assign_tests_to_sample(uuid,jsonb)'
    ] LOOP
        v_legacy := to_regprocedure(v_signature);
        IF v_legacy IS NULL
           OR NOT has_function_privilege(
               'authenticated',
               v_legacy,
               'EXECUTE'
           )
        THEN
            RAISE EXCEPTION
                'Migration 213 requires authenticated legacy RPC baseline: %',
                v_signature;
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY ARRAY[
        'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)',
        'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)',
        'public.assign_tests_to_sample_v2(uuid,uuid,jsonb,bigint)'
    ] LOOP
        v_v2 := to_regprocedure(v_signature);
        IF v_v2 IS NULL
           OR NOT has_function_privilege(
               'authenticated',
               v_v2,
               'EXECUTE'
           )
           OR has_function_privilege('anon', v_v2, 'EXECUTE')
           OR has_function_privilege('service_role', v_v2, 'EXECUTE')
           OR EXISTS (
               SELECT 1
               FROM pg_proc
               WHERE oid = v_v2
                 AND (
                     NOT prosecdef
                     OR NOT (
                         COALESCE(proconfig, ARRAY[]::TEXT[])
                         @> ARRAY['search_path=public, extensions']
                     )
                 )
           )
        THEN
            RAISE EXCEPTION
                'Migration 213 requires hardened v2 RPC baseline: %',
                v_signature;
        END IF;
    END LOOP;
END;
$rpc_baseline$;

DO $refresh_security_checkers$
DECLARE
    v_definition TEXT;
    v_updated TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.test_security_definer_rpc_execute_privileges()'::REGPROCEDURE
    )
    INTO v_definition;
    v_updated := replace(
        replace(
            v_definition,
            'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
            'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)'
        ),
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
        'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)'
    );
    IF v_updated = v_definition
       OR v_updated ILIKE
          '%public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)%'
       OR v_updated ILIKE
          '%public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)%'
    THEN
        RAISE EXCEPTION
            'Migration 213 could not update execute-privilege checker';
    END IF;
    EXECUTE v_updated;

    SELECT pg_get_functiondef(
        'public.test_security_definer_rpc_search_path()'::REGPROCEDURE
    )
    INTO v_definition;
    v_updated := replace(
        replace(
            v_definition,
            'create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
            'create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)'
        ),
        'accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
        'accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)'
    );
    IF v_updated = v_definition
       OR v_updated ILIKE
          '%create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)%'
       OR v_updated ILIKE
          '%accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)%'
    THEN
        RAISE EXCEPTION
            'Migration 213 could not update search-path checker';
    END IF;
    EXECUTE v_updated;

    SELECT pg_get_functiondef(
        'public.test_sample_quality_enforcement()'::REGPROCEDURE
    )
    INTO v_definition;
    v_updated := replace(
        replace(
            v_definition,
            'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
            'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)'
        ),
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
        'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)'
    );
    IF v_updated = v_definition
       OR v_updated ILIKE
          '%public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)%'
       OR v_updated ILIKE
          '%public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)%'
    THEN
        RAISE EXCEPTION
            'Migration 213 could not update sample-quality security test';
    END IF;
    EXECUTE v_updated;
END;
$refresh_security_checkers$;

CREATE OR REPLACE FUNCTION
    public.test_sample_accession_rpcs_require_analyst_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_create_def TEXT;
    v_accession_def TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)'::REGPROCEDURE
    )
    INTO v_create_def;
    SELECT pg_get_functiondef(
        'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)'::REGPROCEDURE
    )
    INTO v_accession_def;

    IF v_create_def IS NULL
       OR v_create_def NOT ILIKE
          '%v_user_role IS DISTINCT FROM ''analyst''%'
       OR v_create_def ILIKE '%manager%'
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: create_sample_atomic_v2 is not analyst-only';
        RETURN FALSE;
    END IF;

    IF v_accession_def IS NULL
       OR v_accession_def NOT ILIKE
          '%v_user_role IS DISTINCT FROM ''analyst''%'
       OR v_accession_def ILIKE '%manager%'
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: accession_and_assign_tests_v2 is not analyst-only';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_tests_to_sample_v2(
    p_sample_id UUID,
    p_sample_type_id UUID,
    p_tests JSONB,
    p_expected_revision_number BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT := public.get_user_role();
    v_sample_status public.sample_status;
    v_stored_sample_type_id UUID;
    v_inserted_count INTEGER := 0;
    v_new_status public.sample_status;
    v_revision_number BIGINT;
    v_test JSONB;
    v_zero_uuid CONSTANT UUID :=
        '00000000-0000-0000-0000-000000000000';
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF v_user_role IS NULL
       OR v_user_role NOT IN ('analyst', 'manager')
    THEN
        RAISE EXCEPTION 'Insufficient permissions'
            USING ERRCODE = '42501';
    END IF;

    IF p_tests IS NULL
       OR jsonb_typeof(p_tests) <> 'array'
       OR jsonb_array_length(p_tests) = 0
    THEN
        RAISE EXCEPTION 'At least one test must be provided';
    END IF;

    SELECT sample.status, sample.sample_type_id
    INTO v_sample_status, v_stored_sample_type_id
    FROM public.samples AS sample
    WHERE sample.id = p_sample_id
      AND sample.deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample not found';
    END IF;

    IF v_stored_sample_type_id IS DISTINCT FROM p_sample_type_id THEN
        RAISE EXCEPTION 'Sample type does not match the stored sample'
            USING ERRCODE = 'P1102';
    END IF;

    IF v_user_role = 'analyst'
       AND v_sample_status NOT IN ('received', 'assigned')
    THEN
        RAISE EXCEPTION
            'Analysts can only assign tests when the sample is received or already assigned';
    END IF;

    -- Lock the catalog and sample type before the sample row. The master-name
    -- projection trigger uses the same sample_type -> sample lock order.
    v_revision_number :=
        public.resolve_sample_type_compatibility_revision(
            p_sample_type_id,
            p_expected_revision_number
        );

    FOR v_test IN
        WITH expanded AS (
            SELECT
                (test->>'assayId')::UUID AS assay_id,
                NULLIF(test->>'methodId', '')::UUID AS method_id
            FROM jsonb_array_elements(p_tests) AS test
        ),
        deduped AS (
            SELECT DISTINCT assay_id, method_id
            FROM expanded
            WHERE assay_id IS NOT NULL
        )
        SELECT jsonb_build_object(
            'assayId', deduped.assay_id,
            'methodId', deduped.method_id
        )
        FROM deduped
        LEFT JOIN public.results AS existing
          ON existing.sample_id = p_sample_id
         AND existing.assay_id = deduped.assay_id
         AND COALESCE(existing.method_id, v_zero_uuid) =
             COALESCE(deduped.method_id, v_zero_uuid)
        WHERE existing.id IS NULL
    LOOP
        PERFORM public.resolve_assay_sample_type_compatibility(
            p_sample_type_id,
            (v_test->>'assayId')::UUID,
            v_revision_number
        );
    END LOOP;

    SELECT sample.status, sample.sample_type_id
    INTO v_sample_status, v_stored_sample_type_id
    FROM public.samples AS sample
    WHERE sample.id = p_sample_id
      AND sample.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample not found';
    END IF;

    IF v_stored_sample_type_id IS DISTINCT FROM p_sample_type_id THEN
        RAISE EXCEPTION 'Sample type does not match the stored sample'
            USING ERRCODE = 'P1102';
    END IF;

    IF v_user_role = 'analyst'
       AND v_sample_status NOT IN ('received', 'assigned')
    THEN
        RAISE EXCEPTION
            'Analysts can only assign tests when the sample is received or already assigned';
    END IF;

    WITH expanded AS (
        SELECT
            (test->>'assayId')::UUID AS assay_id,
            NULLIF(test->>'methodId', '')::UUID AS method_id
        FROM jsonb_array_elements(p_tests) AS test
    ),
    deduped AS (
        SELECT DISTINCT assay_id, method_id
        FROM expanded
        WHERE assay_id IS NOT NULL
    ),
    existing AS (
        SELECT assay_id, COALESCE(method_id, v_zero_uuid) AS method_id
        FROM public.results
        WHERE sample_id = p_sample_id
    ),
    to_insert AS (
        SELECT deduped.assay_id, deduped.method_id
        FROM deduped
        LEFT JOIN existing
          ON existing.assay_id = deduped.assay_id
         AND existing.method_id =
             COALESCE(deduped.method_id, v_zero_uuid)
        WHERE existing.assay_id IS NULL
    ),
    inserted AS (
        INSERT INTO public.results (
            sample_id,
            assay_id,
            method_id,
            status
        )
        SELECT p_sample_id, assay_id, method_id, 'pending'
        FROM to_insert
        RETURNING id
    )
    SELECT COUNT(*)
    INTO v_inserted_count
    FROM inserted;

    IF v_inserted_count > 0 THEN
        v_new_status := CASE
            WHEN v_sample_status = 'received' THEN 'assigned'
            ELSE v_sample_status
        END;

        UPDATE public.samples
        SET status = v_new_status,
            updated_at = NOW()
        WHERE id = p_sample_id;
    ELSE
        v_new_status := v_sample_status;
    END IF;

    RETURN jsonb_build_object(
        'sample_id', p_sample_id,
        'inserted_count', v_inserted_count,
        'new_status', v_new_status,
        'compatibility_revision_number', v_revision_number
    );
END;
$$;

REVOKE ALL ON FUNCTION
    public.create_sample_atomic(
        UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN
    )
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.accession_and_assign_tests(
        UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN
    )
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.assign_tests_to_sample(UUID, JSONB)
FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.create_sample_atomic(
    UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN
);
DROP FUNCTION public.accession_and_assign_tests(
    UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN
);
DROP FUNCTION public.assign_tests_to_sample(UUID, JSONB);

REVOKE ALL ON FUNCTION
    public.create_sample_atomic_v2(
        UUID, TEXT, TIMESTAMPTZ, UUID, UUID, BOOLEAN, BIGINT
    )
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
    public.create_sample_atomic_v2(
        UUID, TEXT, TIMESTAMPTZ, UUID, UUID, BOOLEAN, BIGINT
    )
TO authenticated;

REVOKE ALL ON FUNCTION
    public.accession_and_assign_tests_v2(
        UUID, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN, BIGINT
    )
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
    public.accession_and_assign_tests_v2(
        UUID, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN, BIGINT
    )
TO authenticated;

REVOKE ALL ON FUNCTION
    public.assign_tests_to_sample_v2(UUID, UUID, JSONB, BIGINT)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
    public.assign_tests_to_sample_v2(UUID, UUID, JSONB, BIGINT)
TO authenticated;

CREATE FUNCTION public.enforce_result_sample_type_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_sample_type_id UUID;
    v_locked_sample_type_id UUID;
BEGIN
    SELECT sample.sample_type_id
    INTO v_sample_type_id
    FROM public.samples AS sample
    WHERE sample.id = NEW.sample_id
      AND sample.deleted_at IS NULL;

    IF v_sample_type_id IS NULL THEN
        RAISE EXCEPTION 'Sample type does not exist or is inactive'
            USING ERRCODE = 'P1102';
    END IF;

    PERFORM public.resolve_assay_sample_type_compatibility(
        v_sample_type_id,
        NEW.assay_id,
        NULL
    );

    SELECT sample.sample_type_id
    INTO v_locked_sample_type_id
    FROM public.samples AS sample
    WHERE sample.id = NEW.sample_id
      AND sample.deleted_at IS NULL
    FOR SHARE;

    IF v_locked_sample_type_id IS NULL THEN
        RAISE EXCEPTION 'Sample type does not exist or is inactive'
            USING ERRCODE = 'P1102';
    END IF;

    IF v_locked_sample_type_id IS DISTINCT FROM v_sample_type_id THEN
        RAISE EXCEPTION
            'Sample type changed during result compatibility validation'
            USING
                ERRCODE = '40001',
                HINT = 'Retry the result insert against the current sample type';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
    public.enforce_result_sample_type_compatibility()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER results_enforce_sample_type_compatibility
BEFORE INSERT ON public.results
FOR EACH ROW
EXECUTE FUNCTION public.enforce_result_sample_type_compatibility();

CREATE FUNCTION public.prevent_sample_type_change_after_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NEW.sample_type_id IS NOT DISTINCT FROM OLD.sample_type_id
       AND NEW.type IS NOT DISTINCT FROM OLD.type
    THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.results AS result
        WHERE result.sample_id = OLD.id
    ) THEN
        RAISE EXCEPTION
            'Sample type cannot change after the first result'
            USING ERRCODE = 'P1107';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
    public.prevent_sample_type_change_after_result()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER samples_prevent_sample_type_change_after_result
BEFORE UPDATE OF sample_type_id, type ON public.samples
FOR EACH ROW
EXECUTE FUNCTION public.prevent_sample_type_change_after_result();

CREATE OR REPLACE FUNCTION public.sync_sample_type_name_to_samples()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.samples AS sample
    SET type = NEW.name
    WHERE sample.sample_type_id = NEW.id
      AND sample.type IS DISTINCT FROM NEW.name
      AND NOT EXISTS (
          SELECT 1
          FROM public.results AS result
          WHERE result.sample_id = sample.id
      );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sample_type_name_to_samples()
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.test_assay_sample_type_enforcement()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_signature TEXT;
    v_function REGPROCEDURE;
    v_trigger_definition TEXT;
    v_function_definition TEXT;
    v_runner_definition TEXT;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
        'public.assign_tests_to_sample(uuid,jsonb)'
    ] LOOP
        IF to_regprocedure(v_signature) IS NOT NULL THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY ARRAY[
        'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)',
        'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)',
        'public.assign_tests_to_sample_v2(uuid,uuid,jsonb,bigint)'
    ] LOOP
        v_function := to_regprocedure(v_signature);
        IF v_function IS NULL
           OR NOT has_function_privilege(
               'authenticated',
               v_function,
               'EXECUTE'
           )
           OR has_function_privilege('anon', v_function, 'EXECUTE')
           OR has_function_privilege('service_role', v_function, 'EXECUTE')
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    SELECT pg_get_functiondef(
        'public.assign_tests_to_sample_v2(uuid,uuid,jsonb,bigint)'
            ::REGPROCEDURE
    )
    INTO v_function_definition;

    IF strpos(
        lower(v_function_definition),
        'resolve_sample_type_compatibility_revision'
    ) = 0
       OR strpos(lower(v_function_definition), 'for update') = 0
       OR strpos(
           lower(v_function_definition),
           'resolve_sample_type_compatibility_revision'
       ) > strpos(lower(v_function_definition), 'for update')
    THEN
        RETURN FALSE;
    END IF;

    FOREACH v_signature IN ARRAY ARRAY[
        'public.enforce_result_sample_type_compatibility()',
        'public.prevent_sample_type_change_after_result()',
        'public.sync_sample_type_name_to_samples()'
    ] LOOP
        v_function := to_regprocedure(v_signature);
        IF v_function IS NULL
           OR NOT EXISTS (
               SELECT 1
               FROM pg_proc AS function_record
               WHERE function_record.oid = v_function::OID
                 AND function_record.prosecdef
                 AND function_record.proconfig = ARRAY[
                     CASE
                         WHEN v_signature =
                              'public.sync_sample_type_name_to_samples()'
                         THEN 'search_path=public, pg_temp'
                         ELSE 'search_path=public, extensions'
                     END
                 ]
                 AND pg_get_userbyid(function_record.proowner) = 'postgres'
           )
           OR has_function_privilege(
               'authenticated',
               v_function,
               'EXECUTE'
           )
           OR has_function_privilege('anon', v_function, 'EXECUTE')
           OR has_function_privilege('service_role', v_function, 'EXECUTE')
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    SELECT pg_get_triggerdef(trigger_record.oid),
           pg_get_functiondef(trigger_record.tgfoid)
    INTO v_trigger_definition, v_function_definition
    FROM pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.results'::REGCLASS
      AND trigger_record.tgname =
          'results_enforce_sample_type_compatibility'
      AND trigger_record.tgfoid =
          'public.enforce_result_sample_type_compatibility()'::REGPROCEDURE
      AND NOT trigger_record.tgisinternal
      AND trigger_record.tgenabled = 'O';

    IF v_trigger_definition IS NULL
       OR v_trigger_definition NOT ILIKE '%BEFORE INSERT ON public.results%'
       OR v_function_definition NOT ILIKE
          '%resolve_assay_sample_type_compatibility%'
    THEN
        RETURN FALSE;
    END IF;

    SELECT pg_get_triggerdef(trigger_record.oid),
           pg_get_functiondef(trigger_record.tgfoid)
    INTO v_trigger_definition, v_function_definition
    FROM pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'public.samples'::REGCLASS
      AND trigger_record.tgname =
          'samples_prevent_sample_type_change_after_result'
      AND trigger_record.tgfoid =
          'public.prevent_sample_type_change_after_result()'::REGPROCEDURE
      AND NOT trigger_record.tgisinternal
      AND trigger_record.tgenabled = 'O';

    IF v_trigger_definition IS NULL
       OR v_trigger_definition NOT ILIKE
          '%BEFORE UPDATE OF sample_type_id, type ON public.samples%'
       OR v_function_definition NOT ILIKE '%FROM public.results%'
       OR v_function_definition NOT ILIKE '%P1107%'
    THEN
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef(
        'public.sync_sample_type_name_to_samples()'::REGPROCEDURE
    )
    INTO v_function_definition;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger AS trigger_record
        WHERE trigger_record.tgrelid = 'public.sample_types'::REGCLASS
          AND trigger_record.tgname =
              'sample_types_sync_sample_projection'
          AND trigger_record.tgfoid =
              'public.sync_sample_type_name_to_samples()'::REGPROCEDURE
          AND NOT trigger_record.tgisinternal
          AND trigger_record.tgenabled = 'O'
          AND pg_get_triggerdef(trigger_record.oid) ILIKE
              '%AFTER UPDATE OF name ON public.sample_types%'
    )
       OR v_function_definition NOT ILIKE
          '%NOT EXISTS (%FROM public.results AS result%result.sample_id = sample.id%'
    THEN
        RETURN FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::REGCLASS
          AND tgname = 'audit_samples_trigger'
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
          AND NOT tgisinternal
          AND tgenabled = 'O'
          AND pg_get_triggerdef(oid) ILIKE
              '%AFTER INSERT OR DELETE OR UPDATE ON public.samples%'
    ) THEN
        RETURN FALSE;
    END IF;

    IF NOT public.test_security_definer_rpc_execute_privileges()
       OR NOT public.test_security_definer_rpc_search_path()
       OR NOT public.test_sample_accession_rpcs_require_analyst_role()
       OR NOT public.test_sample_quality_enforcement()
       OR NOT public.test_assay_sample_type_assignment_v2_security()
    THEN
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    RETURN v_runner_definition ILIKE
        '%Assay Sample-Type Enforcement%';
END;
$$;

REVOKE ALL ON FUNCTION public.test_assay_sample_type_enforcement()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_assay_sample_type_enforcement()
TO authenticated;

DO $register_security_test$
DECLARE
    v_definition TEXT;
    v_anchor TEXT :=
        '(''Approval Batch Worker Observability Security''::TEXT, '
        || 'test_approval_batch_worker_observability_security(), '
        || '''Verifies authoritative privacy-safe queue age, worker-only '
        || 'execution, no direct table access, and pinned search_path'''
        || '::TEXT);';
    v_replacement TEXT :=
        '(''Approval Batch Worker Observability Security''::TEXT, '
        || 'test_approval_batch_worker_observability_security(), '
        || '''Verifies authoritative privacy-safe queue age, worker-only '
        || 'execution, no direct table access, and pinned search_path'''
        || '::TEXT),'
        || E'\n        '
        || '(''Assay Sample-Type Enforcement''::TEXT, '
        || 'test_assay_sample_type_enforcement(), '
        || '''Verifies retired legacy assignment RPCs, v2 grants, direct '
        || 'result compatibility enforcement, post-result sample-type '
        || 'immutability, historical projection preservation, and audit '
        || 'bindings''::TEXT);';
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;

    IF v_definition ILIKE '%Assay Sample-Type Enforcement%' THEN
        RETURN;
    END IF;

    IF v_definition NOT LIKE '%' || v_anchor || '%' THEN
        RAISE EXCEPTION
            'Migration 213 could not locate the security runner anchor';
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

    IF to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.assign_tests_to_sample(uuid,jsonb)'
       ) IS NOT NULL
       OR NOT public.test_assay_sample_type_enforcement()
       OR v_runner_definition NOT ILIKE
          '%Assay Sample-Type Enforcement%'
       OR NOT EXISTS (
           SELECT 1
           FROM public.run_security_tests()
           WHERE test_name = 'Assay Sample-Type Enforcement'
             AND passed
       )
    THEN
        RAISE EXCEPTION
            'Migration 213 assay sample-type enforcement verification failed';
    END IF;
END;
$verification$;

COMMENT ON FUNCTION public.enforce_result_sample_type_compatibility() IS
    'Rejects each new result whose sample type and assay are not current in the published compatibility catalog.';
COMMENT ON FUNCTION public.prevent_sample_type_change_after_result() IS
    'Keeps sample_type_id and the legacy type projection immutable after the sample has its first result.';
COMMENT ON FUNCTION public.test_assay_sample_type_enforcement() IS
    'Verifies legacy RPC retirement, v2 grants, exact enforcement triggers, historical projection preservation, and audit bindings.';

COMMIT;
