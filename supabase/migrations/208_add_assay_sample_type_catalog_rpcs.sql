-- Migration 208: Add assay/sample-type compatibility catalog RPC contracts.
--
-- Security impact:
-- - Keeps catalog tables private behind RLS with no authenticated table grants.
-- - Adds authenticated SECURITY DEFINER RPCs with fixed search_path.
-- - Restricts draft reads and all mutations to active managers.
-- - Exposes only generation-current published allowlist rows to analysts/managers.
-- - Revokes PUBLIC, anon, authenticated, and service_role before explicit grants.
--
-- Audit impact:
-- - Existing exact audit triggers record auth.uid() for every catalog mutation.
-- - Clone, review, candidate decision, pair removal, and publish reasons are stored.
-- - Server-owned actor, hash, revision status, and import codes are never inputs.
--
-- Rollout impact:
-- - Adds catalog contracts only.
-- - Does not change assignment behavior or apply compatibility enforcement.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_function REGPROCEDURE;
BEGIN
    IF to_regclass(
        'public.assay_sample_type_catalog_revisions'
    ) IS NULL
       OR to_regclass(
           'public.assay_sample_type_reviews'
       ) IS NULL
       OR to_regclass(
           'public.assay_sample_type_compatibilities'
       ) IS NULL
       OR to_regclass(
           'public.assay_sample_type_candidates'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 208 requires compatibility catalog migrations 206-207';
    END IF;

    IF to_regprocedure('public.get_user_role()') IS NULL
       OR to_regprocedure('public.trigger_audit_log()') IS NULL
       OR to_regprocedure(
           'public.guard_compatibility_revision_mutation()'
       ) IS NULL
       OR to_regprocedure(
           'public.guard_compatibility_entry_mutation()'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 208 requires catalog auth and audit guard functions';
    END IF;

    FOREACH v_function IN ARRAY ARRAY[
        to_regprocedure(
            'public.compute_assay_sample_type_catalog_hash(uuid)'
        ),
        to_regprocedure(
            'public.assert_assay_sample_type_catalog_publishable(uuid)'
        ),
        to_regprocedure(
            'public.get_assay_sample_type_catalog_manager(uuid)'
        ),
        to_regprocedure(
            'public.get_published_assay_sample_type_catalog(uuid)'
        ),
        to_regprocedure(
            'public.clone_assay_sample_type_catalog_revision(bigint,text)'
        ),
        to_regprocedure(
            'public.update_assay_sample_type_catalog_review(uuid,uuid,text,text,uuid[],jsonb,timestamp with time zone)'
        ),
        to_regprocedure(
            'public.review_assay_sample_type_catalog_revision(uuid,timestamp with time zone)'
        ),
        to_regprocedure(
            'public.publish_assay_sample_type_catalog_revision(uuid,timestamp with time zone,text)'
        )
    ]
    LOOP
        IF v_function IS NOT NULL THEN
            RAISE EXCEPTION
                'Migration 208 expected catalog RPCs to be absent';
        END IF;
    END LOOP;
END;
$baseline$;

CREATE FUNCTION public.compute_assay_sample_type_catalog_hash(
    p_revision_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT encode(
        digest(
            jsonb_build_object(
                'reviews',
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'assay_definition_id',
                                review.assay_definition_id,
                                'disposition',
                                review.disposition,
                                'assay_compatibility_generation',
                                review.assay_compatibility_generation,
                                'reason',
                                review.reason
                            )
                            ORDER BY review.assay_definition_id
                        )
                        FROM public.assay_sample_type_reviews AS review
                        WHERE review.revision_id = p_revision_id
                    ),
                    '[]'::JSONB
                ),
                'compatibilities',
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'assay_definition_id',
                                compatibility.assay_definition_id,
                                'sample_type_id',
                                compatibility.sample_type_id,
                                'assay_compatibility_generation',
                                compatibility.assay_compatibility_generation,
                                'sample_type_compatibility_generation',
                                compatibility.sample_type_compatibility_generation,
                                'provenance',
                                compatibility.provenance,
                                'source_candidate_id',
                                compatibility.source_candidate_id
                            )
                            ORDER BY
                                compatibility.assay_definition_id,
                                compatibility.sample_type_id
                        )
                        FROM public.assay_sample_type_compatibilities
                            AS compatibility
                        WHERE compatibility.revision_id = p_revision_id
                          AND compatibility.removed_at IS NULL
                    ),
                    '[]'::JSONB
                ),
                'candidate_decisions',
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'candidate_id',
                                candidate.id,
                                'decision',
                                candidate.decision,
                                'decision_reason',
                                candidate.decision_reason
                            )
                            ORDER BY candidate.id
                        )
                        FROM public.assay_sample_type_candidates AS candidate
                        WHERE candidate.revision_id = p_revision_id
                    ),
                    '[]'::JSONB
                )
            )::TEXT,
            'sha256'
        ),
        'hex'
    );
