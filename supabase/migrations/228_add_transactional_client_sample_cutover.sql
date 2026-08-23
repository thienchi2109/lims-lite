-- Add transactional sample/accession RPCs for deterministic client resolution.
-- Security impact: adds analyst-only SECURITY DEFINER RPCs with fixed search_path
-- and authenticated-only execution; no table policy or direct mutation grant changes.
-- Historical data impact: additive functions only; existing client, sample,
-- result, audit, constraint, trigger, and canonical projection rows are unchanged.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_signature TEXT;
    v_expected_hash TEXT;
    v_actual_hash TEXT;
BEGIN
    FOR v_signature, v_expected_hash IN
        SELECT *
        FROM (
            VALUES
                (
                    'public.resolve_client_identity_v2(text,text,text,date,text)',
                    '1bbf36da9685b41c3a7401dcf5683780'
                ),
                (
                    'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)',
                    'ee62b9d0b4308ae76836333d21080e01'
                ),
                (
                    'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)',
                    '145c4518c480a6e602e4817b999f19de'
                ),
                (
                    'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)',
                    'b1b3a384524c1999d3da9acb9fbc6e75'
                )
        ) AS expected(signature, definition_hash)
    LOOP
        IF to_regprocedure(v_signature) IS NULL THEN
            RAISE EXCEPTION
                'Migration 228 requires baseline function %',
                v_signature;
        END IF;

        SELECT md5(pg_get_functiondef(to_regprocedure(v_signature)))
        INTO v_actual_hash;

        IF v_actual_hash IS DISTINCT FROM v_expected_hash THEN
            RAISE EXCEPTION
                'Migration 228 baseline drift for %: expected %, found %',
                v_signature,
                v_expected_hash,
                v_actual_hash;
        END IF;
    END LOOP;

    IF to_regprocedure(
        'public.resolve_and_lock_accession_client_v2_228(boolean,text,text,text,date,text,text,text,text,date)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.create_sample_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,uuid,boolean,bigint)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,jsonb,uuid,boolean,bigint)'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 228 additive functions already exist';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_record
        WHERE constraint_record.conrelid = 'public.clients'::REGCLASS
          AND constraint_record.conname = 'clients_unique_identity'
          AND constraint_record.contype = 'u'
          AND pg_get_constraintdef(constraint_record.oid) =
              'UNIQUE (name, date_of_birth)'
    ) THEN
        RAISE EXCEPTION
            'Migration 228 requires the reversible legacy identity gate';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger AS trigger_record
        WHERE trigger_record.tgrelid = 'public.samples'::REGCLASS
          AND trigger_record.tgname = 'sync_samples_client_name'
          AND trigger_record.tgfoid =
              'public.sync_client_name_snapshot()'::REGPROCEDURE
          AND NOT trigger_record.tgisinternal
          AND trigger_record.tgenabled = 'O'
          AND pg_get_triggerdef(trigger_record.oid) ILIKE
              '%BEFORE INSERT OR UPDATE OF client_id ON public.samples%'
    ) THEN
        RAISE EXCEPTION
            'Migration 228 requires sync_samples_client_name baseline';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.clients AS client
        WHERE client.normalized_name IS DISTINCT FROM
                public.normalize_client_name_v1(client.name)
           OR client.normalized_phone IS DISTINCT FROM
                public.normalize_client_phone_v1(client.phone)
           OR client.government_identity_value IS DISTINCT FROM
                public.normalize_client_government_identity_v1(
                    client.id_card_num
                )
           OR client.government_identity_type IS DISTINCT FROM
                public.classify_client_government_identity_v1(
                    client.id_card_num
                )
    ) THEN
        RAISE EXCEPTION
            'Migration 228 requires reconciled canonical client projections';
    END IF;
END;
$baseline$;

