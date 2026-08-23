-- Two-session rollback coverage for Phase 6 client revalidation.
-- Fixtures are committed for subprocess visibility and removed before exit.

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

SELECT current_database() AS concurrency_database \gset
\setenv PGDATABASE :concurrency_database

DO $database_guard$
BEGIN
    IF current_database() = 'postgres' THEN
        RAISE EXCEPTION
            'Caller cutover concurrency test requires a rehearsal database';
    END IF;
END;
$database_guard$;

DO $contract$
BEGIN
    IF to_regprocedure(
        'public.create_sample_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,uuid,boolean,bigint)'
    ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 228 sample cutover RPC is missing';
    END IF;
END;
$contract$;

CREATE FUNCTION pg_temp.cleanup_client_cutover_revalidation()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_actor_id CONSTANT UUID :=
        '95360100-0000-0000-0000-000000000001';
    v_client_id CONSTANT UUID :=
        '95360100-0000-0000-0000-000000000010';
    v_sample_ids UUID[];
BEGIN
    SELECT array_agg(sample.id)
    INTO v_sample_ids
    FROM public.samples AS sample
    WHERE sample.client_id = v_client_id;

    DELETE FROM public.audit_logs
    WHERE changed_by = v_actor_id
       OR record_id = v_actor_id
       OR record_id = v_client_id
       OR record_id = ANY(COALESCE(v_sample_ids, ARRAY[]::UUID[]));

    DELETE FROM public.results
    WHERE sample_id = ANY(COALESCE(v_sample_ids, ARRAY[]::UUID[]));

    DELETE FROM public.samples
    WHERE id = ANY(COALESCE(v_sample_ids, ARRAY[]::UUID[]));

    DELETE FROM public.clients
    WHERE id = v_client_id;

    DELETE FROM public.audit_logs
    WHERE changed_by = v_actor_id
       OR record_id = v_actor_id
       OR record_id = v_client_id
       OR record_id = ANY(COALESCE(v_sample_ids, ARRAY[]::UUID[]));

    DELETE FROM public.users
    WHERE id = v_actor_id;

    DELETE FROM auth.users
    WHERE id = v_actor_id;
END;
$$;

SELECT pg_temp.cleanup_client_cutover_revalidation();

INSERT INTO auth.users (id, email)
VALUES (
    '95360100-0000-0000-0000-000000000001',
    'issue111-phase6-revalidation@lims.local'
);

INSERT INTO public.users (
    id,
    username,
    full_name,
    role,
    email,
    can_access_confidential,
    deleted_at
)
VALUES (
    '95360100-0000-0000-0000-000000000001',
    'issue111_phase6_revalidation',
    'Issue 111 Phase 6 Revalidation',
    'analyst',
    'issue111-phase6-revalidation@lims.local',
    FALSE,
    NULL
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
    '95360100-0000-0000-0000-000000000010',
    '953601000010',
    'Issue 111 Phase 6 Revalidation Race',
    DATE '1993-06-15',
    'Khác',
    '0953601010',
    'Concurrency fixture'
);

\! rm -f /tmp/client-cutover-locker.out /tmp/client-cutover-race.out /tmp/client-cutover-race.err /tmp/client-cutover-race-status
\! timeout --kill-after=5s 30s sh -c "psql -v ON_ERROR_STOP=1 -U postgres -X -q -c \"BEGIN; UPDATE public.clients SET deleted_at = clock_timestamp(), deleted_by = '95360100-0000-0000-0000-000000000001', deletion_reason = 'Phase 6 revalidation race' WHERE id = '95360100-0000-0000-0000-000000000010'; SELECT pg_sleep(1); COMMIT;\" > /tmp/client-cutover-locker.out 2>&1 & locker_pid=\$!; sleep 0.2; psql -v ON_ERROR_STOP=1 -U postgres -X -Atq -c \"SET request.jwt.claims TO '{\\\"sub\\\":\\\"95360100-0000-0000-0000-000000000001\\\",\\\"role\\\":\\\"authenticated\\\"}'; SET request.jwt.claim.sub TO '95360100-0000-0000-0000-000000000001'; SET request.jwt.claim.role TO 'authenticated'; SET ROLE authenticated; WITH compatible AS (SELECT compatibility.sample_type_id, revision.revision_number FROM public.assay_sample_type_compatibilities AS compatibility JOIN public.assay_sample_type_catalog_revisions AS revision ON revision.id = compatibility.revision_id AND revision.status = 'published' JOIN public.assay_sample_type_reviews AS review ON review.revision_id = compatibility.revision_id AND review.assay_definition_id = compatibility.assay_definition_id AND review.disposition = 'configured' JOIN public.assay_definitions AS assay_definition ON assay_definition.id = compatibility.assay_definition_id AND assay_definition.deleted_at IS NULL AND NOT assay_definition.is_confidential JOIN public.sample_types AS sample_type ON sample_type.id = compatibility.sample_type_id AND sample_type.deleted_at IS NULL WHERE compatibility.removed_at IS NULL AND compatibility.assay_compatibility_generation = assay_definition.compatibility_generation AND compatibility.sample_type_compatibility_generation = sample_type.compatibility_generation ORDER BY compatibility.created_at, compatibility.id LIMIT 1) SELECT public.create_sample_with_client_resolution_v2(FALSE, 'cccd', '953601000010', 'Issue 111 Phase 6 Revalidation Race', DATE '1993-06-15', NULL, '0953601010', NULL, NULL, NULL, NULL::TIMESTAMPTZ, compatible.sample_type_id, TRUE, compatible.revision_number)::TEXT FROM compatible;\" > /tmp/client-cutover-race.out 2> /tmp/client-cutover-race.err; race_status=\$?; wait \$locker_pid; locker_status=\$?; [ \"\$locker_status\" -eq 0 ] && [ \"\$race_status\" -eq 0 ] && [ \"\$(wc -l < /tmp/client-cutover-race.out)\" -eq 1 ] && [ ! -s /tmp/client-cutover-race.err ] && ! grep -Eq '40001|initial_client_id|revalidated_client_id|95360100-0000-0000-0000-000000000010' /tmp/client-cutover-race.out /tmp/client-cutover-race.err\" && printf '0\n' > /tmp/client-cutover-race-status || printf '1\n' > /tmp/client-cutover-race-status
\set race_shell_failed `cat /tmp/client-cutover-race-status`

\if :race_shell_failed
    \! cat /tmp/client-cutover-locker.out /tmp/client-cutover-race.out /tmp/client-cutover-race.err
    SELECT FALSE AS race_outcome_valid, FALSE AS no_race_mutation \gset
\else
    CREATE TEMP TABLE client_cutover_race_output (
        envelope JSONB NOT NULL
    ) ON COMMIT DROP;

    \copy client_cutover_race_output (envelope) FROM '/tmp/client-cutover-race.out'

    SELECT
        count(*) = 1
        AND bool_and(
            race.envelope #>> '{resolution,outcome}' = 'conflict'
            AND race.envelope #>> '{resolution,reason_code}' =
                'inactive_candidate'
            AND race.envelope #>> '{resolution,client_id}' IS NULL
            AND race.envelope->'sample' = 'null'::JSONB
        ) AS race_outcome_valid
    FROM client_cutover_race_output AS race
    \gset

    SELECT
        NOT EXISTS (
            SELECT 1
            FROM public.samples AS sample
            WHERE sample.client_id =
                '95360100-0000-0000-0000-000000000010'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.results AS result
            JOIN public.samples AS sample
              ON sample.id = result.sample_id
            WHERE sample.client_id =
                '95360100-0000-0000-0000-000000000010'
        ) AS no_race_mutation
    \gset
\endif

SELECT pg_temp.cleanup_client_cutover_revalidation();
\! rm -f /tmp/client-cutover-locker.out /tmp/client-cutover-race.out /tmp/client-cutover-race.err /tmp/client-cutover-race-status

\if :race_shell_failed
    DO $shell_failure$
    BEGIN
        RAISE EXCEPTION
            'Client cutover revalidation shell sessions failed';
    END;
    $shell_failure$;
\endif

\if :race_outcome_valid
\else
    DO $outcome_failure$
    BEGIN
        RAISE EXCEPTION
            'Client cutover revalidation did not return a stable conflict';
    END;
    $outcome_failure$;
\endif

\if :no_race_mutation
    SELECT 'client cutover revalidation concurrency test passed' AS result;
\else
    DO $mutation_failure$
    BEGIN
        RAISE EXCEPTION
            'Client cutover revalidation race mutated sample or result data';
    END;
    $mutation_failure$;
\endif