$$;

REVOKE ALL ON FUNCTION
public.compute_assay_sample_type_catalog_hash(UUID)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION
public.compute_assay_sample_type_catalog_hash(UUID)
IS 'Computes the canonical SHA-256 hash for reviewed catalog authority and candidate decisions.';

CREATE FUNCTION public.assert_assay_sample_type_catalog_publishable(
    p_revision_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.assay_definitions AS assay_definition
        LEFT JOIN public.assay_sample_type_reviews AS review
            ON review.revision_id = p_revision_id
           AND review.assay_definition_id = assay_definition.id
        WHERE assay_definition.deleted_at IS NULL
          AND (
              review.id IS NULL
              OR review.assay_compatibility_generation
                  IS DISTINCT FROM
                  assay_definition.compatibility_generation
          )
    ) THEN
        RAISE EXCEPTION
            'CATALOG_REVIEW_COVERAGE_INCOMPLETE'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_candidates AS candidate
        WHERE candidate.revision_id = p_revision_id
          AND candidate.decision IS NULL
    ) THEN
        RAISE EXCEPTION
            'CATALOG_CANDIDATE_DECISIONS_INCOMPLETE'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_reviews AS review
        WHERE review.revision_id = p_revision_id
          AND review.disposition = 'configured'
          AND NOT EXISTS (
              SELECT 1
              FROM public.assay_sample_type_compatibilities
                  AS compatibility
              WHERE compatibility.revision_id = review.revision_id
                AND compatibility.assay_definition_id =
                    review.assay_definition_id
                AND compatibility.removed_at IS NULL
          )
    ) THEN
        RAISE EXCEPTION
            'CATALOG_CONFIGURED_ASSAY_HAS_NO_SAMPLE_TYPE'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_reviews AS review
        WHERE review.revision_id = p_revision_id
          AND review.disposition = 'not_assignable'
          AND EXISTS (
              SELECT 1
              FROM public.assay_sample_type_compatibilities
                  AS compatibility
              WHERE compatibility.revision_id = review.revision_id
                AND compatibility.assay_definition_id =
                    review.assay_definition_id
                AND compatibility.removed_at IS NULL
          )
    ) THEN
        RAISE EXCEPTION
            'CATALOG_NOT_ASSIGNABLE_ASSAY_HAS_SAMPLE_TYPE'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_compatibilities AS compatibility
        JOIN public.assay_definitions AS assay_definition
            ON assay_definition.id = compatibility.assay_definition_id
        JOIN public.sample_types AS sample_type
            ON sample_type.id = compatibility.sample_type_id
        WHERE compatibility.revision_id = p_revision_id
          AND compatibility.removed_at IS NULL
          AND (
              assay_definition.deleted_at IS NOT NULL
              OR sample_type.deleted_at IS NOT NULL
              OR compatibility.assay_compatibility_generation
                  IS DISTINCT FROM
                  assay_definition.compatibility_generation
              OR compatibility.sample_type_compatibility_generation
                  IS DISTINCT FROM
                  sample_type.compatibility_generation
          )
    ) THEN
        RAISE EXCEPTION
            'CATALOG_CONTAINS_STALE_COMPATIBILITY'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_candidates AS candidate
        WHERE candidate.revision_id = p_revision_id
          AND (
              (
                  candidate.decision = 'accepted'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.assay_sample_type_compatibilities
                          AS compatibility
                      WHERE compatibility.revision_id =
                            candidate.revision_id
                        AND compatibility.assay_definition_id =
                            candidate.assay_definition_id
                        AND compatibility.sample_type_id =
                            candidate.sample_type_id
                        AND compatibility.source_candidate_id =
                            candidate.id
                        AND compatibility.removed_at IS NULL
                  )
              )
              OR (
                  candidate.decision = 'rejected'
                  AND EXISTS (
                      SELECT 1
                      FROM public.assay_sample_type_compatibilities
                          AS compatibility
                      WHERE compatibility.revision_id =
                            candidate.revision_id
                        AND compatibility.assay_definition_id =
                            candidate.assay_definition_id
                        AND compatibility.sample_type_id =
                            candidate.sample_type_id
                        AND compatibility.removed_at IS NULL
                  )
              )
          )
    ) THEN
        RAISE EXCEPTION
            'CATALOG_CANDIDATE_DECISION_MISMATCH'
            USING ERRCODE = '23514';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION
public.assert_assay_sample_type_catalog_publishable(UUID)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION
public.assert_assay_sample_type_catalog_publishable(UUID)
IS 'Fails closed unless active assay coverage, candidate decisions, generations, and allowlist dispositions are complete.';

CREATE FUNCTION public.get_assay_sample_type_catalog_manager(
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

CREATE FUNCTION public.get_published_assay_sample_type_catalog(
    p_sample_type_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_revision_id UUID;
    v_revision_number BIGINT;
BEGIN
    IF auth.uid() IS NULL
       OR public.get_user_role() IS NULL
       OR public.get_user_role() NOT IN ('analyst', 'manager')
    THEN
        RAISE EXCEPTION 'CATALOG_PUBLISHED_READ_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    SELECT revision.id, revision.revision_number
    INTO v_revision_id, v_revision_number
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.status = 'published'
    LIMIT 1;

    RETURN jsonb_build_object(
        'revisionNumber', v_revision_number,
        'sampleTypeId', p_sample_type_id,
        'assays',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'sampleTypeId', compatibility.sample_type_id,
                        'assayDefinitionId', assay_definition.id,
                        'importCode', assay_definition.import_code,
                        'name', assay_definition.name,
                        'methodName', assay_definition.method_name,
                        'specialtyId', assay_definition.specialty_id
                    )
                    ORDER BY
                        assay_definition.name,
                        assay_definition.import_code
                )
                FROM public.assay_sample_type_compatibilities
                    AS compatibility
                JOIN public.assay_sample_type_reviews AS review
                    ON review.revision_id = compatibility.revision_id
                   AND review.assay_definition_id =
                        compatibility.assay_definition_id
                JOIN public.assay_definitions AS assay_definition
                    ON assay_definition.id =
                        compatibility.assay_definition_id
                JOIN public.sample_types AS sample_type
                    ON sample_type.id = compatibility.sample_type_id
                WHERE compatibility.revision_id = v_revision_id
                  AND compatibility.removed_at IS NULL
                  AND review.disposition = 'configured'
                  AND assay_definition.deleted_at IS NULL
                  AND sample_type.deleted_at IS NULL
                  AND review.assay_compatibility_generation =
                    assay_definition.compatibility_generation
                  AND compatibility.assay_compatibility_generation =
                    assay_definition.compatibility_generation
                  AND compatibility.sample_type_compatibility_generation =
                    sample_type.compatibility_generation
                  AND (
                      p_sample_type_id IS NULL
                      OR compatibility.sample_type_id = p_sample_type_id
                  )
            ),
            '[]'::JSONB
        )
    );
END;
$$;

