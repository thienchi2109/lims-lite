-- Migration 220: Classify legacy client identity into canonical projections.
--
-- Security impact:
-- - Preserves the exact clients RLS policies and grants established by
--   migrations 215-219.
-- - Uses the existing private normalization functions and projection trigger;
--   it creates no callable function, policy, grant, constraint, or index.
-- - Requires the client audit trigger and verifies one UPDATE audit row for
--   every client row whose canonical projection changes.
--
-- Historical data impact:
-- - Preserves raw identity/profile evidence, client UUIDs, lifecycle state, and
--   every sample-to-client link.
-- - Maps valid 12-digit CCCD and 9-digit CMND values to trusted typed canonical
--   state. Invalid and BACKFILL values remain only as raw legacy evidence.
-- - Maps invalid and placeholder phone values, including 0000000000, to a null
--   canonical phone without inventing replacement identity data.

BEGIN;

SET LOCAL search_path TO public, extensions;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE public.clients IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.samples IN SHARE MODE;

DO $baseline$
DECLARE
    v_column TEXT;
    v_required_function TEXT;
    v_required_trigger TEXT;
BEGIN
    IF to_regclass('public.clients') IS NULL
       OR to_regclass('public.samples') IS NULL
       OR to_regclass('public.audit_logs') IS NULL
       OR to_regclass('public.client_collision_adjudications') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 220 requires the Phase 2 client lifecycle baseline';
    END IF;

    FOREACH v_column IN ARRAY ARRAY[
        'id_card_num',
        'name',
        'date_of_birth',
        'gender',
        'phone',
        'address',
        'health_insurance_num',
        'expiry_date',
        'government_identity_type',
        'government_identity_value',
        'government_identity_trusted',
        'normalized_name',
        'normalized_phone',
        'deleted_at',
        'deleted_by',
        'deletion_reason'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'clients'
              AND column_name = v_column
        ) THEN
            RAISE EXCEPTION
                'Migration 220 missing required clients column %',
                v_column;
        END IF;
    END LOOP;

    FOREACH v_required_function IN ARRAY ARRAY[
        'public.normalize_client_name_v1(text)',
        'public.normalize_client_phone_v1(text)',
        'public.normalize_client_government_identity_v1(text)',
        'public.classify_client_government_identity_v1(text)',
        'public.maintain_client_identity_projections()',
        'public.trigger_audit_log()',
        'public.update_search_vector_clients()',
        'public.update_updated_at_column()',
        'public.adjudicate_client_collision_v1(uuid,uuid,timestamp with time zone,timestamp with time zone,text,text,text)'
    ]
    LOOP
        IF to_regprocedure(v_required_function) IS NULL THEN
            RAISE EXCEPTION
                'Migration 220 missing required function %',
                v_required_function;
        END IF;
    END LOOP;

    FOREACH v_required_trigger IN ARRAY ARRAY[
        'audit_clients_changes',
        'clients_maintain_identity_projections',
        'clients_search_update',
        'update_clients_updated_at'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgrelid = 'public.clients'::REGCLASS
              AND tgname = v_required_trigger
              AND tgenabled = 'O'
              AND NOT tgisinternal
        ) THEN
            RAISE EXCEPTION
                'Migration 220 missing enabled clients trigger %',
                v_required_trigger;
        END IF;
    END LOOP;
END;
$baseline$;

CREATE TEMP TABLE phase3_client_snapshot
ON COMMIT DROP
AS
SELECT
    id,
    id_card_num,
    name,
    date_of_birth,
    gender,
    phone,
    address,
    health_insurance_num,
    expiry_date,
    deleted_at,
    deleted_by,
    deletion_reason
FROM public.clients;

CREATE UNIQUE INDEX phase3_client_snapshot_id
ON phase3_client_snapshot (id);

CREATE TEMP TABLE phase3_sample_link_snapshot
ON COMMIT DROP
AS
SELECT id, client_id
FROM public.samples;

