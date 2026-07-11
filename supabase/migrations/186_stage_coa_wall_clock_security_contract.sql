-- Migration 186: Stage the CoA wall-clock security contract
-- Security Impact: High
-- Changes:
--   - Pins the staged wall-clock RPC bodies and canonical lease helper.
--   - Verifies lock-before-freshness ordering and forbids transaction time.
--   - Preserves claim grants, provenance, approval, and RLS expectations.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_staged_hashes TEXT[];
BEGIN
    IF to_regprocedure(
        'public.test_coa_generation_wall_clock_contract()'
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 186 expected the wall-clock checker to be absent';
    END IF;

    SELECT ARRAY_AGG(
        encode(public.digest(p.prosrc, 'sha256'::TEXT), 'hex')
        ORDER BY p.proname
    )
    INTO v_staged_hashes
    FROM pg_proc AS p
    JOIN pg_namespace AS n
      ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
          'claim_coa_report_regeneration_wall_clock',
          'coa_generation_lease_duration',
          'complete_coa_report_generation_wall_clock',
          'fail_coa_report_generation_wall_clock',
          'queue_coa_report_for_generation_wall_clock'
      );

    IF v_staged_hashes IS DISTINCT FROM ARRAY[
        'a0fc81ad239beffe048a8346a6f5d60cdab1b7fb827bbcbc0d219f8211fe5cbd',
        'ac77da7450dc7dbb5fba83174af39c9244876718e9658a8f6f16ccaded30b500',
        'abb0dac591c89401f973a3ae95ed22618701f797ea678eba4b3223bb192cc43c',
        'aeaee2c2666bf1fdd7d3ef841d7ae44c7f8e59a87a033915add1019dfade6643',
        'cc40f67ccda1d1f334808c6055f5bb334e3d0d122f67c686ecf423b7cf8ade8f'
    ]::TEXT[] THEN
        RAISE EXCEPTION
            'Migration 186 found an unexpected staged CoA wall-clock baseline';
    END IF;
END;
$$;

CREATE FUNCTION public.test_coa_generation_wall_clock_contract()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_helper_oid OID;
    v_queue_oid OID;
    v_regeneration_oid OID;
    v_complete_oid OID;
    v_fail_oid OID;
    v_queue_source TEXT;
    v_regeneration_source TEXT;
    v_complete_source TEXT;
    v_fail_source TEXT;
