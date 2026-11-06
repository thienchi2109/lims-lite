-- SOURCE ONLY / NOT RUN. Authorized task11_disposable_* database with migrations through 242 only.
-- Reuses synthetic seed, retains all original guards/RLS/audit and rolls every fixture back.
-- Native worker provisioning and true two-session locks are separate gates in the companion runbook.
\set ON_ERROR_STOP on
\set confirmation_concurrency 1
\ir accession-confirmation-validation.sql

CREATE FUNCTION pg_temp.maintain_as_service() RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_role TEXT:=current_setting('role',true); v_result JSONB;
BEGIN
    PERFORM set_config('role','service_role',true);
    v_result:=public.maintain_accession_import_once();
    PERFORM set_config('role',v_role,true);
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role',v_role,true);
    RAISE;
END;
$$;

DO $maintenance$
DECLARE v_args JSONB; v_actor UUID; v_base UUID; v_live UUID; v_dead UUID; v_expired UUID;
    v_token UUID; v_generation BIGINT; v_result JSONB; v_before JSONB; v_receipt JSONB;
    v_counts BIGINT[]; v_after BIGINT[]; v_denied BOOLEAN; v_audits BIGINT;
BEGIN
    SELECT args INTO STRICT v_args FROM task11_confirmation_args;
    v_actor:=(v_args->>'actor')::UUID; v_base:=(v_args->>'batch')::UUID;
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::TEXT,true);
    -- Forgeable JWT/custom GUCs cannot authorize maintenance for a non-worker actual role.
    v_denied:=FALSE;
    BEGIN PERFORM public.maintain_accession_import_once();
    EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=TRUE; END;
    PERFORM pg_temp.assert_confirmation(v_denied,'actual caller role required despite forged service JWT');
    PERFORM set_config('accession.maintenance','on',true);
    v_denied:=FALSE;
    BEGIN DELETE FROM public.accession_preview_bindings WHERE batch_id=v_base;
    EXCEPTION WHEN OTHERS THEN v_denied:=SQLERRM='ACCESSION_PREVIEW_IMMUTABLE'; END;
    PERFORM pg_temp.assert_confirmation(v_denied,'custom GUC cannot forge private purge capability');

    INSERT INTO public.accession_preview_batches(owner_id,lease_duration_ms,policy_evidence,lease_heartbeat_at,lease_expires_at)
        VALUES(v_actor,60000,'synthetic-only',clock_timestamp(),clock_timestamp()+INTERVAL '1 hour') RETURNING id INTO v_live;
    INSERT INTO public.accession_preview_batches(owner_id,lease_duration_ms,policy_evidence,lease_heartbeat_at,lease_expires_at)
        VALUES(v_actor,1,'synthetic-only',clock_timestamp()-INTERVAL '2 seconds',clock_timestamp()-INTERVAL '1 second')
        RETURNING id,lease_token,lease_generation INTO v_dead,v_token,v_generation;
    v_result:=pg_temp.maintain_as_service();
    PERFORM pg_temp.assert_confirmation(v_result=jsonb_build_object('state','maintained','recovered',TRUE,'expired',FALSE,'purgedBindings',0),
        'abandoned lease recovers exactly once');
    PERFORM pg_temp.assert_confirmation((SELECT state='failed' AND reason_code='PREPARATION_FAILED'
        AND lease_token=v_token AND lease_generation=v_generation FROM public.accession_preview_batches WHERE id=v_dead),
        'terminal state fences abandoned owner without editing immutable generation');
    v_denied:=FALSE;
    BEGIN PERFORM public.heartbeat_accession_preview(v_actor,v_dead,v_token,v_generation);
    EXCEPTION WHEN OTHERS THEN v_denied:=TRUE; END;
    PERFORM pg_temp.assert_confirmation(v_denied,'stale heartbeat cannot resurrect recovered attempt');
    v_denied:=FALSE;
    BEGIN PERFORM public.finish_accession_preview(v_actor,v_dead,v_token,v_generation,'failed','PREPARATION_FAILED');
    EXCEPTION WHEN OTHERS THEN v_denied:=TRUE; END;
    PERFORM pg_temp.assert_confirmation(v_denied,'stale finalization cannot overwrite recovery');
    PERFORM pg_temp.assert_confirmation((SELECT state='preparing' FROM public.accession_preview_batches WHERE id=v_live),'live lease untouched');
    PERFORM pg_temp.assert_confirmation(EXISTS(SELECT 1 FROM public.audit_logs WHERE table_name='accession_preview_batches'
        AND record_id=v_dead AND new_values->>'state'='failed' AND changed_by IS NULL
        AND new_values->>'system_actor'='accession_maintenance_worker'),'system lifecycle actor, not impersonated owner');
    PERFORM pg_temp.assert_confirmation(public.get_accession_import_status(v_actor,v_dead)
        =jsonb_build_object('state','failed','batchId',v_dead),'bare owner-only terminal status without bindings');
    PERFORM pg_temp.assert_confirmation(pg_temp.maintain_as_service()=jsonb_build_object('state','idle'),
        'restart/repeated reconciliation cannot reprocess recovered row or live work');

    v_expired:=pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_args->>'bindings',clock_timestamp()-INTERVAL '31 minutes');
    SELECT to_jsonb(b) INTO v_before FROM public.accession_preview_batches b WHERE id=v_expired;
    v_result:=pg_temp.maintain_as_service();
    PERFORM pg_temp.assert_confirmation(v_result->>'state'='maintained' AND (v_result->>'expired')::BOOLEAN
        AND (v_result->>'purgedBindings')::BIGINT>0,'logical expiry terminalization plus physical purge');
    PERFORM pg_temp.assert_confirmation((SELECT to_jsonb(b)-ARRAY['state','reason_code','finished_at']
        =v_before-ARRAY['state','reason_code','finished_at'] FROM public.accession_preview_batches b WHERE id=v_expired),
        'sealed metadata and binding digest remain byte-for-byte values');
    PERFORM pg_temp.assert_confirmation(NOT EXISTS(SELECT 1 FROM public.accession_preview_bindings WHERE batch_id=v_expired),
        'only transient bindings removed');
    PERFORM pg_temp.assert_confirmation(public.get_accession_import_status(v_actor,v_expired)
        =jsonb_build_object('state','expired','batchId',v_expired),'post-purge reason/count/entity disclosure reduced');
    SELECT count(*) INTO v_audits FROM public.audit_logs;
    PERFORM pg_temp.assert_confirmation(pg_temp.maintain_as_service()=jsonb_build_object('state','idle')
        AND (SELECT count(*)=v_audits FROM public.audit_logs),'purge is idempotent with no duplicate cleanup audit');

    -- A true successful transaction, not a hand-written receipt. Never run full creation validator after purge.
    v_result:=public.confirm_accession_import(v_actor,v_base,TRUE,v_args->'workbook',v_args->'snapshot',v_args->'clients',
        v_args->'expected',v_args->>'canonical',v_args->>'bindings',v_args->'metadata',NULL);
    PERFORM pg_temp.assert_confirmation(v_result->>'state'='succeeded','synthetic atomic confirmation succeeds');
    v_receipt:=public.get_accession_import_status(v_actor,v_base);
    SELECT ARRAY[(SELECT count(*) FROM public.accession_import_receipts),(SELECT count(*) FROM public.accession_import_mappings),
        (SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),(SELECT count(*) FROM public.results)] INTO v_counts;
    SELECT to_jsonb(b) INTO v_before FROM public.accession_preview_batches b WHERE id=v_base;
    v_result:=pg_temp.maintain_as_service();
    SELECT ARRAY[(SELECT count(*) FROM public.accession_import_receipts),(SELECT count(*) FROM public.accession_import_mappings),
        (SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),(SELECT count(*) FROM public.results)] INTO v_after;
    PERFORM pg_temp.assert_confirmation(v_result->>'state'='maintained' AND v_counts=v_after,'success purge retains receipt/dedup/mapping/business rows');
    PERFORM pg_temp.assert_confirmation((SELECT to_jsonb(b)=v_before FROM public.accession_preview_batches b WHERE id=v_base)
        AND public.get_accession_import_status(v_actor,v_base)=v_receipt,'durable metadata and file-free receipt survive cleanup');
    PERFORM pg_temp.assert_confirmation(NOT EXISTS(SELECT 1 FROM public.accession_import_maintenance_authorizations),
        'private capability removed before every successful return');
    PERFORM pg_temp.assert_confirmation(public.test_accession_import_maintenance_security(),'effective maintenance privileges/security');