CREATE FUNCTION public.clone_assay_sample_type_catalog_revision(
    p_source_revision_number BIGINT,
    p_creation_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_source_revision_id UUID;
    v_new_revision_id UUID;
    v_new_revision_number BIGINT;
    v_updated_at TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL
       OR public.get_user_role() IS DISTINCT FROM 'manager'
    THEN
        RAISE EXCEPTION 'CATALOG_MANAGER_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    IF NULLIF(btrim(p_creation_reason), '') IS NULL THEN
        RAISE EXCEPTION 'CATALOG_CREATION_REASON_REQUIRED'
            USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(208110);

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_catalog_revisions AS revision
        WHERE revision.status = 'draft'
    ) THEN
        RAISE EXCEPTION 'CATALOG_DRAFT_ALREADY_EXISTS'
            USING ERRCODE = '23505';
    END IF;

    SELECT revision.id
    INTO v_source_revision_id
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.revision_number = p_source_revision_number
      AND revision.status = 'published'
    FOR SHARE;

    IF v_source_revision_id IS NULL THEN
        RAISE EXCEPTION 'CATALOG_SOURCE_REVISION_NOT_PUBLISHED'
            USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(max(revision.revision_number), 0) + 1
    INTO v_new_revision_number
    FROM public.assay_sample_type_catalog_revisions AS revision;

    INSERT INTO public.assay_sample_type_catalog_revisions (
        revision_number,
        status,
        source_revision_id,
        created_actor_type,
        created_by,
        creation_reason
    )
    VALUES (
        v_new_revision_number,
        'draft',
        v_source_revision_id,
        'manager',
        v_user_id,
        btrim(p_creation_reason)
    )
    RETURNING id, updated_at
    INTO v_new_revision_id, v_updated_at;

    INSERT INTO public.assay_sample_type_candidates (
        revision_id,
        assay_definition_id,
        sample_type_id,
        provenance,
        observation_count,
        first_observed_at,
        last_observed_at,
        assay_compatibility_generation,
        sample_type_compatibility_generation,
        decision,
        decided_by,
        decided_at,
        decision_reason
    )
    SELECT
        v_new_revision_id,
        candidate.assay_definition_id,
        candidate.sample_type_id,
        candidate.provenance,
        candidate.observation_count,
        candidate.first_observed_at,
        candidate.last_observed_at,
        candidate.assay_compatibility_generation,
        candidate.sample_type_compatibility_generation,
        candidate.decision,
        candidate.decided_by,
        candidate.decided_at,
        candidate.decision_reason
    FROM public.assay_sample_type_candidates AS candidate
    WHERE candidate.revision_id = v_source_revision_id;

    INSERT INTO public.assay_sample_type_reviews (
        revision_id,
        assay_definition_id,
        disposition,
        assay_compatibility_generation,
        reviewed_by,
        reviewed_at,
        reason
    )
    SELECT
        v_new_revision_id,
        review.assay_definition_id,
        review.disposition,
        review.assay_compatibility_generation,
        review.reviewed_by,
        review.reviewed_at,
        review.reason
    FROM public.assay_sample_type_reviews AS review
    WHERE review.revision_id = v_source_revision_id;

    INSERT INTO public.assay_sample_type_compatibilities (
        revision_id,
        assay_definition_id,
        sample_type_id,
        assay_compatibility_generation,
        sample_type_compatibility_generation,
        provenance,
        source_candidate_id,
        added_by,
        added_at
    )
    SELECT
        v_new_revision_id,
        compatibility.assay_definition_id,
        compatibility.sample_type_id,
        compatibility.assay_compatibility_generation,
        compatibility.sample_type_compatibility_generation,
        compatibility.provenance,
        cloned_candidate.id,
        v_user_id,
        now()
    FROM public.assay_sample_type_compatibilities AS compatibility
    LEFT JOIN public.assay_sample_type_candidates AS cloned_candidate
        ON cloned_candidate.revision_id = v_new_revision_id
       AND cloned_candidate.assay_definition_id =
            compatibility.assay_definition_id
       AND cloned_candidate.sample_type_id =
            compatibility.sample_type_id
       AND compatibility.provenance = 'historical_candidate'
    WHERE compatibility.revision_id = v_source_revision_id
      AND compatibility.removed_at IS NULL;

    RETURN jsonb_build_object(
        'revisionId', v_new_revision_id,
        'revisionNumber', v_new_revision_number,
        'updatedAt', v_updated_at
    );
END;
$$;

