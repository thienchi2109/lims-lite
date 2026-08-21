-- ASSAY SAMPLE-TYPE ENFORCEMENT CONCURRENCY CONTRACT
-- Proves additive assignment and sample-type master rename use compatible
-- lock ordering. Fixtures are committed for two-session visibility, then
-- removed before this test exits.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

CREATE FUNCTION pg_temp.cleanup_assay_sample_type_concurrency()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.audit_logs
    WHERE table_name = 'results'
      AND COALESCE(
          new_values->>'sample_id',
          old_values->>'sample_id'
      ) = '95200000-0000-0000-0000-000000000010';
    DELETE FROM public.audit_logs
    WHERE record_id::TEXT LIKE
        '95200000-0000-0000-0000-0000000000%';
    DELETE FROM public.results
    WHERE sample_id = '95200000-0000-0000-0000-000000000010';
    DELETE FROM public.samples
    WHERE id = '95200000-0000-0000-0000-000000000010';
    DELETE FROM public.clients
    WHERE id = '95200000-0000-0000-0000-000000000002';
    DELETE FROM public.users
    WHERE id = '95200000-0000-0000-0000-000000000001';
    DELETE FROM auth.users
    WHERE id = '95200000-0000-0000-0000-000000000001';
    DELETE FROM public.audit_logs
    WHERE table_name = 'results'
      AND COALESCE(
          new_values->>'sample_id',
          old_values->>'sample_id'
      ) = '95200000-0000-0000-0000-000000000010';
    DELETE FROM public.audit_logs
    WHERE record_id::TEXT LIKE
        '95200000-0000-0000-0000-0000000000%';
END;
$$;

SELECT pg_temp.cleanup_assay_sample_type_concurrency();

DO $fixtures$
DECLARE
    v_sample_type_id UUID;
    v_sample_type_name TEXT;
BEGIN
    SELECT
        compatibility.sample_type_id,
        sample_type.name
    INTO v_sample_type_id, v_sample_type_name
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_sample_type_catalog_revisions AS revision
      ON revision.id = compatibility.revision_id
     AND revision.status = 'published'
    JOIN public.sample_types AS sample_type
      ON sample_type.id = compatibility.sample_type_id
     AND sample_type.deleted_at IS NULL
    JOIN public.assay_definitions AS assay_definition
      ON assay_definition.id = compatibility.assay_definition_id
     AND assay_definition.deleted_at IS NULL
    JOIN public.assay_sample_type_reviews AS review
      ON review.revision_id = compatibility.revision_id
     AND review.assay_definition_id =
         compatibility.assay_definition_id
     AND review.disposition = 'configured'
    WHERE compatibility.removed_at IS NULL
      AND compatibility.assay_compatibility_generation =
          assay_definition.compatibility_generation
      AND compatibility.sample_type_compatibility_generation =
          sample_type.compatibility_generation
    ORDER BY compatibility.created_at
    LIMIT 1;

    IF v_sample_type_id IS NULL THEN
        RAISE EXCEPTION
            'Concurrency drill requires one current published pair';
    END IF;

    INSERT INTO auth.users (id, email)
    VALUES (
        '95200000-0000-0000-0000-000000000001',
        'compatibility-phase8-concurrency@lims.local'
    );

    INSERT INTO public.users (
        id,
        username,
        full_name,
        role,
        email,
        can_access_confidential
    )
    VALUES (
        '95200000-0000-0000-0000-000000000001',
        'compatibility_phase8_concurrency',
        'Compatibility Phase 8 Concurrency',
        'analyst',
        'compatibility-phase8-concurrency@lims.local',
        FALSE
    );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address
    )
    VALUES (
        '95200000-0000-0000-0000-000000000002',
        '079203009502',
        'Compatibility Phase 8 Concurrency Client',
        DATE '1990-01-01',
        'Nam',
        '0900000502',
        'CDC'
    );

    INSERT INTO public.samples (
        id,
        sample_id,
        client_id,
        client_name,
        status,
        received_by,
        type,
        sample_type_id,
        sample_quality
    )
    VALUES (
        '95200000-0000-0000-0000-000000000010',
        'COMPATIBILITY-PHASE8-CONCURRENCY',
        '95200000-0000-0000-0000-000000000002',
        'Compatibility Phase 8 Concurrency Client',
        'received',
        '95200000-0000-0000-0000-000000000001',
        v_sample_type_name,
        v_sample_type_id,
        TRUE
    );