CREATE UNIQUE INDEX phase3_sample_link_snapshot_id
ON phase3_sample_link_snapshot (id);

CREATE TEMP TABLE phase3_client_policy_snapshot
ON COMMIT DROP
AS
SELECT
    polname,
    polcmd,
    polpermissive,
    polroles,
    pg_get_expr(polqual, polrelid) AS using_expression,
    pg_get_expr(polwithcheck, polrelid) AS check_expression
FROM pg_policy
WHERE polrelid = 'public.clients'::REGCLASS;

CREATE TEMP TABLE phase3_client_acl_snapshot
ON COMMIT DROP
AS
SELECT unnest(
    COALESCE(
        relacl,
        acldefault('r', relowner)
    )
)::TEXT AS acl
FROM pg_class
WHERE oid = 'public.clients'::REGCLASS;

CREATE TEMP TABLE phase3_audit_snapshot
ON COMMIT DROP
AS
SELECT id
FROM public.audit_logs;

CREATE UNIQUE INDEX phase3_audit_snapshot_id
ON phase3_audit_snapshot (id);

CREATE TEMP TABLE phase3_expected_updates
ON COMMIT DROP
AS
SELECT id
FROM public.clients
WHERE public.normalize_client_name_v1(name)
          IS DISTINCT FROM normalized_name
   OR public.normalize_client_phone_v1(phone)
          IS DISTINCT FROM normalized_phone
   OR public.normalize_client_government_identity_v1(id_card_num)
          IS DISTINCT FROM government_identity_value
   OR public.classify_client_government_identity_v1(id_card_num)
          IS DISTINCT FROM government_identity_type
   OR (
        public.normalize_client_government_identity_v1(id_card_num)
            IS NOT NULL
      ) IS DISTINCT FROM government_identity_trusted;

CREATE UNIQUE INDEX phase3_expected_updates_id
ON phase3_expected_updates (id);

UPDATE public.clients
SET government_identity_type =
        public.classify_client_government_identity_v1(id_card_num),
    government_identity_value =
        public.normalize_client_government_identity_v1(id_card_num),
    government_identity_trusted =
        public.normalize_client_government_identity_v1(id_card_num) IS NOT NULL,
    normalized_name = public.normalize_client_name_v1(name),
    normalized_phone = public.normalize_client_phone_v1(phone)
WHERE public.normalize_client_name_v1(name)
          IS DISTINCT FROM normalized_name
   OR public.normalize_client_phone_v1(phone)
          IS DISTINCT FROM normalized_phone
   OR public.normalize_client_government_identity_v1(id_card_num)
          IS DISTINCT FROM government_identity_value
   OR public.classify_client_government_identity_v1(id_card_num)
          IS DISTINCT FROM government_identity_type
   OR (
        public.normalize_client_government_identity_v1(id_card_num)
            IS NOT NULL
      ) IS DISTINCT FROM government_identity_trusted;

DO $postconditions$
DECLARE
    v_expected_update_count BIGINT;
    v_audited_update_count BIGINT;
