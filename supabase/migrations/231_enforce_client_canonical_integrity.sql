-- Enforce canonical client projection integrity after migration 230.
-- Security impact: authenticated callers retain the exact post-230 RLS and
-- least-privilege ACL; canonical projection writes fail closed at the table
-- constraint boundary, while resolver and lifecycle RPC grants are preserved.
-- Historical data impact: zero intended row mutation; the migration validates
-- existing rows and adds one CHECK constraint only.
-- Irreversible: recovery uses a later forward-only migration; migration 230
-- remains immutable and name/date-of-birth uniqueness is never restored.
-- Migration 230 SHA-256:
-- 2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb
-- Existing lifecycle audit failures use ERRCODE = 'P1116'.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_signature TEXT;
    v_projection_drift BIGINT;
    v_trusted_duplicates BIGINT;
    v_candidate_pairs BIGINT;
    v_definition TEXT;
    v_operation TEXT;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.resolve_client_identity_v2(text,text,text,date,text)',
        'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)',
        'public.sync_client_name_snapshot()',
        'public.test_client_resolution_sample_cutover_security()',
        'public.run_security_tests()'
    ]
    LOOP
        IF to_regprocedure(v_signature) IS NULL THEN
            RAISE EXCEPTION
                'Migration 231 requires post-230 function %',
                v_signature;
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.clients'::REGCLASS
          AND conname = 'clients_unique_identity'
    ) THEN
        RAISE EXCEPTION
            'Migration 231 found the retired clients_unique_identity constraint';
    END IF;

    IF to_regclass('public.clients_unique_trusted_government_identity') IS NULL
       OR pg_get_indexdef(
            'public.clients_unique_trusted_government_identity'::REGCLASS
          ) NOT ILIKE '%UNIQUE INDEX%'
       OR pg_get_indexdef(
            'public.clients_unique_trusted_government_identity'::REGCLASS
          ) NOT ILIKE '%government_identity_type%'
       OR pg_get_indexdef(
            'public.clients_unique_trusted_government_identity'::REGCLASS
          ) NOT ILIKE '%government_identity_value%'
       OR pg_get_indexdef(
            'public.clients_unique_trusted_government_identity'::REGCLASS
          ) NOT ILIKE '%government_identity_trusted%'
       OR pg_get_indexdef(
            'public.clients_unique_trusted_government_identity'::REGCLASS
          ) NOT ILIKE '%government_identity_value IS NOT NULL%'
    THEN
        RAISE EXCEPTION
            'Migration 231 found an invalid trusted identity index';
    END IF;

    SELECT count(*)
    INTO v_projection_drift
    FROM public.clients AS client
    WHERE client.normalized_name IS DISTINCT FROM
              public.normalize_client_name_v1(client.name)
       OR client.normalized_phone IS DISTINCT FROM
              public.normalize_client_phone_v1(client.phone)
       OR client.government_identity_value IS DISTINCT FROM
              public.normalize_client_government_identity_v1(client.id_card_num)
       OR client.government_identity_type IS DISTINCT FROM
              public.classify_client_government_identity_v1(client.id_card_num)
       OR client.government_identity_trusted IS DISTINCT FROM (
              public.normalize_client_government_identity_v1(client.id_card_num)
                  IS NOT NULL
          );

    IF v_projection_drift <> 0 THEN
        RAISE EXCEPTION
            'Migration 231 found % canonical projection mismatches',
            v_projection_drift;
    END IF;

    SELECT count(*)
    INTO v_trusted_duplicates
    FROM (
        SELECT government_identity_type, government_identity_value
        FROM public.clients
        WHERE government_identity_trusted
          AND government_identity_value IS NOT NULL
        GROUP BY government_identity_type, government_identity_value
        HAVING count(*) > 1
    ) AS duplicates;

    WITH candidate_pairs AS (
        SELECT
            first_client.id AS first_client_id,
            second_client.id AS second_client_id,
            collision.collision_type
        FROM public.clients AS first_client
        JOIN public.clients AS second_client
          ON first_client.id < second_client.id
        CROSS JOIN LATERAL (
            VALUES
                (
                    'government_identity'::TEXT,
                    first_client.government_identity_trusted
                    AND second_client.government_identity_trusted
                    AND first_client.government_identity_type =
                        second_client.government_identity_type
                    AND first_client.government_identity_value =
                        second_client.government_identity_value
                ),
                (
                    'phone'::TEXT,
                    first_client.normalized_phone IS NOT NULL
                    AND first_client.normalized_phone =
                        second_client.normalized_phone
                ),
                (
                    'name_date_of_birth'::TEXT,
                    first_client.normalized_name IS NOT NULL
                    AND first_client.normalized_name =
                        second_client.normalized_name
                    AND first_client.date_of_birth =
                        second_client.date_of_birth
                )
        ) AS collision(collision_type, is_match)
        WHERE collision.is_match
    )
    SELECT count(*)
    INTO v_candidate_pairs
    FROM candidate_pairs
    WHERE NOT public.is_client_collision_confirmed_distinct_v1(
        first_client_id,
        second_client_id,
        collision_type
    );

    IF v_trusted_duplicates <> 0 OR v_candidate_pairs <> 0 THEN
        RAISE EXCEPTION
            'Migration 231 found % trusted duplicates and % unresolved candidate pairs',
            v_trusted_duplicates,
            v_candidate_pairs;
    END IF;

    IF has_table_privilege('authenticated', 'public.clients', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.clients', 'DELETE')
       OR has_table_privilege('authenticated', 'public.clients', 'TRUNCATE')
    THEN
        RAISE EXCEPTION
            'Migration 231 found broadened authenticated client table ACL';
    END IF;

    IF (SELECT count(*) FROM pg_policy
        WHERE polrelid = 'public.clients'::REGCLASS) <> 4
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Authenticated users can read clients'
             AND polcmd = 'r'
             AND lower(pg_get_expr(polqual, polrelid)) LIKE '%auth.uid()%'
             AND lower(pg_get_expr(polqual, polrelid)) LIKE '%is not null%'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Analysts can create clients'
             AND polcmd = 'a'
             AND lower(pg_get_expr(polwithcheck, polrelid))
                     LIKE '%get_user_role()%'
             AND lower(pg_get_expr(polwithcheck, polrelid))
                     LIKE '%analyst%'
             AND lower(pg_get_expr(polwithcheck, polrelid))
                     LIKE '%manager%'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Analysts and managers can update clients'
             AND polcmd = 'w'
             AND lower(pg_get_expr(polqual, polrelid))
                     LIKE '%get_user_role()%'
             AND lower(pg_get_expr(polwithcheck, polrelid))
                     LIKE '%get_user_role()%'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Managers can delete clients'
             AND polcmd = 'd'
             AND lower(pg_get_expr(polqual, polrelid)) LIKE '%manager%'
       )
    THEN
        RAISE EXCEPTION
            'Migration 231 found an unexpected client RLS policy set';
    END IF;

    FOR v_signature, v_operation IN
        SELECT *
        FROM (
            VALUES
                (
                    'public.deactivate_client_v1(uuid,timestamp with time zone,text)',
                    'CLIENT_DEACTIVATED'
                ),
                (
                    'public.restore_client_v1(uuid,timestamp with time zone,text)',
                    'CLIENT_RESTORED'
                ),
                (
                    'public.correct_client_identity_v1(uuid,timestamp with time zone,text,text,date,text,text,text)',
                    'CLIENT_IDENTITY_CORRECTED'
                )
        ) AS lifecycle_contract(signature, operation)
    LOOP
        v_definition := pg_get_functiondef(v_signature::REGPROCEDURE);
        IF v_definition NOT LIKE '%' || v_operation || '%'
           OR v_definition NOT LIKE '%P1116%'
        THEN
            RAISE EXCEPTION
                'Migration 231 found incomplete lifecycle audit contract %',
                v_signature
            USING ERRCODE = 'P1116';
        END IF;
    END LOOP;
