-- Migration 235: immutable successful import receipt/global intent claim and typed provenance.
-- Security impact: active owner-analyst/manager history, current entity/confidentiality gates,
-- hidden intent hash and no direct browser/service writes or callable business entrypoint.
-- Phase 1 only: 234 success guard stays unchanged; positive committed confirmation is Phase 3.
-- Apply only in an authorized home-server session; SQL fixtures/security runtime are NOT RUN here.
BEGIN;
SET LOCAL search_path TO public, pg_temp;

DO $baseline$
BEGIN
    IF to_regclass('public.accession_preview_batches') IS NULL
       OR to_regclass('public.accession_preview_bindings') IS NULL
       OR to_regprocedure('public.test_accession_preview_commitment_security()') IS NULL
       OR public.test_accession_preview_commitment_security() IS DISTINCT FROM TRUE
       OR to_regprocedure('public.client_has_confidential_samples(uuid)') IS NULL
       OR to_regprocedure('public.user_can_access_confidential()') IS NULL
       OR to_regclass('public.accession_import_receipts') IS NOT NULL
       OR to_regclass('public.accession_import_mappings') IS NOT NULL
       OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE AND proname IN
           ('guard_accession_import_provenance','validate_accession_import_receipt',
            'check_accession_import_receipt','test_accession_import_provenance_security')) THEN
        RAISE EXCEPTION 'Migration 235 requires immutable preview baseline and unused provenance schema';
    END IF;
END;
$baseline$;

