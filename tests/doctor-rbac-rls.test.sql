-- DOCTOR RBAC RLS REGRESSION SUITE
-- Verifies the doctor role can only read completed samples and ready CoAs.
-- Usage: docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/doctor-rbac-rls.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'DOCTOR RBAC RLS TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

CREATE TEMP TABLE doctor_rbac_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_rbac_test_results TO authenticated;

DO $$
DECLARE
    v_confidential_assay_id UUID := '91111111-1111-1111-1111-111111111111';
    v_visible_assay_id UUID := '91111111-1111-1111-1111-111111111112';
    v_receiver_signature_id UUID := '90000000-0000-0000-0000-000000000004';
    v_manager_id UUID := '90000000-0000-0000-0000-000000000005';
    v_manager_signature_id UUID := '90000000-0000-0000-0000-000000000006';
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        ('90000000-0000-0000-0000-000000000001', 'doctor-standard@lims.local'),
        ('90000000-0000-0000-0000-000000000002', 'doctor-confidential@lims.local'),
        ('90000000-0000-0000-0000-000000000003', 'doctor-receiver@lims.local'),
        (v_manager_id, 'doctor-manager@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, username, full_name, role, can_access_confidential)
    VALUES
        ('90000000-0000-0000-0000-000000000001', 'doctor_standard', 'Doctor Standard', 'doctor', FALSE),
        ('90000000-0000-0000-0000-000000000002', 'doctor_confidential', 'Doctor Confidential', 'doctor', TRUE),
        ('90000000-0000-0000-0000-000000000003', 'doctor_receiver', 'Doctor Receiver', 'analyst', TRUE),
        (v_manager_id, 'doctor_manager', 'Doctor Manager', 'manager', FALSE)
    ON CONFLICT (id) DO UPDATE
    SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    INSERT INTO public.user_signatures (
        id,
        user_id,
        signature_path,
        signature_hash,
        file_size,
        mime_type,
        is_active
    )
    VALUES
        (
            v_receiver_signature_id,
            '90000000-0000-0000-0000-000000000003',
            'issue-90/doctor-receiver.png',
            encode(digest('issue-90-doctor-receiver', 'sha256'), 'hex'),
            1,
            'image/png',
            TRUE
        ),
        (
            v_manager_signature_id,
            v_manager_id,
            'issue-90/doctor-manager.png',
            encode(digest('issue-90-doctor-manager', 'sha256'), 'hex'),
            1,
            'image/png',
            TRUE
        );

    INSERT INTO public.assay_definitions (
        id,
        name,
        units,
        is_confidential,
        normal_range,
        method_name
    )
    VALUES
        (
            v_confidential_assay_id,
            'Doctor Confidential Assay',
            'copies/mL',
            TRUE,
            'Not detected',
            'Doctor Confidential Method'
        ),
        (
            v_visible_assay_id,
            'Doctor Visible Assay',
            'mg/L',
            FALSE,
            '1-10',
            'Doctor Visible Method'
        )
    ON CONFLICT (id) DO UPDATE
    SET
        name = EXCLUDED.name,
        units = EXCLUDED.units,
        is_confidential = EXCLUDED.is_confidential,
        normal_range = EXCLUDED.normal_range,
        method_name = EXCLUDED.method_name,
        deleted_at = NULL;

    INSERT INTO public.clients (id, id_card_num, name, date_of_birth, gender, phone)
    VALUES ('90000000-0000-0000-0000-000000000010', '079203009999', 'Doctor RBAC Patient', DATE '1990-01-01', 'Nam', '0909999999')
    ON CONFLICT (id) DO UPDATE
    SET
        id_card_num = EXCLUDED.id_card_num,
        name = EXCLUDED.name,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        phone = EXCLUDED.phone;

    INSERT INTO public.samples (
        id,
        sample_id,
        client_id,
        client_name,
        status,
        received_at,
        received_by,
        type,
        completed_at,
        sample_quality
    )
    VALUES
        (
            '90000000-0000-0000-0000-000000000101',
            'DR-COMPLETE-VISIBLE',
            '90000000-0000-0000-0000-000000000010',
            'Doctor RBAC Patient',
            'in_progress',
            TIMESTAMPTZ '2026-07-21 04:00:00+00',
            '90000000-0000-0000-0000-000000000003',
            'Máu',
            NULL,
            TRUE
        ),
        (
            '90000000-0000-0000-0000-000000000102',
            'DR-ASSIGNED-HIDDEN',
            '90000000-0000-0000-0000-000000000010',
            'Doctor RBAC Patient',
            'assigned',
            TIMESTAMPTZ '2026-07-21 04:01:00+00',
            '90000000-0000-0000-0000-000000000003',
            'Máu',
            NULL,
            TRUE
        ),
        (
            '90000000-0000-0000-0000-000000000103',
            'DR-COMPLETE-CONFIDENTIAL',
            '90000000-0000-0000-0000-000000000010',
            'Doctor RBAC Patient',
            'in_progress',
            TIMESTAMPTZ '2026-07-21 04:02:00+00',
            '90000000-0000-0000-0000-000000000003',
            'Máu',
            NULL,
            TRUE
        )
    ON CONFLICT (id) DO UPDATE
    SET
        sample_id = EXCLUDED.sample_id,
        client_id = EXCLUDED.client_id,
        client_name = EXCLUDED.client_name,
        status = EXCLUDED.status,
        received_at = EXCLUDED.received_at,
        received_by = EXCLUDED.received_by,
        type = EXCLUDED.type,
        completed_at = EXCLUDED.completed_at,
        sample_quality = TRUE,
        deleted_at = NULL;

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
            '90000000-0000-0000-0000-000000000201',
            '90000000-0000-0000-0000-000000000103',
            v_confidential_assay_id,
            'Reactive',
            'entered',
            '90000000-0000-0000-0000-000000000003',
            TIMESTAMPTZ '2026-07-21 04:06:00+00'
        ),
        (
            '90000000-0000-0000-0000-000000000202',
            '90000000-0000-0000-0000-000000000101',
            v_visible_assay_id,
            '5',
            'entered',
            '90000000-0000-0000-0000-000000000003',
            TIMESTAMPTZ '2026-07-21 04:05:00+00'
        )
    ON CONFLICT (id) DO UPDATE
    SET
        sample_id = EXCLUDED.sample_id,
        assay_id = EXCLUDED.assay_id,
        value = EXCLUDED.value,
        status = EXCLUDED.status,
        entered_by = EXCLUDED.entered_by,
        entered_at = EXCLUDED.entered_at,
        approved_by = NULL,
        approved_at = NULL;

    INSERT INTO public.sample_submissions (
        id,
        sample_id,
        user_id,
        signature_id,
        submitted_at,
        submission_number,
        signature_meaning
    )
    VALUES
        (
            '90000000-0000-0000-0000-000000000401',
            '90000000-0000-0000-0000-000000000101',
            '90000000-0000-0000-0000-000000000003',
            v_receiver_signature_id,
            TIMESTAMPTZ '2026-07-21 04:10:00+00',
            1,
            'I certify I performed these tests and entered these results accurately'
        ),
        (
            '90000000-0000-0000-0000-000000000402',
            '90000000-0000-0000-0000-000000000102',
            '90000000-0000-0000-0000-000000000003',
            v_receiver_signature_id,
            TIMESTAMPTZ '2026-07-21 04:11:00+00',
            1,
            'I certify I performed these tests and entered these results accurately'
        ),
        (
            '90000000-0000-0000-0000-000000000403',
            '90000000-0000-0000-0000-000000000103',
            '90000000-0000-0000-0000-000000000003',
            v_receiver_signature_id,
            TIMESTAMPTZ '2026-07-21 04:12:00+00',
            1,
            'I certify I performed these tests and entered these results accurately'
        );

    INSERT INTO public.result_reference_assessments (
        id,
        submission_id,
        result_id,
        assessment,
        assay_name,
        result_value,
        unit,
        method_name,
        reference_range,
        analyst_id
    )
    VALUES
        (
            '90000000-0000-0000-0000-000000000501',
            '90000000-0000-0000-0000-000000000401',
            '90000000-0000-0000-0000-000000000202',
            'within_reference_range',
            'Doctor Visible Assay',
            '5',
            'mg/L',
            'Doctor Visible Method',
            '1-10',
            '90000000-0000-0000-0000-000000000003'
        ),
        (
            '90000000-0000-0000-0000-000000000502',
            '90000000-0000-0000-0000-000000000403',
            '90000000-0000-0000-0000-000000000201',
            'within_reference_range',
            'Doctor Confidential Assay',
            'Reactive',
            'copies/mL',
            'Doctor Confidential Method',
            'Not detected',
            '90000000-0000-0000-0000-000000000003'
        );

    UPDATE public.results
    SET status = 'approved',
        approved_by = v_manager_id,
        approved_at = CASE id
            WHEN '90000000-0000-0000-0000-000000000202'::UUID
                THEN TIMESTAMPTZ '2026-07-21 04:15:00+00'
            ELSE TIMESTAMPTZ '2026-07-21 04:16:00+00'
        END
    WHERE id IN (
        '90000000-0000-0000-0000-000000000201',
        '90000000-0000-0000-0000-000000000202'
    );

    UPDATE public.samples
    SET status = 'completed',
        completed_at = CASE id
            WHEN '90000000-0000-0000-0000-000000000101'::UUID
                THEN TIMESTAMPTZ '2026-07-21 04:20:00+00'
            ELSE TIMESTAMPTZ '2026-07-21 04:21:00+00'
        END
    WHERE id IN (
        '90000000-0000-0000-0000-000000000101',
        '90000000-0000-0000-0000-000000000103'
    );

    INSERT INTO public.coa_reports (
        id,
        sample_id,
        source_submission_id,
        signature_id,
        version,
        file_path,
        file_hash,
        status
    )
    VALUES
        (
            '90000000-0000-0000-0000-000000000301',
            '90000000-0000-0000-0000-000000000101',
            '90000000-0000-0000-0000-000000000401',
            v_manager_signature_id,
            1,
            'doctor-visible/report.html',
            'hash-ready',
            'ready'
        ),
        (
            '90000000-0000-0000-0000-000000000302',
            '90000000-0000-0000-0000-000000000102',
            '90000000-0000-0000-0000-000000000402',
            v_manager_signature_id,
            1,
            'doctor-hidden/report.html',
            'hash-hidden',
            'ready'
        ),
        (
            '90000000-0000-0000-0000-000000000303',
            '90000000-0000-0000-0000-000000000103',
            '90000000-0000-0000-0000-000000000403',
            v_manager_signature_id,
            1,
            'doctor-confidential/report.html',
            'hash-confidential',
            'ready'
        );
