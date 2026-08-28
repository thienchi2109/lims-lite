-- Remove the legacy name/date-of-birth client identity gate after Phase 6 cutover.
-- Security impact: authenticated callers lose direct UPDATE on identity columns;
-- transactional resolution and the audited manager correction RPC remain intact.
-- Historical data impact: the uniqueness constraint is removed without rewriting
-- existing rows, so distinct people may share a name and date of birth afterward.
-- Irreversible: switch rollback ends here. Future duplicate rows can make restoring
-- name/date-of-birth uniqueness impossible without forward-only adjudication.
-- Zero intended row mutation: this migration changes only schema, grants, comments,
-- and security verification functions.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_signature TEXT;
    v_column TEXT;
    v_security_test REGPROCEDURE;
    v_security_test_owner OID;
    v_security_test_volatility "char";
    v_security_test_settings TEXT[];
    v_public_execute BOOLEAN;
    v_runner_definition TEXT;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.resolve_client_identity_v2(text,text,text,date,text)',
        'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)'
    ]
    LOOP
        IF to_regprocedure(v_signature) IS NULL THEN
            RAISE EXCEPTION
                'Migration 230 requires exact resolver signature %',
                v_signature;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_record
        WHERE constraint_record.conrelid = 'public.clients'::REGCLASS
          AND constraint_record.conname = 'clients_unique_identity'
          AND constraint_record.contype = 'u'
          AND pg_get_constraintdef(constraint_record.oid) =
              'UNIQUE (name, date_of_birth)'
    ) THEN
        RAISE EXCEPTION
            'Migration 230 requires the exact legacy client identity gate';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger AS trigger_record
        WHERE trigger_record.tgrelid = 'public.samples'::REGCLASS
          AND trigger_record.tgname = 'sync_samples_client_name'
          AND trigger_record.tgfoid =
              'public.sync_client_name_snapshot()'::REGPROCEDURE
          AND NOT trigger_record.tgisinternal
          AND trigger_record.tgenabled = 'O'
          AND pg_get_triggerdef(trigger_record.oid) ILIKE
              '%BEFORE INSERT OR UPDATE OF client_id ON public.samples%'
    ) THEN
        RAISE EXCEPTION
            'Migration 230 requires the complete client-name snapshot trigger';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.clients AS client
        WHERE client.normalized_name IS DISTINCT FROM
                public.normalize_client_name_v1(client.name)
           OR client.normalized_phone IS DISTINCT FROM
                public.normalize_client_phone_v1(client.phone)
           OR client.government_identity_value IS DISTINCT FROM
                public.normalize_client_government_identity_v1(
                    client.id_card_num
                )
           OR client.government_identity_type IS DISTINCT FROM
                public.classify_client_government_identity_v1(
                    client.id_card_num
                )
    ) THEN
        RAISE EXCEPTION
            'Migration 230 requires reconciled canonical client projections';
    END IF;

    IF has_table_privilege(
        'authenticated',
        'public.clients',
        'UPDATE'
    ) THEN
        RAISE EXCEPTION
            'Migration 230 requires no table-level authenticated client UPDATE';
    END IF;

    FOREACH v_column IN ARRAY ARRAY[
        'id_card_num', 'name', 'date_of_birth', 'gender', 'phone', 'address',
        'health_insurance_num', 'expiry_date'
    ]
    LOOP
        IF NOT has_column_privilege(
            'authenticated',
            'public.clients',
            v_column,
            'UPDATE'
        ) THEN
            RAISE EXCEPTION
                'Migration 230 requires pre-gate authenticated UPDATE on %',
                v_column;
        END IF;
    END LOOP;

    v_security_test := to_regprocedure(
        'public.test_client_resolution_sample_cutover_security()'
    );
    IF v_security_test IS NULL THEN
        RAISE EXCEPTION
            'Migration 230 requires the Phase 6 cutover security test';
    END IF;

    SELECT
        function_record.proowner,
        function_record.provolatile,
        function_record.proconfig,
        EXISTS (
            SELECT 1
            FROM aclexplode(
                COALESCE(
                    function_record.proacl,
                    acldefault('f', function_record.proowner)
                )
            ) AS privilege
            WHERE privilege.grantee = 0
              AND privilege.privilege_type = 'EXECUTE'
        )
    INTO
        v_security_test_owner,
        v_security_test_volatility,
        v_security_test_settings,
        v_public_execute
    FROM pg_proc AS function_record
    WHERE function_record.oid = v_security_test;

    IF v_security_test_volatility IS DISTINCT FROM 's'
       OR NOT (
           'search_path=public, extensions' =
           ANY(COALESCE(v_security_test_settings, ARRAY[]::TEXT[]))
       )
       OR v_public_execute
       OR NOT has_function_privilege(
           'authenticated',
           v_security_test,
           'EXECUTE'
       )
       OR has_function_privilege('anon', v_security_test, 'EXECUTE')
       OR has_function_privilege('service_role', v_security_test, 'EXECUTE')
    THEN
        RAISE EXCEPTION
            'Migration 230 found incompatible cutover security test metadata';
    END IF;

    PERFORM set_config(
        'lims.migration230_security_test_owner',
        v_security_test_owner::TEXT,
        TRUE
    );

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    IF v_runner_definition NOT LIKE
       '%Verifies analyst-only transactional client/sample RPCs, minimal grants, fixed search_path, locked client-name snapshot, and reversible legacy gate preservation%'
    THEN
        RAISE EXCEPTION
            'Migration 230 requires the reversible cutover runner description';
    END IF;

    IF obj_description(v_security_test::OID, 'pg_proc') IS DISTINCT FROM
       'Verifies Phase 6 transactional client/sample RPC authorization, grants, search_path, trigger, and reversible-gate baseline.'
    THEN
        RAISE EXCEPTION
            'Migration 230 requires the reversible cutover function comment';
    END IF;
