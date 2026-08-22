-- Forward-only correction for shadow telemetry expiry pruning from migration 226.
--
-- Migration 226 is immutable after successful rehearsal. Its RPC output column
-- `expires_at` made the unqualified retention DELETE ambiguous at runtime.
--
-- Security impact:
-- - Preserves the PII-free telemetry schema and 30-day retention boundary.
-- - Preserves service-role-only execution, actor role validation, direct table
--   denial, fixed search_path, and zero client/sample mutation behavior.
-- - Changes only the retention DELETE to qualify the table column explicitly.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path TO pg_catalog, public, extensions;

DO $baseline$
DECLARE
    v_function REGPROCEDURE;
    v_definition TEXT;
BEGIN
    IF to_regclass('public.client_resolution_shadow_events') IS NULL
       OR to_regprocedure(
            'public.record_client_resolution_shadow_v1(uuid,text,uuid,text,text,text,date,text)'
          ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 227 requires the complete migration 226 baseline';
    END IF;

    v_function :=
        'public.record_client_resolution_shadow_v1(uuid,text,uuid,text,text,text,date,text)'::REGPROCEDURE;

    SELECT pg_get_functiondef(v_function)
    INTO v_definition;

    IF v_definition
        NOT LIKE '%WHERE expires_at <= clock_timestamp();%'
    THEN
        RAISE EXCEPTION
            'Migration 227 expiry-pruning baseline does not match migration 226';
    END IF;
END;
$baseline$;

CREATE OR REPLACE FUNCTION public.record_client_resolution_shadow_v1(
    p_actor_id UUID,
    p_caller_category TEXT,
    p_correlation_id UUID,
    p_government_identity_type TEXT,
    p_government_identity_value TEXT,
    p_name TEXT,
    p_date_of_birth DATE,
    p_phone TEXT
)
RETURNS TABLE (
    caller_category TEXT,
    legacy_outcome TEXT,
    legacy_reason_code TEXT,
    v2_outcome TEXT,
    v2_reason_code TEXT,
    correlation_id UUID,
    observed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_actor_role TEXT;
    v_can_access_confidential BOOLEAN;
    v_original_claims TEXT;
    v_trimmed_name TEXT;
    v_trimmed_phone TEXT;
    v_legacy_client_id UUID;
    v_phone_client_id UUID;
    v_phone_client_name TEXT;
    v_phone_client_date_of_birth DATE;
    v_v2_result RECORD;
    v_legacy_outcome TEXT;
    v_legacy_reason_code TEXT;
    v_v2_reason_code TEXT;
    v_observed_at TIMESTAMPTZ;
BEGIN
    IF auth.role()::TEXT <> 'service_role' THEN
        RAISE EXCEPTION 'CLIENT_RESOLUTION_SHADOW_FORBIDDEN'
            USING ERRCODE = 'P1120';
    END IF;

    SELECT
        app_user.role::TEXT,
        COALESCE(app_user.can_access_confidential, FALSE)
    INTO
        v_actor_role,
        v_can_access_confidential
    FROM public.users AS app_user
    WHERE app_user.id = p_actor_id;

    IF v_actor_role IS NULL
       OR v_actor_role NOT IN ('analyst', 'manager')
    THEN
        RAISE EXCEPTION 'CLIENT_RESOLUTION_SHADOW_FORBIDDEN'
            USING ERRCODE = 'P1120';
    END IF;

    IF p_caller_category NOT IN ('manual', 'qr', 'upsert')
       OR p_correlation_id IS NULL
       OR NULLIF(btrim(p_name), '') IS NULL
       OR p_date_of_birth IS NULL
    THEN
        RAISE EXCEPTION 'CLIENT_RESOLUTION_SHADOW_INVALID_INPUT'
            USING ERRCODE = 'P1121';
    END IF;

    v_trimmed_name := btrim(p_name);
    v_trimmed_phone := NULLIF(btrim(p_phone), '');

    IF p_caller_category IN ('manual', 'qr') THEN
        SELECT client.id
        INTO v_legacy_client_id
        FROM public.clients AS client
        WHERE client.name = v_trimmed_name
          AND client.date_of_birth = p_date_of_birth
        LIMIT 1;

        IF v_legacy_client_id IS NULL
           OR (
                NOT v_can_access_confidential
                AND public.client_has_confidential_samples(v_legacy_client_id)
           )
        THEN
            v_legacy_outcome := 'not_found';
            v_legacy_reason_code := 'legacy_name_dob_not_found';
        ELSE
            v_legacy_outcome := 'matched';
            v_legacy_reason_code := 'legacy_name_dob_match';
        END IF;
    ELSE
        IF v_trimmed_phone IS NOT NULL
           AND v_trimmed_phone <> '0000000000'
        THEN
            SELECT
                client.id,
                client.name,
                client.date_of_birth
            INTO
                v_phone_client_id,
                v_phone_client_name,
                v_phone_client_date_of_birth
            FROM public.clients AS client
            WHERE client.phone = v_trimmed_phone
            LIMIT 1;
        END IF;

        IF v_phone_client_id IS NOT NULL
           AND (
                lower(v_phone_client_name) <> lower(v_trimmed_name)
                OR v_phone_client_date_of_birth <> p_date_of_birth
           )
        THEN
            v_legacy_outcome := 'conflict';
            v_legacy_reason_code := 'legacy_phone_conflict';
        ELSE
            SELECT client.id
            INTO v_legacy_client_id
            FROM public.clients AS client
            WHERE client.name = v_trimmed_name
              AND client.date_of_birth = p_date_of_birth
            LIMIT 1;

            IF v_legacy_client_id IS NULL THEN
                v_legacy_outcome := 'not_found';
                v_legacy_reason_code := 'legacy_would_create';
            ELSE
                v_legacy_outcome := 'matched';
                v_legacy_reason_code := 'legacy_name_dob_match';
            END IF;
        END IF;
    END IF;

    v_original_claims := current_setting('request.jwt.claims', TRUE);
    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', p_actor_id::TEXT,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );

    SELECT *
    INTO v_v2_result
    FROM public.resolve_client_identity_internal_v2(
        p_government_identity_type,
        p_government_identity_value,
        v_trimmed_name,
        p_date_of_birth,
        v_trimmed_phone
    );

    PERFORM set_config(
        'request.jwt.claims',
        COALESCE(v_original_claims, ''),
        TRUE
    );

    IF v_v2_result.outcome IS NULL
       OR v_v2_result.reason_code IS NULL
    THEN
        RAISE EXCEPTION 'CLIENT_RESOLUTION_SHADOW_INVALID_RESULT'
            USING ERRCODE = 'P1122';
    END IF;

    v_v2_reason_code := CASE
        WHEN v_v2_result.reason_code = 'restricted_candidate'
            THEN 'identity_conflict'
        ELSE v_v2_result.reason_code
    END;
    v_observed_at := clock_timestamp();

    DELETE FROM public.client_resolution_shadow_events AS event
    WHERE event.expires_at <= clock_timestamp();

    INSERT INTO public.client_resolution_shadow_events (
        caller_category,
        legacy_outcome,
        legacy_reason_code,
        v2_outcome,
        v2_reason_code,
        correlation_id,
        observed_at,
        expires_at
    )
    VALUES (
        p_caller_category,
        v_legacy_outcome,
        v_legacy_reason_code,
        v_v2_result.outcome,
        v_v2_reason_code,
        p_correlation_id,
        v_observed_at,
        v_observed_at + INTERVAL '30 days'
    );

    RETURN QUERY
    SELECT
        event.caller_category,
        event.legacy_outcome,
        event.legacy_reason_code,
        event.v2_outcome,
        event.v2_reason_code,
        event.correlation_id,
        event.observed_at,
        event.expires_at
    FROM public.client_resolution_shadow_events AS event
    WHERE event.correlation_id = p_correlation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_client_resolution_shadow_v1(
    UUID,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_client_resolution_shadow_v1(
    UUID,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM anon;
REVOKE ALL ON FUNCTION public.record_client_resolution_shadow_v1(
    UUID,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM authenticated;
REVOKE ALL ON FUNCTION public.record_client_resolution_shadow_v1(
    UUID,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM service_role;
GRANT EXECUTE ON FUNCTION public.record_client_resolution_shadow_v1(
    UUID,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) TO service_role;

COMMENT ON FUNCTION public.record_client_resolution_shadow_v1(
    UUID,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) IS
    'Service-only same-snapshot legacy/v2 comparison; never mutates clients or samples.';

DO $verify$
DECLARE
    v_function REGPROCEDURE;
    v_definition TEXT;
    v_search_path TEXT[];
BEGIN
    v_function :=
        'public.record_client_resolution_shadow_v1(uuid,text,uuid,text,text,text,date,text)'::REGPROCEDURE;

    SELECT
        pg_get_functiondef(proc.oid),
        proc.proconfig
    INTO
        v_definition,
        v_search_path
    FROM pg_proc AS proc
    WHERE proc.oid = v_function;

    IF v_definition
        NOT LIKE '%DELETE FROM public.client_resolution_shadow_events AS event%'
       OR v_definition
        NOT LIKE '%WHERE event.expires_at <= clock_timestamp();%'
       OR v_definition LIKE '%WHERE expires_at <= clock_timestamp();%'
    THEN
        RAISE EXCEPTION
            'Migration 227 expiry-pruning verification failed';
    END IF;

    IF v_search_path IS NULL
       OR NOT ('search_path=public, extensions' = ANY(v_search_path))
    THEN
        RAISE EXCEPTION 'Migration 227 fixed search_path verification failed';
    END IF;

    IF has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_function, 'EXECUTE')
    THEN
        RAISE EXCEPTION 'Migration 227 RPC grants verification failed';
    END IF;

    IF has_table_privilege(
        'anon',
        'public.client_resolution_shadow_events',
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
    )
       OR has_table_privilege(
           'authenticated',
           'public.client_resolution_shadow_events',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
       OR has_table_privilege(
           'service_role',
           'public.client_resolution_shadow_events',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
    THEN
        RAISE EXCEPTION
            'Migration 227 direct table grants verification failed';
    END IF;
END;
$verify$;

COMMIT;
