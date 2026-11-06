-- Migration 238: recover atomic accession confirmation from the verified 235 baseline.
-- Supersedes failed 236 and unexecuted 237; those historical files remain immutable.
-- Security impact: preserves their owners, fixed paths, RLS and service-only entrypoint grants.
-- Only change to recovered definitions: parentheses around 236's CASE expression in PL/pgSQL IF.
-- Apply 235 then 238; do not apply 236/237 before or after this recovery migration.
-- Runtime requires committed exact bytes, run_security_tests() and retained SQL/concurrency fixtures.
-- ponytail: supports verified 235 only; other installed baselines need a separate forward migration.
BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $recovery_baseline$
BEGIN
    IF current_setting('check_function_bodies')::BOOLEAN IS DISTINCT FROM TRUE
       OR to_regclass('public.accession_import_receipts') IS NULL
       OR to_regclass('public.accession_import_mappings') IS NULL
       OR to_regprocedure('public.test_accession_import_provenance_security()') IS NULL
       OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE AND proname IN
          ('get_accession_confirmation_preparation','accession_confirmation_tuple_json',
           'validate_accession_confirmation_locked','test_accession_confirmation_validation_security',
           'confirm_accession_import','test_accession_confirmation_atomic_security'))
       OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
           WHERE oid=to_regprocedure('public.guard_accession_preview_mutation()')) IS DISTINCT FROM
          'c59214d857dc91923ce41480901925267d20035cb1c988a3d9ddff2464ac3a8b'
       OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
           WHERE oid=to_regprocedure('public.validate_accession_import_receipt(uuid)')) IS DISTINCT FROM
          'b1050737434de758c3dd4d57382176807cfe7ee06d7b1f6448d8a3702333587d' THEN
        RAISE EXCEPTION 'Migration 238 supports only the verified 235 baseline with checked function bodies';
    END IF;
    IF public.test_accession_import_provenance_security() IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Migration 238 provenance security baseline mismatch';
    END IF;
END;
$recovery_baseline$;

-- Recovered 236 definitions and original verification.
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
               OR v_item->'callerContext'->>'sheet' IS DISTINCT FROM (CASE v_kind WHEN 'clients' THEN 'Khách hàng' WHEN 'samples' THEN 'Mẫu' ELSE 'Chỉ định' END)
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

-- Recovered 237 definitions and original final verification.
DO $baseline$
BEGIN
    IF to_regprocedure('public.validate_accession_confirmation_locked(uuid,uuid,boolean,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)') IS NULL
       OR to_regprocedure('public.get_accession_confirmation_preparation(uuid,uuid)') IS NULL
       OR to_regprocedure('public.generate_next_sample_id()') IS NULL
       OR to_regclass('public.sample_id_sequences') IS NULL
       OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE AND proname IN
          ('confirm_accession_import','test_accession_confirmation_atomic_security'))
       OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
           WHERE oid='public.guard_accession_preview_mutation()'::REGPROCEDURE) IS DISTINCT FROM
          'c59214d857dc91923ce41480901925267d20035cb1c988a3d9ddff2464ac3a8b'
       OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
           WHERE oid='public.validate_accession_import_receipt(uuid)'::REGPROCEDURE) IS DISTINCT FROM
          'b1050737434de758c3dd4d57382176807cfe7ee06d7b1f6448d8a3702333587d'
       OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.assay_definitions'::REGCLASS AND attname='method_id' AND NOT attisdropped)
       OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.results'::REGCLASS AND attname='method_id' AND NOT attnotnull AND NOT attisdropped)
       OR NOT public.test_accession_import_provenance_security() OR NOT public.test_accession_confirmation_validation_security() THEN
        RAISE EXCEPTION 'Migration 237 requires exact 234/235 guards and current 236 schema';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.accession_preview_batches'::REGCLASS
        AND conname='accession_preview_batches_reason_code_check' AND convalidated
        AND pg_get_constraintdef(oid) LIKE '%PREPARATION_FAILED%' AND pg_get_constraintdef(oid) NOT LIKE '%ALREADY_IMPORTED%') THEN
        RAISE EXCEPTION 'Migration 237 reason baseline mismatch';
    END IF;
