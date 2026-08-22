-- Purpose: Retire direct destructive client mutations after the replacement
-- lifecycle workflow passed production smoke.
-- Security impact: Authenticated callers lose hard DELETE, TRUNCATE, and broad
-- UPDATE. Legacy identity and approved profile fields remain directly editable
-- until the Phase 6 caller cutover. Lifecycle RPCs retain postgres-owned access.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_column TEXT;
BEGIN
    IF to_regclass('public.clients') IS NULL THEN
        RAISE EXCEPTION 'Migration 218 requires public.clients';
    END IF;

    FOREACH v_column IN ARRAY ARRAY[
        'id_card_num', 'name', 'date_of_birth', 'gender', 'phone', 'address',
        'health_insurance_num', 'expiry_date', 'deleted_at', 'deleted_by',
        'deletion_reason', 'identity_trust_level', 'identity_verified_at',
        'identity_verified_by', 'canonical_source_updated_at'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'clients'
              AND column_name = v_column
        ) THEN
            RAISE EXCEPTION 'Migration 218 missing clients column %', v_column;
        END IF;
    END LOOP;

    IF NOT has_table_privilege(
        'authenticated', 'public.clients', 'UPDATE,DELETE,TRUNCATE'
    ) THEN
        RAISE EXCEPTION
            'Migration 218 requires the legacy broad mutation privileges';
    END IF;
END;
$baseline$;

REVOKE DELETE, TRUNCATE, UPDATE ON TABLE public.clients FROM authenticated;

GRANT UPDATE (
    id_card_num,
    name,
    date_of_birth,
    gender,
    phone,
    address,
    health_insurance_num,
    expiry_date
) ON public.clients TO authenticated;

DO $verify$
DECLARE
    v_allowed_column TEXT;
    v_protected_column TEXT;
BEGIN
    IF has_table_privilege(
        'authenticated', 'public.clients', 'UPDATE,DELETE,TRUNCATE'
    ) THEN
        RAISE EXCEPTION
            'Migration 218 broad mutation privilege postcondition failed';
    END IF;

    FOREACH v_allowed_column IN ARRAY ARRAY[
        'id_card_num', 'name', 'date_of_birth', 'gender', 'phone', 'address',
        'health_insurance_num', 'expiry_date'
    ]
    LOOP
        IF NOT has_column_privilege(
            'authenticated',
            'public.clients',
            v_allowed_column,
            'UPDATE'
        ) THEN
            RAISE EXCEPTION
                'Migration 218 did not preserve UPDATE on %',
                v_allowed_column;
        END IF;
    END LOOP;

    FOREACH v_protected_column IN ARRAY ARRAY[
        'deleted_at', 'deleted_by', 'deletion_reason',
        'identity_trust_level', 'identity_verified_at',
        'identity_verified_by', 'canonical_source_updated_at',
        'normalized_government_identity', 'normalized_name',
        'normalized_phone'
    ]
    LOOP
        IF has_column_privilege(
            'authenticated',
            'public.clients',
            v_protected_column,
            'UPDATE'
        ) THEN
            RAISE EXCEPTION
                'Migration 218 left protected UPDATE on %',
                v_protected_column;
        END IF;
    END LOOP;
END;
$verify$;

COMMIT;
