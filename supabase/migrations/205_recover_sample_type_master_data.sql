-- Migration 205: Recover sample-type master data foundation.
--
-- Migration 204 rolled back atomically because its historical samples
-- backfill fired the existing analyst-receiver enforcement trigger. This
-- forward-only recovery preserves the original contract while temporarily
-- disabling only that receiver trigger and the updated-at trigger.
--
-- Security impact:
-- - Adds RLS-protected sample_types master data with manager-only mutations.
-- - Keeps sequence allocation and trigger helpers inaccessible to API roles.
-- - Binds the existing audit trigger exactly to every sample-type mutation.
-- - Preserves the existing sample and assignment RPC permission boundaries.
--
-- Historical data impact:
-- - Aborts before changes when sample types are blank or collide after
--   normalization; the migration never guesses or merges ambiguous values.
-- - Creates one deterministic master row per historical sample type and links
--   every sample while preserving the legacy samples.type projection.
-- - Keeps audit logging enabled and preserves historical samples.updated_at.
-- - Fails atomically when any baseline or postcondition is not satisfied.

SELECT
    (
        to_regclass('public.sample_types') IS NULL
        AND to_regclass('public.sample_type_import_code_seq') IS NULL
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'samples'
              AND column_name = 'sample_type_id'
        )
    ) AS lims_sample_type_foundation_absent,
    (
        to_regclass('public.sample_types') IS NOT NULL
        AND to_regclass('public.sample_type_import_code_seq') IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'samples'
              AND column_name = 'sample_type_id'
        )
    ) AS lims_sample_type_foundation_present
\gset

\if :lims_sample_type_foundation_absent

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $table_baseline$
BEGIN
    IF to_regclass('public.samples') IS NULL THEN
        RAISE EXCEPTION 'Migration 205 requires public.samples';
    END IF;

    IF to_regclass('public.sample_types') IS NOT NULL
       OR to_regclass('public.sample_type_import_code_seq') IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 205 found an existing sample-type master-data object';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'samples'
          AND column_name = 'sample_type_id'
    ) THEN
        RAISE EXCEPTION
            'Migration 205 expected samples.sample_type_id to be absent';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'samples'
          AND column_name = 'id'
          AND data_type = 'uuid'
          AND is_nullable = 'NO'
    )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'samples'
             AND column_name = 'type'
             AND data_type = 'text'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.samples'::REGCLASS
             AND conname = 'samples_type_check'
             AND contype = 'c'
       )
    THEN
        RAISE EXCEPTION
            'Migration 205 found an incompatible samples baseline';
    END IF;

    IF to_regprocedure('public.trigger_audit_log()') IS NULL
       OR to_regprocedure('public.update_updated_at_column()') IS NULL
       OR to_regprocedure(
           'public.enforce_analyst_sample_receiver()'
       ) IS NULL
       OR to_regprocedure('public.get_user_role()') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 205 requires audit, timestamp, and role helpers';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::REGCLASS
          AND tgname = 'audit_samples_trigger'
          AND tgenabled = 'O'
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
          AND NOT tgisinternal
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.samples'::REGCLASS
             AND tgname = 'update_samples_updated_at'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.update_updated_at_column()'::REGPROCEDURE
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.samples'::REGCLASS
             AND tgname = 'samples_enforce_analyst_receiver'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.enforce_analyst_sample_receiver()'::REGPROCEDURE
             AND tgtype = 23
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION
            'Migration 205 requires exact samples audit/timestamp/receiver triggers';
    END IF;
END;
$table_baseline$;

LOCK TABLE public.samples IN ACCESS EXCLUSIVE MODE;

