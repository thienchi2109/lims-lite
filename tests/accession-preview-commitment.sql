-- Rollback-only migration 234 behavioral checks. SOURCE ONLY: NOT RUN in this workspace.
-- Requires migrations 232/233/234 and a published eligible pair in an authorized home-server DB.
-- Uses synthetic identities; never disables business triggers/RLS. TTL equality predicate is
-- source-checked; these runtime fixtures exercise past-deadline admission and immutable deadlines.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO public, pg_temp;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE FUNCTION pg_temp.assert_commitment(p_condition BOOLEAN,p_message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF p_condition IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'commitment assertion: %',p_message; END IF; END;
$$;
DO $behavior$
DECLARE
    v_owner UUID := '95400000-0000-4000-8000-000000000001';
    v_other UUID := '95400000-0000-4000-8000-000000000002';
    v_manager UUID := '95400000-0000-4000-8000-000000000003';
    v_inactive UUID := '95400000-0000-4000-8000-000000000004';
    v_batch JSONB; v_second JSONB; v_sealed JSONB; v_snapshot JSONB; v_clients JSONB; v_expected JSONB;
    v_pair JSONB; v_type JSONB; v_assay JSONB; v_bindings JSONB; v_bad JSONB; v_metadata JSONB;
    v_actor UUID; v_id UUID; v_rejected BOOLEAN; v_before BIGINT[]; v_after BIGINT[];
    v_deadline TIMESTAMPTZ; v_lease TIMESTAMPTZ; v_finished TIMESTAMPTZ;
    v_expired public.accession_preview_batches;
BEGIN
    INSERT INTO auth.users(id,email) VALUES(v_owner,'preview234-owner@lims.local'),(v_other,'preview234-other@lims.local'),
        (v_manager,'preview234-manager@lims.local'),(v_inactive,'preview234-inactive@lims.local');
    INSERT INTO public.users(id,username,full_name,role,email,deleted_at) VALUES
        (v_owner,'preview234_owner','Synthetic owner','analyst','preview234-owner@lims.local',NULL),
        (v_other,'preview234_other','Synthetic other','analyst','preview234-other@lims.local',NULL),
        (v_manager,'preview234_manager','Synthetic manager','manager','preview234-manager@lims.local',NULL),
        (v_inactive,'preview234_inactive','Synthetic inactive','analyst','preview234-inactive@lims.local',clock_timestamp());
    SELECT ARRAY[(SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),(SELECT count(*) FROM public.results)] INTO v_before;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::TEXT,true);
    PERFORM set_config('request.jwt.claim.sub',v_owner::TEXT,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
    v_snapshot := public.get_accession_template_snapshot();
    v_clients := jsonb_build_array(jsonb_build_object('row',2,'name','Synthetic Preview234 No Candidate','dateOfBirth','2001-02-03',
        'governmentIdentityType','cccd','governmentIdentityValue','954000000001','gender','Nam','phone','0398765432',
        'address',NULL,'healthInsuranceNum',NULL,'expiryDate',NULL));
    v_expected := public.resolve_accession_preview_clients_v1(v_clients);
    PERFORM pg_temp.assert_commitment(v_expected->0->'resolution'->>'outcome'='not_found','synthetic fixture must be absent');
    v_pair := v_snapshot->'pairs'->0;
    SELECT t INTO v_type FROM jsonb_array_elements(v_snapshot->'sampleTypes') t WHERE t->>'id'=v_pair->>'sampleTypeId';
    SELECT a INTO v_assay FROM jsonb_array_elements(v_snapshot->'assays') a WHERE a->>'id'=v_pair->>'assayDefinitionId';

    -- authenticated direct forged start/seal remain forbidden even when JWT role is forged.
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    v_rejected := false;
    BEGIN PERFORM public.start_accession_preview(v_owner,NULL,60000,'synthetic-only');
    EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'direct forged start denied');
    v_rejected := false;
    BEGIN PERFORM public.seal_accession_preview(v_owner,gen_random_uuid(),gen_random_uuid(),1,NULL,NULL,NULL,NULL,NULL);
    EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'direct forged seal denied');
    SET LOCAL ROLE postgres;

    -- EXECUTE alone cannot substitute auth.role or current analyst status.
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    v_rejected:=false;
    BEGIN PERFORM public.start_accession_preview(v_owner,NULL,60000,'synthetic-only');
    EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'privileged function rejects non-service context');
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::TEXT,true);
    FOREACH v_actor IN ARRAY ARRAY[v_manager,v_inactive] LOOP
        v_rejected:=false;
        BEGIN PERFORM public.start_accession_preview(v_actor,NULL,60000,'synthetic-only');
        EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
        PERFORM pg_temp.assert_commitment(v_rejected,'manager/inactive rejected');
    END LOOP;
    v_batch:=public.start_accession_preview(v_owner,NULL,60000,'synthetic-only'); v_id:=(v_batch->>'id')::UUID;
    PERFORM pg_temp.assert_commitment((SELECT client_count IS NULL AND source_sha256 IS NULL AND expires_at IS NULL
        FROM public.accession_preview_batches WHERE id=v_id),'unknown counts/source/deadline null');
    v_rejected:=false;
    BEGIN PERFORM public.start_accession_preview(v_owner,v_id,60000,'synthetic-only');
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'retry nonterminal denied');
    PERFORM public.heartbeat_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,repeat('a',64),123);
    v_rejected:=false;
    BEGIN PERFORM public.heartbeat_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,repeat('b',64),123);
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'known source write-once');
    v_rejected:=false;
    BEGIN PERFORM public.heartbeat_accession_preview(v_other,v_id,(v_batch->>'lease_token')::UUID,1);
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'other owner denied');
    v_rejected:=false;
    BEGIN PERFORM public.heartbeat_accession_preview(v_owner,v_id,gen_random_uuid(),1);
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'stale lease token denied');
    v_rejected:=false;
    BEGIN PERFORM public.heartbeat_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,2);
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'stale lease generation denied');

    v_bindings:=jsonb_build_array(
        jsonb_build_array('client',2,NULL,NULL,NULL,NULL,NULL,'not_found',NULL,'synthetic-1',repeat('b',64)),
        jsonb_build_array('sample',2,2,v_type->>'importCode',v_type->>'id',v_type->>'compatibilityGeneration',NULL,NULL,NULL,NULL,NULL),
        jsonb_build_array('assignment',2,2,v_assay->>'importCode',v_assay->>'id',v_assay->>'compatibilityGeneration',v_assay->>'methodName',NULL,NULL,NULL,NULL));
    v_metadata:=jsonb_build_object('source_sha256',repeat('a',64),'source_size',123,'normalized_payload_hash',repeat('c',64),
        'canonicalization_version','accession-intent-v1','template_version','1','template_digest',repeat('d',64),
        'template_claims_digest',repeat('e',64),'catalog_digest',repeat('f',64),'revision',v_snapshot->>'revisionNumber',
        'validation_version','accession-workbook-v1','resolver_version','accession-preview-clients-v1',
        'binding_set_digest',encode(sha256(convert_to(v_bindings::TEXT,'UTF8')),'hex'),
        'client_count',1,'sample_count',1,'assignment_count',1,'create_count',1,'reuse_count',0);
    -- Partial metadata rollback: a later invalid graph row must remove all earlier binding inserts/audit.
    v_bad:=jsonb_set(v_bindings,'{2,2}','999'::JSONB);
    v_rejected:=false;
    BEGIN
        PERFORM public.seal_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,v_snapshot,v_clients,v_expected,v_bad::TEXT,
            v_metadata||jsonb_build_object('binding_set_digest',encode(sha256(convert_to(v_bad::TEXT,'UTF8')),'hex')));
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected AND NOT EXISTS(SELECT 1 FROM public.accession_preview_bindings WHERE batch_id=v_id)
        AND (SELECT state='preparing' FROM public.accession_preview_batches WHERE id=v_id),'partial graph rollback');
    -- Full client decision/display snapshot and full catalog snapshot (including method) must agree.
    FOREACH v_bad IN ARRAY ARRAY[jsonb_set(v_expected,'{0,input,name}','"changed"'),jsonb_set(v_expected,'{0,displayValues}','{}')] LOOP
        v_rejected:=false;
        BEGIN PERFORM public.seal_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,v_snapshot,v_clients,v_bad,v_bindings::TEXT,v_metadata);
        EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
        PERFORM pg_temp.assert_commitment(v_rejected,'client authority drift rejected');
    END LOOP;
    v_rejected:=false;
    BEGIN PERFORM public.seal_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,
        jsonb_set(v_snapshot,'{assays,0,methodName}','"changed"'),v_clients,v_expected,v_bindings::TEXT,v_metadata);
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'method/full snapshot drift rejected');
    v_sealed:=public.seal_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,v_snapshot,v_clients,v_expected,v_bindings::TEXT,v_metadata);
    SELECT expires_at,lease_expires_at INTO v_deadline,v_lease FROM public.accession_preview_batches WHERE id=v_id;
    PERFORM pg_temp.assert_commitment(v_deadline=(v_sealed->>'preview_created_at')::TIMESTAMPTZ+INTERVAL '30 minutes','DB TTL exactly30min');
    v_rejected:=false;
    BEGIN PERFORM public.finish_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,'expired','EXPIRED');
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'ready cannot expire before deadline');
    -- Fixture-only trusted INSERT seeds an already old commitment without altering an immutable real seal.
    SELECT * INTO v_expired FROM public.accession_preview_batches WHERE id=v_id;
    v_expired.id:=gen_random_uuid(); v_expired.lease_token:=gen_random_uuid();
    v_expired.preview_created_at:=clock_timestamp()-INTERVAL '30 minutes';
    v_expired.expires_at:=v_expired.preview_created_at+INTERVAL '30 minutes';
    v_expired.created_at:=v_expired.preview_created_at;
    INSERT INTO public.accession_preview_batches SELECT (v_expired).*;
    PERFORM public.finish_accession_preview(v_owner,v_expired.id,v_expired.lease_token,1,'expired','EXPIRED');
    PERFORM pg_temp.assert_commitment((SELECT state='expired' AND finished_at IS NOT NULL AND expires_at=v_expired.expires_at
        FROM public.accession_preview_batches WHERE id=v_expired.id),'past deadline expires with unchanged DB deadline');
    v_rejected:=false;
    BEGIN PERFORM public.heartbeat_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1);
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected AND (SELECT expires_at=v_deadline AND lease_expires_at=v_lease
        FROM public.accession_preview_batches WHERE id=v_id),'sealed heartbeat cannot refresh TTL');
    v_rejected:=false;
    BEGIN UPDATE public.accession_preview_batches SET expires_at=expires_at+INTERVAL '1 second' WHERE id=v_id;
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'sealed deadline immutable');
    v_rejected:=false;
    BEGIN UPDATE public.accession_preview_bindings SET fingerprint=repeat('c',64) WHERE batch_id=v_id AND kind='client';
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'binding immutable');

    -- Owner/analyst read isolation, manager cannot substitute, terminal bindings hidden without purge.
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.sub',v_other::TEXT,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::TEXT,true);
    PERFORM pg_temp.assert_commitment(NOT EXISTS(SELECT id FROM public.accession_preview_batches WHERE id=v_id),'other owner RLS');
    PERFORM set_config('request.jwt.claim.sub',v_manager::TEXT,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_manager,'role','authenticated')::TEXT,true);
    PERFORM pg_temp.assert_commitment(NOT EXISTS(SELECT 1 FROM public.accession_preview_bindings WHERE batch_id=v_id),'manager binding RLS');
    PERFORM set_config('request.jwt.claim.sub',v_owner::TEXT,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::TEXT,true);
    PERFORM pg_temp.assert_commitment((SELECT count(*)=3 FROM public.accession_preview_bindings WHERE batch_id=v_id),'owner ready bindings visible');
    v_rejected:=false;
    BEGIN UPDATE public.accession_preview_batches SET state='failed' WHERE id=v_id;
    EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'owner direct update denied');
    SET LOCAL ROLE postgres;
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    PERFORM public.finish_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,'failed','AUTHORITY_CHANGED');
    SELECT finished_at INTO v_finished FROM public.accession_preview_batches WHERE id=v_id;
    PERFORM pg_temp.assert_commitment(v_finished IS NOT NULL,'terminal DB time recorded');
    v_rejected:=false;
    BEGIN PERFORM public.finish_accession_preview(v_owner,v_id,(v_batch->>'lease_token')::UUID,1,'failed','AUTHORITY_CHANGED');
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'terminal immutable');
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM pg_temp.assert_commitment(NOT EXISTS(SELECT 1 FROM public.accession_preview_bindings WHERE batch_id=v_id),'terminal bindings hidden');
    SET LOCAL ROLE postgres;
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    v_second:=public.start_accession_preview(v_owner,v_id,60000,'synthetic-only');
    v_rejected:=false;
    BEGIN PERFORM public.start_accession_preview(v_other,v_id,60000,'synthetic-only');
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'other-owner retry denied');
    -- Rejected attempts retain known source commitments and DB finish time; truly unknown counts stay null.
    v_sealed:=public.start_accession_preview(v_owner,NULL,60000,'synthetic-only');
    PERFORM public.heartbeat_accession_preview(v_owner,(v_sealed->>'id')::UUID,(v_sealed->>'lease_token')::UUID,1,repeat('a',64),123);
    PERFORM public.finish_accession_preview(v_owner,(v_sealed->>'id')::UUID,(v_sealed->>'lease_token')::UUID,1,'rejected','WORKBOOK_INVALID');
    PERFORM pg_temp.assert_commitment((SELECT state='rejected' AND finished_at IS NOT NULL AND client_count IS NULL
        AND source_sha256=repeat('a',64) AND source_size=123 AND expires_at IS NULL
        FROM public.accession_preview_batches WHERE id=(v_sealed->>'id')::UUID),'rejected known source and unknown counts');
    -- Past preparation deadline cannot be renewed or sealed; no stale worker recovery writes.
    UPDATE public.accession_preview_batches SET lease_expires_at=clock_timestamp()-INTERVAL '1 microsecond' WHERE id=(v_second->>'id')::UUID;
    v_rejected:=false;
    BEGIN PERFORM public.heartbeat_accession_preview(v_owner,(v_second->>'id')::UUID,(v_second->>'lease_token')::UUID,1);
    EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
    PERFORM pg_temp.assert_commitment(v_rejected,'expired preparation lease denied');
    PERFORM pg_temp.assert_commitment(NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE table_name='accession_preview_batches'
        AND record_id=v_id AND new_values::TEXT ~ '(lease_token|954000000001|Synthetic Preview234|workbook|filename)'),'audit excludes source identity/token');
    SELECT ARRAY[(SELECT count(*) FROM public.clients),(SELECT count(*) FROM public.samples),(SELECT count(*) FROM public.results)] INTO v_after;
    PERFORM pg_temp.assert_commitment(v_before=v_after,'no business writes');
    PERFORM pg_temp.assert_commitment(public.test_accession_preview_commitment_security(),'security contract');
END;
$behavior$;
ROLLBACK;
