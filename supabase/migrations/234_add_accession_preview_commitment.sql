-- Migration 234: owner-bound accession preview metadata, expiring typed bindings and safe lifecycle audit.
-- Security impact: browser roles have owner+current-analyst SELECT only; service RPCs independently
-- authorize active analysts. Transient identity inputs are rechecked, never retained or audited.
-- No business writes/success/cleanup runner. Apply only in an authorized home-server session;
-- retained SQL fixtures and run_security_tests() are mandatory runtime gates, not source-test claims.
BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $baseline$
BEGIN
    IF to_regprocedure('public.resolve_accession_preview_clients_v1(jsonb)') IS NULL
       OR to_regprocedure('public.get_accession_template_snapshot()') IS NULL
       OR to_regprocedure('public.test_accession_preview_client_resolution_security()') IS NULL
       OR to_regclass('public.accession_preview_batches') IS NOT NULL
       OR to_regclass('public.accession_preview_bindings') IS NOT NULL
       OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE AND proname IN
           ('authorize_accession_preview_actor','guard_accession_preview_mutation','start_accession_preview',
            'heartbeat_accession_preview','finish_accession_preview','seal_accession_preview','test_accession_preview_commitment_security')) THEN
        RAISE EXCEPTION 'Migration 234 requires migration 233 and unused preview schema';
    END IF;
END;
$baseline$;