DO $function_baseline$
BEGIN
    IF to_regprocedure('public.normalize_sample_type_name(text)') IS NOT NULL
       OR to_regprocedure(
           'public.allocate_sample_type_import_code()'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.prevent_sample_type_import_code_update()'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.maintain_sample_type_lifecycle()'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.sync_sample_type_projection()'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.sync_sample_type_name_to_samples()'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 205 found a partial sample-type function contract';
    END IF;
END;
$function_baseline$;

CREATE FUNCTION public.normalize_sample_type_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT lower(
        regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g')
    );
$$;

REVOKE ALL ON FUNCTION public.normalize_sample_type_name(TEXT)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.normalize_sample_type_name(TEXT) IS
    'Normalizes sample-type names for exact collision detection and lookup.';

DO $historical_baseline$
DECLARE
    v_blank_count BIGINT;
    v_collision_count BIGINT;
    v_sample_type_count BIGINT;
BEGIN
    SELECT
        count(*) FILTER (
            WHERE type IS NULL
               OR btrim(type) = ''
        ),
        count(DISTINCT public.normalize_sample_type_name(type))
            FILTER (
                WHERE type IS NOT NULL
                  AND btrim(type) <> ''
            )
    INTO v_blank_count, v_sample_type_count
    FROM public.samples;

    SELECT count(*)
    INTO v_collision_count
    FROM (
        SELECT public.normalize_sample_type_name(type)
        FROM public.samples
        WHERE type IS NOT NULL
          AND btrim(type) <> ''
        GROUP BY public.normalize_sample_type_name(type)
        HAVING count(DISTINCT type) > 1
    ) AS collisions;

    IF v_blank_count <> 0 OR v_collision_count <> 0 THEN
        RAISE EXCEPTION
            'Migration 205 cannot map sample types: blank %, collisions %',
            v_blank_count,
            v_collision_count;
    END IF;

    IF v_sample_type_count > 999999 THEN
        RAISE EXCEPTION
            'Migration 205 exceeds the LM-NNNNNN code capacity';
    END IF;
END;
$historical_baseline$;

DO $assignment_baseline$
DECLARE
    v_accession_definition TEXT;
    v_assignment_definition TEXT;
BEGIN
    IF to_regprocedure(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
    ) IS NULL
       OR to_regprocedure(
           'public.assign_tests_to_sample(uuid,jsonb)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 205 requires the existing assignment RPC contracts';
    END IF;

    SELECT md5(pg_get_functiondef(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'::REGPROCEDURE
    ))
    INTO v_accession_definition;

    SELECT md5(pg_get_functiondef(
        'public.assign_tests_to_sample(uuid,jsonb)'::REGPROCEDURE
    ))
    INTO v_assignment_definition;

    PERFORM set_config(
        'lims.migration_205_accession_definition',
        v_accession_definition,
        true
    );
    PERFORM set_config(
        'lims.migration_205_assignment_definition',
        v_assignment_definition,
        true
    );
END;
$assignment_baseline$;

CREATE SEQUENCE public.sample_type_import_code_seq
AS INTEGER
INCREMENT BY 1
MINVALUE 1
MAXVALUE 999999
START WITH 1
NO CYCLE;

REVOKE ALL ON SEQUENCE public.sample_type_import_code_seq
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON SEQUENCE public.sample_type_import_code_seq IS
    'Global non-cycling allocator for immutable sample-type import codes.';

CREATE TABLE public.sample_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_code TEXT NOT NULL DEFAULT '__DATABASE_GENERATED__',
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    compatibility_generation BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT sample_types_import_code_format
        CHECK (import_code ~ '^LM-[0-9]{6}$'),
    CONSTRAINT sample_types_import_code_key UNIQUE (import_code),
    CONSTRAINT sample_types_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT sample_types_normalized_name_not_blank
        CHECK (btrim(normalized_name) <> ''),
    CONSTRAINT sample_types_normalized_name_key UNIQUE (normalized_name),
    CONSTRAINT sample_types_compatibility_generation_positive
        CHECK (compatibility_generation >= 1)
);

ALTER SEQUENCE public.sample_type_import_code_seq
OWNED BY public.sample_types.import_code;

CREATE INDEX idx_sample_types_active_name
ON public.sample_types (name)
WHERE deleted_at IS NULL;

CREATE TRIGGER audit_sample_types_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sample_types
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

WITH historical_types AS (
    SELECT
        min(btrim(type)) AS display_name,
        public.normalize_sample_type_name(type) AS normalized_name
    FROM public.samples
    GROUP BY public.normalize_sample_type_name(type)
),
ordered_types AS (
    SELECT
        display_name,
        normalized_name,
        row_number() OVER (
            ORDER BY normalized_name, display_name
        ) AS sequence_value
    FROM historical_types
)
INSERT INTO public.sample_types (
    import_code,
    name,
    normalized_name
)
SELECT
    'LM-' || lpad(ordered_type.sequence_value::TEXT, 6, '0'),
    ordered_type.display_name,
    ordered_type.normalized_name
FROM ordered_types AS ordered_type
ORDER BY ordered_type.sequence_value;

DO $advance_sequence$
DECLARE
    v_sample_type_count BIGINT;
BEGIN
    SELECT count(*)
    INTO v_sample_type_count
    FROM public.sample_types;

    IF v_sample_type_count > 0 THEN
        PERFORM setval(
            'public.sample_type_import_code_seq'::REGCLASS,
            v_sample_type_count,
            true
        );
    END IF;
END;
$advance_sequence$;

ALTER TABLE public.samples
    ADD COLUMN sample_type_id UUID;

ALTER TABLE public.samples
    DISABLE TRIGGER update_samples_updated_at;

ALTER TABLE public.samples
    DISABLE TRIGGER samples_enforce_analyst_receiver;

UPDATE public.samples AS sample
SET
    sample_type_id = sample_type.id,
    type = sample_type.name
FROM public.sample_types AS sample_type
WHERE sample_type.normalized_name =
    public.normalize_sample_type_name(sample.type);

ALTER TABLE public.samples
    ENABLE TRIGGER samples_enforce_analyst_receiver;

ALTER TABLE public.samples
    ENABLE TRIGGER update_samples_updated_at;

ALTER TABLE public.samples
    ALTER COLUMN sample_type_id SET NOT NULL;

ALTER TABLE public.samples
    ADD CONSTRAINT samples_sample_type_fk
    FOREIGN KEY (sample_type_id)
    REFERENCES public.sample_types(id)
    ON DELETE RESTRICT;

ALTER TABLE public.samples
    DROP CONSTRAINT samples_type_check;

CREATE INDEX idx_samples_sample_type_id
ON public.samples (sample_type_id);

CREATE FUNCTION public.allocate_sample_type_import_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.import_code IS DISTINCT FROM '__DATABASE_GENERATED__' THEN
        RAISE EXCEPTION
            'Sample type import code must be database generated'
            USING ERRCODE = '23514';
    END IF;

    NEW.import_code :=
        'LM-' ||
        lpad(
            nextval(
                'public.sample_type_import_code_seq'::REGCLASS
            )::TEXT,
            6,
            '0'
        );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_sample_type_import_code()
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.prevent_sample_type_import_code_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.import_code IS DISTINCT FROM OLD.import_code THEN
        RAISE EXCEPTION 'Sample type import code is immutable'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_sample_type_import_code_update()
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.maintain_sample_type_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.name := regexp_replace(
        btrim(NEW.name),
        '[[:space:]]+',
        ' ',
        'g'
    );

    IF NEW.name = '' THEN
        RAISE EXCEPTION 'Sample type name must not be blank'
            USING ERRCODE = '23514';
    END IF;

    NEW.normalized_name :=
        public.normalize_sample_type_name(NEW.name);

    IF TG_OP = 'INSERT' THEN
        NEW.compatibility_generation := 1;
    ELSIF NEW.normalized_name IS DISTINCT FROM OLD.normalized_name
       OR (NEW.deleted_at IS NULL) IS DISTINCT FROM
          (OLD.deleted_at IS NULL)
    THEN
        NEW.compatibility_generation :=
            OLD.compatibility_generation + 1;
    ELSE
        NEW.compatibility_generation :=
            OLD.compatibility_generation;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maintain_sample_type_lifecycle()
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.sync_sample_type_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sample_type_id UUID;
    v_sample_type_name TEXT;
    v_normalized_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.sample_type_id IS NULL THEN
            IF NEW.type IS NULL OR btrim(NEW.type) = '' THEN
                RAISE EXCEPTION 'Sample type is required'
                    USING ERRCODE = '23514';
            END IF;

            SELECT
                sample_type.id,
                sample_type.name,
                sample_type.normalized_name
            INTO
                v_sample_type_id,
                v_sample_type_name,
                v_normalized_name
            FROM public.sample_types AS sample_type
            WHERE sample_type.normalized_name =
                    public.normalize_sample_type_name(NEW.type)
              AND sample_type.deleted_at IS NULL;
        ELSE
            SELECT
                sample_type.id,
                sample_type.name,
                sample_type.normalized_name
            INTO
                v_sample_type_id,
                v_sample_type_name,
                v_normalized_name
            FROM public.sample_types AS sample_type
            WHERE sample_type.id = NEW.sample_type_id
              AND sample_type.deleted_at IS NULL;

            IF v_sample_type_id IS NOT NULL
               AND NEW.type IS NOT NULL
               AND public.normalize_sample_type_name(NEW.type)
                   IS DISTINCT FROM v_normalized_name
            THEN
                RAISE EXCEPTION
                    'Sample type id and legacy projection do not match'
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    ELSIF NEW.sample_type_id IS DISTINCT FROM OLD.sample_type_id THEN
        SELECT
            sample_type.id,
            sample_type.name,
            sample_type.normalized_name
        INTO
            v_sample_type_id,
            v_sample_type_name,
            v_normalized_name
        FROM public.sample_types AS sample_type
        WHERE sample_type.id = NEW.sample_type_id
          AND sample_type.deleted_at IS NULL;

        IF v_sample_type_id IS NOT NULL
           AND NEW.type IS DISTINCT FROM OLD.type
           AND public.normalize_sample_type_name(NEW.type)
               IS DISTINCT FROM v_normalized_name
        THEN
            RAISE EXCEPTION
                'Sample type id and legacy projection do not match'
                USING ERRCODE = '23514';
        END IF;
    ELSIF NEW.type IS DISTINCT FROM OLD.type THEN
        SELECT
            sample_type.id,
            sample_type.name,
            sample_type.normalized_name
        INTO
            v_sample_type_id,
            v_sample_type_name,
            v_normalized_name
        FROM public.sample_types AS sample_type
        WHERE sample_type.id = OLD.sample_type_id;

        IF v_sample_type_id IS NULL
           OR public.normalize_sample_type_name(NEW.type)
              IS DISTINCT FROM v_normalized_name
        THEN
            SELECT
                sample_type.id,
                sample_type.name,
                sample_type.normalized_name
            INTO
                v_sample_type_id,
                v_sample_type_name,
                v_normalized_name
            FROM public.sample_types AS sample_type
            WHERE sample_type.normalized_name =
                    public.normalize_sample_type_name(NEW.type)
              AND sample_type.deleted_at IS NULL;
        END IF;
    ELSE
        RETURN NEW;
    END IF;

    IF v_sample_type_id IS NULL THEN
        RAISE EXCEPTION 'Sample type does not exist or is inactive'
            USING ERRCODE = '23503';
    END IF;

    NEW.sample_type_id := v_sample_type_id;
    NEW.type := v_sample_type_name;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sample_type_projection()
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.sync_sample_type_name_to_samples()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.samples
    SET type = NEW.name
    WHERE sample_type_id = NEW.id
      AND type IS DISTINCT FROM NEW.name;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sample_type_name_to_samples()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER sample_types_allocate_import_code
BEFORE INSERT ON public.sample_types
FOR EACH ROW
EXECUTE FUNCTION public.allocate_sample_type_import_code();

CREATE TRIGGER sample_types_import_code_immutable
BEFORE UPDATE OF import_code ON public.sample_types
FOR EACH ROW
EXECUTE FUNCTION public.prevent_sample_type_import_code_update();

CREATE TRIGGER sample_types_maintain_lifecycle
BEFORE INSERT OR UPDATE OF
    name,
    normalized_name,
    deleted_at,
    compatibility_generation
ON public.sample_types
FOR EACH ROW
EXECUTE FUNCTION public.maintain_sample_type_lifecycle();

CREATE TRIGGER update_sample_types_updated_at
BEFORE UPDATE ON public.sample_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER samples_apply_sample_type_projection
BEFORE INSERT OR UPDATE OF sample_type_id, type ON public.samples
FOR EACH ROW
EXECUTE FUNCTION public.sync_sample_type_projection();

CREATE TRIGGER sample_types_sync_sample_projection
AFTER UPDATE OF name ON public.sample_types
FOR EACH ROW
WHEN (NEW.name IS DISTINCT FROM OLD.name)
EXECUTE FUNCTION public.sync_sample_type_name_to_samples();

ALTER TABLE public.sample_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sample types"
ON public.sample_types;
CREATE POLICY "Authenticated users can read sample types"
ON public.sample_types
FOR SELECT
TO authenticated
USING (
    (SELECT public.get_user_role()) IN ('analyst', 'manager')
    AND (
        deleted_at IS NULL
        OR (SELECT public.get_user_role()) = 'manager'
    )
);

DROP POLICY IF EXISTS "Managers can insert sample types"
ON public.sample_types;
CREATE POLICY "Managers can insert sample types"
ON public.sample_types
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.get_user_role()) = 'manager');

