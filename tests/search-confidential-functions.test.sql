-- SEARCH CONFIDENTIAL FUNCTIONS REGRESSION TEST SUITE
-- Verifies unauthorized search RPCs return no confidential-associated rows and do not leak hidden counts/snippets.
-- Usage: docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/search-confidential-functions.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'SEARCH CONFIDENTIAL FUNCTIONS TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

CREATE TEMP TABLE search_confidential_functions_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_confidential_functions_test_results TO authenticated;

DO $$
DECLARE
    v_confidential_assay_id UUID;
    v_public_assay_id UUID;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        ('81111111-1111-1111-1111-111111111111', 'search-batch5-unauthorized@lims.local'),
        ('82222222-2222-2222-2222-222222222222', 'search-batch5-authorized@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, username, full_name, role, can_access_confidential)
    VALUES
        (
            '81111111-1111-1111-1111-111111111111',
            'search_batch5_unauthorized',
            'Search Batch 5 Unauthorized',
            'analyst',
            FALSE
        ),
        (
            '82222222-2222-2222-2222-222222222222',
            'search_batch5_authorized',
            'Search Batch 5 Authorized',
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
    INTO v_confidential_assay_id
    FROM public.assay_definitions
    WHERE name = 'HIV Ag/Ab định tính'
    LIMIT 1;

    IF v_confidential_assay_id IS NULL THEN
        RAISE EXCEPTION 'Missing seeded HIV assay definition: HIV Ag/Ab định tính';
    END IF;

    UPDATE public.assay_definitions
    SET is_confidential = TRUE,
        deleted_at = NULL
    WHERE id = v_confidential_assay_id;

    SELECT id
    INTO v_public_assay_id
    FROM public.assay_definitions
    WHERE COALESCE(is_confidential, FALSE) = FALSE
      AND deleted_at IS NULL
    ORDER BY created_at NULLS LAST, id
    LIMIT 1;

    IF v_public_assay_id IS NULL THEN
        RAISE EXCEPTION 'Missing seeded non-confidential assay definition for search regression test';
    END IF;

    INSERT INTO public.clients (id, id_card_num, name, date_of_birth, gender, phone, address)
    VALUES
        ('83333333-3333-3333-3333-333333333333', '079203009999', 'B5 GLOBAL MIXED CONFIDENTIAL', DATE '1991-05-14', 'Nam', '0911234567', 'Ha Noi'),
        ('84444444-4444-4444-4444-444444444444', '079203008888', 'B5 GLOBAL MIXED PUBLIC', DATE '1993-02-10', 'Nữ', '0910000001', 'Da Nang')
    ON CONFLICT (id) DO UPDATE
    SET
        id_card_num = EXCLUDED.id_card_num,
        name = EXCLUDED.name,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address;

    INSERT INTO public.samples (id, sample_id, client_id, client_name, status, received_by, type)
    VALUES
        ('85555555-5555-5555-5555-555555555555', 'B5-GLOBAL-MIXED-CONF', '83333333-3333-3333-3333-333333333333', 'B5 GLOBAL MIXED CONFIDENTIAL', 'received', '82222222-2222-2222-2222-222222222222', 'Máu'),
        ('86666666-6666-6666-6666-666666666666', 'B5-GLOBAL-MIXED-PUBLIC', '84444444-4444-4444-4444-444444444444', 'B5 GLOBAL MIXED PUBLIC', 'received', '82222222-2222-2222-2222-222222222222', 'Máu')
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
    VALUES
        ('87777777-7777-7777-7777-777777777777', '85555555-5555-5555-5555-555555555555', v_confidential_assay_id, 'B5 GLOBAL MIXED CONF RESULT', 'pending', '82222222-2222-2222-2222-222222222222'),
        ('88888888-8888-8888-8888-888888888888', '85555555-5555-5555-5555-555555555555', v_public_assay_id, 'B5 GLOBAL MIXED CONF NONCONF', 'pending', '82222222-2222-2222-2222-222222222222'),
        ('89999999-9999-9999-9999-999999999999', '86666666-6666-6666-6666-666666666666', v_public_assay_id, 'B5 GLOBAL MIXED PUBLIC RESULT', 'pending', '82222222-2222-2222-2222-222222222222')
    ON CONFLICT (id) DO UPDATE
    SET
        sample_id = EXCLUDED.sample_id,
        assay_id = EXCLUDED.assay_id,
        value = EXCLUDED.value,
        status = EXCLUDED.status,
        entered_by = EXCLUDED.entered_by;
END $$;

\echo 'Test 1: Unauthorized user cannot discover confidential sample or client matches'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"81111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_sample_code_count INTEGER;
    v_sample_name_count INTEGER;
    v_client_phone_count INTEGER;
    v_client_national_id_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sample_code_count FROM search_samples('B5-GLOBAL-MIXED-CONF', 10);
    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'unauthorized_search_samples_by_code_hidden',
        v_sample_code_count = 0,
        format('search_samples by code returned %s rows', v_sample_code_count)
    );

    SELECT COUNT(*) INTO v_sample_name_count FROM search_samples('B5 GLOBAL MIXED CONFIDENTIAL', 10);
    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'unauthorized_search_samples_by_name_hidden',
        v_sample_name_count = 0,
        format('search_samples by name returned %s rows', v_sample_name_count)
    );

    SELECT COUNT(*) INTO v_client_phone_count FROM search_clients('0911234567', 10);
    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'unauthorized_search_clients_by_phone_hidden',
        v_client_phone_count = 0,
        format('search_clients by phone returned %s rows', v_client_phone_count)
    );

    SELECT COUNT(*) INTO v_client_national_id_count FROM search_clients('079203009999', 10);
    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'unauthorized_search_clients_by_national_id_hidden',
        v_client_national_id_count = 0,
        format('search_clients by national ID returned %s rows', v_client_national_id_count)
    );
