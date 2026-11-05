-- SOURCE ONLY / NOT RUN. Requires 237 in an explicitly authorized task11_disposable_* home-server DB.
-- Original bytes/signatures/HMAC remain application trust-boundary tests; this is privileged SQL behavior.
-- All business/claim/mapping/audit fixtures roll back. ID-generator gaps are permitted by contract.
\set ON_ERROR_STOP on
\set confirmation_concurrency 1
\ir accession-confirmation-validation.sql
CREATE FUNCTION pg_temp.confirm_import(p_args JSONB,p_failure TEXT DEFAULT NULL) RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.confirm_accession_import((p_args->>'actor')::UUID,(p_args->>'batch')::UUID,TRUE,
        p_args->'workbook',p_args->'snapshot',p_args->'clients',p_args->'expected',p_args->>'canonical',
        p_args->>'bindings',p_args->'metadata',p_failure);
$$;
CREATE FUNCTION pg_temp.import_counts() RETURNS BIGINT[] LANGUAGE sql AS $$
    SELECT ARRAY[(SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),(SELECT count(*) FROM public.results),
        (SELECT count(*) FROM public.accession_import_receipts),(SELECT count(*) FROM public.accession_import_mappings),(SELECT count(*) FROM public.audit_logs)];
$$;
-- These transaction-local test triggers inject after each actual write; no production failpoint exists.
CREATE FUNCTION pg_temp.fail_import_write() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_row JSONB:=to_jsonb(NEW); v_stage TEXT:=TG_ARGV[0];
BEGIN
    IF current_setting('test.import_fail_stage',true)=v_stage
       AND (v_stage<>'mapping' OR v_row->>'kind'='assignment')
       AND (v_stage<>'audit' OR (v_row->>'table_name'='accession_preview_batches' AND v_row->'new_values'->>'state'='succeeded')) THEN
        RAISE EXCEPTION 'synthetic import write failure' USING ERRCODE='Z0237';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER task11_fail_client AFTER INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_import_write('client');
CREATE TRIGGER task11_fail_sample AFTER INSERT ON public.samples FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_import_write('sample');
CREATE TRIGGER task11_fail_assignment AFTER INSERT ON public.results FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_import_write('assignment');
CREATE TRIGGER task11_fail_mapping AFTER INSERT ON public.accession_import_mappings FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_import_write('mapping');
CREATE TRIGGER task11_fail_audit AFTER INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_import_write('audit');
DO $atomic$
DECLARE v_args JSONB; v_attempt JSONB; v_duplicate JSONB; v_prep_duplicate JSONB; v_response JSONB; v_again JSONB;
    v_actor UUID; v_batch UUID; v_stage TEXT; v_before BIGINT[]; v_after BIGINT[]; v_rejected BOOLEAN;
    v_claims TEXT; v_subject TEXT; v_role TEXT;
