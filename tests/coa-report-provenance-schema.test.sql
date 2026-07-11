-- COA REPORT PROVENANCE SCHEMA REGRESSION TEST
-- Verifies the Phase 4 schema, queue RPC, immutability guard, and registered
-- security contract.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/coa-report-provenance-schema.test.sql

\set ON_ERROR_STOP on
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_source_column_exists BOOLEAN;
    v_source_function_exists BOOLEAN;
    v_source_guard_exists BOOLEAN;
    v_source_fk_exists BOOLEAN;
    v_source_index_exists BOOLEAN;
    v_legacy_trigger_removed BOOLEAN;
    v_claim_columns_exist BOOLEAN;
    v_transition_functions_exist BOOLEAN;
    v_direct_update_revoked BOOLEAN;
    v_checker_definition TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name = 'source_submission_id'
          AND data_type = 'uuid'
          AND is_nullable = 'YES'
    )
    INTO v_source_column_exists;

    v_source_function_exists :=
        to_regprocedure('public.queue_coa_report_for_generation(uuid,integer)')
        IS NOT NULL;

    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.coa_reports'::regclass
          AND tgname = 'prevent_coa_report_identity_change'
          AND NOT tgisinternal
    )
    INTO v_source_guard_exists;

    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.coa_reports'::regclass
          AND conname = 'coa_reports_source_submission_sample_fkey'
          AND confdeltype = 'r'
    )
    INTO v_source_fk_exists;

    SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'coa_reports'
          AND indexname = 'idx_coa_reports_source_submission_id'
    )
    INTO v_source_index_exists;

    SELECT NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::regclass
          AND tgname = 'trigger_generate_coa_on_approval'
          AND NOT tgisinternal
    )
    INTO v_legacy_trigger_removed;

    SELECT COUNT(*) = 4
    INTO v_claim_columns_exist
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'coa_reports'
      AND column_name IN (
          'generation_claim_id',
          'generation_claimed_by',
          'generation_claimed_at',
          'generation_previous_status'
      );

    v_transition_functions_exist :=
        to_regprocedure(
            'public.claim_coa_report_regeneration(uuid,integer)'
        ) IS NOT NULL
        AND to_regprocedure(
            'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'
        ) IS NOT NULL
        AND to_regprocedure(
            'public.fail_coa_report_generation(uuid,uuid,text,boolean)'
        ) IS NOT NULL;

    v_direct_update_revoked := NOT has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'UPDATE'
    );

    SELECT pg_get_functiondef(
        'public.test_coa_report_provenance_guard()'::regprocedure
    )
    INTO v_checker_definition;

    IF NOT v_source_column_exists
       OR NOT v_source_function_exists
       OR NOT v_source_guard_exists
       OR NOT v_source_fk_exists
       OR NOT v_source_index_exists
       OR NOT v_legacy_trigger_removed
       OR NOT v_claim_columns_exist
       OR NOT v_transition_functions_exist
       OR NOT v_direct_update_revoked THEN
        RAISE EXCEPTION
            'Phase 4 CoA provenance schema, claim transitions, direct-update revocation, and immutable associations must exist';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.run_security_tests()
        WHERE test_name = 'CoA Report Provenance Guard'
          AND passed
    ) THEN
        RAISE EXCEPTION
            'run_security_tests() must enforce the CoA provenance contract';
    END IF;

    IF v_checker_definition NOT ILIKE
       '%test_coa_report_provenance_guard_claim_baseline()%'
       OR v_checker_definition NOT ILIKE
       '%digest(v_queue_source, ''sha256''::TEXT)%'
       OR v_checker_definition NOT ILIKE
       '%digest(v_regeneration_source, ''sha256''::TEXT)%' THEN
        RAISE EXCEPTION
            'CoA security checker must pin confidential claim authorization';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'coa-report-provenance-schema: ok' AS result;
