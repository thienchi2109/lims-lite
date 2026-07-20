-- SAMPLE QUALITY ACCESSION SCHEMA AND SECURITY CONTRACT
-- RED until the compatibility migration adds the quality-aware contract.
--
-- Usage from the home-server checkout:
--   sudo -n docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 \
--     -U postgres -d postgres < tests/sample-quality-accession-schema.test.sql
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE sample_quality_schema_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
    v_is_nullable TEXT;
    v_default TEXT;
    v_data_type TEXT;
BEGIN
    SELECT is_nullable, column_default, data_type
    INTO v_is_nullable, v_default, v_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'samples'
      AND column_name = 'sample_quality';

    INSERT INTO sample_quality_schema_results
    VALUES (
        'sample_quality nullable boolean without default',
        coalesce(
            v_data_type = 'boolean'
            AND v_is_nullable = 'YES'
            AND v_default IS NULL,
            FALSE
        ),
        CASE
            WHEN v_is_nullable IS NULL THEN 'missing public.samples.sample_quality'
            ELSE format(
                'data_type=%s is_nullable=%s default=%s',
                v_data_type,
                v_is_nullable,
                coalesce(v_default, '<null>')
            )
        END
    );
END $$;

DO $$
DECLARE
    v_signature TEXT;
    v_definition TEXT;
    v_security_definer BOOLEAN;
    v_settings TEXT[];
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
    ]
    LOOP
        IF to_regprocedure(v_signature) IS NULL THEN
            INSERT INTO sample_quality_schema_results
            VALUES (
                'RPC exists: ' || v_signature,
                FALSE,
                'missing quality-aware RPC signature'
            );
            CONTINUE;
        END IF;

        SELECT p.prosecdef, p.proconfig, pg_get_functiondef(p.oid)
        INTO v_security_definer, v_settings, v_definition
        FROM pg_proc p
        WHERE p.oid = to_regprocedure(v_signature);

        INSERT INTO sample_quality_schema_results
        VALUES (
            'RPC security: ' || v_signature,
            coalesce(v_security_definer
                AND 'search_path=public, extensions' = ANY(v_settings)
                AND v_definition ILIKE '%v_user_role <> ''analyst''%'
                AND v_definition ILIKE '%p_sample_quality%'
                AND v_definition ILIKE '%sample_quality%', FALSE),
            'expected SECURITY DEFINER, fixed search_path, analyst check, and quality persistence'
        );

        INSERT INTO sample_quality_schema_results
        VALUES (
            'RPC grants: ' || v_signature,
            coalesce(has_function_privilege('authenticated', v_signature, 'EXECUTE')
                AND NOT has_function_privilege('anon', v_signature, 'EXECUTE')
                AND NOT EXISTS (
                    SELECT 1
                    FROM pg_proc p
                    CROSS JOIN LATERAL aclexplode(
                        coalesce(p.proacl, acldefault('f', p.proowner))
                    ) privilege
                    WHERE p.oid = to_regprocedure(v_signature)
                      AND privilege.grantee = 0
                      AND privilege.privilege_type = 'EXECUTE'
                ), FALSE),
            'expected authenticated-only execute grant with PUBLIC and anon denied'
        );
    END LOOP;
END $$;

DO $$
DECLARE
    v_baseline_count INTEGER;
    v_baseline_digest TEXT;
    v_baseline_null_count INTEGER := 0;
    v_baseline_null_digest TEXT;
    v_expected_digest CONSTANT TEXT := 'f5fafc11baa361036083bcb4cfc7030a';
BEGIN
    SELECT
        count(*),
        md5(string_agg(id::text, ',' ORDER BY id::text))
    INTO v_baseline_count, v_baseline_digest
    FROM public.samples
    WHERE created_at <= TIMESTAMPTZ '2026-07-20 05:22:46.703401+00';

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'samples'
          AND column_name = 'sample_quality'
    ) THEN
        EXECUTE $query$
            SELECT
                count(*),
                md5(string_agg(id::text, ',' ORDER BY id::text))
            FROM public.samples
            WHERE created_at <= TIMESTAMPTZ '2026-07-20 05:22:46.703401+00'
              AND sample_quality IS NULL
        $query$
        INTO v_baseline_null_count, v_baseline_null_digest;
    END IF;

    INSERT INTO sample_quality_schema_results
    VALUES (
        'all baseline samples remain unassessed',
        v_baseline_count = 80
            AND v_baseline_digest = v_expected_digest
            AND v_baseline_null_count = 80
            AND v_baseline_null_digest = v_expected_digest,
        format(
            'expected count=80 digest=%s; found baseline count=%s digest=%s, NULL count=%s digest=%s',
            v_expected_digest,
            v_baseline_count,
            coalesce(v_baseline_digest, '<null>'),
            v_baseline_null_count,
            coalesce(v_baseline_null_digest, '<null>')
        )
    );
END $$;

TABLE sample_quality_schema_results;

DO $$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(format('%s: %s', test_name, detail), E'\n' ORDER BY test_name)
    INTO v_failed
    FROM sample_quality_schema_results
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION 'Sample quality schema contract tests failed:%', E'\n' || v_failed;
    END IF;
END $$;

ROLLBACK;
