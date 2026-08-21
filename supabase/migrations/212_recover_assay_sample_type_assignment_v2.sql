-- Migration 212: Recover the additive assay/sample-type assignment v2 contract.
--
-- Migration 211 was executed once on the persistent home-server database and
-- rolled back at its security-checker source assertion before creating any
-- function or grant. Migration 211 is immutable; this forward-only correction
-- validates the clean rollback state and creates the intended Phase 5 contract.
--
-- Security impact: two internal SECURITY DEFINER resolvers remain unavailable
-- to client roles. Three additive RPCs are executable only by authenticated
-- users and enforce fail-closed application-role checks. A focused security
-- test is added without replacing the existing run_security_tests() registry.
-- Historical data impact: no existing sample, result, audit row, catalog
-- revision, migration 204-211, or legacy assignment RPC is changed. Result
-- trigger enforcement and legacy retirement remain Phase 8 work.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
BEGIN
    IF to_regclass('public.samples') IS NULL
       OR to_regclass('public.results') IS NULL
       OR to_regclass('public.sample_types') IS NULL
       OR to_regclass('public.assay_definitions') IS NULL
       OR to_regclass(
           'public.assay_sample_type_catalog_revisions'
       ) IS NULL
       OR to_regclass('public.assay_sample_type_reviews') IS NULL
       OR to_regclass(
           'public.assay_sample_type_compatibilities'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 212 requires the Phase 1-4 compatibility schema';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'samples'
          AND column_name = 'sample_type_id'
          AND data_type = 'uuid'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'samples'
          AND column_name = 'sample_quality'
          AND data_type = 'boolean'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'assay_definitions'
          AND column_name = 'compatibility_generation'
          AND data_type = 'bigint'
    ) THEN
        RAISE EXCEPTION
            'Migration 212 compatibility columns do not match the expected baseline';
    END IF;

    IF to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'
    ) IS NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
       ) IS NULL
       OR to_regprocedure(
           'public.assign_tests_to_sample(uuid,jsonb)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 212 requires all current legacy assignment RPCs';
    END IF;

    IF to_regprocedure(
        'public.resolve_sample_type_compatibility_revision(uuid,bigint)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.resolve_assay_sample_type_compatibility(uuid,uuid,bigint)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.assign_tests_to_sample_v2(uuid,uuid,jsonb,bigint)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.test_assay_sample_type_assignment_v2_security()'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 212 expected migration 211 to have rolled back cleanly';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::REGCLASS
          AND tgname = 'audit_samples_trigger'
          AND NOT tgisinternal
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.results'::REGCLASS
          AND tgname = 'audit_results_trigger'
          AND NOT tgisinternal
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
    ) THEN
        RAISE EXCEPTION
            'Migration 212 requires the existing sample and result audit triggers';
    END IF;

    IF to_regprocedure(
        'public.test_security_definer_rpc_execute_privileges()'
    ) IS NULL
       OR to_regprocedure(
           'public.test_security_definer_rpc_search_path()'
       ) IS NULL
       OR to_regprocedure(
           'public.test_sample_accession_rpcs_require_analyst_role()'
       ) IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
       OR NOT public.test_security_definer_rpc_execute_privileges()
       OR NOT public.test_security_definer_rpc_search_path()
       OR NOT public.test_sample_accession_rpcs_require_analyst_role()
    THEN
        RAISE EXCEPTION
            'Migration 212 requires the current security baseline to pass';
    END IF;
END;
$baseline$;

CREATE FUNCTION public.resolve_sample_type_compatibility_revision(
    p_sample_type_id UUID,
    p_expected_revision_number BIGINT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_revision_number BIGINT;
BEGIN
    SELECT revision.revision_number
    INTO v_revision_number
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.status = 'published'
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compatibility catalog is unavailable'
            USING ERRCODE = 'P1100';
    END IF;

    IF p_expected_revision_number IS NOT NULL
       AND p_expected_revision_number IS DISTINCT FROM v_revision_number
    THEN
        RAISE EXCEPTION 'Compatibility catalog revision is stale'
            USING
                ERRCODE = 'P1101',
                DETAIL = format(
                    'expected_revision_number=%s current_revision_number=%s',
                    p_expected_revision_number,
                    v_revision_number
                );
    END IF;

    PERFORM 1
    FROM public.sample_types AS sample_type
    WHERE sample_type.id = p_sample_type_id
      AND sample_type.deleted_at IS NULL
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample type does not exist or is inactive'
            USING ERRCODE = 'P1102';
    END IF;

    RETURN v_revision_number;
END;
$$;

CREATE FUNCTION public.resolve_assay_sample_type_compatibility(
    p_sample_type_id UUID,
    p_assay_definition_id UUID,
    p_expected_revision_number BIGINT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_revision_id UUID;
    v_revision_number BIGINT;
    v_assay_generation BIGINT;
    v_sample_type_generation BIGINT;
    v_review_generation BIGINT;
    v_pair_assay_generation BIGINT;
    v_pair_sample_type_generation BIGINT;
BEGIN
    v_revision_number :=
        public.resolve_sample_type_compatibility_revision(
            p_sample_type_id,
            p_expected_revision_number
        );

    SELECT revision.id
    INTO v_revision_id
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.status = 'published'
      AND revision.revision_number = v_revision_number;

    SELECT assay_definition.compatibility_generation
    INTO v_assay_generation
    FROM public.assay_definitions AS assay_definition
    WHERE assay_definition.id = p_assay_definition_id
      AND assay_definition.deleted_at IS NULL
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assay does not exist or is inactive'
            USING ERRCODE = 'P1103';
    END IF;

    SELECT sample_type.compatibility_generation
    INTO v_sample_type_generation
    FROM public.sample_types AS sample_type
    WHERE sample_type.id = p_sample_type_id
      AND sample_type.deleted_at IS NULL
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample type does not exist or is inactive'
            USING ERRCODE = 'P1102';
    END IF;

    SELECT review.assay_compatibility_generation
    INTO v_review_generation
    FROM public.assay_sample_type_reviews AS review
    WHERE review.revision_id = v_revision_id
      AND review.assay_definition_id = p_assay_definition_id
      AND review.disposition = 'configured';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assay is not configured for assignment'
            USING ERRCODE = 'P1104';
    END IF;

    SELECT
        compatibility.assay_compatibility_generation,
        compatibility.sample_type_compatibility_generation
    INTO
        v_pair_assay_generation,
        v_pair_sample_type_generation
    FROM public.assay_sample_type_compatibilities AS compatibility
    WHERE compatibility.revision_id = v_revision_id
      AND compatibility.assay_definition_id = p_assay_definition_id
      AND compatibility.sample_type_id = p_sample_type_id
      AND compatibility.removed_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assay and sample type are incompatible'
            USING ERRCODE = 'P1105';
    END IF;

    IF v_review_generation IS DISTINCT FROM v_assay_generation
       OR v_pair_assay_generation IS DISTINCT FROM v_assay_generation
       OR v_pair_sample_type_generation IS DISTINCT FROM
          v_sample_type_generation
    THEN
        RAISE EXCEPTION 'Compatibility fingerprint is stale'
            USING
                ERRCODE = 'P1106',
                DETAIL = format(
                    'revision_number=%s assay_generation=%s/%s/%s sample_type_generation=%s/%s',
                    v_revision_number,
                    v_assay_generation,
                    v_review_generation,
                    v_pair_assay_generation,
                    v_sample_type_generation,
                    v_pair_sample_type_generation
                );
    END IF;

    RETURN v_revision_number;
END;
$$;

CREATE FUNCTION public.create_sample_atomic_v2(
    p_client_id UUID,
    p_client_name TEXT,
    p_received_at TIMESTAMPTZ,
    p_received_by UUID,
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
    v_user_role public.user_role := public.get_user_role();
    v_sample_id TEXT;
    v_sample JSONB;
    v_revision_number BIGINT;
    v_sample_type_code TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF v_user_role IS DISTINCT FROM 'analyst' THEN
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
    SELECT sample_type.import_code
    INTO v_sample_type_code
    FROM public.sample_types AS sample_type
    WHERE sample_type.id = p_sample_type_id;
    v_sample_id := public.generate_next_sample_id();

    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        sample_type_id,
        sample_quality,
        received_at,
        received_by,
        status
    ) VALUES (
        v_sample_id,
        p_client_id,
        p_client_name,
        p_sample_type_id,
        p_sample_quality,
        COALESCE(p_received_at, NOW()),
        v_user_id,
        'received'
    )
    RETURNING jsonb_build_object(
        'id', id,
        'sample_id', sample_id,
        'client_id', client_id,
        'client_name', client_name,
        'sample_type_id', sample_type_id,
        'sample_type_code', v_sample_type_code,
        'type', type,
        'sample_quality', sample_quality,
        'status', status,
        'received_at', received_at,
        'created_at', created_at,
        'compatibility_revision_number', v_revision_number
    ) INTO v_sample;

    RETURN v_sample;
END;
$$;

CREATE FUNCTION public.accession_and_assign_tests_v2(
    p_client_id UUID,
    p_client_name TEXT,
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
    v_user_role public.user_role := public.get_user_role();
    v_sample_id TEXT;
    v_sample_uuid UUID;
    v_sample_type_name TEXT;
    v_sample_type_code TEXT;
    v_result JSONB;
    v_test JSONB;
    v_results JSONB := '[]'::JSONB;
    v_revision_number BIGINT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF v_user_role IS DISTINCT FROM 'analyst' THEN
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
    SELECT sample_type.import_code
    INTO v_sample_type_code
    FROM public.sample_types AS sample_type
    WHERE sample_type.id = p_sample_type_id;

    FOR v_test IN SELECT * FROM jsonb_array_elements(p_tests)
    LOOP
        PERFORM public.resolve_assay_sample_type_compatibility(
            p_sample_type_id,
            (v_test->>'assayId')::UUID,
            v_revision_number
        );
    END LOOP;

    v_sample_id := public.generate_next_sample_id();

    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        sample_type_id,
        sample_quality,
        received_at,
        received_by,
        status
    ) VALUES (
        v_sample_id,
        p_client_id,
        p_client_name,
        p_sample_type_id,
        p_sample_quality,
        COALESCE(p_received_at, NOW()),
        v_user_id,
        'assigned'
    )
    RETURNING id, type
    INTO v_sample_uuid, v_sample_type_name;

    FOR v_test IN SELECT * FROM jsonb_array_elements(p_tests)
    LOOP
        INSERT INTO public.results (
            sample_id,
            assay_id,
            method_id,
            status
        ) VALUES (
            v_sample_uuid,
            (v_test->>'assayId')::UUID,
            NULLIF(v_test->>'methodId', '')::UUID,
            'pending'
        )
        RETURNING jsonb_build_object(
            'id', id,
            'sample_id', sample_id,
            'assay_id', assay_id,
            'method_id', method_id,
            'status', status
        ) INTO v_result;

        v_results := v_results || jsonb_build_array(v_result);
    END LOOP;

    RETURN jsonb_build_object(
        'sample', jsonb_build_object(
            'id', v_sample_uuid,
            'sample_id', v_sample_id,
            'client_id', p_client_id,
            'client_name', p_client_name,
            'sample_type_id', p_sample_type_id,
            'sample_type_code', v_sample_type_code,
            'type', v_sample_type_name,
            'sample_quality', p_sample_quality,
            'status', 'assigned'
        ),
        'results', v_results,
        'compatibility_revision_number', v_revision_number
    );
END;
$$;

CREATE FUNCTION public.assign_tests_to_sample_v2(
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
    public.resolve_sample_type_compatibility_revision(UUID, BIGINT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.resolve_assay_sample_type_compatibility(UUID, UUID, BIGINT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.create_sample_atomic_v2(
        UUID, TEXT, TIMESTAMPTZ, UUID, UUID, BOOLEAN, BIGINT
    )
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.accession_and_assign_tests_v2(
        UUID, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN, BIGINT
    )
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
    public.assign_tests_to_sample_v2(UUID, UUID, JSONB, BIGINT)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
    public.create_sample_atomic_v2(
        UUID, TEXT, TIMESTAMPTZ, UUID, UUID, BOOLEAN, BIGINT
    )
TO authenticated;
GRANT EXECUTE ON FUNCTION
    public.accession_and_assign_tests_v2(
        UUID, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN, BIGINT
    )
TO authenticated;
GRANT EXECUTE ON FUNCTION
    public.assign_tests_to_sample_v2(UUID, UUID, JSONB, BIGINT)
TO authenticated;

COMMENT ON FUNCTION
    public.resolve_sample_type_compatibility_revision(UUID, BIGINT)
IS 'Internal fail-closed resolver for the current published compatibility revision and active sample type.';
COMMENT ON FUNCTION
    public.resolve_assay_sample_type_compatibility(UUID, UUID, BIGINT)
IS 'Internal fail-closed resolver for one assay/sample-type pair; returns the published revision number used.';
COMMENT ON FUNCTION
    public.create_sample_atomic_v2(
        UUID, TEXT, TIMESTAMPTZ, UUID, UUID, BOOLEAN, BIGINT
    )
IS 'Additive analyst-only sample creation RPC using canonical sample type and expected compatibility revision.';
COMMENT ON FUNCTION
    public.accession_and_assign_tests_v2(
        UUID, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN, BIGINT
    )
IS 'Additive analyst-only accession RPC that validates every compatibility pair before any write.';
COMMENT ON FUNCTION
    public.assign_tests_to_sample_v2(UUID, UUID, JSONB, BIGINT)
IS 'Additive analyst/manager assignment RPC pinned to the stored sample type and expected compatibility revision.';

CREATE FUNCTION public.test_assay_sample_type_assignment_v2_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_signature TEXT;
    v_definition TEXT;
    v_client_signatures TEXT[] := ARRAY[
        'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)',
        'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)',
        'public.assign_tests_to_sample_v2(uuid,uuid,jsonb,bigint)'
    ];
    v_internal_signatures TEXT[] := ARRAY[
        'public.resolve_sample_type_compatibility_revision(uuid,bigint)',
        'public.resolve_assay_sample_type_compatibility(uuid,uuid,bigint)'
    ];
BEGIN
    FOREACH v_signature IN ARRAY
        v_client_signatures || v_internal_signatures
    LOOP
        SELECT pg_get_functiondef(function_record.oid)
        INTO v_definition
        FROM pg_proc AS function_record
        WHERE function_record.oid = to_regprocedure(v_signature)
          AND function_record.prosecdef
          AND 'search_path=public, extensions' = ANY(
              COALESCE(function_record.proconfig, ARRAY[]::TEXT[])
          );

        IF v_definition IS NULL
           OR has_function_privilege('anon', v_signature, 'EXECUTE')
           OR has_function_privilege('service_role', v_signature, 'EXECUTE')
           OR EXISTS (
               SELECT 1
               FROM pg_proc AS function_record
               CROSS JOIN LATERAL aclexplode(
                   COALESCE(
                       function_record.proacl,
                       acldefault('f', function_record.proowner)
                   )
               ) AS privilege_record
               WHERE function_record.oid = to_regprocedure(v_signature)
                 AND privilege_record.grantee = 0
                 AND privilege_record.privilege_type = 'EXECUTE'
           )
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY v_client_signatures LOOP
        IF NOT has_function_privilege(
            'authenticated',
            v_signature,
            'EXECUTE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY v_internal_signatures LOOP
        IF has_function_privilege(
            'authenticated',
            v_signature,
            'EXECUTE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    SELECT pg_get_functiondef(
        'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)'::REGPROCEDURE
    )
    INTO v_definition;
    IF v_definition NOT ILIKE
        '%v_user_role IS DISTINCT FROM ''analyst''%'
    THEN
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef(
        'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)'::REGPROCEDURE
    )
    INTO v_definition;
    IF v_definition NOT ILIKE
        '%v_user_role IS DISTINCT FROM ''analyst''%'
    THEN
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef(
        'public.assign_tests_to_sample_v2(uuid,uuid,jsonb,bigint)'::REGPROCEDURE
    )
    INTO v_definition;
    IF v_definition NOT ILIKE '%v_user_role IS NULL%'
       OR v_definition NOT ILIKE
          '%v_user_role NOT IN (''analyst'', ''manager'')%'
    THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION
    public.test_assay_sample_type_assignment_v2_security()
FROM PUBLIC, anon, authenticated, service_role;

DO $verification$
BEGIN
    IF NOT public.test_assay_sample_type_assignment_v2_security() THEN
        RAISE EXCEPTION
            'Migration 212 focused v2 security verification failed';
    END IF;

    IF to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'
    ) IS NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
       ) IS NULL
       OR to_regprocedure(
           'public.assign_tests_to_sample(uuid,jsonb)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 212 legacy assignment compatibility verification failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.results'::REGCLASS
          AND NOT tgisinternal
          AND tgname <> 'audit_results_trigger'
          AND pg_get_triggerdef(oid) ILIKE
              '%BEFORE INSERT%resolve_assay_sample_type_compatibility%'
    ) THEN
        RAISE EXCEPTION
            'Migration 212 must not add Phase 8 result enforcement';
    END IF;
END;
$verification$;

COMMIT;