END;
$maintenance$;

-- Disposable failure injection only: never disable/replace an original audit or guard trigger.
CREATE FUNCTION pg_temp.reject_maintenance_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.new_values->>'system_actor'='accession_maintenance_worker' THEN
        RAISE EXCEPTION 'synthetic audit unavailable' USING ERRCODE='Z0242';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER task12_reject_maintenance_audit BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_maintenance_audit();
DO $atomic_audit$
DECLARE v_args JSONB; v_id UUID; v_state TEXT; v_before JSONB; v_count BIGINT; v_audits BIGINT; v_failed BOOLEAN;
BEGIN
    SELECT args INTO STRICT v_args FROM task11_confirmation_args;
    FOREACH v_state IN ARRAY ARRAY['preview_ready','failed'] LOOP
      BEGIN
        v_id:=pg_temp.seed_confirmation((v_args->>'actor')::UUID,v_args->'metadata',v_args->>'bindings',clock_timestamp()-INTERVAL '31 minutes');
        IF v_state='failed' THEN
            UPDATE public.accession_preview_batches SET state='failed',reason_code='CONFIRMATION_FAILED',finished_at=clock_timestamp() WHERE id=v_id;
        END IF;
        SELECT to_jsonb(b) INTO v_before FROM public.accession_preview_batches b WHERE id=v_id;
        SELECT count(*) INTO v_count FROM public.accession_preview_bindings WHERE batch_id=v_id;
        SELECT count(*) INTO v_audits FROM public.audit_logs;
        v_failed:=FALSE;
        BEGIN PERFORM pg_temp.maintain_as_service();
        EXCEPTION WHEN SQLSTATE 'Z0242' THEN v_failed:=TRUE; END;
        PERFORM pg_temp.assert_confirmation(v_failed AND (SELECT to_jsonb(b)=v_before FROM public.accession_preview_batches b WHERE id=v_id)
            AND (SELECT count(*)=v_count FROM public.accession_preview_bindings WHERE batch_id=v_id)
            AND (SELECT count(*)=v_audits FROM public.audit_logs)
            AND NOT EXISTS(SELECT 1 FROM public.accession_import_maintenance_authorizations),
            'lifecycle or cleanup audit failure rolls state, purge and capability back atomically');
        RAISE EXCEPTION 'rollback audit failure fixture case' USING ERRCODE='Z0243';
      EXCEPTION WHEN SQLSTATE 'Z0243' THEN NULL;
      END;
    END LOOP;
