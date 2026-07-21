-- ============================================================================
-- POSTGRESQL FULL-TEXT SEARCH REGRESSION TEST SUITE
-- ============================================================================
-- Verifies indexed sample fields, empty-query behavior, RLS, manager-only audit
-- search, Vietnamese unaccent behavior, global search, and search-vector setup.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/search.test.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'POSTGRESQL FULL-TEXT SEARCH TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

-- Authenticated analyst receiver and manager used by RLS assertions.
INSERT INTO auth.users (id, email)
VALUES
    (
        '90000090-0002-4000-8000-000000000001',
        'issue-90-search-analyst@lims.local'
    ),
    (
        '90000090-0002-4000-8000-000000000002',
        'issue-90-search-manager@lims.local'
    );

INSERT INTO public.users (id, username, full_name, role, email)
VALUES
    (
        '90000090-0002-4000-8000-000000000001',
        'issue_90_search_analyst',
        'Issue 90 Search Analyst',
        'analyst',
        'issue-90-search-analyst@lims.local'
    ),
    (
        '90000090-0002-4000-8000-000000000002',
        'issue_90_search_manager',
        'Issue 90 Search Manager',
        'manager',
        'issue-90-search-manager@lims.local'
    );

-- Full client prerequisites for every sample fixture.
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
        '90000090-0002-4000-8000-000000000101',
        'I90-SEARCH-CLIENT-001',
        'Issue 90 Sample Identifier Client',
        DATE '1991-01-01',
        'Khác',
        '0900009011',
        'Issue 90 search fixture address 1'
    ),
    (
        '90000090-0002-4000-8000-000000000102',
        'I90-SEARCH-CLIENT-002',
        'IssueNinetyClientToken',
        DATE '1992-02-02',
        'Nữ',
        '0900009012',
        'Issue 90 search fixture address 2'
    ),
    (
        '90000090-0002-4000-8000-000000000103',
        'I90-SEARCH-CLIENT-003',
        'IssueNinetyTypeToken Client',
        DATE '1993-03-03',
        'Nam',
        '0900009013',
        'Issue 90 search fixture address 3'
    ),
    (
        '90000090-0002-4000-8000-000000000104',
        'I90-SEARCH-CLIENT-004',
        'IssueNinetyGlobal Client',
        DATE '1994-04-04',
        'Khác',
        '0900009014',
        'Issue 90 search fixture address 4'
    ),
    (
        '90000090-0002-4000-8000-000000000105',
        'I90-SEARCH-CLIENT-005',
        'Mẫu Máu IssueNinetyDiacritic',
        DATE '1995-05-05',
        'Nữ',
        '0900009015',
        'Issue 90 search fixture address 5'
    );

INSERT INTO public.samples (
    id,
    sample_id,
    client_id,
    client_name,
    type,
    status,
    received_by,
    sample_quality
)
VALUES
    (
        '90000090-0002-4000-8000-000000000201',
        'I90SAMPLEID-UNIQUE',
        '90000090-0002-4000-8000-000000000101',
        'Issue 90 Sample Identifier Client',
        'Máu',
        'received',
        '90000090-0002-4000-8000-000000000001',
        TRUE
    ),
    (
        '90000090-0002-4000-8000-000000000202',
        'I90-CLIENT-FIELD',
        '90000090-0002-4000-8000-000000000102',
        'IssueNinetyClientToken',
        'Nước tiểu',
        'received',
        '90000090-0002-4000-8000-000000000001',
        FALSE
    ),
    (
        '90000090-0002-4000-8000-000000000203',
        'I90-TYPE-FIELD',
        '90000090-0002-4000-8000-000000000103',
        'IssueNinetyTypeToken Client',
        'Dịch niệu đạo/âm đạo',
        'received',
        '90000090-0002-4000-8000-000000000001',
        TRUE
    ),
    (
        '90000090-0002-4000-8000-000000000204',
        'I90GLOBAL-SAMPLE',
        '90000090-0002-4000-8000-000000000104',
        'IssueNinetyGlobal Client',
        'Máu',
        'received',
        '90000090-0002-4000-8000-000000000001',
        TRUE
    ),
    (
        '90000090-0002-4000-8000-000000000205',
        'I90-DIACRITIC-SAMPLE',
        '90000090-0002-4000-8000-000000000105',
        'Mẫu Máu IssueNinetyDiacritic',
        'Máu',
        'received',
        '90000090-0002-4000-8000-000000000001',
        TRUE
    );

