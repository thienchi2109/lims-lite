-- Migration 215: Add deterministic client identity foundation.
--
-- Security impact:
-- - Adds nullable canonical identity and soft-lifecycle fields to clients.
-- - Adds private immutable normalizers and a private SECURITY DEFINER trigger
--   helper with a fixed search_path.
-- - Preserves every existing client RLS policy, table grant, audit trigger,
--   legacy unique constraint, route, RPC, and hard-delete capability.
-- - Adds only non-unique candidate indexes; no resolver or lifecycle RPC is
--   introduced in this phase.
--
-- Historical data impact:
-- - Does not update or classify existing client rows. Phase 3 owns the explicit
--   legacy classification checkpoint.
-- - Derives canonical projections for every client INSERT or UPDATE after this
--   migration, including legacy callers, so newly touched rows cannot retain
--   stale projections.
-- - Aborts atomically on partial objects, incompatible security boundaries,
--   trusted identity collisions, normalized-phone collisions, normalized
--   name/DOB collisions, missing audit evidence, or orphaned sample links.

BEGIN;

SET LOCAL search_path TO public, extensions;

-- These transaction-local snapshots make policy and grant preservation exact.
CREATE TEMP TABLE expected_client_policy_contract (
    policy_name TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    permissive BOOLEAN NOT NULL,
    roles OID[] NOT NULL,
    using_expression TEXT,
    with_check_expression TEXT
) ON COMMIT DROP;

INSERT INTO expected_client_policy_contract (
    policy_name,
    command,
    permissive,
    roles,
    using_expression,
    with_check_expression
) VALUES
    (
        'Analysts and managers can update clients',
        'w',
        TRUE,
        ARRAY[0::OID],
        '(get_user_role() = ANY (ARRAY[''analyst''::user_role, ''manager''::user_role]))',
        '(get_user_role() = ANY (ARRAY[''analyst''::user_role, ''manager''::user_role]))'
    ),
    (
        'Analysts can create clients',
        'a',
        TRUE,
        ARRAY[0::OID],
        NULL,
        '(get_user_role() = ANY (ARRAY[''analyst''::user_role, ''manager''::user_role]))'
    ),
    (
        'Authenticated users can read clients',
        'r',
        TRUE,
        ARRAY[0::OID],
        '(( SELECT auth.uid() AS uid) IS NOT NULL)',
        NULL
    ),
    (
        'Managers can delete clients',
        'd',
        TRUE,
        ARRAY[0::OID],
        '(get_user_role() = ''manager''::user_role)',
        NULL
    );

