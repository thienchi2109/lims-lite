\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'REPORTING KPI PARITY TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

\echo '>>> Seeding deterministic reporting KPI test data...'

INSERT INTO clients (
    id,
    id_card_num,
    name,
    date_of_birth,
    gender,
    phone,
    address
) VALUES (
    '70000000-0000-0000-0000-000000000001',
    '079123456789',
    'Reporting KPI Test Client',
    DATE '1990-01-01',
    'Nam',
    '0912345601',
    '123 Test Street'
);

INSERT INTO assay_definitions (id, name, units, validation_rules)
VALUES (
    '70000000-0000-0000-0000-000000000002',
    'Reporting KPI Test Assay',
    'mg/L',
    '{"min": 0}'::jsonb
);

INSERT INTO samples (
    id,
    sample_id,
    client_id,
    client_name,
    status,
    received_at,
    type,
    sample_quality
) VALUES
    ('70000000-0000-0000-0000-000000000101', 'KPI-TEST-001', '70000000-0000-0000-0000-000000000001', 'Reporting KPI Test Client', 'completed',   '2024-12-01T00:00:00Z', 'Nước', TRUE),
    ('70000000-0000-0000-0000-000000000102', 'KPI-TEST-002', '70000000-0000-0000-0000-000000000001', 'Reporting KPI Test Client', 'completed',   '2024-12-03T00:00:00Z', 'Nước', TRUE),
    ('70000000-0000-0000-0000-000000000103', 'KPI-TEST-003', '70000000-0000-0000-0000-000000000001', 'Reporting KPI Test Client', 'review',      '2024-12-05T00:00:00Z', 'Nước', TRUE),
    ('70000000-0000-0000-0000-000000000104', 'KPI-TEST-004', '70000000-0000-0000-0000-000000000001', 'Reporting KPI Test Client', 'review',      '2024-12-06T00:00:00Z', 'Nước', TRUE),
    ('70000000-0000-0000-0000-000000000105', 'KPI-TEST-005', '70000000-0000-0000-0000-000000000001', 'Reporting KPI Test Client', 'received',    '2024-12-07T00:00:00Z', 'Nước', TRUE),
    ('70000000-0000-0000-0000-000000000106', 'KPI-TEST-006', '70000000-0000-0000-0000-000000000001', 'Reporting KPI Test Client', 'assigned',    '2024-12-08T00:00:00Z', 'Nước', TRUE),
    ('70000000-0000-0000-0000-000000000107', 'KPI-TEST-007', '70000000-0000-0000-0000-000000000001', 'Reporting KPI Test Client', 'in_progress', '2024-12-09T00:00:00Z', 'Nước', TRUE),
    ('70000000-0000-0000-0000-000000000108', 'KPI-TEST-008', '70000000-0000-0000-0000-000000000001', 'Reporting KPI Test Client', 'discarded',   '2024-12-10T00:00:00Z', 'Nước', TRUE);

UPDATE samples
SET completed_at = CASE id
    WHEN '70000000-0000-0000-0000-000000000101'::uuid THEN '2024-12-02T12:00:00Z'::timestamptz
    WHEN '70000000-0000-0000-0000-000000000102'::uuid THEN '2024-12-06T12:00:00Z'::timestamptz
    ELSE completed_at
END,
review_started_at = CASE id
    WHEN '70000000-0000-0000-0000-000000000103'::uuid THEN CURRENT_TIMESTAMP - INTERVAL '48 hours'
    WHEN '70000000-0000-0000-0000-000000000104'::uuid THEN CURRENT_TIMESTAMP - INTERVAL '12 hours'
    ELSE review_started_at
END
WHERE id IN (
    '70000000-0000-0000-0000-000000000101'::uuid,
    '70000000-0000-0000-0000-000000000102'::uuid,
    '70000000-0000-0000-0000-000000000103'::uuid,
    '70000000-0000-0000-0000-000000000104'::uuid
);

INSERT INTO results (
    id,
    sample_id,
    assay_id,
    value,
    status,
    created_at
) VALUES
    ('70000000-0000-0000-0000-000000000201', '70000000-0000-0000-0000-000000000101', '70000000-0000-0000-0000-000000000002', '1.1', 'pending', '2024-12-04T00:00:00Z'),
    ('70000000-0000-0000-0000-000000000202', '70000000-0000-0000-0000-000000000102', '70000000-0000-0000-0000-000000000002', '2.1', 'pending', '2024-12-05T00:00:00Z'),
    ('70000000-0000-0000-0000-000000000203', '70000000-0000-0000-0000-000000000103', '70000000-0000-0000-0000-000000000002', '3.0', 'pending', '2024-12-06T00:00:00Z'),
    ('70000000-0000-0000-0000-000000000204', '70000000-0000-0000-0000-000000000104', '70000000-0000-0000-0000-000000000002', '4.1', 'pending', '2024-11-30T12:00:00Z');

