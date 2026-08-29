\set ON_ERROR_STOP on
-- Rollback-only runtime coverage for the Issue #130 post-retirement gate.
-- Run only after migration 230 has been applied.
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE pg_temp.client_retirement_gate_results (
    case_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.record_client_retirement_case(
    p_case_name TEXT,
    p_passed BOOLEAN,
    p_detail TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, public, extensions
AS $$
BEGIN
    INSERT INTO pg_temp.client_retirement_gate_results (
        case_name,
        passed,
        detail
    )
    VALUES (p_case_name, p_passed, COALESCE(p_detail, ''))
    ON CONFLICT (case_name) DO UPDATE
    SET passed = EXCLUDED.passed,
        detail = EXCLUDED.detail;
END;
$$;

CREATE FUNCTION pg_temp.assert_insufficient_privilege(
    p_case_name TEXT,
    p_statement TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_denied BOOLEAN := FALSE;
    v_error TEXT;
BEGIN
    BEGIN
        EXECUTE p_statement;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_denied := TRUE;
        WHEN OTHERS THEN
            v_error := SQLSTATE || ': ' || SQLERRM;
    END;

    PERFORM pg_temp.record_client_retirement_case(
        p_case_name,
        v_denied AND v_error IS NULL,
        COALESCE(v_error, 'insufficient_privilege captured')
    );
END;
$$;

DO $contract$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.clients'::REGCLASS
          AND conname = 'clients_unique_identity'
    ) THEN
        RAISE EXCEPTION
            'post-retirement clients_unique_identity still exists';
    END IF;
END;
$contract$;

DO $fixtures$
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (
            '13000000-0000-0000-0000-000000000001',
            'issue130-retirement-manager@lims.local'
        ),
        (
            '13000000-0000-0000-0000-000000000002',
            'issue130-retirement-analyst@lims.local'
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
    VALUES
        (
            '13000000-0000-0000-0000-000000000001',
            'issue130_retirement_manager',
            'Issue 130 Retirement Manager',
            'manager',
            'issue130-retirement-manager@lims.local',
            TRUE,
            NULL
        ),
        (
            '13000000-0000-0000-0000-000000000002',
            'issue130_retirement_analyst',
            'Issue 130 Retirement Analyst',
            'analyst',
            'issue130-retirement-analyst@lims.local',
            TRUE,
            NULL
        );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address,
        health_insurance_num,
        expiry_date
    )
    VALUES
        (
            '13000000-0000-0000-0000-000000000011',
            '130000000011',
            'Issue 130 Duplicate Person',
            DATE '1980-01-13',
            'Nam',
            '091300000011',
            'Issue 130 fixture A',
            '130-000-000-011',
            DATE '2030-01-13'
        ),
        (
            '13000000-0000-0000-0000-000000000012',
            '130000000012',
            'Issue 130 Duplicate Person',
            DATE '1980-01-13',
            'Nữ',
            '091300000012',
            'Issue 130 fixture B',
            '130-000-000-012',
            DATE '2030-01-13'
        ),
        (
            '13000000-0000-0000-0000-000000000013',
            '130000000013',
            'Issue 130 Correction Original',
            DATE '1988-08-08',
            'Khác',
            '091300000013',
            'Issue 130 correction fixture',
            '130-000-000-013',
            DATE '2030-08-08'
        );
END;
$fixtures$;

DO $duplicate_clients$
DECLARE
    v_rows INTEGER;
    v_uuids INTEGER;
BEGIN
    SELECT count(*), count(DISTINCT id)
    INTO v_rows, v_uuids
    FROM public.clients
    WHERE normalized_name =
        public.normalize_client_name_v1('Issue 130 Duplicate Person')
      AND date_of_birth = DATE '1980-01-13'
      AND id_card_num IN ('130000000011', '130000000012');

    PERFORM pg_temp.record_client_retirement_case(
        'same_normalized_name_dob_distinct_identity',
        v_rows = 2 AND v_uuids = 2,
        format('rows=%s distinct_uuids=%s', v_rows, v_uuids)
    );
END;
$duplicate_clients$;

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    '{"sub":"13000000-0000-0000-0000-000000000002","role":"authenticated"}',
    TRUE
);
SELECT set_config(
    'request.jwt.claim.sub',
    '13000000-0000-0000-0000-000000000002',
    TRUE
);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);

