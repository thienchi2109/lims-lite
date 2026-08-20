-- Migration 209: Expose lifecycle stale state in the manager catalog RPC.
--
-- Security impact:
-- - Replaces only the manager-only catalog read RPC from migration 208.
-- - Preserves SECURITY DEFINER, fixed search_path, and explicit grants.
-- - Does not expose draft data to analysts or change any table policy.
--
-- Rollout impact:
-- - Adds the server-calculated isStale field required by the manager workspace.
-- - Does not change published catalog or legacy assignment RPC behavior.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
BEGIN
    IF to_regprocedure(
        'public.get_assay_sample_type_catalog_manager(uuid)'
    ) IS NULL
       OR to_regclass('public.assay_sample_type_catalog_revisions') IS NULL
       OR to_regclass('public.assay_sample_type_reviews') IS NULL
       OR to_regclass('public.assay_sample_type_compatibilities') IS NULL
       OR to_regclass('public.assay_sample_type_candidates') IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 209 requires the migration 208 manager catalog RPC';
    END IF;
END;
$baseline$;

CREATE OR REPLACE FUNCTION public.get_assay_sample_type_catalog_manager(
    p_revision_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_revision_id UUID;
    v_source_revision_id UUID;
    v_added_pair_count BIGINT := 0;
    v_removed_pair_count BIGINT := 0;
    v_changed_review_count BIGINT := 0;
BEGIN
    IF auth.uid() IS NULL
       OR public.get_user_role() IS DISTINCT FROM 'manager'
    THEN
        RAISE EXCEPTION 'CATALOG_MANAGER_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    SELECT revision.id, revision.source_revision_id
    INTO v_revision_id, v_source_revision_id
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.id = p_revision_id
       OR (
           p_revision_id IS NULL
           AND revision.status IN ('draft', 'published')
       )
    ORDER BY
        CASE revision.status
            WHEN 'draft' THEN 0
            WHEN 'published' THEN 1
            ELSE 2
        END,
        revision.revision_number DESC
    LIMIT 1;

    IF p_revision_id IS NOT NULL
       AND v_revision_id IS NULL
    THEN
        RAISE EXCEPTION 'CATALOG_REVISION_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_revision_id IS NOT NULL THEN
        SELECT count(*)
        INTO v_added_pair_count
        FROM public.assay_sample_type_compatibilities AS current_pair
        WHERE current_pair.revision_id = v_revision_id
          AND current_pair.removed_at IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.assay_sample_type_compatibilities AS source_pair
              WHERE source_pair.revision_id = v_source_revision_id
                AND source_pair.assay_definition_id =
                    current_pair.assay_definition_id
                AND source_pair.sample_type_id =
                    current_pair.sample_type_id
                AND source_pair.removed_at IS NULL
          );

        SELECT count(*)
        INTO v_removed_pair_count
        FROM public.assay_sample_type_compatibilities AS source_pair
        WHERE source_pair.revision_id = v_source_revision_id
          AND source_pair.removed_at IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.assay_sample_type_compatibilities AS current_pair
              WHERE current_pair.revision_id = v_revision_id
                AND current_pair.assay_definition_id =
                    source_pair.assay_definition_id
                AND current_pair.sample_type_id =
                    source_pair.sample_type_id
                AND current_pair.removed_at IS NULL
          );

        SELECT count(*)
        INTO v_changed_review_count
        FROM (
            SELECT
                COALESCE(
                    current_review.assay_definition_id,
                    source_review.assay_definition_id
                ) AS assay_definition_id,
                current_review.disposition AS current_disposition,
                source_review.disposition AS source_disposition,
                current_review.reason AS current_reason,
                source_review.reason AS source_reason,
                current_review.assay_compatibility_generation
                    AS current_generation,
                source_review.assay_compatibility_generation
                    AS source_generation
            FROM (
                SELECT *
                FROM public.assay_sample_type_reviews
                WHERE revision_id = v_revision_id
            ) AS current_review
            FULL JOIN (
                SELECT *
                FROM public.assay_sample_type_reviews
                WHERE revision_id = v_source_revision_id
            ) AS source_review
                USING (assay_definition_id)
        ) AS review_diff
        WHERE ROW(
            review_diff.current_disposition,
            review_diff.current_reason,
            review_diff.current_generation
        ) IS DISTINCT FROM ROW(
            review_diff.source_disposition,
            review_diff.source_reason,
            review_diff.source_generation
        );
    END IF;

    RETURN jsonb_build_object(
        'revision',
        (
            SELECT CASE
                WHEN revision.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                    'id', revision.id,
                    'revisionNumber', revision.revision_number,
                    'status', revision.status,
                    'sourceRevisionId', revision.source_revision_id,
                    'sourceRevisionNumber', source_revision.revision_number,
                    'creationReason', revision.creation_reason,
                    'contentHash', revision.content_hash,
                    'publishReason', revision.publish_reason,
                    'publishedAt', revision.published_at,
                    'updatedAt', revision.updated_at
                )
            END
            FROM public.assay_sample_type_catalog_revisions AS revision
            LEFT JOIN public.assay_sample_type_catalog_revisions
                AS source_revision
                ON source_revision.id = revision.source_revision_id
            WHERE revision.id = v_revision_id
        ),
        'diff',
        jsonb_build_object(
            'addedPairCount', v_added_pair_count,
            'removedPairCount', v_removed_pair_count,
            'changedReviewCount', v_changed_review_count
        ),
        'sampleTypes',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', sample_type.id,
                        'importCode', sample_type.import_code,
                        'name', sample_type.name,
                        'compatibilityGeneration',
                        sample_type.compatibility_generation,
                        'isActive', sample_type.deleted_at IS NULL
                    )
                    ORDER BY sample_type.name, sample_type.import_code
                )
                FROM public.sample_types AS sample_type
                WHERE sample_type.deleted_at IS NULL
                   OR EXISTS (
                        SELECT 1
                        FROM public.assay_sample_type_candidates AS candidate
                        WHERE candidate.revision_id = v_revision_id
                          AND candidate.sample_type_id = sample_type.id
                   )
                   OR EXISTS (
                        SELECT 1
                        FROM public.assay_sample_type_compatibilities
                            AS compatibility
                        WHERE compatibility.revision_id = v_revision_id
                          AND compatibility.sample_type_id = sample_type.id
                          AND compatibility.removed_at IS NULL
                   )
            ),
            '[]'::JSONB
        ),
        'assays',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'assayDefinitionId', assay_definition.id,
                        'importCode', assay_definition.import_code,
                        'name', assay_definition.name,
                        'methodName', assay_definition.method_name,
                        'specialtyId', assay_definition.specialty_id,
                        'compatibilityGeneration',
                        assay_definition.compatibility_generation,
                        'isActive',
                        assay_definition.deleted_at IS NULL,
                        'isStale',
                        (
                            review.id IS NOT NULL
                            AND review.assay_compatibility_generation
                                IS DISTINCT FROM
                                assay_definition.compatibility_generation
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM public.assay_sample_type_compatibilities
                                AS compatibility
                            JOIN public.sample_types AS sample_type
                                ON sample_type.id =
                                    compatibility.sample_type_id
                            WHERE compatibility.revision_id = v_revision_id
                              AND compatibility.assay_definition_id =
                                  assay_definition.id
                              AND compatibility.removed_at IS NULL
                              AND (
                                  compatibility.assay_compatibility_generation
                                      IS DISTINCT FROM
                                      assay_definition.compatibility_generation
                                  OR compatibility.sample_type_compatibility_generation
                                      IS DISTINCT FROM
                                      sample_type.compatibility_generation
                              )
                        ),
                        'reviewCompatibilityGeneration',
                        review.assay_compatibility_generation,
                        'disposition', review.disposition,
                        'reviewReason', review.reason,
                        'compatibilities',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'sampleTypeId',
                                        compatibility.sample_type_id,
                                        'provenance',
                                        compatibility.provenance,
                                        'sourceCandidateId',
                                        compatibility.source_candidate_id
                                    )
                                    ORDER BY compatibility.sample_type_id
                                )
                                FROM public.assay_sample_type_compatibilities
                                    AS compatibility
                                WHERE compatibility.revision_id =
                                    v_revision_id
                                  AND compatibility.assay_definition_id =
                                    assay_definition.id
                                  AND compatibility.removed_at IS NULL
                            ),
                            '[]'::JSONB
                        ),
                        'candidates',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id', candidate.id,
                                        'sampleTypeId',
                                        candidate.sample_type_id,
                                        'observationCount',
                                        candidate.observation_count,
                                        'firstObservedAt',
                                        candidate.first_observed_at,
                                        'lastObservedAt',
                                        candidate.last_observed_at,
                                        'decision', candidate.decision,
                                        'decisionReason',
                                        candidate.decision_reason
                                    )
                                    ORDER BY candidate.sample_type_id
                                )
                                FROM public.assay_sample_type_candidates
                                    AS candidate
                                WHERE candidate.revision_id = v_revision_id
                                  AND candidate.assay_definition_id =
                                    assay_definition.id
                            ),
                            '[]'::JSONB
                        )
                    )
                    ORDER BY
                        assay_definition.deleted_at NULLS FIRST,
                        assay_definition.name,
                        assay_definition.import_code
                )
                FROM public.assay_definitions AS assay_definition
                LEFT JOIN public.assay_sample_type_reviews AS review
                    ON review.revision_id = v_revision_id
                   AND review.assay_definition_id = assay_definition.id
                WHERE assay_definition.deleted_at IS NULL
                   OR EXISTS (
                       SELECT 1
                       FROM public.assay_sample_type_candidates AS candidate
                       WHERE candidate.revision_id = v_revision_id
                         AND candidate.assay_definition_id =
                            assay_definition.id
                   )
                   OR review.id IS NOT NULL
            ),
            '[]'::JSONB
        )
    );