INSERT INTO audit_logs (
    id,
    table_name,
    record_id,
    operation,
    old_values,
    new_values,
    changed_at
) VALUES
    (
        '70000000-0000-0000-0000-000000000301',
        'results',
        '70000000-0000-0000-0000-000000000201',
        'UPDATE',
        '{"value":"1.0"}'::jsonb,
        '{"value":"1.1"}'::jsonb,
        '2024-12-07T00:00:00Z'
    ),
    (
        '70000000-0000-0000-0000-000000000302',
        'results',
        '70000000-0000-0000-0000-000000000202',
        'UPDATE',
        '{"value":"2.0"}'::jsonb,
        '{"value":"2.1"}'::jsonb,
        '2024-12-08T00:00:00Z'
    ),
    (
        '70000000-0000-0000-0000-000000000303',
        'results',
        '70000000-0000-0000-0000-000000000203',
        'UPDATE',
        '{"value":"3.0"}'::jsonb,
        '{"value":"3.0"}'::jsonb,
        '2024-12-09T00:00:00Z'
    ),
    (
        '70000000-0000-0000-0000-000000000304',
        'results',
        '70000000-0000-0000-0000-000000000204',
        'UPDATE',
        '{"value":"4.0"}'::jsonb,
        '{"value":"4.1"}'::jsonb,
        '2024-12-10T00:00:00Z'
    );

\echo '>>> Test data seeded'
\echo ''

\echo '============================================================================'
\echo 'TEST 1: Populated Window Parity'
\echo '============================================================================'

DO $$
DECLARE
    v_start TIMESTAMPTZ := '2024-12-01T00:00:00Z';
    v_end TIMESTAMPTZ := '2024-12-20T23:59:59Z';
    v_tat RECORD;
    v_approval RECORD;
    v_error RECORD;
    v_kpi RECORD;
    v_legacy_status_breakdown JSONB;
    v_expected_status_breakdown JSONB := '[
      {"status":"received","count":1},
      {"status":"assigned","count":1},
      {"status":"in_progress","count":1},
      {"status":"review","count":2},
      {"status":"completed","count":2},
      {"status":"discarded","count":1}
    ]'::jsonb;
