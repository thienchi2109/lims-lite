-- Migration 214: Allow internal sample projection updates.
--
-- Migration 213 exposed that the existing sample receiver guard revalidated
-- historical received_by values on every UPDATE. Sample-type master renames
-- therefore failed while synchronizing result-free sample projections when a
-- historical receiver was no longer an active analyst.
--
-- Security impact:
-- - INSERT still requires received_by to reference an analyst.
-- - UPDATE still rejects every received_by change after accession.
-- - UPDATEs that leave received_by unchanged no longer revalidate historical
--   receiver state; normal RLS and all other sample triggers remain active.
--
-- Historical data impact:
-- - No sample, result, audit, or compatibility row is changed by this migration.
-- - Migration 213 remains immutable. This correction is forward-only.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_receiver_guard_definition TEXT;
BEGIN
    IF to_regclass('public.samples') IS NULL
       OR to_regclass('public.sample_types') IS NULL
       OR to_regclass('public.results') IS NULL
       OR to_regprocedure(
           'public.enforce_analyst_sample_receiver()'
       ) IS NULL
       OR to_regprocedure(
           'public.sync_sample_type_name_to_samples()'
       ) IS NULL
       OR to_regprocedure(
           'public.test_sample_receiver_guard()'
       ) IS NULL
       OR to_regprocedure(
           'public.test_assay_sample_type_enforcement()'
       ) IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 214 requires the applied migration 213 baseline';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::REGCLASS
          AND tgname = 'samples_enforce_analyst_receiver'
          AND tgfoid =
              'public.enforce_analyst_sample_receiver()'::REGPROCEDURE
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
           WHERE tgrelid = 'public.samples'::REGCLASS
             AND tgname =
                 'samples_prevent_sample_type_change_after_result'
             AND tgfoid =
                 'public.prevent_sample_type_change_after_result()'
                 ::REGPROCEDURE
             AND NOT tgisinternal
             AND tgenabled = 'O'
       )
    THEN
        RAISE EXCEPTION
            'Migration 214 requires exact receiver and compatibility triggers';
    END IF;

    SELECT pg_get_functiondef(
        'public.enforce_analyst_sample_receiver()'::REGPROCEDURE
    )
    INTO v_receiver_guard_definition;

    IF v_receiver_guard_definition NOT ILIKE
           '%IF TG_OP = ''UPDATE'' AND NEW.received_by IS DISTINCT FROM OLD.received_by THEN%'
       OR v_receiver_guard_definition NOT ILIKE
           '%Only analysts can receive samples%'
       OR v_receiver_guard_definition NOT ILIKE
           '%Sample receiver cannot be changed after accession%'
    THEN
        RAISE EXCEPTION
            'Migration 214 found an unexpected receiver guard baseline';
    END IF;
END;
$baseline$;

CREATE OR REPLACE FUNCTION public.enforce_analyst_sample_receiver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
    v_receiver_role public.user_role;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.received_by IS DISTINCT FROM OLD.received_by THEN
            RAISE EXCEPTION
                'Sample receiver cannot be changed after accession'
                USING ERRCODE = '42501';
        END IF;

        RETURN NEW;
    END IF;

    IF NEW.received_by IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role
    INTO v_receiver_role
    FROM public.users
    WHERE id = NEW.received_by;

    IF v_receiver_role IS NULL OR v_receiver_role <> 'analyst' THEN
        RAISE EXCEPTION 'Only analysts can receive samples'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_analyst_sample_receiver()
IS 'Migration 214 preserves analyst-only INSERT validation and receiver immutability while allowing UPDATEs that keep historical received_by unchanged.';

CREATE OR REPLACE FUNCTION public.test_sample_receiver_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_trigger_count INTEGER;
    v_function_definition TEXT;
    v_update_branch_position INTEGER;
    v_insert_validation_position INTEGER;
BEGIN
    SELECT count(*)
    INTO v_trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'public.samples'::REGCLASS
      AND tgname = 'samples_enforce_analyst_receiver'
      AND tgfoid =
          'public.enforce_analyst_sample_receiver()'::REGPROCEDURE
      AND NOT tgisinternal
      AND tgenabled = 'O';

    IF v_trigger_count <> 1 THEN
        RAISE WARNING
            'SECURITY TEST FAILED: expected exact enabled samples receiver trigger';
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef(
        'public.enforce_analyst_sample_receiver()'::REGPROCEDURE
    )
    INTO v_function_definition;

    v_update_branch_position := position(
        'IF TG_OP = ''UPDATE'' THEN'
        IN v_function_definition
    );
    v_insert_validation_position := position(
        'IF NEW.received_by IS NULL THEN'
        IN v_function_definition
    );

    IF v_function_definition IS NULL
       OR v_update_branch_position = 0
       OR v_insert_validation_position <= v_update_branch_position
       OR v_function_definition NOT ILIKE
           '%NEW.received_by IS DISTINCT FROM OLD.received_by%'
       OR v_function_definition NOT ILIKE
           '%Sample receiver cannot be changed after accession%'
       OR v_function_definition NOT ILIKE
           '%Only analysts can receive samples%'
    THEN
        RAISE WARNING
            'SECURITY TEST FAILED: receiver guard correction is incomplete';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

DO $verification$
DECLARE
    v_receiver_guard_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.enforce_analyst_sample_receiver()'::REGPROCEDURE
    )
    INTO v_receiver_guard_definition;

    IF v_receiver_guard_definition NOT ILIKE
           '%IF TG_OP = ''UPDATE'' THEN%'
       OR v_receiver_guard_definition ILIKE
           '%IF TG_OP = ''UPDATE'' AND NEW.received_by IS DISTINCT FROM OLD.received_by THEN%'
       OR NOT public.test_sample_receiver_guard()
       OR NOT public.test_assay_sample_type_enforcement()
    THEN
        RAISE EXCEPTION
            'Migration 214 receiver guard verification failed';
    END IF;
END;
$verification$;

COMMIT;
