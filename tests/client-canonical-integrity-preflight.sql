-- Gate A read-only preflight for canonical client integrity enforcement.
-- Security impact: this script only reads catalog/data state and fails closed
-- before any forward-only enforcement migration is attempted.
-- Historical data impact: zero; no persistent rows or schema objects are changed.

\set ON_ERROR_STOP on
\set expected_migration_230_sha '2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb'

BEGIN READ ONLY;
SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_signature TEXT;
    v_column TEXT;
    v_policy_count BIGINT;
    v_projection_drift BIGINT;
    v_trusted_duplicates BIGINT;
    v_candidate_pairs BIGINT;
    v_all_security_tests_passed BOOLEAN;
BEGIN
    IF to_regclass('public.clients') IS NULL
       OR to_regclass('public.samples') IS NULL
       OR to_regclass('public.audit_logs') IS NULL
       OR to_regclass('public.client_collision_adjudications') IS NULL
    THEN
        RAISE EXCEPTION 'Gate A preflight missing required client baseline';
    END IF;

    FOREACH v_signature IN ARRAY ARRAY[
        'public.resolve_client_identity_v2(text,text,text,date,text)',
        'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)',
        'public.deactivate_client_v1(uuid,timestamp with time zone,text)',
        'public.restore_client_v1(uuid,timestamp with time zone,text)',
        'public.correct_client_identity_v1(uuid,timestamp with time zone,text,text,date,text,text,text)',
        'public.is_client_collision_confirmed_distinct_v1(uuid,uuid,text)',
        'public.test_client_resolution_sample_cutover_security()',
        'public.run_security_tests()'
    ]
    LOOP
        IF to_regprocedure(v_signature) IS NULL THEN
            RAISE EXCEPTION 'Gate A preflight missing function %', v_signature;
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.clients'::REGCLASS
          AND conname = 'clients_unique_identity'
    ) THEN
        RAISE EXCEPTION
            'Gate A preflight found retired clients_unique_identity';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::REGCLASS
          AND tgname = 'sync_samples_client_name'
          AND tgfoid = 'public.sync_client_name_snapshot()'::REGPROCEDURE
          AND tgenabled = 'O'
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION
            'Gate A preflight missing enabled sync_samples_client_name';
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
    THEN
        RAISE EXCEPTION
            'Gate A preflight found an invalid trusted identity index';
    END IF;

    IF to_regclass('public.idx_clients_normalized_phone') IS NULL
       OR to_regclass('public.idx_clients_normalized_name_dob') IS NULL
    THEN
        RAISE EXCEPTION
            'Gate A preflight missing canonical candidate indexes';
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
            'Gate A preflight found % canonical projection mismatches',
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
            'Gate A preflight found % trusted duplicates and % unresolved candidate pairs',
            v_trusted_duplicates,
            v_candidate_pairs;
    END IF;

    SELECT count(*)
    INTO v_policy_count
    FROM pg_policy
    WHERE polrelid = 'public.clients'::REGCLASS;

    IF v_policy_count <> 4
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Authenticated users can read clients'
             AND polcmd = 'r'
             AND lower(
                 replace(
                     replace(pg_get_expr(polqual, polrelid), ' ', ''),
                     E'\n',
                     ''
                 )
             ) LIKE '%auth.uid()isnotnull%'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Analysts can create clients'
             AND polcmd = 'a'
             AND lower(replace(pg_get_expr(polqual, polrelid), ' ', ''))
                     LIKE '%get_user_role()%'
             AND lower(replace(pg_get_expr(polqual, polrelid), ' ', ''))
                     LIKE '%analyst%'
             AND lower(replace(pg_get_expr(polqual, polrelid), ' ', ''))
                     LIKE '%manager%'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Analysts and managers can update clients'
             AND polcmd = 'w'
             AND lower(replace(pg_get_expr(polqual, polrelid), ' ', ''))
                     LIKE '%get_user_role()%'
             AND lower(replace(pg_get_expr(polwithcheck, polrelid), ' ', ''))
                     LIKE '%get_user_role()%'
       )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_policy
           WHERE polrelid = 'public.clients'::REGCLASS
             AND polname = 'Managers can delete clients'
             AND polcmd = 'd'
             AND lower(replace(pg_get_expr(polqual, polrelid), ' ', ''))
                     LIKE '%manager%'
       )
    THEN
        RAISE EXCEPTION
            'Gate A preflight found an unexpected client RLS policy set';
    END IF;

    IF NOT has_table_privilege('authenticated', 'public.clients', 'SELECT')
       OR NOT has_table_privilege('authenticated', 'public.clients', 'INSERT')
       OR has_table_privilege('authenticated', 'public.clients', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.clients', 'DELETE')
       OR has_table_privilege('authenticated', 'public.clients', 'TRUNCATE')
    THEN
        RAISE EXCEPTION 'Gate A preflight found an invalid client table ACL';
    END IF;

    FOREACH v_column IN ARRAY ARRAY[
        'id', 'id_card_num', 'name', 'date_of_birth', 'created_at',
        'updated_at', 'search_vector', 'government_identity_type',
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
            RAISE EXCEPTION
                'Gate A preflight found protected UPDATE on %',
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
                'Gate A preflight removed approved UPDATE on %',
                v_column;
        END IF;
    END LOOP;

    SELECT bool_and(passed)
    INTO v_all_security_tests_passed
    FROM public.run_security_tests();

    IF NOT COALESCE(v_all_security_tests_passed, FALSE)
       OR NOT public.test_client_resolution_sample_cutover_security()
    THEN
        RAISE EXCEPTION
            'Gate A preflight found a failed registered security test';
    END IF;
END;
$baseline$;

SELECT
    current_database() AS database_name,
    clock_timestamp() AS database_timestamp,
    :'expected_migration_230_sha' AS expected_migration_230_sha,
    (SELECT count(*) FROM public.clients) AS client_rows,
    (SELECT count(*) FROM public.samples) AS sample_rows,
    (SELECT count(*) FROM public.results) AS result_rows,
    (
        SELECT count(*)
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
              )
    ) AS projection_drift;

SELECT 'gate-a-preflight passed' AS result;
ROLLBACK;