BEGIN
    SELECT * INTO v_tat
    FROM calculate_average_tat(v_start, v_end);

    SELECT * INTO v_approval
    FROM get_approval_queue_metrics(v_start, v_end);

    SELECT * INTO v_error
    FROM get_error_rate_metrics(v_start, v_end);

    SELECT COALESCE(
        JSONB_AGG(
            JSONB_BUILD_OBJECT('status', status, 'count', count)
            ORDER BY CASE status
                WHEN 'received' THEN 1
                WHEN 'assigned' THEN 2
                WHEN 'in_progress' THEN 3
                WHEN 'review' THEN 4
                WHEN 'completed' THEN 5
                WHEN 'discarded' THEN 6
                ELSE 7
            END
        ),
        '[]'::jsonb
    )
    INTO v_legacy_status_breakdown
    FROM get_samples_by_status(v_start, v_end);

    SELECT * INTO v_kpi
    FROM get_kpi_metrics(v_start, v_end);

    IF v_kpi.avg_tat_hours IS DISTINCT FROM v_tat.avg_tat_hours THEN
        RAISE EXCEPTION 'TEST 1 FAILED: avg_tat_hours mismatch. consolidated=%, legacy=%', v_kpi.avg_tat_hours, v_tat.avg_tat_hours;
    END IF;

    IF v_kpi.median_tat_hours IS DISTINCT FROM v_tat.median_tat_hours THEN
        RAISE EXCEPTION 'TEST 1 FAILED: median_tat_hours mismatch. consolidated=%, legacy=%', v_kpi.median_tat_hours, v_tat.median_tat_hours;
    END IF;

    IF v_kpi.sample_count IS DISTINCT FROM v_tat.sample_count THEN
        RAISE EXCEPTION 'TEST 1 FAILED: sample_count mismatch. consolidated=%, legacy=%', v_kpi.sample_count, v_tat.sample_count;
    END IF;

    IF v_kpi.on_time_count IS DISTINCT FROM v_tat.on_time_count THEN
        RAISE EXCEPTION 'TEST 1 FAILED: on_time_count mismatch. consolidated=%, legacy=%', v_kpi.on_time_count, v_tat.on_time_count;
    END IF;

    IF v_kpi.status_breakdown IS DISTINCT FROM v_legacy_status_breakdown THEN
        RAISE EXCEPTION 'TEST 1 FAILED: status_breakdown mismatch. consolidated=%, legacy=%', v_kpi.status_breakdown, v_legacy_status_breakdown;
    END IF;

    IF v_kpi.pending_count IS DISTINCT FROM v_approval.pending_count THEN
        RAISE EXCEPTION 'TEST 1 FAILED: pending_count mismatch. consolidated=%, legacy=%', v_kpi.pending_count, v_approval.pending_count;
    END IF;

    IF v_kpi.avg_wait_hours IS DISTINCT FROM v_approval.avg_wait_hours THEN
        RAISE EXCEPTION 'TEST 1 FAILED: avg_wait_hours mismatch. consolidated=%, legacy=%', v_kpi.avg_wait_hours, v_approval.avg_wait_hours;
    END IF;

    IF v_kpi.overdue_count IS DISTINCT FROM v_approval.overdue_count THEN
        RAISE EXCEPTION 'TEST 1 FAILED: overdue_count mismatch. consolidated=%, legacy=%', v_kpi.overdue_count, v_approval.overdue_count;
    END IF;

    IF v_kpi.error_rate IS DISTINCT FROM v_error.error_rate THEN
        RAISE EXCEPTION 'TEST 1 FAILED: error_rate mismatch. consolidated=%, legacy=%', v_kpi.error_rate, v_error.error_rate;
    END IF;

    IF v_kpi.total_modifications IS DISTINCT FROM v_error.total_modifications THEN
        RAISE EXCEPTION 'TEST 1 FAILED: total_modifications mismatch. consolidated=%, legacy=%', v_kpi.total_modifications, v_error.total_modifications;
    END IF;

    IF v_kpi.total_results IS DISTINCT FROM v_error.total_results THEN
        RAISE EXCEPTION 'TEST 1 FAILED: total_results mismatch. consolidated=%, legacy=%', v_kpi.total_results, v_error.total_results;
    END IF;

    IF v_kpi.avg_tat_hours IS DISTINCT FROM 60.00::numeric THEN
        RAISE EXCEPTION 'TEST 1 FAILED: expected avg_tat_hours 60.00, got %', v_kpi.avg_tat_hours;
    END IF;

    IF v_kpi.median_tat_hours IS DISTINCT FROM 60.00::numeric THEN
        RAISE EXCEPTION 'TEST 1 FAILED: expected median_tat_hours 60.00, got %', v_kpi.median_tat_hours;
    END IF;

    IF v_kpi.sample_count IS DISTINCT FROM 2::bigint OR v_kpi.on_time_count IS DISTINCT FROM 1::bigint THEN
        RAISE EXCEPTION 'TEST 1 FAILED: unexpected TAT counts. sample_count=%, on_time_count=%', v_kpi.sample_count, v_kpi.on_time_count;
    END IF;

    IF v_kpi.status_breakdown IS DISTINCT FROM v_expected_status_breakdown THEN
        RAISE EXCEPTION 'TEST 1 FAILED: unexpected status_breakdown %. expected %', v_kpi.status_breakdown, v_expected_status_breakdown;
    END IF;

    IF v_kpi.pending_count IS DISTINCT FROM 2::bigint OR v_kpi.avg_wait_hours IS DISTINCT FROM 30.00::numeric OR v_kpi.overdue_count IS DISTINCT FROM 1::bigint THEN
        RAISE EXCEPTION 'TEST 1 FAILED: unexpected approval metrics pending_count=%, avg_wait_hours=%, overdue_count=%', v_kpi.pending_count, v_kpi.avg_wait_hours, v_kpi.overdue_count;
    END IF;

    IF v_kpi.error_rate IS DISTINCT FROM 66.67::numeric OR v_kpi.total_modifications IS DISTINCT FROM 2::bigint OR v_kpi.total_results IS DISTINCT FROM 3::bigint THEN
        RAISE EXCEPTION 'TEST 1 FAILED: unexpected error metrics error_rate=%, total_modifications=%, total_results=%', v_kpi.error_rate, v_kpi.total_modifications, v_kpi.total_results;
    END IF;

    RAISE NOTICE 'TEST 1 PASSED: consolidated KPI RPC matches legacy RPCs on populated data';
END $$;

\echo ''
\echo '============================================================================'
\echo 'TEST 2: Empty Window Parity'
\echo '============================================================================'

DO $$
DECLARE
    v_start TIMESTAMPTZ := '2030-01-01T00:00:00Z';
    v_end TIMESTAMPTZ := '2030-01-31T23:59:59Z';
    v_tat RECORD;
    v_approval RECORD;
    v_error RECORD;
    v_kpi RECORD;
    v_legacy_status_breakdown JSONB;
