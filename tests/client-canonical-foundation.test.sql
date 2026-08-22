-- Rollback-only runtime tests for migration 215.
-- Covers client-normalization-v1, projection triggers, legacy grants/RLS,
-- audit evidence, confidentiality guardrails, and unchanged caller contracts.

BEGIN;

\set ON_ERROR_STOP on

SET LOCAL search_path TO public, extensions;

CREATE TEMP TABLE expected_client_policy_contract (
    policy_name TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    permissive BOOLEAN NOT NULL,
    roles OID[] NOT NULL,
    using_expression TEXT,
    with_check_expression TEXT
) ON COMMIT DROP;

INSERT INTO expected_client_policy_contract (
    policy_name,
    command,
    permissive,
    roles,
    using_expression,
    with_check_expression
) VALUES
    (
        'Analysts and managers can update clients',
        'w',
        TRUE,
        ARRAY[0::OID],
        '(get_user_role() = ANY (ARRAY[''analyst''::user_role, ''manager''::user_role]))',
        '(get_user_role() = ANY (ARRAY[''analyst''::user_role, ''manager''::user_role]))'
    ),
    (
        'Analysts can create clients',
        'a',
        TRUE,
        ARRAY[0::OID],
        NULL,
        '(get_user_role() = ANY (ARRAY[''analyst''::user_role, ''manager''::user_role]))'
    ),
    (
        'Authenticated users can read clients',
        'r',
        TRUE,
        ARRAY[0::OID],
        '(( SELECT auth.uid() AS uid) IS NOT NULL)',
        NULL
    ),
    (
        'Managers can delete clients',
        'd',
        TRUE,
        ARRAY[0::OID],
        '(get_user_role() = ''manager''::user_role)',
        NULL
    );

CREATE TEMP TABLE expected_client_acl_contract (
    acl TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO expected_client_acl_contract (acl) VALUES
    ('anon=r/postgres'),
    ('authenticated=arwdDxt/postgres'),
    ('postgres=arwdDxt/postgres'),
    ('service_role=r/postgres');

DO $catalog_contract$
BEGIN
    IF to_regprocedure('public.normalize_client_name_v1(text)') IS NULL
       OR to_regprocedure('public.normalize_client_phone_v1(text)') IS NULL
       OR to_regprocedure(
           'public.normalize_client_government_identity_v1(text)'
       ) IS NULL
       OR to_regprocedure(
           'public.classify_client_government_identity_v1(text)'
       ) IS NULL
       OR to_regprocedure(
           'public.maintain_client_identity_projections()'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 215 client-normalization-v1 functions are missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.clients'::REGCLASS
          AND tgname = 'clients_maintain_identity_projections'
          AND tgenabled = 'O'
          AND tgfoid =
              'public.maintain_client_identity_projections()'::REGPROCEDURE
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION 'Client projection trigger is missing or disabled';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.clients'::REGCLASS
          AND tgname = 'audit_clients_changes'
          AND tgenabled = 'O'
          AND tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION 'Existing client audit trigger changed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.clients'::REGCLASS
          AND relrowsecurity
    ) THEN
        RAISE EXCEPTION 'Client row_security is not enabled';
    END IF;

    IF EXISTS (
        (
            SELECT
                policy_name,
                command,
                permissive,
                roles,
                using_expression,
                with_check_expression
            FROM expected_client_policy_contract
            EXCEPT
            SELECT
                polname,
                polcmd::TEXT,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
        )
        UNION ALL
        (
            SELECT
                polname,
                polcmd::TEXT,
                polpermissive,
                polroles,
                pg_get_expr(polqual, polrelid),
                pg_get_expr(polwithcheck, polrelid)
            FROM pg_policy
            WHERE polrelid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT
                policy_name,
                command,
                permissive,
                roles,
                using_expression,
                with_check_expression
            FROM expected_client_policy_contract
        )
    ) THEN
        RAISE EXCEPTION 'Existing exact client RLS policy contract changed';
    END IF;

    IF EXISTS (
        (
            SELECT acl
            FROM expected_client_acl_contract
            EXCEPT
            SELECT entries.acl::TEXT
            FROM pg_class
            CROSS JOIN LATERAL unnest(relacl) AS entries(acl)
            WHERE oid = 'public.clients'::REGCLASS
        )
        UNION ALL
        (
            SELECT entries.acl::TEXT
            FROM pg_class
            CROSS JOIN LATERAL unnest(relacl) AS entries(acl)
            WHERE oid = 'public.clients'::REGCLASS
            EXCEPT
            SELECT acl
            FROM expected_client_acl_contract
        )
    ) THEN
        RAISE EXCEPTION 'Existing exact client table grants changed';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'public.normalize_client_name_v1(text)',
        'EXECUTE'
    )
       OR has_function_privilege(
           'anon',
           'public.normalize_client_phone_v1(text)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'service_role',
           'public.maintain_client_identity_projections()',
           'EXECUTE'
       )
    THEN
        RAISE EXCEPTION 'Private normalization helpers are executable';
    END IF;

    IF to_regclass('public.clients_unique_identity') IS NULL
       OR to_regclass('public.idx_clients_unique_phone') IS NULL
    THEN
        RAISE EXCEPTION 'Legacy identity or phone contract was removed';
    END IF;
