-- Rollback-only runtime coverage for Phase 6 client-resolution caller cutover.
-- Proves that client resolution and sample/result mutation share one transaction.

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE FUNCTION pg_temp.assert_client_resolution_cutover(
    p_condition BOOLEAN,
    p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT COALESCE(p_condition, FALSE) THEN
        RAISE EXCEPTION 'client cutover assertion failed: %', p_message;
    END IF;
END;
$$;

DO $contract$
BEGIN
    IF to_regprocedure(
        'public.create_sample_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,uuid,boolean,bigint)'
    ) IS NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,jsonb,uuid,boolean,bigint)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 228 transactional client/sample RPCs are missing';
    END IF;
END;
$contract$;

DO $cutover$
DECLARE
    v_analyst_id UUID := '95360000-0000-0000-0000-000000000001';
    v_existing_client_id UUID :=
        '95360000-0000-0000-0000-000000000010';
    v_inactive_client_id UUID :=
        '95360000-0000-0000-0000-000000000011';
    v_restricted_client_id UUID :=
        '95360000-0000-0000-0000-000000000012';
    v_ambiguous_client_a_id UUID :=
        '95360000-0000-0000-0000-000000000030';
    v_ambiguous_client_b_id UUID :=
        '95360000-0000-0000-0000-000000000031';
    v_restricted_sample_id UUID :=
        '95360000-0000-0000-0000-000000000020';
    v_restricted_result_id UUID :=
        '95360000-0000-0000-0000-000000000021';
    v_assay_id UUID;
    v_sample_type_id UUID;
    v_sample_type_name TEXT;
    v_revision_number BIGINT;
    v_envelope JSONB;
    v_created_client_id UUID;
    v_created_sample_id UUID;
    v_accession_sample_id UUID;
    v_clients_before BIGINT;
    v_samples_before BIGINT;
    v_results_before BIGINT;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES (
        v_analyst_id,
        'issue111-phase6-cutover-analyst@lims.local'
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
    VALUES (
        v_analyst_id,
        'issue111_phase6_cutover_analyst',
        'Issue 111 Phase 6 Cutover Analyst',
        'analyst',
        'issue111-phase6-cutover-analyst@lims.local',
        FALSE,
        NULL
    );

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_analyst_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        v_analyst_id::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.role',
        'authenticated',
        TRUE
    );

    SELECT
        compatibility.assay_definition_id,
        compatibility.sample_type_id,
        sample_type.name,
        revision.revision_number
    INTO
        v_assay_id,
        v_sample_type_id,
        v_sample_type_name,
        v_revision_number
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_sample_type_catalog_revisions AS revision
      ON revision.id = compatibility.revision_id
     AND revision.status = 'published'
    JOIN public.assay_sample_type_reviews AS review
      ON review.revision_id = compatibility.revision_id
     AND review.assay_definition_id =
            compatibility.assay_definition_id
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
    ORDER BY compatibility.created_at, compatibility.id
    LIMIT 1;

    PERFORM pg_temp.assert_client_resolution_cutover(
        v_assay_id IS NOT NULL
            AND v_sample_type_id IS NOT NULL
            AND v_revision_number IS NOT NULL,
        'test requires one published compatible assay/sample-type pair'
    );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address,
        deleted_at,
        deleted_by,
        deletion_reason
    )
    VALUES
        (
            v_existing_client_id,
            '953600000010',
            'Nguyễn Văn Phase Sáu',
            DATE '1990-06-10',
            'Nam',
            '0953600010',
            'Địa chỉ gốc không được ghi đè',
            NULL,
            NULL,
            NULL
        ),
        (
            v_inactive_client_id,
            '953600000011',
            'Trần Thị Ngừng Hoạt Động',
            DATE '1989-06-11',
            'Nữ',
            '0953600011',
            'Rollback fixture',
            clock_timestamp(),
            v_analyst_id,
            'Ngừng hoạt động cho kiểm thử Phase 6'
        ),
        (
            v_restricted_client_id,
            '953600000012',
            'Phạm Văn Bảo Mật',
            DATE '1988-06-12',
            'Khác',
            '0953600012',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_ambiguous_client_a_id,
            NULL,
            'Đặng Thị Song Sinh',
            DATE '1992-06-14',
            'Nữ',
            '0953600030',
            'Rollback fixture A',
            NULL,
            NULL,
            NULL
        ),
        (
            v_ambiguous_client_b_id,
            NULL,
            'ĐẶNG THỊ SONG SINH',
            DATE '1992-06-14',
            'Nữ',
            '0953600031',
            'Rollback fixture B',
            NULL,
            NULL,
            NULL
        );

    v_envelope :=
        public.create_sample_with_client_resolution_v2(
            FALSE,
            'cccd',
            '953600000010',
            '  Nguyễn   Văn Phase Sáu ',
            DATE '1990-06-10',
            NULL,
            '0953600010',
            'Địa chỉ bị bỏ qua',
            NULL,
            NULL,
            NULL,
            v_sample_type_id,
            TRUE,
            v_revision_number
        );

    v_created_sample_id := (v_envelope #>> '{sample,id}')::UUID;
    PERFORM pg_temp.assert_client_resolution_cutover(
        v_envelope #>> '{resolution,outcome}' = 'matched'
            AND v_envelope #>> '{resolution,reason_code}' =
                'trusted_identity_match'
            AND (v_envelope #>> '{resolution,client_id}')::UUID =
                v_existing_client_id
            AND (v_envelope #>> '{resolution,created}')::BOOLEAN = FALSE
            AND v_created_sample_id IS NOT NULL,
        'matched existing client must create one sample'
    );
    PERFORM pg_temp.assert_client_resolution_cutover(
        (
            SELECT client.name = 'Nguyễn Văn Phase Sáu'
                AND client.address =
                    'Địa chỉ gốc không được ghi đè'
                AND client.phone = '0953600010'
            FROM public.clients AS client
            WHERE client.id = v_existing_client_id
        ),
        'matched client identity and profile fields must remain unchanged'
    );
    PERFORM pg_temp.assert_client_resolution_cutover(
        (
            SELECT sample.client_id = v_existing_client_id
                AND sample.client_name = 'Nguyễn Văn Phase Sáu'
                AND sample.status = 'received'
            FROM public.samples AS sample
            WHERE sample.id = v_created_sample_id
        ),
        'sample must use the locked database client name'
    );

    SELECT count(*) INTO v_clients_before FROM public.clients;
    SELECT count(*) INTO v_samples_before FROM public.samples;
    SELECT count(*) INTO v_results_before FROM public.results;

    v_envelope :=
        public.create_sample_with_client_resolution_v2(
            FALSE,
            'cccd',
            '953600009999',
            'Khách Hàng Chưa Tồn Tại',
            DATE '1995-06-13',
            NULL,
            '0953699999',
            NULL,
            NULL,
            NULL,
            NULL,
            v_sample_type_id,
            TRUE,
            v_revision_number
        );
    PERFORM pg_temp.assert_client_resolution_cutover(
        v_envelope #>> '{resolution,outcome}' = 'not_found'
            AND v_envelope->'sample' = 'null'::JSONB
            AND (SELECT count(*) FROM public.clients) =
                v_clients_before
            AND (SELECT count(*) FROM public.samples) =
                v_samples_before
            AND (SELECT count(*) FROM public.results) =
                v_results_before,
        'lookup-only not_found must not create a client, sample, or result'
    );

    v_envelope :=
        public.create_sample_with_client_resolution_v2(
            FALSE,
            NULL,
            NULL,
            '  đặng thị song sinh ',
            DATE '1992-06-14',
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            v_sample_type_id,
            TRUE,
            v_revision_number
        );
    PERFORM pg_temp.assert_client_resolution_cutover(
        v_envelope #>> '{resolution,outcome}' = 'ambiguous'
            AND v_envelope #>> '{resolution,client_id}' IS NULL
            AND v_envelope->'sample' = 'null'::JSONB
            AND (SELECT count(*) FROM public.clients) =
                v_clients_before
            AND (SELECT count(*) FROM public.samples) =
                v_samples_before
            AND (SELECT count(*) FROM public.results) =
                v_results_before,
        'ambiguous canonical candidates must remain mutation-free'
    );

    v_envelope :=
        public.create_sample_with_client_resolution_v2(
            TRUE,
            'cccd',
            '953600000010',
            'Tên Mâu Thuẫn',
            DATE '1970-01-01',
            'Nam',
            '0953600010',
            'Địa chỉ bị bỏ qua',
            NULL,
            NULL,
            NULL,
            v_sample_type_id,
            TRUE,
            v_revision_number
        );
    PERFORM pg_temp.assert_client_resolution_cutover(
        v_envelope #>> '{resolution,outcome}' = 'conflict'
            AND v_envelope->'sample' = 'null'::JSONB
            AND (SELECT count(*) FROM public.clients) =
                v_clients_before
            AND (SELECT count(*) FROM public.samples) =
                v_samples_before
            AND (SELECT count(*) FROM public.results) =
                v_results_before,
        'conflict must not create or update any client, sample, or result'
    );

    v_envelope :=
        public.create_sample_with_client_resolution_v2(
            FALSE,
            'cccd',
            '953600000011',
            'Trần Thị Ngừng Hoạt Động',
            DATE '1989-06-11',
            NULL,
            '0953600011',
            NULL,
            NULL,
            NULL,
            NULL,
            v_sample_type_id,
            TRUE,
            v_revision_number
        );
    PERFORM pg_temp.assert_client_resolution_cutover(
        v_envelope #>> '{resolution,outcome}' = 'conflict'
            AND v_envelope #>> '{resolution,reason_code}' =
                'inactive_candidate'
            AND v_envelope->'sample' = 'null'::JSONB
            AND (SELECT count(*) FROM public.clients) =
                v_clients_before
            AND (SELECT count(*) FROM public.samples) =
                v_samples_before
            AND (SELECT count(*) FROM public.results) =
                v_results_before,
        'inactive candidate must fail closed without mutation'
    );

    v_envelope :=
        public.create_sample_with_client_resolution_v2(
            TRUE,
            'cccd',
            '953600000013',
            'Lê Thị Khách Hàng Mới',
            DATE '1994-06-13',
            'Nữ',
            '0953600013',
            'Địa chỉ tạo mới',
            'BHYT-PHASE6',
            DATE '2030-12-31',
            NULL,
            v_sample_type_id,
            TRUE,
            v_revision_number
        );
    v_created_client_id :=
        (v_envelope #>> '{resolution,client_id}')::UUID;
    v_created_sample_id := (v_envelope #>> '{sample,id}')::UUID;
    PERFORM pg_temp.assert_client_resolution_cutover(
        v_envelope #>> '{resolution,outcome}' = 'matched'
            AND (v_envelope #>> '{resolution,created}')::BOOLEAN
            AND v_created_client_id IS NOT NULL
            AND v_created_sample_id IS NOT NULL
            AND (SELECT count(*) FROM public.clients) =
                v_clients_before + 1
            AND (SELECT count(*) FROM public.samples) =
                v_samples_before + 1,
        'allow-create not_found must atomically create one client and sample'
    );
    PERFORM pg_temp.assert_client_resolution_cutover(
        (
            SELECT sample.client_id = v_created_client_id
                AND sample.client_name = client.name
            FROM public.samples AS sample
            JOIN public.clients AS client
              ON client.id = sample.client_id
            WHERE sample.id = v_created_sample_id
        ),
        'new sample must use the locked created client name'
    );
    PERFORM pg_temp.assert_client_resolution_cutover(
        EXISTS (
            SELECT 1
            FROM public.audit_logs
            WHERE table_name = 'clients'
              AND record_id = v_created_client_id
              AND operation = 'CLIENT_CREATED_V2'
              AND changed_by = v_analyst_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.audit_logs
            WHERE table_name = 'samples'
              AND record_id = v_created_sample_id
              AND operation = 'INSERT'
              AND changed_by = v_analyst_id
        ),
        'atomic client and sample creation must preserve audit attribution'
    );

    v_envelope :=
        public.accession_and_assign_tests_with_client_resolution_v2(
            FALSE,
            'cccd',
            '953600000010',
            'Nguyễn Văn Phase Sáu',
            DATE '1990-06-10',
            NULL,
            '0953600010',
            NULL,
            NULL,
            NULL,
            NULL,
            jsonb_build_array(
                jsonb_build_object(
                    'assayId', v_assay_id::TEXT,
                    'methodId', ''
                )
            ),
            v_sample_type_id,
            TRUE,
            v_revision_number
        );
    v_accession_sample_id :=
        (v_envelope #>> '{accession,sample,id}')::UUID;
    PERFORM pg_temp.assert_client_resolution_cutover(
        v_envelope #>> '{resolution,outcome}' = 'matched'
            AND v_accession_sample_id IS NOT NULL
            AND jsonb_array_length(
                v_envelope #> '{accession,results}'
            ) = 1
            AND (
                SELECT sample.status = 'assigned'
                    AND sample.client_name =
                        'Nguyễn Văn Phase Sáu'
                FROM public.samples AS sample
                WHERE sample.id = v_accession_sample_id
            )
            AND (
                SELECT count(*)
                FROM public.results AS result
                WHERE result.sample_id = v_accession_sample_id
            ) = 1,
        'accession must atomically create the sample and pending result'
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
    VALUES (
        v_restricted_sample_id,
        'ISSUE111-P6-RESTRICTED',
        v_restricted_client_id,
        'Phạm Văn Bảo Mật',
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
        status,
        entered_by,
        entered_at
    )
    VALUES (
        v_restricted_result_id,
        v_restricted_sample_id,
        v_assay_id,
        'pending',
        v_analyst_id,
        clock_timestamp()
    );

    UPDATE public.assay_definitions
    SET is_confidential = TRUE
    WHERE id = v_assay_id;

    SELECT count(*) INTO v_clients_before FROM public.clients;
    SELECT count(*) INTO v_samples_before FROM public.samples;
    SELECT count(*) INTO v_results_before FROM public.results;

    v_envelope :=
        public.create_sample_with_client_resolution_v2(
            FALSE,
            'cccd',
            '953600000012',
            'Phạm Văn Bảo Mật',
            DATE '1988-06-12',
            NULL,
            '0953600012',
            NULL,
            NULL,
            NULL,
            NULL,
            v_sample_type_id,
            TRUE,
            v_revision_number
        );
    PERFORM pg_temp.assert_client_resolution_cutover(
        v_envelope #>> '{resolution,outcome}' = 'conflict'
            AND v_envelope #>> '{resolution,reason_code}' =
                'restricted_candidate'
            AND v_envelope #>> '{resolution,client_id}' IS NULL
            AND v_envelope->'sample' = 'null'::JSONB
            AND (SELECT count(*) FROM public.clients) =
                v_clients_before
            AND (SELECT count(*) FROM public.samples) =
                v_samples_before
            AND (SELECT count(*) FROM public.results) =
                v_results_before,
        'restricted client must remain non-disclosing and mutation-free'
    );
END;
$cutover$;

ROLLBACK;

\echo 'client-resolution caller cutover rollback test passed'
