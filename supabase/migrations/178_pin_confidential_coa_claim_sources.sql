-- Migration 178: Pin confidential CoA claim RPC sources
-- Security Impact: Low
-- Changes:
--   - Preserves the migration 176 checker as an exact baseline.
--   - Wraps it with SHA-256 checks for both confidential claim RPC bodies.
--   - Makes dead or relocated authorization text fail run_security_tests().

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_checker_source TEXT;
    v_queue_source TEXT;
    v_regeneration_source TEXT;
BEGIN
    IF to_regprocedure(
        'public.test_coa_report_provenance_guard_claim_baseline()'
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 178 expected the pinned checker baseline to be absent';
    END IF;

    SELECT prosrc
    INTO v_checker_source
    FROM pg_proc
    WHERE oid = 'public.test_coa_report_provenance_guard()'::regprocedure;

    SELECT prosrc
    INTO v_queue_source
    FROM pg_proc
    WHERE oid =
        'public.queue_coa_report_for_generation(uuid,integer)'::regprocedure;

    SELECT prosrc
    INTO v_regeneration_source
    FROM pg_proc
    WHERE oid =
        'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure;

    IF encode(public.digest(v_checker_source, 'sha256'::TEXT), 'hex') <>
       'f50edd16252ca1b25ed1a3e1cb228138644c247dc09dc461633a87d4d4a752e4'
       OR encode(public.digest(v_queue_source, 'sha256'::TEXT), 'hex') <>
       'c919145d29b73e3e37a8bb23f1e8ad03c7618251d83e94009f9a3bdb54a7c474'
       OR encode(
           public.digest(v_regeneration_source, 'sha256'::TEXT),
           'hex'
       ) <>
       'da5c0d963242924c87b9788d6dd28f6db0528eb4f73ca2ca052508c07f91fc92'
    THEN
        RAISE EXCEPTION
            'Migration 178 found an unexpected CoA security baseline';
    END IF;
END;
$$;

ALTER FUNCTION public.test_coa_report_provenance_guard()
RENAME TO test_coa_report_provenance_guard_claim_baseline;

CREATE FUNCTION public.test_coa_report_provenance_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_baseline_source TEXT;
    v_queue_source TEXT;
    v_regeneration_source TEXT;
BEGIN
    SELECT prosrc
    INTO v_baseline_source
    FROM pg_proc
    WHERE oid =
        'public.test_coa_report_provenance_guard_claim_baseline()'::regprocedure;

    SELECT prosrc
    INTO v_queue_source
    FROM pg_proc
    WHERE oid =
        'public.queue_coa_report_for_generation(uuid,integer)'::regprocedure;

    SELECT prosrc
    INTO v_regeneration_source
    FROM pg_proc
    WHERE oid =
        'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure;

    RETURN public.test_coa_report_provenance_guard_claim_baseline()
        AND COALESCE(
            encode(
                public.digest(v_baseline_source, 'sha256'::TEXT),
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
        AND COALESCE(
            encode(
                public.digest(v_regeneration_source, 'sha256'::TEXT),
                'hex'
            ) =
            'da5c0d963242924c87b9788d6dd28f6db0528eb4f73ca2ca052508c07f91fc92',
            FALSE
        );
END;
$$;

COMMENT ON FUNCTION public.test_coa_report_provenance_guard_claim_baseline()
IS 'Migration 176 CoA provenance and confidential authorization checker baseline.';

COMMENT ON FUNCTION public.test_coa_report_provenance_guard()
IS 'Validates the pinned CoA checker and exact confidential claim RPC sources.';

COMMIT;
