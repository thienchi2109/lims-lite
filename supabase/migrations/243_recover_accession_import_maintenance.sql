-- Migration 243: recover maintenance from verified 241 after 242 rolled back.
-- Historical 242 stays immutable; apply 240 -> 241 -> 243, skipping 242.
-- Security impact: the private capability table explicitly denies all PUBLIC RLS access.
-- No caller gains table access; the existing owner-definer capability flow is unchanged.
-- Recovered 242 diagnostics, role/ACLs and guard/status/maintenance bodies remain intact.
-- Only two changes: explicit deny-all policy and exact policy verification.
-- Runtime requires committed bytes, run_security_tests() and retained disposable fixtures.
-- ponytail: verified 241 only; an installed 242 needs a separate forward migration.
BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $baseline$
DECLARE v_name TEXT; v_hash TEXT;
BEGIN
    IF current_setting('check_function_bodies')::BOOLEAN IS DISTINCT FROM TRUE
       OR to_regclass('public.accession_import_maintenance_authorizations') IS NOT NULL
       OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='accession_maintenance_worker')
       OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE
           AND proname IN ('maintain_accession_import_once','test_accession_import_maintenance_security'))
       OR public.test_accession_preview_retry_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 242 requires verified 241 and unused maintenance names';
    END IF;
    FOR v_name,v_hash IN SELECT * FROM (VALUES
        ('guard_accession_preview_mutation()','3a97f448fbc07157732625dc10ae23621c30cb988df4384aeb3a99bfa07e36a0'),
        ('get_accession_import_status(uuid,uuid)','ff59fa6f1bbdf4d62dfeaba7b41541609aee29d7433f60cc6bb26f06a7a2d310'),
        ('start_accession_preview(uuid,uuid,integer,text)','ea7ca3a2ec4a91f93894dcbf0ede4a1805cf7c8a18b5c1d28b7f8140326368a8'),
        ('heartbeat_accession_preview(uuid,uuid,uuid,bigint,text,bigint)','2ecaecd8d5b912cc27a763fccd5772277327b1df37c1302cf5bb96758134b21f'),
        ('finish_accession_preview(uuid,uuid,uuid,bigint,text,text)','5a39a34c0101dd606d61f04c2aedf6e4a0fa155968f66067d4d527ac1dd0714f')
    ) expected(signature,hash) LOOP
        IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
            WHERE oid=to_regprocedure('public.'||v_name)) IS DISTINCT FROM v_hash THEN
            RAISE EXCEPTION 'Migration 242 function baseline mismatch: %',v_name;
        END IF;
    END LOOP;
END;
$baseline$;

CREATE ROLE accession_maintenance_worker LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;
CREATE TABLE public.accession_import_maintenance_authorizations (
    transaction_id xid8 NOT NULL, batch_id UUID NOT NULL REFERENCES public.accession_preview_batches(id),
    PRIMARY KEY(transaction_id,batch_id)
);
ALTER TABLE public.accession_import_maintenance_authorizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accession_maintenance_deny_all ON public.accession_import_maintenance_authorizations;
CREATE POLICY accession_maintenance_deny_all ON public.accession_import_maintenance_authorizations
    FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.accession_import_maintenance_authorizations FROM PUBLIC, anon, authenticated, service_role, accession_maintenance_worker;