BEGIN
    v_helper_oid :=
        to_regprocedure('public.coa_generation_lease_duration()')::OID;
    v_queue_oid := to_regprocedure(
        'public.queue_coa_report_for_generation(uuid,integer)'
    )::OID;
    v_regeneration_oid := to_regprocedure(
        'public.claim_coa_report_regeneration(uuid,integer)'
    )::OID;
    v_complete_oid := to_regprocedure(
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'
    )::OID;
    v_fail_oid := to_regprocedure(
        'public.fail_coa_report_generation(uuid,uuid,text,boolean)'
    )::OID;

    IF v_helper_oid IS NULL
       OR v_queue_oid IS NULL
       OR v_regeneration_oid IS NULL
       OR v_complete_oid IS NULL
       OR v_fail_oid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT prosrc INTO v_queue_source
    FROM pg_proc WHERE oid = v_queue_oid;

    SELECT prosrc INTO v_regeneration_source
    FROM pg_proc WHERE oid = v_regeneration_oid;

    SELECT prosrc INTO v_complete_source
    FROM pg_proc WHERE oid = v_complete_oid;

    SELECT prosrc INTO v_fail_source
    FROM pg_proc WHERE oid = v_fail_oid;

    RETURN EXISTS (
        SELECT 1
        FROM pg_proc AS helper
        JOIN pg_language AS language
          ON language.oid = helper.prolang
        WHERE helper.oid = v_helper_oid
          AND helper.prorettype = 'interval'::regtype
          AND language.lanname = 'sql'
          AND helper.provolatile = 'i'
          AND NOT helper.prosecdef
          AND EXISTS (
              SELECT 1
              FROM unnest(helper.proconfig) AS cfg
              WHERE cfg = 'search_path=pg_catalog'
          )
          AND encode(
              public.digest(helper.prosrc, 'sha256'::TEXT),
              'hex'
          ) = 'ac77da7450dc7dbb5fba83174af39c9244876718e9658a8f6f16ccaded30b500'
    )
    AND NOT has_function_privilege('anon', v_helper_oid, 'EXECUTE')
    AND NOT has_function_privilege(
        'authenticated',
        v_helper_oid,
        'EXECUTE'
    )
    AND NOT has_function_privilege('service_role', v_helper_oid, 'EXECUTE')
    AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name = 'source_submission_id'
          AND data_type = 'uuid'
          AND is_nullable = 'YES'
    )
    AND (
        SELECT COUNT(*) = 4
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name IN (
              'generation_claim_id',
              'generation_claimed_by',
              'generation_claimed_at',
              'generation_previous_status'
          )
    )
    AND EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.coa_reports'::regclass
          AND conname = 'coa_reports_source_submission_sample_fkey'
          AND confdeltype = 'r'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.coa_reports'::regclass
          AND conname = 'coa_reports_generation_claim_state_check'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.coa_reports'::regclass
          AND tgname = 'prevent_coa_report_identity_change'
          AND NOT tgisinternal
          AND pg_get_triggerdef(oid) ILIKE
              '%UPDATE OF sample_id, version, source_submission_id%'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.coa_reports'::regclass
          AND relrowsecurity
    )
    AND NOT has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES'
    )
    AND has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'SELECT'
    )
    AND (
        SELECT BOOL_AND(
            rpc.prosecdef
            AND EXISTS (
                SELECT 1
                FROM unnest(rpc.proconfig) AS cfg
                WHERE cfg = 'search_path=public, extensions'
            )
        )
        FROM pg_proc AS rpc
        WHERE rpc.oid IN (
            v_queue_oid,
            v_regeneration_oid,
            v_complete_oid,
            v_fail_oid
        )
    )
    AND has_function_privilege('authenticated', v_queue_oid, 'EXECUTE')
    AND has_function_privilege(
        'authenticated',
        v_regeneration_oid,
        'EXECUTE'
    )
    AND has_function_privilege('authenticated', v_complete_oid, 'EXECUTE')
    AND has_function_privilege('authenticated', v_fail_oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', v_queue_oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', v_regeneration_oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', v_complete_oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', v_fail_oid, 'EXECUTE')
    AND NOT has_function_privilege('service_role', v_queue_oid, 'EXECUTE')
    AND NOT has_function_privilege(
        'service_role',
        v_regeneration_oid,
        'EXECUTE'
    )
    AND NOT has_function_privilege('service_role', v_complete_oid, 'EXECUTE')
    AND NOT has_function_privilege('service_role', v_fail_oid, 'EXECUTE')
    AND encode(
        public.digest(v_queue_source, 'sha256'::TEXT),
        'hex'
    ) = 'cc40f67ccda1d1f334808c6055f5bb334e3d0d122f67c686ecf423b7cf8ade8f'
    AND encode(
        public.digest(v_regeneration_source, 'sha256'::TEXT),
        'hex'
    ) = 'a0fc81ad239beffe048a8346a6f5d60cdab1b7fb827bbcbc0d219f8211fe5cbd'
    AND encode(
        public.digest(v_complete_source, 'sha256'::TEXT),
        'hex'
    ) = 'abb0dac591c89401f973a3ae95ed22618701f797ea678eba4b3223bb192cc43c'
    AND encode(
        public.digest(v_fail_source, 'sha256'::TEXT),
        'hex'
    ) = 'aeaee2c2666bf1fdd7d3ef841d7ae44c7f8e59a87a033915add1019dfade6643'
    AND LOWER(v_queue_source) NOT LIKE '%now()%'
    AND LOWER(v_regeneration_source) NOT LIKE '%now()%'
    AND LOWER(v_complete_source) NOT LIKE '%now()%'
    AND LOWER(v_fail_source) NOT LIKE '%now()%'
    AND v_queue_source ILIKE '%clock_timestamp()%'
    AND v_regeneration_source ILIKE '%clock_timestamp()%'
    AND v_complete_source ILIKE '%clock_timestamp()%'
    AND v_fail_source ILIKE '%clock_timestamp()%'
    AND v_queue_source ILIKE '%public.coa_generation_lease_duration()%'
    AND v_regeneration_source ILIKE
        '%public.coa_generation_lease_duration()%'
    AND v_complete_source ILIKE
        '%public.coa_generation_lease_duration()%'
    AND v_fail_source ILIKE '%public.coa_generation_lease_duration()%'
    AND STRPOS(LOWER(v_queue_source), 'from public.coa_reports') <
        STRPOS(LOWER(v_queue_source), 'clock_timestamp()')
    AND STRPOS(LOWER(v_regeneration_source), 'from public.coa_reports') <
        STRPOS(LOWER(v_regeneration_source), 'clock_timestamp()')
    AND STRPOS(LOWER(v_complete_source), 'for update') <
        STRPOS(LOWER(v_complete_source), 'clock_timestamp()')
    AND STRPOS(LOWER(v_fail_source), 'for update') <
        STRPOS(LOWER(v_fail_source), 'clock_timestamp()')
    AND v_regeneration_source ILIKE '%HISTORIC_REPORT_WITHOUT_SOURCE%'
    AND v_complete_source ILIKE
        '%Sample approval changed before CoA completion%'
    AND v_complete_source ILIKE '%signature.user_id = v_approver_id%'
    AND v_fail_source ILIKE '%p_restore_ready IS NULL%'
    AND NOT EXISTS (
        SELECT 1
        FROM pg_proc
        JOIN pg_namespace
          ON pg_namespace.oid = pg_proc.pronamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_proc.proname = 'trigger_generate_coa'
          AND pg_proc.pronargs = 0
    )
    AND NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::regclass
          AND tgname = 'trigger_generate_coa_on_approval'
          AND NOT tgisinternal
    );
END;
$$;

COMMENT ON FUNCTION public.test_coa_generation_wall_clock_contract()
IS 'Validates the canonical wall-clock CoA lease and lock-safe claim transitions.';

REVOKE ALL ON FUNCTION public.test_coa_generation_wall_clock_contract()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