END;
$atomic_audit$;
DROP TRIGGER task12_reject_maintenance_audit ON public.audit_logs;
DO $privacy$
DECLARE v_args JSONB; v_batch UUID; v_client UUID; v_assay UUID; v_bindings JSONB; v_item JSONB; v_changed JSONB:='[]';
    v_actor UUID; v_denied BOOLEAN; v_id UUID;
BEGIN
    SELECT args INTO STRICT v_args FROM task11_confirmation_args;
    v_actor:=(v_args->>'actor')::UUID; v_batch:=(v_args->>'batch')::UUID;
    SELECT client_id,assay_id INTO STRICT v_client,v_assay FROM public.accession_import_mappings
        WHERE batch_id=v_batch AND kind='assignment' ORDER BY row_number LIMIT 1;
    UPDATE public.users SET can_access_confidential=FALSE WHERE id=v_actor;
    UPDATE public.assay_definitions SET is_confidential=TRUE WHERE id=v_assay;
    v_bindings:=(v_args->>'bindings')::JSONB;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_bindings) LOOP
        IF v_item->>0='client' THEN
            v_item:=jsonb_set(jsonb_set(v_item,'{7}','"matched"'),'{8}',to_jsonb(v_client));
        END IF;
        v_changed:=v_changed||jsonb_build_array(v_item);
    END LOOP;
    v_id:=pg_temp.seed_confirmation(v_actor,v_args->'metadata',v_changed::TEXT);
    UPDATE public.accession_preview_batches SET state='failed',reason_code='CLIENT_INVALID',finished_at=clock_timestamp() WHERE id=v_id;
    v_denied:=FALSE;
    BEGIN PERFORM public.get_accession_import_status(v_actor,v_id);
    EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=TRUE; END;
    PERFORM pg_temp.assert_confirmation(v_denied,'current confidential binding denied before purge');
    -- Repeated invocations cover all eligible rows without retaining expired source links.
    WHILE EXISTS(SELECT 1 FROM public.accession_preview_bindings WHERE batch_id=v_id) LOOP
        PERFORM pg_temp.maintain_as_service();
    END LOOP;
    PERFORM pg_temp.assert_confirmation(public.get_accession_import_status(v_actor,v_id)
        =jsonb_build_object('state','failed','batchId',v_id),'no reason/count/entity data after confidential transient link purge');
    v_denied:=FALSE;
    BEGIN PERFORM public.get_accession_import_status(v_actor,v_batch);
    EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=TRUE; END;
    PERFORM pg_temp.assert_confirmation(v_denied,'durable success mappings still enforce current confidentiality after purge');
END;
$privacy$;
ROLLBACK;