CREATE TABLE public.accession_import_receipts (
    batch_id UUID PRIMARY KEY REFERENCES public.accession_preview_batches(id),
    owner_id UUID NOT NULL REFERENCES public.users(id),
    normalized_payload_hash TEXT NOT NULL UNIQUE CHECK (normalized_payload_hash ~ '^[0-9a-f]{64}$'),
    confirmation_received_at TIMESTAMPTZ NOT NULL,
    client_count BIGINT NOT NULL CHECK (client_count > 0),
    sample_count BIGINT NOT NULL CHECK (sample_count > 0),
    assignment_count BIGINT NOT NULL CHECK (assignment_count > 0),
    create_count BIGINT NOT NULL CHECK (create_count >= 0),
    reuse_count BIGINT NOT NULL CHECK (reuse_count >= 0),
    CHECK (client_count = create_count + reuse_count)
);
CREATE TABLE public.accession_import_mappings (
    batch_id UUID NOT NULL REFERENCES public.accession_import_receipts(batch_id),
    kind TEXT NOT NULL CHECK (kind IN ('client','sample','assignment')),
    row_number BIGINT NOT NULL CHECK (row_number > 0),
    temporary_reference TEXT CHECK (temporary_reference ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$'),
    parent_kind TEXT, parent_row BIGINT CHECK (parent_row > 0),
    parent_temporary_reference TEXT CHECK (parent_temporary_reference ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$'),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    sample_id UUID REFERENCES public.samples(id),
    result_id UUID REFERENCES public.results(id),
    assay_id UUID REFERENCES public.assay_definitions(id), method_id UUID REFERENCES public.methods(id),
    official_sample_identifier TEXT, assay_import_code TEXT, outcome TEXT,
    creation_audit_id UUID REFERENCES public.audit_logs(id),
    PRIMARY KEY (batch_id, kind, row_number),
    FOREIGN KEY (batch_id, parent_kind, parent_row)
        REFERENCES public.accession_import_mappings(batch_id, kind, row_number),
    UNIQUE (batch_id, kind, temporary_reference),
    UNIQUE (batch_id, sample_id, assay_id),
    CHECK (CASE kind WHEN 'client' THEN
        temporary_reference IS NOT NULL AND parent_kind IS NULL AND parent_row IS NULL
        AND parent_temporary_reference IS NULL AND sample_id IS NULL AND result_id IS NULL
        AND assay_id IS NULL AND method_id IS NULL AND official_sample_identifier IS NULL AND assay_import_code IS NULL
        AND outcome IS NOT NULL AND outcome IN ('created','reused')
        AND ((outcome='created' AND creation_audit_id IS NOT NULL) OR (outcome='reused' AND creation_audit_id IS NULL))
      WHEN 'sample' THEN temporary_reference IS NOT NULL AND parent_kind IS NOT NULL AND parent_kind='client'
        AND parent_row IS NOT NULL AND parent_temporary_reference IS NOT NULL AND sample_id IS NOT NULL
        AND result_id IS NULL AND assay_id IS NULL AND method_id IS NULL AND outcome IS NULL
        AND official_sample_identifier IS NOT NULL AND length(official_sample_identifier)>0
        AND assay_import_code IS NULL AND creation_audit_id IS NOT NULL
      ELSE temporary_reference IS NULL AND parent_kind IS NOT NULL AND parent_kind='sample'
        AND parent_row IS NOT NULL AND parent_temporary_reference IS NOT NULL AND sample_id IS NOT NULL
        AND result_id IS NOT NULL AND assay_id IS NOT NULL AND outcome IS NULL AND official_sample_identifier IS NULL
        AND assay_import_code IS NOT NULL AND assay_import_code ~ '^CT-[0-9]{6}$' AND creation_audit_id IS NOT NULL END)
);
CREATE UNIQUE INDEX accession_import_client_once ON public.accession_import_mappings(batch_id,client_id) WHERE kind='client';
CREATE UNIQUE INDEX accession_import_sample_once ON public.accession_import_mappings(batch_id,sample_id) WHERE kind='sample';
CREATE UNIQUE INDEX accession_import_result_once ON public.accession_import_mappings(batch_id,result_id) WHERE kind='assignment';
CREATE INDEX accession_import_parent ON public.accession_import_mappings(batch_id,parent_kind,parent_row);

CREATE FUNCTION public.guard_accession_import_provenance() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF TG_OP <> 'INSERT' OR NOT EXISTS (SELECT 1 FROM public.accession_preview_batches
        WHERE id=NEW.batch_id AND state='preview_ready') THEN
        RAISE EXCEPTION 'ACCESSION_IMPORT_IMMUTABLE';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER accession_import_receipts_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.accession_import_receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_accession_import_provenance();
CREATE TRIGGER accession_import_mappings_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.accession_import_mappings
FOR EACH ROW EXECUTE FUNCTION public.guard_accession_import_provenance();

-- Call explicitly inside the Phase 3 business savepoint; deferred trigger is only a safety belt.
-- ponytail: one indexed full-graph pass per receipt, never per mapping; TASK-7 measures the ceiling.
CREATE FUNCTION public.validate_accession_import_receipt(p_batch UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_receipt public.accession_import_receipts; v_batch public.accession_preview_batches;
    v_clients BIGINT; v_samples BIGINT; v_assignments BIGINT; v_created BIGINT; v_reused BIGINT;
BEGIN
    SELECT * INTO v_receipt FROM public.accession_import_receipts WHERE batch_id=p_batch;
    IF NOT FOUND THEN RAISE EXCEPTION 'ACCESSION_IMPORT_INCOMPLETE'; END IF;
    SELECT * INTO v_batch FROM public.accession_preview_batches WHERE id=p_batch;
    IF NOT FOUND OR v_batch.state <> 'succeeded' OR v_receipt.owner_id IS DISTINCT FROM v_batch.owner_id
       OR v_receipt.normalized_payload_hash IS DISTINCT FROM v_batch.normalized_payload_hash
       OR v_receipt.confirmation_received_at < v_batch.preview_created_at
       OR v_receipt.confirmation_received_at >= v_batch.expires_at
       OR v_batch.finished_at < v_receipt.confirmation_received_at
       OR ROW(v_receipt.client_count,v_receipt.sample_count,v_receipt.assignment_count,v_receipt.create_count,v_receipt.reuse_count)
          IS DISTINCT FROM ROW(v_batch.client_count,v_batch.sample_count,v_batch.assignment_count,v_batch.create_count,v_batch.reuse_count) THEN
        RAISE EXCEPTION 'ACCESSION_IMPORT_INCOMPLETE';
    END IF;
    SELECT count(*) FILTER (WHERE kind='client'),count(*) FILTER (WHERE kind='sample'),count(*) FILTER (WHERE kind='assignment'),
        count(*) FILTER (WHERE outcome='created'),count(*) FILTER (WHERE outcome='reused')
    INTO v_clients,v_samples,v_assignments,v_created,v_reused FROM public.accession_import_mappings WHERE batch_id=p_batch;
    IF ROW(v_clients,v_samples,v_assignments,v_created,v_reused) IS DISTINCT FROM
       ROW(v_receipt.client_count,v_receipt.sample_count,v_receipt.assignment_count,v_receipt.create_count,v_receipt.reuse_count)
       OR (SELECT count(*) FROM public.accession_preview_bindings WHERE batch_id=p_batch) <> v_clients+v_samples+v_assignments THEN
        RAISE EXCEPTION 'ACCESSION_IMPORT_INCOMPLETE';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.accession_import_mappings m
        LEFT JOIN public.accession_preview_bindings b ON b.batch_id=m.batch_id AND b.kind=m.kind AND b.row_number=m.row_number
        LEFT JOIN public.accession_import_mappings parent ON parent.batch_id=m.batch_id AND parent.kind=m.parent_kind AND parent.row_number=m.parent_row
        LEFT JOIN public.clients c ON c.id=m.client_id
        LEFT JOIN public.samples s ON s.id=m.sample_id
        LEFT JOIN public.results r ON r.id=m.result_id
        LEFT JOIN public.assay_definitions assay ON assay.id=m.assay_id
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
              OR m.method_id IS DISTINCT FROM assay.method_id
              OR r.status IS DISTINCT FROM 'pending'))
          OR (m.creation_audit_id IS NOT NULL AND (a.id IS NULL OR a.operation IS DISTINCT FROM 'INSERT'
              OR a.changed_by IS DISTINCT FROM v_receipt.owner_id OR a.record_id IS DISTINCT FROM
                  CASE m.kind WHEN 'client' THEN m.client_id WHEN 'sample' THEN m.sample_id ELSE m.result_id END
              OR a.table_name IS DISTINCT FROM CASE m.kind WHEN 'client' THEN 'clients' WHEN 'sample' THEN 'samples' ELSE 'results' END)))
    ) OR EXISTS (SELECT 1 FROM public.accession_import_mappings m WHERE m.batch_id=p_batch AND m.kind IN ('client','sample')
        AND NOT EXISTS (SELECT 1 FROM public.accession_import_mappings child WHERE child.batch_id=p_batch AND child.parent_kind=m.kind AND child.parent_row=m.row_number))
      OR NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE table_name='accession_preview_batches' AND record_id=p_batch
        AND operation = 'INSERT' AND changed_by=v_receipt.owner_id)
      OR NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE table_name='accession_preview_batches' AND record_id=p_batch
        AND operation='UPDATE' AND changed_by=v_receipt.owner_id AND new_values->>'state'='succeeded') THEN
        RAISE EXCEPTION 'ACCESSION_IMPORT_INCOMPLETE';
    END IF;
