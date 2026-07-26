-- DARK APPROVAL BATCH CONTRACTS SCHEMA AND SECURITY CONTRACT
-- Run after migrations 194 and 195 through the approved home-server Docker path.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE approval_batch_schema_assertions (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.assert_approval_batch_schema(
    p_test_name TEXT,
    p_condition BOOLEAN,
    p_detail TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO approval_batch_schema_assertions
    VALUES (p_test_name, COALESCE(p_condition, FALSE), p_detail);
END;
$$;


DO $catalog$
DECLARE
    v_function REGPROCEDURE;
    v_function_definition TEXT;
    v_function_config TEXT[];
    v_runner_definition TEXT;
BEGIN
    PERFORM pg_temp.assert_approval_batch_schema(
        'storage_catalog_remains_exact',
        public.approval_batch_storage_catalog_is_exact(),
        'Migration 195 must preserve the exact migration 194 storage catalog'
    );

    FOREACH v_function IN ARRAY ARRAY[
        to_regprocedure(
            'public.create_approval_batch_server('
            'uuid,uuid,text,uuid[],text,uuid,'
            'timestamp with time zone,text)'
        ),
        to_regprocedure(
            'public.retry_failed_approval_batch_server('
            'uuid,uuid,uuid,uuid,timestamp with time zone,text)'
        ),
        to_regprocedure('public.get_approval_batch_progress(uuid)'),
        to_regprocedure(
            'public.get_approval_batch_outcomes(uuid,integer,integer)'
        )
    ]
    LOOP
        IF v_function IS NULL THEN
            RAISE EXCEPTION 'Migration 194 batch contract function is missing';
        END IF;

        SELECT
            pg_get_functiondef(p.oid),
            p.proconfig
        INTO v_function_definition, v_function_config
        FROM pg_proc AS p
        WHERE p.oid = v_function;

        PERFORM pg_temp.assert_approval_batch_schema(
            v_function::TEXT || '_security_definer',
            v_function_definition ILIKE '%SECURITY DEFINER%',
            'Every public batch contract must be SECURITY DEFINER'
        );

        PERFORM pg_temp.assert_approval_batch_schema(
            v_function::TEXT || '_search_path',
            COALESCE(v_function_config, ARRAY[]::TEXT[])
                @> ARRAY['search_path=public, extensions, pg_temp'],
            'Every public batch contract must pin search_path'
        );
    END LOOP;
    PERFORM pg_temp.assert_approval_batch_schema(
        'server_only_mutation_grants',
        has_function_privilege(
            'service_role',
            'public.create_approval_batch_server('
            'uuid,uuid,text,uuid[],text,uuid,'
            'timestamp with time zone,text)',
            'EXECUTE'
        )
        AND has_function_privilege(
            'service_role',
            'public.retry_failed_approval_batch_server('
            'uuid,uuid,uuid,uuid,timestamp with time zone,text)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            'public.create_approval_batch_server('
            'uuid,uuid,text,uuid[],text,uuid,'
            'timestamp with time zone,text)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'authenticated',
            'public.create_approval_batch_server('
            'uuid,uuid,text,uuid[],text,uuid,'
            'timestamp with time zone,text)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            'public.retry_failed_approval_batch_server('
            'uuid,uuid,uuid,uuid,timestamp with time zone,text)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'authenticated',
            'public.retry_failed_approval_batch_server('
            'uuid,uuid,uuid,uuid,timestamp with time zone,text)',
            'EXECUTE'
        ),
        'Only service_role may execute batch mutation contracts'
    );

    PERFORM pg_temp.assert_approval_batch_schema(
        'authenticated_owner_read_grants',
        has_function_privilege(
            'authenticated',
            'public.approval_batch_owner_can_read(uuid)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            'public.approval_batch_owner_can_read(uuid)',
            'EXECUTE'
        )
        AND has_function_privilege(
            'authenticated',
            'public.get_approval_batch_progress(uuid)',
            'EXECUTE'
        )
        AND has_function_privilege(
            'authenticated',
            'public.get_approval_batch_outcomes(uuid,integer,integer)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            'public.get_approval_batch_progress(uuid)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'service_role',
            'public.get_approval_batch_progress(uuid)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            'public.get_approval_batch_outcomes(uuid,integer,integer)',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'service_role',
            'public.get_approval_batch_outcomes(uuid,integer,integer)',
            'EXECUTE'
        ),
        'Only authenticated callers may execute owner-scoped reads'
    );

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_runner_definition;

    PERFORM pg_temp.assert_approval_batch_schema(
        'registered_security_contract',
        to_regprocedure(
            'public.test_approval_batch_persistence_security()'
        ) IS NOT NULL
        AND has_function_privilege(
            'authenticated',
            'public.test_approval_batch_persistence_security()',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'anon',
            'public.test_approval_batch_persistence_security()',
            'EXECUTE'
        )
        AND NOT has_function_privilege(
            'service_role',
            'public.test_approval_batch_persistence_security()',
            'EXECUTE'
        )
        AND v_runner_definition ILIKE
            '%Approval Batch Persistence Security%'
        AND EXISTS (
            SELECT 1
            FROM public.run_security_tests()
            WHERE test_name = 'Approval Batch Persistence Security'
              AND passed
        ),
        'Migration 194 security coverage must be registered and passing'
    );
END;
$catalog$;


DO $final$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(
        test_name || ': ' || detail,
        E'\n'
        ORDER BY test_name
    )
    INTO v_failed
    FROM approval_batch_schema_assertions
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION
            'Approval batch schema tests failed:%',
            E'\n' || v_failed;
    END IF;
END;
$final$;

ROLLBACK;
SELECT 'approval-batch-contracts-schema: ok' AS result;
