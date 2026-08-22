-- Migration 216: Add audited client lifecycle and adjudication RPCs.
--
-- Security impact:
-- - Adds manager-only SECURITY DEFINER RPCs with fixed search_path.
-- - Keeps client table policies and grants byte-for-byte equivalent in catalog.
-- - Exposes masked identity/phone evidence in list responses; full identity is
--   available only through the manager-only detail RPC.
-- - Preserves confidential-client visibility checks and returns not-found for
--   unauthorized confidential records.
--
-- Audit and historical impact:
-- - Deactivation, restoration, and identity correction update the existing
--   client UUID only. Samples, results, and historical links are never updated.
-- - The existing clients audit trigger records row changes. Each RPC also
--   writes a reason-bearing, PII-minimized audit event atomically.
-- - This migration is additive. Hard DELETE and broad direct UPDATE remain
--   available until the separately deployed Phase 2.7 guard migration.

BEGIN;

SET LOCAL search_path TO public, extensions;

CREATE TEMP TABLE expected_client_policy_contract
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

CREATE TEMP TABLE expected_client_acl_contract (
    acl TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO expected_client_acl_contract (acl)
SELECT unnest(COALESCE(
    (
        SELECT relacl
        FROM pg_class
        WHERE oid = 'public.clients'::REGCLASS
    ),
    acldefault('r', (
        SELECT relowner
        FROM pg_class
        WHERE oid = 'public.clients'::REGCLASS
    ))
))::TEXT;

DO $baseline$
DECLARE
    v_function REGPROCEDURE;
BEGIN
    IF to_regclass('public.clients') IS NULL
       OR to_regclass('public.samples') IS NULL
       OR to_regclass('public.results') IS NULL
       OR to_regclass('public.audit_logs') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 216 requires clients, samples, results, and audit_logs';
    END IF;

    IF to_regprocedure('public.get_user_role()') IS NULL
       OR to_regprocedure('public.trigger_audit_log()') IS NULL
       OR to_regprocedure('public.client_has_confidential_samples(uuid)') IS NULL
       OR to_regprocedure('public.user_can_access_confidential()') IS NULL
       OR to_regprocedure('public.normalize_client_name_v1(text)') IS NULL
       OR to_regprocedure('public.normalize_client_phone_v1(text)') IS NULL
       OR to_regprocedure(
           'public.normalize_client_government_identity_v1(text)'
       ) IS NULL
       OR to_regprocedure(
           'public.classify_client_government_identity_v1(text)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 216 requires the Phase 1 auth, audit, and normalization contract';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clients'
          AND column_name = 'deleted_at'
          AND data_type = 'timestamp with time zone'
    )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'clients'
             AND column_name = 'deleted_by'
             AND data_type = 'uuid'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'clients'
             AND column_name = 'deletion_reason'
             AND data_type = 'text'
       )
    THEN
        RAISE EXCEPTION
            'Migration 216 requires migration 215 lifecycle columns';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.clients'::REGCLASS
          AND tgname = 'audit_clients_changes'
          AND tgenabled = 'O'
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
          AND NOT tgisinternal
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.clients'::REGCLASS
             AND tgname = 'clients_maintain_identity_projections'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.maintain_client_identity_projections()'::REGPROCEDURE
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.clients'::REGCLASS
             AND tgname = 'clients_search_update'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.update_search_vector_clients()'::REGPROCEDURE
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.clients'::REGCLASS
             AND tgname = 'update_clients_updated_at'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.update_updated_at_column()'::REGPROCEDURE
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION
            'Migration 216 requires the exact client audit, projection, search, and timestamp triggers';
    END IF;

    IF to_regclass('public.client_collision_adjudications') IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 216 expected client collision adjudications to be absent';
    END IF;

    FOREACH v_function IN ARRAY ARRAY[
        to_regprocedure(
            'public.mask_client_identity_v1(text)'
        ),
        to_regprocedure(
            'public.mask_client_phone_v1(text)'
        ),
        to_regprocedure(
            'public.get_client_collision_candidates_v1(uuid)'
        ),
        to_regprocedure(
            'public.is_client_collision_confirmed_distinct_v1(uuid,uuid,text)'
        ),
        to_regprocedure(
            'public.assert_no_client_restore_conflict_v1(uuid,text,text,date,text)'
        ),
        to_regprocedure(
            'public.get_client_lifecycle_manager_v1(text,text,integer,integer)'
        ),
        to_regprocedure(
            'public.get_client_lifecycle_detail_manager_v1(uuid)'
        ),
        to_regprocedure(
            'public.deactivate_client_v1(uuid,timestamp with time zone,text)'
        ),
        to_regprocedure(
            'public.restore_client_v1(uuid,timestamp with time zone,text)'
        ),
        to_regprocedure(
            'public.correct_client_identity_v1(uuid,timestamp with time zone,text,text,date,text,text,text)'
        ),
        to_regprocedure(
            'public.adjudicate_client_collision_v1(uuid,uuid,timestamp with time zone,timestamp with time zone,text,text,text)'
        )
    ]
    LOOP
        IF v_function IS NOT NULL THEN
            RAISE EXCEPTION
                'Migration 216 expected lifecycle RPCs and helpers to be absent';
        END IF;
    END LOOP;
END;
$baseline$;

