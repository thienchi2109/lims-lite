-- Migration 229: Restore active assay availability for the active blood type.
--
-- Security impact:
-- - Reuses manager-only SECURITY DEFINER catalog RPCs with transaction-local
--   claims for the existing system manager; no policy, grant, or RPC changes.
-- - Keeps frontend fail-closed filtering and database assignment enforcement.
--
-- Data impact:
-- - Publishes compatibility revision 2 from the reviewed 84/25/59 baseline.
-- - Changes only the 59 active not-assignable reviews in the cloned draft.
-- - Leaves soft-deleted assay definitions and their availability unchanged.
--
-- Rollback strategy: publish a later forward-only revision that restores the
-- prior decisions; never mutate or delete the published revision created here.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $restore_active_assay_availability$
DECLARE
    v_system_actor_id CONSTANT UUID :=
        '00000000-0000-0000-0000-000000000000';
    v_expected_source_content_hash CONSTANT TEXT :=
        '0cdcea589e48a88d6ed2c51619436bc872e6400b7ccc1d9f75db900ce49b165a';
    v_source_revision_id UUID;
    v_source_stored_content_hash TEXT;
    v_source_computed_content_hash TEXT;
    v_blood_sample_type_id UUID;
    v_draft_revision_id UUID;
    v_revision_updated_at TIMESTAMPTZ;
    v_clone_result JSONB;
    v_update_result JSONB;
    v_review_result JSONB;
    v_publish_result JSONB;
    v_candidate_decisions JSONB;
    v_assay_review RECORD;
    v_revision_count BIGINT;
    v_draft_count BIGINT;
    v_audit_trigger_count BIGINT;
    v_system_actor_count BIGINT;
    v_active_sample_type_count BIGINT;
    v_active_assay_count BIGINT;
    v_reviewed_active_assay_count BIGINT;
    v_configured_assay_count BIGINT;
    v_hidden_active_assay_count BIGINT;
    v_recovered_assay_count BIGINT := 0;
    v_source_superseded_count BIGINT;
    v_target_published_count BIGINT;
    v_published_revision_count BIGINT;
    v_final_draft_count BIGINT;
    v_final_configured_assay_count BIGINT;
    v_final_hidden_active_assay_count BIGINT;
    v_final_blood_mapping_count BIGINT;
    v_total_current_mapping_count BIGINT;
    v_soft_deleted_mapping_count BIGINT;
    v_deleted_sample_type_mapping_count BIGINT;
    v_reported_assay_mapping_count BIGINT;
    v_target_revision_audit_count BIGINT;
    v_source_revision_audit_count BIGINT;
    v_recovered_review_audit_count BIGINT;
    v_compatibility_audit_count BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(208110);

    IF to_regclass('auth.users') IS NULL
       OR to_regclass('public.assay_definitions') IS NULL
       OR to_regclass('public.audit_logs') IS NULL
       OR to_regclass('public.sample_types') IS NULL
       OR to_regclass('public.users') IS NULL
       OR to_regclass(
           'public.assay_sample_type_catalog_revisions'
       ) IS NULL
       OR to_regclass('public.assay_sample_type_reviews') IS NULL
       OR to_regclass('public.assay_sample_type_candidates') IS NULL
       OR to_regclass(
           'public.assay_sample_type_compatibilities'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 229 requires the compatibility catalog baseline';
    END IF;

    IF to_regprocedure('public.get_user_role()') IS NULL
       OR to_regprocedure(
           'public.compute_assay_sample_type_catalog_hash(uuid)'
       ) IS NULL
       OR to_regprocedure(
           'public.clone_assay_sample_type_catalog_revision(bigint,text)'
       ) IS NULL
       OR to_regprocedure(
           'public.update_assay_sample_type_catalog_review(uuid,uuid,text,text,uuid[],jsonb,timestamp with time zone)'
       ) IS NULL
       OR to_regprocedure(
           'public.review_assay_sample_type_catalog_revision(uuid,timestamp with time zone)'
       ) IS NULL
       OR to_regprocedure(
           'public.publish_assay_sample_type_catalog_revision(uuid,timestamp with time zone,text)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 229 requires compatibility catalog manager RPCs';
    END IF;

    SELECT count(*)
    INTO v_audit_trigger_count
    FROM pg_trigger AS trigger_record
    WHERE (
        (
            trigger_record.tgrelid =
                'public.assay_sample_type_catalog_revisions'::REGCLASS
            AND trigger_record.tgname =
                'audit_assay_sample_type_catalog_revisions'
        )
        OR (
            trigger_record.tgrelid =
                'public.assay_sample_type_reviews'::REGCLASS
            AND trigger_record.tgname =
                'audit_assay_sample_type_reviews'
        )
        OR (
            trigger_record.tgrelid =
                'public.assay_sample_type_candidates'::REGCLASS
            AND trigger_record.tgname =
                'audit_assay_sample_type_candidates'
        )
        OR (
            trigger_record.tgrelid =
                'public.assay_sample_type_compatibilities'::REGCLASS
            AND trigger_record.tgname =
                'audit_assay_sample_type_compatibilities'
        )
    )
      AND trigger_record.tgenabled = 'O'
      AND trigger_record.tgfoid =
          'public.trigger_audit_log()'::REGPROCEDURE
      AND trigger_record.tgtype = 29
      AND NOT trigger_record.tgisinternal;

    IF v_audit_trigger_count IS DISTINCT FROM 4 THEN
        RAISE EXCEPTION
            'Migration 229 requires four enabled catalog audit triggers';
    END IF;

    SELECT count(*)
    INTO v_revision_count
    FROM public.assay_sample_type_catalog_revisions;

    SELECT
        revision.id,
        revision.content_hash,
        public.compute_assay_sample_type_catalog_hash(revision.id)
    INTO
        v_source_revision_id,
        v_source_stored_content_hash,
        v_source_computed_content_hash
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.revision_number = 1
      AND revision.status = 'published'
      AND revision.source_revision_id IS NULL;

    SELECT count(*)
    INTO v_draft_count
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.status = 'draft';

    IF v_revision_count IS DISTINCT FROM 1
       OR v_source_revision_id IS NULL
       OR v_draft_count IS DISTINCT FROM 0
       OR v_source_stored_content_hash IS DISTINCT FROM
          v_expected_source_content_hash
       OR v_source_computed_content_hash IS DISTINCT FROM
          v_expected_source_content_hash
    THEN
        RAISE EXCEPTION
            'Migration 229 catalog baseline drift: revisions %, source %, drafts %, stored hash %, computed hash %',
            v_revision_count,
            v_source_revision_id,
            v_draft_count,
            v_source_stored_content_hash,
            v_source_computed_content_hash;
    END IF;

    SELECT count(*)
    INTO v_active_sample_type_count
    FROM public.sample_types AS sample_type
    WHERE sample_type.deleted_at IS NULL;

    SELECT sample_type.id
    INTO v_blood_sample_type_id
    FROM public.sample_types AS sample_type
    WHERE sample_type.import_code = 'LM-000001'
      AND sample_type.deleted_at IS NULL;

    IF v_active_sample_type_count IS DISTINCT FROM 1
       OR v_blood_sample_type_id IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 229 sample-type baseline drift: active %, LM-000001 %',
            v_active_sample_type_count,
            v_blood_sample_type_id;
    END IF;

    SELECT count(*)
    INTO v_system_actor_count
    FROM public.users AS user_profile
    JOIN auth.users AS auth_user
        ON auth_user.id = user_profile.id
    WHERE user_profile.id = v_system_actor_id
      AND user_profile.role = 'manager'
      AND auth_user.deleted_at IS NULL
      AND (
          auth_user.banned_until IS NULL
          OR auth_user.banned_until <= now()
      );

    IF v_system_actor_count IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION
            'Migration 229 requires the active system manager actor';
    END IF;

    SELECT count(*)
    INTO v_active_assay_count
    FROM public.assay_definitions AS assay_definition
    WHERE assay_definition.deleted_at IS NULL;

    SELECT count(*)
    INTO v_reviewed_active_assay_count
    FROM public.assay_sample_type_reviews AS review
    JOIN public.assay_definitions AS assay_definition
        ON assay_definition.id = review.assay_definition_id
    WHERE review.revision_id = v_source_revision_id
      AND assay_definition.deleted_at IS NULL
      AND review.assay_compatibility_generation =
          assay_definition.compatibility_generation;

    SELECT count(*)
    INTO v_configured_assay_count
    FROM public.assay_sample_type_reviews AS review
    JOIN public.assay_definitions AS assay_definition
        ON assay_definition.id = review.assay_definition_id
    WHERE review.revision_id = v_source_revision_id
      AND review.disposition = 'configured'
      AND assay_definition.deleted_at IS NULL
      AND review.assay_compatibility_generation =
          assay_definition.compatibility_generation;

    SELECT count(*)
    INTO v_hidden_active_assay_count
    FROM public.assay_sample_type_reviews AS review
    JOIN public.assay_definitions AS assay_definition
        ON assay_definition.id = review.assay_definition_id
    WHERE review.revision_id = v_source_revision_id
      AND review.disposition = 'not_assignable'
      AND assay_definition.deleted_at IS NULL
      AND review.assay_compatibility_generation =
          assay_definition.compatibility_generation;

    IF v_active_assay_count IS DISTINCT FROM 84
       OR v_reviewed_active_assay_count IS DISTINCT FROM 84
       OR v_configured_assay_count IS DISTINCT FROM 25
       OR v_hidden_active_assay_count IS DISTINCT FROM 59
    THEN
        RAISE EXCEPTION
            'Migration 229 assay baseline drift: active %, reviewed %, configured %, hidden %',
            v_active_assay_count,
            v_reviewed_active_assay_count,
            v_configured_assay_count,
            v_hidden_active_assay_count;
    END IF;

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub',
            v_system_actor_id::TEXT,
            'role',
            'authenticated'
        )::TEXT,
        TRUE
    );

    IF auth.uid() IS DISTINCT FROM v_system_actor_id
       OR public.get_user_role() IS DISTINCT FROM 'manager'
    THEN
        RAISE EXCEPTION
            'Migration 229 could not establish the system manager actor';
    END IF;

    v_clone_result :=
        public.clone_assay_sample_type_catalog_revision(
            1,
            'Authorized recovery of active assay availability for LM-000001'
        );
    v_draft_revision_id :=
        (v_clone_result ->> 'revisionId')::UUID;
    v_revision_updated_at :=
        (v_clone_result ->> 'updatedAt')::TIMESTAMPTZ;

    IF v_draft_revision_id IS NULL
       OR (v_clone_result ->> 'revisionNumber')::BIGINT
            IS DISTINCT FROM 2
    THEN
        RAISE EXCEPTION
            'Migration 229 expected clone RPC to create revision 2';
    END IF;

    FOR v_assay_review IN
        SELECT review.assay_definition_id
        FROM public.assay_sample_type_reviews AS review
        JOIN public.assay_definitions AS assay_definition
            ON assay_definition.id = review.assay_definition_id
        WHERE review.revision_id = v_draft_revision_id
          AND review.disposition = 'not_assignable'
          AND assay_definition.deleted_at IS NULL
        ORDER BY review.assay_definition_id
    LOOP
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'candidate_id',
                    candidate.id,
                    'decision',
                    CASE
                        WHEN candidate.sample_type_id =
                            v_blood_sample_type_id
                        THEN 'accepted'
                        ELSE 'rejected'
                    END,
                    'reason',
                    CASE
                        WHEN candidate.sample_type_id =
                            v_blood_sample_type_id
                        THEN
                            'Authorized active-assay recovery for LM-000001'
                        ELSE
                            'Candidate is outside the LM-000001 recovery scope'
                    END
                )
                ORDER BY candidate.id
            ),
            '[]'::JSONB
        )
        INTO v_candidate_decisions
        FROM public.assay_sample_type_candidates AS candidate
        WHERE candidate.revision_id = v_draft_revision_id
          AND candidate.assay_definition_id =
              v_assay_review.assay_definition_id;

        v_update_result :=
            public.update_assay_sample_type_catalog_review(
                v_draft_revision_id,
                v_assay_review.assay_definition_id,
                'configured',
                'Authorized restoration of active assay availability for LM-000001',
                ARRAY[v_blood_sample_type_id]::UUID[],
                v_candidate_decisions,
                v_revision_updated_at
            );
        v_revision_updated_at :=
            (v_update_result ->> 'updatedAt')::TIMESTAMPTZ;
        v_recovered_assay_count := v_recovered_assay_count + 1;
    END LOOP;

    IF v_recovered_assay_count IS DISTINCT FROM 59 THEN
        RAISE EXCEPTION
            'Migration 229 expected to recover 59 assays, recovered %',
            v_recovered_assay_count;
    END IF;

    v_review_result :=
        public.review_assay_sample_type_catalog_revision(
            v_draft_revision_id,
            v_revision_updated_at
        );
    v_revision_updated_at :=
        (v_review_result ->> 'updatedAt')::TIMESTAMPTZ;

    v_publish_result :=
        public.publish_assay_sample_type_catalog_revision(
            v_draft_revision_id,
            v_revision_updated_at,
            'Publish authorized active-assay availability recovery for LM-000001'
        );

    IF (v_publish_result ->> 'revisionNumber')::BIGINT
        IS DISTINCT FROM 2
    THEN
        RAISE EXCEPTION
            'Migration 229 publish RPC did not publish revision 2';
    END IF;

    SELECT count(*)
    INTO v_source_superseded_count
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.revision_number = 1
      AND revision.status = 'superseded'
      AND revision.superseded_by = v_system_actor_id;

    SELECT count(*)
    INTO v_target_published_count
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.revision_number = 2
      AND revision.id = v_draft_revision_id
      AND revision.status = 'published'
      AND revision.source_revision_id = v_source_revision_id
      AND revision.created_by = v_system_actor_id
      AND revision.published_by = v_system_actor_id;

    SELECT count(*)
    INTO v_published_revision_count
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.status = 'published';

    SELECT count(*)
    INTO v_final_draft_count
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.status = 'draft';

    SELECT count(*)
    INTO v_final_configured_assay_count
    FROM public.assay_sample_type_reviews AS review
    JOIN public.assay_definitions AS assay_definition
        ON assay_definition.id = review.assay_definition_id
    WHERE review.revision_id = v_draft_revision_id
      AND review.disposition = 'configured'
      AND assay_definition.deleted_at IS NULL
      AND review.assay_compatibility_generation =
          assay_definition.compatibility_generation;

    SELECT count(*)
    INTO v_final_hidden_active_assay_count
    FROM public.assay_sample_type_reviews AS review
    JOIN public.assay_definitions AS assay_definition
        ON assay_definition.id = review.assay_definition_id
    WHERE review.revision_id = v_draft_revision_id
      AND review.disposition = 'not_assignable'
      AND assay_definition.deleted_at IS NULL;

    SELECT count(*)
    INTO v_final_blood_mapping_count
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_definitions AS assay_definition
        ON assay_definition.id = compatibility.assay_definition_id
    JOIN public.sample_types AS sample_type
        ON sample_type.id = compatibility.sample_type_id
    WHERE compatibility.revision_id = v_draft_revision_id
      AND compatibility.sample_type_id = v_blood_sample_type_id
      AND compatibility.removed_at IS NULL
      AND assay_definition.deleted_at IS NULL
      AND sample_type.deleted_at IS NULL
      AND compatibility.assay_compatibility_generation =
          assay_definition.compatibility_generation
      AND compatibility.sample_type_compatibility_generation =
          sample_type.compatibility_generation;

    SELECT count(*)
    INTO v_total_current_mapping_count
    FROM public.assay_sample_type_compatibilities AS compatibility
    WHERE compatibility.revision_id = v_draft_revision_id
      AND compatibility.removed_at IS NULL;

    SELECT count(*)
    INTO v_soft_deleted_mapping_count
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_definitions AS assay_definition
        ON assay_definition.id = compatibility.assay_definition_id
    WHERE compatibility.revision_id = v_draft_revision_id
      AND compatibility.removed_at IS NULL
      AND assay_definition.deleted_at IS NOT NULL;

    SELECT count(*)
    INTO v_deleted_sample_type_mapping_count
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.sample_types AS sample_type
        ON sample_type.id = compatibility.sample_type_id
    WHERE compatibility.revision_id = v_draft_revision_id
      AND compatibility.removed_at IS NULL
      AND sample_type.deleted_at IS NOT NULL;

    SELECT count(DISTINCT assay_definition.id)
    INTO v_reported_assay_mapping_count
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_definitions AS assay_definition
        ON assay_definition.id = compatibility.assay_definition_id
    WHERE compatibility.revision_id = v_draft_revision_id
      AND compatibility.sample_type_id = v_blood_sample_type_id
      AND compatibility.removed_at IS NULL
      AND assay_definition.deleted_at IS NULL
      AND assay_definition.import_code IN (
          'CT-000260',
          'CT-000261',
          'CT-000277',
          'CT-000278'
      );

    SELECT count(*)
    INTO v_target_revision_audit_count
    FROM public.audit_logs AS audit
    WHERE audit.table_name =
          'assay_sample_type_catalog_revisions'
      AND audit.record_id = v_draft_revision_id
      AND audit.changed_by = v_system_actor_id;

    SELECT count(*)
    INTO v_source_revision_audit_count
    FROM public.audit_logs AS audit
    WHERE audit.table_name =
          'assay_sample_type_catalog_revisions'
      AND audit.record_id = v_source_revision_id
      AND audit.operation = 'UPDATE'
      AND audit.changed_by = v_system_actor_id
      AND audit.new_values ->> 'status' = 'superseded';

    SELECT count(*)
    INTO v_recovered_review_audit_count
    FROM public.audit_logs AS audit
    WHERE audit.table_name = 'assay_sample_type_reviews'
      AND audit.operation = 'UPDATE'
      AND audit.changed_by = v_system_actor_id
      AND audit.new_values ->> 'revision_id' =
          v_draft_revision_id::TEXT
      AND audit.old_values ->> 'disposition' = 'not_assignable'
      AND audit.new_values ->> 'disposition' = 'configured';

    SELECT count(*)
    INTO v_compatibility_audit_count
    FROM public.audit_logs AS audit
    WHERE audit.table_name =
          'assay_sample_type_compatibilities'
      AND audit.operation = 'INSERT'
      AND audit.changed_by = v_system_actor_id
      AND audit.new_values ->> 'revision_id' =
          v_draft_revision_id::TEXT;

    IF v_source_superseded_count IS DISTINCT FROM 1
       OR v_target_published_count IS DISTINCT FROM 1
       OR v_published_revision_count IS DISTINCT FROM 1
       OR v_final_draft_count IS DISTINCT FROM 0
       OR v_final_configured_assay_count IS DISTINCT FROM 84
       OR v_final_hidden_active_assay_count IS DISTINCT FROM 0
       OR v_final_blood_mapping_count IS DISTINCT FROM 84
       OR v_total_current_mapping_count IS DISTINCT FROM 84
       OR v_soft_deleted_mapping_count IS DISTINCT FROM 0
       OR v_deleted_sample_type_mapping_count IS DISTINCT FROM 0
       OR v_reported_assay_mapping_count IS DISTINCT FROM 4
       OR v_target_revision_audit_count < 3
       OR v_source_revision_audit_count < 1
       OR v_recovered_review_audit_count IS DISTINCT FROM 59
       OR v_compatibility_audit_count IS DISTINCT FROM 84
    THEN
        RAISE EXCEPTION
            'Migration 229 verification failed: source %, target %, published %, drafts %, configured %, hidden %, blood %, total %, deleted assays %, deleted types %, reported %, target audits %, source audits %, review audits %, compatibility audits %',
            v_source_superseded_count,
            v_target_published_count,
            v_published_revision_count,
            v_final_draft_count,
            v_final_configured_assay_count,
            v_final_hidden_active_assay_count,
            v_final_blood_mapping_count,
            v_total_current_mapping_count,
            v_soft_deleted_mapping_count,
            v_deleted_sample_type_mapping_count,
            v_reported_assay_mapping_count,
            v_target_revision_audit_count,
            v_source_revision_audit_count,
            v_recovered_review_audit_count,
            v_compatibility_audit_count;
    END IF;
END;
$restore_active_assay_availability$;

COMMIT;
