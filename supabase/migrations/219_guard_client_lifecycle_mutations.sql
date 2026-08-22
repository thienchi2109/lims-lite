-- Purpose: Supersede migration 218 after its baseline rejected non-existent
-- future-phase columns. Migration 218 made no database changes.
-- Security impact: Authenticated callers lose hard DELETE, TRUNCATE, and broad
-- UPDATE while legacy identity and approved profile fields remain editable.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
DECLARE
    v_column TEXT;
BEGIN
    FOREACH v_column IN ARRAY ARRAY[
        'id_card_num', 'name', 'date_of_birth', 'gender', 'phone', 'address',
        'health_insurance_num', 'expiry_date', 'government_identity_type',
        'government_identity_value', 'government_identity_trusted',
        'normalized_name', 'normalized_phone', 'deleted_at', 'deleted_by',
        'deletion_reason'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'clients'
              AND column_name = v_column
        ) THEN
            RAISE EXCEPTION 'Migration 219 missing clients column %', v_column;
        END IF;
    END LOOP;

    IF NOT has_table_privilege(
        'authenticated', 'public.clients', 'UPDATE,DELETE,TRUNCATE'
    ) THEN
        RAISE EXCEPTION
            'Migration 219 requires the legacy broad mutation privileges';
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
    v_allowed TEXT;
    v_protected TEXT;
BEGIN
    IF has_table_privilege(
        'authenticated', 'public.clients', 'UPDATE,DELETE,TRUNCATE'
    ) THEN
        RAISE EXCEPTION 'Migration 219 broad privilege postcondition failed';
    END IF;

    FOREACH v_allowed IN ARRAY ARRAY[
        'id_card_num', 'name', 'date_of_birth', 'gender', 'phone', 'address',
        'health_insurance_num', 'expiry_date'
    ]
    LOOP
        IF NOT has_column_privilege(
            'authenticated', 'public.clients', v_allowed, 'UPDATE'
        ) THEN
            RAISE EXCEPTION 'Migration 219 missing allowed UPDATE on %', v_allowed;
        END IF;
    END LOOP;

    FOREACH v_protected IN ARRAY ARRAY[
        'government_identity_type', 'government_identity_value',
        'government_identity_trusted', 'normalized_name', 'normalized_phone',
        'deleted_at', 'deleted_by', 'deletion_reason'
    ]
    LOOP
        IF has_column_privilege(
            'authenticated', 'public.clients', v_protected, 'UPDATE'
        ) THEN
            RAISE EXCEPTION 'Migration 219 left protected UPDATE on %', v_protected;
        END IF;
    END LOOP;
END;
$verify$;

COMMIT;
