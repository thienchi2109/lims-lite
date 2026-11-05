-- Migration 236: SOURCE ONLY trusted read preparation and private locked confirmation validation.
-- Security impact: service-only protected reader; validation/tuple helpers remain ungranted.
-- No business/batch/provenance mutation, official ID allocation or persisted receipt time.
-- PostgreSQL behavior, locks and run_security_tests() require separately authorized home-server proof.
BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $baseline$
BEGIN
    IF to_regprocedure('public.authorize_accession_preview_actor(uuid)') IS NULL
       OR to_regprocedure('public.resolve_accession_preview_clients_v1(jsonb)') IS NULL
       OR to_regprocedure('public.get_accession_template_snapshot()') IS NULL
       OR to_regprocedure('public.validate_accession_import_receipt(uuid)') IS NULL
       OR to_regprocedure('public.test_accession_import_provenance_security()') IS NULL
       OR to_regclass('public.accession_preview_bindings') IS NULL
       OR to_regclass('public.accession_import_receipts') IS NULL
       OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE AND proname IN
           ('get_accession_confirmation_preparation','accession_confirmation_tuple_json',
            'validate_accession_confirmation_locked','test_accession_confirmation_validation_security'))
       OR pg_get_functiondef('public.guard_accession_preview_mutation()'::REGPROCEDURE)
          NOT LIKE '%OLD.state = ''preview_ready'' AND (NEW.state NOT IN (''failed'',''expired'')%' THEN
        RAISE EXCEPTION 'Migration 236 requires unchanged 234/235 baseline and unused confirmation helpers';
    END IF;
    IF NOT public.test_accession_preview_commitment_security() OR NOT public.test_accession_import_provenance_security() THEN
        RAISE EXCEPTION 'Migration 236 security baseline mismatch';
    END IF;
END;
$baseline$;

