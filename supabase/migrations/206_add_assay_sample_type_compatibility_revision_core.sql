-- Migration 206: Add assay/sample-type compatibility revision core.
--
-- Security impact:
-- - Adds four RLS-enabled internal catalog tables with no authenticated access.
-- - Grants service_role read-only access for operational inspection only.
-- - Keeps all catalog mutations behind future manager-only RPCs.
-- - Binds the existing audit trigger exactly to every catalog table.
--
-- Historical data impact:
-- - Adds database-owned lifecycle generation to assay_definitions.
-- - Bootstraps exactly one revision 1 draft from an empty catalog baseline.
-- - Records historical result pairs as non-authoritative review candidates.
-- - Aborts atomically if the Phase 1 baseline or any postcondition is invalid.
-- - Does not add compatibility resolution or change assignment behavior.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $table_baseline$
BEGIN
    IF to_regclass('public.assay_definitions') IS NULL THEN
        RAISE EXCEPTION
            'Migration 206 requires public.assay_definitions';
    END IF;

    IF to_regclass('public.sample_types') IS NULL THEN
        RAISE EXCEPTION
            'Migration 206 requires public.sample_types from migration 205';
    END IF;

    IF to_regclass('public.samples') IS NULL THEN
        RAISE EXCEPTION 'Migration 206 requires public.samples';
    END IF;

    IF to_regclass('public.results') IS NULL THEN
        RAISE EXCEPTION 'Migration 206 requires public.results';
    END IF;

    IF to_regclass('public.audit_logs') IS NULL THEN
        RAISE EXCEPTION 'Migration 206 requires public.audit_logs';
    END IF;

    IF to_regclass(
        'public.assay_sample_type_catalog_revisions'
    ) IS NOT NULL
       OR to_regclass(
           'public.assay_sample_type_reviews'
       ) IS NOT NULL
       OR to_regclass(
           'public.assay_sample_type_compatibilities'
       ) IS NOT NULL
       OR to_regclass(
           'public.assay_sample_type_candidates'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 206 expected compatibility catalog tables to be absent';
    END IF;
END;
$table_baseline$;

LOCK TABLE public.assay_definitions IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.sample_types, public.samples, public.results
IN SHARE ROW EXCLUSIVE MODE;

DO $schema_baseline$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'assay_definitions'
          AND column_name = 'compatibility_generation'
    ) THEN
        RAISE EXCEPTION
            'Migration 206 expected assay compatibility generation to be absent';
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
             AND column_name = 'method_name'
             AND data_type = 'text'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'assay_definitions'
             AND column_name = 'deleted_at'
             AND data_type = 'timestamp with time zone'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'sample_types'
             AND column_name = 'id'
             AND data_type = 'uuid'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'sample_types'
             AND column_name = 'compatibility_generation'
             AND data_type = 'bigint'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'samples'
             AND column_name = 'sample_type_id'
             AND data_type = 'uuid'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'results'
             AND column_name = 'assay_id'
             AND data_type = 'uuid'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'results'
             AND column_name = 'sample_id'
             AND data_type = 'uuid'
             AND is_nullable = 'NO'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'results'
             AND column_name = 'created_at'
             AND data_type = 'timestamp with time zone'
             AND is_nullable = 'NO'
       )
    THEN
        RAISE EXCEPTION
            'Migration 206 found an incompatible Phase 1 schema baseline';
    END IF;

    IF to_regprocedure(
        'public.trigger_audit_log()'
    ) IS NULL
       OR to_regprocedure(
           'public.update_updated_at_column()'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 206 requires timestamp and audit trigger functions';
    END IF;

    IF to_regprocedure(
        'public.maintain_assay_compatibility_generation()'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.guard_compatibility_revision_mutation()'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.guard_compatibility_entry_mutation()'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Migration 206 found a partial compatibility function contract';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.assay_definitions'::REGCLASS
          AND tgname = 'audit_log_trigger'
          AND tgenabled = 'O'
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
          AND NOT tgisinternal
    )
       OR NOT EXISTS (
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
             AND tgname = 'sample_types_maintain_lifecycle'
             AND tgenabled = 'O'
             AND tgfoid =
                 'public.maintain_sample_type_lifecycle()'::REGPROCEDURE
             AND NOT tgisinternal
       )
    THEN
        RAISE EXCEPTION
            'Migration 206 requires enabled audit and sample-type lifecycle triggers';
    END IF;
END;
$schema_baseline$;

DO $historical_baseline$
DECLARE
    v_orphan_result_count BIGINT;
BEGIN
    SELECT count(*)
    INTO v_orphan_result_count
    FROM public.results AS result
    LEFT JOIN public.samples AS sample
        ON sample.id = result.sample_id
    LEFT JOIN public.sample_types AS sample_type
        ON sample_type.id = sample.sample_type_id
    LEFT JOIN public.assay_definitions AS assay
        ON assay.id = result.assay_id
    WHERE sample.id IS NULL
       OR sample_type.id IS NULL
       OR assay.id IS NULL;

    IF v_orphan_result_count <> 0 THEN
        RAISE EXCEPTION
            'Migration 206 found % historical results without canonical assay/sample-type references',
            v_orphan_result_count;
    END IF;
END;
$historical_baseline$;

ALTER TABLE public.assay_definitions
    ADD COLUMN compatibility_generation BIGINT NOT NULL DEFAULT 1,
    ADD CONSTRAINT assay_definitions_compatibility_generation_positive
        CHECK (compatibility_generation >= 1);

COMMENT ON COLUMN public.assay_definitions.compatibility_generation IS
    'Database-owned lifecycle generation used by compatibility snapshots.';

CREATE FUNCTION public.maintain_assay_compatibility_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.compatibility_generation := 1;
    ELSIF NEW.method_name IS DISTINCT FROM OLD.method_name
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

REVOKE ALL ON FUNCTION public.maintain_assay_compatibility_generation()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.maintain_assay_compatibility_generation() IS
    'Owns assay compatibility generation for method and lifecycle changes.';

CREATE TRIGGER assay_definitions_maintain_compatibility_generation
BEFORE INSERT OR UPDATE OF
    method_name,
    deleted_at,
    compatibility_generation
ON public.assay_definitions
FOR EACH ROW
EXECUTE FUNCTION public.maintain_assay_compatibility_generation();

COMMENT ON TRIGGER assay_definitions_maintain_compatibility_generation
ON public.assay_definitions IS
    'Makes compatibility snapshots stale after method or lifecycle changes.';

CREATE TABLE public.assay_sample_type_catalog_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    revision_number BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    source_revision_id UUID,
    created_actor_type TEXT NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    creation_reason TEXT NOT NULL,
    content_hash TEXT,
    published_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    published_at TIMESTAMPTZ,
    publish_reason TEXT,
    superseded_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    superseded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT assay_sample_type_catalog_revision_number_positive
        CHECK (revision_number >= 1),
    CONSTRAINT assay_sample_type_catalog_revision_number_key
        UNIQUE (revision_number),
    CONSTRAINT assay_sample_type_catalog_status
        CHECK (status IN ('draft', 'published', 'superseded')),
    CONSTRAINT assay_sample_type_catalog_actor_type
        CHECK (created_actor_type IN ('system_migration', 'manager')),
    CONSTRAINT assay_sample_type_catalog_actor_identity
        CHECK (
            (
                created_actor_type = 'system_migration'
                AND created_by IS NULL
            )
            OR (
                created_actor_type = 'manager'
                AND created_by IS NOT NULL
            )
        ),
    CONSTRAINT assay_sample_type_catalog_creation_reason_not_blank
        CHECK (btrim(creation_reason) <> ''),
    CONSTRAINT assay_sample_type_catalog_source_revision
        CHECK (
            (
                revision_number = 1
                AND source_revision_id IS NULL
            )
            OR (
                revision_number > 1
                AND source_revision_id IS NOT NULL
            )
        ),
    CONSTRAINT assay_sample_type_catalog_content_hash
        CHECK (
            content_hash IS NULL
            OR content_hash ~ '^[0-9a-f]{64}$'
        ),
    CONSTRAINT assay_sample_type_catalog_publish_reason_not_blank
        CHECK (
            publish_reason IS NULL
            OR btrim(publish_reason) <> ''
        ),
    CONSTRAINT assay_sample_type_catalog_status_fields
        CHECK (
            (
                status = 'draft'
                AND content_hash IS NULL
                AND published_by IS NULL
                AND published_at IS NULL
                AND publish_reason IS NULL
                AND superseded_by IS NULL
                AND superseded_at IS NULL
            )
            OR (
                status = 'published'
                AND content_hash IS NOT NULL
                AND published_by IS NOT NULL
                AND published_at IS NOT NULL
                AND publish_reason IS NOT NULL
                AND superseded_by IS NULL
                AND superseded_at IS NULL
            )
            OR (
                status = 'superseded'
                AND content_hash IS NOT NULL
                AND published_by IS NOT NULL
                AND published_at IS NOT NULL
                AND publish_reason IS NOT NULL
                AND superseded_by IS NOT NULL
                AND superseded_at IS NOT NULL
            )
        ),
    CONSTRAINT assay_sample_type_catalog_timestamp_order
        CHECK (
            (published_at IS NULL OR published_at >= created_at)
            AND (
                superseded_at IS NULL
                OR (
                    published_at IS NOT NULL
                    AND superseded_at >= published_at
                )
            )
        )
);