INSERT INTO public.assay_definitions (
    id,
    name,
    method_name,
    units,
    is_confidential
)
VALUES (
    '90000090-0002-4000-8000-000000000301',
    'IssueNinetyGlobal Assay',
    'Issue 90 global search method',
    'mg/dL',
    FALSE
);

\echo 'TEST 1: sample_id, client_name, and type are searchable indexed fields'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.search_samples('I90SAMPLEID', 50)
        WHERE id = '90000090-0002-4000-8000-000000000201'
          AND rank > 0
    ) THEN
        RAISE EXCEPTION 'TEST 1 FAILED: sample_id search did not return its fixture';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.search_samples('IssueNinetyClientToken', 50)
        WHERE id = '90000090-0002-4000-8000-000000000202'
          AND rank > 0
    ) THEN
        RAISE EXCEPTION 'TEST 1 FAILED: client_name search did not return its fixture';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.search_samples(
            'IssueNinetyTypeToken Dịch niệu đạo/âm đạo',
            50
        )
        WHERE id = '90000090-0002-4000-8000-000000000203'
          AND rank > 0
    ) THEN
        RAISE EXCEPTION 'TEST 1 FAILED: type search did not return its fixture';
    END IF;
END $$;

\echo 'TEST 2: empty and whitespace-only queries return no samples'
DO $$
DECLARE
    v_empty_count INTEGER;
    v_space_count INTEGER;
    v_whitespace_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_empty_count FROM public.search_samples('', 10);
    SELECT COUNT(*) INTO v_space_count FROM public.search_samples(' ', 10);
    SELECT COUNT(*) INTO v_whitespace_count FROM public.search_samples('   ', 10);

    IF v_empty_count IS DISTINCT FROM 0
       OR v_space_count IS DISTINCT FROM 0
       OR v_whitespace_count IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION
            'TEST 2 FAILED: expected 0/0/0 rows, found %/%/%',
            v_empty_count,
            v_space_count,
            v_whitespace_count;
    END IF;
END $$;

\echo 'TEST 3: authenticated analyst can search visible samples through RLS'
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
    '{"sub":"90000090-0002-4000-8000-000000000001","role":"authenticated"}';

DO $$
DECLARE
    v_result_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_result_count
    FROM public.search_samples('I90SAMPLEID', 50)
    WHERE id = '90000090-0002-4000-8000-000000000201';

    IF v_result_count IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION
            'TEST 3 FAILED: analyst expected one visible sample, found %',
            v_result_count;
    END IF;
END $$;

RESET ROLE;
RESET request.jwt.claims;

\echo 'TEST 4: audit search rejects analysts and allows managers'
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
    '{"sub":"90000090-0002-4000-8000-000000000001","role":"authenticated"}';

DO $$
DECLARE
    v_denied BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM 1 FROM public.search_audit_logs('samples', 10);
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_denied := TRUE;
    END;

    IF NOT v_denied THEN
        RAISE EXCEPTION 'TEST 4 FAILED: analyst audit search was not denied';
    END IF;
END $$;

RESET ROLE;
RESET request.jwt.claims;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
    '{"sub":"90000090-0002-4000-8000-000000000002","role":"authenticated"}';

DO $$
BEGIN
    PERFORM COUNT(*) FROM public.search_audit_logs('samples', 10);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION
            'TEST 4 FAILED: manager audit search raised %: %',
            SQLSTATE,
            SQLERRM;
END $$;

RESET ROLE;
RESET request.jwt.claims;

\echo 'TEST 5: Vietnamese diacritics and unaccent return identical fixture rows'
DO $$
DECLARE
    v_with_diacritics UUID[];
    v_without_diacritics UUID[];
    v_expected UUID[] := ARRAY[
        '90000090-0002-4000-8000-000000000205'::UUID
    ];
