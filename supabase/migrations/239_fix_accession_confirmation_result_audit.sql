-- Migration 239: link imported results to their canonical full-row INSERT audit.
-- Security impact: preserves exact actor/record checks, both historical audit events and service-only RPC grants.
-- Requires the verified 238 baseline; historical 233-238 remain immutable.
-- Methodless pending results also emit a note audit without an id field (migration 065).
-- Keep INTO STRICT: duplicate canonical full-row events must still fail atomically.
BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $baseline$
BEGIN
    IF current_setting('check_function_bodies')::BOOLEAN IS DISTINCT FROM TRUE
       OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
           WHERE oid=to_regprocedure('public.confirm_accession_import(uuid,uuid,boolean,jsonb,jsonb,jsonb,jsonb,text,text,jsonb,text)'))
          IS DISTINCT FROM '53c657c987d434435783652def29b185959c0d1df2629b6472333689e79c57c7'
       OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
           WHERE oid=to_regprocedure('public.validate_accession_confirmation_locked(uuid,uuid,boolean,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)'))
          IS DISTINCT FROM '6df2835d7d192c358af8d54c096eee1ed1d767c6b0808f9d1608ddb153173f37' THEN
        RAISE EXCEPTION 'Migration 239 requires the verified 238 functions and checked function bodies';
    END IF;
    IF public.test_accession_import_provenance_security() IS DISTINCT FROM TRUE
       OR public.test_accession_confirmation_validation_security() IS DISTINCT FROM TRUE
       OR public.test_accession_confirmation_atomic_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 239 security baseline mismatch';
    END IF;
END;
$baseline$;