ALTER TABLE public.assay_sample_type_catalog_revisions
    ADD CONSTRAINT assay_sample_type_catalog_source_revision_fk
    FOREIGN KEY (source_revision_id)
    REFERENCES public.assay_sample_type_catalog_revisions(id)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_assay_sample_type_catalog_one_draft
ON public.assay_sample_type_catalog_revisions ((TRUE))
WHERE status = 'draft';

CREATE UNIQUE INDEX uq_assay_sample_type_catalog_one_published
ON public.assay_sample_type_catalog_revisions ((TRUE))
WHERE status = 'published';

CREATE INDEX idx_assay_sample_type_catalog_source_revision
ON public.assay_sample_type_catalog_revisions (source_revision_id)
WHERE source_revision_id IS NOT NULL;

COMMENT ON TABLE public.assay_sample_type_catalog_revisions IS
    'Immutable global compatibility revision headers; only one draft and one current published revision may exist.';

CREATE TABLE public.assay_sample_type_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    revision_id UUID NOT NULL
        REFERENCES public.assay_sample_type_catalog_revisions(id)
        ON DELETE RESTRICT,
    assay_definition_id UUID NOT NULL
        REFERENCES public.assay_definitions(id)
        ON DELETE RESTRICT,
    disposition TEXT NOT NULL,
    assay_compatibility_generation BIGINT NOT NULL,
    reviewed_by UUID NOT NULL
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT assay_sample_type_review_disposition
        CHECK (disposition IN ('configured', 'not_assignable')),
    CONSTRAINT assay_sample_type_review_generation_positive
        CHECK (assay_compatibility_generation >= 1),
    CONSTRAINT assay_sample_type_review_reason
        CHECK (
            (
                disposition = 'configured'
                AND (
                    reason IS NULL
                    OR btrim(reason) <> ''
                )
            )
            OR (
                disposition = 'not_assignable'
                AND reason IS NOT NULL
                AND btrim(reason) <> ''
            )
        ),
    CONSTRAINT assay_sample_type_review_revision_assay_key
        UNIQUE (revision_id, assay_definition_id)
);