DROP POLICY IF EXISTS "Managers can update sample types"
ON public.sample_types;
CREATE POLICY "Managers can update sample types"
ON public.sample_types
FOR UPDATE
TO authenticated
USING ((SELECT public.get_user_role()) = 'manager')
WITH CHECK ((SELECT public.get_user_role()) = 'manager');

REVOKE ALL ON TABLE public.sample_types
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.sample_types TO authenticated;
GRANT INSERT (name), UPDATE (name, deleted_at)
ON TABLE public.sample_types TO authenticated;
GRANT SELECT ON TABLE public.sample_types TO service_role;

DO $verification$
DECLARE
    v_sample_type_count BIGINT;
    v_invalid_code_count BIGINT;
    v_duplicate_code_count BIGINT;
    v_duplicate_name_count BIGINT;
    v_unlinked_sample_count BIGINT;
    v_projection_mismatch_count BIGINT;
    v_sequence_last_value BIGINT;
    v_sequence_is_called BOOLEAN;
BEGIN
    SELECT
        count(*),
        count(*) FILTER (
            WHERE import_code !~ '^LM-[0-9]{6}$'
        )
    INTO v_sample_type_count, v_invalid_code_count
    FROM public.sample_types;

    SELECT count(*)
    INTO v_duplicate_code_count
    FROM (
        SELECT import_code
        FROM public.sample_types
        GROUP BY import_code
        HAVING count(*) > 1
    ) AS duplicate_codes;

    SELECT count(*)
    INTO v_duplicate_name_count
    FROM (
        SELECT normalized_name
        FROM public.sample_types
        GROUP BY normalized_name
        HAVING count(*) > 1
    ) AS duplicate_names;

    SELECT
        count(*) FILTER (
            WHERE sample_type_id IS NULL
        ),
        count(*) FILTER (
            WHERE sample.type IS DISTINCT FROM sample_type.name
        )
    INTO v_unlinked_sample_count, v_projection_mismatch_count
    FROM public.samples AS sample
    LEFT JOIN public.sample_types AS sample_type
        ON sample_type.id = sample.sample_type_id;

    IF v_invalid_code_count <> 0
       OR v_duplicate_code_count <> 0
       OR v_duplicate_name_count <> 0
    THEN
        RAISE EXCEPTION
            'Migration 205 sample-type verification failed';
    END IF;

    IF v_unlinked_sample_count <> 0
       OR v_projection_mismatch_count <> 0
    THEN
        RAISE EXCEPTION
            'Migration 205 sample backfill verification failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_sequences
        WHERE schemaname = 'public'
          AND sequencename = 'sample_type_import_code_seq'
          AND data_type = 'integer'::REGTYPE
          AND increment_by = 1
          AND min_value = 1
          AND max_value = 999999
          AND cycle IS FALSE
    ) THEN
        RAISE EXCEPTION
            'Migration 205 sequence contract verification failed';
    END IF;

    SELECT last_value, is_called
    INTO v_sequence_last_value, v_sequence_is_called
    FROM public.sample_type_import_code_seq;

    IF (
        v_sample_type_count = 0
        AND (
            v_sequence_last_value <> 1
            OR v_sequence_is_called
        )
    )
       OR (
           v_sample_type_count > 0
           AND (
               v_sequence_last_value <> v_sample_type_count
               OR NOT v_sequence_is_called
           )
       )
    THEN
        RAISE EXCEPTION
            'Migration 205 sequence position verification failed';
    END IF;

    IF has_sequence_privilege(
        'anon',
        'public.sample_type_import_code_seq',
        'USAGE'
    )
       OR has_sequence_privilege(
           'authenticated',
           'public.sample_type_import_code_seq',
           'USAGE'
       )
       OR has_sequence_privilege(
           'service_role',
           'public.sample_type_import_code_seq',
           'USAGE'
       )
    THEN
        RAISE EXCEPTION
            'Migration 205 exposed sequence allocation to an API role';
    END IF;

    IF NOT has_table_privilege(
        'authenticated',
        'public.sample_types',
        'SELECT'
    )
       OR has_table_privilege(
           'authenticated',
           'public.sample_types',
           'DELETE'
       )
       OR NOT has_column_privilege(
           'authenticated',
           'public.sample_types',
           'name',
           'INSERT'
       )
       OR NOT has_column_privilege(
           'authenticated',
           'public.sample_types',
           'deleted_at',
           'UPDATE'
       )
       OR has_column_privilege(
           'authenticated',
           'public.sample_types',
           'import_code',
           'UPDATE'
       )
    THEN
        RAISE EXCEPTION
            'Migration 205 table privilege verification failed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.sample_types'::REGCLASS
          AND tgname = 'audit_sample_types_trigger'
          AND tgenabled = 'O'
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
          AND NOT tgisinternal
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.sample_types'::REGCLASS
             AND tgname = 'update_sample_types_updated_at'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.update_updated_at_column()'::REGPROCEDURE
             AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'public.samples'::REGCLASS
             AND tgname = 'samples_enforce_analyst_receiver'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.enforce_analyst_sample_receiver()'::REGPROCEDURE
             AND tgtype = 23
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION
            'Migration 205 trigger binding verification failed';
    END IF;