END;
$$;

COMMENT ON FUNCTION
public.get_assay_sample_type_catalog_manager(UUID)
IS 'Returns manager-only catalog coverage, candidates, allowlist diff, and server-calculated lifecycle stale state.';

REVOKE ALL ON FUNCTION
public.get_assay_sample_type_catalog_manager(UUID)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
public.get_assay_sample_type_catalog_manager(UUID)
TO authenticated;

DO $verify$
DECLARE
    v_function REGPROCEDURE;
    v_definition TEXT;
    v_security_definer BOOLEAN;
    v_configuration TEXT[];
BEGIN
    v_function := to_regprocedure(
        'public.get_assay_sample_type_catalog_manager(uuid)'
    );

    SELECT
        pg_get_functiondef(proc.oid),
        proc.prosecdef,
        proc.proconfig
    INTO
        v_definition,
        v_security_definer,
        v_configuration
    FROM pg_proc AS proc
    WHERE proc.oid = v_function;

    IF v_function IS NULL
       OR v_definition NOT LIKE '%' || quote_literal('isStale') || '%'
       OR NOT v_security_definer
       OR NOT COALESCE(
           'search_path=public, extensions' = ANY(v_configuration),
           FALSE
       )
    THEN
        RAISE EXCEPTION
            'Migration 209 manager catalog RPC postcondition failed';
    END IF;

    IF NOT has_function_privilege(
        'authenticated',
        v_function,
        'EXECUTE'
    )
       OR has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('service_role', v_function, 'EXECUTE')
    THEN
        RAISE EXCEPTION
            'Migration 209 manager catalog RPC grants are invalid';
    END IF;
END;
$verify$;

COMMIT;
