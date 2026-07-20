-- Migration 189: Add the sample-quality compatibility contract.
--
-- Security impact: adds two SECURITY DEFINER RPC overloads with the same
-- analyst-only authorization, fixed search_path, and least-privilege grants as
-- the legacy accession RPCs.
-- Historical data impact: existing samples remain NULL. This migration sets no
-- default, performs no backfill, and temporarily retains both legacy RPCs.

BEGIN;

DO $baseline$
DECLARE
    v_create_legacy REGPROCEDURE :=
        to_regprocedure('public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)');
    v_assign_legacy REGPROCEDURE :=
        to_regprocedure('public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)');
BEGIN
    IF to_regclass('public.samples') IS NULL THEN
        RAISE EXCEPTION 'Migration 189 requires public.samples';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'samples'
          AND column_name = 'sample_quality'
    ) THEN
        RAISE EXCEPTION 'Migration 189 requires public.samples.sample_quality to be absent';
    END IF;

    IF v_create_legacy IS NULL OR v_assign_legacy IS NULL THEN
        RAISE EXCEPTION 'Migration 189 requires both legacy accession RPC signatures';
    END IF;

    IF to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'
    ) IS NOT NULL OR to_regprocedure(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
    ) IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 189 quality-aware RPC overloads already exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE oid IN (v_create_legacy, v_assign_legacy)
          AND (
              NOT prosecdef
              OR NOT (
                  COALESCE(proconfig, ARRAY[]::TEXT[])
                  @> ARRAY['search_path=public, extensions']
              )
          )
    ) THEN
        RAISE EXCEPTION 'Migration 189 legacy RPC security baseline is not hardened';
    END IF;
END;
$baseline$;

ALTER TABLE public.samples
ADD COLUMN sample_quality BOOLEAN NULL;

COMMENT ON COLUMN public.samples.sample_quality
IS 'Nullable compatibility field: TRUE means acceptable quality, FALSE means unacceptable quality, and NULL covers historical rows plus temporary legacy-RPC writes during rollout.';

CREATE FUNCTION public.create_sample_atomic(
    p_client_id UUID,
    p_client_name TEXT,
    p_received_at TIMESTAMPTZ,
    p_received_by UUID,
    p_type TEXT,
    p_sample_quality BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role public.user_role := public.get_user_role();
    v_sample_id TEXT;
    v_sample JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF v_user_role <> 'analyst' THEN
        RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
    END IF;

    IF p_sample_quality IS NULL THEN
        RAISE EXCEPTION 'Sample quality is required' USING ERRCODE = '23502';
    END IF;

    v_sample_id := public.generate_next_sample_id();

    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        type,
        sample_quality,
        received_at,
        received_by,
        status
    ) VALUES (
        v_sample_id,
        p_client_id,
        p_client_name,
        p_type,
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
        'type', type,
        'sample_quality', sample_quality,
        'status', status,
        'received_at', received_at,
        'created_at', created_at
    ) INTO v_sample;

    RETURN v_sample;
END;
$$;

CREATE FUNCTION public.accession_and_assign_tests(
    p_client_id UUID,
    p_client_name TEXT,
    p_received_at TIMESTAMPTZ,
    p_tests JSONB,
    p_type TEXT,
    p_sample_quality BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role public.user_role := public.get_user_role();
    v_sample_id TEXT;
    v_sample_uuid UUID;
    v_result JSONB;
    v_test JSONB;
    v_results JSONB := '[]'::JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF v_user_role <> 'analyst' THEN
        RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
    END IF;

    IF p_sample_quality IS NULL THEN
        RAISE EXCEPTION 'Sample quality is required' USING ERRCODE = '23502';
    END IF;

    v_sample_id := public.generate_next_sample_id();

    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        type,
        sample_quality,
        received_at,
        received_by,
        status
    ) VALUES (
        v_sample_id,
        p_client_id,
        p_client_name,
        p_type,
        p_sample_quality,
        COALESCE(p_received_at, NOW()),
        v_user_id,
        'assigned'
    )
    RETURNING id INTO v_sample_uuid;

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
            'type', p_type,
            'sample_quality', p_sample_quality,
            'status', 'assigned'
        ),
        'results', v_results
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN)
IS 'Creates a sample with required quality and atomic sample_id generation. SECURITY DEFINER with analyst-only authorization; caller-supplied received_by is ignored.';

COMMENT ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN)
IS 'Creates a sample with required quality and assigns tests atomically. SECURITY DEFINER with analyst-only authorization.';

DO $verification$
DECLARE
    v_create_quality REGPROCEDURE :=
        to_regprocedure('public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)');
    v_assign_quality REGPROCEDURE :=
        to_regprocedure('public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)');
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'samples'
          AND column_name = 'sample_quality'
          AND data_type = 'boolean'
          AND is_nullable = 'YES'
          AND column_default IS NULL
    ) THEN
        RAISE EXCEPTION 'Migration 189 sample_quality column verification failed';
    END IF;

    IF v_create_quality IS NULL OR v_assign_quality IS NULL THEN
        RAISE EXCEPTION 'Migration 189 quality-aware RPC verification failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE oid IN (v_create_quality, v_assign_quality)
          AND (
              NOT prosecdef
              OR NOT (
                  COALESCE(proconfig, ARRAY[]::TEXT[])
                  @> ARRAY['search_path=public, extensions']
              )
          )
    ) THEN
        RAISE EXCEPTION 'Migration 189 RPC security verification failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_proc AS function_record
        CROSS JOIN LATERAL aclexplode(
            COALESCE(
                function_record.proacl,
                acldefault('f', function_record.proowner)
            )
        ) AS privilege_record
        WHERE function_record.oid IN (v_create_quality, v_assign_quality)
          AND privilege_record.grantee = 0
          AND privilege_record.privilege_type = 'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'Migration 189 RPC PUBLIC execute revoke verification failed';
    END IF;

    IF NOT has_function_privilege('authenticated', v_create_quality, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_assign_quality, 'EXECUTE') THEN
        RAISE EXCEPTION 'Migration 189 authenticated execute grant verification failed';
    END IF;

    IF has_function_privilege('anon', v_create_quality, 'EXECUTE')
       OR has_function_privilege('anon', v_assign_quality, 'EXECUTE')
       OR has_function_privilege('service_role', v_create_quality, 'EXECUTE')
       OR has_function_privilege('service_role', v_assign_quality, 'EXECUTE') THEN
        RAISE EXCEPTION 'Migration 189 forbidden execute privilege verification failed';
    END IF;

    IF to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)'
    ) IS NULL OR to_regprocedure(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)'
    ) IS NULL THEN
        RAISE EXCEPTION 'Migration 189 legacy RPC compatibility verification failed';
    END IF;
END;
$verification$;

COMMIT;
