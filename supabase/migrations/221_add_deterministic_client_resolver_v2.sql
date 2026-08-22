-- Migration 221: Add deterministic client resolver v2 and trusted uniqueness.
--
-- Security impact:
-- - Adds analyst/manager-only SECURITY DEFINER RPCs with fixed search_path.
-- - Keeps direct client table grants and RLS policies unchanged.
-- - Returns only one machine outcome, a stable reason code, and a client UUID
--   only when the authorized caller may use an unambiguous matched client.
-- - Confidential or otherwise restricted candidates return a non-disclosing
--   conflict with no candidate UUID, attributes, or count.
--
-- Historical data impact:
-- - Requires the Phase 3 projection and collision checkpoint to be clean before
--   enforcing uniqueness of trusted typed CCCD/CMND values.
-- - Adds no merge, UUID replacement, sample/history relink, profile rewrite, or
--   caller cutover. Existing legacy callers remain authoritative.
-- - New client creation is available only through an unused additive v2 RPC.
--   It is serialized by sorted transaction-scoped advisory locks and emits a
--   PII-minimized reason-bearing audit event.

BEGIN;

SET LOCAL search_path TO public, extensions;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.samples IN SHARE MODE;

CREATE TEMP TABLE phase4_client_snapshot
ON COMMIT DROP
AS
SELECT
    id,
    id_card_num,
    name,
    date_of_birth,
    gender,
    phone,
    address,
    health_insurance_num,
    expiry_date,
    created_at,
    updated_at,
    search_vector,
    government_identity_type,
    government_identity_value,
    government_identity_trusted,
    normalized_name,
    normalized_phone,
    deleted_at,
    deleted_by,
    deletion_reason
FROM public.clients;

CREATE UNIQUE INDEX phase4_client_snapshot_id
ON phase4_client_snapshot (id);

CREATE TEMP TABLE phase4_sample_link_snapshot
ON COMMIT DROP
AS
SELECT id, client_id
FROM public.samples;

CREATE UNIQUE INDEX phase4_sample_link_snapshot_id
ON phase4_sample_link_snapshot (id);

CREATE TEMP TABLE phase4_client_policy_snapshot
ON COMMIT DROP
AS
SELECT
    polname,
    polcmd,
    polpermissive,
    polroles,
    pg_get_expr(polqual, polrelid) AS using_expression,
    pg_get_expr(polwithcheck, polrelid) AS check_expression
FROM pg_policy
WHERE polrelid = 'public.clients'::REGCLASS;

CREATE TEMP TABLE phase4_client_acl_snapshot
ON COMMIT DROP
AS
SELECT unnest(
    COALESCE(
        relacl,
        acldefault('r', relowner)
    )
)::TEXT AS acl
FROM pg_class
WHERE oid = 'public.clients'::REGCLASS;

DO $baseline$
DECLARE
    v_projection_mismatches BIGINT;
    v_unresolved_canonical_collisions BIGINT;
    v_required_function TEXT;
    v_required_trigger TEXT;