END;
$baseline$;

ALTER TABLE public.clients
    ADD CONSTRAINT clients_canonical_projection_check
    CHECK (
        normalized_name IS NOT DISTINCT FROM
            public.normalize_client_name_v1(name)
        AND normalized_phone IS NOT DISTINCT FROM
            public.normalize_client_phone_v1(phone)
        AND government_identity_value IS NOT DISTINCT FROM
            public.normalize_client_government_identity_v1(id_card_num)
        AND government_identity_type IS NOT DISTINCT FROM
            public.classify_client_government_identity_v1(id_card_num)
        AND government_identity_trusted IS NOT DISTINCT FROM (
            public.normalize_client_government_identity_v1(id_card_num)
                IS NOT NULL
        )
    );

CREATE OR REPLACE FUNCTION public.test_client_canonical_integrity_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_column TEXT;
    v_definition TEXT;
    v_function REGPROCEDURE;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.clients'::REGCLASS
          AND conname = 'clients_canonical_projection_check'
    ) THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.clients'::REGCLASS
          AND conname = 'clients_unique_identity'
    ) THEN
        RETURN FALSE;
    END IF;

    IF has_table_privilege('authenticated', 'public.clients', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.clients', 'DELETE')
       OR has_table_privilege('authenticated', 'public.clients', 'TRUNCATE')
    THEN
        RETURN FALSE;
    END IF;

    IF (SELECT count(*) FROM pg_policy
        WHERE polrelid = 'public.clients'::REGCLASS) <> 4
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Authenticated users can read clients'
             AND polcmd = 'r'
             AND lower(pg_get_expr(polqual, polrelid)) LIKE '%auth.uid()%'
             AND lower(pg_get_expr(polqual, polrelid)) LIKE '%is not null%'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Analysts can create clients'
             AND polcmd = 'a'
             AND lower(pg_get_expr(polwithcheck, polrelid))
                     LIKE '%get_user_role()%'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Analysts and managers can update clients'
             AND polcmd = 'w'
             AND lower(pg_get_expr(polqual, polrelid))
                     LIKE '%get_user_role()%'
             AND lower(pg_get_expr(polwithcheck, polrelid))
                     LIKE '%get_user_role()%'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Managers can delete clients'
             AND polcmd = 'd'
             AND lower(pg_get_expr(polqual, polrelid)) LIKE '%manager%'
       )
    THEN
        RETURN FALSE;
    END IF;

    FOREACH v_column IN ARRAY ARRAY[
        'id_card_num', 'name', 'date_of_birth', 'created_at', 'updated_at',
        'search_vector', 'government_identity_type',
        'government_identity_value', 'government_identity_trusted',
        'normalized_name', 'normalized_phone', 'deleted_at', 'deleted_by',
        'deletion_reason'
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

    FOREACH v_function IN ARRAY ARRAY[
        'public.resolve_client_identity_v2(text,text,text,date,text)'::REGPROCEDURE,
        'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)'::REGPROCEDURE
    ]
    LOOP
        IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE')
           OR has_function_privilege('anon', v_function, 'EXECUTE')
           OR has_function_privilege('service_role', v_function, 'EXECUTE')
        THEN
            RETURN FALSE;
        END IF;

        SELECT pg_get_functiondef(v_function)
        INTO v_definition
        FROM pg_proc
        WHERE oid = v_function;

        IF v_definition NOT LIKE '%SET search_path = public, extensions%'
           OR v_definition NOT LIKE '%get_user_role%'
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY ARRAY[
        'public.deactivate_client_v1(uuid,timestamp with time zone,text)'::REGPROCEDURE,
        'public.restore_client_v1(uuid,timestamp with time zone,text)'::REGPROCEDURE,
        'public.correct_client_identity_v1(uuid,timestamp with time zone,text,text,date,text,text,text)'::REGPROCEDURE
    ]
    LOOP
        SELECT pg_get_functiondef(v_function)
        INTO v_definition
        FROM pg_proc
        WHERE oid = v_function;

        IF v_definition NOT LIKE '%P1116%'
           OR v_definition NOT LIKE '%CLIENT_%'
        THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION
    public.test_client_canonical_integrity_security()
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION
    public.test_client_canonical_integrity_security()
TO authenticated;

COMMENT ON FUNCTION
    public.test_client_canonical_integrity_security()
IS 'Verifies canonical client projections, trusted identity uniqueness, post-230 ACL, resolver grants, fixed search_path, and lifecycle audit contracts.';

DO $register_security_test$
DECLARE
    v_definition TEXT;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;

    IF v_definition NOT LIKE
       '%test_client_resolution_sample_cutover_security()%'
    THEN
        RAISE EXCEPTION
            'Migration 231 cannot register the canonical client security test';
    END IF;

    v_definition := replace(
        v_definition,
        'test_client_resolution_sample_cutover_security()',
        'test_client_resolution_sample_cutover_security() AND test_client_canonical_integrity_security()'
    );
    EXECUTE v_definition;
END;
$register_security_test$;

DO $verify$
DECLARE
    v_definition TEXT;
    v_column TEXT;
    v_all_security_tests_passed BOOLEAN;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.clients'::REGCLASS
          AND conname = 'clients_canonical_projection_check'
    ) THEN
        RAISE EXCEPTION
            'Migration 231 failed to create canonical projection guard';
    END IF;

    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)
    INTO v_definition;
    IF v_definition NOT LIKE '%test_client_canonical_integrity_security()%'
    THEN
        RAISE EXCEPTION
            'Migration 231 failed to register canonical client security test';
    END IF;

    IF has_table_privilege('authenticated', 'public.clients', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.clients', 'DELETE')
       OR has_table_privilege('authenticated', 'public.clients', 'TRUNCATE')
    THEN
        RAISE EXCEPTION
            'Migration 231 changed protected client table ACL';
    END IF;

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
                'Migration 231 removed approved client UPDATE on %',
                v_column;
        END IF;
    END LOOP;

    SELECT bool_and(passed)
    INTO v_all_security_tests_passed
    FROM public.run_security_tests();

    IF NOT COALESCE(v_all_security_tests_passed, FALSE)
    THEN
        RAISE EXCEPTION
            'Migration 231 security verification failed';
    END IF;
END;
$verify$;

COMMIT;
