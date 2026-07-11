#!/usr/bin/env bash

# COA GENERATION LEASE LOCK-WAIT REGRESSION TEST
# Verifies complete/fail reject a claim that expires while the worker waits
# for the report row lock.
# Usage:
#   bash tests/coa-generation-lease-concurrency.test.sh [complete|fail|all]

set -euo pipefail

readonly TEST_VERSION=730073
readonly TEST_FILE_MARKER="issue-73/lock-wait-fixture"
readonly CASE_NAME="${1:-all}"
readonly LOCK_HOLD_SECONDS=6
readonly CLAIM_REMAINING_SECONDS=4

report_id=""
claim_id=""
worker_id=""
signature_id=""
locker_pid=""
locker_log=""

psql_command() {
    docker exec -i lims-postgres \
        psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}

cleanup() {
    local exit_code=$?

    if [[ -n "${locker_pid}" ]] && kill -0 "${locker_pid}" 2>/dev/null; then
        kill "${locker_pid}" 2>/dev/null || true
        wait "${locker_pid}" 2>/dev/null || true
    fi

    if [[ -n "${report_id}" ]]; then
        psql_command -c \
            "DELETE FROM public.coa_reports WHERE id = '${report_id}'::UUID;" \
            >/dev/null 2>&1 || true
    fi

    if [[ -n "${locker_log}" ]]; then
        rm -f "${locker_log}"
    fi

    exit "${exit_code}"
}

trap cleanup EXIT

create_fixture() {
    local fixture

    fixture="$(
        psql_command -At -F '|' <<SQL
DELETE FROM public.coa_reports
WHERE version = ${TEST_VERSION}
  AND file_path = '${TEST_FILE_MARKER}';

WITH candidate AS (
    SELECT
        sample.id AS sample_id,
        approver.approved_by AS worker_id,
        signature.id AS signature_id,
        submission.id AS source_submission_id
    FROM public.samples AS sample
    JOIN LATERAL (
        SELECT sample_submission.id
        FROM public.sample_submissions AS sample_submission
        WHERE sample_submission.sample_id = sample.id
          AND sample_submission.superseded_by IS NULL
        ORDER BY sample_submission.submission_number DESC
        LIMIT 1
    ) AS submission ON TRUE
    JOIN LATERAL (
        SELECT result.approved_by
        FROM public.results AS result
        WHERE result.sample_id = sample.id
          AND result.status = 'approved'
          AND result.approved_by IS NOT NULL
        ORDER BY result.approved_at DESC NULLS LAST, result.id DESC
        LIMIT 1
    ) AS approver ON TRUE
    JOIN public.users AS worker
      ON worker.id = approver.approved_by
     AND worker.role IN ('analyst', 'manager')
     AND worker.deleted_at IS NULL
    JOIN LATERAL (
        SELECT user_signature.id
        FROM public.user_signatures AS user_signature
        WHERE user_signature.user_id = worker.id
          AND user_signature.is_active
          AND user_signature.deleted_at IS NULL
        ORDER BY user_signature.created_at DESC, user_signature.id DESC
        LIMIT 1
    ) AS signature ON TRUE
    WHERE sample.status = 'completed'
      AND sample.deleted_at IS NULL
      AND EXISTS (
          SELECT 1
          FROM public.results AS result
          WHERE result.sample_id = sample.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.results AS result
          WHERE result.sample_id = sample.id
            AND result.status <> 'approved'
      )
    ORDER BY sample.created_at, sample.id
    LIMIT 1
),
inserted AS (
    INSERT INTO public.coa_reports (
        sample_id,
        source_submission_id,
        file_path,
        file_hash,
        version,
        status,
        generation_claim_id,
        generation_claimed_by,
        generation_claimed_at,
        generation_previous_status
    )
    SELECT
        candidate.sample_id,
        candidate.source_submission_id,
        '${TEST_FILE_MARKER}',
        '',
        ${TEST_VERSION},
        'pending',
        gen_random_uuid(),
        candidate.worker_id,
        clock_timestamp(),
        NULL
    FROM candidate
    RETURNING
        id,
        generation_claim_id,
        generation_claimed_by
)
SELECT
    inserted.id,
    inserted.generation_claim_id,
    inserted.generation_claimed_by,
    candidate.signature_id
FROM inserted
JOIN candidate
  ON candidate.worker_id = inserted.generation_claimed_by;
SQL
    )"

    IFS='|' read -r report_id claim_id worker_id signature_id <<<"${fixture}"

    if [[ -z "${report_id}" || -z "${claim_id}" || -z "${worker_id}" ||
          -z "${signature_id}" ]]; then
        echo "CoA lease concurrency test requires an approved sample and active approver signature." >&2
        return 1
    fi
}

