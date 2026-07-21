-- ============================================================================
-- ASSAY MANAGEMENT REGRESSION TEST SUITE
-- ============================================================================
-- Verifies the current assay_definitions.method_name contract, result method
-- references, CRUD behavior, audit coverage, and rollback-safe fixtures.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/assay-management.test.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'ASSAY MANAGEMENT TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

-- Self-contained receiver and client prerequisites.
INSERT INTO auth.users (id, email)
VALUES (
    '90000090-0001-4000-8000-000000000001',
    'issue-90-assay-analyst@lims.local'
);

INSERT INTO public.users (id, username, full_name, role, email)
VALUES (
    '90000090-0001-4000-8000-000000000001',
    'issue_90_assay_analyst',
    'Issue 90 Assay Analyst',
    'analyst',
    'issue-90-assay-analyst@lims.local'
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
VALUES (
    '90000090-0001-4000-8000-000000000010',
    'I90-ASSAY-CLIENT-001',
    'Issue 90 Assay Client',
    DATE '1990-01-01',
    'Khác',
    '0900009001',
    'Issue 90 assay fixture address'
);

-- results.method_id still references the methods catalog.
INSERT INTO public.methods (id, name, description)
VALUES (
    '90000090-0001-4000-8000-000000000020',
    'Issue 90 phương pháp kết quả',
    'Fixture used only by results.method_id'
);

INSERT INTO public.assay_definitions (
    id,
    name,
    method_name,
    units,
    validation_rules
)
VALUES
    (
        '90000090-0001-4000-8000-000000000101',
        'Issue 90 Độ pH',
        'Chuẩn độ axit-base',
        'pH',
        '{"min": 0, "max": 14}'::jsonb
    ),
    (
        '90000090-0001-4000-8000-000000000102',
        'Issue 90 Coliform tổng số',
        'Nuôi cấy vi sinh vật',
        'CFU/100mL',
        '{"min": 0, "dataType": "numeric"}'::jsonb
    );

INSERT INTO public.assay_definitions (
    id,
    name,
    method_name,
    units,
    validation_rules,
    updated_at
)
VALUES (
    '90000090-0001-4000-8000-000000000103',
    'Issue 90 Độ đục',
    NULL,
    'NTU',
    '{}'::jsonb,
    clock_timestamp() - INTERVAL '1 minute'
);

INSERT INTO public.assay_definitions (
    id,
    name,
    method_name,
    units,
    deleted_at
)
VALUES (
    '90000090-0001-4000-8000-000000000104',
    'Issue 90 assay đã xóa',
    NULL,
    'mg/L',
    clock_timestamp()
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
VALUES (
    '90000090-0001-4000-8000-000000000201',
    'I90-ASSAY-SAMPLE-001',
    '90000090-0001-4000-8000-000000000010',
    'Issue 90 Assay Client',
    'Máu',
    'received',
    '90000090-0001-4000-8000-000000000001',
    TRUE
);

INSERT INTO public.results (
    id,
    sample_id,
    assay_id,
    method_id,
    value,
    status
)
VALUES (
    '90000090-0001-4000-8000-000000000301',
    '90000090-0001-4000-8000-000000000201',
    '90000090-0001-4000-8000-000000000101',
    '90000090-0001-4000-8000-000000000020',
    '7.2',
    'pending'
);

\echo 'TEST 1: Active assay query excludes soft-deleted fixtures'
DO $$
DECLARE
    v_active_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_active_count
    FROM public.assay_definitions
    WHERE id IN (
        '90000090-0001-4000-8000-000000000101',
        '90000090-0001-4000-8000-000000000102',
        '90000090-0001-4000-8000-000000000103',
        '90000090-0001-4000-8000-000000000104'
    )
      AND deleted_at IS NULL;

    IF v_active_count IS DISTINCT FROM 3 THEN
        RAISE EXCEPTION
            'TEST 1 FAILED: expected 3 active assay fixtures, found %',
            v_active_count;
    END IF;
END $$;

\echo 'TEST 2: Single-assay query returns method_name'
DO $$
DECLARE
    v_name TEXT;
    v_method_name TEXT;
BEGIN
    SELECT name, method_name
    INTO v_name, v_method_name
    FROM public.assay_definitions
    WHERE id = '90000090-0001-4000-8000-000000000101'
      AND deleted_at IS NULL;

    IF v_name IS DISTINCT FROM 'Issue 90 Độ pH'
       OR v_method_name IS DISTINCT FROM 'Chuẩn độ axit-base' THEN
        RAISE EXCEPTION
            'TEST 2 FAILED: expected assay/method_name pair, found name=%, method_name=%',
            v_name,
            v_method_name;
    END IF;
END $$;

\echo 'TEST 3: Soft-deleted assay is not returned as active'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.assay_definitions
        WHERE id = '90000090-0001-4000-8000-000000000104'
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'TEST 3 FAILED: soft-deleted assay was returned as active';
    END IF;
END $$;

\echo 'TEST 4: Full assay creation stores method_name and validation rules'
DO $$
BEGIN
    INSERT INTO public.assay_definitions (
        id,
        name,
        method_name,
        units,
        validation_rules
    )
    VALUES (
        '90000090-0001-4000-8000-000000000105',
        'Issue 90 assay tạo đầy đủ',
        'Sắc ký lỏng hiệu năng cao',
        'mg/L',
        '{"min": 0, "max": 1000, "precision": 2}'::jsonb
    );

    IF NOT EXISTS (
        SELECT 1
        FROM public.assay_definitions
        WHERE id = '90000090-0001-4000-8000-000000000105'
          AND method_name = 'Sắc ký lỏng hiệu năng cao'
          AND units = 'mg/L'
          AND validation_rules = '{"min": 0, "max": 1000, "precision": 2}'::jsonb
    ) THEN
        RAISE EXCEPTION 'TEST 4 FAILED: full assay values were not stored correctly';
    END IF;
END $$;

\echo 'TEST 5: Minimal assay creation applies current defaults'
DO $$
BEGIN
    INSERT INTO public.assay_definitions (id, name)
    VALUES (
        '90000090-0001-4000-8000-000000000106',
        'Issue 90 assay tối thiểu'
    );

    IF NOT EXISTS (
        SELECT 1
        FROM public.assay_definitions
        WHERE id = '90000090-0001-4000-8000-000000000106'
          AND method_name IS NULL
          AND units IS NULL
          AND validation_rules = '{}'::jsonb
          AND is_confidential = FALSE
    ) THEN
        RAISE EXCEPTION 'TEST 5 FAILED: minimal assay defaults are incorrect';
    END IF;
END $$;

\echo 'TEST 6: Assay update persists fields and advances updated_at'
DO $$
DECLARE
    v_old_updated_at TIMESTAMPTZ;
    v_new_updated_at TIMESTAMPTZ;
BEGIN
    SELECT updated_at
    INTO v_old_updated_at
    FROM public.assay_definitions
    WHERE id = '90000090-0001-4000-8000-000000000103';

    UPDATE public.assay_definitions
    SET
        name = 'Issue 90 Độ đục đã cập nhật',
        method_name = 'Đo độ đục',
        units = 'NTU',
        validation_rules = '{"min": 0, "max": 500}'::jsonb
    WHERE id = '90000090-0001-4000-8000-000000000103'
    RETURNING updated_at INTO v_new_updated_at;

    IF v_new_updated_at <= v_old_updated_at THEN
        RAISE EXCEPTION
            'TEST 6 FAILED: updated_at did not advance (% -> %)',
            v_old_updated_at,
            v_new_updated_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.assay_definitions
        WHERE id = '90000090-0001-4000-8000-000000000103'
          AND name = 'Issue 90 Độ đục đã cập nhật'
          AND method_name = 'Đo độ đục'
          AND validation_rules = '{"min": 0, "max": 500}'::jsonb
    ) THEN
        RAISE EXCEPTION 'TEST 6 FAILED: updated assay values are incorrect';
    END IF;
END $$;

\echo 'TEST 7: In-use assay retains the current result method reference'
DO $$
DECLARE
    v_result_count INTEGER;
    v_result_method_id UUID;
BEGIN
    SELECT COUNT(*)
    INTO v_result_count
    FROM public.results
    WHERE assay_id = '90000090-0001-4000-8000-000000000101';

    SELECT method_id
    INTO v_result_method_id
    FROM public.results
    WHERE assay_id = '90000090-0001-4000-8000-000000000101'
    LIMIT 1;

    IF v_result_count IS DISTINCT FROM 1
       OR v_result_method_id IS DISTINCT FROM
          '90000090-0001-4000-8000-000000000020'::UUID THEN
        RAISE EXCEPTION
            'TEST 7 FAILED: expected one result with current method_id, count=%, method_id=%',
            v_result_count,
            v_result_method_id;
    END IF;
END $$;

\echo 'TEST 8: Unused assay can be soft-deleted'
DO $$
DECLARE
    v_deleted_at TIMESTAMPTZ;
BEGIN
    INSERT INTO public.assay_definitions (id, name, units)
    VALUES (
        '90000090-0001-4000-8000-000000000107',
        'Issue 90 assay để xóa',
        'test'
    );

    IF EXISTS (
        SELECT 1
        FROM public.results
        WHERE assay_id = '90000090-0001-4000-8000-000000000107'
    ) THEN
        RAISE EXCEPTION 'TEST 8 FAILED: soft-delete fixture unexpectedly has results';
    END IF;

    UPDATE public.assay_definitions
    SET deleted_at = clock_timestamp()
    WHERE id = '90000090-0001-4000-8000-000000000107'
    RETURNING deleted_at INTO v_deleted_at;

    IF v_deleted_at IS NULL THEN
        RAISE EXCEPTION 'TEST 8 FAILED: unused assay was not soft-deleted';
    END IF;
END $$;

\echo 'TEST 9: JSONB validation rules round-trip'
DO $$
DECLARE
    v_rules JSONB;
BEGIN
    INSERT INTO public.assay_definitions (id, name, validation_rules)
    VALUES (
        '90000090-0001-4000-8000-000000000108',
        'Issue 90 JSONB assay',
        '{"min": 0, "max": 100, "dataType": "numeric", "required": true}'::jsonb
    );

    SELECT validation_rules
    INTO v_rules
    FROM public.assay_definitions
    WHERE id = '90000090-0001-4000-8000-000000000108';

    IF jsonb_typeof(v_rules) IS DISTINCT FROM 'object'
       OR v_rules->>'dataType' IS DISTINCT FROM 'numeric'
       OR (v_rules->>'max')::INTEGER IS DISTINCT FROM 100 THEN
        RAISE EXCEPTION 'TEST 9 FAILED: validation rules were corrupted: %', v_rules;
    END IF;
END $$;

\echo 'TEST 10: updated_at trigger advances a deliberately old timestamp'
DO $$
DECLARE
    v_old_updated_at TIMESTAMPTZ;
    v_new_updated_at TIMESTAMPTZ;
BEGIN
    INSERT INTO public.assay_definitions (id, name, updated_at)
    VALUES (
        '90000090-0001-4000-8000-000000000109',
        'Issue 90 trigger assay',
        clock_timestamp() - INTERVAL '1 minute'
    )
    RETURNING updated_at INTO v_old_updated_at;

    UPDATE public.assay_definitions
    SET name = 'Issue 90 trigger assay updated'
    WHERE id = '90000090-0001-4000-8000-000000000109'
    RETURNING updated_at INTO v_new_updated_at;

    IF v_new_updated_at <= v_old_updated_at THEN
        RAISE EXCEPTION
            'TEST 10 FAILED: updated_at trigger did not advance (% -> %)',
            v_old_updated_at,
            v_new_updated_at;
    END IF;
END $$;

\echo 'TEST 11: Assay mutations are auditable'
DO $$
DECLARE
    v_audit_operations TEXT[];
BEGIN
    INSERT INTO public.assay_definitions (id, name, units)
    VALUES (
        '90000090-0001-4000-8000-00000000010a',
        'Issue 90 audit assay',
        'test'
    );

    UPDATE public.assay_definitions
    SET units = 'updated'
    WHERE id = '90000090-0001-4000-8000-00000000010a';

    SELECT array_agg(
        DISTINCT operation::TEXT
        ORDER BY operation::TEXT
    )
    INTO v_audit_operations
    FROM public.audit_logs
    WHERE table_name = 'assay_definitions'
      AND record_id = '90000090-0001-4000-8000-00000000010a';

    IF v_audit_operations IS DISTINCT FROM
       ARRAY['INSERT', 'UPDATE']::TEXT[] THEN
        RAISE EXCEPTION
            'TEST 11 FAILED: expected distinct INSERT/UPDATE audit operations, found %',
            v_audit_operations;
    END IF;
END $$;

\echo 'TEST 12: Vietnamese and Unicode assay values round-trip'
DO $$
DECLARE
    v_name TEXT;
BEGIN
    INSERT INTO public.assay_definitions (id, name, method_name, units)
    VALUES (
        '90000090-0001-4000-8000-00000000010b',
        'Thử nghiệm Độ pH (25°C) - Đặc biệt',
        'Điện cực chọn lọc ion',
        'mg/L'
    );

    SELECT name
    INTO v_name
    FROM public.assay_definitions
    WHERE id = '90000090-0001-4000-8000-00000000010b';

    IF v_name IS DISTINCT FROM 'Thử nghiệm Độ pH (25°C) - Đặc biệt' THEN
        RAISE EXCEPTION 'TEST 12 FAILED: Unicode assay name changed: %', v_name;
    END IF;
END $$;

ROLLBACK;

SELECT 'assay-management: ok' AS result;