CREATE OR REPLACE FUNCTION public.confirm_accession_import(p_actor UUID,p_batch UUID,p_attested BOOLEAN,p_workbook JSONB,p_snapshot JSONB,
    p_clients JSONB,p_expected_clients JSONB,p_canonical_intent TEXT,p_bindings_text TEXT,p_metadata JSONB,p_preparation_failure TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch public.accession_preview_batches; v_received TIMESTAMPTZ; v_row JSONB; v_plan JSONB;
    v_parent public.accession_import_mappings; v_client UUID; v_sample UUID; v_result UUID; v_audit UUID; v_official TEXT;
    v_binding public.accession_preview_bindings; v_claims TEXT; v_subject TEXT; v_role TEXT;
    v_state TEXT:='failed'; v_reason TEXT; v_error_state TEXT; v_constraint TEXT;
BEGIN
    PERFORM public.authorize_accession_preview_actor(p_actor);
    SELECT * INTO v_batch FROM public.accession_preview_batches WHERE id=p_batch AND owner_id=p_actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_CONFIRMATION_FORBIDDEN' USING ERRCODE='42501'; END IF;
    IF v_batch.state='succeeded' THEN
        RETURN jsonb_build_object('state','succeeded','receipt',public.get_accession_confirmation_preparation(p_actor,p_batch)->'receipt');
    END IF;
    IF v_batch.state <> 'preview_ready' THEN RAISE EXCEPTION 'ACCESSION_CONFIRMATION_TERMINAL'; END IF;
    IF p_preparation_failure IS NOT NULL AND p_preparation_failure NOT IN
       ('PREVIEW_CONTENT_CHANGED','AUTHORITY_CHANGED','ATTESTATION_REQUIRED','CONFIGURATION_UNAVAILABLE') THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
    END IF;
    -- Private sealed-hash detection also handles an earlier winner creating a formerly absent client.
    IF EXISTS(SELECT 1 FROM public.accession_import_receipts WHERE normalized_payload_hash=v_batch.normalized_payload_hash) THEN
        v_reason:='ALREADY_IMPORTED';
    ELSIF p_preparation_failure IS NOT NULL THEN v_reason:=p_preparation_failure;
    ELSE
        v_claims:=current_setting('request.jwt.claims',true);
        v_subject:=current_setting('request.jwt.claim.sub',true); v_role:=current_setting('request.jwt.claim.role',true);
        v_reason:='AUTHORITY_CHANGED';
        BEGIN
            -- ponytail: serialize all ID generators before sample exclusion to avoid the existing
            -- single-accession counter-row -> samples inversion. TASK-7 must measure this global ceiling.
            LOCK TABLE public.sample_id_sequences IN SHARE ROW EXCLUSIVE MODE;
            v_received:=public.validate_accession_confirmation_locked(p_actor,p_batch,p_attested,p_workbook,p_snapshot,p_clients,
                p_expected_clients,p_canonical_intent,p_bindings_text,p_metadata);
            v_reason:='CONFIRMATION_FAILED';
            PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::TEXT,true);
            PERFORM set_config('request.jwt.claim.sub',p_actor::TEXT,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
            INSERT INTO public.accession_import_receipts(batch_id,owner_id,normalized_payload_hash,confirmation_received_at,
                client_count,sample_count,assignment_count,create_count,reuse_count)
            VALUES(p_batch,p_actor,v_batch.normalized_payload_hash,v_received,v_batch.client_count,v_batch.sample_count,
                v_batch.assignment_count,v_batch.create_count,v_batch.reuse_count);
            FOR v_row IN SELECT value FROM jsonb_array_elements(p_workbook->'clients') ORDER BY (value->'callerContext'->>'row')::BIGINT LOOP
                SELECT value INTO STRICT v_plan FROM jsonb_array_elements(p_expected_clients) WHERE value->>'row'=v_row->'callerContext'->>'row';
                v_audit:=NULL;
                IF v_plan->'resolution'->>'outcome'='not_found' THEN
                    INSERT INTO public.clients(id_card_num,name,date_of_birth,gender,phone,address,health_insurance_num,expiry_date)
                    VALUES(COALESCE(v_row->>'governmentIdentityValue',''),btrim(v_row->>'name'),(v_row->>'dateOfBirth')::DATE,
                        v_row->>'gender',v_row->>'phone',v_row->>'address',v_row->>'healthInsuranceNum',(v_row->>'expiryDate')::DATE) RETURNING id INTO v_client;
                    SELECT id INTO STRICT v_audit FROM public.audit_logs WHERE table_name='clients' AND record_id=v_client AND operation='INSERT' AND changed_by=p_actor;
                ELSE v_client:=(v_plan->'resolution'->>'clientId')::UUID; END IF;
                INSERT INTO public.accession_import_mappings(batch_id,kind,row_number,temporary_reference,client_id,outcome,creation_audit_id)
                VALUES(p_batch,'client',(v_row->'callerContext'->>'row')::BIGINT,v_row->>'temporaryReference',v_client,
                    CASE WHEN v_plan->'resolution'->>'outcome'='not_found' THEN 'created' ELSE 'reused' END,v_audit);
            END LOOP;
            FOR v_row IN SELECT value FROM jsonb_array_elements(p_workbook->'samples') ORDER BY (value->'callerContext'->>'row')::BIGINT LOOP
                SELECT * INTO STRICT v_parent FROM public.accession_import_mappings WHERE batch_id=p_batch AND kind='client' AND temporary_reference=v_row->>'clientTemporaryReference';
                SELECT * INTO STRICT v_binding FROM public.accession_preview_bindings WHERE batch_id=p_batch AND kind='sample' AND row_number=(v_row->'callerContext'->>'row')::BIGINT;
                v_official:=public.generate_next_sample_id();
                INSERT INTO public.samples(sample_id,client_id,client_name,sample_type_id,sample_quality,received_at,received_by,status)
                VALUES(v_official,v_parent.client_id,(SELECT name FROM public.clients WHERE id=v_parent.client_id),v_binding.entity_id,TRUE,v_received,p_actor,'assigned') RETURNING id INTO v_sample;
                SELECT id INTO STRICT v_audit FROM public.audit_logs WHERE table_name='samples' AND record_id=v_sample AND operation='INSERT' AND changed_by=p_actor;
                INSERT INTO public.accession_import_mappings(batch_id,kind,row_number,temporary_reference,parent_kind,parent_row,parent_temporary_reference,
                    client_id,sample_id,official_sample_identifier,creation_audit_id)
                VALUES(p_batch,'sample',(v_row->'callerContext'->>'row')::BIGINT,v_row->>'temporaryReference','client',v_parent.row_number,v_parent.temporary_reference,
                    v_parent.client_id,v_sample,v_official,v_audit);
            END LOOP;
            FOR v_row IN SELECT value FROM jsonb_array_elements(p_workbook->'assignments') ORDER BY (value->'callerContext'->>'row')::BIGINT LOOP
                SELECT * INTO STRICT v_parent FROM public.accession_import_mappings WHERE batch_id=p_batch AND kind='sample' AND temporary_reference=v_row->>'sampleTemporaryReference';
                SELECT * INTO STRICT v_binding FROM public.accession_preview_bindings WHERE batch_id=p_batch AND kind='assignment' AND row_number=(v_row->'callerContext'->>'row')::BIGINT;
                INSERT INTO public.results(sample_id,assay_id,method_id,status) VALUES(v_parent.sample_id,v_binding.entity_id,NULL,'pending') RETURNING id INTO v_result;
                SELECT id INTO STRICT v_audit FROM public.audit_logs WHERE table_name='results' AND record_id=v_result AND operation='INSERT' AND changed_by=p_actor AND new_values->>'id'=v_result::TEXT;
                INSERT INTO public.accession_import_mappings(batch_id,kind,row_number,parent_kind,parent_row,parent_temporary_reference,
                    client_id,sample_id,result_id,assay_id,method_id,assay_import_code,creation_audit_id)
                VALUES(p_batch,'assignment',(v_row->'callerContext'->>'row')::BIGINT,'sample',v_parent.row_number,v_parent.temporary_reference,
                    v_parent.client_id,v_parent.sample_id,v_result,v_binding.entity_id,NULL,v_binding.import_code,v_audit);
            END LOOP;
            UPDATE public.accession_preview_batches SET state='succeeded',reason_code=NULL,finished_at=clock_timestamp() WHERE id=p_batch;
            PERFORM public.validate_accession_import_receipt(p_batch);
            PERFORM set_config('request.jwt.claims',COALESCE(v_claims,''),true);
            PERFORM set_config('request.jwt.claim.sub',COALESCE(v_subject,''),true); PERFORM set_config('request.jwt.claim.role',COALESCE(v_role,''),true);
            RETURN jsonb_build_object('state','succeeded','receipt',public.get_accession_confirmation_preparation(p_actor,p_batch)->'receipt');
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_error_state=RETURNED_SQLSTATE,v_constraint=CONSTRAINT_NAME;
            PERFORM set_config('request.jwt.claims',COALESCE(v_claims,''),true);
            PERFORM set_config('request.jwt.claim.sub',COALESCE(v_subject,''),true); PERFORM set_config('request.jwt.claim.role',COALESCE(v_role,''),true);
            -- Unique SQLSTATE '23505' or committed winner after waiting: never expose winner details.
            IF (v_error_state='23505' AND v_constraint='accession_import_receipts_normalized_payload_hash_key')
               OR EXISTS(SELECT 1 FROM public.accession_import_receipts WHERE normalized_payload_hash=v_batch.normalized_payload_hash) THEN
                v_reason:='ALREADY_IMPORTED';
            ELSIF v_received IS NULL AND clock_timestamp()>=v_batch.expires_at THEN v_state:='expired'; v_reason:='EXPIRED'; END IF;
        END;
    END IF;
    UPDATE public.accession_preview_batches SET state=v_state,reason_code=v_reason,finished_at=clock_timestamp() WHERE id=p_batch;
    RETURN jsonb_build_object('state',v_state,'batchId',p_batch,'reasonCode',v_reason);
END;
$$;

-- CREATE OR REPLACE preserves the existing postgres owner and closed execute ACL.
DO $verify$
DECLARE v_passed BOOLEAN;
BEGIN
    IF public.test_accession_import_provenance_security() IS DISTINCT FROM TRUE
       OR public.test_accession_confirmation_validation_security() IS DISTINCT FROM TRUE
       OR public.test_accession_confirmation_atomic_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 239 dedicated security verification failed';
    END IF;
    SELECT bool_and(passed) INTO v_passed FROM public.run_security_tests();
    IF v_passed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 239 security verification failed';
    END IF;
END;
$verify$;
COMMIT;