CREATE INDEX idx_assay_sample_type_reviews_assay
ON public.assay_sample_type_reviews (assay_definition_id, revision_id);

COMMENT ON TABLE public.assay_sample_type_reviews IS
    'Per-assay reviewed disposition and lifecycle generation snapshot within a catalog revision.';

CREATE TABLE public.assay_sample_type_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    revision_id UUID NOT NULL
        REFERENCES public.assay_sample_type_catalog_revisions(id)
        ON DELETE RESTRICT,
    assay_definition_id UUID NOT NULL
        REFERENCES public.assay_definitions(id)
        ON DELETE RESTRICT,
    sample_type_id UUID NOT NULL
        REFERENCES public.sample_types(id)
        ON DELETE RESTRICT,
    provenance TEXT NOT NULL DEFAULT 'historical_observation',
    observation_count BIGINT NOT NULL,
    first_observed_at TIMESTAMPTZ NOT NULL,
    last_observed_at TIMESTAMPTZ NOT NULL,
    assay_compatibility_generation BIGINT NOT NULL,
    sample_type_compatibility_generation BIGINT NOT NULL,
    decision TEXT,
    decided_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    decided_at TIMESTAMPTZ,
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT assay_sample_type_candidate_provenance
        CHECK (provenance = 'historical_observation'),
    CONSTRAINT assay_sample_type_candidate_observation_count_positive
        CHECK (observation_count >= 1),
    CONSTRAINT assay_sample_type_candidate_observation_order
        CHECK (first_observed_at <= last_observed_at),
    CONSTRAINT assay_sample_type_candidate_assay_generation_positive
        CHECK (assay_compatibility_generation >= 1),
    CONSTRAINT assay_sample_type_candidate_sample_generation_positive
        CHECK (sample_type_compatibility_generation >= 1),
    CONSTRAINT assay_sample_type_candidate_decision
        CHECK (decision IS NULL OR decision IN ('accepted', 'rejected')),
    CONSTRAINT assay_sample_type_candidate_decision_fields
        CHECK (
            (
                decision IS NULL
                AND decided_by IS NULL
                AND decided_at IS NULL
                AND decision_reason IS NULL
            )
            OR (
                decision IS NOT NULL
                AND decided_by IS NOT NULL
                AND decided_at IS NOT NULL
                AND decision_reason IS NOT NULL
                AND btrim(decision_reason) <> ''
            )
        ),
    CONSTRAINT assay_sample_type_candidate_revision_pair_key
        UNIQUE (revision_id, assay_definition_id, sample_type_id),
    CONSTRAINT assay_sample_type_candidate_source_key
        UNIQUE (
            id,
            revision_id,
            assay_definition_id,
            sample_type_id
        )
);