-- Baseline-hashed surgical replacements preserve every unrelated 238 guard and 240 status check.
DO $guard_and_status$
DECLARE v_definition TEXT;
BEGIN
    SELECT pg_get_functiondef('public.guard_accession_preview_mutation()'::REGPROCEDURE) INTO STRICT v_definition;
    v_definition:=replace(v_definition,$old$BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE'; END IF;$old$,$new$DECLARE v_maintenance BOOLEAN:=FALSE;
BEGIN
    IF TG_OP='DELETE' THEN
        IF TG_TABLE_NAME<>'accession_preview_bindings' THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE'; END IF;
        IF (session_user<>'accession_maintenance_worker' AND current_setting('role',true) IS DISTINCT FROM 'service_role')
           OR NOT EXISTS(SELECT 1 FROM public.accession_import_maintenance_authorizations
               WHERE transaction_id=pg_current_xact_id() AND batch_id=OLD.batch_id) THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE';
        END IF;
        PERFORM 1 FROM public.accession_preview_batches WHERE id=OLD.batch_id
            AND (state IN ('failed','rejected','expired','succeeded')
                 OR (state='preview_ready' AND clock_timestamp()>=expires_at)) FOR UPDATE NOWAIT;
        IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE'; END IF;
        RETURN OLD;
    END IF;$new$);
    v_definition:=replace(v_definition,$old$    IF TG_OP='INSERT' OR NEW.state IS DISTINCT FROM OLD.state THEN
        INSERT INTO public.audit_logs$old$,$new$    IF TG_OP='INSERT' OR NEW.state IS DISTINCT FROM OLD.state THEN
        v_maintenance:=(session_user='accession_maintenance_worker' OR current_setting('role',true)='service_role')
            AND EXISTS(SELECT 1 FROM public.accession_import_maintenance_authorizations
                WHERE transaction_id=pg_current_xact_id() AND batch_id=NEW.id);
        INSERT INTO public.audit_logs$new$);
    v_definition:=replace(v_definition,$old$'sample_count',NEW.sample_count,'assignment_count',NEW.assignment_count),NEW.owner_id);$old$,
        $new$'sample_count',NEW.sample_count,'assignment_count',NEW.assignment_count)
                || CASE WHEN v_maintenance THEN jsonb_build_object('system_actor','accession_maintenance_worker') ELSE '{}'::JSONB END,
            CASE WHEN v_maintenance THEN NULL ELSE NEW.owner_id END);$new$);
    EXECUTE v_definition;
    SELECT pg_get_functiondef('public.get_accession_import_status(uuid,uuid)'::REGPROCEDURE) INTO STRICT v_definition;
    v_definition:=replace(v_definition,$old$    IF v_batch.state IN ('failed','rejected','expired') THEN
        v_reason:=$old$,$new$    IF v_batch.state IN ('failed','rejected','expired') THEN
        -- Once transient authority is gone, disclose only the owner's terminal lifecycle.
        IF NOT EXISTS(SELECT 1 FROM public.accession_preview_bindings WHERE batch_id=p_batch) THEN
            RETURN jsonb_build_object('state',v_batch.state,'batchId',p_batch);
        END IF;
        v_reason:=$new$);
    EXECUTE v_definition;
END;
$guard_and_status$;

CREATE FUNCTION public.maintain_accession_import_once() RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch public.accession_preview_batches; v_purged BIGINT;
    v_recovered BOOLEAN:=FALSE; v_expired BOOLEAN:=FALSE;
BEGIN
    -- PostgreSQL's role setting enforces SET ROLE privileges; JWT/custom GUCs do not authorize this path.
    IF session_user<>'accession_maintenance_worker' AND current_setting('role',true) IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'ACCESSION_MAINTENANCE_FORBIDDEN' USING ERRCODE='42501';
    END IF;
    -- ponytail: one locked candidate per invocation; TASK-7 supplies the measured external schedule.
    SELECT * INTO v_batch FROM public.accession_preview_batches b
    WHERE (b.state='preparing' AND clock_timestamp()>=b.lease_expires_at)
       OR (b.state='preview_ready' AND clock_timestamp()>=b.expires_at)
       OR (b.state IN ('failed','rejected','expired','succeeded')
           AND EXISTS(SELECT 1 FROM public.accession_preview_bindings WHERE batch_id=b.id))
    ORDER BY COALESCE(b.expires_at,b.lease_expires_at),b.created_at,b.id
    LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN jsonb_build_object('state','idle'); END IF;
    IF (v_batch.state='succeeded') IS DISTINCT FROM EXISTS(
        SELECT 1 FROM public.accession_import_receipts WHERE batch_id=v_batch.id) THEN
        RAISE EXCEPTION 'ACCESSION_MAINTENANCE_INVALID_STATE';
    END IF;
    IF (v_batch.state='preparing' AND clock_timestamp()<v_batch.lease_expires_at)
       OR (v_batch.state='preview_ready' AND clock_timestamp()<v_batch.expires_at) THEN
        RETURN jsonb_build_object('state','idle');
    END IF;
    INSERT INTO public.accession_import_maintenance_authorizations(transaction_id,batch_id)
        VALUES(pg_current_xact_id(),v_batch.id);
    IF v_batch.state='preparing' THEN
        UPDATE public.accession_preview_batches SET state='failed',reason_code='PREPARATION_FAILED',finished_at=clock_timestamp()
        WHERE id=v_batch.id AND state='preparing' AND lease_token=v_batch.lease_token
            AND lease_generation=v_batch.lease_generation AND clock_timestamp()>=lease_expires_at;
        IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_MAINTENANCE_STALE'; END IF;
        v_recovered:=TRUE;
    ELSIF v_batch.state='preview_ready' THEN
        UPDATE public.accession_preview_batches SET state='expired',reason_code='EXPIRED',finished_at=clock_timestamp()
        WHERE id=v_batch.id AND state='preview_ready' AND clock_timestamp()>=expires_at;
        IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_MAINTENANCE_STALE'; END IF;
        v_expired:=TRUE;
    END IF;
    DELETE FROM public.accession_preview_bindings WHERE batch_id=v_batch.id;
    GET DIAGNOSTICS v_purged=ROW_COUNT;
    IF v_purged>0 THEN
        INSERT INTO public.audit_logs(table_name,record_id,operation,new_values,changed_by)
        VALUES('accession_preview_bindings',v_batch.id,'DELETE',jsonb_build_object('batch_id',v_batch.id,
            'system_actor','accession_maintenance_worker','purgedBindings',v_purged,'purged_at',clock_timestamp()),NULL);
    END IF;
    DELETE FROM public.accession_import_maintenance_authorizations WHERE transaction_id=pg_current_xact_id() AND batch_id=v_batch.id;
    RETURN jsonb_build_object('state','maintained','recovered',v_recovered,'expired',v_expired,'purgedBindings',v_purged);
