-- Migration 236 behavioral fixture. SOURCE ONLY / NOT RUN. Home-server authorization required.
-- Synthetic request-local workbook; trusted server byte parsing/HMAC is covered in application tests.
-- Does not certify original bytes/HMAC, atomic business writes, succeeded receipt or concurrency.
-- DISPOSABLE home-server DB ONLY (name task11_disposable_*). All fixture data/audits ROLLBACK.
-- Optional confirmation_concurrency psql variable retains an uncommitted B-session setup only.
-- Concrete creator/lifecycle/publisher lock cases: accession-confirmation-concurrency.md (NOT RUN).
-- Never disable historical guards, RLS or business audit; never COMMIT these fixtures.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO public, pg_temp;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
    IF current_database() !~ '^task11_disposable_' THEN RAISE EXCEPTION 'disposable DB required'; END IF;
END; $$;
\if :{?confirmation_concurrency}
SELECT set_config('test.confirmation_concurrency','on',true);
\endif
\if :{?confirmation_shared_actors}
SELECT set_config('test.confirmation_shared_actors','on',true);
\endif
CREATE FUNCTION pg_temp.assert_confirmation(p_condition BOOLEAN,p_message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF p_condition IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'confirmation assertion: %',p_message; END IF; END;
$$;
-- Trusted synthetic seed through the existing preparing->ready guard, no production helper/hooks.
-- Unlike seal, this setup takes no catalog/client locks that could mask writer contention tests.
CREATE FUNCTION pg_temp.seed_confirmation(p_actor UUID,p_metadata JSONB,p_bindings TEXT,p_preview_at TIMESTAMPTZ DEFAULT clock_timestamp())
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID; v_item JSONB;
BEGIN
    INSERT INTO public.accession_preview_batches(owner_id,lease_duration_ms,policy_evidence,lease_heartbeat_at,lease_expires_at)
        VALUES(p_actor,60000,'synthetic-only',clock_timestamp(),clock_timestamp()+INTERVAL '1 minute') RETURNING id INTO v_id;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_bindings::JSONB) LOOP
        INSERT INTO public.accession_preview_bindings(batch_id,kind,row_number,parent_row,import_code,entity_id,generation,method_name,outcome,matched_id,key_version,fingerprint)
        VALUES(v_id,v_item->>0,(v_item->>1)::BIGINT,(v_item->>2)::BIGINT,v_item->>3,(v_item->>4)::UUID,(v_item->>5)::BIGINT,
            v_item->>6,v_item->>7,(v_item->>8)::UUID,v_item->>9,v_item->>10);
    END LOOP;
    UPDATE public.accession_preview_batches SET state='preview_ready',preview_created_at=p_preview_at,expires_at=p_preview_at+INTERVAL '30 minutes',
        source_sha256=p_metadata->>'source_sha256',source_size=(p_metadata->>'source_size')::BIGINT,
        normalized_payload_hash=p_metadata->>'normalized_payload_hash',canonicalization_version=p_metadata->>'canonicalization_version',
        template_version=p_metadata->>'template_version',template_digest=p_metadata->>'template_digest',template_claims_digest=p_metadata->>'template_claims_digest',
        catalog_digest=p_metadata->>'catalog_digest',revision=(p_metadata->>'revision')::BIGINT,
        validation_version=p_metadata->>'validation_version',resolver_version=p_metadata->>'resolver_version',binding_set_digest=p_metadata->>'binding_set_digest',
        client_count=(p_metadata->>'client_count')::BIGINT,sample_count=(p_metadata->>'sample_count')::BIGINT,
        assignment_count=(p_metadata->>'assignment_count')::BIGINT,create_count=(p_metadata->>'create_count')::BIGINT,reuse_count=(p_metadata->>'reuse_count')::BIGINT
        WHERE id=v_id;
    RETURN v_id;
END;
$$;
CREATE FUNCTION pg_temp.expect_confirmation_rejection(p_args JSONB,p_quality BOOLEAN DEFAULT TRUE) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_rejected BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM public.validate_accession_confirmation_locked((p_args->>'actor')::UUID,(p_args->>'batch')::UUID,p_quality,
            p_args->'workbook',p_args->'snapshot',p_args->'clients',p_args->'expected',p_args->>'canonical',p_args->>'bindings',p_args->'metadata');
    EXCEPTION WHEN raise_exception OR insufficient_privilege OR invalid_text_representation OR invalid_parameter_value THEN v_rejected:=TRUE;
    END;
    PERFORM pg_temp.assert_confirmation(v_rejected,'expected validation rejection');
