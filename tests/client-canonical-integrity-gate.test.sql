-- Rollback-only Gate A runtime coverage for canonical client integrity.
-- Security impact: exercises existing manager RPCs and constraints in one
-- transaction; the final ROLLBACK removes every fixture and audit row.
-- Historical data impact: sample/result counts and links must remain unchanged.

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE FUNCTION pg_temp.assert_client_canonical_gate(
    p_condition BOOLEAN,
    p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT COALESCE(p_condition, FALSE) THEN
        RAISE EXCEPTION 'client canonical Gate A assertion failed: %',
            p_message;
    END IF;
END;
$$;

DO $contract$
BEGIN
    IF NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.clients'::REGCLASS
             AND conname = 'clients_canonical_projection_check'
       )
       OR to_regclass('public.clients_unique_trusted_government_identity')
           IS NULL
       OR to_regprocedure(
           'public.test_client_canonical_integrity_security()'
       ) IS NULL
       OR to_regprocedure(
           'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)'
       ) IS NULL
       OR to_regprocedure(
           'public.deactivate_client_v1(uuid,timestamp with time zone,text)'
       ) IS NULL
       OR to_regprocedure(
           'public.restore_client_v1(uuid,timestamp with time zone,text)'
       ) IS NULL
       OR to_regprocedure(
           'public.correct_client_identity_v1(uuid,timestamp with time zone,text,text,date,text,text,text)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Gate A runtime contract is missing after migration 231';
    END IF;

    IF to_regclass('public.clients_unique_identity') IS NOT NULL THEN
        RAISE EXCEPTION
            'Gate A runtime found the retired name/date-of-birth constraint';
    END IF;
END;
$contract$;

DO $runtime$
DECLARE
    v_manager_id CONSTANT UUID :=
        '95270000-0000-0000-0000-000000000001';
    v_owner_id CONSTANT UUID :=
        '95270000-0000-0000-0000-000000000010';
    v_phone_conflict_id CONSTANT UUID :=
        '95270000-0000-0000-0000-000000000011';
    v_dob_conflict_id CONSTANT UUID :=
        '95270000-0000-0000-0000-000000000012';
    v_trusted_conflict_id CONSTANT UUID :=
        '95270000-0000-0000-0000-000000000013';
    v_lifecycle_id CONSTANT UUID :=
        '95270000-0000-0000-0000-000000000014';
    v_history_client_id UUID;
    v_resolution RECORD;
    v_result JSONB;
    v_updated_at TIMESTAMPTZ;
    v_after_deactivate TIMESTAMPTZ;
    v_sample_count_before BIGINT;
    v_result_count_before BIGINT;
    v_sample_links_before UUID[];
    v_sample_links_after UUID[];
    v_trusted_conflict_denied BOOLEAN := FALSE;
    v_restore_conflict_denied BOOLEAN := FALSE;
    v_correction_conflict_denied BOOLEAN := FALSE;
    v_adjudication_result JSONB;
    v_audit_failure_denied BOOLEAN := FALSE;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES (
        v_manager_id,
        'issue-enforce-client-canonical-integrity@lims.local'
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
    VALUES (
        v_manager_id,
        'issue_enforce_client_canonical_integrity',
        'Gate A Canonical Integrity Manager',
        'manager',
        'issue-enforce-client-canonical-integrity@lims.local',
        TRUE,
        NULL
    )
    ON CONFLICT (id) DO NOTHING;

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_manager_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_manager_id::TEXT, TRUE);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);

    SELECT count(*) INTO v_sample_count_before FROM public.samples;
    SELECT count(*) INTO v_result_count_before FROM public.results;

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
        v_owner_id,
        '952700000001',
        'Gate A Canonical Owner',
        DATE '1970-01-01',
        'Nam',
        '0909527001',
        'Rollback fixture'
    );

    PERFORM pg_temp.assert_client_canonical_gate(
        EXISTS (
            SELECT 1
            FROM public.clients AS client
            WHERE client.id = v_owner_id
              AND client.normalized_name IS NOT DISTINCT FROM
                  public.normalize_client_name_v1(client.name)
              AND client.normalized_phone IS NOT DISTINCT FROM
                  public.normalize_client_phone_v1(client.phone)
              AND client.government_identity_value IS NOT DISTINCT FROM
                  public.normalize_client_government_identity_v1(
                      client.id_card_num
                  )
              AND client.government_identity_type IS NOT DISTINCT FROM
                  public.classify_client_government_identity_v1(
                      client.id_card_num
                  )
              AND client.government_identity_trusted IS NOT DISTINCT FROM
                  (
                      public.normalize_client_government_identity_v1(
                          client.id_card_num
                      ) IS NOT NULL
                  )
        ),
        'new client must persist canonical projections'
    );

    SELECT *
    INTO v_resolution
    FROM public.resolve_or_create_client_v2(
        'cccd',
        '952700000011',
        'Gate A Phone Candidate',
        DATE '1971-01-01',
        'Nam',
        '0909527001',
        'Rollback fixture',
        NULL,
        NULL
    );
    PERFORM pg_temp.assert_client_canonical_gate(
        v_resolution.outcome = 'conflict'
            AND NOT v_resolution.created
            AND v_resolution.client_id IS NULL,
        'normalized phone conflict must fail closed without creating a client'
    );

    SELECT *
    INTO v_resolution
    FROM public.resolve_or_create_client_v2(
        NULL,
        NULL,
        'Gate A Canonical Owner',
        DATE '1970-01-01',
        'Nữ',
        '0909527002',
        'Rollback fixture',
        NULL,
        NULL
    );
    PERFORM pg_temp.assert_client_canonical_gate(
        v_resolution.outcome = 'conflict'
            AND NOT v_resolution.created
            AND v_resolution.client_id IS NULL,
        'normalized name/date-of-birth conflict must fail closed'
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
            v_trusted_conflict_id,
            '952700000001',
            'Gate A Trusted Conflict',
            DATE '1972-01-01',
            'Nữ',
            '0909527013',
            'Rollback fixture'
        );
    EXCEPTION
        WHEN unique_violation THEN
            v_trusted_conflict_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_canonical_gate(
        v_trusted_conflict_denied,
        'trusted typed identity conflict must be rejected'
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
        v_lifecycle_id,
        'GATE-A-LIFECYCLE',
        'Gate A Lifecycle Client',
        DATE '1973-01-01',
        'Khác',
        '0909527014',
        'Rollback fixture'
    );

    SELECT updated_at
    INTO v_updated_at
    FROM public.clients
    WHERE id = v_lifecycle_id;

    v_result := public.deactivate_client_v1(
        v_lifecycle_id,
        v_updated_at,
        'Gate A deactivation audit'
    );
    v_after_deactivate := (v_result ->> 'updatedAt')::TIMESTAMPTZ;

    PERFORM pg_temp.assert_client_canonical_gate(
        v_result ->> 'status' = 'inactive'
            AND (
                SELECT count(*)
                FROM public.audit_logs
                WHERE table_name = 'clients'
                  AND record_id = v_lifecycle_id
                  AND operation = 'CLIENT_DEACTIVATED'
                  AND changed_by = v_manager_id
                  AND new_values ->> 'reason' =
                      'Gate A deactivation audit'
            ) = 1,
        'successful deactivation must write one explicit audit event'
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
        v_phone_conflict_id,
        'GATE-A-PHONE-CONFLICT',
        'Gate A Restore Phone Conflict',
        DATE '1971-01-01',
        'Nữ',
        '+84909527014',
        'Rollback fixture'
    );

    BEGIN
        PERFORM public.restore_client_v1(
            v_lifecycle_id,
            v_after_deactivate,
            'Gate A restore with phone conflict'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1114' THEN
            v_restore_conflict_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_canonical_gate(
        v_restore_conflict_denied,
        'restore must reject an unresolved normalized phone conflict'
    );

    UPDATE public.clients
    SET deleted_at = clock_timestamp(),
        deleted_by = v_manager_id,
        deletion_reason = 'Gate A adjudication fixture'
    WHERE id = v_phone_conflict_id;

    SELECT updated_at
    INTO v_updated_at
    FROM public.clients
    WHERE id = v_phone_conflict_id;

    v_adjudication_result := public.adjudicate_client_collision_v1(
        v_lifecycle_id,
        v_phone_conflict_id,
        v_after_deactivate,
        v_updated_at,
        'phone',
        'confirmed_distinct',
        'Gate A confirmed distinct phone adjudication'
    );

    PERFORM pg_temp.assert_client_canonical_gate(
        v_adjudication_result ->> 'disposition' = 'confirmed_distinct'
            AND EXISTS (
                SELECT 1
                FROM public.client_collision_adjudications
                WHERE id = (v_adjudication_result ->> 'id')::UUID
                  AND collision_type = 'phone'
                  AND disposition = 'confirmed_distinct'
            ),
        'confirmed-distinct adjudication must be recorded'
    );

    v_result := public.restore_client_v1(
        v_lifecycle_id,
        v_after_deactivate,
        'Gate A restore audit'
    );

    PERFORM pg_temp.assert_client_canonical_gate(
        v_result ->> 'status' = 'active'
            AND (
                SELECT count(*)
                FROM public.audit_logs
                WHERE table_name = 'clients'
                  AND record_id = v_lifecycle_id
                  AND operation = 'CLIENT_RESTORED'
                  AND changed_by = v_manager_id
                  AND new_values ->> 'reason' = 'Gate A restore audit'
            ) = 1,
        'successful restore must write one explicit audit event'
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
        v_dob_conflict_id,
        '952700000002',
        'Gate A Correction Identity Owner',
        DATE '1974-01-01',
        'Nam',
        '0909527012',
        'Rollback fixture'
    );

    SELECT updated_at
    INTO v_updated_at
    FROM public.clients
    WHERE id = v_dob_conflict_id;

    BEGIN
        PERFORM public.correct_client_identity_v1(
            v_lifecycle_id,
            (v_result ->> 'updatedAt')::TIMESTAMPTZ,
            '952700000002',
            'Gate A Corrected Client',
            DATE '1975-01-01',
            'Nam',
            '0909527015',
            'Gate A correction conflict'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1114' THEN
            v_correction_conflict_denied := TRUE;
    END;

    PERFORM pg_temp.assert_client_canonical_gate(
        v_correction_conflict_denied,
        'identity correction must reject an identity reserved by another client'
    );

    SELECT client.id
    INTO v_history_client_id
    FROM public.clients AS client
    WHERE client.deleted_at IS NULL
      AND EXISTS (
          SELECT 1
          FROM public.samples AS sample
          WHERE sample.client_id = client.id
      )
      AND client.id <> ALL (
          ARRAY[
              v_owner_id,
              v_lifecycle_id,
              v_phone_conflict_id,
              v_dob_conflict_id,
              v_trusted_conflict_id
          ]
      )
    ORDER BY client.id
    LIMIT 1;

    SELECT count(*) INTO v_sample_count_before FROM public.samples;
    SELECT count(*) INTO v_result_count_before FROM public.results;
    SELECT array_agg(sample.id ORDER BY sample.id)
    INTO v_sample_links_before
    FROM public.samples AS sample
    WHERE sample.client_id = v_history_client_id;

    SELECT updated_at
    INTO v_updated_at
    FROM public.clients
    WHERE id = v_history_client_id;

    v_result := public.deactivate_client_v1(
        v_history_client_id,
        v_updated_at,
        'Gate A history preservation'
    );
    v_result := public.restore_client_v1(
        v_history_client_id,
        (v_result ->> 'updatedAt')::TIMESTAMPTZ,
        'Gate A history restoration'
    );

    SELECT array_agg(sample.id ORDER BY sample.id)
    INTO v_sample_links_after
    FROM public.samples AS sample
    WHERE sample.client_id = v_history_client_id;

    PERFORM pg_temp.assert_client_canonical_gate(
        v_sample_count_before = (SELECT count(*) FROM public.samples)
            AND v_result_count_before = (SELECT count(*) FROM public.results)
            AND v_sample_links_before = v_sample_links_after,
        'lifecycle operations must preserve sample/result history'
    );

    CREATE FUNCTION pg_temp.fail_gate_a_audit()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $audit_failure$
    BEGIN
        IF NEW.operation = 'CLIENT_DEACTIVATED' THEN
            RAISE EXCEPTION 'forced Gate A audit failure';
        END IF;
        RETURN NEW;
    END;
    $audit_failure$;

    CREATE TRIGGER force_gate_a_audit_failure
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION pg_temp.fail_gate_a_audit();

    SELECT updated_at
    INTO v_updated_at
    FROM public.clients
    WHERE id = v_lifecycle_id;

    BEGIN
        PERFORM public.deactivate_client_v1(
            v_lifecycle_id,
            v_updated_at,
            'Gate A forced audit failure'
        );
    EXCEPTION
        WHEN SQLSTATE 'P1116' THEN
            v_audit_failure_denied := TRUE;
    END;

    DROP TRIGGER force_gate_a_audit_failure ON public.audit_logs;
    DROP FUNCTION pg_temp.fail_gate_a_audit();

    PERFORM pg_temp.assert_client_canonical_gate(
        v_audit_failure_denied
            AND EXISTS (
                SELECT 1
                FROM public.clients
                WHERE id = v_lifecycle_id
                  AND deleted_at IS NULL
            )
            AND NOT EXISTS (
                SELECT 1
                FROM public.audit_logs
                WHERE table_name = 'clients'
                  AND record_id = v_lifecycle_id
                  AND operation = 'CLIENT_DEACTIVATED'
                  AND new_values ->> 'reason' =
                      'Gate A forced audit failure'
            ),
        'P1116 audit failure must roll back the lifecycle mutation'
    );

    PERFORM pg_temp.assert_client_canonical_gate(
        public.test_client_canonical_integrity_security()
            AND (SELECT bool_and(passed) FROM public.run_security_tests()),
        'canonical and registered security tests must pass'
    );
END;
$runtime$;

SELECT 'client canonical integrity Gate A rollback tests passed' AS result;

ROLLBACK;
