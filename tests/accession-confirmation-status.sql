-- SOURCE ONLY / NOT RUN. Requires committed 235->238->239->240 in an authorized task11_disposable_* DB.
-- Reuses the retained synthetic seed, no trigger/RLS disabling, no production actor or data.
-- File-free status/receipt reads do not mutate lifecycle or audit. All fixtures/business rows ROLLBACK.
\set ON_ERROR_STOP on
\set confirmation_concurrency 1
\ir accession-confirmation-validation.sql
DO $status$
DECLARE v_args JSONB; v_actor UUID; v_batch UUID; v_id UUID; v_other UUID; v_response JSONB; v_receipt JSONB;
    v_before JSONB; v_audits BIGINT; v_denied BOOLEAN; v_role TEXT; v_assay UUID;
BEGIN
    SELECT args INTO STRICT v_args FROM task11_confirmation_args;
    v_actor:=(v_args->>'actor')::UUID; v_batch:=(v_args->>'batch')::UUID;
    v_other:='95600000-0000-4000-8000-000000000002';
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::TEXT,true);
    SELECT to_jsonb(b) INTO v_before FROM public.accession_preview_batches b WHERE id=v_batch;
    SELECT count(*) INTO v_audits FROM public.audit_logs;
    v_response:=public.get_accession_import_status(v_actor,v_batch);
    PERFORM pg_temp.assert_confirmation(v_response=jsonb_build_object('state','preview_ready','batchId',v_batch),'ready has no official IDs');
    PERFORM pg_temp.assert_confirmation((SELECT to_jsonb(b)=v_before FROM public.accession_preview_batches b WHERE id=v_batch)
        AND (SELECT count(*)=v_audits FROM public.audit_logs),'status does not change batch or lifecycle audit');
    FOREACH v_id IN ARRAY ARRAY[v_other,'95600000-0000-4000-8000-000000000003'::UUID] LOOP
        v_denied:=FALSE;
        BEGIN PERFORM public.get_accession_import_status(v_id,v_batch);
        EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=TRUE; END;
        PERFORM pg_temp.assert_confirmation(v_denied,'nonowner/manager denied');
    END LOOP;
    v_denied:=FALSE;
    BEGIN PERFORM public.get_accession_import_status(v_actor,gen_random_uuid());
    EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=TRUE; END;
    PERFORM pg_temp.assert_confirmation(v_denied,'missing batch concealed, not processing');
    BEGIN
        UPDATE public.users SET deleted_at=clock_timestamp() WHERE id=v_actor;
        v_denied:=FALSE;
        BEGIN PERFORM public.get_accession_import_status(v_actor,v_batch);
        EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=TRUE; END;
        PERFORM pg_temp.assert_confirmation(v_denied,'withdrawn analyst account denied');
        RAISE EXCEPTION 'restore actor' USING ERRCODE='Z0240';
    EXCEPTION WHEN SQLSTATE 'Z0240' THEN NULL; END;
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
        PERFORM set_config('request.jwt.claim.role',v_role,true);
        PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role',v_role)::TEXT,true);
        v_denied:=FALSE;
        BEGIN PERFORM public.get_accession_import_status(v_actor,v_batch);
        EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=TRUE; END;
        PERFORM pg_temp.assert_confirmation(v_denied,'nonservice caller denied');
    END LOOP;
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::TEXT,true);
    v_id:=pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_args->>'bindings',clock_timestamp()-INTERVAL '30 minutes');
    SELECT to_jsonb(b) INTO v_before FROM public.accession_preview_batches b WHERE id=v_id;
    SELECT count(*) INTO v_audits FROM public.audit_logs;
    PERFORM pg_temp.assert_confirmation(public.get_accession_import_status(v_actor,v_id)
        =jsonb_build_object('state','expired','batchId',v_id,'reasonCode','EXPIRED'),'DB-clock logical expiry');
    PERFORM pg_temp.assert_confirmation((SELECT to_jsonb(b)=v_before FROM public.accession_preview_batches b WHERE id=v_id)
        AND (SELECT count(*)=v_audits FROM public.audit_logs),'logical expiry read is not terminalization/purge');
    v_response:=public.confirm_accession_import(v_actor,v_batch,TRUE,v_args->'workbook',v_args->'snapshot',v_args->'clients',
        v_args->'expected',v_args->>'canonical',v_args->>'bindings',v_args->'metadata',NULL);
    PERFORM pg_temp.assert_confirmation(v_response->>'state'='succeeded','actual atomic fixture succeeds');
    v_receipt:=v_response->'receipt';
    SELECT count(*) INTO v_audits FROM public.audit_logs;
    PERFORM pg_temp.assert_confirmation(public.get_accession_import_status(v_actor,v_batch)
        =jsonb_build_object('state','succeeded','receipt',v_receipt),'durable receipt without workbook');
    PERFORM pg_temp.assert_confirmation((SELECT count(*)=v_audits FROM public.audit_logs),'success lookup creates no acceptance audit');
    -- Existing mapping confidentiality rule applies even though status returns only safe counts.
    BEGIN
        UPDATE public.users SET can_access_confidential=FALSE WHERE id=v_actor;
        SELECT assay_id INTO STRICT v_assay FROM public.accession_import_mappings WHERE batch_id=v_batch AND kind='assignment' LIMIT 1;
        UPDATE public.assay_definitions SET is_confidential=TRUE WHERE id=v_assay;
        v_denied:=FALSE;
        BEGIN PERFORM public.get_accession_import_status(v_actor,v_batch);
        EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=TRUE; END;
        PERFORM pg_temp.assert_confirmation(v_denied,'restricted client mapping cannot bypass confidentiality');
        RAISE EXCEPTION 'restore confidentiality' USING ERRCODE='Z0240';
    EXCEPTION WHEN SQLSTATE 'Z0240' THEN NULL; END;
    PERFORM pg_temp.assert_confirmation(public.test_accession_confirmation_status_security(),'closed status ACL/security');
END;
$status$;
ROLLBACK;
