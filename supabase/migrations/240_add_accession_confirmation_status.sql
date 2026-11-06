-- Migration 240: private owner-only status without workbook or business writes.
-- Security impact: service-role-only entrypoint; active analyst, owner and confidentiality guards.
-- NOWAIT reports processing without inferring TTL while an accepted transaction owns the lock.
-- Historical 233–239 are immutable. Supports verified 239 only; corrections are forward-only.
-- SOURCE ONLY until separately authorized home-server apply, SQL fixtures and security execution.
BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $baseline$
BEGIN
    IF current_setting('check_function_bodies')::BOOLEAN IS DISTINCT FROM TRUE
       OR to_regprocedure('public.authorize_accession_preview_actor(uuid)') IS NULL
       OR to_regprocedure('public.client_has_confidential_samples(uuid)') IS NULL
       OR to_regclass('public.accession_import_receipts') IS NULL
       OR to_regclass('public.accession_import_mappings') IS NULL
       OR to_regprocedure('public.test_accession_confirmation_atomic_security()') IS NULL
       OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE
           AND proname IN ('get_accession_import_status','test_accession_confirmation_status_security'))
       OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
           WHERE oid=to_regprocedure('public.confirm_accession_import(uuid,uuid,boolean,jsonb,jsonb,jsonb,jsonb,text,text,jsonb,text)'))
          IS DISTINCT FROM '16451f917b161ed8cb3efe4a463f4ebc56de9239e1a9d725122a29ca0fee4122' THEN
        RAISE EXCEPTION 'Migration 240 requires verified 239 and unused status functions';
    END IF;
    IF public.test_accession_confirmation_atomic_security() IS DISTINCT FROM TRUE
       OR public.test_accession_import_provenance_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 240 security baseline mismatch';
    END IF;
END;
$baseline$;