CREATE FUNCTION public.update_assay_sample_type_catalog_review(
    p_revision_id UUID,
    p_assay_definition_id UUID,
    p_disposition TEXT,
    p_review_reason TEXT,
    p_sample_type_ids UUID[],
    p_candidate_decisions JSONB,
    p_expected_revision_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_revision public.assay_sample_type_catalog_revisions%ROWTYPE;
    v_assay public.assay_definitions%ROWTYPE;
    v_candidate_count BIGINT;
    v_payload_candidate_count BIGINT;
    v_updated_at TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL
       OR public.get_user_role() IS DISTINCT FROM 'manager'
    THEN
        RAISE EXCEPTION 'CATALOG_MANAGER_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    IF p_disposition NOT IN ('configured', 'not_assignable')
       OR NULLIF(btrim(p_review_reason), '') IS NULL
       OR p_sample_type_ids IS NULL
       OR jsonb_typeof(p_candidate_decisions) IS DISTINCT FROM 'array'
    THEN
        RAISE EXCEPTION 'CATALOG_REVIEW_PAYLOAD_INVALID'
            USING ERRCODE = '22023';
    END IF;

    IF cardinality(p_sample_type_ids) IS DISTINCT FROM (
        SELECT count(DISTINCT sample_type_id)
        FROM unnest(p_sample_type_ids) AS selected(sample_type_id)
    ) THEN
        RAISE EXCEPTION 'CATALOG_SAMPLE_TYPE_DUPLICATE'
            USING ERRCODE = '22023';
    END IF;

    IF (
        p_disposition = 'configured'
        AND cardinality(p_sample_type_ids) = 0
    )
       OR (
           p_disposition = 'not_assignable'
           AND cardinality(p_sample_type_ids) <> 0
       )
    THEN
        RAISE EXCEPTION 'CATALOG_REVIEW_DISPOSITION_INVALID'
            USING ERRCODE = '22023';
    END IF;

    SELECT revision.*
    INTO v_revision
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.id = p_revision_id
    FOR UPDATE;

    IF v_revision.id IS NULL
       OR v_revision.status IS DISTINCT FROM 'draft'
    THEN
        RAISE EXCEPTION 'CATALOG_DRAFT_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_catalog_revisions AS revision
        WHERE revision.id = p_revision_id
          AND revision.updated_at IS DISTINCT FROM
              p_expected_revision_updated_at
    ) THEN
        RAISE EXCEPTION 'CATALOG_REVISION_CONFLICT'
            USING ERRCODE = '40001';
    END IF;

    SELECT assay_definition.*
    INTO v_assay
    FROM public.assay_definitions AS assay_definition
    WHERE assay_definition.id = p_assay_definition_id
    FOR SHARE;

    IF v_assay.id IS NULL THEN
        RAISE EXCEPTION 'CATALOG_ASSAY_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_assay.deleted_at IS NOT NULL
       AND (
           p_disposition IS DISTINCT FROM 'not_assignable'
           OR cardinality(p_sample_type_ids) <> 0
       )
    THEN
        RAISE EXCEPTION 'CATALOG_INACTIVE_ASSAY_MUST_BE_NOT_ASSIGNABLE'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(p_sample_type_ids) AS selected(sample_type_id)
        LEFT JOIN public.sample_types AS sample_type
            ON sample_type.id = selected.sample_type_id
           AND sample_type.deleted_at IS NULL
        WHERE sample_type.id IS NULL
    ) THEN
        RAISE EXCEPTION 'CATALOG_SAMPLE_TYPE_NOT_ACTIVE'
            USING ERRCODE = '23503';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_candidate_decisions) AS item(value)
        WHERE item.value ->> 'candidate_id' IS NULL
           OR item.value ->> 'candidate_id' !~
              '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
           OR item.value ->> 'decision' NOT IN ('accepted', 'rejected')
           OR NULLIF(btrim(item.value ->> 'reason'), '') IS NULL
    ) THEN
        RAISE EXCEPTION 'CATALOG_CANDIDATE_DECISION_INVALID'
            USING ERRCODE = '22023';
    END IF;

    SELECT count(*)
    INTO v_candidate_count
    FROM public.assay_sample_type_candidates AS candidate
    WHERE candidate.revision_id = p_revision_id
      AND candidate.assay_definition_id = p_assay_definition_id;

    SELECT count(*)
    INTO v_payload_candidate_count
    FROM jsonb_array_elements(p_candidate_decisions);

    IF v_candidate_count IS DISTINCT FROM v_payload_candidate_count
       OR v_payload_candidate_count IS DISTINCT FROM (
           SELECT count(DISTINCT item.value ->> 'candidate_id')
           FROM jsonb_array_elements(p_candidate_decisions) AS item(value)
       )
       OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements(p_candidate_decisions) AS item(value)
           LEFT JOIN public.assay_sample_type_candidates AS candidate
               ON candidate.id =
                    (item.value ->> 'candidate_id')::UUID
              AND candidate.revision_id = p_revision_id
              AND candidate.assay_definition_id =
                    p_assay_definition_id
           WHERE candidate.id IS NULL
       )
    THEN
        RAISE EXCEPTION 'CATALOG_CANDIDATE_COVERAGE_INVALID'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_candidate_decisions) AS item(value)
        JOIN public.assay_sample_type_candidates AS candidate
            ON candidate.id = (item.value ->> 'candidate_id')::UUID
        WHERE (
            item.value ->> 'decision' = 'accepted'
        ) IS DISTINCT FROM (
            candidate.sample_type_id = ANY(p_sample_type_ids)
        )
    ) THEN
        RAISE EXCEPTION 'CATALOG_CANDIDATE_SELECTION_MISMATCH'
            USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.assay_sample_type_reviews (
        revision_id,
        assay_definition_id,
        disposition,
        assay_compatibility_generation,
        reviewed_by,
        reviewed_at,
        reason
    )
    VALUES (
        p_revision_id,
        p_assay_definition_id,
        p_disposition,
        v_assay.compatibility_generation,
        v_user_id,
        now(),
        btrim(p_review_reason)
    )
    ON CONFLICT (revision_id, assay_definition_id)
    DO UPDATE SET
        disposition = EXCLUDED.disposition,
        assay_compatibility_generation =
            EXCLUDED.assay_compatibility_generation,
        reviewed_by = EXCLUDED.reviewed_by,
        reviewed_at = EXCLUDED.reviewed_at,
        reason = EXCLUDED.reason;

    UPDATE public.assay_sample_type_candidates AS candidate
    SET
        decision = item.value ->> 'decision',
        decided_by = v_user_id,
        decided_at = now(),
        decision_reason = btrim(item.value ->> 'reason')
    FROM jsonb_array_elements(p_candidate_decisions) AS item(value)
    WHERE candidate.id = (item.value ->> 'candidate_id')::UUID
      AND candidate.revision_id = p_revision_id
      AND candidate.assay_definition_id = p_assay_definition_id;

    UPDATE public.assay_sample_type_compatibilities AS compatibility
    SET
        removed_by = v_user_id,
        removed_at = now(),
        removal_reason = btrim(p_review_reason)
    WHERE compatibility.revision_id = p_revision_id
      AND compatibility.assay_definition_id = p_assay_definition_id
      AND compatibility.removed_at IS NULL
      AND NOT (
          compatibility.sample_type_id = ANY(p_sample_type_ids)
      );

    UPDATE public.assay_sample_type_compatibilities AS compatibility
    SET
        assay_compatibility_generation =
            v_assay.compatibility_generation,
        sample_type_compatibility_generation =
            selected.sample_type_compatibility_generation,
        provenance = CASE
            WHEN selected.candidate_id IS NULL THEN 'manual'
            ELSE 'historical_candidate'
        END,
        source_candidate_id = selected.candidate_id,
        added_by = v_user_id,
        added_at = now(),
        removed_by = NULL,
        removed_at = NULL,
        removal_reason = NULL
    FROM (
        SELECT
            sample_type.id AS sample_type_id,
            sample_type.compatibility_generation
                AS sample_type_compatibility_generation,
            candidate.id AS candidate_id
        FROM public.sample_types AS sample_type
        LEFT JOIN public.assay_sample_type_candidates AS candidate
            ON candidate.revision_id = p_revision_id
           AND candidate.assay_definition_id =
                p_assay_definition_id
           AND candidate.sample_type_id = sample_type.id
           AND candidate.decision = 'accepted'
        WHERE sample_type.id = ANY(p_sample_type_ids)
    ) AS selected
    WHERE compatibility.revision_id = p_revision_id
      AND compatibility.assay_definition_id = p_assay_definition_id
      AND compatibility.sample_type_id = selected.sample_type_id;

    INSERT INTO public.assay_sample_type_compatibilities (
        revision_id,
        assay_definition_id,
        sample_type_id,
        assay_compatibility_generation,
        sample_type_compatibility_generation,
        provenance,
        source_candidate_id,
        added_by,
        added_at
    )
    SELECT
        p_revision_id,
        p_assay_definition_id,
        sample_type.id,
        v_assay.compatibility_generation,
        sample_type.compatibility_generation,
        CASE
            WHEN candidate.id IS NULL THEN 'manual'
            ELSE 'historical_candidate'
        END,
        candidate.id,
        v_user_id,
        now()
    FROM public.sample_types AS sample_type
    LEFT JOIN public.assay_sample_type_candidates AS candidate
        ON candidate.revision_id = p_revision_id
       AND candidate.assay_definition_id = p_assay_definition_id
       AND candidate.sample_type_id = sample_type.id
       AND candidate.decision = 'accepted'
    WHERE sample_type.id = ANY(p_sample_type_ids)
      AND NOT EXISTS (
          SELECT 1
          FROM public.assay_sample_type_compatibilities AS existing
          WHERE existing.revision_id = p_revision_id
            AND existing.assay_definition_id =
                p_assay_definition_id
            AND existing.sample_type_id = sample_type.id
      );

    UPDATE public.assay_sample_type_catalog_revisions AS revision
    SET content_hash = NULL
    WHERE revision.id = p_revision_id
    RETURNING revision.updated_at INTO v_updated_at;

    RETURN jsonb_build_object(
        'revisionId', p_revision_id,
        'updatedAt', v_updated_at
    );
