-- One-time data correction for CT-000295/CT-000296, using existing audited RPCs.
-- Run only after approval to configure both assays for LM-000001 (Mau).
-- No schema changes. Any failed assertion rolls back the entire publication.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
    actor_id CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
    expected_hash CONSTANT TEXT :=
        '4af83ccbaa17ca833e4820e830adce1ceadca396aac25d20d42e67f2bbd581b7';
    source_id UUID;
    draft_id UUID;
    blood_id UUID;
    result JSONB;
    updated_at TIMESTAMPTZ;
    assay RECORD;
BEGIN
    PERFORM pg_advisory_xact_lock(208110);
    LOCK TABLE public.assay_definitions, public.sample_types IN SHARE MODE;
    SELECT id INTO source_id
    FROM public.assay_sample_type_catalog_revisions
    WHERE revision_number = 2 AND status = 'published'
      AND content_hash = expected_hash
      AND public.compute_assay_sample_type_catalog_hash(id) = expected_hash;
    IF source_id IS NULL OR EXISTS (
        SELECT 1 FROM public.assay_sample_type_catalog_revisions
        WHERE status = 'draft' OR revision_number > 2
    ) THEN
        RAISE EXCEPTION 'Catalog baseline changed; repeat read-only preflight';
    END IF;
    SELECT id INTO blood_id FROM public.sample_types
    WHERE import_code = 'LM-000001' AND deleted_at IS NULL;
    IF blood_id IS NULL
       OR (SELECT count(*) FROM public.sample_types WHERE deleted_at IS NULL) <> 1
       OR (SELECT count(*) FROM public.assay_definitions WHERE deleted_at IS NULL) <> 86
       OR (SELECT count(*) FROM public.assay_definitions
           WHERE import_code IN ('CT-000295', 'CT-000296') AND deleted_at IS NULL) <> 2
    THEN
        RAISE EXCEPTION 'Active assay/sample-type baseline changed';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.users u JOIN auth.users a ON a.id = u.id
        WHERE u.id = actor_id AND u.role = 'manager' AND a.deleted_at IS NULL
          AND (a.banned_until IS NULL OR a.banned_until <= now())
    ) THEN
        RAISE EXCEPTION 'Active system manager required';
    END IF;
    PERFORM set_config('request.jwt.claims',
        jsonb_build_object('sub', actor_id, 'role', 'authenticated')::TEXT, true);
    IF auth.uid() IS DISTINCT FROM actor_id THEN
        RAISE EXCEPTION 'System actor context mismatch';
    END IF;

    result := public.clone_assay_sample_type_catalog_revision(
        2, 'User-authorized recovery of CT-000295 and CT-000296 for LM-000001');
    draft_id := (result->>'revisionId')::UUID;
    updated_at := (result->>'updatedAt')::TIMESTAMPTZ;
    IF (result->>'revisionNumber')::BIGINT IS DISTINCT FROM 3 THEN
        RAISE EXCEPTION 'Expected revision 3';
    END IF;
    FOR assay IN
        SELECT id FROM public.assay_definitions
        WHERE import_code IN ('CT-000295', 'CT-000296') AND deleted_at IS NULL
        ORDER BY import_code
    LOOP
        result := public.update_assay_sample_type_catalog_review(
            draft_id, assay.id, 'configured',
            'User-authorized availability recovery for LM-000001',
            ARRAY[blood_id], '[]'::JSONB, updated_at);
        updated_at := (result->>'updatedAt')::TIMESTAMPTZ;
    END LOOP;
    result := public.review_assay_sample_type_catalog_revision(draft_id, updated_at);
    updated_at := (result->>'updatedAt')::TIMESTAMPTZ;
    result := public.publish_assay_sample_type_catalog_revision(
        draft_id, updated_at,
        'User-authorized publication of CT-000295 and CT-000296 for LM-000001');
    IF (result->>'revisionNumber')::BIGINT IS DISTINCT FROM 3 THEN
        RAISE EXCEPTION 'Revision 3 publication failed';
    END IF;
    IF EXISTS (
        SELECT assay_definition_id, sample_type_id
        FROM public.assay_sample_type_compatibilities
        WHERE revision_id = source_id AND removed_at IS NULL
        EXCEPT
        SELECT assay_definition_id, sample_type_id
        FROM public.assay_sample_type_compatibilities
        WHERE revision_id = draft_id AND removed_at IS NULL
    ) OR (SELECT count(*) FROM public.assay_sample_type_compatibilities
          WHERE revision_id = draft_id AND removed_at IS NULL) <> 86 THEN
        RAISE EXCEPTION 'Expected existing pairs preserved and exactly 86 total pairs';
    END IF;
    result := public.get_published_assay_sample_type_catalog(blood_id);
    IF (SELECT count(*) FROM jsonb_array_elements(result->'assays') item
        WHERE item->>'importCode' IN ('CT-000295', 'CT-000296')) <> 2 THEN
        RAISE EXCEPTION 'Incident assays still absent from published RPC';
    END IF;
END;
$$;

COMMIT;
