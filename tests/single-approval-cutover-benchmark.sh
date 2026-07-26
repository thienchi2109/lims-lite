#!/usr/bin/env bash
set -euo pipefail

iterations="${1:-40}"
if [[ ! "${iterations}" =~ ^[1-9][0-9]*$ ]] || ((iterations < 20)); then
    echo "iterations must be an integer greater than or equal to 20" >&2
    exit 2
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

sql_file="${work_dir}/benchmark.sql"
raw_output="${work_dir}/psql-output.txt"
samples_file="${work_dir}/samples.txt"
legacy_values="${work_dir}/legacy.txt"
atomic_values="${work_dir}/atomic.txt"

cat >"${sql_file}" <<'SQL'
\set ON_ERROR_STOP on
\timing on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

INSERT INTO auth.users (id, email)
VALUES
    (
        '92200000-0000-0000-0000-000000000001',
        'single-approval-benchmark-manager@lims.local'
    ),
    (
        '92200000-0000-0000-0000-000000000002',
        'single-approval-benchmark-analyst@lims.local'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (
    id,
    username,
    full_name,
    role,
    email,
    can_access_confidential,
    deleted_at
)
VALUES
    (
        '92200000-0000-0000-0000-000000000001',
        'single_approval_benchmark_manager',
        'Single Approval Benchmark Manager',
        'manager',
        'single-approval-benchmark-manager@lims.local',
        TRUE,
        NULL
    ),
    (
        '92200000-0000-0000-0000-000000000002',
        'single_approval_benchmark_analyst',
        'Single Approval Benchmark Analyst',
        'analyst',
        'single-approval-benchmark-analyst@lims.local',
        TRUE,
        NULL
    )
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role,
    can_access_confidential = EXCLUDED.can_access_confidential,
    deleted_at = NULL;

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
    '92200000-0000-0000-0000-000000000003',
    '079226009201',
    'Single Approval Benchmark Client',
    DATE '1990-01-01',
    'Nam',
    '0900009220',
    'CDC'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assay_definitions (
    id,
    name,
    units,
    is_confidential,
    normal_range,
    method_name
)
VALUES (
    '92200000-0000-0000-0000-000000000004',
    'Single Approval Benchmark Assay',
    'unit',
    FALSE,
    '0-10',
    'Benchmark Method'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.samples (
    id,
    sample_id,
    client_id,
    client_name,
    status,
    received_by,
    type,
    sample_quality,
    rejection_reason,
    rejected_at,
    rejected_by
)
VALUES (
    '92200000-0000-0000-0000-000000000010',
    'SINGLE-APPROVAL-BENCHMARK',
    '92200000-0000-0000-0000-000000000003',
    'Single Approval Benchmark Client',
    'review',
    '92200000-0000-0000-0000-000000000002',
    'Máu',
    TRUE,
    'Benchmark rejection reset',
    NOW(),
    '92200000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO UPDATE
SET status = 'review',
    rejection_reason = EXCLUDED.rejection_reason,
    rejected_at = EXCLUDED.rejected_at,
    rejected_by = EXCLUDED.rejected_by;

INSERT INTO public.results (
    id,
    sample_id,
    assay_id,
    value,
    status,
    entered_by,
    entered_at,
    approved_by,
    approved_at,
    approval_note,
    qc_session_id
)
VALUES (
    '92200000-0000-0000-0000-000000000020',
    '92200000-0000-0000-0000-000000000010',
    '92200000-0000-0000-0000-000000000004',
    '1.0',
    'entered',
    '92200000-0000-0000-0000-000000000002',
    NOW(),
    NULL,
    NULL,
    NULL,
    NULL
)
ON CONFLICT (id) DO UPDATE
SET sample_id = EXCLUDED.sample_id,
    assay_id = EXCLUDED.assay_id,
    status = 'entered',
    approved_by = NULL,
    approved_at = NULL,
    approval_note = NULL,
    qc_session_id = NULL;

DELETE FROM public.audit_logs
WHERE record_id::TEXT LIKE '92200000-0000-0000-0000-0000000000%';

SQL

append_legacy_iteration() {
    local iteration="$1"
    cat >>"${sql_file}" <<SQL
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
    '{"sub":"92200000-0000-0000-0000-000000000001","role":"authenticated"}';
SET LOCAL request.jwt.claim.sub TO
    '92200000-0000-0000-0000-000000000001';
SET LOCAL request.jwt.claim.role TO 'authenticated';
SAVEPOINT legacy_${iteration};
\\echo BENCH_START legacy ${iteration}
SELECT role, can_access_confidential
FROM public.users
WHERE id = '92200000-0000-0000-0000-000000000001';
SELECT id, status, sample_id
FROM public.results
WHERE id = '92200000-0000-0000-0000-000000000020';
SELECT result.sample_id
FROM public.results AS result
JOIN public.assay_definitions AS assay ON assay.id = result.assay_id
WHERE result.sample_id = '92200000-0000-0000-0000-000000000010'
  AND assay.is_confidential = TRUE;
SELECT status
FROM public.samples
WHERE id = '92200000-0000-0000-0000-000000000010';
SELECT *
FROM public.check_qc_approval_status(
    ARRAY['92200000-0000-0000-0000-000000000020'::UUID]
);
UPDATE public.results
SET status = 'approved',
    approved_by = '92200000-0000-0000-0000-000000000001',
    approved_at = NOW(),
    approval_note = 'Benchmark approval'
WHERE id = '92200000-0000-0000-0000-000000000020';
SELECT COUNT(*)
FROM public.results
WHERE sample_id = '92200000-0000-0000-0000-000000000010'
  AND status <> 'approved';
UPDATE public.samples
SET status = 'completed',
    rejection_reason = NULL,
    rejected_at = NULL,
    rejected_by = NULL
WHERE id = '92200000-0000-0000-0000-000000000010';
\\echo BENCH_END legacy ${iteration}
ROLLBACK TO SAVEPOINT legacy_${iteration};
RELEASE SAVEPOINT legacy_${iteration};
SQL
}

append_atomic_iteration() {
    local iteration="$1"
    cat >>"${sql_file}" <<SQL
RESET ROLE;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims TO
    '{"sub":"92200000-0000-0000-0000-000000000001","role":"service_role"}';
SET LOCAL request.jwt.claim.sub TO
    '92200000-0000-0000-0000-000000000001';
SET LOCAL request.jwt.claim.role TO 'service_role';
SAVEPOINT atomic_${iteration};
\\echo BENCH_START atomic ${iteration}
SELECT public.approve_sample_results_server(
    '92200000-0000-0000-0000-000000000001',
    '92200000-0000-0000-0000-000000000010',
    ARRAY['92200000-0000-0000-0000-000000000020'::UUID],
    'Benchmark approval'
)->>'outcome_code';
\\echo BENCH_END atomic ${iteration}
ROLLBACK TO SAVEPOINT atomic_${iteration};
RELEASE SAVEPOINT atomic_${iteration};
SQL
}

# Alternate order so neither path owns all cold- or warm-cache samples.
for iteration in $(seq 1 "${iterations}"); do
    if ((iteration % 2 == 1)); then
        append_legacy_iteration "${iteration}"
        append_atomic_iteration "${iteration}"
    else
        append_atomic_iteration "${iteration}"
        append_legacy_iteration "${iteration}"
    fi
done

cat >>"${sql_file}" <<'SQL'
ROLLBACK;
SQL

psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -f "${sql_file}" >"${raw_output}" 2>&1

awk '
    $1 == "BENCH_START" {
        mode = $2
        iteration = $3
        elapsed = 0
        next
    }
    mode != "" && $1 == "Time:" {
        elapsed += $2
        next
    }
    $1 == "BENCH_END" {
        print mode, iteration, elapsed
        mode = ""
    }
' "${raw_output}" >"${samples_file}"

awk '$1 == "legacy" { print $3 }' "${samples_file}" | sort -n >"${legacy_values}"
awk '$1 == "atomic" { print $3 }' "${samples_file}" | sort -n >"${atomic_values}"

legacy_count="$(wc -l <"${legacy_values}")"
atomic_count="$(wc -l <"${atomic_values}")"
approved_count="$(grep -c '^APPROVED$' "${raw_output}")"
if [[ "${legacy_count}" -ne "${iterations}" ]] \
    || [[ "${atomic_count}" -ne "${iterations}" ]] \
    || [[ "${approved_count}" -ne "${iterations}" ]]; then
    echo "benchmark did not capture the expected successful iterations" >&2
    tail -n 80 "${raw_output}" >&2
    exit 1
fi

percentile() {
    local values_file="$1"
    local percentile_value="$2"
    awk -v percentile_value="${percentile_value}" '
        { values[NR] = $1 }
        END {
            if (NR == 0) exit 1
            position = int((NR * percentile_value + 99) / 100)
            if (position < 1) position = 1
            if (position > NR) position = NR
            printf "%.3f", values[position]
        }
    ' "${values_file}"
}

legacy_p50="$(percentile "${legacy_values}" 50)"
legacy_p95="$(percentile "${legacy_values}" 95)"
atomic_p50="$(percentile "${atomic_values}" 50)"
atomic_p95="$(percentile "${atomic_values}" 95)"
regression_percent="$(
    awk -v before="${legacy_p95}" -v after="${atomic_p95}" \
        'BEGIN { printf "%.2f", ((after / before) - 1) * 100 }'
)"

echo "single-approval-cutover-benchmark: ok"
echo "iterations=${iterations}"
echo "legacy_database_calls=8"
echo "atomic_database_calls=1"
echo "legacy_p50_ms=${legacy_p50}"
echo "legacy_p95_ms=${legacy_p95}"
echo "atomic_p50_ms=${atomic_p50}"
echo "atomic_p95_ms=${atomic_p95}"
echo "p95_regression_percent=${regression_percent}"

awk -v before="${legacy_p95}" -v after="${atomic_p95}" '
    BEGIN {
        if (after > before * 1.10) {
            message = sprintf("atomic p95 %.3fms exceeds the 10%% limit over legacy %.3fms", after, before)
            print message > "/dev/stderr"
            exit 1
        }
    }
'
