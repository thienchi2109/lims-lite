-- RESULTS CONFIDENTIAL HIV RLS REGRESSION TEST SUITE
-- Verifies unauthorized read/insert/update denial and authorized analyst retention.
-- Usage: docker exec -i lims-postgres psql -U postgres -d postgres < tests/results-confidential-rls.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'RESULTS CONFIDENTIAL HIV RLS TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

CREATE TEMP TABLE confidential_results_batch2_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE, DELETE ON confidential_results_batch2_test_results TO authenticated;

DO $$
DECLARE
    v_hiv_assay_id UUID;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        ('51111111-1111-1111-1111-111111111111', 'batch2-unauthorized-analyst@lims.local'),
        ('52222222-2222-2222-2222-222222222222', 'batch2-authorized-analyst@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, username, full_name, role, can_access_confidential)
    VALUES
        (
            '51111111-1111-1111-1111-111111111111',
            'batch2_unauthorized_analyst',
            'Batch 2 Unauthorized Analyst',
            'analyst',
            FALSE
        ),
        (
            '52222222-2222-2222-2222-222222222222',
            'batch2_authorized_analyst',
            'Batch 2 Authorized Analyst',
            'analyst',
            TRUE
        )
    ON CONFLICT (id) DO UPDATE
    SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    SELECT id
    INTO v_hiv_assay_id
    FROM public.assay_definitions
    WHERE name = 'HIV Ag/Ab định tính'
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_hiv_assay_id IS NULL THEN
        RAISE EXCEPTION 'Missing seeded HIV assay definition: HIV Ag/Ab định tính';
    END IF;

    UPDATE public.assay_definitions
    SET is_confidential = TRUE
    WHERE id = v_hiv_assay_id;

    INSERT INTO public.clients (id, id_card_num, name, date_of_birth, gender, phone, address)
    VALUES ('53333333-3333-3333-3333-333333333333', '079203009999', 'Bệnh nhân HIV Batch 2', DATE '1994-02-14', 'Nam', '0901234999', 'TP.HCM')
    ON CONFLICT (id) DO UPDATE
    SET
        id_card_num = EXCLUDED.id_card_num,
        name = EXCLUDED.name,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address;

    INSERT INTO public.samples (id, sample_id, client_id, client_name, status, received_by, type)
    VALUES ('54444444-4444-4444-4444-444444444444', 'BATCH2-HIV-RESULT-RLS', '53333333-3333-3333-3333-333333333333', 'Bệnh nhân HIV Batch 2', 'received', '51111111-1111-1111-1111-111111111111', 'Máu')
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
    VALUES ('55555555-5555-5555-5555-555555555555', '54444444-4444-4444-4444-444444444444', v_hiv_assay_id, 'Âm tính', 'pending', '52222222-2222-2222-2222-222222222222')
    ON CONFLICT (id) DO UPDATE
    SET
        sample_id = EXCLUDED.sample_id,
        assay_id = EXCLUDED.assay_id,
        value = EXCLUDED.value,
        status = EXCLUDED.status,
        entered_by = EXCLUDED.entered_by,
        approved_by = NULL,
        approved_at = NULL,
        approval_note = NULL;
END $$;

\echo 'Test 1: Unauthorized analyst cannot read confidential HIV results'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_visible_rows INTEGER;
    v_visible_value TEXT;
BEGIN
    SELECT COUNT(*)
    INTO v_visible_rows
    FROM public.results r
    INNER JOIN public.assay_definitions ad ON ad.id = r.assay_id
    WHERE r.id = '55555555-5555-5555-5555-555555555555'
      AND ad.name = 'HIV Ag/Ab định tính';

    SELECT r.value
    INTO v_visible_value
    FROM public.results r
    WHERE r.id = '55555555-5555-5555-5555-555555555555';

    INSERT INTO confidential_results_batch2_test_results
    VALUES (
        'unauthorized_read_confidential_hiv_result',
        v_visible_rows = 0
            AND v_visible_value IS NULL,
        CASE
            WHEN v_visible_rows = 0 AND v_visible_value IS NULL
                THEN 'confidential result row hidden from unauthorized analyst'
            ELSE format(
                'unauthorized analyst can still read confidential data (visible_rows=%s visible_value=%s)',
                v_visible_rows,
                coalesce(v_visible_value, '<null>')
            )
        END
    );
END $$;

RESET ROLE;
RESET request.jwt.claims;
\echo 'Test 2: Unauthorized analyst cannot insert confidential HIV results'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
BEGIN
    BEGIN
        INSERT INTO public.results (id, sample_id, assay_id, value, status, entered_by)
        SELECT
            '56666666-6666-6666-6666-666666666666',
            '54444444-4444-4444-4444-444444444444',
            ad.id,
            '1.23',
            'pending',
            '51111111-1111-1111-1111-111111111111'
        FROM public.assay_definitions ad
        WHERE ad.name = 'HIV Ag/Ab định tính'
          AND ad.deleted_at IS NULL;

        INSERT INTO confidential_results_batch2_test_results
        VALUES (
            'unauthorized_insert_confidential_hiv_result',
            FALSE,
            'unauthorized analyst inserted a confidential HIV result row'
        );
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO confidential_results_batch2_test_results
            VALUES (
                'unauthorized_insert_confidential_hiv_result',
                SQLERRM ILIKE '%row-level security%'
                    OR SQLERRM ILIKE '%permission denied%',
                CASE
                    WHEN SQLERRM ILIKE '%row-level security%'
                        OR SQLERRM ILIKE '%permission denied%'
                    THEN format('write rejected as expected: %s', SQLERRM)
                    ELSE format('unexpected insert failure: %s', SQLERRM)
                END
            );
    END;
END $$;
RESET ROLE;
RESET request.jwt.claims;
DELETE FROM public.results
WHERE id = '56666666-6666-6666-6666-666666666666';
\echo 'Test 3: Unauthorized analyst cannot update confidential HIV results'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_updated_rows INTEGER;
BEGIN
    UPDATE public.results
    SET value = 'Dương tính'
    WHERE id = '55555555-5555-5555-5555-555555555555';

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    INSERT INTO confidential_results_batch2_test_results
    VALUES (
        'unauthorized_update_confidential_hiv_result',
        v_updated_rows = 0,
        CASE
            WHEN v_updated_rows = 0 THEN 'confidential result row blocked from unauthorized update'
            ELSE format('unauthorized analyst updated %s confidential HIV result row(s)', v_updated_rows)
        END
    );
END $$;
RESET ROLE;
RESET request.jwt.claims;
UPDATE public.results
SET value = 'Âm tính'
WHERE id = '55555555-5555-5555-5555-555555555555';
\echo 'Test 4: Authorized analyst retains confidential HIV read/write access'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}';

