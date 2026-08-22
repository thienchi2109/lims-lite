-- Two-session concurrency coverage for deterministic resolve-and-create.
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
            'Concurrency test must run in an isolated rehearsal database';
    END IF;
END;
$database_guard$;

CREATE FUNCTION pg_temp.cleanup_client_resolution_concurrency()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_client_ids UUID[];
BEGIN
    SELECT array_agg(id)
    INTO v_client_ids
    FROM public.clients
    WHERE normalized_name =
        public.normalize_client_name_v1('Issue 111 Phase 4 Concurrent Client')
      AND date_of_birth = DATE '1996-04-21';

    DELETE FROM public.audit_logs
    WHERE record_id = ANY(COALESCE(v_client_ids, ARRAY[]::UUID[]))
       OR record_id = '95330000-0000-0000-0000-000000000001';

    DELETE FROM public.clients
    WHERE id = ANY(COALESCE(v_client_ids, ARRAY[]::UUID[]));

    DELETE FROM public.audit_logs
    WHERE record_id = ANY(COALESCE(v_client_ids, ARRAY[]::UUID[]))
       OR record_id = '95330000-0000-0000-0000-000000000001';

    DELETE FROM public.users
    WHERE id = '95330000-0000-0000-0000-000000000001';

    DELETE FROM auth.users
    WHERE id = '95330000-0000-0000-0000-000000000001';
END;
$$;

SELECT pg_temp.cleanup_client_resolution_concurrency();

INSERT INTO auth.users (id, email)
VALUES (
    '95330000-0000-0000-0000-000000000001',
    'issue111-phase4-concurrency@lims.local'
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
    '95330000-0000-0000-0000-000000000001',
    'issue111_phase4_concurrency',
    'Issue 111 Phase 4 Concurrency',
    'analyst',
    'issue111-phase4-concurrency@lims.local',
    FALSE,
    NULL
);

\! rm -f /tmp/client-resolution-first.out /tmp/client-resolution-second.out /tmp/client-resolution-concurrency-status
\! timeout --kill-after=5s 30s sh -c "psql -v ON_ERROR_STOP=1 -U postgres -X -Atqc \"BEGIN; SET lock_timeout = '10s'; SET request.jwt.claims TO '{\\\"sub\\\":\\\"95330000-0000-0000-0000-000000000001\\\",\\\"role\\\":\\\"authenticated\\\"}'; SET request.jwt.claim.sub TO '95330000-0000-0000-0000-000000000001'; SET ROLE authenticated; SELECT outcome || '|' || reason_code || '|' || client_id::text || '|' || created::text FROM public.resolve_or_create_client_v2('cccd', '953300000001', 'Issue 111 Phase 4 Concurrent Client', DATE '1996-04-21', 'Nam', '0953300001', 'Concurrency fixture', NULL, NULL); SELECT pg_sleep(1); COMMIT;\" > /tmp/client-resolution-first.out 2>&1 & first_pid=\$!; sleep 0.2; psql -v ON_ERROR_STOP=1 -U postgres -X -Atqc \"BEGIN; SET lock_timeout = '10s'; SET request.jwt.claims TO '{\\\"sub\\\":\\\"95330000-0000-0000-0000-000000000001\\\",\\\"role\\\":\\\"authenticated\\\"}'; SET request.jwt.claim.sub TO '95330000-0000-0000-0000-000000000001'; SET ROLE authenticated; SELECT outcome || '|' || reason_code || '|' || client_id::text || '|' || created::text FROM public.resolve_or_create_client_v2(NULL, NULL, 'Issue 111 Phase 4 Concurrent Client', DATE '1996-04-21', 'Nam', '0953300001', 'Concurrency fixture', NULL, NULL); COMMIT;\" > /tmp/client-resolution-second.out 2>&1; second_status=\$?; wait \$first_pid; first_status=\$?; combined=\$(cat /tmp/client-resolution-first.out /tmp/client-resolution-second.out); [ \"\$first_status\" -eq 0 ] && [ \"\$second_status\" -eq 0 ] && [ \"\$(printf '%s\n' \"\$combined\" | grep -c 'matched|client_created|.*|true')\" -eq 1 ] && [ \"\$(printf '%s\n' \"\$combined\" | grep -c 'matched|name_dob_match|.*|false')\" -eq 1 ] && ! grep -Eq 'deadlock detected|40P01' /tmp/client-resolution-first.out /tmp/client-resolution-second.out" && printf '0\n' > /tmp/client-resolution-concurrency-status || printf '1\n' > /tmp/client-resolution-concurrency-status
\set concurrency_shell_failed `cat /tmp/client-resolution-concurrency-status`

\if :concurrency_shell_failed
    \! cat /tmp/client-resolution-first.out /tmp/client-resolution-second.out
\else
    SELECT (
        SELECT count(*) = 1
        FROM public.clients
        WHERE normalized_name =
            public.normalize_client_name_v1(
                'Issue 111 Phase 4 Concurrent Client'
            )
          AND date_of_birth = DATE '1996-04-21'
    ) AS one_client_created,
    (
        SELECT count(*) = 1
        FROM public.audit_logs
        WHERE operation = 'CLIENT_CREATED_V2'
          AND record_id IN (
              SELECT id
              FROM public.clients
              WHERE normalized_name =
                  public.normalize_client_name_v1(
                      'Issue 111 Phase 4 Concurrent Client'
                  )
                AND date_of_birth = DATE '1996-04-21'
          )
    ) AS one_creation_audit
    \gset
\endif

SELECT pg_temp.cleanup_client_resolution_concurrency();
\! rm -f /tmp/client-resolution-first.out /tmp/client-resolution-second.out /tmp/client-resolution-concurrency-status

\if :concurrency_shell_failed
    DO $shell_failure$
    BEGIN
        RAISE EXCEPTION
            'Concurrent resolve-and-create shell sessions failed';
    END;
    $shell_failure$;
\endif

\if :one_client_created
\else
    DO $client_count_failure$
    BEGIN
        RAISE EXCEPTION
            'Concurrent resolve-and-create created more than one client';
    END;
    $client_count_failure$;
\endif

\if :one_creation_audit
    SELECT 'client-resolution-v2 concurrency tests passed' AS result;
\else
    DO $audit_count_failure$
    BEGIN
        RAISE EXCEPTION
            'Concurrent resolve-and-create emitted an invalid creation audit count';
    END;
    $audit_count_failure$;
\endif