CREATE FUNCTION public.get_accession_confirmation_preparation(p_actor UUID,p_batch UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch public.accession_preview_batches; v_receipt JSONB; v_bindings JSONB;
BEGIN
    PERFORM public.authorize_accession_preview_actor(p_actor);
    SELECT * INTO v_batch FROM public.accession_preview_batches WHERE id=p_batch AND owner_id=p_actor FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_CONFIRMATION_FORBIDDEN' USING ERRCODE='42501'; END IF;
    -- Active owner analyst only. Safe receipt metadata is independent of binding retention and TTL.
    IF v_batch.state='succeeded' THEN
        SELECT jsonb_build_object('batch_id',batch_id,'owner_id',owner_id,'confirmation_received_at',confirmation_received_at,
            'client_count',client_count,'sample_count',sample_count,'assignment_count',assignment_count,
            'create_count',create_count,'reuse_count',reuse_count) INTO v_receipt
        FROM public.accession_import_receipts WHERE batch_id=p_batch AND owner_id=p_actor;
        IF v_receipt IS NULL THEN RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID'; END IF;
        RETURN jsonb_build_object('receipt',v_receipt);
    END IF;
    IF v_batch.state <> 'preview_ready' THEN RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID'; END IF;
    SELECT jsonb_agg(jsonb_build_array(kind,row_number,parent_row,import_code,entity_id,generation,method_name,
        outcome,matched_id,key_version,fingerprint)) INTO v_bindings FROM public.accession_preview_bindings WHERE batch_id=p_batch;
    -- Snapshot revision is a decimal string in the existing application contract.
    RETURN jsonb_build_object('batch',to_jsonb(v_batch) || jsonb_build_object('revision',v_batch.revision::TEXT),'bindings',v_bindings);
END;
$$;

-- Lifted from the independently verified accession-preview-canonicalization.sql tuple serializer.
-- Compact arrays and scalar JSON escaping preserve ECMAScript bytes; object serialization is forbidden.
CREATE FUNCTION public.accession_confirmation_tuple_json(p_value JSONB)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_result TEXT;
BEGIN
    IF jsonb_typeof(p_value) IN ('string','null','number') THEN RETURN p_value::TEXT; END IF;
    IF jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID'; END IF;
    SELECT '[' || COALESCE(string_agg(public.accession_confirmation_tuple_json(value),',' ORDER BY ordinal),'') || ']'
    INTO v_result FROM jsonb_array_elements(p_value) WITH ORDINALITY AS item(value,ordinal);
    RETURN v_result;
END;
$$;

CREATE FUNCTION public.validate_accession_confirmation_locked(p_actor UUID,p_batch UUID,p_attested BOOLEAN,
    p_workbook JSONB,p_snapshot JSONB,p_clients JSONB,p_expected_clients JSONB,p_canonical_intent TEXT,p_bindings_text TEXT,p_metadata JSONB)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch public.accession_preview_batches; v_snapshot JSONB; v_clients JSONB; v_bindings JSONB;
    v_claims TEXT; v_subject TEXT; v_role TEXT; v_now TIMESTAMPTZ; v_item JSONB; v_kind TEXT; v_rows JSONB;
    v_fields TEXT[]; v_sealed JSONB; v_canonical TEXT;
BEGIN
    PERFORM public.authorize_accession_preview_actor(p_actor);
    SELECT * INTO v_batch FROM public.accession_preview_batches WHERE id=p_batch AND owner_id=p_actor FOR UPDATE;
    IF NOT FOUND OR v_batch.state <> 'preview_ready' OR p_attested IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
    END IF;
    -- ponytail: coarse exclusion fences absent clients and confidentiality relationship phantoms;
    -- TASK-7 measures contention before release; upgrade only with coordinated writer/revision locks.
    LOCK TABLE public.assay_definitions IN SHARE MODE;
    LOCK TABLE public.assay_sample_type_catalog_revisions IN SHARE MODE;
    LOCK TABLE public.assay_sample_type_compatibilities IN SHARE MODE;
    LOCK TABLE public.assay_sample_type_reviews IN SHARE MODE;
    LOCK TABLE public.client_collision_adjudications IN SHARE MODE;
    LOCK TABLE public.clients IN SHARE ROW EXCLUSIVE MODE;
    LOCK TABLE public.sample_types IN SHARE MODE;
    LOCK TABLE public.samples IN SHARE ROW EXCLUSIVE MODE;
    LOCK TABLE public.results IN SHARE ROW EXCLUSIVE MODE;
    v_claims := current_setting('request.jwt.claims',true);
    v_subject := current_setting('request.jwt.claim.sub',true); v_role := current_setting('request.jwt.claim.role',true);
    BEGIN
        PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::TEXT,true);
        PERFORM set_config('request.jwt.claim.sub',p_actor::TEXT,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
        IF auth.uid() IS DISTINCT FROM p_actor OR auth.role() IS DISTINCT FROM 'authenticated' THEN
            RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
        END IF;
        v_snapshot := public.get_accession_template_snapshot();
        v_clients := public.resolve_accession_preview_clients_v1(p_clients);
    EXCEPTION WHEN OTHERS THEN
        PERFORM set_config('request.jwt.claims',COALESCE(v_claims,''),true);
        PERFORM set_config('request.jwt.claim.sub',COALESCE(v_subject,''),true); PERFORM set_config('request.jwt.claim.role',COALESCE(v_role,''),true);
        RAISE;
    END;
    PERFORM set_config('request.jwt.claims',COALESCE(v_claims,''),true);
    PERFORM set_config('request.jwt.claim.sub',COALESCE(v_subject,''),true); PERFORM set_config('request.jwt.claim.role',COALESCE(v_role,''),true);
    IF p_snapshot IS DISTINCT FROM v_snapshot OR p_expected_clients IS DISTINCT FROM v_clients
       OR v_snapshot->>'revisionNumber' IS DISTINCT FROM v_batch.revision::TEXT
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_clients) c
          WHERE c->'resolution'->>'outcome' NOT IN ('matched','not_found') OR c->'issues' <> '[]'::JSONB
          OR (c->'resolution'->>'outcome'='not_found' AND (c->'input'->>'gender' IS NULL OR c->'input'->>'phone' IS NULL))) THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_AUTHORITY_CHANGED';
    END IF;
    -- Exact sealed metadata, never a caller-supplied expiry, actor, received time or official ID.
    v_fields := ARRAY['source_sha256','source_size','normalized_payload_hash','canonicalization_version','template_version',
        'template_digest','template_claims_digest','catalog_digest','revision','validation_version','resolver_version',
        'binding_set_digest','client_count','sample_count','assignment_count','create_count','reuse_count'];
    IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR NOT p_metadata ?& v_fields
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_metadata) f WHERE f <> ALL(v_fields))
       OR EXISTS (SELECT 1 FROM unnest(v_fields) f WHERE p_metadata->>f IS DISTINCT FROM to_jsonb(v_batch)->>f)
       OR p_metadata IS DISTINCT FROM (SELECT jsonb_object_agg(f,CASE f WHEN 'revision' THEN to_jsonb(v_batch.revision::TEXT)
          ELSE to_jsonb(v_batch)->f END) FROM unnest(v_fields) f)
       OR p_metadata->>'canonicalization_version' IS DISTINCT FROM 'accession-intent-v1'
       OR p_metadata->>'validation_version' IS DISTINCT FROM 'accession-workbook-v1'
       OR p_metadata->>'resolver_version' IS DISTINCT FROM 'accession-preview-clients-v1'
       OR encode(sha256(convert_to('lims-lite:bulk-accession:intent:v1' || chr(10) || p_canonical_intent,'UTF8')),'hex')
          IS DISTINCT FROM v_batch.normalized_payload_hash
       OR encode(sha256(convert_to(p_bindings_text,'UTF8')),'hex') IS DISTINCT FROM v_batch.binding_set_digest THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
    END IF;
    IF jsonb_typeof(p_workbook) IS DISTINCT FROM 'object'
       OR NOT p_workbook ?& ARRAY['template','clients','samples','assignments']
       OR (SELECT count(*) FROM jsonb_object_keys(p_workbook)) <> 4
       OR jsonb_typeof(p_workbook->'template') IS DISTINCT FROM 'object'
       OR p_workbook->'template'->>'version' IS DISTINCT FROM v_batch.template_version
       OR p_workbook->'template'->>'revision' IS DISTINCT FROM v_batch.revision::TEXT
       OR p_workbook->'template'->>'authorityDigest' IS DISTINCT FROM v_batch.template_digest
       OR p_workbook->'template'->>'catalogDigest' IS DISTINCT FROM v_batch.catalog_digest THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
    END IF;
    -- Validate rows before casts/joins; the resolver independently checks every client decision field.
    FOREACH v_kind IN ARRAY ARRAY['clients','samples','assignments'] LOOP
        v_rows := p_workbook->v_kind;
        IF jsonb_typeof(v_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(v_rows)=0 THEN
            RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
        END IF;
        v_fields := CASE v_kind WHEN 'clients' THEN ARRAY['temporaryReference','callerContext','name','dateOfBirth',
            'governmentIdentityType','governmentIdentityValue','gender','phone','address','healthInsuranceNum','expiryDate']
            WHEN 'samples' THEN ARRAY['temporaryReference','clientTemporaryReference','sampleTypeCode','callerContext']
            ELSE ARRAY['sampleTemporaryReference','assayCode','callerContext'] END;
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_rows) LOOP
            IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' OR NOT v_item ?& v_fields
               OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_item) f WHERE f <> ALL(v_fields))
               OR jsonb_typeof(v_item->'callerContext') IS DISTINCT FROM 'object'
               OR NOT v_item->'callerContext' ?& ARRAY['sheet','row','temporaryReference']
               OR (SELECT count(*) FROM jsonb_object_keys(v_item->'callerContext')) <> 3
               OR jsonb_typeof(v_item->'callerContext'->'row') IS DISTINCT FROM 'number'
               OR (v_item->'callerContext'->>'row') !~ '^[1-9][0-9]{0,9}$'
               OR (v_item->'callerContext'->>'row')::BIGINT > 2147483647
               OR v_item->'callerContext'->>'sheet' IS DISTINCT FROM CASE v_kind WHEN 'clients' THEN 'Khách hàng' WHEN 'samples' THEN 'Mẫu' ELSE 'Chỉ định' END
               OR jsonb_typeof(COALESCE(v_item->'temporaryReference',v_item->'sampleTemporaryReference')) IS DISTINCT FROM 'string'
               OR (v_kind='samples' AND jsonb_typeof(v_item->'clientTemporaryReference') IS DISTINCT FROM 'string')
               OR COALESCE(v_item->>'temporaryReference',v_item->>'sampleTemporaryReference','') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$'
               OR v_item->'callerContext'->>'temporaryReference' IS DISTINCT FROM COALESCE(v_item->>'temporaryReference',v_item->>'sampleTemporaryReference') THEN
                RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
            END IF;
        END LOOP;
        IF (SELECT count(DISTINCT c->'callerContext'->>'row') FROM jsonb_array_elements(v_rows) c) <> jsonb_array_length(v_rows) THEN
            RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
        END IF;
    END LOOP;
    IF jsonb_array_length(p_workbook->'clients') <> v_batch.client_count
       OR jsonb_array_length(p_workbook->'samples') <> v_batch.sample_count
       OR jsonb_array_length(p_workbook->'assignments') <> v_batch.assignment_count
       OR jsonb_array_length(v_clients) <> v_batch.client_count
       OR (SELECT count(*) FROM jsonb_array_elements(v_clients) c WHERE c->'resolution'->>'outcome'='not_found') <> v_batch.create_count
       OR (SELECT count(*) FROM jsonb_array_elements(v_clients) c WHERE c->'resolution'->>'outcome'='matched') <> v_batch.reuse_count
       OR (SELECT count(DISTINCT c->>'temporaryReference') FROM jsonb_array_elements(p_workbook->'clients') c) <> v_batch.client_count
       OR (SELECT count(DISTINCT s->>'temporaryReference') FROM jsonb_array_elements(p_workbook->'samples') s) <> v_batch.sample_count
       OR (SELECT count(DISTINCT (a->>'sampleTemporaryReference',a->>'assayCode')) FROM jsonb_array_elements(p_workbook->'assignments') a) <> v_batch.assignment_count
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_workbook->'clients') c WHERE NOT EXISTS
          (SELECT 1 FROM jsonb_array_elements(p_clients) i WHERE i=(c-'temporaryReference'-'callerContext') || jsonb_build_object('row',c->'callerContext'->'row')))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_workbook->'clients') c WHERE NOT EXISTS
          (SELECT 1 FROM jsonb_array_elements(p_workbook->'samples') s WHERE s->>'clientTemporaryReference'=c->>'temporaryReference'))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_workbook->'samples') s WHERE NOT EXISTS
          (SELECT 1 FROM jsonb_array_elements(p_workbook->'clients') c WHERE c->>'temporaryReference'=s->>'clientTemporaryReference') OR NOT EXISTS
          (SELECT 1 FROM jsonb_array_elements(p_workbook->'assignments') a WHERE a->>'sampleTemporaryReference'=s->>'temporaryReference'))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_workbook->'assignments') a WHERE NOT EXISTS
          (SELECT 1 FROM jsonb_array_elements(p_workbook->'samples') s WHERE s->>'temporaryReference'=a->>'sampleTemporaryReference')) THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
    END IF;
    v_bindings := p_bindings_text::JSONB;
    SELECT jsonb_agg(tuple ORDER BY convert_to(public.accession_confirmation_tuple_json(tuple),'UTF8')) INTO v_sealed
    FROM (SELECT jsonb_build_array(kind,row_number,parent_row,import_code,entity_id,generation,method_name,
        outcome,matched_id,key_version,fingerprint) AS tuple FROM public.accession_preview_bindings WHERE batch_id=p_batch) b;
    IF v_bindings IS DISTINCT FROM v_sealed OR public.accession_confirmation_tuple_json(v_bindings) IS DISTINCT FROM p_bindings_text
       OR jsonb_array_length(v_bindings) <> v_batch.client_count+v_batch.sample_count+v_batch.assignment_count THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID';
    END IF;
    -- Bind every exact row, parent, code, UUID/generation/method and selected pair to the sealed graph.
    IF EXISTS (SELECT 1 FROM public.accession_preview_bindings b WHERE b.batch_id=p_batch AND
      CASE b.kind WHEN 'client' THEN NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_clients) c
          WHERE (c->>'row')::BIGINT=b.row_number AND c->'resolution'->>'outcome'=b.outcome
            AND (c->'resolution'->>'clientId')::UUID IS NOT DISTINCT FROM b.matched_id)
      WHEN 'sample' THEN NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_workbook->'samples') s
          JOIN jsonb_array_elements(p_workbook->'clients') c ON c->>'temporaryReference'=s->>'clientTemporaryReference'
          WHERE (s->'callerContext'->>'row')::BIGINT=b.row_number AND (c->'callerContext'->>'row')::BIGINT=b.parent_row AND s->>'sampleTypeCode'=b.import_code)
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot->'sampleTypes') t
          WHERE t->>'id'=b.entity_id::TEXT AND t->>'importCode'=b.import_code AND (t->>'compatibilityGeneration')::BIGINT=b.generation)
      ELSE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_workbook->'assignments') a
          JOIN jsonb_array_elements(p_workbook->'samples') s ON s->>'temporaryReference'=a->>'sampleTemporaryReference'
          WHERE (a->'callerContext'->>'row')::BIGINT=b.row_number AND (s->'callerContext'->>'row')::BIGINT=b.parent_row AND a->>'assayCode'=b.import_code)
        OR NOT EXISTS (SELECT 1 FROM public.accession_preview_bindings s
          JOIN jsonb_array_elements(v_snapshot->'pairs') p ON p->>'sampleTypeId'=s.entity_id::TEXT AND p->>'assayDefinitionId'=b.entity_id::TEXT
          WHERE s.batch_id=p_batch AND s.kind='sample' AND s.row_number=b.parent_row)
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot->'assays') a WHERE a->>'id'=b.entity_id::TEXT
          AND a->>'importCode'=b.import_code AND (a->>'compatibilityGeneration')::BIGINT=b.generation AND a->>'methodName' IS NOT DISTINCT FROM b.method_name) END) THEN
        RAISE EXCEPTION 'ACCESSION_CONFIRMATION_AUTHORITY_CHANGED';
    END IF;
    -- Reconstruct canonical intent from current normalized clients and the validated nested row graph.
    WITH samples AS (
        SELECT s->>'clientTemporaryReference' AS client_ref, jsonb_build_array(s->>'sampleTypeCode','acceptable',
            (SELECT jsonb_agg(a->'assayCode' ORDER BY convert_to(a->>'assayCode','UTF8'))
             FROM jsonb_array_elements(p_workbook->'assignments') a WHERE a->>'sampleTemporaryReference'=s->>'temporaryReference')) AS tuple
        FROM jsonb_array_elements(p_workbook->'samples') s
    ), clients AS (
        SELECT jsonb_build_array(c->'input'->'name',c->'input'->'dateOfBirth',c->'input'->'governmentIdentityType',
            c->'input'->'governmentIdentityValue',c->'input'->'gender',c->'input'->'phone',c->'input'->'address',
            c->'input'->'healthInsuranceNum',c->'input'->'expiryDate',
            (SELECT jsonb_agg(s.tuple ORDER BY convert_to(public.accession_confirmation_tuple_json(s.tuple),'UTF8'))
             FROM samples s WHERE s.client_ref=w->>'temporaryReference')) AS tuple
        FROM jsonb_array_elements(v_clients) c JOIN jsonb_array_elements(p_workbook->'clients') w
          ON c->>'row'=w->'callerContext'->>'row'
    ) SELECT public.accession_confirmation_tuple_json(jsonb_agg(tuple ORDER BY convert_to(public.accession_confirmation_tuple_json(tuple),'UTF8')))
      INTO v_canonical FROM clients;
    IF v_canonical IS DISTINCT FROM p_canonical_intent THEN RAISE EXCEPTION 'ACCESSION_CONFIRMATION_INVALID'; END IF;
    -- One acceptance clock only after every lock and validation. Never persist it in Phase 2.
    v_now := clock_timestamp();
    IF v_now >= v_batch.expires_at THEN RAISE EXCEPTION 'ACCESSION_CONFIRMATION_EXPIRED'; END IF;
    RETURN v_now;
