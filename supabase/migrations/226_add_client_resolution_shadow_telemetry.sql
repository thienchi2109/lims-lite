-- Migration 226: Supersede failed rehearsal migrations 224 and 225.
--
-- Migration 224 is immutable after failing before object creation because its
-- rehearsal database owner did not match the production apply role.
-- Migration 225 is immutable after failing before object creation because
-- PostgreSQL does not consider TIMESTAMPTZ + INTERVAL immutable enough for a
-- generated column. This migration stores expires_at explicitly instead.
--
-- Security impact:
-- - Stores only caller category, machine outcomes/reasons, a random
--   request-scoped correlation UUID, and bounded timestamps.
-- - Stores no actor/client UUID, name, phone, government identity, DOB, hash,
--   fingerprint, source coordinate, or request payload.
-- - Direct table access is denied. Only the server-side service role may call
--   the SECURITY DEFINER comparison RPC, which revalidates the actor role.
--
-- Rollout impact:
-- - Legacy and v2 decisions are evaluated in one pre-mutation transaction.
-- - Clients and samples are never mutated by shadow comparison.
-- - Each event expires exactly 30 days after observation; expired rows are
--   pruned on every shadow write.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path TO pg_catalog, public, extensions;

DO $baseline$
BEGIN
    IF to_regclass('public.clients') IS NULL
       OR to_regclass('public.users') IS NULL
       OR to_regprocedure(
            'public.resolve_client_identity_internal_v2(text,text,text,date,text)'
          ) IS NULL
       OR to_regprocedure('public.client_has_confidential_samples(uuid)') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 226 requires the complete Phase 4 resolver baseline';
    END IF;

    IF to_regclass('public.client_resolution_shadow_events') IS NOT NULL
       OR to_regprocedure(
            'public.record_client_resolution_shadow_v1(uuid,text,uuid,text,text,text,date,text)'
          ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 226 requires the failed 224/225 no-object baseline';
    END IF;

    IF NOT has_schema_privilege(current_user, 'public', 'CREATE') THEN
        RAISE EXCEPTION
            'Migration 226 apply role requires CREATE on schema public';
    END IF;
END;
$baseline$;

CREATE TABLE public.client_resolution_shadow_events (
    caller_category TEXT NOT NULL
        CHECK (caller_category IN ('manual', 'qr', 'upsert')),
    legacy_outcome TEXT NOT NULL
        CHECK (legacy_outcome IN ('matched', 'not_found', 'conflict')),
    legacy_reason_code TEXT NOT NULL
        CHECK (legacy_reason_code ~ '^[a-z0-9_]+$'),
    v2_outcome TEXT NOT NULL
        CHECK (v2_outcome IN (
            'matched',
            'not_found',
            'ambiguous',
            'conflict'
        )),
    v2_reason_code TEXT NOT NULL
        CHECK (v2_reason_code ~ '^[a-z0-9_]+$'),
    correlation_id UUID PRIMARY KEY,
    observed_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
        CHECK (expires_at > observed_at)
);

CREATE INDEX client_resolution_shadow_events_observed_idx
ON public.client_resolution_shadow_events (observed_at DESC);

CREATE INDEX client_resolution_shadow_events_expiry_idx
ON public.client_resolution_shadow_events (expires_at);

CREATE INDEX client_resolution_shadow_events_discrepancy_idx
ON public.client_resolution_shadow_events (
    caller_category,
    legacy_outcome,
    legacy_reason_code,
    v2_outcome,
    v2_reason_code,
    observed_at DESC
);

ALTER TABLE public.client_resolution_shadow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_resolution_shadow_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct shadow telemetry access"
ON public.client_resolution_shadow_events;

CREATE POLICY "Deny direct shadow telemetry access"
ON public.client_resolution_shadow_events
AS RESTRICTIVE
FOR ALL
TO PUBLIC
USING (
    public.get_user_role()::TEXT IN ('analyst', 'manager')
    AND FALSE
)
WITH CHECK (
    public.get_user_role()::TEXT IN ('analyst', 'manager')
    AND FALSE
);

REVOKE ALL ON TABLE public.client_resolution_shadow_events FROM PUBLIC;
REVOKE ALL ON TABLE public.client_resolution_shadow_events FROM anon;
REVOKE ALL ON TABLE public.client_resolution_shadow_events
    FROM authenticated;
REVOKE ALL ON TABLE public.client_resolution_shadow_events
    FROM service_role;

CREATE FUNCTION public.record_client_resolution_shadow_v1(
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

    DELETE FROM public.client_resolution_shadow_events
    WHERE expires_at <= clock_timestamp();

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

COMMENT ON TABLE public.client_resolution_shadow_events IS
    'PII-free Phase 5 client resolver shadow telemetry with 30-day retention.';
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
    v_columns TEXT[];
    v_function REGPROCEDURE;
BEGIN
    SELECT array_agg(column_name ORDER BY ordinal_position)
    INTO v_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_resolution_shadow_events';

    IF v_columns <> ARRAY[
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
            'Migration 226 telemetry column whitelist failed: %',
            v_columns;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polrelid =
            'public.client_resolution_shadow_events'::REGCLASS
          AND polname = 'Deny direct shadow telemetry access'
          AND polpermissive IS FALSE
    )
    THEN
        RAISE EXCEPTION 'Migration 226 deny policy verification failed';
    END IF;

    v_function :=
        'public.record_client_resolution_shadow_v1(uuid,text,uuid,text,text,text,date,text)'::REGPROCEDURE;

    IF has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_function, 'EXECUTE')
    THEN
        RAISE EXCEPTION 'Migration 226 RPC grants verification failed';
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
        RAISE EXCEPTION 'Migration 226 direct table grants verification failed';
    END IF;
END;
$verify$;

COMMIT;