END;
$baseline$;
ALTER TABLE public.accession_preview_batches DROP CONSTRAINT accession_preview_batches_reason_code_check;
ALTER TABLE public.accession_preview_batches ADD CONSTRAINT accession_preview_batches_reason_code_check CHECK
    (reason_code IN ('WORKBOOK_INVALID','CLIENT_INVALID','PREPARATION_FAILED','AUTHORITY_CHANGED','PREVIEW_CONTENT_CHANGED','EXPIRED',
        'ALREADY_IMPORTED','CONFIRMATION_FAILED','ATTESTATION_REQUIRED','CONFIGURATION_UNAVAILABLE'));

CREATE OR REPLACE FUNCTION public.guard_accession_preview_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE'; END IF;
    IF TG_TABLE_NAME='accession_preview_bindings' THEN
        IF TG_OP<>'INSERT' OR NOT EXISTS(SELECT 1 FROM public.accession_preview_batches WHERE id=NEW.batch_id AND state='preparing') THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP='UPDATE' THEN
        IF OLD.state NOT IN ('preparing','preview_ready')
           OR (OLD.source_sha256 IS NOT NULL AND (NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256 OR NEW.source_size IS DISTINCT FROM OLD.source_size))
           OR (to_jsonb(NEW)-ARRAY['state','reason_code','finished_at','lease_heartbeat_at','lease_expires_at','preview_created_at','expires_at',
             'source_sha256','source_size','normalized_payload_hash','canonicalization_version','template_version','template_digest',
             'template_claims_digest','catalog_digest','revision','validation_version','resolver_version','binding_set_digest',
             'client_count','sample_count','assignment_count','create_count','reuse_count']) IS DISTINCT FROM
              (to_jsonb(OLD)-ARRAY['state','reason_code','finished_at','lease_heartbeat_at','lease_expires_at','preview_created_at','expires_at',
             'source_sha256','source_size','normalized_payload_hash','canonicalization_version','template_version','template_digest',
             'template_claims_digest','catalog_digest','revision','validation_version','resolver_version','binding_set_digest',
             'client_count','sample_count','assignment_count','create_count','reuse_count'])
           OR (OLD.state='preparing' AND NEW.state NOT IN ('preparing','preview_ready','rejected','failed'))
           OR (OLD.state='preview_ready' AND (NEW.state NOT IN ('failed','expired','succeeded')
             OR (to_jsonb(NEW)-ARRAY['state','reason_code','finished_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','reason_code','finished_at']))) THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE';
        END IF;
        IF NEW.state='succeeded' AND (NEW.reason_code IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.accession_import_receipts r
            WHERE r.batch_id=NEW.id AND r.owner_id=NEW.owner_id AND r.normalized_payload_hash=NEW.normalized_payload_hash
              AND r.confirmation_received_at>=NEW.preview_created_at AND r.confirmation_received_at<NEW.expires_at)) THEN
            RAISE EXCEPTION 'ACCESSION_IMPORT_INCOMPLETE';
        END IF;
    END IF;
    IF TG_OP='INSERT' OR NEW.state IS DISTINCT FROM OLD.state THEN
        INSERT INTO public.audit_logs(table_name,record_id,operation,new_values,changed_by)
        VALUES('accession_preview_batches',NEW.id,CASE WHEN TG_OP='INSERT' THEN 'INSERT' ELSE 'UPDATE' END,
            jsonb_build_object('batch_id',NEW.id,'state',NEW.state,'reason_code',NEW.reason_code,'source_sha256',NEW.source_sha256,
                'source_size',NEW.source_size,'finished_at',NEW.finished_at,'client_count',NEW.client_count,
                'sample_count',NEW.sample_count,'assignment_count',NEW.assignment_count),NEW.owner_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Forward-only replacement of 235: preserve every graph/audit check, correct method authority only.
CREATE OR REPLACE FUNCTION public.validate_accession_import_receipt(p_batch UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_receipt public.accession_import_receipts; v_batch public.accession_preview_batches;
    v_clients BIGINT; v_samples BIGINT; v_assignments BIGINT; v_created BIGINT; v_reused BIGINT;
BEGIN
    SELECT * INTO v_receipt FROM public.accession_import_receipts WHERE batch_id=p_batch;
    IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_IMPORT_INCOMPLETE'; END IF;
    SELECT * INTO v_batch FROM public.accession_preview_batches WHERE id=p_batch;
    IF NOT FOUND OR v_batch.state<>'succeeded' OR v_receipt.owner_id IS DISTINCT FROM v_batch.owner_id
       OR v_receipt.normalized_payload_hash IS DISTINCT FROM v_batch.normalized_payload_hash
       OR v_receipt.confirmation_received_at<v_batch.preview_created_at OR v_receipt.confirmation_received_at>=v_batch.expires_at
       OR v_batch.finished_at<v_receipt.confirmation_received_at
       OR ROW(v_receipt.client_count,v_receipt.sample_count,v_receipt.assignment_count,v_receipt.create_count,v_receipt.reuse_count)
          IS DISTINCT FROM ROW(v_batch.client_count,v_batch.sample_count,v_batch.assignment_count,v_batch.create_count,v_batch.reuse_count) THEN
        RAISE EXCEPTION 'ACCESSION_IMPORT_INCOMPLETE';
    END IF;
    SELECT count(*) FILTER(WHERE kind='client'),count(*) FILTER(WHERE kind='sample'),count(*) FILTER(WHERE kind='assignment'),
        count(*) FILTER(WHERE outcome='created'),count(*) FILTER(WHERE outcome='reused')
    INTO v_clients,v_samples,v_assignments,v_created,v_reused FROM public.accession_import_mappings WHERE batch_id=p_batch;
    IF ROW(v_clients,v_samples,v_assignments,v_created,v_reused) IS DISTINCT FROM
       ROW(v_receipt.client_count,v_receipt.sample_count,v_receipt.assignment_count,v_receipt.create_count,v_receipt.reuse_count)
       OR (SELECT count(*) FROM public.accession_preview_bindings WHERE batch_id=p_batch)<>v_clients+v_samples+v_assignments THEN
        RAISE EXCEPTION 'ACCESSION_IMPORT_INCOMPLETE';
    END IF;
    IF EXISTS(SELECT 1 FROM public.accession_import_mappings m
        LEFT JOIN public.accession_preview_bindings b ON b.batch_id=m.batch_id AND b.kind=m.kind AND b.row_number=m.row_number
        LEFT JOIN public.accession_import_mappings parent ON parent.batch_id=m.batch_id AND parent.kind=m.parent_kind AND parent.row_number=m.parent_row
        LEFT JOIN public.clients c ON c.id=m.client_id LEFT JOIN public.samples s ON s.id=m.sample_id
        LEFT JOIN public.results r ON r.id=m.result_id LEFT JOIN public.assay_definitions assay ON assay.id=m.assay_id
        LEFT JOIN public.audit_logs a ON a.id=m.creation_audit_id
        WHERE m.batch_id=p_batch AND (b.batch_id IS NULL OR c.deleted_at IS NOT NULL
          OR (m.kind='client' AND ((m.outcome='reused' AND (b.outcome IS DISTINCT FROM 'matched' OR b.matched_id IS DISTINCT FROM m.client_id))
              OR (m.outcome='created' AND b.outcome IS DISTINCT FROM 'not_found')))
          OR (m.kind<>'client' AND (b.parent_row IS DISTINCT FROM m.parent_row OR parent.client_id IS DISTINCT FROM m.client_id
              OR parent.temporary_reference IS DISTINCT FROM m.parent_temporary_reference))
          OR (m.kind='sample' AND (s.client_id IS DISTINCT FROM m.client_id OR s.sample_type_id IS DISTINCT FROM b.entity_id
              OR s.sample_id IS DISTINCT FROM m.official_sample_identifier OR s.sample_quality IS DISTINCT FROM TRUE
              OR s.received_at IS DISTINCT FROM v_receipt.confirmation_received_at OR s.received_by IS DISTINCT FROM v_receipt.owner_id
              OR s.status IS DISTINCT FROM 'assigned' OR s.deleted_at IS NOT NULL))
          OR (m.kind='assignment' AND (parent.sample_id IS DISTINCT FROM m.sample_id OR r.sample_id IS DISTINCT FROM m.sample_id
              OR r.assay_id IS DISTINCT FROM m.assay_id OR b.entity_id IS DISTINCT FROM m.assay_id
              OR b.import_code IS DISTINCT FROM m.assay_import_code OR r.method_id IS DISTINCT FROM m.method_id
              OR m.method_id IS NOT NULL OR assay.method_name IS DISTINCT FROM b.method_name OR r.status IS DISTINCT FROM 'pending'))
          OR (m.creation_audit_id IS NOT NULL AND (a.id IS NULL OR a.operation IS DISTINCT FROM 'INSERT'
              OR a.changed_by IS DISTINCT FROM v_receipt.owner_id OR a.record_id IS DISTINCT FROM
                  CASE m.kind WHEN 'client' THEN m.client_id WHEN 'sample' THEN m.sample_id ELSE m.result_id END
              OR a.table_name IS DISTINCT FROM CASE m.kind WHEN 'client' THEN 'clients' WHEN 'sample' THEN 'samples' ELSE 'results' END)))
    ) OR EXISTS(SELECT 1 FROM public.accession_import_mappings m WHERE m.batch_id=p_batch AND m.kind IN ('client','sample')
        AND NOT EXISTS(SELECT 1 FROM public.accession_import_mappings child WHERE child.batch_id=p_batch AND child.parent_kind=m.kind AND child.parent_row=m.row_number))
      OR NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE table_name='accession_preview_batches' AND record_id=p_batch AND operation='INSERT' AND changed_by=v_receipt.owner_id)
      OR NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE table_name='accession_preview_batches' AND record_id=p_batch
        AND operation='UPDATE' AND changed_by=v_receipt.owner_id AND new_values->>'state'='succeeded') THEN
        RAISE EXCEPTION 'ACCESSION_IMPORT_INCOMPLETE';
    END IF;