END $$;

\echo 'Test 1: Standard doctor sees only non-confidential completed samples'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';

INSERT INTO doctor_rbac_test_results
SELECT
    'standard_doctor_samples_completed_only',
    array_agg(sample_id ORDER BY sample_id) = ARRAY['DR-COMPLETE-VISIBLE']::TEXT[],
    COALESCE('visible samples: ' || array_to_string(array_agg(sample_id ORDER BY sample_id), ', '), 'visible samples: <none>')
FROM public.samples
WHERE sample_id LIKE 'DR-%';

\echo 'Test 2: Confidential doctor sees authorized completed confidential samples'
RESET ROLE;
RESET request.jwt.claims;
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"90000000-0000-0000-0000-000000000002","role":"authenticated"}';

INSERT INTO doctor_rbac_test_results
SELECT
    'confidential_doctor_samples_completed_only',
    array_agg(sample_id ORDER BY sample_id) = ARRAY['DR-COMPLETE-CONFIDENTIAL', 'DR-COMPLETE-VISIBLE']::TEXT[],
    COALESCE('visible samples: ' || array_to_string(array_agg(sample_id ORDER BY sample_id), ', '), 'visible samples: <none>')
FROM public.samples
WHERE sample_id LIKE 'DR-%';

\echo 'Test 3: Standard doctor sees only ready CoA for visible completed sample'
RESET ROLE;
RESET request.jwt.claims;
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';

INSERT INTO doctor_rbac_test_results
SELECT
    'standard_doctor_coa_ready_completed_only',
    array_agg(file_path ORDER BY file_path) = ARRAY['doctor-visible/report.html']::TEXT[],
    COALESCE('visible CoAs: ' || array_to_string(array_agg(file_path ORDER BY file_path), ', '), 'visible CoAs: <none>')
FROM public.coa_reports
WHERE file_path LIKE 'doctor-%/report.html';

RESET ROLE;
RESET request.jwt.claims;

TABLE doctor_rbac_test_results;

DO $$
DECLARE
    v_failures INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_failures
    FROM doctor_rbac_test_results
    WHERE NOT passed;

    IF v_failures > 0 THEN
        RAISE EXCEPTION 'doctor-rbac-rls.test.sql failed with % failing test(s)', v_failures;
    END IF;
END $$;

ROLLBACK;
