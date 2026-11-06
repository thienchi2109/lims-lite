-- SOURCE ONLY / NOT RUN. Authorized task11_disposable_* DB with 235->238->239->240->241 only.
-- Production-shaped parent/child eligibility through real RPCs; no disabled RLS/audit/immutability guards.
-- The shared synthetic seed starts one transaction; all parent/child/business/audit rows ROLLBACK.
\set ON_ERROR_STOP on
\set confirmation_concurrency 1
\ir accession-confirmation-validation.sql

CREATE FUNCTION pg_temp.assert_linked_retry(p_actor UUID,p_parent UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_before JSONB; v_child JSONB; v_audits BIGINT;
BEGIN
    SELECT to_jsonb(b) INTO STRICT v_before FROM public.accession_preview_batches b WHERE id=p_parent;
    SELECT count(*) INTO v_audits FROM public.audit_logs WHERE record_id=p_parent;
    v_child:=public.start_accession_preview(p_actor,p_parent,60000,'synthetic-retry-only');
    PERFORM pg_temp.assert_confirmation((SELECT owner_id=p_actor AND retry_of=p_parent AND state='preparing'
        FROM public.accession_preview_batches WHERE id=(v_child->>'id')::UUID),'child has same owner and explicit retry_of');
    PERFORM pg_temp.assert_confirmation((SELECT to_jsonb(b)=v_before FROM public.accession_preview_batches b WHERE id=p_parent)
        AND (SELECT count(*)=v_audits FROM public.audit_logs WHERE record_id=p_parent),'parent remains unchanged');
END;
$$;

CREATE FUNCTION pg_temp.assert_retry_denied(p_actor UUID,p_parent UUID,p_sqlstate TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_count BIGINT; v_denied BOOLEAN:=FALSE;
BEGIN
    SELECT count(*) INTO v_count FROM public.accession_preview_batches;
    BEGIN
        PERFORM public.start_accession_preview(p_actor,p_parent,60000,'synthetic-retry-only');
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE IS DISTINCT FROM p_sqlstate THEN RAISE; END IF;
        v_denied:=TRUE;
    END;
    PERFORM pg_temp.assert_confirmation(v_denied AND (SELECT count(*)=v_count FROM public.accession_preview_batches),
        'retry denial allocates no child');
END;
$$;

DO $retry$
DECLARE v_args JSONB; v_actor UUID; v_parent UUID; v_ready UUID; v_new JSONB; v_state TEXT; v_result JSONB;
BEGIN
    SELECT args INTO STRICT v_args FROM task11_confirmation_args;
    v_actor:=(v_args->>'actor')::UUID; v_ready:=(v_args->>'batch')::UUID;
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
    -- Valid unlocked preview_ready supports explicit replacement after source loss; it is not reset.
    PERFORM pg_temp.assert_linked_retry(v_actor,v_ready);
    PERFORM pg_temp.assert_confirmation(NOT EXISTS(SELECT 1 FROM public.accession_import_receipts WHERE batch_id=v_ready)
        AND NOT EXISTS(SELECT 1 FROM public.accession_import_mappings WHERE batch_id=v_ready),'no official IDs before commit');
    v_parent:=pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_args->>'bindings',clock_timestamp()-INTERVAL '30 minutes');
    PERFORM pg_temp.assert_confirmation(public.get_accession_import_status(v_actor,v_parent)->>'state'='expired','logical expiry observed');
    PERFORM pg_temp.assert_linked_retry(v_actor,v_parent);
    -- Actual terminal rejected/failed states never transition back into preparing.
    FOREACH v_state IN ARRAY ARRAY['rejected','failed'] LOOP
        v_new:=public.start_accession_preview(v_actor,NULL,60000,'synthetic-retry-only');
        v_parent:=(v_new->>'id')::UUID;
        PERFORM public.finish_accession_preview(v_actor,v_parent,(v_new->>'lease_token')::UUID,
            (v_new->>'lease_generation')::BIGINT,v_state,CASE WHEN v_state='rejected' THEN 'WORKBOOK_INVALID' ELSE 'PREPARATION_FAILED' END);
        PERFORM pg_temp.assert_linked_retry(v_actor,v_parent);
    END LOOP;
    v_parent:=pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_args->>'bindings');
    UPDATE public.accession_preview_batches SET state='expired',reason_code='EXPIRED',finished_at=clock_timestamp() WHERE id=v_parent;
    PERFORM pg_temp.assert_linked_retry(v_actor,v_parent);
    -- A different analyst, manager, missing batch and withdrawn owner cannot obtain a linked child.
    PERFORM pg_temp.assert_retry_denied('95600000-0000-4000-8000-000000000002',v_ready,'42501');
    PERFORM pg_temp.assert_retry_denied('95600000-0000-4000-8000-000000000003',v_ready,'42501');
    PERFORM pg_temp.assert_retry_denied(v_actor,gen_random_uuid(),'42501');
    BEGIN
        UPDATE public.users SET role='manager' WHERE id=v_actor;
        PERFORM pg_temp.assert_retry_denied(v_actor,v_ready,'42501');
        RAISE EXCEPTION 'restore actor' USING ERRCODE='Z0241';
    EXCEPTION WHEN SQLSTATE 'Z0241' THEN NULL; END;
    v_new:=public.start_accession_preview(v_actor,NULL,60000,'synthetic-retry-only');
    PERFORM pg_temp.assert_retry_denied(v_actor,(v_new->>'id')::UUID,'55000');
    -- A committed receipt is authoritative: retry cannot make another attempt after success.
    v_result:=public.confirm_accession_import(v_actor,v_ready,TRUE,v_args->'workbook',v_args->'snapshot',v_args->'clients',
        v_args->'expected',v_args->>'canonical',v_args->>'bindings',v_args->'metadata',NULL);
    PERFORM pg_temp.assert_confirmation(v_result->>'state'='succeeded','actual atomic fixture succeeds');
    PERFORM pg_temp.assert_retry_denied(v_actor,v_ready,'55000');
    PERFORM pg_temp.assert_confirmation(public.get_accession_import_status(v_actor,v_ready)=v_result,'file-free durable receipt after lost response');
    PERFORM pg_temp.assert_confirmation(public.test_accession_preview_retry_security(),'closed linked retry ACL/security');
END;
$retry$;
ROLLBACK;