CREATE INDEX idx_assay_sample_type_candidates_decision
ON public.assay_sample_type_candidates (revision_id, decision);

CREATE INDEX idx_assay_sample_type_candidates_assay
ON public.assay_sample_type_candidates (
    assay_definition_id,
    sample_type_id
);

COMMENT ON TABLE public.assay_sample_type_candidates IS
    'Non-authoritative historical observations requiring explicit manager acceptance or rejection.';

CREATE TABLE public.assay_sample_type_compatibilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    revision_id UUID NOT NULL
        REFERENCES public.assay_sample_type_catalog_revisions(id)
        ON DELETE RESTRICT,
    assay_definition_id UUID NOT NULL
        REFERENCES public.assay_definitions(id)
        ON DELETE RESTRICT,
    sample_type_id UUID NOT NULL
        REFERENCES public.sample_types(id)
        ON DELETE RESTRICT,
    assay_compatibility_generation BIGINT NOT NULL,
    sample_type_compatibility_generation BIGINT NOT NULL,
    provenance TEXT NOT NULL,
    source_candidate_id UUID,
    added_by UUID NOT NULL
        REFERENCES public.users(id)
        ON DELETE RESTRICT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    removed_at TIMESTAMPTZ,
    removal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT assay_sample_type_compatibility_assay_generation_positive
        CHECK (assay_compatibility_generation >= 1),
    CONSTRAINT assay_sample_type_compatibility_sample_generation_positive
        CHECK (sample_type_compatibility_generation >= 1),
    CONSTRAINT assay_sample_type_compatibility_provenance
        CHECK (provenance IN ('manual', 'historical_candidate')),
    CONSTRAINT assay_sample_type_compatibility_candidate_source
        CHECK (
            (
                provenance = 'manual'
                AND source_candidate_id IS NULL
            )
            OR (
                provenance = 'historical_candidate'
                AND source_candidate_id IS NOT NULL
            )
        ),
    CONSTRAINT assay_sample_type_compatibility_removal_fields
        CHECK (
            (
                removed_at IS NULL
                AND removed_by IS NULL
                AND removal_reason IS NULL
            )
            OR (
                removed_at IS NOT NULL
                AND removed_by IS NOT NULL
                AND removal_reason IS NOT NULL
                AND btrim(removal_reason) <> ''
            )
        ),
    CONSTRAINT assay_sample_type_compatibility_revision_pair_key
        UNIQUE (revision_id, assay_definition_id, sample_type_id),
    CONSTRAINT assay_sample_type_compatibility_candidate_fk
        FOREIGN KEY (
            source_candidate_id,
            revision_id,
            assay_definition_id,
            sample_type_id
        )
        REFERENCES public.assay_sample_type_candidates (
            id,
            revision_id,
            assay_definition_id,
            sample_type_id
        )
        ON DELETE RESTRICT
);