BEGIN
    IF to_regclass('public.clients') IS NULL
       OR to_regclass('public.samples') IS NULL
       OR to_regclass('public.users') IS NULL
       OR to_regclass('public.audit_logs') IS NULL
       OR to_regclass('public.client_collision_adjudications') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 221 requires the Phase 3 client identity baseline';
    END IF;

    FOREACH v_required_function IN ARRAY ARRAY[
        'public.normalize_client_name_v1(text)',
        'public.normalize_client_phone_v1(text)',
        'public.normalize_client_government_identity_v1(text)',
        'public.classify_client_government_identity_v1(text)',
        'public.maintain_client_identity_projections()',
        'public.get_user_role()',
        'public.client_has_confidential_samples(uuid)',
        'public.user_can_access_confidential()',
        'public.is_client_collision_confirmed_distinct_v1(uuid,uuid,text)',
        'public.trigger_audit_log()',
        'public.unaccent(text)'
    ]
    LOOP
        IF to_regprocedure(v_required_function) IS NULL THEN
            RAISE EXCEPTION
                'Migration 221 missing required function %',
                v_required_function;
        END IF;
    END LOOP;

    FOREACH v_required_trigger IN ARRAY ARRAY[
        'audit_clients_changes',
        'clients_maintain_identity_projections',
        'clients_search_update',
        'update_clients_updated_at'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgrelid = 'public.clients'::REGCLASS
              AND tgname = v_required_trigger
              AND tgenabled = 'O'
              AND NOT tgisinternal
        ) THEN
            RAISE EXCEPTION
                'Migration 221 missing enabled clients trigger %',
                v_required_trigger;
        END IF;
    END LOOP;

    IF to_regclass(
        'public.clients_unique_trusted_government_identity'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.resolve_client_identity_v2(text,text,text,date,text)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 221 found a partial resolver v2 deployment';
    END IF;

    SELECT count(*)
    INTO v_projection_mismatches
    FROM public.clients
    WHERE normalized_name IS DISTINCT FROM
            public.normalize_client_name_v1(name)
       OR normalized_phone IS DISTINCT FROM
            public.normalize_client_phone_v1(phone)
       OR government_identity_value IS DISTINCT FROM
            public.normalize_client_government_identity_v1(id_card_num)
       OR government_identity_type IS DISTINCT FROM
            public.classify_client_government_identity_v1(id_card_num)
       OR government_identity_trusted IS DISTINCT FROM (
            public.normalize_client_government_identity_v1(id_card_num)
                IS NOT NULL
          );

    IF v_projection_mismatches <> 0 THEN
        RAISE EXCEPTION
            'Migration 221 found % projection mismatches',
            v_projection_mismatches;
    END IF;

    WITH trusted_duplicates AS (
        SELECT
            government_identity_type,
            government_identity_value
        FROM public.clients
        WHERE government_identity_trusted
          AND government_identity_value IS NOT NULL
        GROUP BY
            government_identity_type,
            government_identity_value
        HAVING count(*) > 1
    ),
    candidate_pairs AS (
        SELECT
            first_client.id AS first_client_id,
            second_client.id AS second_client_id,
            collision.collision_type
        FROM public.clients AS first_client
        JOIN public.clients AS second_client
          ON first_client.id < second_client.id
        CROSS JOIN LATERAL (
            VALUES
                (
                    'government_identity'::TEXT,
                    (
                        first_client.government_identity_trusted
                        AND second_client.government_identity_trusted
                        AND first_client.government_identity_type =
                            second_client.government_identity_type
                        AND first_client.government_identity_value =
                            second_client.government_identity_value
                    )
                ),
                (
                    'phone'::TEXT,
                    (
                        first_client.normalized_phone IS NOT NULL
                        AND first_client.normalized_phone =
                            second_client.normalized_phone
                    )
                ),
                (
                    'name_date_of_birth'::TEXT,
                    (
                        first_client.normalized_name IS NOT NULL
                        AND first_client.normalized_name =
                            second_client.normalized_name
                        AND first_client.date_of_birth =
                            second_client.date_of_birth
                    )
                )
        ) AS collision(collision_type, is_match)
        WHERE collision.is_match
          AND NOT public.is_client_collision_confirmed_distinct_v1(
              first_client.id,
              second_client.id,
              collision.collision_type
          )
    )
    SELECT
        (SELECT count(*) FROM trusted_duplicates)
        + (SELECT count(*) FROM candidate_pairs)
    INTO v_unresolved_canonical_collisions;

    IF v_unresolved_canonical_collisions <> 0 THEN
        RAISE EXCEPTION
            'Migration 221 found % unresolved canonical collisions',
            v_unresolved_canonical_collisions;
    END IF;
END;
$baseline$;

CREATE UNIQUE INDEX clients_unique_trusted_government_identity
ON public.clients (
    government_identity_type,
    government_identity_value
)
WHERE government_identity_trusted
  AND government_identity_value IS NOT NULL;

COMMENT ON INDEX public.clients_unique_trusted_government_identity IS
    'Reserves trusted typed CCCD/CMND values across active and inactive clients.';

CREATE FUNCTION public.fold_client_name_accents_v1(
    p_normalized_name TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
STRICT
PARALLEL SAFE
SET search_path = public, pg_catalog
AS $$
    SELECT lower(public.unaccent(p_normalized_name));
$$;

REVOKE ALL ON FUNCTION public.fold_client_name_accents_v1(TEXT)
FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fold_client_name_accents_v1(TEXT)
FROM anon;
REVOKE ALL ON FUNCTION public.fold_client_name_accents_v1(TEXT)
FROM authenticated;

COMMENT ON FUNCTION public.fold_client_name_accents_v1(TEXT) IS
    'Private collision-only accent fold. It is never a matching key.';

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
    v_identity_type TEXT;
    v_identity_value TEXT;
    v_classified_identity_type TEXT;
    v_name TEXT;
    v_accent_name TEXT;
    v_phone TEXT;
    v_has_identity_type BOOLEAN;
    v_has_identity_value BOOLEAN;
    v_can_access_confidential BOOLEAN;
    v_identity_ids UUID[] := ARRAY[]::UUID[];
    v_identity_active_ids UUID[] := ARRAY[]::UUID[];
    v_name_ids UUID[] := ARRAY[]::UUID[];
    v_name_active_ids UUID[] := ARRAY[]::UUID[];
    v_name_inactive_ids UUID[] := ARRAY[]::UUID[];
    v_accent_ids UUID[] := ARRAY[]::UUID[];
    v_phone_ids UUID[] := ARRAY[]::UUID[];
    v_restricted_identity BOOLEAN := FALSE;
    v_restricted_name BOOLEAN := FALSE;
    v_restricted_accent BOOLEAN := FALSE;
    v_restricted_phone BOOLEAN := FALSE;
    v_match_id UUID;
    v_match public.clients%ROWTYPE;
BEGIN
    v_has_identity_type :=
        NULLIF(lower(btrim(p_government_identity_type)), '') IS NOT NULL;
    v_has_identity_value :=
        NULLIF(btrim(p_government_identity_value), '') IS NOT NULL;
    v_name := public.normalize_client_name_v1(p_name);
    v_phone := public.normalize_client_phone_v1(p_phone);
    v_can_access_confidential := public.user_can_access_confidential();

    IF v_name IS NULL OR p_date_of_birth IS NULL THEN
        RETURN QUERY
        SELECT
            'conflict'::TEXT,
            'invalid_identity_input'::TEXT,
            NULL::UUID,
            FALSE;
        RETURN;
    END IF;

    v_accent_name := public.fold_client_name_accents_v1(v_name);

    IF v_has_identity_type <> v_has_identity_value THEN
        RETURN QUERY
        SELECT
            'conflict'::TEXT,
            'invalid_identity_input'::TEXT,
            NULL::UUID,
            FALSE;
        RETURN;
    END IF;

    IF v_has_identity_type THEN
        v_identity_type := lower(btrim(p_government_identity_type));
        v_identity_value :=
            public.normalize_client_government_identity_v1(
                btrim(p_government_identity_value)
            );
        v_classified_identity_type :=
            public.classify_client_government_identity_v1(
                btrim(p_government_identity_value)
            );

        IF v_identity_type NOT IN ('cccd', 'cmnd')
           OR v_identity_value IS NULL
           OR v_classified_identity_type IS DISTINCT FROM v_identity_type
        THEN
            RETURN QUERY
            SELECT
                'conflict'::TEXT,
                'invalid_identity_input'::TEXT,
                NULL::UUID,
                FALSE;
            RETURN;
        END IF;
    END IF;

    SELECT
        COALESCE(
            array_agg(client.id ORDER BY client.id),
            ARRAY[]::UUID[]
        ),
        COALESCE(
            array_agg(client.id ORDER BY client.id)
                FILTER (WHERE client.deleted_at IS NULL),
            ARRAY[]::UUID[]
        ),
        COALESCE(
            bool_or(
                public.client_has_confidential_samples(client.id)
                AND NOT v_can_access_confidential
            ),
            FALSE
        )
    INTO
        v_identity_ids,
        v_identity_active_ids,
        v_restricted_identity
    FROM public.clients AS client
    WHERE v_identity_type IS NOT NULL
      AND client.government_identity_trusted
      AND client.government_identity_type = v_identity_type
      AND client.government_identity_value = v_identity_value;

    SELECT
        COALESCE(
            array_agg(client.id ORDER BY client.id),
            ARRAY[]::UUID[]
        ),
        COALESCE(
            array_agg(client.id ORDER BY client.id)
                FILTER (WHERE client.deleted_at IS NULL),
            ARRAY[]::UUID[]
        ),
        COALESCE(
            array_agg(client.id ORDER BY client.id)
                FILTER (WHERE client.deleted_at IS NOT NULL),
            ARRAY[]::UUID[]
        ),
        COALESCE(
            bool_or(
                public.client_has_confidential_samples(client.id)
                AND NOT v_can_access_confidential
            ),
            FALSE
        )
    INTO
        v_name_ids,
        v_name_active_ids,
        v_name_inactive_ids,
        v_restricted_name
    FROM public.clients AS client
    WHERE client.normalized_name = v_name
      AND client.date_of_birth = p_date_of_birth;

    SELECT
        COALESCE(
            array_agg(client.id ORDER BY client.id),
            ARRAY[]::UUID[]
        ),
        COALESCE(
            bool_or(
                public.client_has_confidential_samples(client.id)
                AND NOT v_can_access_confidential
            ),
            FALSE
        )
    INTO
        v_accent_ids,
        v_restricted_accent
    FROM public.clients AS client
    WHERE client.normalized_name IS NOT NULL
      AND client.normalized_name <> v_name
      AND public.fold_client_name_accents_v1(
            client.normalized_name
          ) = v_accent_name
      AND client.date_of_birth = p_date_of_birth;

    SELECT
        COALESCE(
            array_agg(client.id ORDER BY client.id),
            ARRAY[]::UUID[]
        ),
        COALESCE(
            bool_or(
                public.client_has_confidential_samples(client.id)
                AND NOT v_can_access_confidential
            ),
            FALSE
        )
    INTO
        v_phone_ids,
        v_restricted_phone
    FROM public.clients AS client
    WHERE v_phone IS NOT NULL
      AND client.normalized_phone = v_phone;

    IF v_identity_type IS NOT NULL THEN
        IF v_restricted_identity
           OR v_restricted_name
           OR v_restricted_accent
           OR v_restricted_phone
        THEN
            RETURN QUERY
            SELECT
                'conflict'::TEXT,
                'restricted_candidate'::TEXT,
                NULL::UUID,
                FALSE;
            RETURN;
        END IF;

        IF cardinality(v_identity_ids) > 1 THEN
            RETURN QUERY
            SELECT
                'ambiguous'::TEXT,
                'trusted_identity_ambiguous'::TEXT,
                NULL::UUID,
                FALSE;
            RETURN;
        END IF;

        IF cardinality(v_identity_ids) = 1 THEN
            v_match_id := v_identity_ids[1];

            SELECT client.*
            INTO v_match
            FROM public.clients AS client
            WHERE client.id = v_match_id;

            IF v_match.deleted_at IS NOT NULL THEN
                RETURN QUERY
                SELECT
                    'conflict'::TEXT,
                    'inactive_candidate'::TEXT,
                    NULL::UUID,
                    FALSE;
                RETURN;
            END IF;

            IF v_match.normalized_name IS DISTINCT FROM v_name
               OR v_match.date_of_birth IS DISTINCT FROM p_date_of_birth
               OR (
                    v_phone IS NOT NULL
                    AND v_match.normalized_phone IS DISTINCT FROM v_phone
               )
               OR EXISTS (
                    SELECT 1
                    FROM unnest(v_name_ids) AS candidate(id)
                    WHERE candidate.id <> v_match_id
                      AND NOT public.is_client_collision_confirmed_distinct_v1(
                            v_match_id,
                            candidate.id,
                            'name_date_of_birth'
                          )
               )
               OR EXISTS (
                    SELECT 1
                    FROM unnest(v_accent_ids) AS candidate(id)
                    WHERE candidate.id <> v_match_id
                      AND NOT public.is_client_collision_confirmed_distinct_v1(
                            v_match_id,
                            candidate.id,
                            'name_date_of_birth'
                          )
               )
               OR EXISTS (
                    SELECT 1
                    FROM unnest(v_phone_ids) AS candidate(id)
                    WHERE candidate.id <> v_match_id
                      AND NOT public.is_client_collision_confirmed_distinct_v1(
                            v_match_id,
                            candidate.id,
                            'phone'
                          )
               )
            THEN
                RETURN QUERY
                SELECT
                    'conflict'::TEXT,
                    'trusted_identity_disagreement'::TEXT,
                    NULL::UUID,
                    FALSE;
                RETURN;
            END IF;

            RETURN QUERY
            SELECT
                'matched'::TEXT,
                'trusted_identity_match'::TEXT,
                v_match_id,
                FALSE;
            RETURN;
        END IF;

        IF cardinality(v_name_ids) > 0
           OR cardinality(v_accent_ids) > 0
           OR cardinality(v_phone_ids) > 0
        THEN
            RETURN QUERY
            SELECT
                'conflict'::TEXT,
                'cross_key_conflict'::TEXT,
                NULL::UUID,
                FALSE;
            RETURN;
        END IF;

        RETURN QUERY
        SELECT
            'not_found'::TEXT,
            'trusted_identity_not_found'::TEXT,
            NULL::UUID,
            FALSE;
        RETURN;
    END IF;

    IF v_restricted_name
       OR v_restricted_accent
       OR v_restricted_phone
    THEN
        RETURN QUERY
        SELECT
            'conflict'::TEXT,
            'restricted_candidate'::TEXT,
            NULL::UUID,
            FALSE;
        RETURN;
    END IF;

    IF cardinality(v_name_inactive_ids) > 0 THEN
        RETURN QUERY
        SELECT
            'conflict'::TEXT,
            'inactive_candidate'::TEXT,
            NULL::UUID,
            FALSE;
        RETURN;
    END IF;

    IF cardinality(v_name_active_ids) > 1 THEN
        RETURN QUERY
        SELECT
            'ambiguous'::TEXT,
            'name_dob_ambiguous'::TEXT,
            NULL::UUID,
            FALSE;
        RETURN;
    END IF;

    IF cardinality(v_name_active_ids) = 1 THEN
        v_match_id := v_name_active_ids[1];

        SELECT client.*
        INTO v_match
        FROM public.clients AS client
        WHERE client.id = v_match_id;

        IF (
                v_phone IS NOT NULL
                AND v_match.normalized_phone IS DISTINCT FROM v_phone
           )
           OR EXISTS (
                SELECT 1
                FROM unnest(v_phone_ids) AS candidate(id)
                WHERE candidate.id <> v_match_id
           )
        THEN
            RETURN QUERY
            SELECT
                'conflict'::TEXT,
                'phone_conflict'::TEXT,
                NULL::UUID,
                FALSE;
            RETURN;
        END IF;

        RETURN QUERY
        SELECT
            'matched'::TEXT,
            'name_dob_match'::TEXT,
            v_match_id,
            FALSE;
        RETURN;
    END IF;

    IF cardinality(v_accent_ids) > 0 THEN
        RETURN QUERY
        SELECT
            'conflict'::TEXT,
            'accent_only_conflict'::TEXT,
            NULL::UUID,
            FALSE;
        RETURN;
    END IF;

    IF cardinality(v_phone_ids) > 0 THEN
        RETURN QUERY
        SELECT
            'conflict'::TEXT,
            'phone_conflict'::TEXT,
            NULL::UUID,
            FALSE;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        'not_found'::TEXT,
        'identity_not_found'::TEXT,
        NULL::UUID,
        FALSE;
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

CREATE FUNCTION public.resolve_client_identity_v2(
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
       OR public.get_user_role() NOT IN ('analyst', 'manager')
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

COMMENT ON FUNCTION public.resolve_client_identity_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT
) IS
    'Read-only deterministic client resolver v2. Phase 4 deploys it dark.';

CREATE FUNCTION public.resolve_or_create_client_v2(
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
BEGIN
    IF auth.uid() IS NULL
       OR public.get_user_role() NOT IN ('analyst', 'manager')
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

COMMENT ON FUNCTION public.resolve_or_create_client_v2(
    TEXT,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    DATE
) IS
    'Transactional deterministic resolve-and-create v2. Phase 4 deploys it dark.';

DO $postconditions$
DECLARE
    v_function_name TEXT;
    v_expected_search_path TEXT[] :=
        ARRAY['search_path=public, extensions'];
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index
        WHERE indexrelid =
            'public.clients_unique_trusted_government_identity'::REGCLASS
          AND indisunique
          AND pg_get_expr(indpred, indrelid) =
              '(government_identity_trusted AND (government_identity_value IS NOT NULL))'
    ) THEN
        RAISE EXCEPTION
            'Migration 221 trusted identity uniqueness postcondition failed';
    END IF;

    FOREACH v_function_name IN ARRAY ARRAY[
        'public.resolve_client_identity_v2(text,text,text,date,text)',
        'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_proc
            WHERE oid = v_function_name::REGPROCEDURE
              AND prosecdef
              AND proconfig = v_expected_search_path
        ) THEN
            RAISE EXCEPTION
                'Migration 221 invalid security boundary for %',
                v_function_name;
        END IF;

        IF NOT has_function_privilege(
            'authenticated',
            v_function_name,
            'EXECUTE'
        )
           OR has_function_privilege(
               'anon',
               v_function_name,
               'EXECUTE'
           )
        THEN
            RAISE EXCEPTION
                'Migration 221 invalid RPC grant boundary for %',
                v_function_name;
        END IF;
    END LOOP;

    IF EXISTS (
        (
            SELECT *
            FROM public.clients
            EXCEPT
            SELECT *
            FROM phase4_client_snapshot
        )
        UNION ALL
        (
            SELECT *
            FROM phase4_client_snapshot
            EXCEPT
            SELECT *
            FROM public.clients
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 221 changed existing client rows';
    END IF;

    IF EXISTS (
        (
            SELECT id, client_id
            FROM public.samples
            EXCEPT
            SELECT id, client_id
            FROM phase4_sample_link_snapshot
        )
        UNION ALL
        (
            SELECT id, client_id
            FROM phase4_sample_link_snapshot
            EXCEPT
            SELECT id, client_id
            FROM public.samples
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 221 changed sample-to-client links';
    END IF;

    IF EXISTS (
        (
            SELECT
                polname,
                polcmd,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT *
            FROM phase4_client_policy_snapshot
        )
        UNION ALL
        (
            SELECT *
            FROM phase4_client_policy_snapshot
            EXCEPT
            SELECT
                polname,
                polcmd,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 221 changed client RLS policies';
    END IF;

    IF EXISTS (
        (
            SELECT unnest(
                COALESCE(
                    relacl,
                    acldefault('r', relowner)
                )
            )::TEXT
            FROM pg_class
            WHERE oid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT acl
            FROM phase4_client_acl_snapshot
        )
        UNION ALL
        (
            SELECT acl
            FROM phase4_client_acl_snapshot
            EXCEPT
            SELECT unnest(
                COALESCE(
                    relacl,
                    acldefault('r', relowner)
                )
            )::TEXT
            FROM pg_class
            WHERE oid = 'public.clients'::REGCLASS
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 221 changed client table grants';
    END IF;
END;
$postconditions$;

COMMIT;