END;
$catalog_contract$;

DO $normalization_fixtures$
BEGIN
    IF current_setting('server_version_num')::INTEGER <> 150001
       OR NOT EXISTS (
           SELECT 1
           FROM pg_collation
           WHERE collname = 'und-x-icu'
             AND collprovider = 'i'
             AND collversion IS NOT DISTINCT FROM '153.14'
             AND pg_collation_actual_version(oid)
                 IS NOT DISTINCT FROM '153.14'
       )
    THEN
        RAISE EXCEPTION
            'client-normalization-v1 runtime is not PostgreSQL 15.1 / ICU 153.14';
    END IF;

    IF public.normalize_client_name_v1(
        '  NGUYỄN   Văn A  '
    ) IS DISTINCT FROM 'nguyễn văn a'
       OR public.normalize_client_name_v1(
           normalize('Nguyễn Văn A', NFD)
       ) IS DISTINCT FROM 'nguyễn văn a'
       OR public.normalize_client_name_v1(
           'Nguyen Van A'
       ) IS NOT DISTINCT FROM 'nguyễn văn a'
    THEN
        RAISE EXCEPTION
            'client-normalization-v1 Vietnamese name fixtures failed';
    END IF;

    IF public.normalize_client_phone_v1(
        '+84901234567'
    ) IS DISTINCT FROM '0901234567'
       OR public.normalize_client_phone_v1(
           '0901234567'
       ) IS DISTINCT FROM '0901234567'
       OR public.normalize_client_phone_v1(
           '0000000000'
       ) IS NOT NULL
       OR public.normalize_client_phone_v1(
           '12345'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION 'client-normalization-v1 phone fixtures failed';
    END IF;

    IF public.normalize_client_government_identity_v1(
        '086094006827'
    ) IS DISTINCT FROM '086094006827'
       OR public.classify_client_government_identity_v1(
           '086094006827'
       ) IS DISTINCT FROM 'cccd'
       OR public.classify_client_government_identity_v1(
           '331757192'
       ) IS DISTINCT FROM 'cmnd'
       OR public.normalize_client_government_identity_v1(
           'BACKFILL-001'
       ) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'client-normalization-v1 government identity fixtures failed';
    END IF;
END;
$normalization_fixtures$;

CREATE TEMP TABLE client_foundation_test_ids (
    client_id UUID PRIMARY KEY
) ON COMMIT DROP;

DO $projection_and_audit$
DECLARE
    v_client_id UUID := gen_random_uuid();
    v_phone TEXT;
    v_plus84_phone TEXT;
    v_identity TEXT;
    v_name TEXT := '  PHASE   ONE   Nguyễn ' || v_client_id::TEXT;
    v_update_name TEXT :=
        normalize('  PHASE   ONE   NGUYỄN ', NFD) || v_client_id::TEXT;
    v_row public.clients%ROWTYPE;
    v_audit_count BIGINT;
BEGIN
    SELECT '0' || candidate::TEXT
    INTO v_phone
    FROM generate_series(990000000, 999999999) AS candidate
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.clients
        WHERE phone IN (
            '0' || candidate::TEXT,
            '+84' || candidate::TEXT
        )
    )
    LIMIT 1;

    SELECT candidate::TEXT
    INTO v_identity
    FROM generate_series(
        990000000000::BIGINT,
        999999999999::BIGINT
    ) AS candidate
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.clients
        WHERE id_card_num = candidate::TEXT
    )
    LIMIT 1;

    IF v_phone IS NULL OR v_identity IS NULL THEN
        RAISE EXCEPTION 'Could not allocate rollback-only client fixtures';
    END IF;

    v_plus84_phone := '+84' || substring(v_phone FROM 2);

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone,
        address
    ) VALUES (
        v_client_id,
        v_identity,
        v_name,
        DATE '1900-01-01',
        'Nam',
        v_phone,
        'Rollback-only fixture'
    );

    INSERT INTO client_foundation_test_ids (client_id)
    VALUES (v_client_id);

    SELECT *
    INTO STRICT v_row
    FROM public.clients
    WHERE id = v_client_id;

    IF v_row.normalized_name IS DISTINCT FROM
           public.normalize_client_name_v1(v_name)
       OR v_row.normalized_phone IS DISTINCT FROM v_phone
       OR v_row.government_identity_type IS DISTINCT FROM 'cccd'
       OR v_row.government_identity_value IS DISTINCT FROM v_identity
       OR NOT v_row.government_identity_trusted
       OR v_row.deleted_at IS NOT NULL
       OR v_row.deleted_by IS NOT NULL
       OR v_row.deletion_reason IS NOT NULL
    THEN
        RAISE EXCEPTION 'Insert projections or lifecycle defaults failed';
    END IF;

    UPDATE public.clients
    SET
        name = v_update_name,
        phone = v_plus84_phone,
        id_card_num = 'BACKFILL-' || v_client_id::TEXT,
        normalized_name = 'tampered',
        normalized_phone = 'tampered',
        government_identity_type = 'cccd',
        government_identity_value = '000000000000',
        government_identity_trusted = TRUE
    WHERE id = v_client_id;

    SELECT *
    INTO STRICT v_row
    FROM public.clients
    WHERE id = v_client_id;

    IF v_row.normalized_name IS DISTINCT FROM
           public.normalize_client_name_v1(v_update_name)
       OR v_row.normalized_phone IS DISTINCT FROM
           public.normalize_client_phone_v1(v_plus84_phone)
       OR v_row.government_identity_type IS NOT NULL
       OR v_row.government_identity_value IS NOT NULL
       OR v_row.government_identity_trusted
    THEN
        RAISE EXCEPTION 'Update projections did not overwrite stale input';
    END IF;

    SELECT count(*)
    INTO v_audit_count
    FROM public.audit_logs
    WHERE table_name = 'clients'
      AND record_id = v_client_id
      AND operation IN ('INSERT', 'UPDATE');

    IF v_audit_count <> 2 THEN
        RAISE EXCEPTION 'Client audit evidence changed: %', v_audit_count;
    END IF;