CREATE TABLE public.client_collision_adjudications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL
        REFERENCES public.clients(id) ON DELETE RESTRICT,
    related_client_id UUID NOT NULL
        REFERENCES public.clients(id) ON DELETE RESTRICT,
    collision_type TEXT NOT NULL
        CHECK (
            collision_type IN (
                'government_identity',
                'phone',
                'name_date_of_birth'
            )
        ),
    disposition TEXT NOT NULL
        CHECK (
            disposition IN (
                'confirmed_distinct',
                'correction_required'
            )
        ),
    reason TEXT NOT NULL
        CHECK (
            length(btrim(reason)) BETWEEN 8 AND 500
        ),
    client_updated_at TIMESTAMPTZ NOT NULL,
    related_client_updated_at TIMESTAMPTZ NOT NULL,
    evidence JSONB NOT NULL,
    adjudicated_by UUID NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,
    adjudicated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT client_collision_adjudication_distinct_clients
        CHECK (client_id < related_client_id)
);

CREATE INDEX idx_client_collision_adjudications_pair
ON public.client_collision_adjudications (
    client_id,
    related_client_id,
    collision_type,
    adjudicated_at DESC
);

ALTER TABLE public.client_collision_adjudications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_collision_adjudications
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.prevent_client_collision_adjudication_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'CLIENT_COLLISION_ADJUDICATION_IMMUTABLE'
        USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION
    public.prevent_client_collision_adjudication_mutation()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER prevent_client_collision_adjudication_mutation
BEFORE UPDATE OR DELETE
ON public.client_collision_adjudications
FOR EACH ROW
EXECUTE FUNCTION public.prevent_client_collision_adjudication_mutation();

CREATE TRIGGER audit_client_collision_adjudications
AFTER INSERT
ON public.client_collision_adjudications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

CREATE FUNCTION public.is_client_collision_confirmed_distinct_v1(
    p_client_id UUID,
    p_related_client_id UUID,
    p_collision_type TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.client_collision_adjudications AS adjudication
        JOIN public.clients AS first_client
          ON first_client.id = adjudication.client_id
        JOIN public.clients AS second_client
          ON second_client.id = adjudication.related_client_id
        WHERE adjudication.client_id =
                LEAST(p_client_id, p_related_client_id)
          AND adjudication.related_client_id =
                GREATEST(p_client_id, p_related_client_id)
          AND adjudication.collision_type = p_collision_type
          AND adjudication.disposition = 'confirmed_distinct'
          AND adjudication.client_updated_at =
                first_client.updated_at
          AND adjudication.related_client_updated_at =
                second_client.updated_at
    );
$$;