SELECT pg_temp.assert_insufficient_privilege(
    'authenticated_denies_id_card_num_update',
    $sql$
        UPDATE public.clients
        SET id_card_num = '130000000091'
        WHERE id = '13000000-0000-0000-0000-000000000011'
    $sql$
);
SELECT pg_temp.assert_insufficient_privilege(
    'authenticated_denies_name_update',
    $sql$
        UPDATE public.clients
        SET name = 'Issue 130 Protected Name'
        WHERE id = '13000000-0000-0000-0000-000000000011'
    $sql$
);
SELECT pg_temp.assert_insufficient_privilege(
    'authenticated_denies_date_of_birth_update',
    $sql$
        UPDATE public.clients
        SET date_of_birth = DATE '1980-01-14'
        WHERE id = '13000000-0000-0000-0000-000000000011'
    $sql$
);

DO $profile_update$
DECLARE
    v_client public.clients%ROWTYPE;
    v_error TEXT;
BEGIN
    BEGIN
        UPDATE public.clients
        SET gender = 'Khác',
            phone = '091300000091',
            address = 'Issue 130 updated profile',
            health_insurance_num = '130-000-000-091',
            expiry_date = DATE '2031-01-13'
        WHERE id = '13000000-0000-0000-0000-000000000011';

        SELECT *
        INTO v_client
        FROM public.clients
        WHERE id = '13000000-0000-0000-0000-000000000011';
    EXCEPTION
        WHEN OTHERS THEN
            v_error := SQLSTATE || ': ' || SQLERRM;
    END;

    PERFORM pg_temp.record_client_retirement_case(
        'authenticated_allows_profile_update',
        v_error IS NULL
            AND v_client.gender = 'Khác'
            AND v_client.phone = '091300000091'
            AND v_client.address = 'Issue 130 updated profile'
            AND v_client.health_insurance_num = '130-000-000-091'
            AND v_client.expiry_date = DATE '2031-01-13'
            AND v_client.id_card_num = '130000000011'
            AND v_client.name = 'Issue 130 Duplicate Person'
            AND v_client.date_of_birth = DATE '1980-01-13',
        COALESCE(v_error, 'profile update succeeded')
    );
END;
$profile_update$;

DO $resolver$
DECLARE
    v_result RECORD;
    v_error TEXT;
    v_created_count INTEGER;
BEGIN
    BEGIN
        SELECT *
        INTO v_result
        FROM public.resolve_or_create_client_v2(
            'cccd',
            '130000000099',
            'Issue 130 Duplicate Person',
            DATE '1980-01-13',
            'Nam',
            '091300000099',
            'Issue 130 resolver fixture',
            '130-000-000-099',
            DATE '2030-01-13'
        );

        SELECT count(*)
        INTO v_created_count
        FROM public.clients
        WHERE id_card_num = '130000000099';
    EXCEPTION
        WHEN OTHERS THEN
            v_error := SQLSTATE || ': ' || SQLERRM;
    END;

    PERFORM pg_temp.record_client_retirement_case(
        'resolver_handles_same_name_dob_distinct_person',
        v_error IS NULL
            AND v_result.outcome = 'conflict'
            AND v_result.reason_code = 'cross_key_conflict'
            AND v_result.client_id IS NULL
            AND v_result.created = FALSE
            AND v_created_count = 0,
        COALESCE(
            v_error,
            format(
                'outcome=%s reason=%s created=%s',
                v_result.outcome,
                v_result.reason_code,
                v_result.created
            )
        )
    );
END;
$resolver$;