END;
$$;

CREATE FUNCTION public.review_assay_sample_type_catalog_revision(
    p_revision_id UUID,
    p_expected_revision_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_revision public.assay_sample_type_catalog_revisions%ROWTYPE;
    v_content_hash TEXT;
    v_updated_at TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL
       OR public.get_user_role() IS DISTINCT FROM 'manager'
    THEN
        RAISE EXCEPTION 'CATALOG_MANAGER_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    SELECT revision.*
    INTO v_revision
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.id = p_revision_id
    FOR UPDATE;

    IF v_revision.id IS NULL
       OR v_revision.status IS DISTINCT FROM 'draft'
    THEN
        RAISE EXCEPTION 'CATALOG_DRAFT_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_catalog_revisions AS revision
        WHERE revision.id = p_revision_id
          AND revision.updated_at IS DISTINCT FROM
              p_expected_revision_updated_at
    ) THEN
        RAISE EXCEPTION 'CATALOG_REVISION_CONFLICT'
            USING ERRCODE = '40001';
    END IF;

    PERFORM public.assert_assay_sample_type_catalog_publishable(
        p_revision_id
    );

    v_content_hash :=
        public.compute_assay_sample_type_catalog_hash(p_revision_id);

    UPDATE public.assay_sample_type_catalog_revisions AS revision
    SET content_hash = v_content_hash
    WHERE revision.id = p_revision_id
    RETURNING revision.updated_at INTO v_updated_at;

    RETURN jsonb_build_object(
        'revisionId', p_revision_id,
        'contentHash', v_content_hash,
        'updatedAt', v_updated_at
    );
