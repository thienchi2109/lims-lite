-- Rollback-only runtime coverage for deterministic client resolver v2.
-- Exercises typed identity precedence, fallback conflicts, all four outcomes,
-- resolve-and-create, and PII-minimized audit behavior.

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE FUNCTION pg_temp.assert_client_resolution(
    p_condition BOOLEAN,
    p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT COALESCE(p_condition, FALSE) THEN
        RAISE EXCEPTION 'client resolver v2 assertion failed: %', p_message;
    END IF;
END;
$$;

DO $contract$
BEGIN
    IF to_regprocedure(
        'public.resolve_client_identity_v2(text,text,text,date,text)'
    ) IS NULL
       OR to_regprocedure(
           'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)'
       ) IS NULL
    THEN
        RAISE EXCEPTION 'Migration 221 client resolver v2 RPCs are missing';
    END IF;
END;
$contract$;

DO $inactive_uniqueness$
DECLARE
    v_actor_id UUID := '95310000-0000-0000-0000-000000000900';
    v_constraint_name TEXT;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES (v_actor_id, 'issue111-phase4-uniqueness@lims.local');

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
        v_actor_id,
        'issue111_phase4_uniqueness',
        'Issue 111 Phase 4 Uniqueness',
        'analyst',
        'issue111-phase4-uniqueness@lims.local',
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
        address,
        deleted_at,
        deleted_by,
        deletion_reason
    )
    VALUES (
        '95310000-0000-0000-0000-000000000901',
        '953199000001',
        'Inactive Trusted Identity Owner',
        DATE '1980-09-01',
        'Khác',
        '0953199901',
        'Rollback fixture',
        clock_timestamp(),
        v_actor_id,
        'Kiểm thử giữ chỗ CCCD/CMND'
    );

    BEGIN
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
            '95310000-0000-0000-0000-000000000902',
            '953199000001',
            'Attempted Trusted Identity Reuse',
            DATE '1981-09-02',
            'Khác',
            '0953199902',
            'Rollback fixture'
        );

        RAISE EXCEPTION
            'inactive trusted identity was unexpectedly reusable';
    EXCEPTION
        WHEN unique_violation THEN
            GET STACKED DIAGNOSTICS
                v_constraint_name = CONSTRAINT_NAME;
            PERFORM pg_temp.assert_client_resolution(
                v_constraint_name =
                    'clients_unique_trusted_government_identity',
                format(
                    'inactive trusted identity must fail on the typed-ID index (%s)',
                    v_constraint_name
                )
            );
    END;
END;
$inactive_uniqueness$;

-- The duplicate typed-identity scenario predates enforcement. Dropping this
-- index inside the rollback transaction allows the resolver to prove that it
-- still fails closed if a damaged baseline is ever observed.
DROP INDEX public.clients_unique_trusted_government_identity;

