-- Rollback-only authorization and confidentiality coverage for resolver v2.
-- Restricted candidates always return a non-disclosing conflict with no UUID.

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE FUNCTION pg_temp.assert_client_resolution_security(
    p_condition BOOLEAN,
    p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT COALESCE(p_condition, FALSE) THEN
        RAISE EXCEPTION 'client resolver security assertion failed: %',
            p_message;
    END IF;
END;
$$;

DO $security$
DECLARE
    v_analyst_id UUID := '95320000-0000-0000-0000-000000000001';
    v_manager_id UUID := '95320000-0000-0000-0000-000000000002';
    v_doctor_id UUID := '95320000-0000-0000-0000-000000000003';
    v_missing_profile_id UUID :=
        '95320000-0000-0000-0000-000000000004';
    v_visible_client_id UUID := '95320000-0000-0000-0000-000000000010';
    v_restricted_client_id UUID := '95320000-0000-0000-0000-000000000011';
    v_restricted_only_id UUID := '95320000-0000-0000-0000-000000000012';
    v_sample_id UUID := '95320000-0000-0000-0000-000000000020';
    v_sample_only_id UUID := '95320000-0000-0000-0000-000000000021';
    v_result_id UUID := '95320000-0000-0000-0000-000000000030';
    v_result_only_id UUID := '95320000-0000-0000-0000-000000000031';
    v_assay_id UUID;
    v_sample_type_id UUID;
    v_sample_type_name TEXT;
    v_result RECORD;
    v_doctor_denied BOOLEAN := FALSE;
    v_missing_profile_read_denied BOOLEAN := FALSE;
    v_missing_profile_create_denied BOOLEAN := FALSE;
    v_client_count_before BIGINT;
    v_audit_count_before BIGINT;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_analyst_id, 'issue111-phase4-security-analyst@lims.local'),
        (v_manager_id, 'issue111-phase4-security-manager@lims.local'),
        (v_doctor_id, 'issue111-phase4-security-doctor@lims.local'),
        (
            v_missing_profile_id,
            'issue111-phase4-security-missing-profile@lims.local'
        );

    INSERT INTO public.users (
        id,
        username,
        full_name,
        role,
        email,
        can_access_confidential,
        deleted_at
    )
    VALUES
        (
            v_analyst_id,
            'issue111_phase4_security_analyst',
            'Issue 111 Phase 4 Security Analyst',
            'analyst',
            'issue111-phase4-security-analyst@lims.local',
            FALSE,
            NULL
        ),
        (
            v_manager_id,
            'issue111_phase4_security_manager',
            'Issue 111 Phase 4 Security Manager',
            'manager',
            'issue111-phase4-security-manager@lims.local',
            FALSE,
            NULL
        ),
        (
            v_doctor_id,
            'issue111_phase4_security_doctor',
            'Issue 111 Phase 4 Security Doctor',
            'doctor',
            'issue111-phase4-security-doctor@lims.local',
            TRUE,
            NULL
        );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address
    )
    VALUES
        (
            v_visible_client_id,
            '',
            'Mixed Visibility Candidate',
            DATE '1990-02-10',
            'Nam',
            '0953200010',
            'Rollback fixture'
        ),
        (
            v_restricted_client_id,
            '',
            '  mixed visibility candidate ',
            DATE '1990-02-10',
            'Nữ',
            '0953200011',
            'Rollback fixture'
        ),
        (
            v_restricted_only_id,
            '953200000012',
            'Restricted Strong Candidate',
            DATE '1990-02-12',
            'Khác',
            '0953200012',
            'Rollback fixture'
        );

    SELECT
        compatibility.assay_definition_id,
        compatibility.sample_type_id,
        sample_type.name
    INTO
        v_assay_id,
        v_sample_type_id,
        v_sample_type_name
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_sample_type_catalog_revisions AS revision
      ON revision.id = compatibility.revision_id
     AND revision.status = 'published'
    JOIN public.assay_sample_type_reviews AS review
      ON review.revision_id = compatibility.revision_id
     AND review.assay_definition_id = compatibility.assay_definition_id
     AND review.disposition = 'configured'
    JOIN public.assay_definitions AS assay_definition
      ON assay_definition.id = compatibility.assay_definition_id
     AND assay_definition.deleted_at IS NULL
     AND NOT assay_definition.is_confidential
    JOIN public.sample_types AS sample_type
      ON sample_type.id = compatibility.sample_type_id
     AND sample_type.deleted_at IS NULL
    WHERE compatibility.removed_at IS NULL
      AND compatibility.assay_compatibility_generation =
          assay_definition.compatibility_generation
      AND compatibility.sample_type_compatibility_generation =
          sample_type.compatibility_generation
    ORDER BY compatibility.created_at
    LIMIT 1;

    PERFORM pg_temp.assert_client_resolution_security(
        v_assay_id IS NOT NULL AND v_sample_type_id IS NOT NULL,
        'restricted fixture requires one configured assay/sample-type pair'
    );

    INSERT INTO public.samples (
        id,
        sample_id,
        client_id,
        client_name,
        status,
        received_by,
        sample_type_id,
        type,
        sample_quality
    )
    VALUES
        (
            v_sample_id,
            'ISSUE111-P4-RESTRICTED-MIXED',
            v_restricted_client_id,
            'Mixed Visibility Candidate',
            'review',
            v_analyst_id,
            v_sample_type_id,
            v_sample_type_name,
            TRUE
        ),
        (
            v_sample_only_id,
            'ISSUE111-P4-RESTRICTED-ONLY',
            v_restricted_only_id,
            'Restricted Strong Candidate',
            'review',
            v_analyst_id,
            v_sample_type_id,
            v_sample_type_name,
            TRUE
        );

    INSERT INTO public.results (
        id,
        sample_id,
        assay_id,
        value,
        status,
        entered_by,
        entered_at
    )
    VALUES
        (
            v_result_id,
            v_sample_id,
            v_assay_id,
            '1',
            'pending',
            v_analyst_id,
            clock_timestamp()
        ),
        (
            v_result_only_id,
            v_sample_only_id,
            v_assay_id,
            '1',
            'pending',
            v_analyst_id,
            clock_timestamp()
        );

    UPDATE public.assay_definitions
    SET is_confidential = TRUE
    WHERE id = v_assay_id;

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_analyst_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, TRUE);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        '953200000012',
        'Restricted Strong Candidate',
        DATE '1990-02-12',
        '0953200012'
    );
    PERFORM pg_temp.assert_client_resolution_security(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'restricted_candidate'
            AND v_result.client_id IS NULL,
        'confidential-only candidate must be non-disclosing'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        NULL,
        NULL,
        'Mixed Visibility Candidate',
        DATE '1990-02-10',
        NULL
    );
    PERFORM pg_temp.assert_client_resolution_security(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'restricted_candidate'
            AND v_result.client_id IS NULL,
        'mixed visible and restricted candidates must remain non-disclosing'
    );

    SELECT count(*) INTO v_client_count_before FROM public.clients;
    SELECT count(*) INTO v_audit_count_before FROM public.audit_logs;

    SELECT *
    INTO v_result
    FROM public.resolve_or_create_client_v2(
        'cccd',
        '953200000012',
        'Restricted Strong Candidate',
        DATE '1990-02-12',
        'Nam',
        '0953200012',
        'Restricted fixture',
        NULL,
        NULL
    );
    PERFORM pg_temp.assert_client_resolution_security(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'restricted_candidate'
            AND v_result.client_id IS NULL
            AND NOT v_result.created,
        'resolve-and-create must not disclose or create for a confidential-only candidate'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_or_create_client_v2(
        NULL,
        NULL,
        'Mixed Visibility Candidate',
        DATE '1990-02-10',
        'Nam',
        '0953299999',
        'Restricted fixture',
        NULL,
        NULL
    );
    PERFORM pg_temp.assert_client_resolution_security(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'restricted_candidate'
            AND v_result.client_id IS NULL
            AND NOT v_result.created,
        'resolve-and-create must not disclose or create for mixed visibility candidates'
    );
    PERFORM pg_temp.assert_client_resolution_security(
        (SELECT count(*) FROM public.clients) = v_client_count_before
            AND (SELECT count(*) FROM public.audit_logs) = v_audit_count_before,
        'restricted resolve-and-create paths must not mutate clients or audit logs'
    );

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_manager_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_manager_id::TEXT, TRUE);

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        '953200000012',
        'Restricted Strong Candidate',
        DATE '1990-02-12',
        '0953200012'
    );
    PERFORM pg_temp.assert_client_resolution_security(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'restricted_candidate'
            AND v_result.client_id IS NULL,
        'manager without confidential access must not receive a hidden UUID'
    );

    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = v_manager_id;

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        '953200000012',
        'Restricted Strong Candidate',
        DATE '1990-02-12',
        '0953200012'
    );
    PERFORM pg_temp.assert_client_resolution_security(
        v_result.outcome = 'matched'
            AND v_result.reason_code = 'trusted_identity_match'
            AND v_result.client_id = v_restricted_only_id,
        'authorized confidential access may receive the matched UUID'
    );

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_doctor_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_doctor_id::TEXT, TRUE);

    BEGIN
        PERFORM public.resolve_client_identity_v2(
            NULL,
            NULL,
            'No Candidate',
            DATE '1970-01-01',
            NULL
        );
    EXCEPTION
        WHEN SQLSTATE 'P1120' THEN
            v_doctor_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_resolution_security(
        v_doctor_denied,
        'doctor role must be denied by the resolver authorization boundary'
    );

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_missing_profile_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        v_missing_profile_id::TEXT,
        TRUE
    );

    BEGIN
        PERFORM public.resolve_client_identity_v2(
            NULL,
            NULL,
            'No Candidate',
            DATE '1970-01-01',
            NULL
        );
    EXCEPTION
        WHEN SQLSTATE 'P1120' THEN
            v_missing_profile_read_denied := TRUE;
    END;

    BEGIN
        PERFORM public.resolve_or_create_client_v2(
            NULL,
            NULL,
            'No Candidate',
            DATE '1970-01-01',
            'Khác',
            '0953299998',
            NULL,
            NULL,
            NULL
        );
    EXCEPTION
        WHEN SQLSTATE 'P1120' THEN
            v_missing_profile_create_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_resolution_security(
        v_missing_profile_read_denied
            AND v_missing_profile_create_denied,
        'authenticated users without profiles must be denied by both public RPCs'
    );

    PERFORM pg_temp.assert_client_resolution_security(
        has_function_privilege(
            'authenticated',
            'public.resolve_client_identity_v2(text,text,text,date,text)',
            'EXECUTE'
        )
        AND has_function_privilege(
            'authenticated',
            'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'authenticated',
            'public.resolve_client_identity_internal_v2(text,text,text,date,text)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            'public.resolve_client_identity_v2(text,text,text,date,text)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'service_role',
            'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)',
            'EXECUTE'
        ),
        'effective resolver grants must expose only public RPCs to authenticated'
    );
END;
$security$;

SELECT 'client-resolution-v2 security rollback tests passed' AS result;

ROLLBACK;