CREATE FUNCTION public.resolve_and_lock_accession_client_v2_228(
    p_allow_create BOOLEAN,
    p_government_identity_type TEXT,
    p_government_identity_value TEXT,
    p_name TEXT,
    p_date_of_birth DATE,
    p_gender TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_health_insurance_num TEXT,
    p_expiry_date DATE
)
RETURNS TABLE (
    outcome TEXT,
    reason_code TEXT,
    client_id UUID,
    created BOOLEAN,
    client_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_initial RECORD;
    v_revalidated RECORD;
    v_locked_client_name TEXT;
BEGIN
    IF p_allow_create IS NULL THEN
        RAISE EXCEPTION 'Client creation mode is required'
            USING ERRCODE = '22004';
    END IF;

    IF p_allow_create THEN
        SELECT *
        INTO v_initial
        FROM public.resolve_or_create_client_v2(
            p_government_identity_type,
            p_government_identity_value,
            p_name,
            p_date_of_birth,
            p_gender,
            p_phone,
            p_address,
            p_health_insurance_num,
            p_expiry_date
        );
    ELSE
        SELECT *
        INTO v_initial
        FROM public.resolve_client_identity_v2(
            p_government_identity_type,
            p_government_identity_value,
            p_name,
            p_date_of_birth,
            p_phone
        );
    END IF;

    IF v_initial.outcome IS DISTINCT FROM 'matched'
       OR v_initial.client_id IS NULL
    THEN
        RETURN QUERY
        SELECT
            v_initial.outcome::TEXT,
            v_initial.reason_code::TEXT,
            v_initial.client_id::UUID,
            v_initial.created::BOOLEAN,
            NULL::TEXT;
        RETURN;
    END IF;

    SELECT client.name
    INTO v_locked_client_name
    FROM public.clients AS client
    WHERE client.id = v_initial.client_id
      AND client.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'conflict'::TEXT,
            'inactive_candidate'::TEXT,
            NULL::UUID,
            FALSE::BOOLEAN,
            NULL::TEXT;
        RETURN;
    END IF;

    IF p_allow_create THEN
        SELECT *
        INTO v_revalidated
        FROM public.resolve_or_create_client_v2(
            p_government_identity_type,
            p_government_identity_value,
            p_name,
            p_date_of_birth,
            p_gender,
            p_phone,
            p_address,
            p_health_insurance_num,
            p_expiry_date
        );
    ELSE
        SELECT *
        INTO v_revalidated
        FROM public.resolve_client_identity_v2(
            p_government_identity_type,
            p_government_identity_value,
            p_name,
            p_date_of_birth,
            p_phone
        );
    END IF;

    IF v_revalidated.outcome IS DISTINCT FROM 'matched' THEN
        RETURN QUERY
        SELECT
            v_revalidated.outcome::TEXT,
            v_revalidated.reason_code::TEXT,
            v_revalidated.client_id::UUID,
            v_revalidated.created::BOOLEAN,
            NULL::TEXT;
        RETURN;
    END IF;

    IF v_revalidated.client_id IS DISTINCT FROM v_initial.client_id THEN
        RAISE EXCEPTION 'Client resolution target changed during accession'
            USING
                ERRCODE = '40001',
                HINT = 'Retry client resolution before accession';
    END IF;

    RETURN QUERY
    SELECT
        v_initial.outcome::TEXT,
        v_initial.reason_code::TEXT,
        v_initial.client_id::UUID,
        v_initial.created::BOOLEAN,
        v_locked_client_name;
END;
$$;

REVOKE ALL ON FUNCTION
    public.resolve_and_lock_accession_client_v2_228(
        BOOLEAN,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TEXT,
        TEXT,
        TEXT,
        TEXT,
        DATE
    )
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.create_sample_with_client_resolution_v2(
    p_allow_create BOOLEAN,
    p_government_identity_type TEXT,
    p_government_identity_value TEXT,
    p_name TEXT,
    p_date_of_birth DATE,
    p_gender TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_health_insurance_num TEXT,
    p_expiry_date DATE,
    p_received_at TIMESTAMPTZ,
    p_sample_type_id UUID,
    p_sample_quality BOOLEAN,
    p_expected_revision_number BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_revision_number BIGINT;
    v_resolution RECORD;
    v_resolution_json JSONB;
    v_sample JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF public.get_user_role()::TEXT IS DISTINCT FROM 'analyst' THEN
        RAISE EXCEPTION 'Insufficient permissions'
            USING ERRCODE = '42501';
    END IF;

    IF p_sample_quality IS NULL THEN
        RAISE EXCEPTION 'Sample quality is required'
            USING ERRCODE = '23502';
    END IF;

    v_revision_number :=
        public.resolve_sample_type_compatibility_revision(
            p_sample_type_id,
            p_expected_revision_number
        );

    SELECT *
    INTO v_resolution
    FROM public.resolve_and_lock_accession_client_v2_228(
        p_allow_create,
        p_government_identity_type,
        p_government_identity_value,
        p_name,
        p_date_of_birth,
        p_gender,
        p_phone,
        p_address,
        p_health_insurance_num,
        p_expiry_date
    );

    v_resolution_json := jsonb_build_object(
        'outcome', v_resolution.outcome,
        'reason_code', v_resolution.reason_code,
        'client_id', v_resolution.client_id,
        'created', v_resolution.created
    );

    IF v_resolution.outcome IS DISTINCT FROM 'matched'
       OR v_resolution.client_id IS NULL
    THEN
        RETURN jsonb_build_object(
            'resolution', v_resolution_json,
            'sample', NULL
        );
    END IF;

    v_sample := public.create_sample_atomic_v2(
        v_resolution.client_id,
        v_resolution.client_name,
        p_received_at,
        v_user_id,
        p_sample_type_id,
        p_sample_quality,
        v_revision_number
    );

    RETURN jsonb_build_object(
        'resolution', v_resolution_json,
        'sample', v_sample
    );
END;
$$;

REVOKE ALL ON FUNCTION
    public.create_sample_with_client_resolution_v2(
        BOOLEAN,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TEXT,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TIMESTAMPTZ,
        UUID,
        BOOLEAN,
        BIGINT
    )
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
    public.create_sample_with_client_resolution_v2(
        BOOLEAN,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TEXT,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TIMESTAMPTZ,
        UUID,
        BOOLEAN,
        BIGINT
    )
TO authenticated;

CREATE FUNCTION public.accession_and_assign_tests_with_client_resolution_v2(
    p_allow_create BOOLEAN,
    p_government_identity_type TEXT,
    p_government_identity_value TEXT,
    p_name TEXT,
    p_date_of_birth DATE,
    p_gender TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_health_insurance_num TEXT,
    p_expiry_date DATE,
    p_received_at TIMESTAMPTZ,
    p_tests JSONB,
    p_sample_type_id UUID,
    p_sample_quality BOOLEAN,
    p_expected_revision_number BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_revision_number BIGINT;
    v_test JSONB;
    v_resolution RECORD;
    v_resolution_json JSONB;
    v_accession JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF public.get_user_role()::TEXT IS DISTINCT FROM 'analyst' THEN
        RAISE EXCEPTION 'Insufficient permissions'
            USING ERRCODE = '42501';
    END IF;

    IF p_sample_quality IS NULL THEN
        RAISE EXCEPTION 'Sample quality is required'
            USING ERRCODE = '23502';
    END IF;

    IF p_tests IS NULL
       OR jsonb_typeof(p_tests) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_tests) = 0
    THEN
        RAISE EXCEPTION 'At least one test assignment is required'
            USING ERRCODE = '22023';
    END IF;

    v_revision_number :=
        public.resolve_sample_type_compatibility_revision(
            p_sample_type_id,
            p_expected_revision_number
        );

    FOR v_test IN SELECT * FROM jsonb_array_elements(p_tests)
    LOOP
        PERFORM public.resolve_assay_sample_type_compatibility(
            p_sample_type_id,
            (v_test->>'assayId')::UUID,
            v_revision_number
        );
    END LOOP;

    SELECT *
    INTO v_resolution
    FROM public.resolve_and_lock_accession_client_v2_228(
        p_allow_create,
        p_government_identity_type,
        p_government_identity_value,
        p_name,
        p_date_of_birth,
        p_gender,
        p_phone,
        p_address,
        p_health_insurance_num,
        p_expiry_date
    );

    v_resolution_json := jsonb_build_object(
        'outcome', v_resolution.outcome,
        'reason_code', v_resolution.reason_code,
        'client_id', v_resolution.client_id,
        'created', v_resolution.created
    );

    IF v_resolution.outcome IS DISTINCT FROM 'matched'
       OR v_resolution.client_id IS NULL
    THEN
        RETURN jsonb_build_object(
            'resolution', v_resolution_json,
            'accession', NULL
        );
    END IF;

    v_accession := public.accession_and_assign_tests_v2(
        v_resolution.client_id,
        v_resolution.client_name,
        p_received_at,
        p_tests,
        p_sample_type_id,
        p_sample_quality,
        v_revision_number
    );

    RETURN jsonb_build_object(
        'resolution', v_resolution_json,
        'accession', v_accession
    );
END;
$$;

REVOKE ALL ON FUNCTION
    public.accession_and_assign_tests_with_client_resolution_v2(
        BOOLEAN,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TEXT,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TIMESTAMPTZ,
        JSONB,
        UUID,
        BOOLEAN,
        BIGINT
    )
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
    public.accession_and_assign_tests_with_client_resolution_v2(
        BOOLEAN,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TEXT,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TIMESTAMPTZ,
        JSONB,
        UUID,
        BOOLEAN,
        BIGINT
    )
TO authenticated;

CREATE FUNCTION public.test_client_resolution_sample_cutover_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_signature TEXT;
    v_function REGPROCEDURE;
    v_definition TEXT;
    v_settings TEXT[];
    v_security_definer BOOLEAN;
    v_public_execute BOOLEAN;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.create_sample_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,uuid,boolean,bigint)',
        'public.accession_and_assign_tests_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,jsonb,uuid,boolean,bigint)'
    ]
    LOOP
        v_function := to_regprocedure(v_signature);
        IF v_function IS NULL
           OR NOT has_function_privilege(
               'authenticated',
               v_function,
               'EXECUTE'
           )
           OR has_function_privilege('anon', v_function, 'EXECUTE')
           OR has_function_privilege(
               'service_role',
               v_function,
               'EXECUTE'
           )
        THEN
            RETURN FALSE;
        END IF;

        SELECT
            function_record.prosecdef,
            function_record.proconfig,
            pg_get_functiondef(function_record.oid),
            EXISTS (
                SELECT 1
                FROM aclexplode(
                    COALESCE(
                        function_record.proacl,
                        acldefault('f', function_record.proowner)
                    )
                ) AS privilege
                WHERE privilege.grantee = 0
                  AND privilege.privilege_type = 'EXECUTE'
            )
        INTO
            v_security_definer,
            v_settings,
            v_definition,
            v_public_execute
        FROM pg_proc AS function_record
        WHERE function_record.oid = v_function;

        IF NOT v_security_definer
           OR v_public_execute
           OR NOT (
               'search_path=public, extensions' =
               ANY(COALESCE(v_settings, ARRAY[]::TEXT[]))
           )
           OR v_definition NOT ILIKE
              '%get_user_role()::TEXT IS DISTINCT FROM ''analyst''%'
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    v_function := to_regprocedure(
        'public.resolve_and_lock_accession_client_v2_228(boolean,text,text,text,date,text,text,text,text,date)'
    );
    IF v_function IS NULL
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

    RETURN EXISTS (
        SELECT 1
        FROM pg_trigger AS trigger_record
        WHERE trigger_record.tgrelid = 'public.samples'::REGCLASS
          AND trigger_record.tgname = 'sync_samples_client_name'
          AND trigger_record.tgfoid =
              'public.sync_client_name_snapshot()'::REGPROCEDURE
          AND NOT trigger_record.tgisinternal
          AND trigger_record.tgenabled = 'O'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_record
        WHERE constraint_record.conrelid = 'public.clients'::REGCLASS
          AND constraint_record.conname = 'clients_unique_identity'
          AND constraint_record.contype = 'u'
    );