END;
$$;

CREATE FUNCTION public.confirm_accession_import(p_actor UUID,p_batch UUID,p_attested BOOLEAN,p_workbook JSONB,p_snapshot JSONB,
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
                SELECT id INTO STRICT v_audit FROM public.audit_logs WHERE table_name='results' AND record_id=v_result AND operation='INSERT' AND changed_by=p_actor;
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

DO $privileges$
DECLARE v_function RECORD;
BEGIN
    FOR v_function IN SELECT oid::REGPROCEDURE AS signature FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE AND proname IN
        ('guard_accession_preview_mutation','validate_accession_import_receipt','confirm_accession_import') LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',v_function.signature);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',v_function.signature);
    END LOOP;
END;
$privileges$;
GRANT EXECUTE ON FUNCTION public.confirm_accession_import(UUID,UUID,BOOLEAN,JSONB,JSONB,JSONB,JSONB,TEXT,TEXT,JSONB,TEXT) TO service_role;
CREATE FUNCTION public.test_accession_confirmation_atomic_security() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT count(*)=3 AND bool_and(p.proowner='postgres'::REGROLE AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp']
        AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
        AND has_function_privilege('service_role',p.oid,'EXECUTE')=(p.proname='confirm_accession_import'))
    FROM pg_proc p WHERE p.pronamespace='public'::REGNAMESPACE AND p.proname IN
        ('guard_accession_preview_mutation','validate_accession_import_receipt','confirm_accession_import');
$$;
ALTER FUNCTION public.test_accession_confirmation_atomic_security() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.test_accession_confirmation_atomic_security() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_accession_confirmation_atomic_security() TO authenticated;
DO $register$
DECLARE v_definition TEXT; v_passed BOOLEAN;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE) INTO STRICT v_definition;
    IF v_definition NOT LIKE '%test_accession_confirmation_validation_security()%' THEN RAISE EXCEPTION 'Migration 237 security registry mismatch'; END IF;
    EXECUTE replace(v_definition,'test_accession_confirmation_validation_security()',
        'test_accession_confirmation_validation_security() AND test_accession_confirmation_atomic_security()');
    SELECT bool_and(passed) INTO v_passed FROM public.run_security_tests();
    IF v_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Migration 237 security verification failed'; END IF;
END;
$register$;
COMMIT;