CREATE TABLE public.accession_preview_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.users(id),
    retry_of UUID REFERENCES public.accession_preview_batches(id),
    state TEXT NOT NULL DEFAULT 'preparing' CHECK (state IN ('preparing','preview_ready','rejected','failed','expired','succeeded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    lease_token UUID NOT NULL DEFAULT gen_random_uuid(),
    lease_generation BIGINT NOT NULL DEFAULT 1 CHECK (lease_generation > 0),
    lease_duration_ms INTEGER NOT NULL CHECK (lease_duration_ms > 0),
    policy_evidence TEXT NOT NULL CHECK (policy_evidence ~ '^[A-Za-z0-9._:/-]{1,160}$'),
    lease_heartbeat_at TIMESTAMPTZ NOT NULL,
    lease_expires_at TIMESTAMPTZ NOT NULL,
    preview_created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, finished_at TIMESTAMPTZ,
    source_sha256 TEXT CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    source_size BIGINT CHECK (source_size > 0 AND source_size < 10000000),
    normalized_payload_hash TEXT CHECK (normalized_payload_hash ~ '^[0-9a-f]{64}$'),
    canonicalization_version TEXT CHECK (canonicalization_version = 'accession-intent-v1'),
    template_version TEXT CHECK (template_version = '1'),
    template_digest TEXT CHECK (template_digest ~ '^[0-9a-f]{64}$'),
    template_claims_digest TEXT CHECK (template_claims_digest ~ '^[0-9a-f]{64}$'),
    catalog_digest TEXT CHECK (catalog_digest ~ '^[0-9a-f]{64}$'),
    revision BIGINT CHECK (revision > 0),
    validation_version TEXT CHECK (validation_version = 'accession-workbook-v1'),
    resolver_version TEXT CHECK (resolver_version = 'accession-preview-clients-v1'),
    binding_set_digest TEXT CHECK (binding_set_digest ~ '^[0-9a-f]{64}$'),
    client_count BIGINT, sample_count BIGINT, assignment_count BIGINT, create_count BIGINT, reuse_count BIGINT,
    reason_code TEXT CHECK (reason_code IN ('WORKBOOK_INVALID','CLIENT_INVALID','PREPARATION_FAILED','AUTHORITY_CHANGED','PREVIEW_CONTENT_CHANGED','EXPIRED')),
    CHECK ((source_sha256 IS NULL) = (source_size IS NULL)),
    CHECK ((state IN ('preparing','preview_ready') AND finished_at IS NULL)
        OR (state IN ('rejected','failed','expired','succeeded') AND finished_at IS NOT NULL)),
    CHECK ((preview_created_at IS NULL AND expires_at IS NULL
        AND normalized_payload_hash IS NULL AND canonicalization_version IS NULL AND template_version IS NULL
        AND template_digest IS NULL AND template_claims_digest IS NULL AND catalog_digest IS NULL AND revision IS NULL
        AND validation_version IS NULL AND resolver_version IS NULL AND binding_set_digest IS NULL
        AND client_count IS NULL AND sample_count IS NULL AND assignment_count IS NULL AND create_count IS NULL AND reuse_count IS NULL
        AND state IN ('preparing','rejected','failed')) OR
       (preview_created_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at = preview_created_at + INTERVAL '30 minutes'
        AND source_sha256 IS NOT NULL AND source_size IS NOT NULL AND normalized_payload_hash IS NOT NULL
        AND canonicalization_version IS NOT NULL AND template_version IS NOT NULL AND template_digest IS NOT NULL
        AND template_claims_digest IS NOT NULL AND catalog_digest IS NOT NULL AND revision IS NOT NULL
        AND validation_version IS NOT NULL AND resolver_version IS NOT NULL AND binding_set_digest IS NOT NULL
        AND client_count IS NOT NULL AND sample_count IS NOT NULL AND assignment_count IS NOT NULL
        AND create_count IS NOT NULL AND reuse_count IS NOT NULL
        AND client_count > 0 AND sample_count > 0 AND assignment_count > 0 AND create_count >= 0 AND reuse_count >= 0
        AND client_count = create_count + reuse_count AND state IN ('preview_ready','failed','expired','succeeded')))
);
CREATE TABLE public.accession_preview_bindings (
    batch_id UUID NOT NULL REFERENCES public.accession_preview_batches(id),
    kind TEXT NOT NULL CHECK (kind IN ('client','sample','assignment')),
    row_number BIGINT NOT NULL CHECK (row_number > 0), parent_row BIGINT CHECK (parent_row > 0),
    import_code TEXT, entity_id UUID, generation BIGINT CHECK (generation > 0), method_name TEXT,
    outcome TEXT, matched_id UUID, key_version TEXT, fingerprint TEXT,
    PRIMARY KEY (batch_id, kind, row_number),
    CHECK (CASE kind WHEN 'client' THEN
        parent_row IS NULL AND import_code IS NULL AND entity_id IS NULL AND generation IS NULL AND method_name IS NULL
        AND outcome IS NOT NULL AND outcome IN ('matched','not_found')
        AND ((outcome = 'matched' AND matched_id IS NOT NULL) OR (outcome = 'not_found' AND matched_id IS NULL))
        AND key_version IS NOT NULL AND key_version ~ '^[A-Za-z0-9_-]{1,32}$'
        AND fingerprint IS NOT NULL AND fingerprint ~ '^[0-9a-f]{64}$'
      ELSE parent_row IS NOT NULL AND import_code IS NOT NULL
        AND import_code ~ CASE kind WHEN 'sample' THEN '^LM-[0-9]{6}$' ELSE '^CT-[0-9]{6}$' END
        AND entity_id IS NOT NULL AND generation IS NOT NULL AND (kind <> 'sample' OR method_name IS NULL)
        AND outcome IS NULL AND matched_id IS NULL AND key_version IS NULL AND fingerprint IS NULL END)
);
CREATE INDEX accession_preview_batches_owner_created ON public.accession_preview_batches(owner_id, created_at);
ALTER TABLE public.accession_preview_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accession_preview_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accession_preview_batches, public.accession_preview_bindings FROM PUBLIC, anon, authenticated, service_role;
-- Lease tokens never leave the privileged server path.
GRANT SELECT (id, owner_id, retry_of, state, created_at, preview_created_at, expires_at, finished_at, source_sha256, source_size,
    normalized_payload_hash, canonicalization_version, template_version, template_digest, template_claims_digest, catalog_digest,
    revision, validation_version, resolver_version, binding_set_digest, client_count, sample_count, assignment_count,
    create_count, reuse_count, reason_code) ON public.accession_preview_batches TO authenticated;
GRANT SELECT ON public.accession_preview_bindings TO authenticated;
DROP POLICY IF EXISTS accession_preview_owner_select ON public.accession_preview_batches;
CREATE POLICY accession_preview_owner_select ON public.accession_preview_batches FOR SELECT TO authenticated
USING (owner_id = auth.uid() AND public.get_user_role() = 'analyst'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND deleted_at IS NULL));
DROP POLICY IF EXISTS accession_preview_bindings_owner_select ON public.accession_preview_bindings;
CREATE POLICY accession_preview_bindings_owner_select ON public.accession_preview_bindings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.accession_preview_batches WHERE id = batch_id AND owner_id = auth.uid()
        AND state = 'preview_ready' AND clock_timestamp() < expires_at)
    AND public.get_user_role() = 'analyst'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND deleted_at IS NULL));