END;
$verification$;

DO $assignment_verification$
BEGIN
    IF current_setting(
        'lims.migration_205_accession_definition',
        true
    ) IS DISTINCT FROM md5(pg_get_functiondef(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'::REGPROCEDURE
    ))
       OR current_setting(
           'lims.migration_205_assignment_definition',
           true
       ) IS DISTINCT FROM md5(pg_get_functiondef(
           'public.assign_tests_to_sample(uuid,jsonb)'::REGPROCEDURE
       ))
    THEN
        RAISE EXCEPTION
            'Migration 205 changed an assignment RPC contract';
    END IF;
END;
$assignment_verification$;

COMMENT ON TABLE public.sample_types IS
    'Audited sample-type master data with immutable LM import codes.';
COMMENT ON COLUMN public.sample_types.import_code IS
    'Database-generated immutable identifier in LM-NNNNNN format.';
COMMENT ON COLUMN public.sample_types.normalized_name IS
    'Database-maintained normalized name used for collision-safe lookup.';
COMMENT ON COLUMN public.sample_types.compatibility_generation IS
    'Monotonic lifecycle generation for compatibility snapshot staleness.';
COMMENT ON COLUMN public.samples.sample_type_id IS
    'Source-of-truth sample-type reference; samples.type is a projection.';

COMMIT;

\elif :lims_sample_type_foundation_present

\echo 'Migration 205: sample-type master-data foundation already present'

\else

DO $partial_foundation$
BEGIN
    RAISE EXCEPTION
        'Migration 205 found a partial sample-type master-data foundation';
END;
$partial_foundation$;

\endif

\unset lims_sample_type_foundation_absent
\unset lims_sample_type_foundation_present