END;
$$;
ALTER FUNCTION public.maintain_accession_import_once() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.maintain_accession_import_once() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.maintain_accession_import_once() TO service_role, accession_maintenance_worker;

CREATE FUNCTION public.test_accession_import_maintenance_security() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT public.test_accession_preview_retry_security()
    AND (SELECT count(*)=1 AND bool_and(rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb
        AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) FROM pg_roles WHERE rolname='accession_maintenance_worker')
    AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member='accession_maintenance_worker'::REGROLE)
    AND (SELECT relrowsecurity AND relowner='postgres'::REGROLE FROM pg_class
        WHERE oid='public.accession_import_maintenance_authorizations'::REGCLASS)
    AND (SELECT count(*)=1 AND bool_and(polname='accession_maintenance_deny_all' AND polcmd='*'
        AND polpermissive AND polroles=ARRAY[0]::OID[]
        AND pg_get_expr(polqual,polrelid)='false' AND pg_get_expr(polwithcheck,polrelid)='false')
        FROM pg_policy WHERE polrelid='public.accession_import_maintenance_authorizations'::REGCLASS)
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role','accession_maintenance_worker']) r(role_name)
        WHERE has_table_privilege(r.role_name,'public.accession_import_maintenance_authorizations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['accession_preview_batches','accession_preview_bindings','accession_import_receipts',
        'accession_import_mappings','audit_logs','clients','samples','results']) t(table_name)
        WHERE has_table_privilege('accession_maintenance_worker','public.'||t.table_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
    AND (SELECT count(*)=1 AND bool_and(prosecdef AND provolatile='v' AND proowner='postgres'::REGROLE
        AND proconfig=ARRAY['search_path=public, pg_temp']
        AND NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(proacl,acldefault('f',proowner))) acl
            WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'))
        FROM pg_proc WHERE oid='public.maintain_accession_import_once()'::REGPROCEDURE)
    AND NOT has_function_privilege('anon','public.maintain_accession_import_once()','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.maintain_accession_import_once()','EXECUTE')
    AND has_function_privilege('service_role','public.maintain_accession_import_once()','EXECUTE')
    AND has_function_privilege('accession_maintenance_worker','public.maintain_accession_import_once()','EXECUTE')
    AND (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex')='17d73f84a24b51bd531ed30fff0d8803a098246ac94bd0486c65600640faccbd'
        FROM pg_proc WHERE oid='public.guard_accession_preview_mutation()'::REGPROCEDURE)
    AND (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex')='d1495b00d0a97d9f5e6dd0ee1233a7e82f981f256ebd1ec50e09a036a2aea740'
        FROM pg_proc WHERE oid='public.get_accession_import_status(uuid,uuid)'::REGPROCEDURE)
    AND (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex')='ccc5aea1bc7a73fcfe8d4ad7f5cbf134857fcdb3d8180d812eedec5a9b182922'
        FROM pg_proc WHERE oid='public.maintain_accession_import_once()'::REGPROCEDURE)
    AND NOT has_function_privilege('accession_maintenance_worker','public.get_accession_import_status(uuid,uuid)','EXECUTE')
    AND NOT has_function_privilege('accession_maintenance_worker',
        'public.confirm_accession_import(uuid,uuid,boolean,jsonb,jsonb,jsonb,jsonb,text,text,jsonb,text)','EXECUTE');
$$;
ALTER FUNCTION public.test_accession_import_maintenance_security() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.test_accession_import_maintenance_security() FROM PUBLIC, anon, authenticated, service_role, accession_maintenance_worker;

DO $register_and_verify$
DECLARE v_definition TEXT; v_passed BOOLEAN;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE) INTO STRICT v_definition;
    IF v_definition NOT LIKE '%test_accession_preview_retry_security()%'
       OR v_definition LIKE '%test_accession_import_maintenance_security()%' THEN
        RAISE EXCEPTION 'Migration 242 security registration baseline mismatch';
    END IF;
    EXECUTE replace(v_definition,'test_accession_preview_retry_security()',
        'test_accession_preview_retry_security() AND test_accession_import_maintenance_security()');
    IF public.test_accession_import_maintenance_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 242 dedicated security verification failed';
    END IF;
    SELECT bool_and(passed) INTO v_passed FROM public.run_security_tests();
    IF v_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Migration 242 security verification failed'; END IF;
END;
$register_and_verify$;
COMMIT;
