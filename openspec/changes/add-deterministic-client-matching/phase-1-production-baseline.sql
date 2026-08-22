-- Phase 1 production baseline for deterministic client matching.
-- Security impact: none. This script is aggregate-only and read-only.
-- It must never select row-level client identity, phone, or sample data.

\pset pager off
\pset null '<null>'
\x on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT
    clock_timestamp() AS observed_at,
    current_setting('server_version') AS postgres_version,
    current_setting('transaction_read_only') AS transaction_read_only;

WITH projected AS (
    SELECT
        id,
        date_of_birth,
        lower(
            regexp_replace(
                btrim(normalize(name, NFC)),
                '[[:space:]]+',
                ' ',
                'g'
            ) COLLATE "und-x-icu"
        ) AS normalized_name,
        CASE
            WHEN phone = '0000000000' THEN NULL
            WHEN phone ~ '^0[0-9]{9,10}$' THEN phone
            WHEN phone ~ '^\+84[0-9]{9,10}$'
                THEN '0' || substring(phone FROM 4)
            ELSE NULL
        END AS normalized_phone,
        CASE
            WHEN id_card_num ~ '^[0-9]{12}$' THEN 'cccd'
            WHEN id_card_num ~ '^[0-9]{9}$' THEN 'cmnd'
            ELSE NULL
        END AS government_identity_type,
        CASE
            WHEN id_card_num ~ '^[0-9]{12}$'
                OR id_card_num ~ '^[0-9]{9}$'
                THEN id_card_num
            ELSE NULL
        END AS government_identity_value,
        id_card_num LIKE 'BACKFILL-%' AS is_backfill_identity,
        phone = '0000000000' AS is_placeholder_phone
    FROM public.clients
),
name_dob_collisions AS (
    SELECT count(*) AS row_count
    FROM projected
    GROUP BY normalized_name, date_of_birth
    HAVING count(*) > 1
),
phone_collisions AS (
    SELECT count(*) AS row_count
    FROM projected
    WHERE normalized_phone IS NOT NULL
    GROUP BY normalized_phone
    HAVING count(*) > 1
),
government_identity_collisions AS (
    SELECT count(*) AS row_count
    FROM projected
    WHERE government_identity_value IS NOT NULL
    GROUP BY government_identity_type, government_identity_value
    HAVING count(*) > 1
),
raw_identity_collisions AS (
    SELECT count(*) AS row_count
    FROM public.clients
    GROUP BY id_card_num
    HAVING count(*) > 1
)
SELECT
    count(*) AS client_count,
    count(*) FILTER (
        WHERE government_identity_type = 'cccd'
    ) AS valid_cccd_count,
    count(*) FILTER (
        WHERE government_identity_type = 'cmnd'
    ) AS valid_cmnd_count,
    count(*) FILTER (
        WHERE government_identity_type IS NULL
    ) AS untrusted_identity_count,
    count(*) FILTER (
        WHERE is_backfill_identity
    ) AS backfill_identity_count,
    count(*) FILTER (
        WHERE is_placeholder_phone
    ) AS placeholder_phone_count,
    count(*) FILTER (
        WHERE normalized_phone IS NULL
    ) AS untrusted_phone_count,
    (SELECT count(*) FROM name_dob_collisions)
        AS name_dob_collision_groups,
    COALESCE((SELECT sum(row_count) FROM name_dob_collisions), 0)
        AS name_dob_collision_rows,
    (SELECT count(*) FROM phone_collisions)
        AS phone_collision_groups,
    COALESCE((SELECT sum(row_count) FROM phone_collisions), 0)
        AS phone_collision_rows,
    (SELECT count(*) FROM government_identity_collisions)
        AS trusted_identity_collision_groups,
    COALESCE(
        (SELECT sum(row_count) FROM government_identity_collisions),
        0
    ) AS trusted_identity_collision_rows,
    (SELECT count(*) FROM raw_identity_collisions)
        AS raw_identity_collision_groups,
    COALESCE((SELECT sum(row_count) FROM raw_identity_collisions), 0)
        AS raw_identity_collision_rows
FROM projected;

SELECT
    count(*) AS client_audit_rows,
    count(DISTINCT record_id) AS audited_client_count,
    count(*) FILTER (
        WHERE operation = 'INSERT'
    ) AS client_insert_audit_rows,
    count(*) FILTER (
        WHERE operation = 'UPDATE'
    ) AS client_update_audit_rows,
    count(*) FILTER (
        WHERE operation = 'DELETE'
    ) AS client_delete_audit_rows,
    count(*) FILTER (
        WHERE changed_by IS NULL
    ) AS audit_rows_without_actor,
    (
        SELECT count(*)
        FROM public.clients AS client
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.audit_logs AS audit
            WHERE audit.table_name = 'clients'
              AND audit.record_id = client.id
        )
    ) AS clients_without_audit_evidence
FROM public.audit_logs
WHERE table_name = 'clients';

SELECT
    count(*) AS sample_count,
    count(*) FILTER (
        WHERE sample.client_id IS NOT NULL
    ) AS linked_sample_count,
    count(DISTINCT sample.client_id) FILTER (
        WHERE sample.client_id IS NOT NULL
    ) AS linked_client_count,
    count(*) FILTER (
        WHERE sample.client_id IS NOT NULL
          AND client.id IS NULL
    ) AS orphaned_client_links,
    count(*) FILTER (
        WHERE client.id IS NOT NULL
          AND sample.client_name IS DISTINCT FROM client.name
    ) AS stale_client_name_snapshots
FROM public.samples AS sample
LEFT JOIN public.clients AS client ON client.id = sample.client_id;

SELECT
    (
        SELECT count(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clients'
    ) AS client_column_count,
    (
        SELECT array_agg(column_name ORDER BY ordinal_position)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clients'
    ) AS client_columns,
    (
        SELECT array_agg(conname ORDER BY conname)
        FROM pg_constraint
        WHERE conrelid = 'public.clients'::regclass
    ) AS client_constraints,
    (
        SELECT array_agg(indexname ORDER BY indexname)
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'clients'
    ) AS client_indexes,
    (
        SELECT array_agg(polname ORDER BY polname)
        FROM pg_policy
        WHERE polrelid = 'public.clients'::regclass
    ) AS client_policies,
    (
        SELECT array_agg(tgname ORDER BY tgname)
        FROM pg_trigger
        WHERE tgrelid = 'public.clients'::regclass
          AND NOT tgisinternal
    ) AS client_triggers;

SELECT
    to_regprocedure('public.run_security_tests()') IS NOT NULL
        AS has_security_tests,
    to_regprocedure('public.normalize_client_name_v1(text)') IS NOT NULL
        AS has_client_name_normalizer,
    to_regprocedure('public.normalize_client_phone_v1(text)') IS NOT NULL
        AS has_client_phone_normalizer,
    to_regprocedure(
        'public.maintain_client_identity_projections()'
    ) IS NOT NULL AS has_projection_trigger_function,
    to_regclass('public.idx_clients_normalized_name_dob') IS NOT NULL
        AS has_normalized_name_index,
    to_regclass('public.idx_clients_normalized_phone') IS NOT NULL
        AS has_normalized_phone_index;

COMMIT;
