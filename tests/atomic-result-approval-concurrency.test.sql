-- ATOMIC RESULT APPROVAL CONCURRENCY CONTRACT
-- Runs two local psql sessions inside lims-postgres.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

DO $contract$
BEGIN
    IF to_regprocedure(
        'public.approve_sample_results_server(uuid,uuid,uuid[],text)'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Migration 192 server-only atomic approval wrapper is missing';
    END IF;
END;
$contract$;

CREATE FUNCTION pg_temp.cleanup_atomic_concurrency()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.audit_logs
    WHERE record_id::TEXT LIKE '92100000-0000-0000-0000-0000000000%';
    DELETE FROM public.results
    WHERE id = '92100000-0000-0000-0000-000000000020';
    DELETE FROM public.samples
    WHERE id = '92100000-0000-0000-0000-000000000010';
    DELETE FROM public.assay_definitions
    WHERE id = '92100000-0000-0000-0000-000000000005';
    DELETE FROM public.clients
    WHERE id = '92100000-0000-0000-0000-000000000004';
    DELETE FROM public.users
    WHERE id IN (
        '92100000-0000-0000-0000-000000000001',
        '92100000-0000-0000-0000-000000000003'
    );
    DELETE FROM auth.users
    WHERE id IN (
        '92100000-0000-0000-0000-000000000001',
        '92100000-0000-0000-0000-000000000003'
    );
    DELETE FROM public.audit_logs
    WHERE record_id::TEXT LIKE '92100000-0000-0000-0000-0000000000%';
END;
$$;

BEGIN;
SELECT pg_temp.cleanup_atomic_concurrency();

INSERT INTO auth.users (id, email)
VALUES
    (
        '92100000-0000-0000-0000-000000000001',
        'atomic-concurrency-manager@lims.local'
    ),
    (
        '92100000-0000-0000-0000-000000000003',
        'atomic-concurrency-analyst@lims.local'
    );
INSERT INTO public.users (
    id, username, full_name, role, email, can_access_confidential
)
VALUES
    (
        '92100000-0000-0000-0000-000000000001',
        'atomic_concurrency_manager', 'Atomic Concurrency Manager', 'manager',
        'atomic-concurrency-manager@lims.local', TRUE
    ),
    (
        '92100000-0000-0000-0000-000000000003',
        'atomic_concurrency_analyst', 'Atomic Concurrency Analyst', 'analyst',
        'atomic-concurrency-analyst@lims.local', TRUE
    );
INSERT INTO public.clients (
    id, id_card_num, name, date_of_birth, gender, phone, address
)
VALUES (
    '92100000-0000-0000-0000-000000000004',
    '079206009211', 'Atomic Concurrency Client', DATE '1990-01-01',
    'Nam', '0900009211', 'CDC'
);
INSERT INTO public.assay_definitions (
    id, name, units, is_confidential, normal_range, method_name
)
VALUES (
    '92100000-0000-0000-0000-000000000005',
    'Atomic Concurrency Assay', 'unit', FALSE, '0-10',
    'Atomic Concurrency Method'
);
INSERT INTO public.samples (
    id, sample_id, client_id, client_name, status, received_by, type,
    sample_quality
)
VALUES (
    '92100000-0000-0000-0000-000000000010', 'ATOMIC-CONCURRENT',
    '92100000-0000-0000-0000-000000000004', 'Atomic Concurrency Client',
    'review', '92100000-0000-0000-0000-000000000003', 'Máu', TRUE
);
INSERT INTO public.results (
    id, sample_id, assay_id, value, status, entered_by, entered_at
)
VALUES (
    '92100000-0000-0000-0000-000000000020',
    '92100000-0000-0000-0000-000000000010',
    '92100000-0000-0000-0000-000000000005',
    '1.0', 'entered', '92100000-0000-0000-0000-000000000003', NOW()
);
DELETE FROM public.audit_logs
WHERE record_id::TEXT LIKE '92100000-0000-0000-0000-0000000000%';
COMMIT;

\! rm -f /tmp/atomic-approval-shell-status
\! sh -ec "psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SELECT id FROM public.samples WHERE id = '92100000-0000-0000-0000-000000000010'::uuid FOR UPDATE; SELECT pg_sleep(1); SET ROLE service_role; SET request.jwt.claims TO '{\\\"role\\\":\\\"service_role\\\"}'; SELECT public.approve_sample_results_server('92100000-0000-0000-0000-000000000001'::uuid, '92100000-0000-0000-0000-000000000010'::uuid, ARRAY['92100000-0000-0000-0000-000000000020'::uuid], 'Concurrent approval'); COMMIT;\" > /tmp/atomic-approval-session-a.out 2>&1 & first_pid=\$!; sleep 0.2; psql -v ON_ERROR_STOP=1 -U postgres -d postgres -X -Atqc \"BEGIN; SET ROLE service_role; SET request.jwt.claims TO '{\\\"role\\\":\\\"service_role\\\"}'; SELECT public.approve_sample_results_server('92100000-0000-0000-0000-000000000001'::uuid, '92100000-0000-0000-0000-000000000010'::uuid, ARRAY['92100000-0000-0000-0000-000000000020'::uuid], 'Concurrent approval'); COMMIT;\" > /tmp/atomic-approval-session-b.out 2>&1; wait \$first_pid; grep -q '\"outcome_code\": \"APPROVED\"' /tmp/atomic-approval-session-a.out; grep -q '\"outcome_code\": \"ALREADY_APPROVED\"' /tmp/atomic-approval-session-b.out" && printf '0\n' > /tmp/atomic-approval-shell-status || printf '1\n' > /tmp/atomic-approval-shell-status
\set concurrency_shell_failed `cat /tmp/atomic-approval-shell-status`
\if :concurrency_shell_failed
    \! cat /tmp/atomic-approval-session-a.out /tmp/atomic-approval-session-b.out
\else
    SELECT
        EXISTS (
        SELECT 1 FROM public.results
        WHERE id = '92100000-0000-0000-0000-000000000020'
          AND status = 'approved'
          AND approved_by = '92100000-0000-0000-0000-000000000001'
          AND approval_note = 'Concurrent approval'
        )
        AND (
            SELECT COUNT(*) = 1
            FROM public.audit_logs
            WHERE record_id = '92100000-0000-0000-0000-000000000020'
              AND operation = 'UPDATE'
        )
        AND (
            SELECT COUNT(*) = 2
            FROM public.audit_logs
            WHERE record_id = '92100000-0000-0000-0000-000000000010'
              AND operation = 'UPDATE'
        ) AS concurrency_verified,
        format(
            'Concurrent approval evidence mismatch (result_audits=%s, sample_audits=%s)',
            (
                SELECT COUNT(*)
                FROM public.audit_logs
                WHERE record_id = '92100000-0000-0000-0000-000000000020'
                  AND operation = 'UPDATE'
            ),
            (
                SELECT COUNT(*)
                FROM public.audit_logs
                WHERE record_id = '92100000-0000-0000-0000-000000000010'
                  AND operation = 'UPDATE'
            )
        ) AS concurrency_detail
    \gset
\endif

SELECT pg_temp.cleanup_atomic_concurrency();
\! rm -f /tmp/atomic-approval-session-a.out /tmp/atomic-approval-session-b.out /tmp/atomic-approval-shell-status

\if :concurrency_shell_failed
    DO $shell_failure$
    BEGIN
        RAISE EXCEPTION 'Concurrent approval shell sessions failed';
    END;
    $shell_failure$;
\endif
\if :concurrency_verified
    SELECT 'atomic-result-approval-concurrency: ok' AS result;
\else
    \echo :concurrency_detail
    DO $verification_failure$
    BEGIN
        RAISE EXCEPTION 'Concurrent approval evidence verification failed';
    END;
    $verification_failure$;
\endif
