-- Rollback-only behavioral fixtures for migration 233. SOURCE ONLY: NOT RUN here.
-- Requires authorized home-server psql execution and a configured assay/sample
-- pair for the restricted-client fixture. Never disables RLS or business triggers.
-- Tests use synthetic identities only; SQL behavior/security remains INCOMPLETE
-- until these execute successfully, followed by run_security_tests().
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path TO public, pg_temp;

CREATE FUNCTION pg_temp.assert_preview(p_condition BOOLEAN, p_message TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF p_condition IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'preview assertion failed: %', p_message; END IF;
END;
$$;
CREATE FUNCTION pg_temp.preview_client(p_row INTEGER, p_name TEXT, p_identity TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE sql AS $$
    SELECT jsonb_build_object('row', p_row, 'name', p_name, 'dateOfBirth', '2001-02-03',
        'governmentIdentityType', CASE WHEN p_identity IS NOT NULL THEN 'cccd' END,
        'governmentIdentityValue', p_identity, 'gender', NULL, 'phone', p_phone,
        'address', NULL, 'healthInsuranceNum', NULL, 'expiryDate', NULL);
$$;
CREATE FUNCTION pg_temp.expect_preview_denied(p_clients JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.resolve_accession_preview_clients_v1(p_clients);
    RAISE EXCEPTION 'preview unexpectedly authorized';
EXCEPTION WHEN insufficient_privilege THEN RETURN;
END;
$$;

DO $fixtures$
DECLARE
    v_analyst UUID := '95390000-0000-0000-0000-000000000001';
    v_manager UUID := '95390000-0000-0000-0000-000000000002';
    v_missing UUID := '95390000-0000-0000-0000-000000000003';
    v_first UUID := '95390000-0000-0000-0000-000000000010';
    v_second UUID := '95390000-0000-0000-0000-000000000011';
    v_inactive UUID := '95390000-0000-0000-0000-000000000012';
    v_hidden UUID := '95390000-0000-0000-0000-000000000013';
    v_legacy UUID := '95390000-0000-0000-0000-000000000014';
    v_actor UUID;
    v_data JSONB;
    v_bad JSONB;
    v_input JSONB;
    v_row JSONB;
    v_resolution RECORD;
    v_assay UUID;
    v_type UUID;
    v_type_name TEXT;
    v_before BIGINT[];
    v_after BIGINT[];
BEGIN
    INSERT INTO auth.users(id, email) VALUES (v_analyst, 'preview233-analyst@lims.local'),
        (v_manager, 'preview233-manager@lims.local'), (v_missing, 'preview233-missing@lims.local');
    INSERT INTO public.users(id, username, full_name, role, email, can_access_confidential)
    VALUES (v_analyst, 'preview233_analyst', 'Synthetic preview analyst', 'analyst', 'preview233-analyst@lims.local', FALSE),
        (v_manager, 'preview233_manager', 'Synthetic preview manager', 'manager', 'preview233-manager@lims.local', TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_manager::TEXT, TRUE);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_manager, 'role', 'authenticated')::TEXT, TRUE);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);
    INSERT INTO public.clients(id, id_card_num, name, date_of_birth, gender, phone, address)
    VALUES (v_first, '953900000010', 'Preview233 Existing Distinct', '2001-02-03', 'Nam', '0953900010', 'Fixture'),
        (v_second, '953900000011', 'Preview233 Existing Distinct', '2001-02-03', 'Nữ', '0953900011', 'Fixture'),
        (v_hidden, '953900000013', 'Preview233 Restricted', '2001-02-03', 'Nam', '0953900013', 'Fixture'),
        (v_legacy, '953900000014', 'Preview233 Legacy', '2001-02-03', 'Khác', '02812345678', 'Fixture');
    INSERT INTO public.clients(id, id_card_num, name, date_of_birth, gender, phone, deleted_at, deleted_by, deletion_reason)
    VALUES (v_inactive, '953900000012', 'Preview233 Inactive', '2001-02-03', 'Nam', '0953900012', clock_timestamp(), v_manager, 'Fixture');
    INSERT INTO public.client_collision_adjudications(client_id, related_client_id, collision_type, disposition,
        reason, client_updated_at, related_client_updated_at, evidence, adjudicated_by)
    SELECT first_client.id, second_client.id, 'name_date_of_birth', 'confirmed_distinct',
        'Synthetic preview regression', first_client.updated_at, second_client.updated_at,
        '{"source":"preview233-fixture"}'::JSONB, v_manager
    FROM public.clients AS first_client JOIN public.clients AS second_client ON second_client.id = v_second
    WHERE first_client.id = v_first;

    SELECT compatibility.assay_definition_id, compatibility.sample_type_id, sample_type.name
    INTO v_assay, v_type, v_type_name
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_sample_type_reviews AS review ON review.revision_id = compatibility.revision_id
        AND review.assay_definition_id = compatibility.assay_definition_id AND review.disposition = 'configured'
    JOIN public.assay_definitions AS assay ON assay.id = compatibility.assay_definition_id
        AND assay.deleted_at IS NULL AND NOT assay.is_confidential
    JOIN public.sample_types AS sample_type ON sample_type.id = compatibility.sample_type_id AND sample_type.deleted_at IS NULL
    WHERE compatibility.removed_at IS NULL
        AND compatibility.assay_compatibility_generation = assay.compatibility_generation
        AND compatibility.sample_type_compatibility_generation = sample_type.compatibility_generation
    LIMIT 1;
    PERFORM pg_temp.assert_preview(v_assay IS NOT NULL, 'restricted fixture requires configured assay/sample pair');
    INSERT INTO public.samples(id, sample_id, client_id, client_name, status, received_by, sample_type_id, type, sample_quality)
    VALUES ('95390000-0000-0000-0000-000000000020', 'PREVIEW233-RESTRICTED', v_hidden,
        'Preview233 Restricted', 'review', v_analyst, v_type, v_type_name, TRUE);
    INSERT INTO public.results(id, sample_id, assay_id, value, status, entered_by, entered_at)
    VALUES ('95390000-0000-0000-0000-000000000030', '95390000-0000-0000-0000-000000000020', v_assay, '1', 'pending', v_analyst, clock_timestamp());
    UPDATE public.assay_definitions SET is_confidential = TRUE WHERE id = v_assay;

    SELECT ARRAY[(SELECT count(*) FROM public.clients), (SELECT count(*) FROM public.samples),
        (SELECT count(*) FROM public.results), (SELECT count(*) FROM public.audit_logs)] INTO v_before;
    -- SQL grants and profile roles are independent boundaries, including NULL role.
    FOREACH v_actor IN ARRAY ARRAY[v_manager, v_missing, NULL::UUID] LOOP
        PERFORM set_config('request.jwt.claim.sub', COALESCE(v_actor::TEXT, ''), TRUE);
        PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated')::TEXT, TRUE);
        EXECUTE 'SET LOCAL ROLE authenticated';
        PERFORM pg_temp.expect_preview_denied(jsonb_build_array(pg_temp.preview_client(4, 'Preview233 New')));
        EXECUTE 'RESET ROLE';
    END LOOP;
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM pg_temp.expect_preview_denied('[]');
    EXECUTE 'RESET ROLE';
    EXECUTE 'SET LOCAL ROLE service_role';
    PERFORM pg_temp.expect_preview_denied('[]');
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_analyst::TEXT, TRUE);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_analyst, 'role', 'authenticated')::TEXT, TRUE);
    EXECUTE 'SET LOCAL ROLE authenticated';

    v_input := pg_temp.preview_client(4, U&'  Nguy\1EC5n   Preview233 Canonical  ', '953900000101', '+84953900101');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(v_input));
    PERFORM pg_temp.assert_preview(v_data->0->'input'->>'name' = public.normalize_client_name_v1(v_input->>'name')
        AND v_data->0->'input'->>'phone' = public.normalize_client_phone_v1(v_input->>'phone')
        AND v_data->0->'resolution'->>'outcome' = 'not_found', '215 normalizer parity without JS approximation');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(pg_temp.preview_client(4, 'Preview233 Placeholder', NULL, '0000000000')));
    PERFORM pg_temp.assert_preview(v_data->0->'input'->'phone' = 'null'::JSONB, 'placeholder is missing, not creation phone');

    -- No-typed-input legacy reuse exposes trusted projection only after an authorized match.
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(pg_temp.preview_client(4, 'Preview233 Legacy')));
    PERFORM pg_temp.assert_preview(v_data->0->'resolution'->>'clientId' = v_legacy::TEXT
        AND v_data->0->'trustedIdentity'->>'value' = '953900000014'
        AND v_data->0->'input'->'governmentIdentityValue' = 'null'::JSONB
        AND v_data->0->'displayValues'->>'phone' = '02812345678', 'legacy match has trusted projection without changing input or validating existing phone as new');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(pg_temp.preview_client(4, 'Preview233 Legacy'),
        pg_temp.preview_client(7, 'Preview233 Legacy', '953900000014')));
    PERFORM pg_temp.assert_preview(v_data->0->'issues'->0->>'code' = 'CLIENT_DUPLICATE', 'legacy no-typed-input and typed reference detect same UUID');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(pg_temp.preview_client(4, 'Preview233 Restricted')));
    PERFORM pg_temp.assert_preview(v_data->0->'resolution'->>'reasonCode' = 'identity_conflict'
        AND v_data->0->'trustedIdentity' = 'null'::JSONB AND v_data->0->'displayValues' = 'null'::JSONB,
        'restricted candidate is non-disclosing');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(pg_temp.preview_client(4, 'Preview233 Inactive', '953900000012')));
    PERFORM pg_temp.assert_preview(v_data->0->'resolution'->>'reasonCode' = 'inactive_candidate', 'inactive reservation rejects');

    v_input := pg_temp.preview_client(4, 'Preview233 Existing Distinct', '953900000010');
    SELECT * INTO v_resolution FROM public.resolve_client_identity_v2('cccd', '953900000010', 'Preview233 Existing Distinct', DATE '2001-02-03', NULL);
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(v_input,
        pg_temp.preview_client(7, 'Preview233 Existing Distinct', '953900000011')));
    PERFORM pg_temp.assert_preview(v_data->0->'resolution'->>'clientId' = v_resolution.client_id::TEXT
        AND v_data->0->'issues' = '[]'::JSONB AND v_data->1->'issues' = '[]'::JSONB,
        'v2-permitted confirmed-distinct same name DOB UUIDs remain distinct');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(v_input, v_input || '{"row":7}'));
    PERFORM pg_temp.assert_preview(v_data->0->'issues'->0->>'code' = 'CLIENT_DUPLICATE'
        AND v_data->1->'issues'->0->>'code' = 'CLIENT_DUPLICATE', 'same active UUID duplicate at all rows');

    v_input := pg_temp.preview_client(4, 'Preview233 New Identity', '953900000102', '0953900102');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(v_input, v_input || '{"row":7}'));
    PERFORM pg_temp.assert_preview(v_data->0->'issues'->0->>'code' = 'CLIENT_DUPLICATE'
        AND v_data->1->'issues'->0->>'code' = 'CLIENT_DUPLICATE', 'two not_found trusted identity inputs cannot both create');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(v_input, v_input || '{"row":7,"name":"Preview233 Different Evidence"}'));
    PERFORM pg_temp.assert_preview(v_data->0->'issues'->0->>'code' = 'CLIENT_CONFLICT'
        AND v_data->1->'issues'->0->>'code' = 'CLIENT_CONFLICT', 'same identity with different name conflicts');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(v_input, v_input || '{"row":7,"dateOfBirth":"2002-02-03"}'));
    PERFORM pg_temp.assert_preview(v_data->0->'issues'->0->>'code' = 'CLIENT_CONFLICT', 'same identity different DOB conflicts');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(v_input, v_input || '{"row":7,"phone":"0953900103"}'));
    PERFORM pg_temp.assert_preview(v_data->0->'issues'->0->>'code' = 'CLIENT_CONFLICT', 'same identity different supplied phone conflicts');

    -- Conflict takes precedence across groups; relatedRows is a bounded group witness.
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(v_input, v_input || '{"row":7}',
        pg_temp.preview_client(9, 'Preview233 Other Key', '953900000103', '0953900102')));
    FOR v_row IN SELECT value FROM jsonb_array_elements(v_data) LOOP
        PERFORM pg_temp.assert_preview(v_row->'issues'->0->>'code' = 'CLIENT_CONFLICT'
            AND jsonb_array_length(v_row->'issues'->0->'relatedRows') = 1, 'three-row cross-key conflict wins over duplicate');
    END LOOP;
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(
        pg_temp.preview_client(4, 'Preview233 Weak Same'), pg_temp.preview_client(7, 'Preview233 Weak Same')));
    PERFORM pg_temp.assert_preview(v_data->0->'issues'->0->>'code' = 'CLIENT_CONFLICT', 'name DOB is conflict signal, not duplicate proof');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(
        pg_temp.preview_client(4, U&'Preview233 Nguy\1EC5n Accent', '953900000104'),
        pg_temp.preview_client(7, 'Preview233 Nguyen Accent', '953900000105')));
    PERFORM pg_temp.assert_preview(v_data->0->'issues'->0->>'reasonCode' = 'accent_only_conflict', 'accent-only collision blocks proposed creates');
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(
        pg_temp.preview_client(4, 'Preview233 New Distinct One', '953900000106', '0953900106'),
        pg_temp.preview_client(7, 'Preview233 New Distinct Two', '953900000107', '0953900107')));
    PERFORM pg_temp.assert_preview(v_data->0->'issues' = '[]'::JSONB AND v_data->1->'issues' = '[]'::JSONB, 'safe distinct identities remain distinct');

    FOR v_bad IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
        v_input || '{"address":123}', v_input || '{"gender":"invalid"}', v_input || '{"expiryDate":"2001-02-30"}',
        v_input || '{"phone":"123"}', v_input || '{"owner":"forged"}', v_input || '{"governmentIdentityType":null}')) LOOP
        BEGIN
            PERFORM public.resolve_accession_preview_clients_v1(jsonb_build_array(v_bad));
            RAISE EXCEPTION 'malformed JSON input unexpectedly accepted';
        EXCEPTION WHEN invalid_parameter_value THEN NULL;
        END;
    END LOOP;
    EXECUTE 'RESET ROLE';
    -- No proposed not_found row became a business client.
    v_data := public.resolve_accession_preview_clients_v1(jsonb_build_array(pg_temp.preview_client(4, 'Preview233 New Identity', '953900000102')));
    PERFORM pg_temp.assert_preview(v_data->0->'resolution'->>'outcome' = 'not_found', 'preview did not create its not_found client');
    SELECT ARRAY[(SELECT count(*) FROM public.clients), (SELECT count(*) FROM public.samples),
        (SELECT count(*) FROM public.results), (SELECT count(*) FROM public.audit_logs)] INTO v_after;
    PERFORM pg_temp.assert_preview(v_before = v_after, 'no business/audit writes or source retention from read-only bridge');
    PERFORM pg_temp.assert_preview(public.test_accession_preview_client_resolution_security(), 'closed grants/STABLE/owner/search_path');
END;
$fixtures$;
ROLLBACK;
