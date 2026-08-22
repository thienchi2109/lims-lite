\set ON_ERROR_STOP on

BEGIN;

DO $test$
DECLARE
    v_allowed TEXT;
    v_protected TEXT;
BEGIN
    IF has_table_privilege(
        'authenticated', 'public.clients', 'UPDATE,DELETE,TRUNCATE'
    ) THEN
        RAISE EXCEPTION 'broad client mutation privileges remain';
    END IF;

    FOREACH v_allowed IN ARRAY ARRAY[
        'id_card_num', 'name', 'date_of_birth', 'gender', 'phone', 'address',
        'health_insurance_num', 'expiry_date'
    ]
    LOOP
        IF NOT has_column_privilege(
            'authenticated', 'public.clients', v_allowed, 'UPDATE'
        ) THEN
            RAISE EXCEPTION 'allowed client update missing: %', v_allowed;
        END IF;
    END LOOP;

    FOREACH v_protected IN ARRAY ARRAY[
        'deleted_at', 'deleted_by', 'deletion_reason',
        'identity_trust_level', 'identity_verified_at',
        'identity_verified_by', 'canonical_source_updated_at',
        'normalized_government_identity', 'normalized_name', 'normalized_phone'
    ]
    LOOP
        IF has_column_privilege(
            'authenticated', 'public.clients', v_protected, 'UPDATE'
        ) THEN
            RAISE EXCEPTION 'protected client update remains: %', v_protected;
        END IF;
    END LOOP;
END;
$test$;

SELECT 'client lifecycle guard rollback tests passed' AS result;

ROLLBACK;