DO $analyst_correction$
DECLARE
    v_denied BOOLEAN := FALSE;
    v_error TEXT;
BEGIN
    BEGIN
        PERFORM public.correct_client_identity_v1(
            '13000000-0000-0000-0000-000000000013',
            (
                SELECT updated_at
                FROM public.clients
                WHERE id = '13000000-0000-0000-0000-000000000013'
            ),
            '130000000014',
            'Issue 130 Correction Revised',
            DATE '1988-08-09',
            'Nữ',
            '091300000014',
            'Issue 130 manager correction'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1110' THEN
            v_denied := TRUE;
        WHEN OTHERS THEN
            v_error := SQLSTATE || ': ' || SQLERRM;
    END;

    PERFORM pg_temp.record_client_retirement_case(
        'analyst_denied_identity_correction',
        v_denied AND v_error IS NULL,
        COALESCE(v_error, 'P1110 captured')
    );
END;
$analyst_correction$;

RESET ROLE;
RESET request.jwt.claims;
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    '{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated"}',
    TRUE
);
SELECT set_config(
    'request.jwt.claim.sub',
    '13000000-0000-0000-0000-000000000001',
    TRUE
);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);

DO $manager_correction$
DECLARE
    v_result JSONB;
    v_audit JSONB;
    v_corrected BOOLEAN := FALSE;
    v_error TEXT;
BEGIN
    BEGIN
        v_result := public.correct_client_identity_v1(
            '13000000-0000-0000-0000-000000000013',
            (
                SELECT updated_at
                FROM public.clients
                WHERE id = '13000000-0000-0000-0000-000000000013'
            ),
            '130000000014',
            'Issue 130 Correction Revised',
            DATE '1988-08-09',
            'Nữ',
            '091300000014',
            'Issue 130 manager correction'
        );

        SELECT EXISTS (
            SELECT 1
            FROM public.clients
            WHERE id = '13000000-0000-0000-0000-000000000013'
              AND id_card_num = '130000000014'
              AND name = 'Issue 130 Correction Revised'
              AND date_of_birth = DATE '1988-08-09'
              AND gender = 'Nữ'
              AND phone = '091300000014'
        )
        INTO v_corrected;

        SELECT new_values
        INTO v_audit
        FROM public.audit_logs
        WHERE table_name = 'clients'
          AND record_id = '13000000-0000-0000-0000-000000000013'
          AND operation = 'CLIENT_IDENTITY_CORRECTED'
          AND changed_by = '13000000-0000-0000-0000-000000000001'
        ORDER BY changed_at DESC
        LIMIT 1;
    EXCEPTION
        WHEN OTHERS THEN
            v_error := SQLSTATE || ': ' || SQLERRM;
    END;

    PERFORM pg_temp.record_client_retirement_case(
        'manager_correction_preserves_uuid_and_minimizes_pii',
        v_error IS NULL
            AND v_result ->> 'id' =
                '13000000-0000-0000-0000-000000000013'
            AND v_corrected
            AND (v_audit -> 'corrected_fields') ? 'id_card_num'
            AND (v_audit -> 'corrected_fields') ? 'name'
            AND (v_audit -> 'corrected_fields') ? 'date_of_birth'
            AND v_audit ->> 'reason' = 'Issue 130 manager correction'
            AND NOT (
                v_audit ? 'id_card_num'
                OR v_audit ? 'name'
                OR v_audit ? 'date_of_birth'
                OR v_audit ? 'phone'
            )
            AND v_audit::TEXT NOT LIKE '%130000000014%',
        COALESCE(v_error, 'manager correction audited')
    );
END;
$manager_correction$;

RESET ROLE;
RESET request.jwt.claims;
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;

DO $sample_snapshot$
DECLARE
    v_sample_type_id UUID;
    v_sample_type_name TEXT;
    v_snapshot_name TEXT;
    v_error TEXT;