BEGIN
    SELECT array_agg(id ORDER BY id)
    INTO v_with_diacritics
    FROM public.search_samples('IssueNinetyDiacritic Máu', 50)
    WHERE id = '90000090-0002-4000-8000-000000000205';

    SELECT array_agg(id ORDER BY id)
    INTO v_without_diacritics
    FROM public.search_samples('IssueNinetyDiacritic Mau', 50)
    WHERE id = '90000090-0002-4000-8000-000000000205';

    IF v_with_diacritics IS DISTINCT FROM v_expected
       OR v_without_diacritics IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION
            'TEST 5 FAILED: diacritic rows=% and unaccent rows=%',
            v_with_diacritics,
            v_without_diacritics;
    END IF;
END $$;

\echo 'TEST 6: global search returns sample, client, and assay fixtures'
DO $$
DECLARE
    v_has_sample BOOLEAN;
    v_has_client BOOLEAN;
    v_has_assay BOOLEAN;
BEGIN
    SELECT
        BOOL_OR(
            entity_type = 'sample'
            AND entity_id = '90000090-0002-4000-8000-000000000204'
        ),
        BOOL_OR(
            entity_type = 'client'
            AND entity_id = '90000090-0002-4000-8000-000000000104'
        ),
        BOOL_OR(
            entity_type = 'assay'
            AND entity_id = '90000090-0002-4000-8000-000000000301'
        )
    INTO v_has_sample, v_has_client, v_has_assay
    FROM public.global_search('IssueNinetyGlobal', 50);

    IF v_has_sample IS DISTINCT FROM TRUE
       OR v_has_client IS DISTINCT FROM TRUE
       OR v_has_assay IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'TEST 6 FAILED: global results sample=%, client=%, assay=%',
            v_has_sample,
            v_has_client,
            v_has_assay;
    END IF;
END $$;

\echo 'TEST 7: samples search vector and GIN index cover current search fields'
DO $$
DECLARE
    v_has_expected_index BOOLEAN;
    v_search_vector TSVECTOR;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_index index_metadata
        INNER JOIN pg_class index_relation
            ON index_relation.oid = index_metadata.indexrelid
        INNER JOIN pg_class table_relation
            ON table_relation.oid = index_metadata.indrelid
        INNER JOIN pg_namespace table_namespace
            ON table_namespace.oid = table_relation.relnamespace
        INNER JOIN pg_am access_method
            ON access_method.oid = index_relation.relam
        INNER JOIN LATERAL unnest(
            index_metadata.indkey::SMALLINT[]
        ) WITH ORDINALITY AS indexed_column(attnum, position)
            ON TRUE
        INNER JOIN pg_attribute table_attribute
            ON table_attribute.attrelid = table_relation.oid
           AND table_attribute.attnum = indexed_column.attnum
        WHERE table_namespace.nspname = 'public'
          AND table_relation.relname = 'samples'
          AND index_relation.relname = 'samples_search_idx'
          AND access_method.amname = 'gin'
          AND index_metadata.indisvalid
          AND index_metadata.indisready
          AND index_metadata.indnkeyatts = 1
          AND index_metadata.indnatts = 1
          AND index_metadata.indexprs IS NULL
          AND index_metadata.indpred IS NULL
          AND indexed_column.position = 1
          AND table_attribute.attname = 'search_vector'
    )
    INTO v_has_expected_index;

    IF v_has_expected_index IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'TEST 7 FAILED: samples_search_idx is not a valid GIN index over samples.search_vector';
    END IF;

    SELECT search_vector
    INTO v_search_vector
    FROM public.samples
    WHERE id = '90000090-0002-4000-8000-000000000201';

    IF v_search_vector IS NULL
       OR NOT v_search_vector @@ plainto_tsquery('simple', unaccent('I90SAMPLEID'))
       OR NOT v_search_vector @@ plainto_tsquery(
           'simple',
           unaccent('Issue 90 Sample Identifier Client')
       )
       OR NOT v_search_vector @@ plainto_tsquery('simple', unaccent('Máu')) THEN
        RAISE EXCEPTION
            'TEST 7 FAILED: search_vector does not include sample_id/client_name/type: %',
            v_search_vector;
    END IF;
END $$;

ROLLBACK;

SELECT 'search: ok' AS result;
