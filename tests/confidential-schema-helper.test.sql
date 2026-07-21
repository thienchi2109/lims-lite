-- ============================================================================
-- CONFIDENTIAL SCHEMA AND HELPER REGRESSION TEST SUITE
-- ============================================================================
-- Verifies the Batch 1 schema primitives for confidential assay controls:
--   1. public.assay_definitions.is_confidential
--   2. public.users.can_access_confidential
--   3. public.user_can_access_confidential()
--
-- Usage:
--   docker exec -i lims-postgres psql -U postgres -d postgres < tests/confidential-schema-helper.test.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'CONFIDENTIAL SCHEMA AND HELPER TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

DO $$
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (
            '90000090-0005-4000-8000-000000000001',
            'issue-90-confidential-analyst@lims.local'
        ),
        (
            '90000090-0005-4000-8000-000000000002',
            'issue-90-confidential-manager@lims.local'
        );

    INSERT INTO public.users (id, username, full_name, role)
    VALUES
        (
            '90000090-0005-4000-8000-000000000001',
            'issue_90_confidential_analyst',
            'Issue 90 Confidential Analyst',
            'analyst'
        ),
        (
            '90000090-0005-4000-8000-000000000002',
            'issue_90_confidential_manager',
            'Issue 90 Confidential Manager',
            'manager'
        );
END $$;

CREATE TEMP TABLE confidential_batch1_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
    v_data_type TEXT;
    v_is_nullable TEXT;
    v_column_default TEXT;
BEGIN
    BEGIN
        EXECUTE 'SELECT is_confidential FROM public.assay_definitions LIMIT 1';
    EXCEPTION
        WHEN undefined_column THEN
            INSERT INTO confidential_batch1_test_results
            VALUES (
                'assay_definitions.is_confidential',
                FALSE,
                format('missing column (%s)', SQLERRM)
            );
            RETURN;
    END;

    SELECT
        data_type,
        is_nullable,
        column_default
    INTO
        v_data_type,
        v_is_nullable,
        v_column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assay_definitions'
      AND column_name = 'is_confidential';

    IF v_data_type IS DISTINCT FROM 'boolean' THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'assay_definitions.is_confidential',
            FALSE,
            format('expected boolean, found %s', coalesce(v_data_type, '<missing metadata>'))
        );
        RETURN;
    END IF;

    IF v_is_nullable IS DISTINCT FROM 'NO' THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'assay_definitions.is_confidential',
            FALSE,
            format('expected NOT NULL, found is_nullable=%s', coalesce(v_is_nullable, '<missing metadata>'))
        );
        RETURN;
    END IF;

    IF coalesce(v_column_default, '') NOT IN ('false', 'FALSE', 'false::boolean') THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'assay_definitions.is_confidential',
            FALSE,
            format('expected DEFAULT FALSE, found %s', coalesce(v_column_default, '<missing default>'))
        );
        RETURN;
    END IF;

    INSERT INTO confidential_batch1_test_results
    VALUES (
        'assay_definitions.is_confidential',
        TRUE,
        format('boolean NOT NULL DEFAULT %s', v_column_default)
    );
END $$;

DO $$
DECLARE
    v_data_type TEXT;
    v_is_nullable TEXT;
    v_column_default TEXT;
BEGIN
    BEGIN
        EXECUTE 'SELECT can_access_confidential FROM public.users LIMIT 1';
    EXCEPTION
        WHEN undefined_column THEN
            INSERT INTO confidential_batch1_test_results
            VALUES (
                'users.can_access_confidential',
                FALSE,
                format('missing column (%s)', SQLERRM)
            );
            RETURN;
    END;

    SELECT
        data_type,
        is_nullable,
        column_default
    INTO
        v_data_type,
        v_is_nullable,
        v_column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'can_access_confidential';

    IF v_data_type IS DISTINCT FROM 'boolean' THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'users.can_access_confidential',
            FALSE,
            format('expected boolean, found %s', coalesce(v_data_type, '<missing metadata>'))
        );
        RETURN;
    END IF;

    IF v_is_nullable IS DISTINCT FROM 'NO' THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'users.can_access_confidential',
            FALSE,
            format('expected NOT NULL, found is_nullable=%s', coalesce(v_is_nullable, '<missing metadata>'))
        );
        RETURN;
    END IF;

    IF coalesce(v_column_default, '') NOT IN ('false', 'FALSE', 'false::boolean') THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'users.can_access_confidential',
            FALSE,
            format('expected DEFAULT FALSE, found %s', coalesce(v_column_default, '<missing default>'))
        );
        RETURN;
    END IF;

    INSERT INTO confidential_batch1_test_results
    VALUES (
        'users.can_access_confidential',
        TRUE,
        format('boolean NOT NULL DEFAULT %s', v_column_default)
    );
END $$;

DO $$
DECLARE
    v_provolatile "char";
    v_prosecdef BOOLEAN;
    v_return_type TEXT;
    v_proconfig TEXT[];
    v_authenticated_can_execute BOOLEAN;
    v_anon_can_execute BOOLEAN;
    v_unauthorized_result BOOLEAN;
    v_authorized_result BOOLEAN;
