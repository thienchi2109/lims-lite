-- SAMPLES CONFIDENTIAL PAGE RPC REGRESSION TEST SUITE
-- Verifies get_samples_page conceals confidential-associated rows/counts for unauthorized users.
-- Usage: docker exec -i lims-postgres psql -U postgres -d postgres < tests/samples-confidential-page-rpc.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'SAMPLES CONFIDENTIAL PAGE RPC TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

CREATE TEMP TABLE samples_confidential_page_rpc_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE, DELETE ON samples_confidential_page_rpc_test_results TO authenticated;

DO $$
DECLARE
    v_hiv_assay_id UUID;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        ('61111111-1111-1111-1111-111111111111', 'batch4-unauthorized-analyst@lims.local'),
        ('62222222-2222-2222-2222-222222222222', 'batch4-authorized-analyst@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, username, full_name, role, can_access_confidential)
    VALUES
        (
            '61111111-1111-1111-1111-111111111111',
            'batch4_unauthorized_analyst',
            'Batch 4 Unauthorized Analyst',
            'analyst',
            FALSE
        ),
        (
            '62222222-2222-2222-2222-222222222222',
            'batch4_authorized_analyst',
            'Batch 4 Authorized Analyst',
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
    LIMIT 1;

    IF v_hiv_assay_id IS NULL THEN
        RAISE EXCEPTION 'Missing seeded HIV assay definition: HIV Ag/Ab định tính';
    END IF;

    UPDATE public.assay_definitions
    SET
        is_confidential = TRUE,
        deleted_at = NULL
    WHERE id = v_hiv_assay_id;

    INSERT INTO public.clients (id, id_card_num, name, date_of_birth, gender, phone, address)
    VALUES ('63333333-3333-3333-3333-333333333333', '079203008888', 'Bệnh nhân HIV Batch 4', DATE '1992-08-21', 'Nam', '0908888999', 'TP.HCM')
    ON CONFLICT (id) DO UPDATE
    SET
        id_card_num = EXCLUDED.id_card_num,
        name = EXCLUDED.name,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address;

    INSERT INTO public.samples (id, sample_id, client_id, client_name, status, received_by, type)
    VALUES ('64444444-4444-4444-4444-444444444444', 'BATCH4-HIV-PAGE-RPC', '63333333-3333-3333-3333-333333333333', 'Bệnh nhân HIV Batch 4', 'received', '61111111-1111-1111-1111-111111111111', 'Máu')
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
    VALUES ('65555555-5555-5555-5555-555555555555', '64444444-4444-4444-4444-444444444444', v_hiv_assay_id, 'Âm tính', 'pending', '62222222-2222-2222-2222-222222222222')
    ON CONFLICT (id) DO UPDATE
    SET
        sample_id = EXCLUDED.sample_id,
        assay_id = EXCLUDED.assay_id,
        value = EXCLUDED.value,
        status = EXCLUDED.status,
        entered_by = EXCLUDED.entered_by;
END $$;

\echo 'Test 1: Unauthorized analyst sees zero rows/count for confidential sample in get_samples_page'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_payload JSONB;
    v_rows INTEGER;
    v_total_count INTEGER;
BEGIN
    SELECT public.get_samples_page(
        p_search := 'BATCH4-HIV-PAGE-RPC',
        p_scope := 'all',
        p_page := 1,
        p_page_size := 20
    )
    INTO v_payload;

    v_rows := COALESCE(jsonb_array_length(v_payload->'rows'), 0);
    v_total_count := COALESCE((v_payload->>'total_count')::INTEGER, 0);

    INSERT INTO samples_confidential_page_rpc_test_results
    VALUES (
        'unauthorized_rpc_hides_confidential_sample',
        v_rows = 0 AND v_total_count = 0,
        CASE
            WHEN v_rows = 0 AND v_total_count = 0
                THEN 'unauthorized user received no confidential rows or counts'
            ELSE format('unauthorized user still received rows=%s total_count=%s', v_rows, v_total_count)
        END
    );
END $$;

RESET ROLE;
RESET request.jwt.claims;

\echo 'Test 2: Authorized analyst retains confidential sample visibility in get_samples_page'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"62222222-2222-2222-2222-222222222222","role":"authenticated"}';

DO $$
DECLARE
    v_payload JSONB;
    v_rows INTEGER;
    v_total_count INTEGER;
    v_first_sample_id TEXT;
BEGIN
    SELECT public.get_samples_page(
        p_search := 'BATCH4-HIV-PAGE-RPC',
        p_scope := 'all',
        p_page := 1,
        p_page_size := 20
    )
    INTO v_payload;

    v_rows := COALESCE(jsonb_array_length(v_payload->'rows'), 0);
    v_total_count := COALESCE((v_payload->>'total_count')::INTEGER, 0);
    v_first_sample_id := v_payload->'rows'->0->>'sample_id';

    INSERT INTO samples_confidential_page_rpc_test_results
    VALUES (
        'authorized_rpc_keeps_confidential_sample',
        v_rows = 1 AND v_total_count = 1 AND v_first_sample_id = 'BATCH4-HIV-PAGE-RPC',
        CASE
            WHEN v_rows = 1 AND v_total_count = 1 AND v_first_sample_id = 'BATCH4-HIV-PAGE-RPC'
                THEN 'authorized user retained confidential row/count'
            ELSE format(
                'authorized user expected rows=1 total_count=1 sample_id=BATCH4-HIV-PAGE-RPC but got rows=%s total_count=%s sample_id=%s',
                v_rows,
                v_total_count,
                COALESCE(v_first_sample_id, '<null>')
            )
        END
    );
END $$;

RESET ROLE;
RESET request.jwt.claims;

\echo 'Test 3: Soft-deleted confidential assay still keeps sample concealed from unauthorized RPC lookup'
UPDATE public.assay_definitions
SET deleted_at = NOW()
WHERE id = (
    SELECT assay_id
    FROM public.results
    WHERE id = '65555555-5555-5555-5555-555555555555'
);

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_payload JSONB;
    v_rows INTEGER;
    v_total_count INTEGER;
BEGIN
    SELECT public.get_samples_page(
        p_search := 'BATCH4-HIV-PAGE-RPC',
        p_scope := 'all',
        p_page := 1,
        p_page_size := 20
    )
    INTO v_payload;

    v_rows := COALESCE(jsonb_array_length(v_payload->'rows'), 0);
    v_total_count := COALESCE((v_payload->>'total_count')::INTEGER, 0);

    INSERT INTO samples_confidential_page_rpc_test_results
    VALUES (
        'unauthorized_rpc_hides_soft_deleted_confidential_assay_sample',
        v_rows = 0 AND v_total_count = 0,
        CASE
            WHEN v_rows = 0 AND v_total_count = 0
                THEN 'soft-deleted confidential assay still keeps sample concealed'
            ELSE format('soft-deleted confidential assay leaked rows=%s total_count=%s', v_rows, v_total_count)
        END
    );
END $$;

RESET ROLE;
RESET request.jwt.claims;

TABLE samples_confidential_page_rpc_test_results;

DO $$
DECLARE
    v_failures INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_failures
    FROM samples_confidential_page_rpc_test_results
    WHERE NOT passed;

    IF v_failures > 0 THEN
        RAISE EXCEPTION 'samples_confidential_page_rpc.test.sql failed with % failing test(s)', v_failures;
    END IF;
END $$;

ROLLBACK;
