-- Forward-only hardening for the deterministic client resolver v2.
-- Security impact: fail closed for missing user profiles, preserve hidden-client
-- confidentiality, and reassert least-privilege EXECUTE grants.
-- Correctness impact: exact name/DOB cannot match while an unsuppressed
-- accent-only candidate exists; only named client uniqueness races re-resolve.
--
-- Migration 221 has been exercised against a persistent rehearsal database and
-- is immutable. This migration makes the smallest corrective change without
-- rewriting that applied history.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path TO public, extensions;

DO $baseline$
BEGIN
    IF to_regprocedure(
        'public.resolve_client_identity_internal_v2(text,text,text,date,text)'
    ) IS NULL
       OR to_regprocedure(
           'public.resolve_client_identity_v2(text,text,text,date,text)'
       ) IS NULL
       OR to_regprocedure(
           'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)'
       ) IS NULL
       OR to_regclass(
           'public.clients_unique_trusted_government_identity'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 222 requires the complete migration 221 resolver baseline';
    END IF;

    IF to_regprocedure(
        'public.resolve_client_identity_internal_v2_221(text,text,text,date,text)'
    ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 222 appears to have been applied already';
    END IF;
END;
$baseline$;

ALTER FUNCTION public.resolve_client_identity_internal_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) RENAME TO resolve_client_identity_internal_v2_221;

REVOKE ALL ON FUNCTION public.resolve_client_identity_internal_v2_221(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_client_identity_internal_v2_221(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_client_identity_internal_v2_221(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM authenticated;
REVOKE ALL ON FUNCTION public.resolve_client_identity_internal_v2_221(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM service_role;

CREATE FUNCTION public.resolve_client_identity_internal_v2(
    p_government_identity_type TEXT,
    p_government_identity_value TEXT,
    p_name TEXT,
    p_date_of_birth DATE,
    p_phone TEXT
)
RETURNS TABLE (
    outcome TEXT,
    reason_code TEXT,
    client_id UUID,
    created BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_result RECORD;
    v_name TEXT;
    v_accent_name TEXT;
BEGIN
    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_internal_v2_221(
        p_government_identity_type,
        p_government_identity_value,
        p_name,
        p_date_of_birth,
        p_phone
    );

    IF v_result.outcome = 'matched'
       AND v_result.reason_code = 'name_dob_match'
    THEN
        v_name := public.normalize_client_name_v1(p_name);
        v_accent_name := public.fold_client_name_accents_v1(v_name);

        IF EXISTS (
            SELECT 1
            FROM public.clients AS candidate
            WHERE candidate.id <> v_result.client_id
              AND candidate.normalized_name IS NOT NULL
              AND candidate.normalized_name <> v_name
              AND public.fold_client_name_accents_v1(
                    candidate.normalized_name
                  ) = v_accent_name
              AND candidate.date_of_birth = p_date_of_birth
              AND NOT public.is_client_collision_confirmed_distinct_v1(
                    v_result.client_id,
                    candidate.id,
                    'name_date_of_birth'
                  )
        )
        THEN
            RETURN QUERY
            SELECT
                'conflict'::TEXT,
                'accent_only_conflict'::TEXT,
                NULL::UUID,
                FALSE;
            RETURN;
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        v_result.outcome,
        v_result.reason_code,
        v_result.client_id,
        v_result.created;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_client_identity_internal_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_client_identity_internal_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_client_identity_internal_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM authenticated;
REVOKE ALL ON FUNCTION public.resolve_client_identity_internal_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM service_role;

COMMENT ON FUNCTION public.resolve_client_identity_internal_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) IS
    'Private hardened resolver v2 wrapper. It fails closed for exact plus accent-only candidates.';

CREATE OR REPLACE FUNCTION public.resolve_client_identity_v2(
    p_government_identity_type TEXT,
    p_government_identity_value TEXT,
    p_name TEXT,
    p_date_of_birth DATE,
    p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
    outcome TEXT,
    reason_code TEXT,
    client_id UUID,
    created BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF auth.uid() IS NULL
       OR COALESCE(public.get_user_role(), '')
            NOT IN ('analyst', 'manager')
    THEN
        RAISE EXCEPTION 'CLIENT_RESOLUTION_FORBIDDEN'
            USING ERRCODE = 'P1120';
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.resolve_client_identity_internal_v2(
        p_government_identity_type,
        p_government_identity_value,
        p_name,
        p_date_of_birth,
        p_phone
    );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_client_identity_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_client_identity_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_client_identity_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) FROM service_role;
GRANT EXECUTE ON FUNCTION public.resolve_client_identity_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_or_create_client_v2(
    p_government_identity_type TEXT,
    p_government_identity_value TEXT,
    p_name TEXT,
    p_date_of_birth DATE,
    p_gender TEXT,
    p_phone TEXT,
    p_address TEXT DEFAULT NULL,
    p_health_insurance_num TEXT DEFAULT NULL,
    p_expiry_date DATE DEFAULT NULL
)
RETURNS TABLE (
    outcome TEXT,
    reason_code TEXT,
    client_id UUID,
    created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_identity_type TEXT;
    v_identity_value TEXT;
    v_name TEXT;
    v_accent_name TEXT;
    v_phone TEXT;
    v_lock_id BIGINT;
    v_result RECORD;
    v_created_id UUID;
    v_constraint_name TEXT;
BEGIN
    IF auth.uid() IS NULL
       OR COALESCE(public.get_user_role(), '')
            NOT IN ('analyst', 'manager')
    THEN
        RAISE EXCEPTION 'CLIENT_RESOLUTION_FORBIDDEN'
            USING ERRCODE = 'P1120';
    END IF;

    v_identity_type :=
        NULLIF(lower(btrim(p_government_identity_type)), '');
    v_identity_value :=
        public.normalize_client_government_identity_v1(
            btrim(p_government_identity_value)
        );
    v_name := public.normalize_client_name_v1(p_name);
    v_accent_name := public.fold_client_name_accents_v1(v_name);
    v_phone := public.normalize_client_phone_v1(p_phone);

    FOR v_lock_id IN
        SELECT DISTINCT
            hashtextextended(candidate.lock_key, 0) AS lock_id
        FROM unnest(
            ARRAY[
                CASE
                    WHEN v_identity_type IS NOT NULL
                         AND v_identity_value IS NOT NULL
                        THEN format(
                            'client-resolution-v2:government:%s:%s',
                            v_identity_type,
                            v_identity_value
                        )
                    ELSE NULL
                END,
                CASE
                    WHEN v_accent_name IS NOT NULL
                         AND p_date_of_birth IS NOT NULL
                        THEN format(
                            'client-resolution-v2:accent-name-dob:%s:%s',
                            v_accent_name,
                            p_date_of_birth
                        )
                    ELSE NULL
                END,
                CASE
                    WHEN v_name IS NOT NULL
                         AND p_date_of_birth IS NOT NULL
                        THEN format(
                            'client-resolution-v2:name-dob:%s:%s',
                            v_name,
                            p_date_of_birth
                        )
                    ELSE NULL
                END,
                CASE
                    WHEN v_phone IS NOT NULL
                        THEN format(
                            'client-resolution-v2:phone:%s',
                            v_phone
                        )
                    ELSE NULL
                END
            ]
        ) AS candidate(lock_key)
        WHERE candidate.lock_key IS NOT NULL
        ORDER BY lock_id
    LOOP
        PERFORM pg_advisory_xact_lock(v_lock_id);
    END LOOP;

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_internal_v2(
        p_government_identity_type,
        p_government_identity_value,
        p_name,
        p_date_of_birth,
        p_phone
    );

    IF v_result.outcome <> 'not_found' THEN
        RETURN QUERY
        SELECT
            v_result.outcome,
            v_result.reason_code,
            v_result.client_id,
            v_result.created;
        RETURN;
    END IF;

    IF p_gender NOT IN ('Nam', 'Nữ', 'Khác')
       OR v_name IS NULL
       OR p_date_of_birth IS NULL
       OR v_phone IS NULL
    THEN
        RETURN QUERY
        SELECT
            'conflict'::TEXT,
            'invalid_identity_input'::TEXT,
            NULL::UUID,
            FALSE;
        RETURN;
    END IF;

    BEGIN
        INSERT INTO public.clients (
            id_card_num,
            name,
            date_of_birth,
            gender,
            phone,
            address,
            health_insurance_num,
            expiry_date
        )
        VALUES (
            COALESCE(v_identity_value, ''),
            btrim(p_name),
            p_date_of_birth,
            p_gender,
            btrim(p_phone),
            NULLIF(btrim(p_address), ''),
            NULLIF(btrim(p_health_insurance_num), ''),
            p_expiry_date
        )
        RETURNING id
        INTO v_created_id;

        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            operation,
            new_values,
            changed_by
        )
        VALUES (
            'clients',
            v_created_id,
            'CLIENT_CREATED_V2',
            jsonb_build_object(
                'outcome', 'matched',
                'reason_code', 'client_created'
            ),
            auth.uid()
        );
    EXCEPTION
        WHEN unique_violation THEN
            GET STACKED DIAGNOSTICS
                v_constraint_name = CONSTRAINT_NAME;

            IF COALESCE(v_constraint_name, '') NOT IN (
                'clients_unique_trusted_government_identity',
                'clients_unique_identity'
            )
            THEN
                RAISE EXCEPTION 'CLIENT_RESOLUTION_CREATE_FAILED'
                    USING ERRCODE = 'P1122';
            END IF;

            SELECT *
            INTO v_result
            FROM public.resolve_client_identity_internal_v2(
                p_government_identity_type,
                p_government_identity_value,
                p_name,
                p_date_of_birth,
                p_phone
            );

            IF v_result.outcome = 'not_found' THEN
                RETURN QUERY
                SELECT
                    'conflict'::TEXT,
                    'cross_key_conflict'::TEXT,
                    NULL::UUID,
                    FALSE;
            ELSE
                RETURN QUERY
                SELECT
                    v_result.outcome,
                    v_result.reason_code,
                    v_result.client_id,
                    v_result.created;
            END IF;
            RETURN;
        WHEN OTHERS THEN
            RAISE EXCEPTION 'CLIENT_RESOLUTION_AUDIT_FAILED'
                USING ERRCODE = 'P1121';
    END;

    RETURN QUERY
    SELECT
        'matched'::TEXT,
        'client_created'::TEXT,
        v_created_id,
        TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_or_create_client_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    DATE
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_or_create_client_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    DATE
) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_or_create_client_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    DATE
) FROM service_role;
GRANT EXECUTE ON FUNCTION public.resolve_or_create_client_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    DATE
) TO authenticated;

DO $postconditions$
DECLARE
    v_function_name TEXT;
BEGIN
    FOR v_function_name IN
        SELECT unnest(
            ARRAY[
                'public.resolve_client_identity_internal_v2(text,text,text,date,text)',
                'public.resolve_client_identity_v2(text,text,text,date,text)',
                'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)'
            ]
        )
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_proc AS procedure
            WHERE procedure.oid = v_function_name::REGPROCEDURE
              AND procedure.prosecdef
              AND procedure.proconfig =
                    ARRAY['search_path=public, extensions']
        )
        THEN
            RAISE EXCEPTION
                'Migration 222 function is not hardened: %',
                v_function_name;
        END IF;
    END LOOP;

    IF has_function_privilege(
        'authenticated',
        'public.resolve_client_identity_internal_v2(text,text,text,date,text)',
        'EXECUTE'
    )
       OR has_function_privilege(
           'anon',
           'public.resolve_client_identity_v2(text,text,text,date,text)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'service_role',
           'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)',
           'EXECUTE'
       )
       OR NOT has_function_privilege(
           'authenticated',
           'public.resolve_client_identity_v2(text,text,text,date,text)',
           'EXECUTE'
       )
       OR NOT has_function_privilege(
           'authenticated',
           'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)',
           'EXECUTE'
       )
    THEN
        RAISE EXCEPTION
            'Migration 222 resolver grants do not match least privilege';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.clients
        WHERE government_identity_trusted
        GROUP BY
            government_identity_type,
            government_identity_value
        HAVING count(*) > 1
    )
    THEN
        RAISE EXCEPTION
            'Migration 222 found duplicate trusted typed identities';
    END IF;
END;
$postconditions$;

COMMIT;
