-- Migration 188: Restore explicit CoA wall-clock checker composition
-- Security Impact: High
-- Changes:
--   - Preserves the pinned wall-clock contract as an exact baseline.
--   - Adds explicit completion approval-revalidation source assertions.
--   - Updates the registered checker to pin the composed contract.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_contract_hash TEXT;
    v_checker_hash TEXT;
BEGIN
    IF to_regprocedure(
        'public.test_coa_generation_wall_clock_contract_v1()'
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 188 expected the wall-clock v1 baseline to be absent';
    END IF;

    SELECT encode(public.digest(prosrc, 'sha256'::TEXT), 'hex')
    INTO v_contract_hash
    FROM pg_proc
    WHERE oid =
        'public.test_coa_generation_wall_clock_contract()'::regprocedure;

    SELECT encode(public.digest(prosrc, 'sha256'::TEXT), 'hex')
    INTO v_checker_hash
    FROM pg_proc
    WHERE oid = 'public.test_coa_report_provenance_guard()'::regprocedure;

    IF v_contract_hash <>
       'dfe627c5b34fd25a09ad0b75e07ad9994b2b03b0008232e2c79a2faf1942de43'
       OR v_checker_hash <>
          '90d494a5cc812379464f791cd198c437d233b52bbcb06390196e23035cbd7942'
    THEN
        RAISE EXCEPTION
            'Migration 188 found an unexpected wall-clock checker baseline';
    END IF;
END;
$$;

ALTER FUNCTION public.test_coa_generation_wall_clock_contract()
RENAME TO test_coa_generation_wall_clock_contract_v1;

CREATE FUNCTION public.test_coa_generation_wall_clock_contract()
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
        'public.test_coa_generation_wall_clock_contract_v1()'::regprocedure;

    SELECT prosrc
    INTO v_complete_source
    FROM pg_proc
    WHERE oid =
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'::regprocedure;

    RETURN public.test_coa_generation_wall_clock_contract_v1()
        AND COALESCE(
            encode(
                public.digest(v_baseline_source, 'sha256'::TEXT),
                'hex'
            ) =
            'dfe627c5b34fd25a09ad0b75e07ad9994b2b03b0008232e2c79a2faf1942de43',
            FALSE
        )
        AND v_complete_source ILIKE '%FROM public.samples%'
        AND v_complete_source ILIKE '%FOR UPDATE%'
        AND v_complete_source ILIKE
            '%v_sample_status IS DISTINCT FROM ''completed''%'
        AND v_complete_source ILIKE '%NOT EXISTS%FROM public.results%'
        AND v_complete_source ILIKE '%result.status <> ''approved''%'
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

CREATE OR REPLACE FUNCTION public.test_coa_report_provenance_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_contract_source TEXT;
BEGIN
    SELECT prosrc
    INTO v_contract_source
    FROM pg_proc
    WHERE oid =
        'public.test_coa_generation_wall_clock_contract()'::regprocedure;

    RETURN public.test_coa_generation_wall_clock_contract()
        AND COALESCE(
            encode(
                public.digest(v_contract_source, 'sha256'::TEXT),
                'hex'
            ) =
            'bf544b51c379c6f256e1b21564aa5f2285fc5288e7812fbd5e5156e7d47e8506',
            FALSE
        );
END;
$$;

COMMENT ON FUNCTION public.test_coa_generation_wall_clock_contract_v1()
IS 'Migration 186 canonical wall-clock CoA lease security baseline.';

COMMENT ON FUNCTION public.test_coa_generation_wall_clock_contract()
IS 'Validates wall-clock CoA leases and explicit completion approval revalidation.';

COMMENT ON FUNCTION public.test_coa_report_provenance_guard()
IS 'Validates the pinned composed wall-clock CoA security contract.';

REVOKE ALL ON FUNCTION public.test_coa_generation_wall_clock_contract_v1()
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.test_coa_generation_wall_clock_contract()
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.test_coa_report_provenance_guard()
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION
public.test_coa_generation_wall_clock_contract_v1()
TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_coa_generation_wall_clock_contract()
TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_coa_report_provenance_guard()
TO authenticated;

DO $$
BEGIN
    IF NOT public.test_coa_report_provenance_guard() THEN
        RAISE EXCEPTION
            'Migration 188 composed CoA wall-clock checker verification failed';
    END IF;
END;
$$;

COMMIT;
