-- Migration 181: Restore composed CoA security checker after migration 180
-- Security Impact: High
-- Changes:
--   - Updates the claim-source baseline for the historic regeneration guard.
--   - Restores the migration 179 approval-revalidation checker composition.
--   - Keeps exact foundational checker and queue source hashes pinned.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_regeneration_source TEXT;
    v_checker_source TEXT;
    v_approval_baseline_source TEXT;
BEGIN
    SELECT prosrc
    INTO v_regeneration_source
    FROM pg_proc
    WHERE oid =
        'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure;

    SELECT prosrc
    INTO v_checker_source
    FROM pg_proc
    WHERE oid = 'public.test_coa_report_provenance_guard()'::regprocedure;

    SELECT prosrc
    INTO v_approval_baseline_source
    FROM pg_proc
    WHERE oid =
        'public.test_coa_report_provenance_guard_approval_revalidation_baseline()'::regprocedure;

    IF encode(
        public.digest(v_regeneration_source, 'sha256'::TEXT),
        'hex'
    ) <> 'ff5932958e8ec3d9cbffb5be357e64ca3cd1e3bb86fa81f96acf779960d7ce77'
       OR encode(
           public.digest(v_checker_source, 'sha256'::TEXT),
           'hex'
       ) <> '666974046a7b9456b9159c415f2a3e30ef942858ba8806a4ef4bed4734501c86'
       OR encode(
           public.digest(v_approval_baseline_source, 'sha256'::TEXT),
           'hex'
       ) <> 'd3f3978ebb57ba9e658ff22af4a5a81ebee7c972c803f0b63cb8a74da842ca31'
    THEN
        RAISE EXCEPTION
            'Migration 181 found an unexpected migration 180 CoA checker baseline';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION
public.test_coa_report_provenance_guard_approval_revalidation_baseline()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_claim_baseline_source TEXT;
    v_queue_source TEXT;
    v_regeneration_definition TEXT;
BEGIN
    SELECT prosrc
    INTO v_claim_baseline_source
    FROM pg_proc
    WHERE oid =
        'public.test_coa_report_provenance_guard_claim_baseline()'::regprocedure;

    SELECT prosrc
    INTO v_queue_source
    FROM pg_proc
    WHERE oid =
        'public.queue_coa_report_for_generation(uuid,integer)'::regprocedure;

    SELECT pg_get_functiondef(
        'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure
    )
    INTO v_regeneration_definition;

    RETURN public.test_coa_report_provenance_guard_claim_baseline()
        AND COALESCE(
            encode(
                public.digest(v_claim_baseline_source, 'sha256'::TEXT),
                'hex'
            ) =
            'f50edd16252ca1b25ed1a3e1cb228138644c247dc09dc461633a87d4d4a752e4',
            FALSE
        )
        AND COALESCE(
            encode(
                public.digest(v_queue_source, 'sha256'::TEXT),
                'hex'
            ) =
            'c919145d29b73e3e37a8bb23f1e8ad03c7618251d83e94009f9a3bdb54a7c474',
            FALSE
        )
        AND v_regeneration_definition ILIKE
            '%public.user_can_access_confidential()%'
        AND v_regeneration_definition ILIKE
            '%generation_claimed_at >%15 minutes%'
        AND v_regeneration_definition ILIKE
            '%v_snapshot_count <> v_result_count%'
        AND v_regeneration_definition ILIKE
            '%IF v_report.source_submission_id IS NULL%'
        AND v_regeneration_definition ILIKE
            '%HISTORIC_REPORT_WITHOUT_SOURCE%'
        AND STRPOS(
            LOWER(v_regeneration_definition),
            'if v_report.source_submission_id is null'
        ) < STRPOS(
            LOWER(v_regeneration_definition),
            'v_claim_id := gen_random_uuid()'
        );
END;
$$;

CREATE OR REPLACE FUNCTION public.test_coa_report_provenance_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_baseline_source TEXT;
    v_complete_source TEXT;
BEGIN
    SELECT prosrc
    INTO v_baseline_source
    FROM pg_proc
    WHERE oid =
        'public.test_coa_report_provenance_guard_approval_revalidation_baseline()'::regprocedure;

    SELECT pg_get_functiondef(
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'::regprocedure
    )
    INTO v_complete_source;

    RETURN
        public.test_coa_report_provenance_guard_approval_revalidation_baseline()
        AND COALESCE(
            encode(
                public.digest(v_baseline_source, 'sha256'::TEXT),
                'hex'
            ) =
            'ea558faaf27a6b724e5da62fac5e2dc519b000d0876d6544cc631bc62d5c57cb',
            FALSE
        )
        AND v_complete_source ILIKE '%FROM public.samples%'
        AND v_complete_source ILIKE '%FOR UPDATE%'
        AND v_complete_source ILIKE
            '%v_sample_status IS DISTINCT FROM ''completed''%'
        AND v_complete_source ILIKE '%NOT EXISTS%FROM public.results%'
        AND v_complete_source ILIKE '%result.status <> ''approved''%'
        AND v_complete_source ILIKE
            '%v_report.generation_previous_status = ''ready''%'
        AND v_complete_source ILIKE
            '%Sample approval changed before CoA completion%'
        AND v_complete_source ILIKE '%generation_claim_id = NULL%'
        AND v_complete_source ILIKE '%generation_claimed_by = NULL%'
        AND v_complete_source ILIKE '%generation_claimed_at = NULL%'
        AND v_complete_source ILIKE '%generation_previous_status = NULL%'
        AND STRPOS(
            LOWER(v_complete_source),
            'from public.coa_reports'
        ) < STRPOS(
            LOWER(v_complete_source),
            'from public.samples'
        )
        AND STRPOS(
            LOWER(v_complete_source),
            'from public.samples'
        ) < STRPOS(
            LOWER(v_complete_source),
            'from public.results'
        );
END;
$$;

COMMENT ON FUNCTION
public.test_coa_report_provenance_guard_approval_revalidation_baseline()
IS 'Validates the pinned CoA foundation, confidential claims, and historic regeneration guard.';

COMMENT ON FUNCTION public.test_coa_report_provenance_guard()
IS 'Validates composed CoA provenance, claim, historic regeneration, and approval revalidation contracts.';

REVOKE ALL ON FUNCTION
public.test_coa_report_provenance_guard_approval_revalidation_baseline()
FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_coa_report_provenance_guard()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
public.test_coa_report_provenance_guard_approval_revalidation_baseline()
TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_coa_report_provenance_guard()
TO authenticated;

DO $$
BEGIN
    IF NOT public.test_coa_report_provenance_guard() THEN
        RAISE EXCEPTION
            'Migration 181 CoA checker composition verification failed';
    END IF;
END;
$$;

COMMIT;