END;
$$;
DO $behavior$
DECLARE
    v_owner UUID := '95600000-0000-4000-8000-000000000001';
    v_other UUID := '95600000-0000-4000-8000-000000000002';
    v_manager UUID := '95600000-0000-4000-8000-000000000003';
    v_batch JSONB; v_id UUID; v_snapshot JSONB; v_pair JSONB; v_type JSONB; v_assay JSONB;
    v_clients JSONB; v_expected JSONB; v_bindings JSONB; v_text TEXT; v_readback TEXT; v_metadata JSONB; v_workbook JSONB;
    v_canonical TEXT; v_input JSONB; v_args JSONB; v_now TIMESTAMPTZ; v_deadline TIMESTAMPTZ;
    v_before BIGINT[]; v_after BIGINT[]; v_claims TEXT; v_subject TEXT; v_role TEXT;
    v_accepted TIMESTAMPTZ; v_client UUID; v_sample UUID; v_reused JSONB; v_matched JSONB; v_reuse_metadata JSONB;
    v_reuse_bindings TEXT; v_current JSONB;
BEGIN
    IF current_setting('test.confirmation_shared_actors',true)='on' THEN
        PERFORM pg_temp.assert_confirmation((SELECT count(*)=2 FROM public.users WHERE deleted_at IS NULL AND role='analyst'
            AND ((id=v_owner AND username='confirmation236_owner') OR (id=v_other AND username='confirmation236_other')))
            AND EXISTS(SELECT 1 FROM public.users WHERE id=v_manager AND username='confirmation236_manager' AND role='manager' AND deleted_at IS NULL),
            'shared setup requires exact committed disposable synthetic actors');
    ELSE
        INSERT INTO auth.users(id,email) VALUES(v_owner,'confirmation236-owner@lims.local'),(v_other,'confirmation236-other@lims.local'),
            (v_manager,'confirmation236-manager@lims.local');
        INSERT INTO public.users(id,username,full_name,role,email) VALUES
            (v_owner,'confirmation236_owner','Synthetic owner','analyst','confirmation236-owner@lims.local'),
            (v_other,'confirmation236_other','Synthetic other','analyst','confirmation236-other@lims.local'),
            (v_manager,'confirmation236_manager','Synthetic manager','manager','confirmation236-manager@lims.local');
    END IF;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::TEXT,true);
    PERFORM set_config('request.jwt.claim.sub',v_owner::TEXT,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
    v_snapshot:=public.get_accession_template_snapshot(); v_pair:=v_snapshot->'pairs'->0;
    SELECT t INTO v_type FROM jsonb_array_elements(v_snapshot->'sampleTypes') t WHERE t->>'id'=v_pair->>'sampleTypeId';
    SELECT a INTO v_assay FROM jsonb_array_elements(v_snapshot->'assays') a WHERE a->>'id'=v_pair->>'assayDefinitionId';
    PERFORM pg_temp.assert_confirmation(v_type IS NOT NULL AND v_assay IS NOT NULL,'published eligible pair required');
    v_clients:=jsonb_build_array(jsonb_build_object('row',2,'name','Synthetic Confirmation236 Absent','dateOfBirth','2001-02-03',
        'governmentIdentityType','cccd','governmentIdentityValue','956000000001','gender','Nam','phone','0398765432',
        'address',NULL,'healthInsuranceNum',NULL,'expiryDate',NULL));
    v_expected:=public.resolve_accession_preview_clients_v1(v_clients);
    PERFORM pg_temp.assert_confirmation(v_expected->0->'resolution'->>'outcome'='not_found','synthetic identity must be absent');
    v_input:=v_expected->0->'input';
    v_canonical:=public.accession_confirmation_tuple_json(jsonb_build_array(jsonb_build_array(
        v_input->'name',v_input->'dateOfBirth',v_input->'governmentIdentityType',v_input->'governmentIdentityValue',
        v_input->'gender',v_input->'phone',v_input->'address',v_input->'healthInsuranceNum',v_input->'expiryDate',
        jsonb_build_array(jsonb_build_array(v_type->>'importCode','acceptable',jsonb_build_array(v_assay->>'importCode'))))));
    v_workbook:=jsonb_build_object('template',jsonb_build_object('templateId','accession-template','version','1','generatedAt','2026-11-05T00:00:00.000Z',
        'revision',v_snapshot->>'revisionNumber','authorityDigest',repeat('d',64),'catalogDigest',repeat('f',64)),
        'clients',jsonb_build_array(((v_clients->0)-'row') || jsonb_build_object('temporaryReference','KH-01',
            'callerContext',jsonb_build_object('sheet','Khách hàng','row',2,'temporaryReference','KH-01'))),
        'samples',jsonb_build_array(jsonb_build_object('temporaryReference','M-01','clientTemporaryReference','KH-01','sampleTypeCode',v_type->>'importCode',
            'callerContext',jsonb_build_object('sheet','Mẫu','row',2,'temporaryReference','M-01'))),
        'assignments',jsonb_build_array(jsonb_build_object('sampleTemporaryReference','M-01','assayCode',v_assay->>'importCode',
            'callerContext',jsonb_build_object('sheet','Chỉ định','row',2,'temporaryReference','M-01'))));
    v_bindings:=jsonb_build_array(
        jsonb_build_array('client',2,NULL,NULL,NULL,NULL,NULL,'not_found',NULL,'synthetic-1',repeat('b',64)),
        jsonb_build_array('sample',2,2,v_type->>'importCode',v_type->>'id',v_type->>'compatibilityGeneration',NULL,NULL,NULL,NULL,NULL),
        jsonb_build_array('assignment',2,2,v_assay->>'importCode',v_assay->>'id',v_assay->>'compatibilityGeneration',v_assay->>'methodName',NULL,NULL,NULL,NULL));
    SELECT public.accession_confirmation_tuple_json(jsonb_agg(value ORDER BY convert_to(public.accession_confirmation_tuple_json(value),'UTF8')))
        INTO v_text FROM jsonb_array_elements(v_bindings);
    v_metadata:=jsonb_build_object('source_sha256',repeat('a',64),'source_size',123,
        'normalized_payload_hash',encode(sha256(convert_to('lims-lite:bulk-accession:intent:v1' || chr(10) || v_canonical,'UTF8')),'hex'),
        'canonicalization_version','accession-intent-v1','template_version','1','template_digest',repeat('d',64),
        'template_claims_digest',repeat('e',64),'catalog_digest',repeat('f',64),'revision',v_snapshot->>'revisionNumber',
        'validation_version','accession-workbook-v1','resolver_version','accession-preview-clients-v1',
        'binding_set_digest',encode(sha256(convert_to(v_text,'UTF8')),'hex'),
        'client_count',1,'sample_count',1,'assignment_count',1,'create_count',1,'reuse_count',0);
    PERFORM set_config('request.jwt.claims','{"role":"service_role","fixture":"preserve"}',true);
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claim.role','service_role',true);
    IF current_setting('test.confirmation_concurrency',true)='on' THEN
        v_id:=pg_temp.seed_confirmation(v_owner,v_metadata,v_text);
    ELSE
        v_batch:=public.start_accession_preview(v_owner,NULL,60000,'synthetic-only'); v_id:=(v_batch->>'id')::UUID;
        PERFORM public.heartbeat_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,repeat('a',64),123);
        PERFORM public.seal_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,v_snapshot,v_clients,v_expected,v_text,v_metadata);
    END IF;
    -- Match real buildBindings: bigint generations are decimal strings; row/parent remain numbers.
    SELECT public.accession_confirmation_tuple_json(jsonb_agg(value ORDER BY convert_to(public.accession_confirmation_tuple_json(value),'UTF8')))
        INTO v_readback FROM jsonb_array_elements(public.get_accession_confirmation_preparation(v_owner,v_id)->'bindings');
    PERFORM pg_temp.assert_confirmation(v_readback=v_text,'protected reader preserves app binding bytes and bigint generation strings');
    v_args:=jsonb_build_object('actor',v_owner,'batch',v_id,'workbook',v_workbook,'snapshot',v_snapshot,
        'clients',v_clients,'expected',v_expected,'canonical',v_canonical,'bindings',v_text,'metadata',v_metadata);
    IF current_setting('test.confirmation_concurrency',true)='on' THEN
        CREATE TEMP TABLE task11_confirmation_args(args JSONB) ON COMMIT DROP;
        INSERT INTO task11_confirmation_args VALUES(v_args);
        RETURN;
    END IF;
    v_claims:=current_setting('request.jwt.claims',true); v_subject:=current_setting('request.jwt.claim.sub',true); v_role:=current_setting('request.jwt.claim.role',true);
    SELECT ARRAY[(SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),(SELECT count(*) FROM public.results),
        (SELECT count(*) FROM public.accession_import_receipts),(SELECT count(*) FROM public.accession_import_mappings),
        (SELECT count(*) FROM public.audit_logs)] INTO v_before;
    v_accepted:=public.validate_accession_confirmation_locked(v_owner,v_id,TRUE,v_workbook,v_snapshot,v_clients,v_expected,v_canonical,v_text,v_metadata);
    SELECT expires_at INTO v_deadline FROM public.accession_preview_batches WHERE id=v_id;
    PERFORM pg_temp.assert_confirmation(v_accepted < v_deadline,'one acceptance clock before deadline');
    PERFORM pg_temp.assert_confirmation(current_setting('request.jwt.claims',true)=v_claims
        AND current_setting('request.jwt.claim.sub',true)=v_subject AND current_setting('request.jwt.claim.role',true)=v_role,'success restores all JWT settings');
    SELECT ARRAY[(SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),(SELECT count(*) FROM public.results),
        (SELECT count(*) FROM public.accession_import_receipts),(SELECT count(*) FROM public.accession_import_mappings),
        (SELECT count(*) FROM public.audit_logs)] INTO v_after;
    PERFORM pg_temp.assert_confirmation(v_before=v_after,'pure validation persists no business/provenance/audit rows');
    -- Wrong caller and wrong owner must not mutate the batch.
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{actor}',to_jsonb(v_other)));
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM pg_temp.expect_confirmation_rejection(v_args);
    PERFORM set_config('request.jwt.claim.role',v_role,true);
    -- Explicit quality attestation; manager denial and reachable actor deactivation.
    PERFORM pg_temp.expect_confirmation_rejection(v_args,FALSE);
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{actor}',to_jsonb(v_manager)));
    BEGIN
        UPDATE public.users SET deleted_at=clock_timestamp() WHERE id=v_owner;
        PERFORM pg_temp.expect_confirmation_rejection(v_args);
        RAISE EXCEPTION 'rollback inactive actor' USING ERRCODE='Z0236';
    EXCEPTION WHEN SQLSTATE 'Z0236' THEN NULL; END;
    -- Full catalog/method, client decision/display/confidential authority drift.
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{snapshot,assays,0,methodName}','"drift"'));
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{expected,0,input,name}','"drift"'));
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{expected,0,displayValues}','{}'));
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{expected,0,resolution,outcome}','"conflict"'));
    -- Actual database authority drift, each subtransaction rolls back its mutations and audits.
    BEGIN
        UPDATE public.assay_definitions SET name=name || ' fixture catalog drift' WHERE id=(v_assay->>'id')::UUID;
        PERFORM pg_temp.expect_confirmation_rejection(v_args);
        RAISE EXCEPTION 'rollback actual catalog drift' USING ERRCODE='Z0236';
    EXCEPTION WHEN SQLSTATE 'Z0236' THEN NULL; END;
    BEGIN
        UPDATE public.assay_definitions SET method_name='Synthetic confirmation236 method drift'
            WHERE id=(v_assay->>'id')::UUID;
        PERFORM pg_temp.expect_confirmation_rejection(v_args);
        RAISE EXCEPTION 'rollback actual method drift' USING ERRCODE='Z0236';
    EXCEPTION WHEN SQLSTATE 'Z0236' THEN NULL; END;
    BEGIN
        -- A previously absent exact identity becomes reusable: never silently switch create->reuse.
        INSERT INTO public.clients(id_card_num,name,date_of_birth,gender,phone)
            VALUES('956000000001','Synthetic Confirmation236 Absent','2001-02-03','Nam','0398765432') RETURNING id INTO v_client;
        PERFORM pg_temp.expect_confirmation_rejection(v_args);
        -- Prepare a reuse case against the actual new client, then alter its display/authority.
        PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::TEXT,true);
        PERFORM set_config('request.jwt.claim.sub',v_owner::TEXT,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
        v_matched:=public.resolve_accession_preview_clients_v1(v_clients);
        PERFORM pg_temp.assert_confirmation(v_matched->0->'resolution'->>'clientId'=v_client::TEXT,'actual candidate reuse');
        PERFORM set_config('request.jwt.claims',v_claims,true); PERFORM set_config('request.jwt.claim.sub',v_subject,true); PERFORM set_config('request.jwt.claim.role',v_role,true);
        -- Identify the client without positional assumptions; distinct kind ordering stays fixed.
        SELECT public.accession_confirmation_tuple_json(jsonb_agg(CASE WHEN value->>0='client' THEN
            jsonb_set(jsonb_set(value,'{7}','"matched"'),'{8}',to_jsonb(v_client)) ELSE value END
            ORDER BY convert_to(public.accession_confirmation_tuple_json(value),'UTF8'))) INTO v_reuse_bindings FROM jsonb_array_elements(v_text::JSONB);
        v_reuse_metadata:=v_metadata || jsonb_build_object('create_count',0,'reuse_count',1,
            'binding_set_digest',encode(sha256(convert_to(v_reuse_bindings,'UTF8')),'hex'));
        v_reused:=v_args || jsonb_build_object('batch',pg_temp.seed_confirmation(v_owner,v_reuse_metadata,v_reuse_bindings),
            'expected',v_matched,'bindings',v_reuse_bindings,'metadata',v_reuse_metadata);
        PERFORM public.validate_accession_confirmation_locked(v_owner,(v_reused->>'batch')::UUID,TRUE,v_workbook,v_snapshot,v_clients,v_matched,v_canonical,v_reuse_bindings,v_reuse_metadata);
        BEGIN
            UPDATE public.clients SET address='Synthetic changed display' WHERE id=v_client;
            PERFORM pg_temp.expect_confirmation_rejection(v_reused);
            RAISE EXCEPTION 'rollback actual client profile drift' USING ERRCODE='Z0236';
        EXCEPTION WHEN SQLSTATE 'Z0236' THEN NULL; END;
        -- New confidential association masks the same previously visible reused client.
        INSERT INTO public.samples(sample_id,client_id,sample_type_id,sample_quality,received_by,status)
            VALUES('CONFIRMATION236-CONFIDENTIAL',v_client,(v_type->>'id')::UUID,TRUE,v_owner,'assigned') RETURNING id INTO v_sample;
        INSERT INTO public.results(sample_id,assay_id,status)
            SELECT v_sample,id,'pending' FROM public.assay_definitions WHERE id=(v_assay->>'id')::UUID;
        UPDATE public.assay_definitions SET is_confidential=TRUE WHERE id=(v_assay->>'id')::UUID;
        PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::TEXT,true);
        PERFORM set_config('request.jwt.claim.sub',v_owner::TEXT,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
        v_current:=public.resolve_accession_preview_clients_v1(v_clients);
        PERFORM pg_temp.assert_confirmation(v_current->0->'resolution'->>'outcome'='conflict'
            AND v_current->0->'resolution'->>'clientId' IS NULL,'actual confidentiality relationship masks client');
        PERFORM set_config('request.jwt.claims',v_claims,true); PERFORM set_config('request.jwt.claim.sub',v_subject,true); PERFORM set_config('request.jwt.claim.role',v_role,true);
        PERFORM pg_temp.expect_confirmation_rejection(v_reused);
        RAISE EXCEPTION 'rollback actual client and confidential association drift' USING ERRCODE='Z0236';
    EXCEPTION WHEN SQLSTATE 'Z0236' THEN NULL; END;
    -- Malformed rows, same counts with rebound graph, metadata counts and canonical/hash drift.
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{workbook,samples,0,clientTemporaryReference}','"KH-X"'));
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{workbook,clients,0,callerContext,row}','99'));
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{metadata,sample_count}','99'));
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{canonical}','"[]"'));
    -- Resolver raises inside impersonation; capture/restore all JWT settings on exception.
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{clients,0,dateOfBirth}','"invalid"'));
    PERFORM pg_temp.assert_confirmation(current_setting('request.jwt.claims',true)=v_claims
        AND current_setting('request.jwt.claim.sub',true)=v_subject AND current_setting('request.jwt.claim.role',true)=v_role,'exception restores all JWT settings');
    -- Seed an already expired immutable commitment, never edit a sealed deadline or disable guards.
    PERFORM pg_temp.expect_confirmation_rejection(jsonb_set(v_args,'{batch}',to_jsonb(
        pg_temp.seed_confirmation(v_owner,v_metadata,v_text,clock_timestamp()-INTERVAL '30 minutes'))));
    SELECT ARRAY[(SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),(SELECT count(*) FROM public.results),
        (SELECT count(*) FROM public.accession_import_receipts),(SELECT count(*) FROM public.accession_import_mappings),
        (SELECT count(*) FROM public.audit_logs WHERE table_name NOT IN ('accession_preview_batches','accession_preview_bindings','users'))] INTO v_after;
    -- Business counts are invariant; fixture-only user/batch INSERT audit is excluded from final audit check.
    PERFORM pg_temp.assert_confirmation(v_before[1:5]=v_after[1:5],'validation persists no business rows, receipt time or IDs');
    PERFORM pg_temp.assert_confirmation((SELECT state='preview_ready' AND finished_at IS NULL FROM public.accession_preview_batches WHERE id=v_id),'preparation never terminalizes');
END;
$behavior$;
\if :{?confirmation_concurrency}
\echo 'NOT RUN: setup retained in this uncommitted B transaction; follow accession-confirmation-concurrency.md then ROLLBACK'
\else
ROLLBACK;
\endif