CREATE INDEX idx_assay_sample_type_compatibilities_active
ON public.assay_sample_type_compatibilities (
    revision_id,
    assay_definition_id,
    sample_type_id
)
WHERE removed_at IS NULL;

CREATE INDEX idx_assay_sample_type_compatibilities_sample_type
ON public.assay_sample_type_compatibilities (
    sample_type_id,
    assay_definition_id
);

COMMENT ON TABLE public.assay_sample_type_compatibilities IS
    'Reviewed allowlist pairs; candidates alone never grant assignment authority.';

CREATE FUNCTION public.guard_compatibility_revision_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Compatibility revisions cannot be deleted'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.revision_number IS DISTINCT FROM OLD.revision_number
       OR NEW.source_revision_id IS DISTINCT FROM OLD.source_revision_id
       OR NEW.created_actor_type IS DISTINCT FROM OLD.created_actor_type
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.creation_reason IS DISTINCT FROM OLD.creation_reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'Compatibility revision identity is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'draft' THEN
        IF NEW.status NOT IN ('draft', 'published') THEN
            RAISE EXCEPTION
                'Draft compatibility revision may only remain draft or publish'
                USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD.status = 'published' THEN
        IF NEW.status = 'superseded'
           AND NEW.content_hash IS NOT DISTINCT FROM OLD.content_hash
           AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
           AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
           AND NEW.publish_reason IS NOT DISTINCT FROM OLD.publish_reason
           AND NEW.superseded_by IS NOT NULL
           AND NEW.superseded_at IS NOT NULL
        THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION
            'Published compatibility revision is immutable except supersession'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'superseded' THEN
        RAISE EXCEPTION 'Superseded compatibility revision is immutable'
            USING ERRCODE = '23514';
    END IF;

    RAISE EXCEPTION 'Unknown compatibility revision state'
        USING ERRCODE = '23514';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_compatibility_revision_mutation()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.guard_compatibility_revision_mutation() IS
    'Prevents hard deletion and mutation of published or superseded revision content.';

CREATE FUNCTION public.guard_compatibility_entry_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_revision_id UUID;
    v_revision_status TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Compatibility catalog entries cannot be deleted'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.revision_id IS DISTINCT FROM OLD.revision_id
    THEN
        RAISE EXCEPTION 'Compatibility entry revision is immutable'
            USING ERRCODE = '23514';
    END IF;

    v_revision_id := NEW.revision_id;

    SELECT revision.status
    INTO v_revision_status
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.id = v_revision_id
    FOR KEY SHARE;

    IF v_revision_status IS NULL THEN
        RAISE EXCEPTION 'Compatibility entry revision does not exist'
            USING ERRCODE = '23503';
    END IF;

    IF v_revision_status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION
            'Published or superseded compatibility entries are immutable'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_compatibility_entry_mutation()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.guard_compatibility_entry_mutation() IS
    'Allows inserts and updates only while the owning compatibility revision is draft.';

CREATE TRIGGER guard_assay_sample_type_catalog_revision
BEFORE UPDATE OR DELETE
ON public.assay_sample_type_catalog_revisions
FOR EACH ROW
EXECUTE FUNCTION public.guard_compatibility_revision_mutation();

CREATE TRIGGER guard_assay_sample_type_reviews
BEFORE INSERT OR UPDATE OR DELETE
ON public.assay_sample_type_reviews
FOR EACH ROW
EXECUTE FUNCTION public.guard_compatibility_entry_mutation();

CREATE TRIGGER guard_assay_sample_type_candidates
BEFORE INSERT OR UPDATE OR DELETE
ON public.assay_sample_type_candidates
FOR EACH ROW
EXECUTE FUNCTION public.guard_compatibility_entry_mutation();

CREATE TRIGGER guard_assay_sample_type_compatibilities
BEFORE INSERT OR UPDATE OR DELETE
ON public.assay_sample_type_compatibilities
FOR EACH ROW
EXECUTE FUNCTION public.guard_compatibility_entry_mutation();