CREATE FUNCTION public.authorize_accession_preview_actor(p_actor UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    PERFORM 1 FROM public.users WHERE id = p_actor AND role = 'analyst' AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_FORBIDDEN' USING ERRCODE = '42501'; END IF;
END;
$$;

CREATE FUNCTION public.guard_accession_preview_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE'; END IF;
    IF TG_TABLE_NAME = 'accession_preview_bindings' THEN
        IF TG_OP <> 'INSERT' OR NOT EXISTS (SELECT 1 FROM public.accession_preview_batches WHERE id = NEW.batch_id AND state = 'preparing') THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF OLD.state NOT IN ('preparing','preview_ready') OR
           (OLD.source_sha256 IS NOT NULL AND (NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256 OR NEW.source_size IS DISTINCT FROM OLD.source_size)) OR
           (to_jsonb(NEW) - ARRAY['state','reason_code','finished_at','lease_heartbeat_at','lease_expires_at','preview_created_at','expires_at',
             'source_sha256','source_size','normalized_payload_hash','canonicalization_version','template_version','template_digest',
             'template_claims_digest','catalog_digest','revision','validation_version','resolver_version','binding_set_digest',
             'client_count','sample_count','assignment_count','create_count','reuse_count']) IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['state','reason_code','finished_at','lease_heartbeat_at','lease_expires_at','preview_created_at','expires_at',
             'source_sha256','source_size','normalized_payload_hash','canonicalization_version','template_version','template_digest',
             'template_claims_digest','catalog_digest','revision','validation_version','resolver_version','binding_set_digest',
             'client_count','sample_count','assignment_count','create_count','reuse_count']) OR
           (OLD.state = 'preparing' AND NEW.state NOT IN ('preparing','preview_ready','rejected','failed')) OR
           (OLD.state = 'preview_ready' AND (NEW.state NOT IN ('failed','expired') OR
             (to_jsonb(NEW) - ARRAY['state','reason_code','finished_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['state','reason_code','finished_at']))) THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE';
        END IF;
    END IF;
    IF TG_OP = 'INSERT' OR NEW.state IS DISTINCT FROM OLD.state THEN
        INSERT INTO public.audit_logs(table_name, record_id, operation, new_values, changed_by)
        VALUES ('accession_preview_batches', NEW.id, CASE WHEN TG_OP = 'INSERT' THEN 'INSERT' ELSE 'UPDATE' END,
            jsonb_build_object('batch_id', NEW.id, 'state', NEW.state, 'reason_code', NEW.reason_code,
                'source_sha256', NEW.source_sha256, 'source_size', NEW.source_size, 'finished_at', NEW.finished_at,
                'client_count', NEW.client_count, 'sample_count', NEW.sample_count, 'assignment_count', NEW.assignment_count), NEW.owner_id);
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER accession_preview_batches_guard BEFORE INSERT OR UPDATE OR DELETE ON public.accession_preview_batches
FOR EACH ROW EXECUTE FUNCTION public.guard_accession_preview_mutation();
CREATE TRIGGER accession_preview_bindings_guard BEFORE INSERT OR UPDATE OR DELETE ON public.accession_preview_bindings
FOR EACH ROW EXECUTE FUNCTION public.guard_accession_preview_mutation();

CREATE FUNCTION public.start_accession_preview(p_actor UUID, p_retry_of UUID, p_lease_ms INTEGER, p_policy_evidence TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_now TIMESTAMPTZ; v_batch public.accession_preview_batches;
BEGIN
    PERFORM public.authorize_accession_preview_actor(p_actor);
    IF p_lease_ms IS NULL OR p_lease_ms < 1 OR p_policy_evidence IS NULL OR p_policy_evidence !~ '^[A-Za-z0-9._:/-]{1,160}$' THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_CONFIGURATION_UNAVAILABLE';
    END IF;
    IF p_retry_of IS NOT NULL THEN
        PERFORM 1 FROM public.accession_preview_batches WHERE id = p_retry_of AND owner_id = p_actor
          AND state IN ('rejected','failed','expired','succeeded') FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_RETRY_INVALID'; END IF;
    END IF;
    v_now := clock_timestamp();
    INSERT INTO public.accession_preview_batches(owner_id,retry_of,created_at,lease_duration_ms,policy_evidence,lease_heartbeat_at,lease_expires_at)
    VALUES(p_actor,p_retry_of,v_now,p_lease_ms,p_policy_evidence,v_now,v_now + p_lease_ms * INTERVAL '1 millisecond') RETURNING * INTO v_batch;
    RETURN jsonb_build_object('id',v_batch.id,'lease_token',v_batch.lease_token,'lease_generation',v_batch.lease_generation,
        'preview_created_at',NULL,'expires_at',NULL);
END;
$$;

CREATE FUNCTION public.heartbeat_accession_preview(p_actor UUID,p_batch UUID,p_token UUID,p_generation BIGINT,
    p_source_sha256 TEXT DEFAULT NULL,p_source_size BIGINT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch public.accession_preview_batches; v_now TIMESTAMPTZ;
BEGIN
    PERFORM public.authorize_accession_preview_actor(p_actor);
    SELECT * INTO v_batch FROM public.accession_preview_batches WHERE id=p_batch AND owner_id=p_actor FOR UPDATE;
    v_now := clock_timestamp();
    IF NOT FOUND OR v_batch.state <> 'preparing' OR v_batch.lease_token IS DISTINCT FROM p_token
       OR v_batch.lease_generation IS DISTINCT FROM p_generation OR v_now >= v_batch.lease_expires_at THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_LEASE_STALE';
    END IF;
    IF (p_source_sha256 IS NULL) <> (p_source_size IS NULL) OR
       (v_batch.source_sha256 IS NOT NULL AND p_source_sha256 IS NOT NULL AND
        (v_batch.source_sha256 IS DISTINCT FROM p_source_sha256 OR v_batch.source_size IS DISTINCT FROM p_source_size)) THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE';
    END IF;
    UPDATE public.accession_preview_batches SET lease_heartbeat_at=v_now,
        lease_expires_at=v_now + lease_duration_ms * INTERVAL '1 millisecond',
        source_sha256=COALESCE(source_sha256,p_source_sha256),source_size=COALESCE(source_size,p_source_size) WHERE id=p_batch;
END;
$$;

CREATE FUNCTION public.finish_accession_preview(p_actor UUID,p_batch UUID,p_token UUID,p_generation BIGINT,p_state TEXT,p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch public.accession_preview_batches; v_now TIMESTAMPTZ;
BEGIN
    PERFORM public.authorize_accession_preview_actor(p_actor);
    SELECT * INTO v_batch FROM public.accession_preview_batches WHERE id=p_batch AND owner_id=p_actor FOR UPDATE;
    v_now := clock_timestamp();
    IF NOT FOUND OR v_batch.lease_token IS DISTINCT FROM p_token OR v_batch.lease_generation IS DISTINCT FROM p_generation THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_LEASE_STALE';
    END IF;
    IF v_batch.state = 'preparing' THEN
        IF v_now >= v_batch.lease_expires_at OR p_state IS NULL OR p_reason IS NULL
           OR NOT ((p_state='rejected' AND p_reason IN ('WORKBOOK_INVALID','CLIENT_INVALID'))
               OR (p_state='failed' AND p_reason IN ('PREPARATION_FAILED','AUTHORITY_CHANGED'))) THEN
            RAISE EXCEPTION 'ACCESSION_PREVIEW_LEASE_STALE';
        END IF;
    ELSIF v_batch.state = 'preview_ready' THEN
        IF v_now >= v_batch.expires_at AND p_state IS DISTINCT FROM 'expired' THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_EXPIRED'; END IF;
        IF p_state='expired' AND p_reason='EXPIRED' AND v_now >= v_batch.expires_at THEN NULL;
        ELSIF p_state='failed' AND p_reason IN ('AUTHORITY_CHANGED','PREVIEW_CONTENT_CHANGED') THEN NULL;
        ELSE RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE'; END IF;
    ELSE RAISE EXCEPTION 'ACCESSION_PREVIEW_IMMUTABLE'; END IF;
    UPDATE public.accession_preview_batches SET state=p_state,reason_code=p_reason,finished_at=v_now WHERE id=p_batch;
END;
$$;

CREATE FUNCTION public.seal_accession_preview(p_actor UUID,p_batch UUID,p_token UUID,p_generation BIGINT,
    p_snapshot JSONB,p_clients JSONB,p_expected_clients JSONB,p_bindings_text TEXT,p_metadata JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch public.accession_preview_batches; v_now TIMESTAMPTZ; v_bindings JSONB; v_item JSONB;
    v_claims TEXT; v_subject TEXT; v_role TEXT; v_snapshot JSONB; v_clients JSONB;
BEGIN
    PERFORM public.authorize_accession_preview_actor(p_actor);
    SELECT * INTO v_batch FROM public.accession_preview_batches WHERE id=p_batch AND owner_id=p_actor FOR UPDATE;
    IF NOT FOUND OR v_batch.state <> 'preparing' OR v_batch.lease_token IS DISTINCT FROM p_token
       OR v_batch.lease_generation IS DISTINCT FROM p_generation THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_LEASE_STALE'; END IF;
    -- ponytail: coarse SHARE locks prevent catalog and absent-client phantoms; TASK-7 must benchmark
    -- this ceiling before release. Upgrade to coordinated key/revision locks if measured contention warrants it.
    LOCK TABLE public.assay_definitions, public.assay_sample_type_catalog_revisions,
        public.assay_sample_type_compatibilities, public.assay_sample_type_reviews,
        public.client_collision_adjudications, public.clients, public.sample_types IN SHARE MODE;
    v_now := clock_timestamp();
    IF v_now >= v_batch.lease_expires_at THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_LEASE_STALE'; END IF;
    v_claims := current_setting('request.jwt.claims',true);
    v_subject := current_setting('request.jwt.claim.sub',true); v_role := current_setting('request.jwt.claim.role',true);
    BEGIN
        PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::TEXT,true);
        PERFORM set_config('request.jwt.claim.sub',p_actor::TEXT,true); PERFORM set_config('request.jwt.claim.role','authenticated',true);
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
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_clients) c WHERE c->'resolution'->>'outcome' NOT IN ('matched','not_found') OR c->'issues' <> '[]'::JSONB) THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_AUTHORITY_CHANGED';
    END IF;
    v_bindings := p_bindings_text::JSONB;
    IF jsonb_typeof(v_bindings) IS DISTINCT FROM 'array' OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object'
       OR v_batch.source_sha256 IS NULL OR v_batch.source_size IS NULL
       OR p_metadata->>'source_sha256' IS DISTINCT FROM v_batch.source_sha256
       OR (p_metadata->>'source_size')::BIGINT IS DISTINCT FROM v_batch.source_size
       OR p_metadata->>'binding_set_digest' IS DISTINCT FROM encode(sha256(convert_to(p_bindings_text,'UTF8')),'hex')
       OR p_metadata->>'template_version' IS DISTINCT FROM '1' OR p_metadata->>'revision' IS DISTINCT FROM v_snapshot->>'revisionNumber' THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_BINDINGS_INVALID';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_bindings) LOOP
        IF jsonb_typeof(v_item) IS DISTINCT FROM 'array' OR jsonb_array_length(v_item) IS DISTINCT FROM 11 THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_BINDINGS_INVALID'; END IF;
        INSERT INTO public.accession_preview_bindings(batch_id,kind,row_number,parent_row,import_code,entity_id,generation,method_name,outcome,matched_id,key_version,fingerprint)
        VALUES(p_batch,v_item->>0,(v_item->>1)::BIGINT,(v_item->>2)::BIGINT,v_item->>3,(v_item->>4)::UUID,
            (v_item->>5)::BIGINT,v_item->>6,v_item->>7,(v_item->>8)::UUID,v_item->>9,v_item->>10);
    END LOOP;
    IF (SELECT count(*) FROM public.accession_preview_bindings WHERE batch_id=p_batch AND kind='client') IS DISTINCT FROM (p_metadata->>'client_count')::BIGINT
       OR (SELECT count(*) FROM public.accession_preview_bindings WHERE batch_id=p_batch AND kind='sample') IS DISTINCT FROM (p_metadata->>'sample_count')::BIGINT
       OR (SELECT count(*) FROM public.accession_preview_bindings WHERE batch_id=p_batch AND kind='assignment') IS DISTINCT FROM (p_metadata->>'assignment_count')::BIGINT
       OR (SELECT count(*) FROM public.accession_preview_bindings WHERE batch_id=p_batch AND outcome='not_found') IS DISTINCT FROM (p_metadata->>'create_count')::BIGINT
       OR (SELECT count(*) FROM public.accession_preview_bindings WHERE batch_id=p_batch AND outcome='matched') IS DISTINCT FROM (p_metadata->>'reuse_count')::BIGINT
       OR jsonb_array_length(v_clients) IS DISTINCT FROM (p_metadata->>'client_count')::BIGINT THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_BINDINGS_INVALID';
    END IF;
    IF EXISTS (SELECT 1 FROM public.accession_preview_bindings b WHERE b.batch_id=p_batch AND
      CASE b.kind WHEN 'client' THEN NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_clients) c
          WHERE (c->>'row')::BIGINT=b.row_number AND c->'resolution'->>'outcome'=b.outcome
            AND (c->'resolution'->>'clientId')::UUID IS NOT DISTINCT FROM b.matched_id)
      WHEN 'sample' THEN NOT EXISTS (SELECT 1 FROM public.accession_preview_bindings c
          WHERE c.batch_id=p_batch AND c.kind='client' AND c.row_number=b.parent_row)
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot->'sampleTypes') t
          WHERE t->>'id'=b.entity_id::TEXT AND t->>'importCode'=b.import_code AND (t->>'compatibilityGeneration')::BIGINT=b.generation)
      ELSE NOT EXISTS (SELECT 1 FROM public.accession_preview_bindings s
          JOIN jsonb_array_elements(v_snapshot->'pairs') p ON p->>'sampleTypeId'=s.entity_id::TEXT AND p->>'assayDefinitionId'=b.entity_id::TEXT
          WHERE s.batch_id=p_batch AND s.kind='sample' AND s.row_number=b.parent_row)
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot->'assays') a WHERE a->>'id'=b.entity_id::TEXT
          AND a->>'importCode'=b.import_code AND (a->>'compatibilityGeneration')::BIGINT=b.generation AND a->>'methodName' IS NOT DISTINCT FROM b.method_name) END) THEN
        RAISE EXCEPTION 'ACCESSION_PREVIEW_BINDINGS_INVALID';
    END IF;
    v_now := clock_timestamp();
    IF v_now >= v_batch.lease_expires_at THEN RAISE EXCEPTION 'ACCESSION_PREVIEW_LEASE_STALE'; END IF;
    UPDATE public.accession_preview_batches SET state='preview_ready',preview_created_at=v_now,expires_at=v_now + INTERVAL '30 minutes',
        source_sha256=p_metadata->>'source_sha256',source_size=(p_metadata->>'source_size')::BIGINT,
        normalized_payload_hash=p_metadata->>'normalized_payload_hash',canonicalization_version=p_metadata->>'canonicalization_version',
        template_version=p_metadata->>'template_version',template_digest=p_metadata->>'template_digest',template_claims_digest=p_metadata->>'template_claims_digest',
        catalog_digest=p_metadata->>'catalog_digest',revision=(p_metadata->>'revision')::BIGINT,
        validation_version=p_metadata->>'validation_version',resolver_version=p_metadata->>'resolver_version',binding_set_digest=p_metadata->>'binding_set_digest',
        client_count=(p_metadata->>'client_count')::BIGINT,sample_count=(p_metadata->>'sample_count')::BIGINT,
        assignment_count=(p_metadata->>'assignment_count')::BIGINT,create_count=(p_metadata->>'create_count')::BIGINT,reuse_count=(p_metadata->>'reuse_count')::BIGINT
    WHERE id=p_batch;
    RETURN jsonb_build_object('id',p_batch,'preview_created_at',v_now,'expires_at',v_now + INTERVAL '30 minutes');