END;
$baseline$;

ALTER TABLE public.clients
    DROP CONSTRAINT clients_unique_identity;

REVOKE UPDATE (
    id_card_num,
    name,
    date_of_birth
) ON public.clients FROM authenticated;

CREATE OR REPLACE FUNCTION public.test_client_resolution_sample_cutover_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_signature TEXT;
    v_function REGPROCEDURE;
    v_definition TEXT;
    v_settings TEXT[];
    v_security_definer BOOLEAN;
    v_public_execute BOOLEAN;
    v_column TEXT;
BEGIN
    IF has_table_privilege(
        'authenticated',
        'public.clients',
        'UPDATE'
    ) THEN
        RETURN FALSE;
    END IF;

    FOREACH v_column IN ARRAY ARRAY[
        'id_card_num', 'name', 'date_of_birth'
    ]
    LOOP
        IF has_column_privilege(
            'authenticated',
            'public.clients',
            v_column,
            'UPDATE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_column IN ARRAY ARRAY[
        'gender', 'phone', 'address', 'health_insurance_num', 'expiry_date'
    ]
    LOOP
        IF NOT has_column_privilege(
            'authenticated',
            'public.clients',
            v_column,
            'UPDATE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY ARRAY[
        'public.create_sample_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,uuid,boolean,bigint)',
        'public.accession_and_assign_tests_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,jsonb,uuid,boolean,bigint)'
    ]
    LOOP
        v_function := to_regprocedure(v_signature);
        IF v_function IS NULL
           OR NOT has_function_privilege(
               'authenticated',
               v_function,
               'EXECUTE'
           )
           OR has_function_privilege('anon', v_function, 'EXECUTE')
           OR has_function_privilege(
               'service_role',
               v_function,
               'EXECUTE'
           )
        THEN
            RETURN FALSE;
        END IF;

        SELECT
            function_record.prosecdef,
            function_record.proconfig,
            pg_get_functiondef(function_record.oid),
            EXISTS (
                SELECT 1
                FROM aclexplode(
                    COALESCE(
                        function_record.proacl,
                        acldefault('f', function_record.proowner)
                    )
                ) AS privilege
                WHERE privilege.grantee = 0
                  AND privilege.privilege_type = 'EXECUTE'
            )
        INTO
            v_security_definer,
            v_settings,
            v_definition,
            v_public_execute
        FROM pg_proc AS function_record
        WHERE function_record.oid = v_function;

        IF NOT v_security_definer
           OR v_public_execute
           OR NOT (
               'search_path=public, extensions' =
               ANY(COALESCE(v_settings, ARRAY[]::TEXT[]))
           )
           OR v_definition NOT ILIKE
              '%get_user_role()::TEXT IS DISTINCT FROM ''analyst''%'
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    v_function := to_regprocedure(
        'public.resolve_and_lock_accession_client_v2_228(boolean,text,text,text,date,text,text,text,text,date)'
    );
    IF v_function IS NULL
       OR has_function_privilege(
           'authenticated',
           v_function,
           'EXECUTE'
       )
       OR has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('service_role', v_function, 'EXECUTE')
    THEN
        RETURN FALSE;
    END IF;

    RETURN NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_record
        WHERE constraint_record.conrelid = 'public.clients'::REGCLASS
          AND constraint_record.conname = 'clients_unique_identity'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_trigger AS trigger_record
        WHERE trigger_record.tgrelid = 'public.samples'::REGCLASS
          AND trigger_record.tgname = 'sync_samples_client_name'
          AND trigger_record.tgfoid =
              'public.sync_client_name_snapshot()'::REGPROCEDURE
          AND NOT trigger_record.tgisinternal
          AND trigger_record.tgenabled = 'O'
          AND pg_get_triggerdef(trigger_record.oid) ILIKE
              '%BEFORE INSERT OR UPDATE OF client_id ON public.samples%'
    );