BEGIN
    IF EXISTS (
        (
            SELECT
                id,
                id_card_num,
                name,
                date_of_birth,
                gender,
                phone,
                address,
                health_insurance_num,
                expiry_date,
                deleted_at,
                deleted_by,
                deletion_reason
            FROM public.clients
            EXCEPT
            SELECT
                id,
                id_card_num,
                name,
                date_of_birth,
                gender,
                phone,
                address,
                health_insurance_num,
                expiry_date,
                deleted_at,
                deleted_by,
                deletion_reason
            FROM phase3_client_snapshot
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
                address,
                health_insurance_num,
                expiry_date,
                deleted_at,
                deleted_by,
                deletion_reason
            FROM phase3_client_snapshot
            EXCEPT
            SELECT
                id,
                id_card_num,
                name,
                date_of_birth,
                gender,
                phone,
                address,
                health_insurance_num,
                expiry_date,
                deleted_at,
                deleted_by,
                deletion_reason
            FROM public.clients
        )
    ) THEN
        RAISE EXCEPTION 'Migration 220 client raw evidence changed';
    END IF;

    IF EXISTS (
        (
            SELECT id FROM public.clients
            EXCEPT
            SELECT id FROM phase3_client_snapshot
        )
        UNION ALL
        (
            SELECT id FROM phase3_client_snapshot
            EXCEPT
            SELECT id FROM public.clients
        )
    ) THEN
        RAISE EXCEPTION 'Migration 220 client UUID set changed';
    END IF;

    IF EXISTS (
        (
            SELECT id, client_id FROM public.samples
            EXCEPT
            SELECT id, client_id FROM phase3_sample_link_snapshot
        )
        UNION ALL
        (
            SELECT id, client_id FROM phase3_sample_link_snapshot
            EXCEPT
            SELECT id, client_id FROM public.samples
        )
    ) THEN
        RAISE EXCEPTION 'Migration 220 sample history links changed';
    END IF;

    IF EXISTS (
        (
            SELECT
                polname,
                polcmd,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT
                polname,
                polcmd,
                polpermissive,
                polroles,
                using_expression,
                check_expression
            FROM phase3_client_policy_snapshot
        )
        UNION ALL
        (
            SELECT
                polname,
                polcmd,
                polpermissive,
                polroles,
                using_expression,
                check_expression
            FROM phase3_client_policy_snapshot
            EXCEPT
            SELECT
                polname,
                polcmd,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
        )
    ) THEN
        RAISE EXCEPTION 'Migration 220 client RLS policy contract changed';
    END IF;

    IF EXISTS (
        (
            SELECT unnest(
                COALESCE(relacl, acldefault('r', relowner))
            )::TEXT
            FROM pg_class
            WHERE oid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT acl FROM phase3_client_acl_snapshot
        )
        UNION ALL
        (
            SELECT acl FROM phase3_client_acl_snapshot
            EXCEPT
            SELECT unnest(
                COALESCE(relacl, acldefault('r', relowner))
            )::TEXT
            FROM pg_class
            WHERE oid = 'public.clients'::REGCLASS
        )
    ) THEN
        RAISE EXCEPTION 'Migration 220 client grant contract changed';
    END IF;

    SELECT count(*)
    INTO v_expected_update_count
    FROM phase3_expected_updates;

    SELECT count(DISTINCT audit.record_id)
    INTO v_audited_update_count
    FROM public.audit_logs AS audit
    JOIN phase3_expected_updates AS expected
      ON expected.id = audit.record_id
    LEFT JOIN phase3_audit_snapshot AS existing_audit
      ON existing_audit.id = audit.id
    WHERE existing_audit.id IS NULL
      AND audit.table_name = 'clients'
      AND audit.operation = 'UPDATE';

    IF v_audited_update_count <> v_expected_update_count THEN
        RAISE EXCEPTION
            'Migration 220 classification audit coverage is incomplete';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.clients
        WHERE normalized_name IS DISTINCT FROM
                public.normalize_client_name_v1(name)
           OR normalized_phone IS DISTINCT FROM
                public.normalize_client_phone_v1(phone)
           OR government_identity_value IS DISTINCT FROM
                public.normalize_client_government_identity_v1(id_card_num)
           OR government_identity_type IS DISTINCT FROM
                public.classify_client_government_identity_v1(id_card_num)
           OR government_identity_trusted IS DISTINCT FROM (
                public.normalize_client_government_identity_v1(id_card_num)
                    IS NOT NULL
              )
    ) THEN
        RAISE EXCEPTION
            'Migration 220 client canonical projection reconciliation failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.clients
        WHERE id_card_num LIKE 'BACKFILL-%'
          AND government_identity_trusted
    ) OR EXISTS (
        SELECT 1
        FROM public.clients
        WHERE phone = '0000000000'
          AND normalized_phone IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 220 placeholder classification failed';
    END IF;
END;
$postconditions$;

COMMIT;
