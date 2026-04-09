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
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        ('90000000-0000-0000-0000-000000000001', 'doctor-standard@lims.local'),
        ('90000000-0000-0000-0000-000000000002', 'doctor-confidential@lims.local'),
        ('90000000-0000-0000-0000-000000000003', 'doctor-receiver@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, username, full_name, role, can_access_confidential)
    VALUES
        ('90000000-0000-0000-0000-000000000001', 'doctor_standard', 'Doctor Standard', 'doctor', FALSE),
        ('90000000-0000-0000-0000-000000000002', 'doctor_confidential', 'Doctor Confidential', 'doctor', TRUE),
        ('90000000-0000-0000-0000-000000000003', 'doctor_receiver', 'Doctor Receiver', 'analyst', TRUE)
    ON CONFLICT (id) DO UPDATE
    SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    INSERT INTO public.assay_definitions (id, name, units, is_confidential)
    VALUES (v_confidential_assay_id, 'Doctor Confidential Assay', 'copies/mL', TRUE)
    ON CONFLICT (id) DO UPDATE
    SET
        name = EXCLUDED.name,
        units = EXCLUDED.units,
        is_confidential = TRUE,
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

    INSERT INTO public.samples (id, sample_id, client_id, client_name, status, received_by, type)
    VALUES
        ('90000000-0000-0000-0000-000000000101', 'DR-COMPLETE-VISIBLE', '90000000-0000-0000-0000-000000000010', 'Doctor RBAC Patient', 'completed', '90000000-0000-0000-0000-000000000003', 'Máu'),
        ('90000000-0000-0000-0000-000000000102', 'DR-ASSIGNED-HIDDEN', '90000000-0000-0000-0000-000000000010', 'Doctor RBAC Patient', 'assigned', '90000000-0000-0000-0000-000000000003', 'Máu'),
        ('90000000-0000-0000-0000-000000000103', 'DR-COMPLETE-CONFIDENTIAL', '90000000-0000-0000-0000-000000000010', 'Doctor RBAC Patient', 'completed', '90000000-0000-0000-0000-000000000003', 'Máu')
    ON CONFLICT (id) DO UPDATE
    SET
        sample_id = EXCLUDED.sample_id,
        client_id = EXCLUDED.client_id,
        client_name = EXCLUDED.client_name,
        status = EXCLUDED.status,
        received_by = EXCLUDED.received_by,
        type = EXCLUDED.type,
        deleted_at = NULL;

    INSERT INTO public.results (id, sample_id, assay_id, value, status, entered_by)
    VALUES ('90000000-0000-0000-0000-000000000201', '90000000-0000-0000-0000-000000000103', v_confidential_assay_id, 'Reactive', 'approved', '90000000-0000-0000-0000-000000000003')
    ON CONFLICT (id) DO UPDATE
    SET
        sample_id = EXCLUDED.sample_id,
        assay_id = EXCLUDED.assay_id,
        value = EXCLUDED.value,
        status = EXCLUDED.status,
        entered_by = EXCLUDED.entered_by;

    WITH desired_coa(id, sample_id, version, file_path, file_hash, status) AS (
        VALUES
            ('90000000-0000-0000-0000-000000000301'::UUID, '90000000-0000-0000-0000-000000000101'::UUID, 1, 'doctor-visible/report.html', 'hash-ready', 'ready'),
            ('90000000-0000-0000-0000-000000000302'::UUID, '90000000-0000-0000-0000-000000000102'::UUID, 1, 'doctor-hidden/report.html', 'hash-hidden', 'ready'),
            ('90000000-0000-0000-0000-000000000303'::UUID, '90000000-0000-0000-0000-000000000103'::UUID, 1, 'doctor-confidential/report.html', 'hash-confidential', 'ready')
    ),
    updated_coa AS (
        UPDATE public.coa_reports AS existing_coa
        SET
            file_path = desired_coa.file_path,
            file_hash = desired_coa.file_hash,
            status = desired_coa.status,
            deleted_at = NULL
        FROM desired_coa
        WHERE existing_coa.sample_id = desired_coa.sample_id
          AND existing_coa.version = desired_coa.version
          AND existing_coa.deleted_at IS NULL
        RETURNING desired_coa.sample_id
    )
    INSERT INTO public.coa_reports (id, sample_id, version, file_path, file_hash, status)
    SELECT desired_coa.id, desired_coa.sample_id, desired_coa.version, desired_coa.file_path, desired_coa.file_hash, desired_coa.status
    FROM desired_coa
    WHERE NOT EXISTS (
        SELECT 1
        FROM updated_coa
        WHERE updated_coa.sample_id = desired_coa.sample_id
    )
    ON CONFLICT (id) DO UPDATE
    SET
        sample_id = EXCLUDED.sample_id,
        version = EXCLUDED.version,
        file_path = EXCLUDED.file_path,
        file_hash = EXCLUDED.file_hash,
        status = EXCLUDED.status,
        deleted_at = NULL;
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