END $$;

\echo 'Test 2: Unauthorized user cannot discover confidential-associated results'
DO $$
DECLARE
    v_result_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_result_count
    FROM search_results('B5 GLOBAL MIXED CONF NONCONF', 10);

    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'unauthorized_search_results_on_confidential_sample_hidden',
        v_result_count = 0,
        format('search_results returned %s rows for a non-confidential result on a confidential-associated sample', v_result_count)
    );
END $$;

\echo 'Test 3: Unauthorized global search returns only permitted rows and no confidential descriptions'
DO $$
DECLARE
    v_global_rows INTEGER;
    v_confidential_descriptions BOOLEAN;
BEGIN
    SELECT
        COUNT(*),
        BOOL_OR(
            description ILIKE '%B5 GLOBAL MIXED CONFIDENTIAL%'
            OR description ILIKE '%B5 GLOBAL MIXED CONF RESULT%'
            OR description ILIKE '%B5 GLOBAL MIXED CONF NONCONF%'
        )
    INTO v_global_rows, v_confidential_descriptions
    FROM global_search('B5 GLOBAL MIXED', 20);

    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'unauthorized_global_search_hides_confidential_rows',
        v_global_rows = 3 AND COALESCE(v_confidential_descriptions, FALSE) = FALSE,
        format('global_search returned rows=%s confidential_descriptions=%s', v_global_rows, COALESCE(v_confidential_descriptions, FALSE))
    );
END $$;

RESET ROLE;
RESET request.jwt.claims;

\echo 'Test 4: Authorized user retains confidential search access'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"82222222-2222-2222-2222-222222222222","role":"authenticated"}';

DO $$
DECLARE
    v_sample_code_count INTEGER;
    v_client_phone_count INTEGER;
    v_result_count INTEGER;
    v_global_rows INTEGER;
    v_global_confidential_rows BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_sample_code_count FROM search_samples('B5-GLOBAL-MIXED-CONF', 10);
    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'authorized_search_samples_by_code_visible',
        v_sample_code_count = 1,
        format('search_samples by code returned %s rows', v_sample_code_count)
    );

    SELECT COUNT(*) INTO v_client_phone_count FROM search_clients('0911234567', 10);
    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'authorized_search_clients_by_phone_visible',
        v_client_phone_count = 1,
        format('search_clients by phone returned %s rows', v_client_phone_count)
    );

    SELECT COUNT(*) INTO v_result_count
    FROM search_results('B5 GLOBAL MIXED CONF NONCONF', 10);
    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'authorized_search_results_on_confidential_sample_visible',
        v_result_count = 1,
        format('search_results returned %s rows for a non-confidential result on a confidential-associated sample', v_result_count)
    );

    SELECT
        COUNT(*),
        BOOL_OR(
            description ILIKE '%B5 GLOBAL MIXED CONFIDENTIAL%'
            OR description ILIKE '%B5 GLOBAL MIXED CONF RESULT%'
            OR description ILIKE '%B5 GLOBAL MIXED CONF NONCONF%'
        )
    INTO v_global_rows, v_global_confidential_rows
    FROM global_search('B5 GLOBAL MIXED', 20);

    INSERT INTO search_confidential_functions_test_results
    VALUES (
        'authorized_global_search_includes_confidential_rows',
        v_global_rows = 7 AND COALESCE(v_global_confidential_rows, FALSE) = TRUE,
        format('global_search returned rows=%s confidential_descriptions=%s', v_global_rows, COALESCE(v_global_confidential_rows, FALSE))
    );
END $$;

TABLE search_confidential_functions_test_results;

DO $$
DECLARE
    v_failures INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_failures
    FROM search_confidential_functions_test_results
    WHERE NOT passed;

    IF v_failures > 0 THEN
        RAISE EXCEPTION 'search_confidential_functions.test.sql failed with % failing test(s)', v_failures;
    END IF;
END $$;

ROLLBACK;
