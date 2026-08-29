-- Two-session Gate A rehearsal for trusted client identity creation.
-- Fixtures are committed for subprocess visibility and removed before exit.
-- Run only against an isolated rehearsal database, never production.

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

SELECT current_database() AS concurrency_database \gset
\setenv PGDATABASE :concurrency_database

DO $database_guard$
BEGIN
    IF current_database() = 'postgres' THEN
        RAISE EXCEPTION
            'Canonical integrity concurrency test requires a rehearsal database';
    END IF;
END;
$database_guard$;

DO $contract$
BEGIN
    IF to_regprocedure(
        'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)'
    ) IS NULL
       OR to_regclass(
           'public.clients_unique_trusted_government_identity'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Trusted identity resolver concurrency contract is missing';
    END IF;
END;
$contract$;

CREATE FUNCTION pg_temp.cleanup_client_canonical_concurrency()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_actor_id CONSTANT UUID :=
        '95360200-0000-0000-0000-000000000001';
BEGIN
    DELETE FROM public.audit_logs
    WHERE changed_by = v_actor_id
       OR record_id IN (
           SELECT id
           FROM public.clients
           WHERE government_identity_value = '953602000010'
       );

    DELETE FROM public.clients
    WHERE government_identity_value = '953602000010';

    DELETE FROM public.users
    WHERE id = v_actor_id;

    DELETE FROM auth.users
    WHERE id = v_actor_id;
END;
$$;

SELECT pg_temp.cleanup_client_canonical_concurrency();

INSERT INTO auth.users (id, email)
VALUES (
    '95360200-0000-0000-0000-000000000001',
    'issue-enforce-client-canonical-concurrency@lims.local'
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
    '95360200-0000-0000-0000-000000000001',
    'issue_enforce_client_canonical_concurrency',
    'Gate A Canonical Concurrency Manager',
    'manager',
    'issue-enforce-client-canonical-concurrency@lims.local',
    TRUE,
    NULL
);

\! rm -f /tmp/client-canonical-race-a.out /tmp/client-canonical-race-a.err /tmp/client-canonical-race-a.status /tmp/client-canonical-race-b.out /tmp/client-canonical-race-b.err /tmp/client-canonical-race-b.status
\! (timeout --kill-after=5s 20s psql -v ON_ERROR_STOP=1 -U postgres -X -Atq -c "SET request.jwt.claims TO '{\"sub\":\"95360200-0000-0000-0000-000000000001\",\"role\":\"authenticated\"}'; SET request.jwt.claim.sub TO '95360200-0000-0000-0000-000000000001'; SET request.jwt.claim.role TO 'authenticated'; SET ROLE authenticated; SELECT row_to_json(r) FROM public.resolve_or_create_client_v2('cccd', '953602000010', 'Gate A Concurrent Client', DATE '1988-06-15', 'Khác', '0953602010', 'Concurrency fixture', NULL, NULL) r;"; printf '%s\n' "$?" > /tmp/client-canonical-race-a.status) > /tmp/client-canonical-race-a.out 2> /tmp/client-canonical-race-a.err &
\! (timeout --kill-after=5s 20s psql -v ON_ERROR_STOP=1 -U postgres -X -Atq -c "SET request.jwt.claims TO '{\"sub\":\"95360200-0000-0000-0000-000000000001\",\"role\":\"authenticated\"}'; SET request.jwt.claim.sub TO '95360200-0000-0000-0000-000000000001'; SET request.jwt.claim.role TO 'authenticated'; SET ROLE authenticated; SELECT row_to_json(r) FROM public.resolve_or_create_client_v2('cccd', '953602000010', 'Gate A Concurrent Client', DATE '1988-06-15', 'Khác', '0953602010', 'Concurrency fixture', NULL, NULL) r;"; printf '%s\n' "$?" > /tmp/client-canonical-race-b.status) > /tmp/client-canonical-race-b.out 2> /tmp/client-canonical-race-b.err &
\! timeout --kill-after=5s 20s sh -c 'while [ ! -f /tmp/client-canonical-race-a.status ] || [ ! -f /tmp/client-canonical-race-b.status ]; do sleep 0.1; done'

\set race_status_a `cat /tmp/client-canonical-race-a.status`
\set race_status_b `cat /tmp/client-canonical-race-b.status`

\if :race_status_a
    \! cat /tmp/client-canonical-race-a.out /tmp/client-canonical-race-a.err
    \! false
\endif

\if :race_status_b
    \! cat /tmp/client-canonical-race-b.out /tmp/client-canonical-race-b.err
    \! false
\endif

CREATE TEMP TABLE client_canonical_race_output (
    envelope JSONB NOT NULL
);

\copy client_canonical_race_output (envelope) FROM '/tmp/client-canonical-race-a.out'
\copy client_canonical_race_output (envelope) FROM '/tmp/client-canonical-race-b.out'

DO $outcome$
DECLARE
    v_created_count BIGINT;
    v_client_count BIGINT;
    v_audit_count BIGINT;
    v_client_id UUID;
BEGIN
    SELECT
        count(*) FILTER (WHERE envelope ->> 'created' = 'true'),
        count(DISTINCT (envelope ->> 'client_id')::UUID)
    INTO v_created_count, v_client_count
    FROM client_canonical_race_output;

    SELECT (array_agg((envelope ->> 'client_id')::UUID))[1]
    INTO v_client_id
    FROM client_canonical_race_output;

    SELECT count(*)
    INTO v_audit_count
    FROM public.audit_logs
    WHERE changed_by = '95360200-0000-0000-0000-000000000001'
      AND record_id = v_client_id
      AND operation = 'CLIENT_CREATED_V2';

    IF v_created_count <> 1
       OR v_client_count <> 1
       OR (SELECT count(*) FROM public.clients
           WHERE government_identity_value = '953602000010') <> 1
       OR v_audit_count <> 1
    THEN
        RAISE EXCEPTION
            'trusted identity race produced duplicate or partial writes';
    END IF;
END;
$outcome$;

SELECT pg_temp.cleanup_client_canonical_concurrency();
\! rm -f /tmp/client-canonical-race-a.out /tmp/client-canonical-race-a.err /tmp/client-canonical-race-a.status /tmp/client-canonical-race-b.out /tmp/client-canonical-race-b.err /tmp/client-canonical-race-b.status

SELECT 'client canonical integrity concurrency test passed' AS result;
