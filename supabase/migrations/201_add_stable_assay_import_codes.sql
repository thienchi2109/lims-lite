-- Migration 201: Add stable assay import codes.
--
-- Security impact:
-- - Adds an immutable, database-generated identifier to assay_definitions.
-- - Explicitly revokes sequence allocation from every API role because prior
--   default privileges grant access to future public sequences.
-- - Uses a SECURITY DEFINER insert trigger so existing manager inserts keep
--   working without sequence privileges and supplied codes are never stored.
-- - Preserves all existing assay RLS policies and table grants.
--
-- Historical data impact:
-- - Backfills active and soft-deleted assays in created_at, id order.
-- - Keeps the audit trigger enabled while preserving historical updated_at.
-- - Fails atomically if the expected baseline or resulting contract is invalid.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $table_baseline$
BEGIN
    IF to_regclass('public.assay_definitions') IS NULL THEN
        RAISE EXCEPTION
            'Migration 201 requires public.assay_definitions';
    END IF;
END;
$table_baseline$;

LOCK TABLE public.assay_definitions IN ACCESS EXCLUSIVE MODE;

DO $baseline$
DECLARE
    v_assay_count BIGINT;
BEGIN
    IF to_regclass('public.assay_import_code_seq') IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 201 expected public.assay_import_code_seq to be absent';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'assay_definitions'
          AND column_name = 'import_code'
    ) THEN
        RAISE EXCEPTION
            'Migration 201 expected assay_definitions.import_code to be absent';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'assay_definitions'
          AND column_name = 'id'
          AND data_type = 'uuid'
          AND is_nullable = 'NO'
    )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'assay_definitions'
             AND column_name = 'created_at'
             AND data_type = 'timestamp with time zone'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'assay_definitions'
             AND column_name = 'deleted_at'
             AND data_type = 'timestamp with time zone'
       )
    THEN
        RAISE EXCEPTION
            'Migration 201 found an incompatible assay_definitions baseline';
    END IF;

    IF to_regprocedure(
        'public.allocate_assay_import_code()'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.prevent_assay_import_code_update()'
       ) IS NOT NULL
       OR EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.assay_definitions'::REGCLASS
             AND tgname IN (
                 'assay_definitions_allocate_import_code',
                 'assay_definitions_import_code_immutable'
             )
             AND NOT tgisinternal
       )
       OR EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.assay_definitions'::REGCLASS
             AND conname IN (
                 'assay_definitions_import_code_format',
                 'assay_definitions_import_code_key'
             )
       )
    THEN
        RAISE EXCEPTION
            'Migration 201 found a partial assay import-code contract';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.assay_definitions'::REGCLASS
          AND tgname = 'update_assay_definitions_updated_at'
          AND tgenabled = 'O'
          AND tgfoid =
              'public.update_updated_at_column()'::REGPROCEDURE
          AND tgtype = 19
          AND tgattr = ''::INT2VECTOR
          AND NOT tgisinternal
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.assay_definitions'::REGCLASS
             AND tgname = 'audit_log_trigger'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.trigger_audit_log()'::REGPROCEDURE
             AND tgtype = 29
             AND tgattr = ''::INT2VECTOR
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION
            'Migration 201 requires enabled assay timestamp and audit triggers';
    END IF;

    SELECT count(*)
    INTO v_assay_count
    FROM public.assay_definitions;

    IF v_assay_count > 999999 THEN
        RAISE EXCEPTION
            'Migration 201 cannot encode % assays in six digits',
            v_assay_count;
    END IF;
END;
$baseline$;

CREATE SEQUENCE public.assay_import_code_seq
    AS INTEGER
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 999999
    START WITH 1
    NO CYCLE;

REVOKE ALL ON SEQUENCE public.assay_import_code_seq
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON SEQUENCE public.assay_import_code_seq IS
    'Global non-cycling allocator for immutable assay import codes.';

ALTER TABLE public.assay_definitions
    ADD COLUMN import_code TEXT;

ALTER TABLE public.assay_definitions
    DISABLE TRIGGER update_assay_definitions_updated_at;