BEGIN
    BEGIN
        SELECT id, name
        INTO v_sample_type_id, v_sample_type_name
        FROM public.sample_types
        WHERE deleted_at IS NULL
        ORDER BY id
        LIMIT 1;

        INSERT INTO public.samples (
            id,
            sample_id,
            client_id,
            client_name,
            status,
            received_by,
            sample_type_id,
            type,
            sample_quality
        )
        VALUES (
            '13000000-0000-0000-0000-000000000021',
            'ISSUE130-RETIREMENT-SAMPLE',
            '13000000-0000-0000-0000-000000000011',
            'Issue 130 incorrect snapshot',
            'received',
            '13000000-0000-0000-0000-000000000002',
            v_sample_type_id,
            v_sample_type_name,
            TRUE
        );

        SELECT client_name
        INTO v_snapshot_name
        FROM public.samples
        WHERE id = '13000000-0000-0000-0000-000000000021';
    EXCEPTION
        WHEN OTHERS THEN
            v_error := SQLSTATE || ': ' || SQLERRM;
    END;

    PERFORM pg_temp.record_client_retirement_case(
        'sample_snapshot_uses_client_name',
        v_error IS NULL
            AND v_snapshot_name = 'Issue 130 Duplicate Person',
        COALESCE(v_error, 'snapshot=' || v_snapshot_name)
    );
END;
$sample_snapshot$;

DO $recreate_unique$
DECLARE
    v_unique_violation BOOLEAN := FALSE;
    v_constraint_name TEXT;
    v_error TEXT;
BEGIN
    BEGIN
        ALTER TABLE public.clients
        ADD CONSTRAINT issue130_recovery_name_dob
        UNIQUE (name, date_of_birth);
    EXCEPTION
        WHEN unique_violation THEN
            v_unique_violation := TRUE;
            GET STACKED DIAGNOSTICS
                v_constraint_name = CONSTRAINT_NAME;
        WHEN OTHERS THEN
            v_error := SQLSTATE || ': ' || SQLERRM;
    END;

    PERFORM pg_temp.record_client_retirement_case(
        'recreating_name_dob_uniqueness_fails',
        v_unique_violation
            AND v_constraint_name = 'issue130_recovery_name_dob'
            AND v_error IS NULL,
        COALESCE(
            v_error,
            'constraint=' || COALESCE(v_constraint_name, '<none>')
        )
    );
END;
$recreate_unique$;

DO $assert_cases$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(
        case_name || ': ' || detail,
        E'\n'
        ORDER BY case_name
    )
    INTO v_failed
    FROM pg_temp.client_retirement_gate_results
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION
            'client retirement gate SQL tests failed:%',
            E'\n' || v_failed;
    END IF;
END;
$assert_cases$;

SELECT 'client-retirement-gate rollback tests passed' AS result;

ROLLBACK;

DO $residue$
DECLARE
    v_clients BIGINT;
    v_samples BIGINT;
    v_audits BIGINT;
BEGIN
    SELECT count(*)
    INTO v_clients
    FROM public.clients
    WHERE id IN (
        '13000000-0000-0000-0000-000000000011',
        '13000000-0000-0000-0000-000000000012',
        '13000000-0000-0000-0000-000000000013'
    );

    SELECT count(*)
    INTO v_samples
    FROM public.samples
    WHERE id = '13000000-0000-0000-0000-000000000021';

    SELECT count(*)
    INTO v_audits
    FROM public.audit_logs
    WHERE record_id IN (
        '13000000-0000-0000-0000-000000000011',
        '13000000-0000-0000-0000-000000000012',
        '13000000-0000-0000-0000-000000000013',
        '13000000-0000-0000-0000-000000000021'
    );

    IF v_clients <> 0 OR v_samples <> 0 OR v_audits <> 0 THEN
        RAISE EXCEPTION
            'Issue 130 rollback residue remains: clients=%, samples=%, audit_logs=%',
            v_clients,
            v_samples,
            v_audits;
    END IF;
END;
$residue$;

SELECT 'client-retirement-gate rollback residue checks passed' AS result;