END;
$$;

DO $privileges$
DECLARE v_function RECORD;
BEGIN
    FOR v_function IN SELECT oid::REGPROCEDURE AS signature FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE
      AND proname IN ('get_accession_confirmation_preparation','accession_confirmation_tuple_json','validate_accession_confirmation_locked') LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',v_function.signature);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',v_function.signature);
    END LOOP;
END;
$privileges$;
GRANT EXECUTE ON FUNCTION public.get_accession_confirmation_preparation(UUID,UUID) TO service_role;

CREATE FUNCTION public.test_accession_confirmation_validation_security() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT count(*)=3 AND bool_and(p.proowner='postgres'::REGROLE AND p.prosecdef
        AND p.proconfig @> ARRAY['search_path=public, pg_temp']
        AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
        AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
        AND has_function_privilege('service_role',p.oid,'EXECUTE')=(p.proname='get_accession_confirmation_preparation'))
    FROM pg_proc p WHERE p.pronamespace='public'::REGNAMESPACE AND p.proname IN
      ('get_accession_confirmation_preparation','accession_confirmation_tuple_json','validate_accession_confirmation_locked');
$$;
ALTER FUNCTION public.test_accession_confirmation_validation_security() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.test_accession_confirmation_validation_security() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_accession_confirmation_validation_security() TO authenticated;
DO $register$
DECLARE v_definition TEXT;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE) INTO STRICT v_definition;
    IF v_definition NOT LIKE '%test_accession_import_provenance_security()%' THEN RAISE EXCEPTION 'Migration 236 security registry mismatch'; END IF;
    EXECUTE replace(v_definition,'test_accession_import_provenance_security()',
        'test_accession_import_provenance_security() AND test_accession_confirmation_validation_security()');
    IF NOT public.test_accession_confirmation_validation_security() THEN RAISE EXCEPTION 'Migration 236 verification failed'; END IF;
END;
$register$;
COMMIT;