END;
$fixtures$;

\! rm -f /tmp/assay-sample-type-rename.out /tmp/assay-sample-type-assign.out /tmp/assay-sample-type-concurrency-status
\! timeout --kill-after=5s 30s sh -c "psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SET lock_timeout = '5s'; SELECT sample_type.id FROM public.sample_types AS sample_type WHERE sample_type.id = (SELECT sample.sample_type_id FROM public.samples AS sample WHERE sample.id = '95200000-0000-0000-0000-000000000010'::uuid) FOR UPDATE; SELECT pg_sleep(1); UPDATE public.sample_types SET name = name || ' Phase 8 Lock Drill' WHERE id = (SELECT sample.sample_type_id FROM public.samples AS sample WHERE sample.id = '95200000-0000-0000-0000-000000000010'::uuid); ROLLBACK;\" > /tmp/assay-sample-type-rename.out 2>&1 & first_pid=\$!; sleep 0.2; psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SET lock_timeout = '5s'; SET request.jwt.claims TO '{\\\"sub\\\":\\\"95200000-0000-0000-0000-000000000001\\\",\\\"role\\\":\\\"authenticated\\\"}'; SET request.jwt.claim.sub TO '95200000-0000-0000-0000-000000000001'; SET ROLE authenticated; SELECT public.assign_tests_to_sample_v2('95200000-0000-0000-0000-000000000010'::uuid, (SELECT sample.sample_type_id FROM public.samples AS sample WHERE sample.id = '95200000-0000-0000-0000-000000000010'::uuid), jsonb_build_array(jsonb_build_object('assayId', (SELECT compatibility.assay_definition_id::text FROM public.assay_sample_type_compatibilities AS compatibility JOIN public.assay_sample_type_catalog_revisions AS revision ON revision.id = compatibility.revision_id AND revision.status = 'published' WHERE compatibility.sample_type_id = (SELECT sample.sample_type_id FROM public.samples AS sample WHERE sample.id = '95200000-0000-0000-0000-000000000010'::uuid) AND compatibility.removed_at IS NULL ORDER BY compatibility.created_at LIMIT 1))), (SELECT revision.revision_number FROM public.assay_sample_type_catalog_revisions AS revision WHERE revision.status = 'published')); COMMIT;\" > /tmp/assay-sample-type-assign.out 2>&1; assign_status=\$?; wait \$first_pid; rename_status=\$?; [ \"\$rename_status\" -eq 0 ] && [ \"\$assign_status\" -eq 0 ] && grep -q '\"inserted_count\": 1' /tmp/assay-sample-type-assign.out && ! grep -Eq 'deadlock detected|40P01' /tmp/assay-sample-type-rename.out /tmp/assay-sample-type-assign.out" && printf '0\n' > /tmp/assay-sample-type-concurrency-status || printf '1\n' > /tmp/assay-sample-type-concurrency-status
\set concurrency_shell_failed `cat /tmp/assay-sample-type-concurrency-status`

\if :concurrency_shell_failed
    \! cat /tmp/assay-sample-type-rename.out /tmp/assay-sample-type-assign.out
\else
    SELECT (
        SELECT COUNT(*) = 1
        FROM public.results
        WHERE sample_id =
            '95200000-0000-0000-0000-000000000010'
    ) AS concurrency_verified
    \gset
\endif

SELECT pg_temp.cleanup_assay_sample_type_concurrency();
\! rm -f /tmp/assay-sample-type-rename.out /tmp/assay-sample-type-assign.out /tmp/assay-sample-type-concurrency-status

\if :concurrency_shell_failed
    DO $shell_failure$
    BEGIN
        RAISE EXCEPTION
            'Assignment versus sample-type rename shell sessions failed';
    END;
    $shell_failure$;
\endif

\if :concurrency_verified
    SELECT 'assay-sample-type-enforcement-concurrency: ok' AS result;
\else
    DO $verification_failure$
    BEGIN
        RAISE EXCEPTION
            'Assignment versus sample-type rename verification failed';
    END;
    $verification_failure$;
\endif
