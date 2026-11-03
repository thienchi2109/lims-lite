-- Migration 233: request-local canonical client planning for workbook preview.
-- Security impact: active analyst-only, read-only SECURITY DEFINER RPC with
-- fixed search_path and closed PUBLIC/anon/service_role grants. No business,
-- audit, temporary-table or durable preview writes; public v2 is unchanged.
-- Reuses 215 normalization and 221 resolver/adjudicated-distinct authority.
-- Apply only in an authorized home-server session; then run retained SQL
-- behavior fixtures and run_security_tests(). Static tests are SOURCE ONLY.

BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $baseline$
DECLARE v_signature TEXT;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.normalize_client_name_v1(text)', 'public.normalize_client_phone_v1(text)',
        'public.normalize_client_government_identity_v1(text)', 'public.fold_client_name_accents_v1(text)',
        'public.resolve_client_identity_internal_v2(text,text,text,date,text)',
        'public.is_client_collision_confirmed_distinct_v1(uuid,uuid,text)',
        'public.get_user_role()', 'public.run_security_tests()', 'public.test_client_canonical_integrity_security()'
    ] LOOP
        IF to_regprocedure(v_signature) IS NULL THEN
            RAISE EXCEPTION 'Migration 233 missing canonical baseline: %', v_signature;
        END IF;
    END LOOP;
    IF to_regprocedure('public.resolve_accession_preview_clients_v1(jsonb)') IS NOT NULL
       OR to_regprocedure('public.test_accession_preview_client_resolution_security()') IS NOT NULL
       OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.clients'::REGCLASS
                      AND conname = 'clients_canonical_projection_check') THEN
        RAISE EXCEPTION 'Migration 233 requires canonical integrity baseline and unused signatures';
    END IF;
END;
$baseline$;

