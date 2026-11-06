-- Migration 241: lock-aware same-owner linked attempts, including explicit ready-preview replacement.
-- Security impact: retain service-only entrypoint, active analyst and status confidentiality guards.
-- Status holds the parent lock through child INSERT; busy/uncertain/succeeded parents cannot spawn retries.
-- Historical 233–240 remain immutable; parent state/commitment/receipt are never reset or changed here.
-- SOURCE ONLY: no apply, SQL/security or concurrency evidence until separately authorized home-server work.
BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $baseline$
BEGIN
    IF current_setting('check_function_bodies')::BOOLEAN IS DISTINCT FROM TRUE
       OR to_regprocedure('public.get_accession_import_status(uuid,uuid)') IS NULL
       OR to_regprocedure('public.test_accession_confirmation_status_security()') IS NULL
       OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE
           AND proname='test_accession_preview_retry_security')
       OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
           WHERE oid=to_regprocedure('public.start_accession_preview(uuid,uuid,integer,text)'))
          IS DISTINCT FROM 'cadd2bd966dcc96326af313fe719f36d71a8904abdc6ef40ac6abc51533bb371' THEN
        RAISE EXCEPTION 'Migration 241 requires verified 234 start and 240 status';
    END IF;
    IF public.test_accession_confirmation_status_security() IS DISTINCT FROM TRUE
       OR public.test_accession_preview_commitment_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 241 security baseline mismatch';
    END IF;
END;
$baseline$;

CREATE OR REPLACE FUNCTION public.start_accession_preview(p_actor UUID,p_retry_of UUID,p_lease_ms INTEGER,p_policy_evidence TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_now TIMESTAMPTZ; v_batch public.accession_preview_batches; v_status JSONB;
BEGIN
    PERFORM public.authorize_accession_preview_actor(p_actor);
    IF p_lease_ms IS NULL OR p_lease_ms<1 OR p_policy_evidence IS NULL OR p_policy_evidence !~ '^[A-Za-z0-9._:/-]{1,160}$' THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_CONFIGURATION_UNAVAILABLE';
    END IF;
    IF p_retry_of IS NOT NULL THEN
        -- The status RPC's successful NOWAIT lock remains held by this transaction through INSERT.
        -- A locked parent returns processing; never wait for confirmation to finish then guess a retry.
        v_status:=public.get_accession_import_status(p_actor,p_retry_of);
        IF COALESCE(v_status->>'state','unknown') NOT IN ('failed','rejected','expired','preview_ready') THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_RETRY_UNAVAILABLE' USING ERRCODE='55000';
        END IF;
    END IF;
    v_now:=clock_timestamp();
    INSERT INTO public.accession_preview_batches(owner_id,retry_of,created_at,lease_duration_ms,policy_evidence,lease_heartbeat_at,lease_expires_at)
    VALUES(p_actor,p_retry_of,v_now,p_lease_ms,p_policy_evidence,v_now,v_now+p_lease_ms*INTERVAL '1 millisecond') RETURNING * INTO v_batch;
    RETURN jsonb_build_object('id',v_batch.id,'lease_token',v_batch.lease_token,'lease_generation',v_batch.lease_generation,
        'preview_created_at',NULL,'expires_at',NULL);
END;
$$;
ALTER FUNCTION public.start_accession_preview(UUID,UUID,INTEGER,TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.start_accession_preview(UUID,UUID,INTEGER,TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_accession_preview(UUID,UUID,INTEGER,TEXT) TO service_role;

CREATE FUNCTION public.test_accession_preview_retry_security() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT (SELECT count(*)=1 AND bool_and(prosecdef AND provolatile='v' AND proowner='postgres'::REGROLE
        AND proconfig=ARRAY['search_path=public, pg_temp']
        AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='ea7ca3a2ec4a91f93894dcbf0ede4a1805cf7c8a18b5c1d28b7f8140326368a8'
        AND NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(proacl,acldefault('f',proowner))) acl
            WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'))
        FROM pg_proc WHERE oid=to_regprocedure('public.start_accession_preview(uuid,uuid,integer,text)'))
    AND NOT has_function_privilege('anon','public.start_accession_preview(uuid,uuid,integer,text)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.start_accession_preview(uuid,uuid,integer,text)','EXECUTE')
    AND has_function_privilege('service_role','public.start_accession_preview(uuid,uuid,integer,text)','EXECUTE')
    AND public.test_accession_preview_commitment_security()
    AND public.test_accession_confirmation_status_security();
$$;
ALTER FUNCTION public.test_accession_preview_retry_security() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.test_accession_preview_retry_security() FROM PUBLIC, anon, authenticated, service_role;

DO $register_and_verify$
DECLARE v_definition TEXT; v_passed BOOLEAN;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE) INTO v_definition;
    IF v_definition NOT LIKE '%test_accession_confirmation_status_security()%'
       OR v_definition LIKE '%test_accession_preview_retry_security()%' THEN
        RAISE EXCEPTION 'Migration 241 security registration baseline mismatch';
    END IF;
    EXECUTE replace(v_definition,'test_accession_confirmation_status_security()',
        'test_accession_confirmation_status_security() AND test_accession_preview_retry_security()');
    IF public.test_accession_preview_retry_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 241 dedicated security verification failed';
    END IF;
    SELECT bool_and(passed) INTO v_passed FROM public.run_security_tests();
    IF v_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Migration 241 security verification failed'; END IF;
END;
$register_and_verify$;
COMMIT;