END;
$$;

CREATE FUNCTION public.publish_assay_sample_type_catalog_revision(
    p_revision_id UUID,
    p_expected_revision_updated_at TIMESTAMPTZ,
    p_publish_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_revision public.assay_sample_type_catalog_revisions%ROWTYPE;
    v_content_hash TEXT;
    v_published_at TIMESTAMPTZ := now();
    v_updated_at TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL
       OR public.get_user_role() IS DISTINCT FROM 'manager'
    THEN
        RAISE EXCEPTION 'CATALOG_MANAGER_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    IF NULLIF(btrim(p_publish_reason), '') IS NULL THEN
        RAISE EXCEPTION 'CATALOG_PUBLISH_REASON_REQUIRED'
            USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(208110);

    LOCK TABLE public.assay_definitions IN SHARE MODE;
    LOCK TABLE public.sample_types IN SHARE MODE;

    SELECT revision.*
    INTO v_revision
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.id = p_revision_id
    FOR UPDATE;

    IF v_revision.id IS NULL
       OR v_revision.status IS DISTINCT FROM 'draft'
    THEN
        RAISE EXCEPTION 'CATALOG_DRAFT_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.assay_sample_type_catalog_revisions AS revision
        WHERE revision.id = p_revision_id
          AND revision.updated_at IS DISTINCT FROM
              p_expected_revision_updated_at
    ) THEN
        RAISE EXCEPTION 'CATALOG_REVISION_CONFLICT'
            USING ERRCODE = '40001';
    END IF;

    IF v_revision.content_hash IS NULL THEN
        RAISE EXCEPTION 'CATALOG_REVIEW_REQUIRED'
            USING ERRCODE = '23514';
    END IF;

    PERFORM public.assert_assay_sample_type_catalog_publishable(
        p_revision_id
    );

    v_content_hash :=
        public.compute_assay_sample_type_catalog_hash(p_revision_id);

    IF v_content_hash IS DISTINCT FROM v_revision.content_hash THEN
        RAISE EXCEPTION 'CATALOG_REVIEW_HASH_STALE'
            USING ERRCODE = '40001';
    END IF;

    UPDATE public.assay_sample_type_catalog_revisions AS revision
    SET
        status = 'superseded',
        superseded_by = v_user_id,
        superseded_at = v_published_at
    WHERE revision.status = 'published'
      AND revision.id <> p_revision_id;

    UPDATE public.assay_sample_type_catalog_revisions AS revision
    SET
        status = 'published',
        published_by = v_user_id,
        published_at = v_published_at,
        publish_reason = btrim(p_publish_reason)
    WHERE revision.id = p_revision_id
    RETURNING revision.updated_at INTO v_updated_at;

    RETURN jsonb_build_object(
        'revisionId', p_revision_id,
        'revisionNumber', v_revision.revision_number,
        'contentHash', v_content_hash,
        'publishedAt', v_published_at,
        'updatedAt', v_updated_at
    );
END;
$$;

COMMENT ON FUNCTION
public.get_assay_sample_type_catalog_manager(UUID)
IS 'Returns draft or published catalog coverage, candidates, decisions, allowlist, and diff to managers only.';

COMMENT ON FUNCTION
public.get_published_assay_sample_type_catalog(UUID)
IS 'Returns only generation-current published allowlist fields needed by analyst and manager callers.';

COMMENT ON FUNCTION
public.clone_assay_sample_type_catalog_revision(BIGINT, TEXT)
IS 'Creates one manager-owned draft cloned from the selected published revision.';