DO $runtime$
DECLARE
    v_analyst_id UUID := '95310000-0000-0000-0000-000000000001';
    v_trusted_client_id UUID := '95310000-0000-0000-0000-000000000010';
    v_cmnd_client_id UUID := '95310000-0000-0000-0000-000000000011';
    v_inactive_client_id UUID := '95310000-0000-0000-0000-000000000012';
    v_fallback_client_id UUID := '95310000-0000-0000-0000-000000000013';
    v_duplicate_a_id UUID := '95310000-0000-0000-0000-000000000014';
    v_duplicate_b_id UUID := '95310000-0000-0000-0000-000000000015';
    v_accent_client_id UUID := '95310000-0000-0000-0000-000000000016';
    v_phone_owner_id UUID := '95310000-0000-0000-0000-000000000017';
    v_strong_duplicate_a_id UUID :=
        '95310000-0000-0000-0000-000000000018';
    v_strong_duplicate_b_id UUID :=
        '95310000-0000-0000-0000-000000000019';
    v_adjudicated_name_client_id UUID :=
        '95310000-0000-0000-0000-000000000020';
    v_exact_accent_client_id UUID :=
        '95310000-0000-0000-0000-000000000021';
    v_created_client_id UUID;
    v_before_updated_at TIMESTAMPTZ;
    v_result RECORD;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES (v_analyst_id, 'issue111-phase4-analyst@lims.local');

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
        v_analyst_id,
        'issue111_phase4_analyst',
        'Issue 111 Phase 4 Analyst',
        'analyst',
        'issue111-phase4-analyst@lims.local',
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
        deleted_at,
        deleted_by,
        deletion_reason
    )
    VALUES
        (
            v_trusted_client_id,
            '953100000010',
            'Nguyễn Văn An',
            DATE '1990-01-10',
            'Nam',
            '0953100010',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_cmnd_client_id,
            '953100011',
            'Trần Thị Bình',
            DATE '1988-01-11',
            'Nữ',
            '0953100011',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_inactive_client_id,
            '953100000012',
            'Phạm Văn Cường',
            DATE '1985-01-12',
            'Nam',
            '0953100012',
            'Rollback fixture',
            clock_timestamp(),
            v_analyst_id,
            'Ngừng hoạt động cho kiểm thử rollback'
        ),
        (
            v_fallback_client_id,
            '',
            'Lê Thị Dung',
            DATE '1992-01-13',
            'Nữ',
            '0953100013',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_duplicate_a_id,
            '',
            'Đỗ Văn Trùng',
            DATE '1991-01-14',
            'Nam',
            '0953100014',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_duplicate_b_id,
            '',
            '  đỗ   văn trùng ',
            DATE '1991-01-14',
            'Nam',
            '0953100015',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_accent_client_id,
            '',
            'Nguyen Van Accent',
            DATE '1993-01-15',
            'Nam',
            '0953100016',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_phone_owner_id,
            '',
            'Vũ Thị Điện Thoại',
            DATE '1989-01-16',
            'Nữ',
            '0953100017',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_strong_duplicate_a_id,
            '953100000018',
            'Strong Duplicate A',
            DATE '1987-01-17',
            'Nam',
            '0953100018',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_strong_duplicate_b_id,
            '953100000018',
            'Strong Duplicate B',
            DATE '1986-01-18',
            'Nữ',
            '0953100019',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_adjudicated_name_client_id,
            '',
            '  Nguyễn   Văn An  ',
            DATE '1990-01-10',
            'Nữ',
            '0953100020',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        ),
        (
            v_exact_accent_client_id,
            '',
            'Nguyễn Văn Accent',
            DATE '1993-01-15',
            'Nam',
            '0953100021',
            'Rollback fixture',
            NULL,
            NULL,
            NULL
        );

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_analyst_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, TRUE);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        ' 953100000010 ',
        '  Nguyễn   Văn An ',
        DATE '1990-01-10',
        '+84953100010'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'trusted_identity_disagreement'
            AND v_result.client_id IS NULL,
        format(
            'unadjudicated same-name cross-signal must fail closed (%s/%s)',
            v_result.outcome,
            v_result.reason_code
        )
    );

    INSERT INTO public.client_collision_adjudications (
        client_id,
        related_client_id,
        collision_type,
        disposition,
        reason,
        client_updated_at,
        related_client_updated_at,
        evidence,
        adjudicated_by
    )
    SELECT
        trusted_client.id,
        related_client.id,
        'name_date_of_birth',
        'confirmed_distinct',
        'Phase 4 resolver confirmed-distinct regression',
        trusted_client.updated_at,
        related_client.updated_at,
        jsonb_build_object('source', 'phase4_resolver_test'),
        v_analyst_id
    FROM public.clients AS trusted_client
    CROSS JOIN public.clients AS related_client
    WHERE trusted_client.id = v_trusted_client_id
      AND related_client.id = v_adjudicated_name_client_id;

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        ' 953100000010 ',
        '  Nguyễn   Văn An ',
        DATE '1990-01-10',
        '+84953100010'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'matched'
            AND v_result.reason_code = 'trusted_identity_match'
            AND v_result.client_id = v_trusted_client_id
            AND NOT v_result.created,
        'confirmed-distinct name/DOB cross-signal must not block trusted CCCD'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cmnd',
        '953100011',
        'Trần Thị Bình',
        DATE '1988-01-11',
        '0953100011'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'matched'
            AND v_result.reason_code = 'trusted_identity_match'
            AND v_result.client_id = v_cmnd_client_id,
        'typed CMND must remain distinct from CCCD'
    );

    SELECT updated_at
    INTO v_before_updated_at
    FROM public.clients
    WHERE id = v_trusted_client_id;

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        '953100000010',
        'Lê Thị Dung',
        DATE '1992-01-13',
        '0953100013'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'trusted_identity_disagreement'
            AND v_result.client_id IS NULL,
        'strong identity disagreement must not fall back'
    );
    PERFORM pg_temp.assert_client_resolution(
        (
            SELECT updated_at = v_before_updated_at
            FROM public.clients
            WHERE id = v_trusted_client_id
        ),
        'matched or conflicting resolution must not mutate a client'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        '953100009999',
        'Unknown Strong Identity',
        DATE '1979-09-09',
        '0953199999'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'not_found'
            AND v_result.reason_code = 'trusted_identity_not_found'
            AND v_result.client_id IS NULL,
        'unknown trusted identity without collision signals must be not_found'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        '953100000012',
        'Phạm Văn Cường',
        DATE '1985-01-12',
        '0953100012'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'inactive_candidate',
        'inactive trusted identity must fail closed'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        NULL,
        NULL,
        '  lê   thị dung ',
        DATE '1992-01-13',
        '+84953100013'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'matched'
            AND v_result.reason_code = 'name_dob_match'
            AND v_result.client_id = v_fallback_client_id,
        'one active normalized name and DOB candidate may match'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        NULL,
        NULL,
        'Đỗ Văn Trùng',
        DATE '1991-01-14',
        NULL
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'ambiguous'
            AND v_result.reason_code = 'name_dob_ambiguous'
            AND v_result.client_id IS NULL,
        'multiple normalized name and DOB candidates must be ambiguous'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        '953100000018',
        'Strong Duplicate A',
        DATE '1987-01-17',
        '0953100018'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'ambiguous'
            AND v_result.reason_code = 'trusted_identity_ambiguous'
            AND v_result.client_id IS NULL,
        'duplicate typed identity candidates must be ambiguous'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        NULL,
        NULL,
        'Nguyễn Văn Accent',
        DATE '1993-01-15',
        NULL
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'accent_only_conflict',
        'exact name/DOB plus accent-only candidate must fail closed'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        NULL,
        NULL,
        'No Matching Name',
        DATE '1978-01-16',
        '0953100017'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'phone_conflict',
        'phone alone must guard against creation without creating a match'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        '953100009998',
        'Lê Thị Dung',
        DATE '1992-01-13',
        '0953100013'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'cross_key_conflict',
        'unknown strong identity with weak-key collision must fail closed'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        'cccd',
        NULL,
        'Incomplete Identity',
        DATE '1977-01-17',
        NULL
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'conflict'
            AND v_result.reason_code = 'invalid_identity_input',
        'incomplete typed identity must return a stable conflict'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_client_identity_v2(
        NULL,
        NULL,
        'Safe New Client',
        DATE '1999-09-19',
        '0953199998'
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'not_found'
            AND v_result.reason_code = 'identity_not_found',
        'safe fallback absence must return not_found'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_or_create_client_v2(
        'cccd',
        '953100009997',
        'Created By Resolver',
        DATE '1997-09-17',
        'Khác',
        '0953199997',
        'Rollback fixture',
        NULL,
        NULL
    );
    v_created_client_id := v_result.client_id;
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'matched'
            AND v_result.reason_code = 'client_created'
            AND v_result.client_id IS NOT NULL
            AND v_result.created,
        'only not_found may proceed to atomic client creation'
    );
    PERFORM pg_temp.assert_client_resolution(
        (
            SELECT count(*) = 1
            FROM public.clients
            WHERE id = v_created_client_id
              AND government_identity_type = 'cccd'
              AND government_identity_value = '953100009997'
        ),
        'resolve-and-create must create exactly one typed client'
    );
    PERFORM pg_temp.assert_client_resolution(
        EXISTS (
            SELECT 1
            FROM public.audit_logs
            WHERE table_name = 'clients'
              AND record_id = v_created_client_id
              AND operation = 'CLIENT_CREATED_V2'
              AND new_values = jsonb_build_object(
                  'outcome', 'matched',
                  'reason_code', 'client_created'
              )
        ),
        'resolve-and-create audit metadata must be reason-bearing and PII-minimized'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_or_create_client_v2(
        'cccd',
        '953100009997',
        'Created By Resolver',
        DATE '1997-09-17',
        'Khác',
        '0953199997',
        'Changed address must not overwrite',
        NULL,
        NULL
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'matched'
            AND v_result.reason_code = 'trusted_identity_match'
            AND v_result.client_id = v_created_client_id
            AND NOT v_result.created,
        'repeated resolve-and-create must reuse without overwriting'
    );
    PERFORM pg_temp.assert_client_resolution(
        (
            SELECT address = 'Rollback fixture'
            FROM public.clients
            WHERE id = v_created_client_id
        ),
        'matched resolve-and-create must not fill or overwrite profile data'
    );

    SELECT *
    INTO v_result
    FROM public.resolve_or_create_client_v2(
        NULL,
        NULL,
        'No Matching Name',
        DATE '1978-01-16',
        'Nam',
        '0953100017',
        NULL,
        NULL,
        NULL
    );
    PERFORM pg_temp.assert_client_resolution(
        v_result.outcome = 'conflict'
            AND NOT v_result.created
            AND NOT EXISTS (
                SELECT 1
                FROM public.clients
                WHERE normalized_name =
                    public.normalize_client_name_v1('No Matching Name')
                  AND date_of_birth = DATE '1978-01-16'
            ),
        'conflict must prohibit client creation'
    );
END;
$runtime$;

SELECT 'client-resolution-v2 rollback tests passed' AS result;

ROLLBACK;