CREATE FUNCTION public.resolve_accession_preview_clients_v1(p_clients JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_client JSONB;
    v_key TEXT;
    v_text TEXT;
    v_date DATE;
    v_result JSONB;
    v_fields CONSTANT TEXT[] := ARRAY['row', 'name', 'dateOfBirth', 'governmentIdentityType',
        'governmentIdentityValue', 'gender', 'phone', 'address', 'healthInsuranceNum', 'expiryDate'];
BEGIN
    IF auth.uid() IS NULL OR public.get_user_role() IS DISTINCT FROM 'analyst'
       OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_ANALYST_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_clients) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_clients) = 0 THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
    END IF;
    FOR v_client IN SELECT value FROM jsonb_array_elements(p_clients) LOOP
        IF jsonb_typeof(v_client) IS DISTINCT FROM 'object' OR NOT v_client ?& v_fields THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
        END IF;
        IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_client) AS field(key) WHERE key <> ALL(v_fields))
           OR jsonb_typeof(v_client->'row') IS DISTINCT FROM 'number'
           OR (v_client->>'row') !~ '^[1-9][0-9]{0,9}$'
           OR (v_client->>'row')::BIGINT > 2147483647 THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
        END IF;
        FOREACH v_key IN ARRAY v_fields[2:10] LOOP
            IF jsonb_typeof(v_client->v_key) NOT IN ('string', 'null') THEN
                RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
            END IF;
        END LOOP;
        IF v_client->>'name' IS NULL OR char_length(v_client->>'name') > 200
           OR public.normalize_client_name_v1(v_client->>'name') !~ '[^[:space:]]'
           OR v_client->>'dateOfBirth' IS NULL
           OR char_length(v_client->>'address') > 500 OR char_length(v_client->>'healthInsuranceNum') > 80
           OR (v_client->>'gender' IS NOT NULL AND v_client->>'gender' NOT IN ('Nam', 'Nữ', 'Khác'))
           OR (v_client->>'phone' IS NOT NULL AND (char_length(v_client->>'phone') > 30
               OR (btrim(v_client->>'phone') <> '0000000000'
                   AND (public.normalize_client_phone_v1(v_client->>'phone') IS NULL
                        OR public.normalize_client_phone_v1(v_client->>'phone') !~ '^0[35789][0-9]{8}$'))))
           OR ((v_client->>'governmentIdentityType' IS NULL) <> (v_client->>'governmentIdentityValue' IS NULL))
           OR (v_client->>'governmentIdentityType' IS NOT NULL AND (
               v_client->>'governmentIdentityType' NOT IN ('cccd', 'cmnd')
               OR public.normalize_client_government_identity_v1(v_client->>'governmentIdentityValue') IS NULL
               OR (v_client->>'governmentIdentityType' = 'cccd' AND char_length(v_client->>'governmentIdentityValue') <> 12)
               OR (v_client->>'governmentIdentityType' = 'cmnd' AND char_length(v_client->>'governmentIdentityValue') <> 9))) THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
        END IF;
        FOREACH v_key IN ARRAY ARRAY['dateOfBirth', 'expiryDate'] LOOP
            v_text := v_client->>v_key;
            IF v_text IS NOT NULL THEN
                IF v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
                    RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
                END IF;
                BEGIN
                    v_date := v_text::DATE;
                EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
                    RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
                END;
                IF v_date < DATE '1900-01-01' OR v_date > DATE '2100-12-31'
                   OR to_char(v_date, 'YYYY-MM-DD') <> v_text THEN
                    RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    IF (SELECT count(DISTINCT value->>'row') FROM jsonb_array_elements(p_clients)) <> jsonb_array_length(p_clients) THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_INPUT_INVALID' USING ERRCODE = '22023';
    END IF;

    WITH normalized AS MATERIALIZED (
        SELECT (value->>'row')::INTEGER AS row_number,
            (value - 'row') || jsonb_build_object(
                'name', public.normalize_client_name_v1(value->>'name'),
                'phone', public.normalize_client_phone_v1(value->>'phone'),
                'address', normalize(value->>'address', NFC),
                'healthInsuranceNum', normalize(value->>'healthInsuranceNum', NFC)) AS input
        FROM jsonb_array_elements(p_clients)
    ), resolved AS MATERIALIZED (
        SELECT source.row_number, source.input, resolution.outcome, resolution.reason_code, resolution.client_id, resolution.created,
            -- Canonical v2 already consults is_client_collision_confirmed_distinct_v1
            -- for existing UUID collisions. Never synthesize that adjudication for not_found.
            CASE WHEN resolution.outcome IN ('matched', 'not_found') THEN
                COALESCE(source.input->>'governmentIdentityType',
                    CASE WHEN client.government_identity_trusted THEN client.government_identity_type END) END AS identity_type,
            CASE WHEN resolution.outcome IN ('matched', 'not_found') THEN
                COALESCE(source.input->>'governmentIdentityValue',
                    CASE WHEN client.government_identity_trusted THEN client.government_identity_value END) END AS identity_value,
            CASE WHEN resolution.outcome = 'matched' AND client.government_identity_trusted THEN
                jsonb_build_object('type', client.government_identity_type,
                    'value', client.government_identity_value, 'trusted', TRUE) END AS trusted_identity,
            CASE WHEN resolution.outcome = 'matched' THEN jsonb_build_object(
                'name', client.normalized_name, 'dateOfBirth', to_char(client.date_of_birth, 'YYYY-MM-DD'),
                'governmentIdentityType', CASE WHEN client.government_identity_trusted THEN client.government_identity_type END,
                'governmentIdentityValue', CASE WHEN client.government_identity_trusted THEN client.government_identity_value END,
                'gender', client.gender, 'phone', client.normalized_phone, 'address', client.address,
                'healthInsuranceNum', client.health_insurance_num, 'expiryDate', to_char(client.expiry_date, 'YYYY-MM-DD')) END AS display_values
        FROM normalized AS source
        CROSS JOIN LATERAL public.resolve_client_identity_internal_v2(
            source.input->>'governmentIdentityType', source.input->>'governmentIdentityValue',
            source.input->>'name', (source.input->>'dateOfBirth')::DATE, source.input->>'phone') AS resolution
        LEFT JOIN public.clients AS client ON client.id = resolution.client_id AND resolution.outcome = 'matched'
    ), members AS MATERIALIZED (
        -- Five indexed grouping keys per row, never an unconditional row-pair cross product.
        SELECT row_data.*, candidate.kind, candidate.key
        FROM resolved AS row_data
        CROSS JOIN LATERAL (VALUES
            ('uuid', to_jsonb(row_data.client_id)),
            ('identity', CASE WHEN row_data.identity_type IS NOT NULL THEN jsonb_build_array(row_data.identity_type, row_data.identity_value) END),
            ('name', jsonb_build_array(row_data.input->>'name', row_data.input->>'dateOfBirth')),
            ('accent', jsonb_build_array(public.fold_client_name_accents_v1(row_data.input->>'name'), row_data.input->>'dateOfBirth')),
            ('phone', to_jsonb(row_data.input->>'phone'))
        ) AS candidate(kind, key)
        WHERE row_data.outcome IN ('matched', 'not_found') AND candidate.key IS NOT NULL
    ), groups AS MATERIALIZED (
        SELECT kind, key, min(row_number) AS first_row, max(row_number) AS last_row,
            bool_or(outcome = 'not_found') AS has_create,
            count(DISTINCT input->>'name') > 1 OR count(DISTINCT input->>'dateOfBirth') > 1
                OR count(DISTINCT input->>'phone') > 1 AS disagrees,
            count(DISTINCT input->>'name') > 1 AS accent_disagrees,
            count(*) FILTER (WHERE identity_type IS NULL) = 0
                AND count(DISTINCT jsonb_build_array(identity_type, identity_value)) = 1 AS same_identity
        FROM members GROUP BY kind, key HAVING count(*) > 1
    ), issues AS (
        SELECT member.row_number,
            CASE WHEN bucket.kind IN ('uuid', 'identity') AND NOT bucket.disagrees
                THEN 'CLIENT_DUPLICATE' ELSE 'CLIENT_CONFLICT' END AS code,
            CASE WHEN bucket.kind = 'uuid' THEN CASE WHEN bucket.disagrees THEN 'identity_conflict' ELSE 'same_uuid' END
                 WHEN bucket.kind = 'identity' THEN CASE WHEN bucket.disagrees THEN 'trusted_identity_disagreement' ELSE 'same_trusted_identity' END
                 WHEN bucket.kind = 'phone' THEN 'phone_conflict'
                 WHEN bucket.kind = 'accent' THEN 'accent_only_conflict' ELSE 'cross_key_conflict' END AS reason,
            CASE WHEN member.row_number = bucket.first_row THEN bucket.last_row ELSE bucket.first_row END AS related_row,
            CASE WHEN bucket.kind IN ('uuid', 'identity') AND bucket.disagrees THEN 0
                 WHEN bucket.kind IN ('uuid', 'identity') THEN 2 ELSE 1 END AS priority
        FROM members AS member JOIN groups AS bucket USING (kind, key)
        WHERE bucket.kind IN ('uuid', 'identity')
           OR (bucket.has_create AND NOT bucket.same_identity
               AND (bucket.kind <> 'accent' OR bucket.accent_disagrees))
    ), chosen AS (
        -- One related group witness per failed row keeps output linear. It need not
        -- identify the exact disagreeing pair in a mixed collision group.
        SELECT DISTINCT ON (row_number) row_number, code, reason, related_row
        FROM issues ORDER BY row_number, priority, reason, related_row
    )
    SELECT jsonb_agg(jsonb_build_object(
        'row', row_data.row_number, 'input', row_data.input,
        'resolution', jsonb_build_object('outcome', row_data.outcome,
            'reasonCode', CASE WHEN row_data.reason_code = 'restricted_candidate' THEN 'identity_conflict' ELSE row_data.reason_code END,
            'clientId', row_data.client_id, 'created', row_data.created),
        'trustedIdentity', row_data.trusted_identity, 'displayValues', row_data.display_values,
        'issues', CASE WHEN chosen.row_number IS NULL THEN '[]'::JSONB ELSE jsonb_build_array(jsonb_build_object(
            'code', chosen.code, 'reasonCode', chosen.reason, 'relatedRows', jsonb_build_array(chosen.related_row))) END
    ) ORDER BY row_data.row_number) INTO v_result
    FROM resolved AS row_data LEFT JOIN chosen USING (row_number);
    RETURN v_result;