END;
$$;

REVOKE ALL ON FUNCTION
    public.test_client_resolution_sample_cutover_security()
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
    public.test_client_resolution_sample_cutover_security()
TO authenticated;

DO $register_security_test$
DECLARE
    v_definition TEXT;
    v_anchor TEXT :=
        '(''Assay Sample-Type Enforcement''::TEXT, '
        || 'test_assay_sample_type_enforcement(), '
        || '''Verifies retired legacy assignment RPCs, v2 grants, direct '
        || 'result compatibility enforcement, post-result sample-type '
        || 'immutability, historical projection preservation, and audit '
        || 'bindings''::TEXT);';
    v_replacement TEXT :=
        '(''Assay Sample-Type Enforcement''::TEXT, '
        || 'test_assay_sample_type_enforcement(), '
        || '''Verifies retired legacy assignment RPCs, v2 grants, direct '
        || 'result compatibility enforcement, post-result sample-type '
        || 'immutability, historical projection preservation, and audit '
        || 'bindings''::TEXT),'
        || E'\n        '
        || '(''Client Resolution Sample Cutover Security''::TEXT, '
        || 'test_client_resolution_sample_cutover_security(), '
        || '''Verifies analyst-only transactional client/sample RPCs, '
        || 'minimal grants, fixed search_path, locked client-name snapshot, '
        || 'and reversible legacy gate preservation''::TEXT);';
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;

    IF v_definition ILIKE
       '%Client Resolution Sample Cutover Security%'
    THEN
        RETURN;
    END IF;

    IF v_definition NOT LIKE '%' || v_anchor || '%' THEN
        RAISE EXCEPTION
            'Migration 228 could not locate the security runner anchor';
    END IF;

    EXECUTE replace(v_definition, v_anchor, v_replacement);
END;
$register_security_test$;

DO $verification$
DECLARE
    v_runner_definition TEXT;
    v_all_security_tests_passed BOOLEAN;
    v_cutover_security_test_passed BOOLEAN;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    SELECT
        bool_and(passed),
        bool_or(
            test_name = 'Client Resolution Sample Cutover Security'
            AND passed
        )
    INTO
        v_all_security_tests_passed,
        v_cutover_security_test_passed
    FROM public.run_security_tests();

    IF v_runner_definition NOT ILIKE
       '%Client Resolution Sample Cutover Security%'
       OR NOT COALESCE(v_all_security_tests_passed, FALSE)
       OR NOT COALESCE(v_cutover_security_test_passed, FALSE)
    THEN
        RAISE EXCEPTION
            'Migration 228 transactional cutover verification failed';
    END IF;
END;
$verification$;

COMMENT ON FUNCTION
    public.resolve_and_lock_accession_client_v2_228(
        BOOLEAN,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TEXT,
        TEXT,
        TEXT,
        TEXT,
        DATE
    )
IS 'Internal Phase 6 resolver helper that locks and revalidates one active client before sample mutation.';
COMMENT ON FUNCTION
    public.create_sample_with_client_resolution_v2(
        BOOLEAN,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TEXT,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TIMESTAMPTZ,
        UUID,
        BOOLEAN,
        BIGINT
    )
IS 'Atomically resolves or creates one client and creates one received sample using the locked database client name.';
COMMENT ON FUNCTION
    public.accession_and_assign_tests_with_client_resolution_v2(
        BOOLEAN,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TEXT,
        TEXT,
        TEXT,
        TEXT,
        DATE,
        TIMESTAMPTZ,
        JSONB,
        UUID,
        BOOLEAN,
        BIGINT
    )
IS 'Atomically resolves or creates one client, creates one assigned sample, and inserts validated pending results.';
COMMENT ON FUNCTION
    public.test_client_resolution_sample_cutover_security()
IS 'Verifies Phase 6 transactional client/sample RPC authorization, grants, search_path, trigger, and reversible-gate baseline.';

COMMIT;