COMMENT ON FUNCTION
public.update_assay_sample_type_catalog_review(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID[],
    JSONB,
    TIMESTAMPTZ
)
IS 'Atomically reviews one assay, records every candidate decision, updates allowlist pairs, and invalidates the review hash.';

COMMENT ON FUNCTION
public.review_assay_sample_type_catalog_revision(UUID, TIMESTAMPTZ)
IS 'Validates full publish coverage and stores a server-computed content hash for explicit diff review.';

COMMENT ON FUNCTION
public.publish_assay_sample_type_catalog_revision(
    UUID,
    TIMESTAMPTZ,
    TEXT
)
IS 'Publishes a reviewed immutable catalog snapshot with manager actor and required reason; same-manager publication is allowed.';

REVOKE ALL ON FUNCTION
public.get_assay_sample_type_catalog_manager(UUID)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
public.get_published_assay_sample_type_catalog(UUID)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
public.clone_assay_sample_type_catalog_revision(BIGINT, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
public.update_assay_sample_type_catalog_review(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID[],
    JSONB,
    TIMESTAMPTZ
)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
public.review_assay_sample_type_catalog_revision(UUID, TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
public.publish_assay_sample_type_catalog_revision(
    UUID,
    TIMESTAMPTZ,
    TEXT
)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
public.get_assay_sample_type_catalog_manager(UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION
public.get_published_assay_sample_type_catalog(UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION
public.clone_assay_sample_type_catalog_revision(BIGINT, TEXT)
TO authenticated;
GRANT EXECUTE ON FUNCTION
public.update_assay_sample_type_catalog_review(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID[],
    JSONB,
    TIMESTAMPTZ
)
TO authenticated;
GRANT EXECUTE ON FUNCTION
public.review_assay_sample_type_catalog_revision(UUID, TIMESTAMPTZ)
TO authenticated;
GRANT EXECUTE ON FUNCTION
public.publish_assay_sample_type_catalog_revision(
    UUID,
    TIMESTAMPTZ,
    TEXT
)
TO authenticated;

DO $verification$
DECLARE
    v_function REGPROCEDURE;
    v_table_name TEXT;
BEGIN
    FOREACH v_function IN ARRAY ARRAY[
        'public.get_assay_sample_type_catalog_manager(uuid)'::REGPROCEDURE,
        'public.get_published_assay_sample_type_catalog(uuid)'::REGPROCEDURE,
        'public.clone_assay_sample_type_catalog_revision(bigint,text)'::REGPROCEDURE,
        'public.update_assay_sample_type_catalog_review(uuid,uuid,text,text,uuid[],jsonb,timestamp with time zone)'::REGPROCEDURE,
        'public.review_assay_sample_type_catalog_revision(uuid,timestamp with time zone)'::REGPROCEDURE,
        'public.publish_assay_sample_type_catalog_revision(uuid,timestamp with time zone,text)'::REGPROCEDURE
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_proc
            WHERE oid = v_function
              AND prosecdef
              AND proconfig @> ARRAY[
                  'search_path=public, extensions'
              ]
        )
           OR NOT has_function_privilege(
               'authenticated',
               v_function,
               'EXECUTE'
           )
           OR has_function_privilege('anon', v_function, 'EXECUTE')
           OR has_function_privilege(
               'service_role',
               v_function,
               'EXECUTE'
           )
        THEN
            RAISE EXCEPTION
                'Migration 208 function security verification failed: %',
                v_function;
        END IF;
    END LOOP;

    FOREACH v_table_name IN ARRAY ARRAY[
        'assay_sample_type_catalog_revisions',
        'assay_sample_type_reviews',
        'assay_sample_type_compatibilities',
        'assay_sample_type_candidates'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_class AS catalog_table
            JOIN pg_namespace AS table_schema
                ON table_schema.oid = catalog_table.relnamespace
            WHERE table_schema.nspname = 'public'
              AND catalog_table.relname = v_table_name
              AND catalog_table.relrowsecurity
        )
           OR has_table_privilege(
               'authenticated',
               format('public.%I', v_table_name),
               'SELECT'
           )
           OR has_table_privilege(
               'authenticated',
               format('public.%I', v_table_name),
               'INSERT'
           )
           OR has_table_privilege(
               'authenticated',
               format('public.%I', v_table_name),
               'UPDATE'
           )
        THEN
            RAISE EXCEPTION
                'Migration 208 catalog RLS boundary verification failed: %',
                v_table_name;
        END IF;
    END LOOP;
END;
$verification$;

COMMIT;
