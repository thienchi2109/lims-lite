-- Repair the real preview -> confirmation roundtrip without changing sealed commitments.
-- Template authority uses decimal strings for bigint generations, including values > 2^53.
-- Both SQL tuple readers must preserve that representation; row/parent numbers stay numeric.
-- Security impact: no data, policies, owners, grants or execution settings change.
-- Supports only the verified 243 baseline; historical migrations remain immutable.
BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $repair$
DECLARE
    v_signature TEXT; v_before TEXT; v_after TEXT; v_acl ACLITEM[];
    v_definition TEXT; v_function RECORD;
    v_old CONSTANT TEXT := 'kind,row_number,parent_row,import_code,entity_id,generation,method_name';
    v_new CONSTANT TEXT := 'kind,row_number,parent_row,import_code,entity_id,generation::TEXT,method_name';
BEGIN
    IF current_setting('check_function_bodies')::BOOLEAN IS DISTINCT FROM TRUE
       OR public.test_accession_import_maintenance_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 244 requires verified 243';
    END IF;
    FOR v_signature,v_before,v_after,v_acl IN SELECT * FROM (VALUES
        ('get_accession_confirmation_preparation(uuid,uuid)',
         '6828b035ae787c10d107d4b11a8b67591f2d13ad04f56f6f9eb0e63dba5ac2e7',
         'c5e0411b0b48cd08dfde6848dabea84d5fc763080d0069399561c2ebf96bc30a',
         ARRAY['postgres=X/postgres','service_role=X/postgres']::ACLITEM[]),
        ('validate_accession_confirmation_locked(uuid,uuid,boolean,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)',
         '6df2835d7d192c358af8d54c096eee1ed1d767c6b0808f9d1608ddb153173f37',
         'f6ac7d81a78ea6414e7061921516039a72ed71292d3173286d2300c39972f4fd',
         ARRAY['postgres=X/postgres']::ACLITEM[])
    ) expected(signature,before_hash,after_hash,acl) LOOP
        SELECT * INTO STRICT v_function FROM pg_proc WHERE oid=to_regprocedure('public.'||v_signature);
        IF encode(sha256(convert_to(v_function.prosrc,'UTF8')),'hex') IS DISTINCT FROM v_before
           OR v_function.proowner <> 'postgres'::REGROLE OR NOT v_function.prosecdef
           OR v_function.provolatile <> 'v'
           OR v_function.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']
           OR v_function.proacl IS DISTINCT FROM v_acl THEN
            RAISE EXCEPTION 'Migration 244 function baseline mismatch: %',v_signature;
        END IF;
        SELECT pg_get_functiondef(v_function.oid) INTO STRICT v_definition;
        IF length(v_definition)-length(replace(v_definition,v_old,'')) <> length(v_old) THEN
            RAISE EXCEPTION 'Migration 244 requires one exact tuple reconstruction: %',v_signature;
        END IF;
        -- CREATE OR REPLACE preserves ownership, grants and all unrelated function logic.
        EXECUTE replace(v_definition,v_old,v_new);
        SELECT * INTO STRICT v_function FROM pg_proc WHERE oid=to_regprocedure('public.'||v_signature);
        IF encode(sha256(convert_to(v_function.prosrc,'UTF8')),'hex') IS DISTINCT FROM v_after
           OR v_function.proowner <> 'postgres'::REGROLE OR NOT v_function.prosecdef
           OR v_function.provolatile <> 'v'
           OR v_function.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']
           OR v_function.proacl IS DISTINCT FROM v_acl THEN
            RAISE EXCEPTION 'Migration 244 function verification failed: %',v_signature;
        END IF;
    END LOOP;
END;
$repair$;

DO $verify$
DECLARE v_passed BOOLEAN;
BEGIN
    IF public.test_accession_confirmation_validation_security() IS DISTINCT FROM TRUE
       OR public.test_accession_import_maintenance_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 244 dedicated security verification failed';
    END IF;
    SELECT bool_and(passed) INTO v_passed FROM public.run_security_tests();
    IF v_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Migration 244 security verification failed'; END IF;
END;
$verify$;
COMMIT;