END;
$$;
CREATE FUNCTION public.check_accession_import_receipt() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN PERFORM public.validate_accession_import_receipt(NEW.batch_id); RETURN NEW; END;
$$;
CREATE CONSTRAINT TRIGGER accession_import_receipt_complete AFTER INSERT ON public.accession_import_receipts
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_accession_import_receipt();

ALTER TABLE public.accession_import_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accession_import_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accession_import_receipts OWNER TO postgres;
ALTER TABLE public.accession_import_mappings OWNER TO postgres;
REVOKE ALL ON public.accession_import_receipts, public.accession_import_mappings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT (batch_id,owner_id,confirmation_received_at,client_count,sample_count,assignment_count,create_count,reuse_count) ON public.accession_import_receipts TO authenticated;
GRANT SELECT ON public.accession_import_mappings TO authenticated;
DROP POLICY IF EXISTS accession_import_receipt_read ON public.accession_import_receipts;
CREATE POLICY accession_import_receipt_read ON public.accession_import_receipts FOR SELECT TO authenticated
USING (((owner_id = auth.uid() AND public.get_user_role() = 'analyst') OR public.get_user_role() = 'manager')
    AND EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND deleted_at IS NULL));
DROP POLICY IF EXISTS accession_import_mapping_read ON public.accession_import_mappings;
CREATE POLICY accession_import_mapping_read ON public.accession_import_mappings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.accession_import_receipts receipt WHERE receipt.batch_id=accession_import_mappings.batch_id)
    AND EXISTS (SELECT 1 FROM public.clients client WHERE client.id=accession_import_mappings.client_id AND client.deleted_at IS NULL)
    AND (NOT public.client_has_confidential_samples(client_id) OR public.user_can_access_confidential())
    AND (kind='client' OR EXISTS (SELECT 1 FROM public.samples sample WHERE sample.id=accession_import_mappings.sample_id
        AND sample.client_id=accession_import_mappings.client_id AND sample.deleted_at IS NULL))
    AND (kind<>'assignment' OR EXISTS (SELECT 1 FROM public.results result WHERE result.id=accession_import_mappings.result_id
        AND result.sample_id=accession_import_mappings.sample_id)));