CREATE FUNCTION public.get_accession_import_status(p_actor UUID,p_batch UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch public.accession_preview_batches; v_receipt public.accession_import_receipts;
    v_confidential BOOLEAN; v_reason TEXT;
BEGIN
    -- This helper explicitly verifies the service caller and locks the active analyst row FOR SHARE.
    PERFORM public.authorize_accession_preview_actor(p_actor);
    SELECT can_access_confidential INTO v_confidential FROM public.users WHERE id=p_actor;
    IF NOT EXISTS(SELECT 1 FROM public.accession_preview_batches WHERE id=p_batch AND owner_id=p_actor)
       OR (NOT COALESCE(v_confidential,FALSE) AND EXISTS(
           SELECT 1 FROM (
               SELECT matched_id AS client_id FROM public.accession_preview_bindings
                   WHERE batch_id=p_batch AND kind='client' AND matched_id IS NOT NULL
               UNION SELECT client_id FROM public.accession_import_mappings WHERE batch_id=p_batch
           ) bound WHERE public.client_has_confidential_samples(bound.client_id))) THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_FORBIDDEN' USING ERRCODE='42501';
    END IF;
    -- Only this lock statement is inside the subtransaction. No stale FOUND survives its failure.
    BEGIN
        SELECT * INTO v_batch FROM public.accession_preview_batches WHERE id=p_batch AND owner_id=p_actor FOR UPDATE NOWAIT;
        IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_CONFIRMATION_FORBIDDEN' USING ERRCODE='42501'; END IF;
    EXCEPTION WHEN lock_not_available THEN
        RETURN jsonb_build_object('state','processing','batchId',p_batch);
    END;
    -- VOLATILE/read-committed queries observe committed outcome after obtaining the lock.
    -- Recheck read authority against current bindings/mappings before disclosing committed state.
    IF NOT COALESCE(v_confidential,FALSE) AND EXISTS(
        SELECT 1 FROM (
            SELECT matched_id AS client_id FROM public.accession_preview_bindings
                WHERE batch_id=p_batch AND kind='client' AND matched_id IS NOT NULL
            UNION SELECT client_id FROM public.accession_import_mappings WHERE batch_id=p_batch
        ) bound WHERE public.client_has_confidential_samples(bound.client_id)) THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_FORBIDDEN' USING ERRCODE='42501';
    END IF;
    IF v_batch.state='succeeded' THEN
        SELECT * INTO v_receipt FROM public.accession_import_receipts WHERE batch_id=p_batch AND owner_id=p_actor;
        IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_STATUS_INVALID'; END IF;
        IF v_receipt.client_count<>v_receipt.create_count+v_receipt.reuse_count
           OR v_receipt.normalized_payload_hash IS DISTINCT FROM v_batch.normalized_payload_hash
           OR ROW(v_receipt.client_count,v_receipt.sample_count,v_receipt.assignment_count,v_receipt.create_count,v_receipt.reuse_count)
              IS DISTINCT FROM ROW(v_batch.client_count,v_batch.sample_count,v_batch.assignment_count,v_batch.create_count,v_batch.reuse_count) THEN
            RAISE EXCEPTION 'ACCESSION_STATUS_INVALID';
        END IF;
        RETURN jsonb_build_object('state','succeeded','receipt',jsonb_build_object('batch_id',v_receipt.batch_id,
            'owner_id',v_receipt.owner_id,'confirmation_received_at',v_receipt.confirmation_received_at,
            'client_count',v_receipt.client_count,'sample_count',v_receipt.sample_count,'assignment_count',v_receipt.assignment_count,
            'create_count',v_receipt.create_count,'reuse_count',v_receipt.reuse_count));
    END IF;
    IF v_batch.state='preview_ready' AND clock_timestamp()>=v_batch.expires_at THEN
        RETURN jsonb_build_object('state','expired','batchId',p_batch,'reasonCode','EXPIRED');
    END IF;
    IF v_batch.state IN ('failed','rejected','expired') THEN
        v_reason:=CASE WHEN v_batch.reason_code IN ('WORKBOOK_INVALID','CLIENT_INVALID','PREPARATION_FAILED','ALREADY_IMPORTED',
            'AUTHORITY_CHANGED','CONFIRMATION_FAILED','PREVIEW_CONTENT_CHANGED','ATTESTATION_REQUIRED','CONFIGURATION_UNAVAILABLE','EXPIRED')
            THEN v_batch.reason_code ELSE 'CONFIRMATION_FAILED' END;
        RETURN jsonb_build_object('state',v_batch.state,'batchId',p_batch,'reasonCode',v_reason);
    END IF;
    IF v_batch.state NOT IN ('preparing','preview_ready') THEN RAISE EXCEPTION 'ACCESSION_STATUS_INVALID'; END IF;
    RETURN jsonb_build_object('state',v_batch.state,'batchId',p_batch);
END;
$$;
ALTER FUNCTION public.get_accession_import_status(UUID,UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_accession_import_status(UUID,UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accession_import_status(UUID,UUID) TO service_role;

CREATE FUNCTION public.test_accession_confirmation_status_security() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT (SELECT count(*)=1 AND bool_and(prosecdef AND provolatile='v' AND proowner='postgres'::REGROLE
        AND proconfig=ARRAY['search_path=public, pg_temp']
        AND NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(proacl,acldefault('f',proowner))) acl
            WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'))
        FROM pg_proc WHERE oid=to_regprocedure('public.get_accession_import_status(uuid,uuid)'))
    AND NOT has_function_privilege('anon','public.get_accession_import_status(uuid,uuid)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.get_accession_import_status(uuid,uuid)','EXECUTE')
    AND has_function_privilege('service_role','public.get_accession_import_status(uuid,uuid)','EXECUTE')
    AND public.test_accession_import_provenance_security()
    AND public.test_accession_confirmation_atomic_security();
$$;
ALTER FUNCTION public.test_accession_confirmation_status_security() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.test_accession_confirmation_status_security() FROM PUBLIC, anon, authenticated, service_role;

DO $register_and_verify$
DECLARE v_definition TEXT; v_passed BOOLEAN;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE) INTO v_definition;
    IF v_definition NOT LIKE '%test_accession_confirmation_atomic_security()%'
       OR v_definition LIKE '%test_accession_confirmation_status_security()%' THEN
        RAISE EXCEPTION 'Migration 240 security registration baseline mismatch';
    END IF;
    EXECUTE replace(v_definition,'test_accession_confirmation_atomic_security()',
        'test_accession_confirmation_atomic_security() AND test_accession_confirmation_status_security()');
    IF public.test_accession_confirmation_status_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 240 dedicated security verification failed';
    END IF;
    SELECT bool_and(passed) INTO v_passed FROM public.run_security_tests();
    IF v_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Migration 240 security verification failed'; END IF;
END;
$register_and_verify$;
COMMIT;
