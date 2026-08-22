-- Rollback-only runtime coverage for migration 220 classification behavior.
-- Fixture values are synthetic and every mutation is removed by ROLLBACK.

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';
SET LOCAL max_parallel_workers_per_gather = 0;

LOCK TABLE public.clients IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.samples IN SHARE MODE;

CREATE FUNCTION pg_temp.assert_client_classification(
    p_condition BOOLEAN,
    p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT COALESCE(p_condition, FALSE) THEN
        RAISE EXCEPTION
            'legacy client classification assertion failed: %',
            p_message;
    END IF;
END;
$$;

CREATE TEMP TABLE phase3_runtime_sample_links
ON COMMIT DROP
AS
SELECT id, client_id
FROM public.samples;

ALTER TABLE public.clients
DISABLE TRIGGER clients_maintain_identity_projections;

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
        '95220000-0000-4000-8000-000000000001',
        '952200001001',
        'Phase Three Valid CCCD',
        DATE '1980-02-20',
        'Nam',
        '+849522001001',
        'Rollback fixture'
    ),
    (
        '95220000-0000-4000-8000-000000000002',
        'BACKFILL-PHASE3',
        'Phase Three Backfill',
        DATE '1981-02-20',
        'Nữ',
        '0000000000',
        'Rollback fixture'
    ),
    (
        '95220000-0000-4000-8000-000000000003',
        'LEGACY-PHASE3-DUPLICATE',
        'Phase Three Legacy A',
        DATE '1982-02-20',
        'Khác',
        '0952201003',
        'Rollback fixture'
    ),
    (
        '95220000-0000-4000-8000-000000000004',
        'LEGACY-PHASE3-DUPLICATE',
        'Phase Three Legacy B',
        DATE '1983-02-20',
        'Nam',
        '0952201004',
        'Rollback fixture'
    );

ALTER TABLE public.clients
ENABLE TRIGGER clients_maintain_identity_projections;

CREATE TEMP TABLE phase3_runtime_raw_snapshot
ON COMMIT DROP
AS
SELECT
    id,
    id_card_num,
    name,
    date_of_birth,
    gender,
    phone,
    address
FROM public.clients
WHERE id::TEXT LIKE '95220000-%';

CREATE TEMP TABLE phase3_runtime_audit_snapshot
ON COMMIT DROP
AS
SELECT id
FROM public.audit_logs;

UPDATE public.clients
SET government_identity_type =
        public.classify_client_government_identity_v1(id_card_num),
    government_identity_value =
        public.normalize_client_government_identity_v1(id_card_num),
    government_identity_trusted =
        public.normalize_client_government_identity_v1(id_card_num) IS NOT NULL,
    normalized_name = public.normalize_client_name_v1(name),
    normalized_phone = public.normalize_client_phone_v1(phone)
WHERE id::TEXT LIKE '95220000-%';

SELECT pg_temp.assert_client_classification(
    NOT EXISTS (
        (
            SELECT
                id,
                id_card_num,
                name,
                date_of_birth,
                gender,
                phone,
                address
            FROM public.clients
            WHERE id::TEXT LIKE '95220000-%'
            EXCEPT
            SELECT
                id,
                id_card_num,
                name,
                date_of_birth,
                gender,
                phone,
                address
            FROM phase3_runtime_raw_snapshot
        )
        UNION ALL
        (
            SELECT
                id,
                id_card_num,
                name,
                date_of_birth,
                gender,
                phone,
                address
            FROM phase3_runtime_raw_snapshot
            EXCEPT
            SELECT
                id,
                id_card_num,
                name,
                date_of_birth,
                gender,
                phone,
                address
            FROM public.clients
            WHERE id::TEXT LIKE '95220000-%'
        )
    ),
    'classification preserves raw identity evidence'
);

SELECT pg_temp.assert_client_classification(
    EXISTS (
        SELECT 1
        FROM public.clients
        WHERE id = '95220000-0000-4000-8000-000000000001'
          AND government_identity_type = 'cccd'
          AND government_identity_value = '952200001001'
          AND government_identity_trusted
          AND normalized_phone = '09522001001'
          AND normalized_name =
                public.normalize_client_name_v1('Phase Three Valid CCCD')
    ),
    'client-normalization-v1 classifies valid CCCD and phone'
);

SELECT pg_temp.assert_client_classification(
    EXISTS (
        SELECT 1
        FROM public.clients
        WHERE id = '95220000-0000-4000-8000-000000000002'
          AND id_card_num = 'BACKFILL-PHASE3'
          AND government_identity_type IS NULL
          AND government_identity_value IS NULL
          AND NOT government_identity_trusted
          AND phone = '0000000000'
          AND normalized_phone IS NULL
    ),
    'BACKFILL and placeholder values remain missing and untrusted'
);

SELECT pg_temp.assert_client_classification(
    (
        SELECT count(*)
        FROM public.clients
        WHERE id::TEXT LIKE '95220000-%'
          AND id_card_num = 'LEGACY-PHASE3-DUPLICATE'
          AND government_identity_type IS NULL
          AND government_identity_value IS NULL
          AND NOT government_identity_trusted
    ) = 2,
    'duplicate invalid identifiers remain separate untrusted clients'
);

SELECT pg_temp.assert_client_classification(
    NOT EXISTS (
        (
            SELECT id, client_id FROM public.samples
            EXCEPT
            SELECT id, client_id FROM phase3_runtime_sample_links
        )
        UNION ALL
        (
            SELECT id, client_id FROM phase3_runtime_sample_links
            EXCEPT
            SELECT id, client_id FROM public.samples
        )
    ),
    'classification preserves sample links'
);

SELECT pg_temp.assert_client_classification(
    (
        SELECT count(DISTINCT audit.record_id)
        FROM public.audit_logs AS audit
        LEFT JOIN phase3_runtime_audit_snapshot AS existing_audit
          ON existing_audit.id = audit.id
        WHERE existing_audit.id IS NULL
          AND audit.table_name = 'clients'
          AND audit.operation = 'UPDATE'
          AND audit.record_id::TEXT LIKE '95220000-%'
    ) = 4,
    'classification emits client audit evidence'
);

SELECT 'legacy client identity classification rollback tests passed' AS result;

ROLLBACK;