DO $privileges$
DECLARE v_function RECORD;
BEGIN
    FOR v_function IN SELECT oid::REGPROCEDURE AS signature FROM pg_proc WHERE pronamespace='public'::REGNAMESPACE
        AND proname IN ('guard_accession_import_provenance','validate_accession_import_receipt','check_accession_import_receipt') LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',v_function.signature);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',v_function.signature);
    END LOOP;
END;
$privileges$;
CREATE FUNCTION public.test_accession_import_provenance_security() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT (SELECT count(*)=2 AND bool_and(relrowsecurity AND relowner='postgres'::REGROLE) FROM pg_class WHERE oid IN
        ('public.accession_import_receipts'::REGCLASS,'public.accession_import_mappings'::REGCLASS))
    AND (SELECT count(*)=2 AND bool_and(polcmd='r' AND polpermissive
        AND polroles=ARRAY['authenticated'::REGROLE]::OID[]
        AND ((polrelid='public.accession_import_receipts'::REGCLASS AND polname='accession_import_receipt_read'
            AND pg_get_expr(polqual,polrelid) = '__ACCESSION_IMPORT_RECEIPT_POLICY__')
          OR (polrelid='public.accession_import_mappings'::REGCLASS AND polname='accession_import_mapping_read'
            AND pg_get_expr(polqual,polrelid) = '__ACCESSION_IMPORT_MAPPING_POLICY__')))
        FROM pg_policy WHERE polrelid IN ('public.accession_import_receipts'::REGCLASS,'public.accession_import_mappings'::REGCLASS))
    AND NOT has_any_column_privilege('anon','public.accession_import_receipts','SELECT')
    AND NOT has_table_privilege('anon','public.accession_import_receipts','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_table_privilege('anon','public.accession_import_mappings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_table_privilege('authenticated','public.accession_import_receipts','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_any_column_privilege('service_role','public.accession_import_receipts','SELECT')
    AND NOT has_table_privilege('service_role','public.accession_import_receipts','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_table_privilege('authenticated','public.accession_import_mappings','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_table_privilege('service_role','public.accession_import_mappings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND has_table_privilege('authenticated','public.accession_import_mappings','SELECT')
    AND (SELECT bool_and(has_column_privilege('authenticated','public.accession_import_receipts',field,'SELECT'))
        FROM unnest(ARRAY['batch_id','owner_id','confirmation_received_at','client_count','sample_count',
            'assignment_count','create_count','reuse_count']) field)
    AND NOT has_column_privilege('authenticated','public.accession_import_receipts','normalized_payload_hash','SELECT')
    AND (SELECT count(*)=3 AND bool_and(prosecdef AND proowner='postgres'::REGROLE
        AND COALESCE(proconfig @> ARRAY['search_path=public, pg_temp'],FALSE)
        AND NOT has_function_privilege('authenticated',oid,'EXECUTE') AND NOT has_function_privilege('anon',oid,'EXECUTE')
        AND NOT has_function_privilege('service_role',oid,'EXECUTE')) FROM pg_proc WHERE oid IN
        ('public.guard_accession_import_provenance()'::REGPROCEDURE,'public.validate_accession_import_receipt(uuid)'::REGPROCEDURE,
         'public.check_accession_import_receipt()'::REGPROCEDURE))
    AND (SELECT count(*)=1 FROM pg_trigger WHERE tgrelid='public.accession_import_receipts'::REGCLASS
        AND tgname='accession_import_receipt_complete' AND tgdeferrable AND tginitdeferred)
    AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.accession_import_mappings'::REGCLASS AND tgdeferrable);
$$;
-- Anchor reviewed DDL once while this transaction owns its table locks. At checker-call time,
-- expected expressions are frozen literals, not another read of the mutable policy catalog.
DO $freeze_policies$
DECLARE v_definition TEXT; v_receipt_policy TEXT; v_mapping_policy TEXT;
BEGIN
    SELECT pg_get_expr(polqual,polrelid) INTO STRICT v_receipt_policy FROM pg_policy
        WHERE polrelid='public.accession_import_receipts'::REGCLASS AND polname='accession_import_receipt_read';
    SELECT pg_get_expr(polqual,polrelid) INTO STRICT v_mapping_policy FROM pg_policy
        WHERE polrelid='public.accession_import_mappings'::REGCLASS AND polname='accession_import_mapping_read';
    SELECT pg_get_functiondef('public.test_accession_import_provenance_security()'::REGPROCEDURE) INTO v_definition;
    IF v_receipt_policy IS NULL OR v_mapping_policy IS NULL
       OR position(quote_literal('__ACCESSION_IMPORT_RECEIPT_POLICY__') IN v_definition)=0
       OR position(quote_literal('__ACCESSION_IMPORT_MAPPING_POLICY__') IN v_definition)=0 THEN
        RAISE EXCEPTION 'Migration 235 policy anchor missing';
    END IF;
    EXECUTE replace(replace(v_definition,quote_literal('__ACCESSION_IMPORT_RECEIPT_POLICY__'),quote_literal(v_receipt_policy)),
        quote_literal('__ACCESSION_IMPORT_MAPPING_POLICY__'),quote_literal(v_mapping_policy));
END;
$freeze_policies$;
ALTER FUNCTION public.test_accession_import_provenance_security() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.test_accession_import_provenance_security() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_accession_import_provenance_security() TO authenticated;
DO $register_and_verify$
DECLARE v_definition TEXT; v_passed BOOLEAN;
BEGIN
    SELECT pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE) INTO v_definition;
    IF v_definition NOT LIKE '%test_accession_preview_commitment_security()%' THEN RAISE EXCEPTION 'Migration 235 security baseline missing'; END IF;
    EXECUTE replace(v_definition,'test_accession_preview_commitment_security()',
        'test_accession_preview_commitment_security() AND test_accession_import_provenance_security()');
    IF public.test_accession_import_provenance_security() IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Migration 235 security verification failed'; END IF;
    SELECT bool_and(passed) INTO v_passed FROM public.run_security_tests();
    IF v_passed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Migration 235 existing security tests failed'; END IF;
END;
$register_and_verify$;
COMMIT;