wait_for_locker() {
    local application_name=$1
    local locker_sleeping

    for _ in {1..100}; do
        locker_sleeping="$(
            psql_command -Atc "
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_stat_activity
                    WHERE application_name = '${application_name}'
                      AND state = 'active'
                      AND wait_event = 'PgSleep'
                );
            "
        )"

        if [[ "${locker_sleeping}" == "t" ]]; then
            return 0
        fi

        if ! kill -0 "${locker_pid}" 2>/dev/null; then
            cat "${locker_log}" >&2
            return 1
        fi

        sleep 0.05
    done

    echo "Timed out waiting for ${application_name} to hold the report row lock." >&2
    cat "${locker_log}" >&2
    return 1
}

start_locker() {
    local operation=$1
    local application_name="coa-lease-locker-${operation}"

    locker_log="$(mktemp)"

    psql_command >"${locker_log}" 2>&1 <<SQL &
SET application_name = '${application_name}';
BEGIN;
UPDATE public.coa_reports
SET generation_claimed_at =
    clock_timestamp()
    - INTERVAL '15 minutes'
    + INTERVAL '${CLAIM_REMAINING_SECONDS} seconds'
WHERE id = '${report_id}'::UUID;
SELECT pg_sleep(${LOCK_HOLD_SECONDS});
COMMIT;
SQL
    locker_pid=$!

    wait_for_locker "${application_name}"
}

run_complete_case() {
    start_locker "complete"

    psql_command -At <<SQL >/dev/null
BEGIN;
SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object(
        'sub', '${worker_id}',
        'role', 'authenticated'
    )::TEXT,
    TRUE
);
SELECT set_config('request.jwt.claim.sub', '${worker_id}', TRUE);
SET LOCAL ROLE authenticated;
SELECT 1 / (
    (
        public.complete_coa_report_generation(
            '${report_id}'::UUID,
            '${claim_id}'::UUID,
            'issue-73/expired-lock-wait.html',
            encode(digest('issue-73-expired-lock-wait', 'sha256'), 'hex'),
            '${signature_id}'::UUID
        ) IS NULL
    )::INTEGER
);
ROLLBACK;
SQL

    wait "${locker_pid}"
    locker_pid=""
    rm -f "${locker_log}"
    locker_log=""
}

run_fail_case() {
    start_locker "fail"

    psql_command -At <<SQL >/dev/null
BEGIN;
SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object(
        'sub', '${worker_id}',
        'role', 'authenticated'
    )::TEXT,
    TRUE
);
SELECT set_config('request.jwt.claim.sub', '${worker_id}', TRUE);
SET LOCAL ROLE authenticated;
SELECT 1 / (
    (
        NOT public.fail_coa_report_generation(
            '${report_id}'::UUID,
            '${claim_id}'::UUID,
            'Expired during lock wait',
            FALSE
        )
    )::INTEGER
);
ROLLBACK;
SQL

    wait "${locker_pid}"
    locker_pid=""
    rm -f "${locker_log}"
    locker_log=""
}

create_fixture

case "${CASE_NAME}" in
    complete)
        run_complete_case
        ;;
    fail)
        run_fail_case
        ;;
    all)
        run_complete_case
        run_fail_case
        ;;
    *)
        echo "Usage: $0 [complete|fail|all]" >&2
        exit 2
        ;;
esac

echo "CoA generation lease lock-wait regression passed (${CASE_NAME})."