END;
$$;

DO $privileges$
DECLARE v_function RECORD;
BEGIN
    FOR v_function IN SELECT oid::REGPROCEDURE AS signature, proname FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE
      AND proname IN ('authorize_accession_preview_actor','guard_accession_preview_mutation','start_accession_preview',
        'heartbeat_accession_preview','finish_accession_preview','seal_accession_preview') LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',v_function.signature);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',v_function.signature);
        IF v_function.proname NOT IN ('authorize_accession_preview_actor','guard_accession_preview_mutation') THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',v_function.signature);
        END IF;
    END LOOP;
END;
$privileges$;
CREATE FUNCTION public.test_accession_preview_commitment_security() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT (SELECT count(*)=2 AND bool_and(relrowsecurity) FROM pg_class WHERE oid IN
        ('public.accession_preview_batches'::REGCLASS,'public.accession_preview_bindings'::REGCLASS))
    AND NOT has_table_privilege('authenticated','public.accession_preview_batches','INSERT,UPDATE,DELETE')
    AND NOT has_table_privilege('service_role','public.accession_preview_batches','INSERT,UPDATE,DELETE')
    AND NOT has_table_privilege('authenticated','public.accession_preview_bindings','INSERT,UPDATE,DELETE')
    AND NOT has_column_privilege('authenticated','public.accession_preview_batches','lease_token','SELECT')
    AND (SELECT count(*)=4 AND bool_and(prosecdef AND proowner='postgres'::REGROLE
        AND proconfig @> ARRAY['search_path=public, pg_temp']
        AND has_function_privilege('service_role',oid,'EXECUTE')
        AND NOT has_function_privilege('authenticated',oid,'EXECUTE') AND NOT has_function_privilege('anon',oid,'EXECUTE'))
      FROM pg_proc WHERE oid IN
        ('public.start_accession_preview(uuid,uuid,integer,text)'::REGPROCEDURE,
         'public.heartbeat_accession_preview(uuid,uuid,uuid,bigint,text,bigint)'::REGPROCEDURE,
         'public.finish_accession_preview(uuid,uuid,uuid,bigint,text,text)'::REGPROCEDURE,
         'public.seal_accession_preview(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb,text,jsonb)'::REGPROCEDURE));
$$;
ALTER FUNCTION public.test_accession_preview_commitment_security() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.test_accession_preview_commitment_security() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_accession_preview_commitment_security() TO authenticated;
DO $register_and_verify$
DECLARE v_definition TEXT; v_passed BOOLEAN;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE) INTO v_definition;
    IF v_definition NOT LIKE '%test_accession_preview_client_resolution_security()%' THEN RAISE EXCEPTION 'Migration 234 security baseline missing'; END IF;
    EXECUTE replace(v_definition,'test_accession_preview_client_resolution_security()',
        'test_accession_preview_client_resolution_security() AND test_accession_preview_commitment_security()');
    IF NOT public.test_accession_preview_commitment_security() THEN RAISE EXCEPTION 'Migration 234 security verification failed'; END IF;
    SELECT bool_and(passed) INTO v_passed FROM public.run_security_tests();
    IF v_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Migration 234 existing security tests failed'; END IF;
END;
$register_and_verify$;
COMMIT;