WITH ordered_assays AS (
    SELECT
        assay.id,
        row_number() OVER (
            ORDER BY assay.created_at, assay.id
        ) AS sequence_value
    FROM public.assay_definitions AS assay
)
UPDATE public.assay_definitions AS assay
SET import_code =
    'CT-' || lpad(ordered_assay.sequence_value::TEXT, 6, '0')
FROM ordered_assays AS ordered_assay
WHERE assay.id = ordered_assay.id;

ALTER TABLE public.assay_definitions
    ENABLE TRIGGER update_assay_definitions_updated_at;

DO $advance_sequence$
DECLARE
    v_assay_count BIGINT;
BEGIN
    SELECT count(*)
    INTO v_assay_count
    FROM public.assay_definitions;

    PERFORM setval(
        'public.assay_import_code_seq'::REGCLASS,
        GREATEST(v_assay_count, 1),
        v_assay_count > 0
    );
END;
$advance_sequence$;

ALTER TABLE public.assay_definitions
    ALTER COLUMN import_code SET DEFAULT '__DATABASE_GENERATED__',
    ALTER COLUMN import_code SET NOT NULL,
    ADD CONSTRAINT assay_definitions_import_code_format
        CHECK (import_code ~ '^CT-[0-9]{6}$'),
    ADD CONSTRAINT assay_definitions_import_code_key
        UNIQUE (import_code);

COMMENT ON COLUMN public.assay_definitions.import_code IS
    'Immutable database-generated code used to identify assays in imports.';

CREATE FUNCTION public.allocate_assay_import_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.import_code IS DISTINCT FROM '__DATABASE_GENERATED__' THEN
        RAISE EXCEPTION 'Assay import code must be database generated'
            USING ERRCODE = '23514';
    END IF;

    NEW.import_code :=
        'CT-' || lpad(
            nextval('public.assay_import_code_seq'::REGCLASS)::TEXT,
            6,
            '0'
        );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_assay_import_code()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.allocate_assay_import_code() IS
    'Allocates an assay import code during INSERT without exposing its sequence.';

CREATE TRIGGER assay_definitions_allocate_import_code
BEFORE INSERT ON public.assay_definitions
FOR EACH ROW
EXECUTE FUNCTION public.allocate_assay_import_code();

COMMENT ON TRIGGER assay_definitions_allocate_import_code
ON public.assay_definitions IS
    'Replaces the internal default sentinel and rejects supplied import codes.';

CREATE FUNCTION public.prevent_assay_import_code_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.import_code IS DISTINCT FROM OLD.import_code THEN
        RAISE EXCEPTION 'Assay import code is immutable'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_assay_import_code_update()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.prevent_assay_import_code_update() IS
    'Rejects every attempt to replace an assigned assay import code.';

CREATE TRIGGER assay_definitions_import_code_immutable
BEFORE UPDATE OF import_code ON public.assay_definitions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_assay_import_code_update();

COMMENT ON TRIGGER assay_definitions_import_code_immutable
ON public.assay_definitions IS
    'Keeps assay import codes stable across edits and soft deletion.';

DO $verification$
DECLARE
    v_assay_count BIGINT;
    v_null_count BIGINT;
    v_soft_deleted_null_count BIGINT;
    v_invalid_count BIGINT;
    v_duplicate_count BIGINT;
    v_sequence_last_value BIGINT;
    v_sequence_is_called BOOLEAN;