END;
$projection_and_audit$;

DO $rls_confidentiality_and_legacy_callers$
DECLARE
    v_analyst_id UUID := gen_random_uuid();
    v_manager_id UUID := gen_random_uuid();
    v_analyst_client_id UUID := gen_random_uuid();
    v_manager_client_id UUID := gen_random_uuid();
    v_phones TEXT[];
    v_identities TEXT[];
    v_analyst_name TEXT :=
        'Phase 1 Analyst Client ' || v_analyst_client_id::TEXT;
    v_manager_name TEXT :=
        'Phase 1 Manager Client ' || v_manager_client_id::TEXT;
    v_can_access_confidential BOOLEAN;
    v_row_count BIGINT;
    v_audit_count BIGINT;
    v_actor_audit_count BIGINT;
BEGIN
    IF to_regprocedure(
           'public.user_can_access_confidential()'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Existing confidentiality caller is unavailable';
    END IF;

    SELECT array_agg(phone ORDER BY phone)
    INTO v_phones
    FROM (
        SELECT '0' || candidate::TEXT AS phone
        FROM generate_series(
            970000000::BIGINT,
            979999999::BIGINT
        ) AS candidate
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.clients
            WHERE clients.phone = '0' || candidate::TEXT
        )
        LIMIT 2
    ) AS available_phones;

    SELECT array_agg(identity_value ORDER BY identity_value)
    INTO v_identities
    FROM (
        SELECT candidate::TEXT AS identity_value
        FROM generate_series(
            970000000000::BIGINT,
            979999999999::BIGINT
        ) AS candidate
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.clients
            WHERE id_card_num = candidate::TEXT
        )
        LIMIT 2
    ) AS available_identities;

    IF coalesce(array_length(v_phones, 1), 0) <> 2
       OR coalesce(array_length(v_identities, 1), 0) <> 2
    THEN
        RAISE EXCEPTION
            'Could not allocate rollback-only RLS client fixtures';
    END IF;

    INSERT INTO auth.users (id, email)
    VALUES
        (
            v_analyst_id,
            format('phase1-analyst-%s@lims.local', v_analyst_id)
        ),
        (
            v_manager_id,
            format('phase1-manager-%s@lims.local', v_manager_id)
        );

    INSERT INTO public.users (
        id,
        username,
        full_name,
        role,
        email,
        can_access_confidential,
        deleted_at
    ) VALUES
        (
            v_analyst_id,
            'phase1-analyst-' || v_analyst_id::TEXT,
            'Phase 1 Analyst',
            'analyst',
            format('phase1-analyst-%s@lims.local', v_analyst_id),
            FALSE,
            NULL
        ),
        (
            v_manager_id,
            'phase1-manager-' || v_manager_id::TEXT,
            'Phase 1 Manager',
            'manager',
            format('phase1-manager-%s@lims.local', v_manager_id),
            TRUE,
            NULL
        );

    PERFORM set_config(
        'request.jwt.claims',
        format(
            '{"sub":"%s","role":"authenticated"}',
            v_analyst_id
        ),
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        v_analyst_id::TEXT,
        TRUE
    );
    EXECUTE 'SET LOCAL ROLE authenticated';

    EXECUTE 'SELECT public.user_can_access_confidential()'
    INTO v_can_access_confidential;
    IF v_can_access_confidential THEN
        RAISE EXCEPTION
            'Analyst confidentiality helper no longer fails closed';
    END IF;

    EXECUTE $insert_analyst_client$
        INSERT INTO public.clients (
            id,
            id_card_num,
            name,
            date_of_birth,
            gender,
            phone,
            address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    $insert_analyst_client$
    USING
        v_analyst_client_id,
        v_identities[1],
        v_analyst_name,
        DATE '1900-01-02',
        'Nữ',
        v_phones[1],
        'Analyst RLS fixture';
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count <> 1 THEN
        RAISE EXCEPTION 'Analyst client INSERT policy changed';
    END IF;

    EXECUTE
        'SELECT count(*) FROM public.clients WHERE id = $1'
    INTO v_row_count
    USING v_analyst_client_id;
    IF v_row_count <> 1 THEN
        RAISE EXCEPTION 'Authenticated client SELECT policy changed';
    END IF;

    EXECUTE
        'UPDATE public.clients SET address = $1 WHERE id = $2'
    USING 'Analyst RLS fixture updated', v_analyst_client_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count <> 1 THEN
        RAISE EXCEPTION 'Analyst client UPDATE policy changed';
    END IF;

    EXECUTE 'DELETE FROM public.clients WHERE id = $1'
    USING v_analyst_client_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count <> 0 THEN
        RAISE EXCEPTION 'Analyst unexpectedly gained client DELETE access';
    END IF;

    EXECUTE 'RESET ROLE';

    SELECT
        count(*),
        count(*) FILTER (WHERE changed_by = v_analyst_id)
    INTO v_audit_count, v_actor_audit_count
    FROM public.audit_logs
    WHERE table_name = 'clients'
      AND record_id = v_analyst_client_id
      AND operation IN ('INSERT', 'UPDATE');

    IF v_audit_count <> 2 OR v_actor_audit_count <> 2 THEN
        RAISE EXCEPTION
            'Analyst client audit actor contract changed: % / %',
            v_actor_audit_count,
            v_audit_count;
    END IF;

    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"anon"}',
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', '', TRUE);
    EXECUTE 'SET LOCAL ROLE anon';

    EXECUTE
        'SELECT count(*) FROM public.clients WHERE id = $1'
    INTO v_row_count
    USING v_analyst_client_id;

    EXECUTE 'RESET ROLE';

    IF v_row_count <> 0 THEN
        RAISE EXCEPTION 'Anonymous client reads no longer fail closed';
    END IF;

    PERFORM set_config(
        'request.jwt.claims',
        format(
            '{"sub":"%s","role":"authenticated"}',
            v_manager_id
        ),
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        v_manager_id::TEXT,
        TRUE
    );
    EXECUTE 'SET LOCAL ROLE authenticated';

    EXECUTE 'SELECT public.user_can_access_confidential()'
    INTO v_can_access_confidential;
    IF NOT v_can_access_confidential THEN
        RAISE EXCEPTION
            'Explicit confidential access is no longer honored';
    END IF;

    EXECUTE $insert_manager_client$
        INSERT INTO public.clients (
            id,
            id_card_num,
            name,
            date_of_birth,
            gender,
            phone,
            address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    $insert_manager_client$
    USING
        v_manager_client_id,
        v_identities[2],
        v_manager_name,
        DATE '1900-01-03',
        'Nam',
        v_phones[2],
        'Manager RLS fixture';

    EXECUTE 'DELETE FROM public.clients WHERE id = $1'
    USING v_manager_client_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count <> 1 THEN
        RAISE EXCEPTION 'Manager client DELETE policy changed';
    END IF;

    EXECUTE 'RESET ROLE';

    SELECT
        count(*),
        count(*) FILTER (WHERE changed_by = v_manager_id)
    INTO v_audit_count, v_actor_audit_count
    FROM public.audit_logs
    WHERE table_name = 'clients'
      AND record_id = v_manager_client_id
      AND operation IN ('INSERT', 'DELETE');

    IF v_audit_count <> 2 OR v_actor_audit_count <> 2 THEN
        RAISE EXCEPTION
            'Manager client audit actor contract changed: % / %',
            v_actor_audit_count,
            v_audit_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polrelid = 'public.results'::REGCLASS
    )
    THEN
        RAISE EXCEPTION
            'Existing confidentiality result policies are unavailable';
    END IF;

    -- The current clients.ts caller writes only legacy columns. The successful
    -- analyst INSERT/UPDATE above proves that caller contract remains usable.
    IF NOT EXISTS (
        SELECT 1
        FROM public.clients
        WHERE id = v_analyst_client_id
          AND address = 'Analyst RLS fixture updated'
    ) THEN
        RAISE EXCEPTION 'Legacy direct client caller contract changed';
    END IF;
END;
$rls_confidentiality_and_legacy_callers$;

ROLLBACK;
