-- Migration 235 PARTIAL rollback-only schema/RLS fixture. NOT RUN in this source workspace.
-- Requires 234/235 and an existing published eligible confidential assay/sample-type pair.
-- Pending deferred receipt/mapping rows never represent committed success; 234 guard stays intact.
-- No existing catalog/business rows are changed; positive success/full graph checks await Phase 3.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO public, pg_temp;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE FUNCTION pg_temp.assert_provenance(p_ok BOOLEAN,p_message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'provenance assertion: %',p_message; END IF; END;
$$;
DO $behavior$
DECLARE
    v_owner UUID := '95500000-0000-4000-8000-000000000001';
    v_other UUID := '95500000-0000-4000-8000-000000000002';
    v_manager UUID := '95500000-0000-4000-8000-000000000003';
    v_client UUID := '95500000-0000-4000-8000-000000000011';
    v_second_client UUID := '95500000-0000-4000-8000-000000000012';
    v_batch UUID := '95500000-0000-4000-8000-000000000021';
    v_other_batch UUID := '95500000-0000-4000-8000-000000000022';
    v_third_batch UUID := '95500000-0000-4000-8000-000000000023';
    v_sample UUID; v_sample_audit UUID; v_result UUID; v_result_audit UUID; v_type UUID; v_assay UUID; v_method UUID; v_code TEXT;
    v_snapshot JSONB; v_id UUID; v_denied BOOLEAN; v_constraint TEXT; v_count BIGINT;
    v_before BIGINT[]; v_after BIGINT[]; v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    SELECT ARRAY[(SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),
        (SELECT count(*) FROM public.results),(SELECT count(*) FROM public.accession_import_receipts)] INTO v_before;
    INSERT INTO auth.users(id,email) VALUES (v_owner,'provenance235-owner@lims.local'),
        (v_other,'provenance235-other@lims.local'),(v_manager,'provenance235-manager@lims.local');
    INSERT INTO public.users(id,username,full_name,role,email,can_access_confidential) VALUES
        (v_owner,'provenance235_owner','Synthetic owner','analyst','provenance235-owner@lims.local',TRUE),
        (v_other,'provenance235_other','Synthetic other','analyst','provenance235-other@lims.local',FALSE),
        (v_manager,'provenance235_manager','Synthetic manager','manager','provenance235-manager@lims.local',FALSE);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::TEXT,true);
    PERFORM set_config('request.jwt.claim.sub',v_owner::TEXT,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    v_snapshot := public.get_accession_template_snapshot();
    SELECT (pair->>'sampleTypeId')::UUID,assay.id,assay.method_id,assay.import_code INTO v_type,v_assay,v_method,v_code
    FROM jsonb_array_elements(v_snapshot->'pairs') pair
    JOIN public.assay_definitions assay ON assay.id=(pair->>'assayDefinitionId')::UUID
    WHERE assay.is_confidential ORDER BY assay.id LIMIT 1;
    IF v_assay IS NULL THEN RAISE EXCEPTION 'Fixture 235 requires a published eligible confidential pair'; END IF;
    INSERT INTO public.clients(id,id_card_num,name,date_of_birth,gender,phone) VALUES
        (v_client,'','Synthetic Provenance235 Confidential','2000-01-01','Nam','0398765432'),
        (v_second_client,'','Synthetic Provenance235 Other','2001-01-01','Nam','0398765433');
    INSERT INTO public.samples(sample_id,client_id,sample_type_id,sample_quality,received_by,status)
    VALUES ('PROVENANCE235-SYNTHETIC',v_client,v_type,TRUE,v_owner,'assigned') RETURNING id INTO v_sample;
    INSERT INTO public.results(sample_id,assay_id,method_id,status) VALUES (v_sample,v_assay,v_method,'pending') RETURNING id INTO v_result;
    SELECT id INTO STRICT v_sample_audit FROM public.audit_logs WHERE table_name='samples' AND record_id=v_sample AND operation='INSERT';
    SELECT id INTO STRICT v_result_audit FROM public.audit_logs WHERE table_name='results' AND record_id=v_result AND operation='INSERT';

    -- Seed protected metadata with all historical triggers enabled; no success transition is attempted.
    FOREACH v_id IN ARRAY ARRAY[v_batch,v_other_batch,v_third_batch] LOOP
        INSERT INTO public.accession_preview_batches(id,owner_id,state,lease_duration_ms,policy_evidence,
            lease_heartbeat_at,lease_expires_at,preview_created_at,expires_at,source_sha256,source_size,
            normalized_payload_hash,canonicalization_version,template_version,template_digest,template_claims_digest,
            catalog_digest,revision,validation_version,resolver_version,binding_set_digest,
            client_count,sample_count,assignment_count,create_count,reuse_count)
        VALUES (v_id,CASE WHEN v_id=v_other_batch THEN v_other ELSE v_owner END,'preview_ready',60000,'synthetic-only',
            v_now,v_now+INTERVAL '1 minute',v_now,v_now+INTERVAL '30 minutes',repeat('a',64),123,
            CASE WHEN v_id=v_other_batch THEN repeat('b',64) ELSE repeat('a',64) END,
            'accession-intent-v1','1',repeat('c',64),repeat('d',64),repeat('e',64),1,
            'accession-workbook-v1','accession-preview-clients-v1',repeat('f',64),1,1,1,0,1);
    END LOOP;
    INSERT INTO public.accession_import_receipts VALUES (v_batch,v_owner,repeat('a',64),v_now,1,1,1,0,1),
        (v_other_batch,v_other,repeat('b',64),v_now,1,1,1,0,1);
    INSERT INTO public.accession_import_mappings(batch_id,kind,row_number,temporary_reference,client_id,outcome)
    VALUES (v_batch,'client',2,'KH-001',v_client,'reused'),(v_other_batch,'client',2,'KH-002',v_second_client,'reused');

    v_denied:=false;
    BEGIN INSERT INTO public.accession_import_receipts VALUES (v_third_batch,v_owner,repeat('a',64),v_now,1,1,1,0,1);
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
        v_denied:=v_constraint='accession_import_receipts_normalized_payload_hash_key';
    END;
    PERFORM pg_temp.assert_provenance(v_denied,'duplicate intent uses global hash uniqueness');
    v_denied:=false;
    BEGIN INSERT INTO public.accession_import_mappings(batch_id,kind,row_number,temporary_reference,client_id,outcome)
        VALUES(v_batch,'client',3,'invalid ref',v_second_client,'reused');
    EXCEPTION WHEN check_violation THEN v_denied:=true; END;
    PERFORM pg_temp.assert_provenance(v_denied,'invalid reference shape rejected');
    v_denied:=false;
    BEGIN INSERT INTO public.accession_import_mappings(batch_id,kind,row_number,temporary_reference,client_id,outcome)
        VALUES(v_batch,'client',3,'KH-001',v_second_client,'reused');
    EXCEPTION WHEN unique_violation THEN v_denied:=true; END;
    PERFORM pg_temp.assert_provenance(v_denied,'same-kind reference namespace unique');
    v_denied:=false;
    BEGIN INSERT INTO public.accession_import_mappings(batch_id,kind,row_number,temporary_reference,parent_kind,parent_row,
        parent_temporary_reference,client_id,sample_id,official_sample_identifier,creation_audit_id)
        VALUES(v_batch,'sample',2,'M-001','client',999,'MISSING',v_client,v_sample,'PROVENANCE235-SYNTHETIC',v_sample_audit);
    EXCEPTION WHEN foreign_key_violation THEN v_denied:=true; END;
    PERFORM pg_temp.assert_provenance(v_denied,'same-batch typed parent FK enforced');
    INSERT INTO public.accession_import_mappings(batch_id,kind,row_number,temporary_reference,parent_kind,parent_row,
        parent_temporary_reference,client_id,sample_id,official_sample_identifier,creation_audit_id)
    VALUES(v_batch,'sample',2,'M-001','client',2,'KH-001',v_client,v_sample,'PROVENANCE235-SYNTHETIC',v_sample_audit);
    INSERT INTO public.accession_import_mappings(batch_id,kind,row_number,parent_kind,parent_row,parent_temporary_reference,
        client_id,sample_id,result_id,assay_id,method_id,assay_import_code,creation_audit_id)
    VALUES(v_batch,'assignment',2,'sample',2,'M-001',v_client,v_sample,v_result,v_assay,v_method,v_code,v_result_audit);
    v_denied:=false;
    BEGIN UPDATE public.accession_import_receipts SET reuse_count=0 WHERE batch_id=v_batch;
    EXCEPTION WHEN raise_exception THEN v_denied:=SQLERRM='ACCESSION_IMPORT_IMMUTABLE'; END;
    PERFORM pg_temp.assert_provenance(v_denied,'receipt immutable');
    v_denied:=false;
    BEGIN DELETE FROM public.accession_import_mappings WHERE batch_id=v_batch;
    EXCEPTION WHEN raise_exception THEN v_denied:=SQLERRM='ACCESSION_IMPORT_IMMUTABLE'; END;
    PERFORM pg_temp.assert_provenance(v_denied,'mapping immutable');
    v_denied:=false;
    BEGIN PERFORM public.validate_accession_import_receipt(v_batch);
    EXCEPTION WHEN raise_exception THEN v_denied:=SQLERRM='ACCESSION_IMPORT_INCOMPLETE'; END;
    PERFORM pg_temp.assert_provenance(v_denied,'explicit validator rejects unbacked success');
    v_denied:=false;
    BEGIN SET CONSTRAINTS accession_import_receipt_complete IMMEDIATE;
    EXCEPTION WHEN raise_exception THEN v_denied:=SQLERRM='ACCESSION_IMPORT_INCOMPLETE'; END;
    PERFORM pg_temp.assert_provenance(v_denied,'deferred safety belt rejects unbacked success');

    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM public.accession_import_receipts;
    PERFORM pg_temp.assert_provenance(v_count=1,'analyst owns only one receipt');
    SELECT count(*) INTO v_count FROM public.accession_import_mappings;
    PERFORM pg_temp.assert_provenance(v_count=3,'authorized owner client/sample/assignment mappings visible');
    v_denied:=false;
    BEGIN PERFORM normalized_payload_hash FROM public.accession_import_receipts;
    EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
    PERFORM pg_temp.assert_provenance(v_denied,'intent hash column hidden');
    v_denied:=false;
    BEGIN PERFORM public.validate_accession_import_receipt(v_batch);
    EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
    PERFORM pg_temp.assert_provenance(v_denied,'private validator not callable');
    v_denied:=false;
    BEGIN INSERT INTO public.accession_import_receipts(batch_id) VALUES(gen_random_uuid());
    EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
    PERFORM pg_temp.assert_provenance(v_denied,'browser receipt write denied');
    v_denied:=false;
    BEGIN INSERT INTO public.accession_import_mappings(batch_id) VALUES(v_batch);
    EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
    PERFORM pg_temp.assert_provenance(v_denied,'browser mapping write denied');
    SET LOCAL ROLE service_role;
    v_denied:=false;
    BEGIN INSERT INTO public.accession_import_receipts(batch_id) VALUES(gen_random_uuid());
    EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
    PERFORM pg_temp.assert_provenance(v_denied,'service direct receipt write denied');
    SET LOCAL ROLE postgres;

    UPDATE public.samples SET deleted_at=clock_timestamp() WHERE id=v_sample;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM public.accession_import_mappings;
    PERFORM pg_temp.assert_provenance(v_count=1,'sample deletion hides sample and assignment mappings');
    SET LOCAL ROLE postgres;
    UPDATE public.samples SET deleted_at=NULL WHERE id=v_sample;
    UPDATE public.users SET can_access_confidential=FALSE WHERE id=v_owner;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM public.results WHERE id=v_result;
    PERFORM pg_temp.assert_provenance(v_count=0,'current result RLS denies confidential assignment');
    SELECT count(*) INTO v_count FROM public.accession_import_mappings;
    PERFORM pg_temp.assert_provenance(v_count=0,'confidential privilege withdrawal hides owner mappings');
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_manager,'role','authenticated')::TEXT,true);
    PERFORM set_config('request.jwt.claim.sub',v_manager::TEXT,true);
    SELECT count(*) INTO v_count FROM public.accession_import_receipts;
    PERFORM pg_temp.assert_provenance(v_count=2,'active manager history visible without preview grant');
    SELECT count(*) INTO v_count FROM public.accession_import_mappings;
    PERFORM pg_temp.assert_provenance(v_count=1,'manager without confidential flag cannot read restricted mapping');
    SET LOCAL ROLE postgres;
    UPDATE public.users SET deleted_at=clock_timestamp() WHERE id=v_manager;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM public.accession_import_receipts;
    PERFORM pg_temp.assert_provenance(v_count=0,'deactivated manager history denied');
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::TEXT,true);
    PERFORM set_config('request.jwt.claim.sub',v_other::TEXT,true);
    SELECT count(*) INTO v_count FROM public.accession_import_mappings;
    PERFORM pg_temp.assert_provenance(v_count=1,'other actor sees only own mapping');
    SET LOCAL ROLE postgres;
    UPDATE public.clients SET deleted_at=clock_timestamp(),deleted_by=v_other WHERE id=v_second_client;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM public.accession_import_mappings;
    PERFORM pg_temp.assert_provenance(v_count=0,'deactivated client details hidden');
    SELECT count(*) INTO v_count FROM public.accession_import_receipts;
    PERFORM pg_temp.assert_provenance(v_count=1,'safe receipt survives client deactivation');
    SET LOCAL ROLE postgres;
    UPDATE public.users SET role='doctor' WHERE id=v_other;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM public.accession_import_receipts;
    PERFORM pg_temp.assert_provenance(v_count=0,'withdrawn analyst role denied');
    SET LOCAL ROLE postgres;
    SELECT ARRAY[(SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),
        (SELECT count(*) FROM public.results),(SELECT count(*) FROM public.accession_import_receipts)] INTO v_after;
    PERFORM pg_temp.assert_provenance(v_after=ARRAY[v_before[1]+2,v_before[2]+1,v_before[3]+1,v_before[4]+2],
        'only named pending fixture rows exist; whole transaction will roll back');
END;
$behavior$;
ROLLBACK;