REVOKE ALL ON FUNCTION
    public.is_client_collision_confirmed_distinct_v1(UUID, UUID, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.mask_client_identity_v1(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT CASE
        WHEN p_value IS NULL OR btrim(p_value) = '' THEN ''
        WHEN length(btrim(p_value)) <= 4
            THEN repeat('*', length(btrim(p_value)))
        ELSE repeat('*', length(btrim(p_value)) - 4)
            || right(btrim(p_value), 4)
    END;
$$;

REVOKE ALL ON FUNCTION public.mask_client_identity_v1(TEXT)
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.mask_client_phone_v1(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT CASE
        WHEN p_value IS NULL OR btrim(p_value) = '' THEN ''
        WHEN length(btrim(p_value)) <= 4
            THEN repeat('*', length(btrim(p_value)))
        ELSE repeat('*', length(btrim(p_value)) - 4)
            || right(btrim(p_value), 4)
    END;
$$;

REVOKE ALL ON FUNCTION public.mask_client_phone_v1(TEXT)
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_client_collision_candidates_v1(
    p_client_id UUID
)
RETURNS TABLE (
    related_client_id UUID,
    related_name TEXT,
    collision_type TEXT,
    evidence_level TEXT,
    masked_identity TEXT,
    masked_phone TEXT,
    lifecycle_status TEXT,
    related_updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    WITH selected_client AS (
        SELECT *
        FROM public.clients
        WHERE id = p_client_id
    ),
    candidate_matches AS (
        SELECT
            selected.id AS selected_client_id,
            selected.updated_at AS selected_updated_at,
            selected.government_identity_trusted
                AS selected_identity_trusted,
            other_client.id AS candidate_client_id,
            other_client.name AS candidate_name,
            other_client.updated_at AS candidate_updated_at,
            other_client.government_identity_trusted
                AS candidate_identity_trusted,
            other_client.id_card_num AS candidate_identity,
            other_client.phone AS candidate_phone,
            other_client.deleted_at AS candidate_deleted_at,
            match.collision_type,
            (
                public.client_has_confidential_samples(other_client.id)
                AND NOT public.user_can_access_confidential()
            ) AS candidate_restricted
        FROM selected_client AS selected
        JOIN public.clients AS other_client
          ON other_client.id <> selected.id
        CROSS JOIN LATERAL (
            VALUES
                (
                    'government_identity'::TEXT,
                    (
                        btrim(selected.id_card_num) =
                            btrim(other_client.id_card_num)
                        AND btrim(selected.id_card_num) <> ''
                        AND selected.id_card_num !~* '^BACKFILL-'
                    )
                ),
                (
                    'phone'::TEXT,
                    (
                        public.normalize_client_phone_v1(
                            selected.phone
                        ) IS NOT NULL
                        AND public.normalize_client_phone_v1(
                            other_client.phone
                        ) = public.normalize_client_phone_v1(
                            selected.phone
                        )
                    )
                ),
                (
                    'name_date_of_birth'::TEXT,
                    (
                        other_client.date_of_birth = selected.date_of_birth
                        AND public.normalize_client_name_v1(
                            other_client.name
                        ) = public.normalize_client_name_v1(
                            selected.name
                        )
                    )
                )
        ) AS match(collision_type, is_match)
        WHERE match.is_match
    )
    SELECT
        CASE
            WHEN candidate.candidate_restricted THEN NULL
            ELSE candidate.candidate_client_id
        END,
        CASE
            WHEN candidate.candidate_restricted THEN ''
            ELSE candidate.candidate_name
        END,
        candidate.collision_type,
        CASE
            WHEN candidate.candidate_restricted THEN 'restricted'
            WHEN candidate.collision_type = 'government_identity'
                 AND NOT (
                     candidate.selected_identity_trusted
                     AND candidate.candidate_identity_trusted
                 )
                THEN 'legacy_identity'
            ELSE 'trusted'
        END,
        CASE
            WHEN candidate.candidate_restricted THEN ''
            ELSE public.mask_client_identity_v1(
                candidate.candidate_identity
            )
        END,
        CASE
            WHEN candidate.candidate_restricted THEN ''
            ELSE public.mask_client_phone_v1(candidate.candidate_phone)
        END,
        CASE
            WHEN candidate.candidate_deleted_at IS NULL THEN 'active'
            ELSE 'inactive'
        END,
        candidate.candidate_updated_at
    FROM candidate_matches AS candidate
    WHERE NOT public.is_client_collision_confirmed_distinct_v1(
        candidate.selected_client_id,
        candidate.candidate_client_id,
        candidate.collision_type
    )
    ORDER BY candidate.collision_type, candidate.candidate_client_id;
$$;

REVOKE ALL ON FUNCTION public.get_client_collision_candidates_v1(UUID)
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.assert_no_client_restore_conflict_v1(
    p_client_id UUID,
    p_id_card_num TEXT,
    p_name TEXT,
    p_date_of_birth DATE,
    p_phone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_identity_value TEXT :=
        public.normalize_client_government_identity_v1(p_id_card_num);
    v_identity_type TEXT :=
        public.classify_client_government_identity_v1(p_id_card_num);
    v_normalized_name TEXT := public.normalize_client_name_v1(p_name);
    v_normalized_phone TEXT := public.normalize_client_phone_v1(p_phone);
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.clients AS other_client
        WHERE other_client.id <> p_client_id
           AND (
               (
                   (
                       (
                           v_identity_value IS NOT NULL
                           AND public.normalize_client_government_identity_v1(
                               other_client.id_card_num
                           ) = v_identity_value
                           AND public.classify_client_government_identity_v1(
                               other_client.id_card_num
                           ) = v_identity_type
                       )
                       OR (
                           btrim(p_id_card_num) <> ''
                           AND p_id_card_num !~* '^BACKFILL-'
                           AND btrim(other_client.id_card_num) =
                               btrim(p_id_card_num)
                       )
                   )
                   AND NOT public.is_client_collision_confirmed_distinct_v1(
                       p_client_id,
                       other_client.id,
                      'government_identity'
                  )
               )
               OR (
                   v_normalized_phone IS NOT NULL
                   AND public.normalize_client_phone_v1(
                       other_client.phone
                   ) = v_normalized_phone
                   AND NOT public.is_client_collision_confirmed_distinct_v1(
                       p_client_id,
                       other_client.id,
                       'phone'
                   )
               )
               OR (
                   v_normalized_name IS NOT NULL
                   AND public.normalize_client_name_v1(
                       other_client.name
                   ) = v_normalized_name
                   AND other_client.date_of_birth = p_date_of_birth
                   AND NOT public.is_client_collision_confirmed_distinct_v1(
                       p_client_id,
                       other_client.id,
                       'name_date_of_birth'
                   )
              )
          )
    ) THEN
        RAISE EXCEPTION 'CLIENT_ACTIVE_IDENTITY_CONFLICT'
            USING ERRCODE = 'P1114';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_no_client_restore_conflict_v1(
    UUID,
    TEXT,
    TEXT,
    DATE,
    TEXT
)
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_client_lifecycle_manager_v1(
    p_status TEXT DEFAULT 'all',
    p_search TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_search TEXT := NULLIF(
        public.normalize_client_name_v1(p_search),
        ''
    );
    v_result JSONB;
BEGIN
    IF public.get_user_role() IS DISTINCT FROM 'manager' THEN
        RAISE EXCEPTION 'CLIENT_MANAGER_REQUIRED'
            USING ERRCODE = 'P1110';
    END IF;

    IF p_status NOT IN ('all', 'active', 'inactive', 'collision')
       OR p_limit < 1
       OR p_limit > 100
       OR p_offset < 0
    THEN
        RAISE EXCEPTION 'CLIENT_LIFECYCLE_INVALID_REQUEST'
            USING ERRCODE = 'P1111';
    END IF;

    WITH client_evidence AS (
        SELECT
            client.id,
            client.name,
            client.date_of_birth,
            client.gender,
            public.mask_client_identity_v1(
                client.id_card_num
            ) AS masked_identity,
            public.mask_client_phone_v1(
                client.phone
            ) AS masked_phone,
            CASE
                WHEN client.deleted_at IS NULL THEN 'active'
                ELSE 'inactive'
            END AS lifecycle_status,
            client.deleted_at,
            client.deletion_reason,
            client.updated_at,
            (
                SELECT count(*)::INTEGER
                FROM public.samples
                WHERE samples.client_id = client.id
            ) AS sample_count,
            collision_evidence.collision_reasons,
            collision_evidence.collision_candidates
        FROM public.clients AS client
        CROSS JOIN LATERAL (
            WITH candidates AS MATERIALIZED (
                SELECT *
                FROM public.get_client_collision_candidates_v1(
                    client.id
                )
            ),
            reason_values AS (
                SELECT candidate.collision_type AS reason
                FROM candidates AS candidate
                WHERE candidate.evidence_level <> 'restricted'
                UNION ALL
                SELECT candidate.evidence_level
                FROM candidates AS candidate
                WHERE candidate.evidence_level IN (
                    'legacy_identity',
                    'restricted'
                )
            ),
            candidate_groups AS (
                SELECT
                    candidate.related_client_id,
                    max(candidate.related_name) AS related_name,
                    max(candidate.masked_identity) AS masked_identity,
                    max(candidate.masked_phone) AS masked_phone,
                    max(candidate.lifecycle_status) AS lifecycle_status,
                    max(candidate.related_updated_at) AS related_updated_at,
                    CASE
                        WHEN bool_or(
                            candidate.evidence_level = 'legacy_identity'
                        ) THEN 'legacy_identity'
                        ELSE 'trusted'
                    END AS evidence_level,
                    array_agg(
                        DISTINCT candidate.collision_type
                        ORDER BY candidate.collision_type
                    ) AS collision_reasons
                FROM candidates AS candidate
                WHERE candidate.related_client_id IS NOT NULL
                GROUP BY candidate.related_client_id
            )
            SELECT
                COALESCE(
                    (
                        SELECT array_agg(
                            DISTINCT reason.reason
                            ORDER BY reason.reason
                        )
                        FROM reason_values AS reason
                    ),
                    ARRAY[]::TEXT[]
                ) AS collision_reasons,
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', candidate.related_client_id,
                                'name', candidate.related_name,
                                'maskedIdentity',
                                    candidate.masked_identity,
                                'maskedPhone',
                                    candidate.masked_phone,
                                'status', candidate.lifecycle_status,
                                'updatedAt',
                                    candidate.related_updated_at,
                                'evidenceLevel',
                                    candidate.evidence_level,
                                'collisionReasons',
                                    to_jsonb(
                                        candidate.collision_reasons
                                    )
                            )
                            ORDER BY candidate.related_name,
                                candidate.related_client_id
                        )
                        FROM candidate_groups AS candidate
                    ),
                    '[]'::JSONB
                ) AS collision_candidates
        ) AS collision_evidence
        WHERE (
            NOT public.client_has_confidential_samples(client.id)
            OR public.user_can_access_confidential()
        )
    ),
    searchable AS (
        SELECT *
        FROM client_evidence AS client
        WHERE (
            v_search IS NULL
            OR position(
                v_search IN public.normalize_client_name_v1(client.name)
            ) > 0
        )
    ),
    filtered AS (
        SELECT *
        FROM searchable AS client
        WHERE p_status = 'all'
           OR (p_status = 'active' AND client.lifecycle_status = 'active')
           OR (p_status = 'inactive' AND client.lifecycle_status = 'inactive')
           OR (
               p_status = 'collision'
               AND cardinality(client.collision_reasons) > 0
           )
    ),
    page AS (
        SELECT *
        FROM filtered
        ORDER BY name, id
        LIMIT p_limit
        OFFSET p_offset
    )
    SELECT jsonb_build_object(
        'clients',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', client.id,
                        'name', client.name,
                        'dateOfBirth', client.date_of_birth,
                        'gender', client.gender,
                        'maskedIdentity', client.masked_identity,
                        'maskedPhone', client.masked_phone,
                        'status', client.lifecycle_status,
                        'deletedAt', client.deleted_at,
                        'deletionReason', client.deletion_reason,
                        'updatedAt', client.updated_at,
                        'sampleCount', client.sample_count,
                        'collisionReasons', to_jsonb(
                            client.collision_reasons
                        ),
                        'collisionCandidates',
                            client.collision_candidates
                    )
                    ORDER BY client.name, client.id
                )
                FROM page AS client
            ),
            '[]'::JSONB
        ),
        'total', (SELECT count(*) FROM filtered),
        'activeCount', (
            SELECT count(*)
            FROM searchable
            WHERE lifecycle_status = 'active'
        ),
        'inactiveCount', (
            SELECT count(*)
            FROM searchable
            WHERE lifecycle_status = 'inactive'
        ),
        'collisionCount', (
            SELECT count(*)
            FROM searchable
            WHERE cardinality(collision_reasons) > 0
        )
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_lifecycle_manager_v1(
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_client_lifecycle_manager_v1(
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
)
TO authenticated;

CREATE FUNCTION public.get_client_lifecycle_detail_manager_v1(
    p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    client public.clients%ROWTYPE;
BEGIN
    IF public.get_user_role() IS DISTINCT FROM 'manager' THEN
        RAISE EXCEPTION 'CLIENT_MANAGER_REQUIRED'
            USING ERRCODE = 'P1110';
    END IF;

    SELECT *
    INTO client
    FROM public.clients
    WHERE id = p_client_id;

    IF NOT FOUND
       OR (
           public.client_has_confidential_samples(p_client_id)
           AND NOT public.user_can_access_confidential()
       )
    THEN
        RAISE EXCEPTION 'CLIENT_NOT_FOUND'
            USING ERRCODE = 'P1112';
    END IF;

    RETURN jsonb_build_object(
        'id', client.id,
        'idCardNum', client.id_card_num,
        'name', client.name,
        'dateOfBirth', client.date_of_birth,
        'gender', client.gender,
        'phone', client.phone,
        'status', CASE
            WHEN client.deleted_at IS NULL THEN 'active'
            ELSE 'inactive'
        END,
        'updatedAt', client.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_lifecycle_detail_manager_v1(UUID)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
    public.get_client_lifecycle_detail_manager_v1(UUID)
TO authenticated;

CREATE FUNCTION public.deactivate_client_v1(
    p_client_id UUID,
    p_expected_updated_at TIMESTAMPTZ,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    client public.clients%ROWTYPE;
    v_actor UUID := auth.uid();
    v_reason TEXT := btrim(p_reason);
BEGIN
    IF public.get_user_role() IS DISTINCT FROM 'manager' THEN
        RAISE EXCEPTION 'CLIENT_MANAGER_REQUIRED'
            USING ERRCODE = 'P1110';
    END IF;

    IF v_actor IS NULL
       OR v_reason IS NULL
       OR length(v_reason) < 8
       OR length(v_reason) > 500
       OR p_expected_updated_at IS NULL
    THEN
        RAISE EXCEPTION 'CLIENT_LIFECYCLE_INVALID_REQUEST'
            USING ERRCODE = 'P1111';
    END IF;

    LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;

    SELECT *
    INTO client
    FROM public.clients
    WHERE id = p_client_id
    FOR UPDATE;

    IF NOT FOUND
       OR (
           public.client_has_confidential_samples(p_client_id)
           AND NOT public.user_can_access_confidential()
       )
    THEN
        RAISE EXCEPTION 'CLIENT_NOT_FOUND'
            USING ERRCODE = 'P1112';
    END IF;

    IF client.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RAISE EXCEPTION 'CLIENT_STALE_REQUEST'
            USING ERRCODE = 'P1113';
    END IF;

    IF client.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'CLIENT_ALREADY_INACTIVE'
            USING ERRCODE = 'P1115';
    END IF;

    PERFORM set_config('app.client_lifecycle_rpc', 'on', TRUE);

    BEGIN
        UPDATE public.clients
        SET deleted_at = clock_timestamp(),
            deleted_by = v_actor,
            deletion_reason = v_reason
        WHERE id = client.id
        RETURNING * INTO client;

        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            operation,
            new_values,
            changed_by
        )
        VALUES (
            'clients',
            client.id,
            'CLIENT_DEACTIVATED',
            jsonb_build_object(
                'reason', v_reason,
                'lifecycle_status', 'inactive'
            ),
            v_actor
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'CLIENT_AUDIT_FAILED'
                USING ERRCODE = 'P1116';
    END;

    RETURN jsonb_build_object(
        'id', client.id,
        'status', 'inactive',
        'updatedAt', client.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_client_v1(
    UUID,
    TIMESTAMPTZ,
    TEXT
)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_client_v1(
    UUID,
    TIMESTAMPTZ,
    TEXT
)
TO authenticated;

CREATE FUNCTION public.restore_client_v1(
    p_client_id UUID,
    p_expected_updated_at TIMESTAMPTZ,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    client public.clients%ROWTYPE;
    v_actor UUID := auth.uid();
    v_reason TEXT := btrim(p_reason);
BEGIN
    IF public.get_user_role() IS DISTINCT FROM 'manager' THEN
        RAISE EXCEPTION 'CLIENT_MANAGER_REQUIRED'
            USING ERRCODE = 'P1110';
    END IF;

    IF v_actor IS NULL
       OR v_reason IS NULL
       OR length(v_reason) < 8
       OR length(v_reason) > 500
       OR p_expected_updated_at IS NULL
    THEN
        RAISE EXCEPTION 'CLIENT_LIFECYCLE_INVALID_REQUEST'
            USING ERRCODE = 'P1111';
    END IF;

    LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;

    SELECT *
    INTO client
    FROM public.clients
    WHERE id = p_client_id
    FOR UPDATE;

    IF NOT FOUND
       OR (
           public.client_has_confidential_samples(p_client_id)
           AND NOT public.user_can_access_confidential()
       )
    THEN
        RAISE EXCEPTION 'CLIENT_NOT_FOUND'
            USING ERRCODE = 'P1112';
    END IF;

    IF client.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RAISE EXCEPTION 'CLIENT_STALE_REQUEST'
            USING ERRCODE = 'P1113';
    END IF;

    IF client.deleted_at IS NULL THEN
        RAISE EXCEPTION 'CLIENT_ALREADY_ACTIVE'
            USING ERRCODE = 'P1115';
    END IF;

    PERFORM public.assert_no_client_restore_conflict_v1(
        client.id,
        client.id_card_num,
        client.name,
        client.date_of_birth,
        client.phone
    );
    PERFORM set_config('app.client_lifecycle_rpc', 'on', TRUE);

    BEGIN
        UPDATE public.clients
        SET deleted_at = NULL,
            deleted_by = NULL,
            deletion_reason = NULL
        WHERE id = client.id
        RETURNING * INTO client;

        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            operation,
            new_values,
            changed_by
        )
        VALUES (
            'clients',
            client.id,
            'CLIENT_RESTORED',
            jsonb_build_object(
                'reason', v_reason,
                'lifecycle_status', 'active'
            ),
            v_actor
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'CLIENT_AUDIT_FAILED'
                USING ERRCODE = 'P1116';
    END;

    RETURN jsonb_build_object(
        'id', client.id,
        'status', 'active',
        'updatedAt', client.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_client_v1(
    UUID,
    TIMESTAMPTZ,
    TEXT
)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_client_v1(
    UUID,
    TIMESTAMPTZ,
    TEXT
)
TO authenticated;

CREATE FUNCTION public.correct_client_identity_v1(
    p_client_id UUID,
    p_expected_updated_at TIMESTAMPTZ,
    p_id_card_num TEXT,
    p_name TEXT,
    p_date_of_birth DATE,
    p_gender TEXT,
    p_phone TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    client public.clients%ROWTYPE;
    v_actor UUID := auth.uid();
    v_reason TEXT := btrim(p_reason);
    v_name TEXT := btrim(p_name);
    v_id_card_num TEXT := btrim(p_id_card_num);
    v_phone TEXT := btrim(p_phone);
    v_corrected_fields TEXT[];
BEGIN
    IF public.get_user_role() IS DISTINCT FROM 'manager' THEN
        RAISE EXCEPTION 'CLIENT_MANAGER_REQUIRED'
            USING ERRCODE = 'P1110';
    END IF;

    IF v_actor IS NULL
       OR v_reason IS NULL
       OR length(v_reason) < 8
       OR length(v_reason) > 500
       OR p_expected_updated_at IS NULL
       OR v_name IS NULL
       OR v_name = ''
       OR p_date_of_birth IS NULL
       OR p_gender NOT IN ('Nam', 'Nữ', 'Khác')
       OR public.normalize_client_government_identity_v1(
           v_id_card_num
       ) IS NULL
       OR public.normalize_client_phone_v1(v_phone) IS NULL
    THEN
        RAISE EXCEPTION 'CLIENT_LIFECYCLE_INVALID_REQUEST'
            USING ERRCODE = 'P1111';
    END IF;

    LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;

    SELECT *
    INTO client
    FROM public.clients
    WHERE id = p_client_id
    FOR UPDATE;

    IF NOT FOUND
       OR (
           public.client_has_confidential_samples(p_client_id)
           AND NOT public.user_can_access_confidential()
       )
    THEN
        RAISE EXCEPTION 'CLIENT_NOT_FOUND'
            USING ERRCODE = 'P1112';
    END IF;

    IF client.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RAISE EXCEPTION 'CLIENT_STALE_REQUEST'
            USING ERRCODE = 'P1113';
    END IF;

    v_corrected_fields := ARRAY_REMOVE(ARRAY[
        CASE
            WHEN client.id_card_num IS DISTINCT FROM v_id_card_num
                THEN 'id_card_num'
        END,
        CASE
            WHEN client.name IS DISTINCT FROM v_name
                THEN 'name'
        END,
        CASE
            WHEN client.date_of_birth IS DISTINCT FROM p_date_of_birth
                THEN 'date_of_birth'
        END,
        CASE
            WHEN client.gender IS DISTINCT FROM p_gender
                THEN 'gender'
        END,
        CASE
            WHEN client.phone IS DISTINCT FROM v_phone
                THEN 'phone'
        END
    ], NULL);

    IF cardinality(v_corrected_fields) = 0 THEN
        RAISE EXCEPTION 'CLIENT_IDENTITY_UNCHANGED'
            USING ERRCODE = 'P1111';
    END IF;

    PERFORM public.assert_no_client_restore_conflict_v1(
        client.id,
        v_id_card_num,
        v_name,
        p_date_of_birth,
        v_phone
    );
    PERFORM set_config('app.client_lifecycle_rpc', 'on', TRUE);

    BEGIN
        UPDATE public.clients
        SET id_card_num = v_id_card_num,
            name = v_name,
            date_of_birth = p_date_of_birth,
            gender = p_gender,
            phone = v_phone
        WHERE id = client.id
        RETURNING * INTO client;

        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            operation,
            new_values,
            changed_by
        )
        VALUES (
            'clients',
            client.id,
            'CLIENT_IDENTITY_CORRECTED',
            jsonb_build_object(
                'reason', v_reason,
                'corrected_fields', to_jsonb(v_corrected_fields),
                'lifecycle_status', CASE
                    WHEN client.deleted_at IS NULL THEN 'active'
                    ELSE 'inactive'
                END
            ),
            v_actor
        );
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'CLIENT_ACTIVE_IDENTITY_CONFLICT'
                USING ERRCODE = 'P1114';
        WHEN OTHERS THEN
            RAISE EXCEPTION 'CLIENT_AUDIT_FAILED'
                USING ERRCODE = 'P1116';
    END;

    RETURN jsonb_build_object(
        'id', client.id,
        'status', CASE
            WHEN client.deleted_at IS NULL THEN 'active'
            ELSE 'inactive'
        END,
        'updatedAt', client.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.correct_client_identity_v1(
    UUID,
    TIMESTAMPTZ,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TEXT,
    TEXT
)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.correct_client_identity_v1(
    UUID,
    TIMESTAMPTZ,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TEXT,
    TEXT
)
TO authenticated;

CREATE FUNCTION public.adjudicate_client_collision_v1(
    p_client_id UUID,
    p_related_client_id UUID,
    p_expected_updated_at TIMESTAMPTZ,
    p_related_expected_updated_at TIMESTAMPTZ,
    p_collision_type TEXT,
    p_disposition TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    client public.clients%ROWTYPE;
    related_client public.clients%ROWTYPE;
    v_actor UUID := auth.uid();
    v_reason TEXT := btrim(p_reason);
    v_adjudication_id UUID;
    v_adjudicated_at TIMESTAMPTZ;
    v_first_client_id UUID;
    v_second_client_id UUID;
    v_first_updated_at TIMESTAMPTZ;
    v_second_updated_at TIMESTAMPTZ;
    v_collision_evidence_level TEXT;
    v_evidence JSONB;
BEGIN
    IF public.get_user_role() IS DISTINCT FROM 'manager' THEN
        RAISE EXCEPTION 'CLIENT_MANAGER_REQUIRED'
            USING ERRCODE = 'P1110';
    END IF;

    IF v_actor IS NULL
       OR p_client_id IS NULL
       OR p_related_client_id IS NULL
       OR p_client_id = p_related_client_id
       OR p_expected_updated_at IS NULL
       OR p_related_expected_updated_at IS NULL
       OR p_collision_type IS NULL
       OR p_collision_type NOT IN (
           'government_identity',
           'phone',
           'name_date_of_birth'
       )
       OR p_disposition IS NULL
       OR p_disposition NOT IN (
           'confirmed_distinct',
           'correction_required'
       )
       OR v_reason IS NULL
       OR length(v_reason) < 8
       OR length(v_reason) > 500
    THEN
        RAISE EXCEPTION 'CLIENT_LIFECYCLE_INVALID_REQUEST'
            USING ERRCODE = 'P1111';
    END IF;

    LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;

    SELECT *
    INTO client
    FROM public.clients
    WHERE id = p_client_id
    FOR UPDATE;

    SELECT *
    INTO related_client
    FROM public.clients
    WHERE id = p_related_client_id
    FOR UPDATE;

    IF client.id IS NULL
       OR related_client.id IS NULL
       OR (
           public.client_has_confidential_samples(p_client_id)
           AND NOT public.user_can_access_confidential()
       )
       OR (
           public.client_has_confidential_samples(p_related_client_id)
           AND NOT public.user_can_access_confidential()
       )
    THEN
        RAISE EXCEPTION 'CLIENT_NOT_FOUND'
            USING ERRCODE = 'P1112';
    END IF;

    IF client.updated_at IS DISTINCT FROM p_expected_updated_at
       OR related_client.updated_at IS DISTINCT FROM
            p_related_expected_updated_at
    THEN
        RAISE EXCEPTION 'CLIENT_STALE_REQUEST'
            USING ERRCODE = 'P1113';
    END IF;

    SELECT candidate.evidence_level
    INTO v_collision_evidence_level
    FROM public.get_client_collision_candidates_v1(client.id) AS candidate
    WHERE candidate.related_client_id = related_client.id
      AND candidate.collision_type = p_collision_type;

    IF v_collision_evidence_level IS NULL THEN
        RAISE EXCEPTION 'CLIENT_COLLISION_NOT_AVAILABLE'
            USING ERRCODE = 'P1117';
    END IF;

    IF p_collision_type = 'government_identity'
       AND p_disposition = 'confirmed_distinct'
       AND v_collision_evidence_level = 'trusted'
    THEN
        RAISE EXCEPTION 'CLIENT_LIFECYCLE_INVALID_REQUEST'
            USING ERRCODE = 'P1111';
    END IF;

    v_first_client_id := LEAST(client.id, related_client.id);
    v_second_client_id := GREATEST(client.id, related_client.id);
    v_first_updated_at := CASE
        WHEN client.id < related_client.id
            THEN client.updated_at
        ELSE related_client.updated_at
    END;
    v_second_updated_at := CASE
        WHEN client.id < related_client.id
            THEN related_client.updated_at
        ELSE client.updated_at
    END;
    v_evidence := jsonb_build_object(
        'collisionType', p_collision_type,
        'evidenceLevel', v_collision_evidence_level,
        'client', jsonb_build_object(
            'id', client.id,
            'status', CASE
                WHEN client.deleted_at IS NULL THEN 'active'
                ELSE 'inactive'
            END,
            'identityEvidence', CASE
                WHEN client.government_identity_trusted THEN 'trusted'
                ELSE 'legacy_identity'
            END,
            'maskedIdentity',
                public.mask_client_identity_v1(client.id_card_num),
            'maskedPhone',
                public.mask_client_phone_v1(client.phone)
        ),
        'relatedClient', jsonb_build_object(
            'id', related_client.id,
            'status', CASE
                WHEN related_client.deleted_at IS NULL THEN 'active'
                ELSE 'inactive'
            END,
            'identityEvidence', CASE
                WHEN related_client.government_identity_trusted
                    THEN 'trusted'
                ELSE 'legacy_identity'
            END,
            'maskedIdentity',
                public.mask_client_identity_v1(
                    related_client.id_card_num
                ),
            'maskedPhone',
                public.mask_client_phone_v1(related_client.phone)
        )
    );

    BEGIN
        INSERT INTO public.client_collision_adjudications (
            client_id,
            related_client_id,
            collision_type,
            disposition,
            reason,
            client_updated_at,
            related_client_updated_at,
            evidence,
            adjudicated_by
        )
        VALUES (
            v_first_client_id,
            v_second_client_id,
            p_collision_type,
            p_disposition,
            v_reason,
            v_first_updated_at,
            v_second_updated_at,
            v_evidence,
            v_actor
        )
        RETURNING id, adjudicated_at
        INTO v_adjudication_id, v_adjudicated_at;

        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            operation,
            new_values,
            changed_by
        )
        VALUES (
            'client_collision_adjudications',
            v_adjudication_id,
            'CLIENT_COLLISION_ADJUDICATED',
            jsonb_build_object(
                'client_id', v_first_client_id,
                'related_client_id', v_second_client_id,
                'collision_type', p_collision_type,
                'disposition', p_disposition,
                'reason', v_reason
            ),
            v_actor
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'CLIENT_AUDIT_FAILED'
                USING ERRCODE = 'P1116';
    END;

    RETURN jsonb_build_object(
        'id', v_adjudication_id,
        'clientId', client.id,
        'relatedClientId', related_client.id,
        'collisionType', p_collision_type,
        'disposition', p_disposition,
        'adjudicatedAt', v_adjudicated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.adjudicate_client_collision_v1(
    UUID,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TEXT,
    TEXT,
    TEXT
)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjudicate_client_collision_v1(
    UUID,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TEXT,
    TEXT,
    TEXT
)
TO authenticated;

COMMENT ON FUNCTION public.get_client_lifecycle_manager_v1(
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
) IS
    'Manager-only masked client lifecycle and unresolved-collision workspace.';
COMMENT ON FUNCTION public.get_client_lifecycle_detail_manager_v1(UUID) IS
    'Manager-only full client identity detail for explicit adjudication.';
COMMENT ON FUNCTION public.deactivate_client_v1(
    UUID,
    TIMESTAMPTZ,
    TEXT
) IS
    'Audited manager-only client deactivation preserving UUID and history.';
COMMENT ON FUNCTION public.restore_client_v1(
    UUID,
    TIMESTAMPTZ,
    TEXT
) IS
    'Audited manager-only restore of the same UUID with fail-closed conflicts.';
COMMENT ON FUNCTION public.correct_client_identity_v1(
    UUID,
    TIMESTAMPTZ,
    TEXT,
    TEXT,
    DATE,
    TEXT,
    TEXT,
    TEXT
) IS
    'Audited manager-only identity correction without merge or UUID replacement.';
COMMENT ON FUNCTION public.adjudicate_client_collision_v1(
    UUID,
    UUID,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TEXT,
    TEXT,
    TEXT
) IS
    'Audited manager-only collision disposition preserving both client UUIDs and history.';

DO $postconditions$
DECLARE
    v_function REGPROCEDURE;
BEGIN
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
            SELECT
                polname,
                polcmd,
                polpermissive,
                polroles,
                using_expression,
                check_expression
            FROM expected_client_policy_contract
        )
        UNION ALL
        (
            SELECT
                polname,
                polcmd,
                polpermissive,
                polroles,
                using_expression,
                check_expression
            FROM expected_client_policy_contract
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
            'Migration 216 changed the client RLS policy contract';
    END IF;

    IF EXISTS (
        (
            SELECT unnest(COALESCE(
                (
                    SELECT relacl
                    FROM pg_class
                    WHERE oid = 'public.clients'::REGCLASS
                ),
                acldefault('r', (
                    SELECT relowner
                    FROM pg_class
                    WHERE oid = 'public.clients'::REGCLASS
                ))
            ))::TEXT
            EXCEPT
            SELECT acl FROM expected_client_acl_contract
        )
        UNION ALL
        (
            SELECT acl FROM expected_client_acl_contract
            EXCEPT
            SELECT unnest(COALESCE(
                (
                    SELECT relacl
                    FROM pg_class
                    WHERE oid = 'public.clients'::REGCLASS
                ),
                acldefault('r', (
                    SELECT relowner
                    FROM pg_class
                    WHERE oid = 'public.clients'::REGCLASS
                ))
            ))::TEXT
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 216 changed the client table grant contract';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.client_collision_adjudications'::REGCLASS
          AND relrowsecurity
    )
       OR has_table_privilege(
           'anon',
           'public.client_collision_adjudications',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
       OR has_table_privilege(
           'authenticated',
           'public.client_collision_adjudications',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
       OR has_table_privilege(
           'service_role',
           'public.client_collision_adjudications',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
       )
    THEN
        RAISE EXCEPTION
            'Migration 216 adjudication table security postcondition failed';
    END IF;

    FOREACH v_function IN ARRAY ARRAY[
        'public.get_client_lifecycle_manager_v1(text,text,integer,integer)'::REGPROCEDURE,
        'public.get_client_lifecycle_detail_manager_v1(uuid)'::REGPROCEDURE,
        'public.deactivate_client_v1(uuid,timestamp with time zone,text)'::REGPROCEDURE,
        'public.restore_client_v1(uuid,timestamp with time zone,text)'::REGPROCEDURE,
        'public.correct_client_identity_v1(uuid,timestamp with time zone,text,text,date,text,text,text)'::REGPROCEDURE,
        'public.adjudicate_client_collision_v1(uuid,uuid,timestamp with time zone,timestamp with time zone,text,text,text)'::REGPROCEDURE
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_proc
            WHERE oid = v_function
              AND prosecdef
              AND proconfig @> ARRAY['search_path=public, extensions']
        )
           OR has_function_privilege('anon', v_function, 'EXECUTE')
           OR NOT has_function_privilege(
               'authenticated',
               v_function,
               'EXECUTE'
           )
           OR has_function_privilege('service_role', v_function, 'EXECUTE')
        THEN
            RAISE EXCEPTION
                'Migration 216 lifecycle RPC security postcondition failed for %',
                v_function;
        END IF;
    END LOOP;
END;
$postconditions$;

COMMIT;