BEGIN
    SELECT * INTO v_tat
    FROM calculate_average_tat(v_start, v_end);

    SELECT * INTO v_approval
    FROM get_approval_queue_metrics(v_start, v_end);

    SELECT * INTO v_error
    FROM get_error_rate_metrics(v_start, v_end);

    SELECT COALESCE(
        JSONB_AGG(
            JSONB_BUILD_OBJECT('status', status, 'count', count)
            ORDER BY CASE status
                WHEN 'received' THEN 1
                WHEN 'assigned' THEN 2
                WHEN 'in_progress' THEN 3
                WHEN 'review' THEN 4
                WHEN 'completed' THEN 5
                WHEN 'discarded' THEN 6
                ELSE 7
            END
        ),
        '[]'::jsonb
    )
    INTO v_legacy_status_breakdown
    FROM get_samples_by_status(v_start, v_end);

    SELECT * INTO v_kpi
    FROM get_kpi_metrics(v_start, v_end);

    IF v_kpi.avg_tat_hours IS DISTINCT FROM v_tat.avg_tat_hours THEN
        RAISE EXCEPTION 'TEST 2 FAILED: avg_tat_hours mismatch. consolidated=%, legacy=%', v_kpi.avg_tat_hours, v_tat.avg_tat_hours;
    END IF;

    IF v_kpi.median_tat_hours IS DISTINCT FROM v_tat.median_tat_hours THEN
        RAISE EXCEPTION 'TEST 2 FAILED: median_tat_hours mismatch. consolidated=%, legacy=%', v_kpi.median_tat_hours, v_tat.median_tat_hours;
    END IF;

    IF v_kpi.sample_count IS DISTINCT FROM v_tat.sample_count OR v_kpi.on_time_count IS DISTINCT FROM v_tat.on_time_count THEN
        RAISE EXCEPTION 'TEST 2 FAILED: empty-window TAT counts mismatch. consolidated=(%, %), legacy=(%, %)', v_kpi.sample_count, v_kpi.on_time_count, v_tat.sample_count, v_tat.on_time_count;
    END IF;

    IF v_kpi.status_breakdown IS DISTINCT FROM v_legacy_status_breakdown THEN
        RAISE EXCEPTION 'TEST 2 FAILED: empty-window status_breakdown mismatch. consolidated=%, legacy=%', v_kpi.status_breakdown, v_legacy_status_breakdown;
    END IF;

    IF v_kpi.pending_count IS DISTINCT FROM v_approval.pending_count OR v_kpi.avg_wait_hours IS DISTINCT FROM v_approval.avg_wait_hours OR v_kpi.overdue_count IS DISTINCT FROM v_approval.overdue_count THEN
        RAISE EXCEPTION 'TEST 2 FAILED: empty-window approval mismatch. consolidated=(%, %, %), legacy=(%, %, %)', v_kpi.pending_count, v_kpi.avg_wait_hours, v_kpi.overdue_count, v_approval.pending_count, v_approval.avg_wait_hours, v_approval.overdue_count;
    END IF;

    IF v_kpi.error_rate IS DISTINCT FROM v_error.error_rate OR v_kpi.total_modifications IS DISTINCT FROM v_error.total_modifications OR v_kpi.total_results IS DISTINCT FROM v_error.total_results THEN
        RAISE EXCEPTION 'TEST 2 FAILED: empty-window error mismatch. consolidated=(%, %, %), legacy=(%, %, %)', v_kpi.error_rate, v_kpi.total_modifications, v_kpi.total_results, v_error.error_rate, v_error.total_modifications, v_error.total_results;
    END IF;

    IF v_kpi.sample_count IS DISTINCT FROM 0::bigint OR v_kpi.on_time_count IS DISTINCT FROM 0::bigint OR v_kpi.status_breakdown IS DISTINCT FROM '[]'::jsonb OR v_kpi.pending_count IS DISTINCT FROM 0::bigint OR v_kpi.overdue_count IS DISTINCT FROM 0::bigint OR v_kpi.error_rate IS DISTINCT FROM 0.00::numeric OR v_kpi.total_modifications IS DISTINCT FROM 0::bigint OR v_kpi.total_results IS DISTINCT FROM 0::bigint THEN
        RAISE EXCEPTION 'TEST 2 FAILED: unexpected empty-window defaults in consolidated row: %', ROW(v_kpi.sample_count, v_kpi.on_time_count, v_kpi.status_breakdown, v_kpi.pending_count, v_kpi.overdue_count, v_kpi.error_rate, v_kpi.total_modifications, v_kpi.total_results);
    END IF;

    RAISE NOTICE 'TEST 2 PASSED: consolidated KPI RPC matches legacy RPCs on empty data';
END $$;

\echo ''
\echo '============================================================================'
\echo 'ALL REPORTING KPI PARITY TESTS PASSED'
\echo 'Rolling back seeded data...'
\echo '============================================================================'

ROLLBACK;