BEGIN
    SELECT args INTO STRICT v_args FROM task11_confirmation_args;
    v_actor:=(v_args->>'actor')::UUID; v_batch:=(v_args->>'batch')::UUID;
    v_claims:=current_setting('request.jwt.claims',true); v_subject:=current_setting('request.jwt.claim.sub',true); v_role:=current_setting('request.jwt.claim.role',true);
    FOREACH v_stage IN ARRAY ARRAY['client','sample','assignment','mapping','audit'] LOOP
        v_attempt:=jsonb_set(v_args,'{batch}',to_jsonb(pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_args->>'bindings')));
        v_before:=pg_temp.import_counts();
        PERFORM set_config('test.import_fail_stage',v_stage,true);
        v_response:=pg_temp.confirm_import(v_attempt);
        PERFORM set_config('test.import_fail_stage','',true);
        v_after:=pg_temp.import_counts();
        PERFORM pg_temp.assert_confirmation(v_response=jsonb_build_object('state','failed','batchId',v_attempt->>'batch','reasonCode','CONFIRMATION_FAILED'),v_stage||' safe terminal');
        PERFORM pg_temp.assert_confirmation(v_before[1:5]=v_after[1:5] AND v_after[6]=v_before[6]+1,v_stage||' rolls back all business/claim/mapping/audit; one safe failure audit');
        PERFORM pg_temp.assert_confirmation((SELECT count(*)=1 FROM public.audit_logs WHERE table_name='accession_preview_batches'
            AND record_id=(v_attempt->>'batch')::UUID AND operation='UPDATE' AND changed_by=v_actor
            AND new_values->>'state'='failed' AND new_values->>'reason_code'='CONFIRMATION_FAILED'),v_stage||' true owner failure audit');
        PERFORM pg_temp.assert_confirmation(current_setting('request.jwt.claims',true)=v_claims AND current_setting('request.jwt.claim.sub',true)=v_subject
            AND current_setting('request.jwt.claim.role',true)=v_role,v_stage||' restores all actor settings');
        v_rejected:=FALSE;
        BEGIN PERFORM pg_temp.confirm_import(v_attempt); EXCEPTION WHEN raise_exception THEN v_rejected:=TRUE; END;
        PERFORM pg_temp.assert_confirmation(v_rejected AND pg_temp.import_counts()=v_after,'terminal failure cannot replay');
    END LOOP;
    -- Controlled preparation failure has no business writes, only the same safe owned lifecycle outcome.
    v_attempt:=jsonb_set(v_args,'{batch}',to_jsonb(pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_args->>'bindings')));
    v_before:=pg_temp.import_counts(); v_response:=pg_temp.confirm_import(v_attempt,'ATTESTATION_REQUIRED'); v_after:=pg_temp.import_counts();
    PERFORM pg_temp.assert_confirmation(v_response->>'reasonCode'='ATTESTATION_REQUIRED' AND v_before[1:5]=v_after[1:5]
        AND v_after[6]=v_before[6]+1,'preparation failure safe terminal without graph');
    -- Invalid caller/wrong owner must not terminalize another actor's ready batch.
    v_before:=pg_temp.import_counts();
    v_rejected:=FALSE;
    BEGIN PERFORM pg_temp.confirm_import(jsonb_set(v_args,'{actor}','"95600000-0000-4000-8000-000000000002"'));
    EXCEPTION WHEN insufficient_privilege THEN v_rejected:=TRUE; END;
    PERFORM pg_temp.assert_confirmation(v_rejected AND pg_temp.import_counts()=v_before,'wrong owner cannot mutate');
    PERFORM set_config('request.jwt.claim.role','authenticated',true); v_rejected:=FALSE;
    BEGIN PERFORM pg_temp.confirm_import(v_args); EXCEPTION WHEN insufficient_privilege THEN v_rejected:=TRUE; END;
    PERFORM set_config('request.jwt.claim.role',v_role,true);
    PERFORM pg_temp.assert_confirmation(v_rejected AND pg_temp.import_counts()=v_before,'non-service caller cannot mutate');
    -- Real post-lock expiry occurs before any claim; safe outer expired outcome survives.
    v_attempt:=jsonb_set(v_args,'{batch}',to_jsonb(pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_args->>'bindings',clock_timestamp()-INTERVAL '30 minutes')));
    v_before:=pg_temp.import_counts(); v_response:=pg_temp.confirm_import(v_attempt); v_after:=pg_temp.import_counts();
    PERFORM pg_temp.assert_confirmation(v_response->>'state'='expired' AND v_response->>'reasonCode'='EXPIRED'
        AND v_before[1:5]=v_after[1:5] AND v_after[6]=v_before[6]+1,'expired before claim');
    -- Seal both absent-client attempts before the winner creates the identity.
    v_duplicate:=jsonb_set(v_args,'{batch}',to_jsonb(pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_args->>'bindings')));
    v_prep_duplicate:=jsonb_set(v_args,'{batch}',to_jsonb(pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_args->>'bindings')));
    v_before:=pg_temp.import_counts(); v_response:=pg_temp.confirm_import(v_args); v_after:=pg_temp.import_counts();
    PERFORM pg_temp.assert_confirmation(v_response->>'state'='succeeded','actual complete success');
    PERFORM public.validate_accession_import_receipt(v_batch);
    PERFORM pg_temp.assert_confirmation(v_after[1]=v_before[1]+1 AND v_after[2]=v_before[2]+1 AND v_after[3]=v_before[3]+1
        AND v_after[4]=v_before[4]+1 AND v_after[5]=v_before[5]+3,'complete graph exact counts');
    PERFORM pg_temp.assert_confirmation((SELECT bool_and(a.changed_by=v_actor AND a.operation='INSERT' AND a.record_id=
        CASE m.kind WHEN 'client' THEN m.client_id WHEN 'sample' THEN m.sample_id ELSE m.result_id END)
        FROM public.accession_import_mappings m JOIN public.audit_logs a ON a.id=m.creation_audit_id WHERE m.batch_id=v_batch),'all exact entity INSERT audit actor links');
    PERFORM pg_temp.assert_confirmation((SELECT bool_and(s.received_at=r.confirmation_received_at AND s.received_by=v_actor
        AND s.sample_quality AND s.status='assigned') FROM public.accession_import_receipts r
        JOIN public.accession_import_mappings m ON m.batch_id=r.batch_id AND m.kind='sample' JOIN public.samples s ON s.id=m.sample_id
        WHERE r.batch_id=v_batch),'one common database receipt time and explicit quality');
    PERFORM pg_temp.assert_confirmation((SELECT bool_and(r.method_id IS NULL AND m.method_id IS NULL AND r.status='pending')
        FROM public.accession_import_mappings m JOIN public.results r ON r.id=m.result_id WHERE m.batch_id=v_batch AND m.kind='assignment'),'approved NULL legacy method UUID');
    PERFORM pg_temp.assert_confirmation(current_setting('request.jwt.claims',true)=v_claims AND current_setting('request.jwt.claim.sub',true)=v_subject
        AND current_setting('request.jwt.claim.role',true)=v_role,'success actor settings restored');
    v_before:=pg_temp.import_counts();
    -- Succeeded must short-circuit even a null/missing entire handoff and rejected attestation.
    v_again:=public.confirm_accession_import(v_actor,v_batch,FALSE,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    PERFORM pg_temp.assert_confirmation(v_again=v_response AND pg_temp.import_counts()=v_before,'same receipt no repeat business or success audit');
    -- Client creation changes old resolver/bindings; losing intent still reports only ALREADY_IMPORTED.
    v_again:=pg_temp.confirm_import(v_duplicate);
    PERFORM pg_temp.assert_confirmation(v_again=jsonb_build_object('state','failed','batchId',v_duplicate->>'batch','reasonCode','ALREADY_IMPORTED'),
        'absent-to-created duplicate loses before resolver authority drift');
    v_again:=pg_temp.confirm_import(v_prep_duplicate,'PREVIEW_CONTENT_CHANGED');
    PERFORM pg_temp.assert_confirmation(v_again=jsonb_build_object('state','failed','batchId',v_prep_duplicate->>'batch','reasonCode','ALREADY_IMPORTED'),
        'controlled preparation drift still private duplicate');
    PERFORM pg_temp.assert_confirmation((SELECT count(*)=1 FROM public.accession_import_receipts WHERE normalized_payload_hash=v_args->'metadata'->>'normalized_payload_hash'),
        'one global successful claim');
END;
$atomic$;
ROLLBACK;