BEGIN
    BEGIN
        EXECUTE 'SELECT public.user_can_access_confidential()';
    EXCEPTION
        WHEN undefined_function THEN
            INSERT INTO confidential_batch1_test_results
            VALUES (
                'user_can_access_confidential()',
                FALSE,
                format('missing function (%s)', SQLERRM)
            );
            RETURN;
    END;

    SELECT
        p.provolatile,
        p.prosecdef,
        pg_get_function_result(p.oid),
        p.proconfig,
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('anon', p.oid, 'EXECUTE')
    INTO
        v_provolatile,
        v_prosecdef,
        v_return_type,
        v_proconfig,
        v_authenticated_can_execute,
        v_anon_can_execute
    FROM pg_proc p
    INNER JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'user_can_access_confidential'
      AND p.pronargs = 0
    LIMIT 1;

    IF v_return_type IS DISTINCT FROM 'boolean' THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'user_can_access_confidential()',
            FALSE,
            format('expected boolean return type, found %s', coalesce(v_return_type, '<missing metadata>'))
        );
        RETURN;
    END IF;

    IF v_provolatile IS DISTINCT FROM 's' THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'user_can_access_confidential()',
            FALSE,
            format('expected STABLE helper, found provolatile=%s', coalesce(v_provolatile::TEXT, '<missing metadata>'))
        );
        RETURN;
    END IF;

    IF v_prosecdef IS DISTINCT FROM TRUE THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'user_can_access_confidential()',
            FALSE,
            'expected SECURITY DEFINER helper'
        );
        RETURN;
    END IF;

    IF v_proconfig IS DISTINCT FROM
       ARRAY['search_path=public, pg_temp']::TEXT[] THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'user_can_access_confidential()',
            FALSE,
            format(
                'expected proconfig search_path=public, pg_temp, found %s',
                coalesce(v_proconfig::TEXT, 'NULL')
            )
        );
        RETURN;
    END IF;

    IF v_authenticated_can_execute IS DISTINCT FROM TRUE THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'user_can_access_confidential()',
            FALSE,
            'expected authenticated to have EXECUTE'
        );
        RETURN;
    END IF;

    IF v_anon_can_execute IS DISTINCT FROM TRUE THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'user_can_access_confidential()',
            FALSE,
            'expected anon to have EXECUTE'
        );
        RETURN;
    END IF;

    EXECUTE $sql$
        UPDATE public.users
        SET can_access_confidential = CASE
            WHEN id = '90000090-0005-4000-8000-000000000001' THEN FALSE
            WHEN id = '90000090-0005-4000-8000-000000000002' THEN TRUE
            ELSE can_access_confidential
        END
        WHERE id IN (
            '90000090-0005-4000-8000-000000000001',
            '90000090-0005-4000-8000-000000000002'
        )
    $sql$;

    PERFORM set_config(
        'request.jwt.claims',
        '{"sub":"90000090-0005-4000-8000-000000000001","role":"authenticated"}',
        TRUE
    );
    SELECT public.user_can_access_confidential() INTO v_unauthorized_result;

    PERFORM set_config(
        'request.jwt.claims',
        '{"sub":"90000090-0005-4000-8000-000000000002","role":"authenticated"}',
        TRUE
    );
    SELECT public.user_can_access_confidential() INTO v_authorized_result;

    IF v_unauthorized_result IS DISTINCT FROM FALSE THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'user_can_access_confidential()',
            FALSE,
            format('expected unauthorized user to resolve FALSE, found %s', coalesce(v_unauthorized_result::TEXT, 'NULL'))
        );
        RETURN;
    END IF;

    IF v_authorized_result IS DISTINCT FROM TRUE THEN
        INSERT INTO confidential_batch1_test_results
        VALUES (
            'user_can_access_confidential()',
            FALSE,
            format('expected authorized user to resolve TRUE, found %s', coalesce(v_authorized_result::TEXT, 'NULL'))
        );
        RETURN;
    END IF;

    INSERT INTO confidential_batch1_test_results
    VALUES (
        'user_can_access_confidential()',
        TRUE,
        'boolean STABLE SECURITY DEFINER helper pins search_path and grants both API roles'
    );
END $$;

TABLE confidential_batch1_test_results;

DO $$
DECLARE
    v_failures TEXT;
BEGIN
    SELECT string_agg(format('- %s: %s', test_name, detail), E'\n' ORDER BY test_name)
    INTO v_failures
    FROM confidential_batch1_test_results
    WHERE passed = FALSE;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION '✗ CONFIDENTIAL SCHEMA/HELPER TESTS FAILED:%', E'\n' || v_failures;
    END IF;

    RAISE NOTICE '✓ All confidential schema/helper checks passed';
END $$;

ROLLBACK;

SELECT 'confidential-schema-helper: ok' AS result;