CREATE TEMP TABLE expected_client_acl_contract (
    acl TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO expected_client_acl_contract (acl) VALUES
    ('anon=r/postgres'),
    ('authenticated=arwdDxt/postgres'),
    ('postgres=arwdDxt/postgres'),
    ('service_role=r/postgres');

DO $table_baseline$
BEGIN
    IF to_regclass('public.clients') IS NULL
       OR to_regclass('public.users') IS NULL
       OR to_regclass('public.samples') IS NULL
       OR to_regclass('public.audit_logs') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 215 requires clients, users, samples, and audit_logs';
    END IF;

    -- client-normalization-v1 is bound to the measured production runtime.
    -- A PostgreSQL or ICU upgrade requires a new normalizer version and fixtures.
    IF current_setting('server_version_num')::INTEGER <> 150001
       OR NOT EXISTS (
           SELECT 1
            FROM pg_collation
            WHERE collname = 'und-x-icu'
              AND collprovider = 'i'
              AND collversion IS NOT DISTINCT FROM '153.14'
              AND pg_collation_actual_version(oid)
                  IS NOT DISTINCT FROM '153.14'
       )
    THEN
        RAISE EXCEPTION
            'Migration 215 requires PostgreSQL 15.1 and und-x-icu ICU 153.14';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clients'
          AND column_name = 'id'
          AND data_type = 'uuid'
          AND is_nullable = 'NO'
    )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'clients'
             AND column_name = 'id_card_num'
             AND data_type = 'text'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'clients'
             AND column_name = 'name'
             AND data_type = 'text'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'clients'
             AND column_name = 'date_of_birth'
             AND data_type = 'date'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'clients'
             AND column_name = 'phone'
             AND data_type = 'text'
             AND is_nullable = 'NO'
       )
    THEN
        RAISE EXCEPTION
            'Migration 215 found an incompatible clients baseline';
    END IF;

    IF to_regprocedure('public.trigger_audit_log()') IS NULL
       OR to_regprocedure('public.update_updated_at_column()') IS NULL
       OR to_regprocedure('public.update_search_vector_clients()') IS NULL
       OR to_regprocedure('public.get_user_role()') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 215 requires audit, timestamp, search, and role helpers';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.clients'::REGCLASS
          AND tgname = 'audit_clients_changes'
          AND tgenabled = 'O'
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
          AND NOT tgisinternal
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.clients'::REGCLASS
             AND tgname = 'clients_search_update'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.update_search_vector_clients()'::REGPROCEDURE
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.clients'::REGCLASS
             AND tgname = 'update_clients_updated_at'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.update_updated_at_column()'::REGPROCEDURE
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION
            'Migration 215 requires exact client audit/search/timestamp triggers';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.clients'::REGCLASS
          AND relrowsecurity
    ) THEN
        RAISE EXCEPTION 'Migration 215 requires client RLS';
    END IF;

    IF EXISTS (
        (
            SELECT
                policy_name,
                command,
                permissive,
                roles,
                using_expression,
                with_check_expression
            FROM expected_client_policy_contract
            EXCEPT
            SELECT
                polname,
                polcmd::TEXT,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
        )
        UNION ALL
        (
            SELECT
                polname,
                polcmd::TEXT,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT
                policy_name,
                command,
                permissive,
                roles,
                using_expression,
                with_check_expression
            FROM expected_client_policy_contract
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 215 found an incompatible client policy baseline';
    END IF;

    IF EXISTS (
        (
            SELECT acl
            FROM expected_client_acl_contract
            EXCEPT
            SELECT entries.acl::TEXT
            FROM pg_class
            CROSS JOIN LATERAL unnest(relacl) AS entries(acl)
            WHERE oid = 'public.clients'::REGCLASS
        )
        UNION ALL
        (
            SELECT entries.acl::TEXT
            FROM pg_class
            CROSS JOIN LATERAL unnest(relacl) AS entries(acl)
            WHERE oid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT acl
            FROM expected_client_acl_contract
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 215 found an incompatible client grant baseline';
    END IF;

    IF to_regclass('public.clients_unique_identity') IS NULL
       OR to_regclass('public.idx_clients_unique_phone') IS NULL
       OR to_regclass('public.clients_search_idx') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 215 requires legacy identity, phone, and search indexes';
    END IF;

    IF to_regprocedure('public.normalize_client_name_v1(text)') IS NOT NULL
       OR to_regprocedure(
           'public.normalize_client_phone_v1(text)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.normalize_client_government_identity_v1(text)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.classify_client_government_identity_v1(text)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.maintain_client_identity_projections()'
       ) IS NOT NULL
       OR to_regclass(
           'public.idx_clients_normalized_name_dob'
       ) IS NOT NULL
       OR to_regclass(
           'public.idx_clients_normalized_phone'
       ) IS NOT NULL
       OR to_regclass(
           'public.idx_clients_government_identity_candidate'
       ) IS NOT NULL
       OR EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'clients'
             AND column_name IN (
                 'government_identity_type',
                 'government_identity_value',
                 'government_identity_trusted',
                 'normalized_name',
                 'normalized_phone',
                 'deleted_at',
                 'deleted_by',
                 'deletion_reason'
             )
       )
    THEN
        RAISE EXCEPTION
            'Migration 215 found a partial client canonical foundation';
    END IF;
END;
$table_baseline$;

LOCK TABLE public.clients IN ACCESS EXCLUSIVE MODE;

DO $data_baseline$
DECLARE
    v_trusted_identity_collision_groups BIGINT;
    v_normalized_phone_collision_groups BIGINT;
    v_normalized_name_dob_collision_groups BIGINT;
    v_clients_without_audit BIGINT;
    v_orphaned_sample_links BIGINT;
BEGIN
    SELECT count(*)
    INTO v_trusted_identity_collision_groups
    FROM (
        SELECT
            CASE
                WHEN id_card_num ~ '^[0-9]{12}$' THEN 'cccd'
                WHEN id_card_num ~ '^[0-9]{9}$' THEN 'cmnd'
            END,
            id_card_num
        FROM public.clients
        WHERE id_card_num ~ '^[0-9]{12}$'
           OR id_card_num ~ '^[0-9]{9}$'
        GROUP BY 1, 2
        HAVING count(*) > 1
    ) AS collisions;

    SELECT count(*)
    INTO v_normalized_phone_collision_groups
    FROM (
        SELECT normalized_phone
        FROM (
            SELECT CASE
                WHEN phone = '0000000000' THEN NULL
                WHEN phone ~ '^0[0-9]{9,10}$' THEN phone
                WHEN phone ~ '^\+84[0-9]{9,10}$'
                    THEN '0' || substring(phone FROM 4)
                ELSE NULL
            END AS normalized_phone
            FROM public.clients
        ) AS phones
        WHERE normalized_phone IS NOT NULL
        GROUP BY normalized_phone
        HAVING count(*) > 1
    ) AS collisions;

    SELECT count(*)
    INTO v_normalized_name_dob_collision_groups
    FROM (
        SELECT
            lower(
                regexp_replace(
                    btrim(normalize(name, NFC)),
                    '[[:space:]]+',
                    ' ',
                    'g'
                ) COLLATE "und-x-icu"
            ) AS normalized_name,
            date_of_birth
        FROM public.clients
        GROUP BY 1, 2
        HAVING count(*) > 1
    ) AS collisions;

    SELECT count(*)
    INTO v_clients_without_audit
    FROM public.clients AS client
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.audit_logs AS audit
        WHERE audit.table_name = 'clients'
          AND audit.record_id = client.id
    );

    SELECT count(*)
    INTO v_orphaned_sample_links
    FROM public.samples AS sample
    LEFT JOIN public.clients AS client ON client.id = sample.client_id
    WHERE sample.client_id IS NOT NULL
      AND client.id IS NULL;

    IF v_trusted_identity_collision_groups <> 0
       OR v_normalized_phone_collision_groups <> 0
       OR v_normalized_name_dob_collision_groups <> 0
       OR v_clients_without_audit <> 0
       OR v_orphaned_sample_links <> 0
    THEN
        RAISE EXCEPTION
            'Migration 215 baseline drift: trusted_identity=%, phone=%, name_dob=%, missing_audit=%, orphaned_links=%',
            v_trusted_identity_collision_groups,
            v_normalized_phone_collision_groups,
            v_normalized_name_dob_collision_groups,
            v_clients_without_audit,
            v_orphaned_sample_links;
    END IF;
END;
$data_baseline$;

CREATE FUNCTION public.normalize_client_name_v1(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT lower(
        regexp_replace(
            btrim(normalize(p_name, NFC)),
            '[[:space:]]+',
            ' ',
            'g'
        ) COLLATE "und-x-icu"
    );
$$;

REVOKE ALL ON FUNCTION public.normalize_client_name_v1(TEXT)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.normalize_client_name_v1(TEXT) IS
    'client-normalization-v1: NFC, trim, whitespace collapse, and accent-preserving ICU lowercase.';

CREATE FUNCTION public.normalize_client_phone_v1(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT CASE
        WHEN btrim(p_phone) = '0000000000' THEN NULL
        WHEN btrim(p_phone) ~ '^0[0-9]{9,10}$' THEN btrim(p_phone)
        WHEN btrim(p_phone) ~ '^\+84[0-9]{9,10}$'
            THEN '0' || substring(btrim(p_phone) FROM 4)
        ELSE NULL
    END;
$$;

REVOKE ALL ON FUNCTION public.normalize_client_phone_v1(TEXT)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.normalize_client_phone_v1(TEXT) IS
    'client-normalization-v1: canonical Vietnamese 0-prefix phone or null for invalid and placeholder input.';

CREATE FUNCTION public.normalize_client_government_identity_v1(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT CASE
        WHEN p_value ~ '^[0-9]{12}$' OR p_value ~ '^[0-9]{9}$'
            THEN p_value
        ELSE NULL
    END;
$$;

REVOKE ALL ON FUNCTION
    public.normalize_client_government_identity_v1(TEXT)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION
    public.normalize_client_government_identity_v1(TEXT) IS
    'client-normalization-v1: accepts only exact 12-digit CCCD or 9-digit CMND values.';

CREATE FUNCTION public.classify_client_government_identity_v1(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT CASE
        WHEN p_value ~ '^[0-9]{12}$' THEN 'cccd'
        WHEN p_value ~ '^[0-9]{9}$' THEN 'cmnd'
        ELSE NULL
    END;
$$;

REVOKE ALL ON FUNCTION
    public.classify_client_government_identity_v1(TEXT)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION
    public.classify_client_government_identity_v1(TEXT) IS
    'client-normalization-v1: classifies exact digit-only identity values as cccd or cmnd.';

DO $normalization_fixtures$
BEGIN
    IF public.normalize_client_name_v1(
        '  NGUYỄN   Văn A  '
    ) IS DISTINCT FROM 'nguyễn văn a'
       OR public.normalize_client_name_v1(
           normalize('Nguyễn Văn A', NFD)
       ) IS DISTINCT FROM 'nguyễn văn a'
       OR public.normalize_client_name_v1(
           'Nguyen Van A'
       ) IS NOT DISTINCT FROM 'nguyễn văn a'
       OR public.normalize_client_phone_v1(
           '+84901234567'
       ) IS DISTINCT FROM '0901234567'
       OR public.normalize_client_phone_v1(
           '0000000000'
       ) IS NOT NULL
       OR public.normalize_client_government_identity_v1(
           '086094006827'
       ) IS DISTINCT FROM '086094006827'
       OR public.classify_client_government_identity_v1(
           '086094006827'
       ) IS DISTINCT FROM 'cccd'
       OR public.classify_client_government_identity_v1(
           '331757192'
       ) IS DISTINCT FROM 'cmnd'
       OR public.normalize_client_government_identity_v1(
           'BACKFILL-001'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'client-normalization-v1 fixture verification failed';
    END IF;
END;
$normalization_fixtures$;

ALTER TABLE public.clients
    ADD COLUMN government_identity_type TEXT,
    ADD COLUMN government_identity_value TEXT,
    ADD COLUMN government_identity_trusted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN normalized_name TEXT,
    ADD COLUMN normalized_phone TEXT,
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN deleted_by UUID,
    ADD COLUMN deletion_reason TEXT,
    ADD CONSTRAINT clients_deleted_by_fkey
        FOREIGN KEY (deleted_by)
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT clients_government_identity_projection_check
        CHECK (
            (
                NOT government_identity_trusted
                AND government_identity_type IS NULL
                AND government_identity_value IS NULL
            )
            OR (
                government_identity_trusted
                AND (
                    (
                        government_identity_type = 'cccd'
                        AND government_identity_value ~ '^[0-9]{12}$'
                    )
                    OR (
                        government_identity_type = 'cmnd'
                        AND government_identity_value ~ '^[0-9]{9}$'
                    )
                )
            )
        ),
    ADD CONSTRAINT clients_soft_delete_audit_check
        CHECK (
            (
                deleted_at IS NULL
                AND deleted_by IS NULL
                AND deletion_reason IS NULL
            )
            OR (
                deleted_at IS NOT NULL
                AND deleted_by IS NOT NULL
                AND NULLIF(btrim(deletion_reason), '') IS NOT NULL
            )
        );

COMMENT ON COLUMN public.clients.government_identity_type IS
    'Canonical typed identity projection: cccd, cmnd, or null when missing/untrusted.';
COMMENT ON COLUMN public.clients.government_identity_value IS
    'Canonical digit-only government identity projection, nullable until trusted.';
COMMENT ON COLUMN public.clients.government_identity_trusted IS
    'Whether the canonical government identity projection is trusted for candidate resolution.';
COMMENT ON COLUMN public.clients.normalized_name IS
    'client-normalization-v1 name projection; existing rows remain null until Phase 3 classification or a later mutation.';
COMMENT ON COLUMN public.clients.normalized_phone IS
    'client-normalization-v1 phone projection; placeholder and invalid phones project to null.';
COMMENT ON COLUMN public.clients.deleted_at IS
    'Soft lifecycle timestamp. Phase 1 adds storage only and does not change current delete workflow.';
COMMENT ON COLUMN public.clients.deleted_by IS
    'Manager actor for a future audited soft-delete workflow.';
COMMENT ON COLUMN public.clients.deletion_reason IS
    'Required reason when the future soft-delete workflow sets deleted_at.';

CREATE FUNCTION public.maintain_client_identity_projections()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.normalized_name :=
        public.normalize_client_name_v1(NEW.name);
    NEW.normalized_phone :=
        public.normalize_client_phone_v1(NEW.phone);
    NEW.government_identity_value :=
        public.normalize_client_government_identity_v1(NEW.id_card_num);
    NEW.government_identity_type :=
        public.classify_client_government_identity_v1(NEW.id_card_num);
    NEW.government_identity_trusted :=
        NEW.government_identity_value IS NOT NULL;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maintain_client_identity_projections()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.maintain_client_identity_projections() IS
    'Maintains canonical client projections for every legacy or v2 INSERT/UPDATE without changing caller contracts.';

CREATE TRIGGER clients_maintain_identity_projections
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.maintain_client_identity_projections();

CREATE INDEX idx_clients_normalized_name_dob
ON public.clients (normalized_name, date_of_birth)
WHERE deleted_at IS NULL
  AND normalized_name IS NOT NULL;

CREATE INDEX idx_clients_normalized_phone
ON public.clients (normalized_phone)
WHERE deleted_at IS NULL
  AND normalized_phone IS NOT NULL;

CREATE INDEX idx_clients_government_identity_candidate
ON public.clients (
    government_identity_type,
    government_identity_value
)
WHERE government_identity_trusted
  AND government_identity_value IS NOT NULL;

DO $postconditions$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.clients
        WHERE normalized_name IS NOT NULL
           OR normalized_phone IS NOT NULL
           OR government_identity_type IS NOT NULL
           OR government_identity_value IS NOT NULL
           OR government_identity_trusted
           OR deleted_at IS NOT NULL
           OR deleted_by IS NOT NULL
           OR deletion_reason IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 215 existing client rows were unexpectedly classified';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.clients'::REGCLASS
          AND tgname = 'clients_maintain_identity_projections'
          AND tgenabled = 'O'
          AND tgfoid =
              'public.maintain_client_identity_projections()'::REGPROCEDURE
          AND NOT tgisinternal
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.clients'::REGCLASS
             AND tgname = 'audit_clients_changes'
             AND tgenabled = 'O'
             AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.clients'::REGCLASS
             AND tgname = 'clients_search_update'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.update_search_vector_clients()'::REGPROCEDURE
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.clients'::REGCLASS
             AND tgname = 'update_clients_updated_at'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.update_updated_at_column()'::REGPROCEDURE
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION
            'Migration 215 client trigger postcondition failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_index
        WHERE indexrelid =
              'public.idx_clients_normalized_name_dob'::REGCLASS
          AND NOT indisunique
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_index
           WHERE indexrelid =
                 'public.idx_clients_normalized_phone'::REGCLASS
             AND NOT indisunique
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_index
           WHERE indexrelid =
                 'public.idx_clients_government_identity_candidate'::REGCLASS
             AND NOT indisunique
       )
       OR to_regclass('public.clients_unique_identity') IS NULL
       OR to_regclass('public.idx_clients_unique_phone') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 215 client index postcondition failed';
    END IF;

    IF EXISTS (
        (
            SELECT
                policy_name,
                command,
                permissive,
                roles,
                using_expression,
                with_check_expression
            FROM expected_client_policy_contract
            EXCEPT
            SELECT
                polname,
                polcmd::TEXT,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
        )
        UNION ALL
        (
            SELECT
                polname,
                polcmd::TEXT,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT
                policy_name,
                command,
                permissive,
                roles,
                using_expression,
                with_check_expression
            FROM expected_client_policy_contract
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 215 changed the exact client policy contract';
    END IF;

    IF EXISTS (
        (
            SELECT acl
            FROM expected_client_acl_contract
            EXCEPT
            SELECT entries.acl::TEXT
            FROM pg_class
            CROSS JOIN LATERAL unnest(relacl) AS entries(acl)
            WHERE oid = 'public.clients'::REGCLASS
        )
        UNION ALL
        (
            SELECT entries.acl::TEXT
            FROM pg_class
            CROSS JOIN LATERAL unnest(relacl) AS entries(acl)
            WHERE oid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT acl
            FROM expected_client_acl_contract
        )
    ) THEN
        RAISE EXCEPTION
            'Migration 215 changed the exact client table grants';
    END IF;
END;
$postconditions$;

COMMIT;