END;
$$;

REVOKE ALL ON FUNCTION
    public.test_client_resolution_sample_cutover_security()
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
    public.test_client_resolution_sample_cutover_security()
TO authenticated;

DO $update_security_test$
DECLARE
    v_definition TEXT;
    v_old_description TEXT :=
        'Verifies analyst-only transactional client/sample RPCs, minimal grants, fixed search_path, locked client-name snapshot, and reversible legacy gate preservation';
    v_new_description TEXT :=
        'Verifies analyst-only transactional client/sample RPCs, minimal grants, fixed search_path, locked client-name snapshot, post-retirement identity-column protection and legacy constraint removal';
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;

    IF v_definition NOT LIKE '%' || v_old_description || '%'
       OR v_definition LIKE '%' || v_new_description || '%'
    THEN
        RAISE EXCEPTION
            'Migration 230 could not locate the reversible runner description';
    END IF;

    EXECUTE replace(v_definition, v_old_description, v_new_description);
END;
$update_security_test$;

COMMENT ON FUNCTION
    public.test_client_resolution_sample_cutover_security()
IS 'Verifies Phase 6 transactional client/sample RPC authorization, grants, search_path, snapshot trigger, post-retirement identity-column protection, and legacy constraint removal.';

DO $verify$
DECLARE
    v_column TEXT;
    v_security_test REGPROCEDURE;
    v_security_test_owner OID;
    v_security_test_volatility "char";
    v_security_test_settings TEXT[];
    v_public_execute BOOLEAN;
    v_runner_definition TEXT;
    v_old_description TEXT :=
        'Verifies analyst-only transactional client/sample RPCs, minimal grants, fixed search_path, locked client-name snapshot, and reversible legacy gate preservation';
    v_new_description TEXT :=
        'Verifies analyst-only transactional client/sample RPCs, minimal grants, fixed search_path, locked client-name snapshot, post-retirement identity-column protection and legacy constraint removal';
    v_security_test_passed BOOLEAN;
    v_all_security_tests_passed BOOLEAN;
    v_registered_security_test_passed BOOLEAN;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_record
        WHERE constraint_record.conrelid = 'public.clients'::REGCLASS
          AND constraint_record.conname = 'clients_unique_identity'
    ) THEN
        RAISE EXCEPTION
            'Migration 230 failed to remove the legacy client identity gate';
    END IF;

    IF has_table_privilege(
        'authenticated',
        'public.clients',
        'UPDATE'
    ) THEN
        RAISE EXCEPTION
            'Migration 230 left table-level authenticated client UPDATE';
    END IF;

    FOREACH v_column IN ARRAY ARRAY[
        'id_card_num', 'name', 'date_of_birth'
    ]
    LOOP
        IF has_column_privilege(
            'authenticated',
            'public.clients',
            v_column,
            'UPDATE'
        ) THEN
            RAISE EXCEPTION
                'Migration 230 left protected authenticated UPDATE on %',
                v_column;
        END IF;
    END LOOP;

    FOREACH v_column IN ARRAY ARRAY[
        'gender', 'phone', 'address', 'health_insurance_num', 'expiry_date'
    ]
    LOOP
        IF NOT has_column_privilege(
            'authenticated',
            'public.clients',
            v_column,
            'UPDATE'
        ) THEN
            RAISE EXCEPTION
                'Migration 230 removed approved authenticated UPDATE on %',
                v_column;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger AS trigger_record
        WHERE trigger_record.tgrelid = 'public.samples'::REGCLASS
          AND trigger_record.tgname = 'sync_samples_client_name'
          AND trigger_record.tgfoid =
              'public.sync_client_name_snapshot()'::REGPROCEDURE
          AND NOT trigger_record.tgisinternal
          AND trigger_record.tgenabled = 'O'
          AND pg_get_triggerdef(trigger_record.oid) ILIKE
              '%BEFORE INSERT OR UPDATE OF client_id ON public.samples%'
    ) THEN
        RAISE EXCEPTION
            'Migration 230 changed the client-name snapshot trigger';
    END IF;

    v_security_test := to_regprocedure(
        'public.test_client_resolution_sample_cutover_security()'
    );

    SELECT
        function_record.proowner,
        function_record.provolatile,
        function_record.proconfig,
        EXISTS (
            SELECT 1
            FROM aclexplode(
                COALESCE(
                    function_record.proacl,
                    acldefault('f', function_record.proowner)
                )
            ) AS privilege
            WHERE privilege.grantee = 0
              AND privilege.privilege_type = 'EXECUTE'
        )
    INTO
        v_security_test_owner,
        v_security_test_volatility,
        v_security_test_settings,
        v_public_execute
    FROM pg_proc AS function_record
    WHERE function_record.oid = v_security_test;

    IF v_security_test IS NULL
       OR v_security_test_owner::TEXT IS DISTINCT FROM
          current_setting('lims.migration230_security_test_owner')
       OR v_security_test_volatility IS DISTINCT FROM 's'
       OR NOT (
           'search_path=public, extensions' =
           ANY(COALESCE(v_security_test_settings, ARRAY[]::TEXT[]))
       )
       OR v_public_execute
       OR NOT has_function_privilege(
           'authenticated',
           v_security_test,
           'EXECUTE'
       )
       OR has_function_privilege('anon', v_security_test, 'EXECUTE')
       OR has_function_privilege('service_role', v_security_test, 'EXECUTE')
    THEN
        RAISE EXCEPTION
            'Migration 230 changed cutover security test metadata';
    END IF;

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    IF v_runner_definition NOT LIKE '%' || v_new_description || '%'
       OR v_runner_definition LIKE '%' || v_old_description || '%'
       OR obj_description(v_security_test::OID, 'pg_proc') IS DISTINCT FROM
          'Verifies Phase 6 transactional client/sample RPC authorization, grants, search_path, snapshot trigger, post-retirement identity-column protection, and legacy constraint removal.'
    THEN
        RAISE EXCEPTION
            'Migration 230 failed to update retirement security semantics';
    END IF;

    SELECT public.test_client_resolution_sample_cutover_security()
    INTO v_security_test_passed;

    SELECT
        bool_and(passed),
        bool_or(
            test_name = 'Client Resolution Sample Cutover Security'
            AND passed
        )
    INTO
        v_all_security_tests_passed,
        v_registered_security_test_passed
    FROM public.run_security_tests();

    IF NOT COALESCE(v_security_test_passed, FALSE)
       OR NOT COALESCE(v_all_security_tests_passed, FALSE)
       OR NOT COALESCE(v_registered_security_test_passed, FALSE)
    THEN
        RAISE EXCEPTION
            'Migration 230 post-retirement security verification failed';
    END IF;
END;
$verify$;

COMMIT;
