-- Migration 210: Allow a reviewed draft to retain its content hash.
--
-- Security impact:
-- - Changes only the revision status-field CHECK constraint.
-- - Preserves RLS, grants, SECURITY DEFINER functions, and audit triggers.
-- - Published and superseded revisions still require complete publication data.
--
-- Rollout impact:
-- - Unblocks the migration 208 review-then-publish workflow.
-- - Draft edits still clear content_hash through the existing update RPC.
-- - Does not change published catalog readers or legacy assignment RPCs.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_constraint_definition TEXT;
    v_review_function_definition TEXT;
BEGIN
    IF to_regclass(
        'public.assay_sample_type_catalog_revisions'
    ) IS NULL
       OR to_regprocedure(
           'public.review_assay_sample_type_catalog_revision(uuid,timestamp with time zone)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 210 requires compatibility catalog migrations 206-209';
    END IF;

    SELECT pg_get_constraintdef(constraint_row.oid)
    INTO v_constraint_definition
    FROM pg_constraint AS constraint_row
    WHERE constraint_row.conrelid =
            'public.assay_sample_type_catalog_revisions'::REGCLASS
      AND constraint_row.conname =
            'assay_sample_type_catalog_status_fields';

    SELECT pg_get_functiondef(
        'public.review_assay_sample_type_catalog_revision(uuid,timestamp with time zone)'::REGPROCEDURE
    )
    INTO v_review_function_definition;

    IF v_constraint_definition IS NULL
       OR v_constraint_definition NOT LIKE '%content_hash IS NULL%'
       OR v_review_function_definition NOT LIKE
            '%SET content_hash = v_content_hash%'
    THEN
        RAISE EXCEPTION
            'Migration 210 expected the reviewed-draft hash conflict';
    END IF;
END;
$baseline$;

ALTER TABLE public.assay_sample_type_catalog_revisions
DROP CONSTRAINT assay_sample_type_catalog_status_fields;

ALTER TABLE public.assay_sample_type_catalog_revisions
ADD CONSTRAINT assay_sample_type_catalog_status_fields
CHECK (
    (
        status = 'draft'
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
);

COMMENT ON CONSTRAINT assay_sample_type_catalog_status_fields
ON public.assay_sample_type_catalog_revisions
IS 'Allows draft revisions to hold a review hash while requiring complete publication and supersession metadata.';

DO $verify$
DECLARE
    v_draft_id UUID;
    v_test_completed BOOLEAN := FALSE;
BEGIN
    SELECT revision.id
    INTO STRICT v_draft_id
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.status = 'draft';

    BEGIN
        UPDATE public.assay_sample_type_catalog_revisions
        SET content_hash = repeat('0', 64)
        WHERE id = v_draft_id;

        v_test_completed := TRUE;
        RAISE EXCEPTION 'ROLLBACK_REVIEW_HASH_TEST';
    EXCEPTION
        WHEN SQLSTATE 'P0001' THEN
            IF NOT v_test_completed
               OR SQLERRM IS DISTINCT FROM 'ROLLBACK_REVIEW_HASH_TEST'
            THEN
                RAISE;
            END IF;
    END;

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_catalog_revisions
        WHERE id = v_draft_id
          AND content_hash IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 210 verification left a draft review hash behind';
    END IF;
END;
$verify$;

COMMIT;