CREATE TRIGGER update_assay_sample_type_catalog_revisions_updated_at
BEFORE UPDATE
ON public.assay_sample_type_catalog_revisions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assay_sample_type_reviews_updated_at
BEFORE UPDATE
ON public.assay_sample_type_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assay_sample_type_candidates_updated_at
BEFORE UPDATE
ON public.assay_sample_type_candidates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assay_sample_type_compatibilities_updated_at
BEFORE UPDATE
ON public.assay_sample_type_compatibilities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_assay_sample_type_catalog_revisions
AFTER INSERT OR UPDATE OR DELETE
ON public.assay_sample_type_catalog_revisions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

CREATE TRIGGER audit_assay_sample_type_reviews
AFTER INSERT OR UPDATE OR DELETE
ON public.assay_sample_type_reviews
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

CREATE TRIGGER audit_assay_sample_type_candidates
AFTER INSERT OR UPDATE OR DELETE
ON public.assay_sample_type_candidates
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

CREATE TRIGGER audit_assay_sample_type_compatibilities
AFTER INSERT OR UPDATE OR DELETE
ON public.assay_sample_type_compatibilities
FOR EACH ROW
EXECUTE FUNCTION public.trigger_audit_log();

ALTER TABLE public.assay_sample_type_catalog_revisions
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assay_sample_type_reviews
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assay_sample_type_candidates
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assay_sample_type_compatibilities
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.assay_sample_type_catalog_revisions
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.assay_sample_type_reviews
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.assay_sample_type_candidates
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.assay_sample_type_compatibilities
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.assay_sample_type_catalog_revisions
TO service_role;
GRANT SELECT ON TABLE public.assay_sample_type_reviews
TO service_role;
GRANT SELECT ON TABLE public.assay_sample_type_candidates
TO service_role;
GRANT SELECT ON TABLE public.assay_sample_type_compatibilities
TO service_role;

DO $bootstrap$
DECLARE
    v_revision_id UUID;
BEGIN
    INSERT INTO public.assay_sample_type_catalog_revisions (
        revision_number,
        status,
        source_revision_id,
        created_actor_type,
        created_by,
        creation_reason
    )
    VALUES (
        1,
        'draft',
        NULL,
        'system_migration',
        NULL,
        'Initial compatibility catalog bootstrap'
    )
    RETURNING id INTO v_revision_id;

    INSERT INTO public.assay_sample_type_candidates (
        revision_id,
        assay_definition_id,
        sample_type_id,
        provenance,
        observation_count,
        first_observed_at,
        last_observed_at,
        assay_compatibility_generation,
        sample_type_compatibility_generation
    )
    SELECT
        v_revision_id,
        result.assay_id,
        sample.sample_type_id,
        'historical_observation',
        count(*),
        min(result.created_at),
        max(result.created_at),
        assay.compatibility_generation,
        sample_type.compatibility_generation
    FROM public.results AS result
    JOIN public.samples AS sample
        ON sample.id = result.sample_id
    JOIN public.assay_definitions AS assay
        ON assay.id = result.assay_id
    JOIN public.sample_types AS sample_type
        ON sample_type.id = sample.sample_type_id
    GROUP BY
        result.assay_id,
        sample.sample_type_id,
        assay.compatibility_generation,
        sample_type.compatibility_generation;
END;
$bootstrap$;

DO $verification$
DECLARE
    v_revision_count BIGINT;
    v_candidate_count BIGINT;
    v_expected_candidate_count BIGINT;
    v_candidate_difference_count BIGINT;
    v_review_count BIGINT;
    v_compatibility_count BIGINT;
    v_invalid_generation_count BIGINT;
    v_revision_audit_count BIGINT;
    v_candidate_audit_count BIGINT;
    v_audit_trigger_count BIGINT;
    v_guard_trigger_count BIGINT;
    v_timestamp_trigger_count BIGINT;