DO $$
DECLARE
    v_visible_rows INTEGER;
    v_inserted_rows INTEGER;
    v_updated_rows INTEGER;
    v_updated_value TEXT;
    v_inserted_value TEXT;
BEGIN
    SELECT COUNT(*)
    INTO v_visible_rows
    FROM public.results
    WHERE id = '55555555-5555-5555-5555-555555555555';

    INSERT INTO public.results (id, sample_id, assay_id, value, status, entered_by)
    SELECT
        '57777777-7777-7777-7777-777777777777',
        '54444444-4444-4444-4444-444444444444',
        ad.id,
        '0.95',
        'pending',
        '52222222-2222-2222-2222-222222222222'
    FROM public.assay_definitions ad
    WHERE ad.name = 'HIV Ag/Ab định tính'
      AND ad.deleted_at IS NULL;

    GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;

    UPDATE public.results
    SET value = 'Âm tính (đã xác minh)'
    WHERE id = '55555555-5555-5555-5555-555555555555';

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    SELECT value
    INTO v_updated_value
    FROM public.results
    WHERE id = '55555555-5555-5555-5555-555555555555';

    SELECT value
    INTO v_inserted_value
    FROM public.results
    WHERE id = '57777777-7777-7777-7777-777777777777';

    INSERT INTO confidential_results_batch2_test_results
    VALUES (
        'authorized_analyst_retains_confidential_hiv_access',
        v_visible_rows = 1
            AND v_inserted_rows = 1
            AND v_updated_rows = 1
            AND v_updated_value = 'Âm tính (đã xác minh)'
            AND v_inserted_value = '0.95',
        format(
            'visible_rows=%s inserted_rows=%s updated_rows=%s updated_value=%s inserted_value=%s',
            v_visible_rows,
            v_inserted_rows,
            v_updated_rows,
            coalesce(v_updated_value, '<null>'),
            coalesce(v_inserted_value, '<null>')
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO confidential_results_batch2_test_results
        VALUES (
            'authorized_analyst_retains_confidential_hiv_access',
            FALSE,
            format('authorized analyst lost confidential access: %s', SQLERRM)
        );
END $$;
RESET ROLE;
RESET request.jwt.claims;
TABLE confidential_results_batch2_test_results;

DO $$
DECLARE
    v_failures TEXT;
BEGIN
    SELECT string_agg(format('- %s: %s', test_name, detail), E'\n' ORDER BY test_name)
    INTO v_failures
    FROM confidential_results_batch2_test_results
    WHERE passed = FALSE;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION '✗ RESULTS CONFIDENTIAL HIV RLS TESTS FAILED:%', E'\n' || v_failures;
    END IF;

    RAISE NOTICE '✓ All confidential HIV results RLS checks passed';
END $$;

ROLLBACK;
