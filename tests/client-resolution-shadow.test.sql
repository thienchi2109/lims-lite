\set ON_ERROR_STOP on

BEGIN;

DO $test$
DECLARE
    v_actor_id UUID := '91000000-0000-4000-8000-000000000001';
    v_client_id UUID := '91000000-0000-4000-8000-000000000002';
    v_correlation_id UUID := '91000000-0000-4000-8000-000000000003';
    v_client_count_before BIGINT;
    v_sample_count_before BIGINT;
    v_event RECORD;
    v_column_names TEXT[];
    v_started_at TIMESTAMPTZ;
BEGIN
    IF to_regclass('public.client_resolution_shadow_events') IS NULL
       OR to_regprocedure(
            'public.record_client_resolution_shadow_v1(uuid,text,uuid,text,text,text,date,text)'
          ) IS NULL
    THEN
        RAISE EXCEPTION 'Phase 5 shadow telemetry baseline is missing';
    END IF;

    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    )
    VALUES (
        v_actor_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'phase5-shadow@example.test',
        '',
        now(),
        '{"provider":"email","providers":["email"]}'::JSONB,
        '{}'::JSONB,
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, email, role, full_name)
    VALUES (
        v_actor_id,
        'phase5-shadow@example.test',
        'analyst',
        'Phase 5 Shadow Actor'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role;

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone
    )
    VALUES (
        v_client_id,
        '086094006827',
        'Nguyen Van A',
        DATE '1994-09-21',
        'Nam',
        '0901234567'
    );

    SELECT count(*) INTO v_client_count_before FROM public.clients;
    SELECT count(*) INTO v_sample_count_before FROM public.samples;

    SELECT array_agg(column_name ORDER BY ordinal_position)
    INTO v_column_names
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_resolution_shadow_events';

    IF v_column_names <> ARRAY[
        'caller_category',
        'legacy_outcome',
        'legacy_reason_code',
        'v2_outcome',
        'v2_reason_code',
        'correlation_id',
        'observed_at',
        'expires_at'
    ]::TEXT[]
    THEN
        RAISE EXCEPTION
            'Unexpected shadow telemetry columns: %',
            v_column_names;
    END IF;

    IF has_function_privilege(
        'authenticated',
        'public.record_client_resolution_shadow_v1(uuid,text,uuid,text,text,text,date,text)',
        'EXECUTE'
    )
    THEN
        RAISE EXCEPTION 'Authenticated must not execute the shadow RPC directly';
    END IF;

    IF NOT has_function_privilege(
        'service_role',
        'public.record_client_resolution_shadow_v1(uuid,text,uuid,text,text,text,date,text)',
        'EXECUTE'
    )
    THEN
        RAISE EXCEPTION 'Service role must execute the shadow RPC';
    END IF;

    INSERT INTO public.client_resolution_shadow_events (
        caller_category,
        legacy_outcome,
        legacy_reason_code,
        v2_outcome,
        v2_reason_code,
        correlation_id,
        observed_at
    )
    VALUES (
        'manual',
        'not_found',
        'legacy_name_dob_not_found',
        'not_found',
        'no_candidate',
        '91000000-0000-4000-8000-000000000004',
        now() - INTERVAL '31 days'
    );

    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        true
    );

    v_started_at := clock_timestamp();

    SELECT *
    INTO v_event
    FROM public.record_client_resolution_shadow_v1(
        v_actor_id,
        'manual',
        v_correlation_id,
        'cccd',
        '086094006827',
        'Nguyen Van A',
        DATE '1994-09-21',
        '0901234567'
    );

    IF clock_timestamp() - v_started_at >= INTERVAL '1 second' THEN
        RAISE EXCEPTION 'Shadow comparison exceeded the 1 second SQL budget';
    END IF;

    IF v_event.legacy_outcome <> 'matched'
       OR v_event.legacy_reason_code <> 'legacy_name_dob_match'
       OR v_event.v2_outcome <> 'matched'
       OR v_event.v2_reason_code <> 'trusted_identity_match'
       OR v_event.correlation_id <> v_correlation_id
    THEN
        RAISE EXCEPTION 'Unexpected shadow event: %', row_to_json(v_event);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.client_resolution_shadow_events
        WHERE expires_at <= clock_timestamp()
    )
    THEN
        RAISE EXCEPTION 'Expired telemetry was not pruned';
    END IF;

    IF (SELECT count(*) FROM public.clients) <> v_client_count_before
       OR (SELECT count(*) FROM public.samples) <> v_sample_count_before
    THEN
        RAISE EXCEPTION 'Shadow comparison mutated clients or samples';
    END IF;
END;
$test$;

ROLLBACK;