END;
$$;

ALTER FUNCTION public.resolve_accession_preview_clients_v1(JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_accession_preview_clients_v1(JSONB)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_accession_preview_clients_v1(JSONB) TO authenticated;
COMMENT ON FUNCTION public.resolve_accession_preview_clients_v1(JSONB) IS
    'Read-only analyst workbook client plan; request-local PII, canonical v2/215 normalizers, bounded grouped guard witnesses. No business writes or retained payload.';

CREATE FUNCTION public.test_accession_preview_client_resolution_security()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE oid = 'public.resolve_accession_preview_clients_v1(jsonb)'::REGPROCEDURE
          AND prosecdef AND provolatile = 's' AND proowner = 'postgres'::REGROLE
          AND prorettype = 'jsonb'::REGTYPE AND proconfig @> ARRAY['search_path=public, pg_temp']
    ) AND has_function_privilege('authenticated', 'public.resolve_accession_preview_clients_v1(jsonb)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.resolve_accession_preview_clients_v1(jsonb)', 'EXECUTE')
      AND NOT has_function_privilege('service_role', 'public.resolve_accession_preview_clients_v1(jsonb)', 'EXECUTE')
      AND NOT EXISTS (
          SELECT 1 FROM pg_proc AS routine,
              LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) AS privilege
          WHERE routine.oid = 'public.resolve_accession_preview_clients_v1(jsonb)'::REGPROCEDURE
            AND privilege.grantee = 0 AND privilege.privilege_type = 'EXECUTE'
      );
$$;
ALTER FUNCTION public.test_accession_preview_client_resolution_security() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.test_accession_preview_client_resolution_security() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_accession_preview_client_resolution_security() TO authenticated;

DO $register_and_verify$
DECLARE v_definition TEXT; v_passed BOOLEAN;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE) INTO v_definition;
    IF v_definition NOT LIKE '%test_client_canonical_integrity_security()%' THEN
        RAISE EXCEPTION 'Migration 233 cannot register preview security coverage';
    END IF;
    EXECUTE replace(v_definition, 'test_client_canonical_integrity_security()',
        'test_client_canonical_integrity_security() AND test_accession_preview_client_resolution_security()');
    IF NOT public.test_accession_preview_client_resolution_security() THEN
        RAISE EXCEPTION 'Migration 233 preview RPC security verification failed';
    END IF;
    SELECT bool_and(passed) INTO v_passed FROM public.run_security_tests();
    IF v_passed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 233 security verification failed';
    END IF;
END;
$register_and_verify$;
COMMIT;