BEGIN
    SELECT
        count(*),
        count(*) FILTER (WHERE import_code IS NULL),
        count(*) FILTER (
            WHERE deleted_at IS NOT NULL
              AND import_code IS NULL
        ),
        count(*) FILTER (
            WHERE import_code !~ '^CT-[0-9]{6}$'
        )
    INTO
        v_assay_count,
        v_null_count,
        v_soft_deleted_null_count,
        v_invalid_count
    FROM public.assay_definitions;

    SELECT count(*)
    INTO v_duplicate_count
    FROM (
        SELECT import_code
        FROM public.assay_definitions
        GROUP BY import_code
        HAVING count(*) > 1
    ) AS duplicate_codes;

    IF v_null_count <> 0
       OR v_soft_deleted_null_count <> 0
       OR v_invalid_count <> 0
       OR v_duplicate_count <> 0
    THEN
        RAISE EXCEPTION
            'Migration 201 backfill verification failed: null %, soft-deleted null %, invalid %, duplicate %',
            v_null_count,
            v_soft_deleted_null_count,
            v_invalid_count,
            v_duplicate_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_sequences
        WHERE schemaname = 'public'
          AND sequencename = 'assay_import_code_seq'
          AND data_type = 'integer'
          AND increment_by = 1
          AND min_value = 1
          AND max_value = 999999
          AND cycle IS FALSE
    ) THEN
        RAISE EXCEPTION
            'Migration 201 sequence contract verification failed';
    END IF;

    SELECT last_value, is_called
    INTO v_sequence_last_value, v_sequence_is_called
    FROM public.assay_import_code_seq;

    IF (
        v_assay_count = 0
        AND (
            v_sequence_last_value <> 1
            OR v_sequence_is_called
        )
    )
       OR (
           v_assay_count > 0
           AND (
               v_sequence_last_value <> v_assay_count
               OR NOT v_sequence_is_called
           )
       )
    THEN
        RAISE EXCEPTION
            'Migration 201 sequence position verification failed';
    END IF;

    IF has_sequence_privilege(
        'anon',
        'public.assay_import_code_seq',
        'USAGE'
    )
       OR has_sequence_privilege(
           'anon',
           'public.assay_import_code_seq',
           'SELECT'
       )
       OR has_sequence_privilege(
           'anon',
           'public.assay_import_code_seq',
           'UPDATE'
       )
       OR has_sequence_privilege(
           'authenticated',
           'public.assay_import_code_seq',
           'USAGE'
       )
       OR has_sequence_privilege(
           'authenticated',
           'public.assay_import_code_seq',
           'SELECT'
       )
       OR has_sequence_privilege(
           'authenticated',
           'public.assay_import_code_seq',
           'UPDATE'
       )
       OR has_sequence_privilege(
           'service_role',
           'public.assay_import_code_seq',
           'USAGE'
       )
       OR has_sequence_privilege(
           'service_role',
           'public.assay_import_code_seq',
           'SELECT'
       )
       OR has_sequence_privilege(
           'service_role',
           'public.assay_import_code_seq',
           'UPDATE'
       )
    THEN
        RAISE EXCEPTION
            'Migration 201 exposed direct sequence allocation to an API role';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'assay_definitions'
          AND column_name = 'import_code'
          AND data_type = 'text'
          AND is_nullable = 'NO'
          AND column_default ILIKE '%__DATABASE_GENERATED__%'
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.assay_definitions'::REGCLASS
             AND tgname = 'assay_definitions_allocate_import_code'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.allocate_assay_import_code()'::REGPROCEDURE
             AND tgtype = 7
             AND tgattr = ''::INT2VECTOR
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.assay_definitions'::REGCLASS
             AND tgname = 'assay_definitions_import_code_immutable'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.prevent_assay_import_code_update()'::REGPROCEDURE
             AND tgtype = 19
             AND tgattr::TEXT = (
                 SELECT attnum::TEXT
                 FROM pg_attribute
                 WHERE attrelid =
                     'public.assay_definitions'::REGCLASS
                   AND attname = 'import_code'
                   AND NOT attisdropped
             )
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.assay_definitions'::REGCLASS
             AND tgname = 'update_assay_definitions_updated_at'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.update_updated_at_column()'::REGPROCEDURE
             AND tgtype = 19
             AND tgattr = ''::INT2VECTOR
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.assay_definitions'::REGCLASS
             AND tgname = 'audit_log_trigger'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.trigger_audit_log()'::REGPROCEDURE
             AND tgtype = 29
             AND tgattr = ''::INT2VECTOR
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION
            'Migration 201 schema or trigger verification failed';
    END IF;
END;
$verification$;

COMMIT;