BEGIN
    SELECT count(*)
    INTO v_revision_count
    FROM public.assay_sample_type_catalog_revisions
    WHERE revision_number = 1
      AND status = 'draft'
      AND source_revision_id IS NULL
      AND created_actor_type = 'system_migration'
      AND created_by IS NULL;

    SELECT count(*)
    INTO v_candidate_count
    FROM public.assay_sample_type_candidates;

    SELECT count(*)
    INTO v_expected_candidate_count
    FROM (
        SELECT DISTINCT
            result.assay_id,
            sample.sample_type_id
        FROM public.results AS result
        JOIN public.samples AS sample
            ON sample.id = result.sample_id
    ) AS historical_pairs;

    SELECT count(*)
    INTO v_candidate_difference_count
    FROM (
        (
            SELECT
                candidate.assay_definition_id,
                candidate.sample_type_id,
                candidate.observation_count,
                candidate.first_observed_at,
                candidate.last_observed_at,
                candidate.assay_compatibility_generation,
                candidate.sample_type_compatibility_generation
            FROM public.assay_sample_type_candidates AS candidate
            EXCEPT
            SELECT
                result.assay_id,
                sample.sample_type_id,
                count(*),
                min(result.created_at),
                max(result.created_at),
                assay.compatibility_generation,
                sample_type.compatibility_generation
            FROM public.results AS result
            JOIN public.samples AS sample
                ON sample.id = result.sample_id
            JOIN public.assay_definitions AS assay
                ON assay.id = result.assay_id
            JOIN public.sample_types AS sample_type
                ON sample_type.id = sample.sample_type_id
            GROUP BY
                result.assay_id,
                sample.sample_type_id,
                assay.compatibility_generation,
                sample_type.compatibility_generation
        )
        UNION ALL
        (
            SELECT
                result.assay_id,
                sample.sample_type_id,
                count(*),
                min(result.created_at),
                max(result.created_at),
                assay.compatibility_generation,
                sample_type.compatibility_generation
            FROM public.results AS result
            JOIN public.samples AS sample
                ON sample.id = result.sample_id
            JOIN public.assay_definitions AS assay
                ON assay.id = result.assay_id
            JOIN public.sample_types AS sample_type
                ON sample_type.id = sample.sample_type_id
            GROUP BY
                result.assay_id,
                sample.sample_type_id,
                assay.compatibility_generation,
                sample_type.compatibility_generation
            EXCEPT
            SELECT
                candidate.assay_definition_id,
                candidate.sample_type_id,
                candidate.observation_count,
                candidate.first_observed_at,
                candidate.last_observed_at,
                candidate.assay_compatibility_generation,
                candidate.sample_type_compatibility_generation
            FROM public.assay_sample_type_candidates AS candidate
        )
    ) AS candidate_differences;

    SELECT count(*)
    INTO v_review_count
    FROM public.assay_sample_type_reviews;

    SELECT count(*)
    INTO v_compatibility_count
    FROM public.assay_sample_type_compatibilities;

    SELECT count(*)
    INTO v_invalid_generation_count
    FROM public.assay_definitions
    WHERE compatibility_generation < 1;

    SELECT count(*)
    INTO v_revision_audit_count
    FROM public.audit_logs
    WHERE table_name = 'assay_sample_type_catalog_revisions'
      AND operation = 'INSERT'
      AND new_values ->> 'created_actor_type' = 'system_migration'
      AND new_values ->> 'revision_number' = '1';

    SELECT count(*)
    INTO v_candidate_audit_count
    FROM public.audit_logs
    WHERE table_name = 'assay_sample_type_candidates'
      AND operation = 'INSERT'
      AND new_values ->> 'provenance' = 'historical_observation';

    SELECT count(*)
    INTO v_audit_trigger_count
    FROM pg_trigger
    WHERE (
        (
            tgrelid =
                'public.assay_sample_type_catalog_revisions'::REGCLASS
            AND tgname =
                'audit_assay_sample_type_catalog_revisions'
        )
        OR (
            tgrelid = 'public.assay_sample_type_reviews'::REGCLASS
            AND tgname = 'audit_assay_sample_type_reviews'
        )
        OR (
            tgrelid =
                'public.assay_sample_type_compatibilities'::REGCLASS
            AND tgname =
                'audit_assay_sample_type_compatibilities'
        )
        OR (
            tgrelid = 'public.assay_sample_type_candidates'::REGCLASS
            AND tgname = 'audit_assay_sample_type_candidates'
        )
    )
      AND tgenabled = 'O'
      AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
      AND NOT tgisinternal;

    SELECT count(*)
    INTO v_guard_trigger_count
    FROM pg_trigger
    WHERE (
        (
            tgrelid =
                'public.assay_sample_type_catalog_revisions'::REGCLASS
            AND tgname =
                'guard_assay_sample_type_catalog_revision'
            AND tgfoid =
                'public.guard_compatibility_revision_mutation()'::REGPROCEDURE
        )
        OR (
            tgrelid = 'public.assay_sample_type_reviews'::REGCLASS
            AND tgname = 'guard_assay_sample_type_reviews'
            AND tgfoid =
                'public.guard_compatibility_entry_mutation()'::REGPROCEDURE
        )
        OR (
            tgrelid =
                'public.assay_sample_type_compatibilities'::REGCLASS
            AND tgname =
                'guard_assay_sample_type_compatibilities'
            AND tgfoid =
                'public.guard_compatibility_entry_mutation()'::REGPROCEDURE
        )
        OR (
            tgrelid = 'public.assay_sample_type_candidates'::REGCLASS
            AND tgname = 'guard_assay_sample_type_candidates'
            AND tgfoid =
                'public.guard_compatibility_entry_mutation()'::REGPROCEDURE
        )
    )
      AND tgenabled = 'O'
      AND NOT tgisinternal;

    SELECT count(*)
    INTO v_timestamp_trigger_count
    FROM pg_trigger
    WHERE (
        (
            tgrelid =
                'public.assay_sample_type_catalog_revisions'::REGCLASS
            AND tgname =
                'update_assay_sample_type_catalog_revisions_updated_at'
        )
        OR (
            tgrelid = 'public.assay_sample_type_reviews'::REGCLASS
            AND tgname =
                'update_assay_sample_type_reviews_updated_at'
        )
        OR (
            tgrelid =
                'public.assay_sample_type_compatibilities'::REGCLASS
            AND tgname =
                'update_assay_sample_type_compatibilities_updated_at'
        )
        OR (
            tgrelid = 'public.assay_sample_type_candidates'::REGCLASS
            AND tgname =
                'update_assay_sample_type_candidates_updated_at'
        )
    )
      AND tgenabled = 'O'
      AND tgfoid =
          'public.update_updated_at_column()'::REGPROCEDURE
      AND NOT tgisinternal;

    IF v_revision_count <> 1
       OR (
           SELECT count(*)
           FROM public.assay_sample_type_catalog_revisions
       ) <> 1
    THEN
        RAISE EXCEPTION
            'Migration 206 revision bootstrap verification failed';
    END IF;

    IF v_candidate_count <> v_expected_candidate_count
       OR v_candidate_difference_count <> 0
    THEN
        RAISE EXCEPTION
            'Migration 206 candidate bootstrap verification failed: actual %, expected %, differences %',
            v_candidate_count,
            v_expected_candidate_count,
            v_candidate_difference_count;
    END IF;

    IF v_review_count <> 0
       OR v_compatibility_count <> 0
    THEN
        RAISE EXCEPTION
            'Migration 206 candidates unexpectedly gained authority';
    END IF;

    IF v_invalid_generation_count <> 0 THEN
        RAISE EXCEPTION
            'Migration 206 assay generation verification failed';
    END IF;

    IF v_revision_audit_count <> 1
       OR v_candidate_audit_count <> v_candidate_count
    THEN
        RAISE EXCEPTION
            'Migration 206 bootstrap audit verification failed';
    END IF;

    IF v_audit_trigger_count <> 4
       OR v_guard_trigger_count <> 4
       OR v_timestamp_trigger_count <> 4
    THEN
        RAISE EXCEPTION
            'Migration 206 trigger binding verification failed';
    END IF;

    IF has_table_privilege(
        'anon',
        'public.assay_sample_type_catalog_revisions',
        'SELECT'
    )
       OR has_table_privilege(
           'authenticated',
           'public.assay_sample_type_catalog_revisions',
           'SELECT'
       )
       OR NOT has_table_privilege(
           'service_role',
           'public.assay_sample_type_catalog_revisions',
           'SELECT'
       )
       OR has_table_privilege(
           'service_role',
           'public.assay_sample_type_catalog_revisions',
           'INSERT'
       )
    THEN
        RAISE EXCEPTION
            'Migration 206 catalog privilege verification failed';
    END IF;
END;
$verification$;

COMMIT;
