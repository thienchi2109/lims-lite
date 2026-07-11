-- Migration 187: Activate wall-clock CoA generation leases
-- Security Impact: High
-- Changes:
--   - Atomically replaces all four public claim-transition RPCs.
--   - Registers the pinned wall-clock checker used by run_security_tests().
--   - Removes the superseded transaction-time implementations.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_old_hashes TEXT[];
    v_staged_hashes TEXT[];
    v_contract_hash TEXT;
    v_checker_hash TEXT;
BEGIN
    SELECT ARRAY_AGG(
        encode(public.digest(p.prosrc, 'sha256'::TEXT), 'hex')
        ORDER BY p.proname
    )
    INTO v_old_hashes
    FROM pg_proc AS p
    JOIN pg_namespace AS n
      ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
          'claim_coa_report_regeneration',
          'complete_coa_report_generation',
          'fail_coa_report_generation',
          'queue_coa_report_for_generation'
      );

    SELECT ARRAY_AGG(
        encode(public.digest(p.prosrc, 'sha256'::TEXT), 'hex')
        ORDER BY p.proname
    )
    INTO v_staged_hashes
    FROM pg_proc AS p
    JOIN pg_namespace AS n
      ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
          'claim_coa_report_regeneration_wall_clock',
          'complete_coa_report_generation_wall_clock',
          'fail_coa_report_generation_wall_clock',
          'queue_coa_report_for_generation_wall_clock'
      );

    SELECT encode(public.digest(prosrc, 'sha256'::TEXT), 'hex')
    INTO v_contract_hash
    FROM pg_proc
    WHERE oid =
        'public.test_coa_generation_wall_clock_contract()'::regprocedure;

    SELECT encode(public.digest(prosrc, 'sha256'::TEXT), 'hex')
    INTO v_checker_hash
    FROM pg_proc
    WHERE oid = 'public.test_coa_report_provenance_guard()'::regprocedure;

    IF v_old_hashes IS DISTINCT FROM ARRAY[
        'ff5932958e8ec3d9cbffb5be357e64ca3cd1e3bb86fa81f96acf779960d7ce77',
        '6af22a1eb181b25ca3ee2b687fca1989a5944c994b41d84800d8c9c8fbfd76db',
        'e1e0b00c0883dbf4e43afa565634c8001ded7ddc260c81efb818b9ad959e03a4',
        'c919145d29b73e3e37a8bb23f1e8ad03c7618251d83e94009f9a3bdb54a7c474'
    ]::TEXT[]
       OR v_staged_hashes IS DISTINCT FROM ARRAY[
           'a0fc81ad239beffe048a8346a6f5d60cdab1b7fb827bbcbc0d219f8211fe5cbd',
           'abb0dac591c89401f973a3ae95ed22618701f797ea678eba4b3223bb192cc43c',
           'aeaee2c2666bf1fdd7d3ef841d7ae44c7f8e59a87a033915add1019dfade6643',
           'cc40f67ccda1d1f334808c6055f5bb334e3d0d122f67c686ecf423b7cf8ade8f'
       ]::TEXT[]
       OR v_contract_hash <>
          'dfe627c5b34fd25a09ad0b75e07ad9994b2b03b0008232e2c79a2faf1942de43'
       OR v_checker_hash <>
          '3c27660d5eb4d67eef1476924462b2ab3e93c23f54ac6f8ae6af09ec7691981c'
    THEN
        RAISE EXCEPTION
            'Migration 187 found an unexpected CoA activation baseline';
    END IF;
END;
$$;

ALTER FUNCTION public.queue_coa_report_for_generation(UUID, INTEGER)
RENAME TO queue_coa_report_for_generation_transaction_time;
ALTER FUNCTION
public.queue_coa_report_for_generation_wall_clock(UUID, INTEGER)
RENAME TO queue_coa_report_for_generation;

ALTER FUNCTION public.claim_coa_report_regeneration(UUID, INTEGER)
RENAME TO claim_coa_report_regeneration_transaction_time;
ALTER FUNCTION
public.claim_coa_report_regeneration_wall_clock(UUID, INTEGER)
RENAME TO claim_coa_report_regeneration;

ALTER FUNCTION
public.complete_coa_report_generation(UUID, UUID, TEXT, TEXT, UUID)
RENAME TO complete_coa_report_generation_transaction_time;
ALTER FUNCTION
public.complete_coa_report_generation_wall_clock(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID
)
RENAME TO complete_coa_report_generation;

ALTER FUNCTION
public.fail_coa_report_generation(UUID, UUID, TEXT, BOOLEAN)
RENAME TO fail_coa_report_generation_transaction_time;
ALTER FUNCTION
public.fail_coa_report_generation_wall_clock(UUID, UUID, TEXT, BOOLEAN)
RENAME TO fail_coa_report_generation;

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
            'dfe627c5b34fd25a09ad0b75e07ad9994b2b03b0008232e2c79a2faf1942de43',
            FALSE
        );
END;
$$;

COMMENT ON FUNCTION public.queue_coa_report_for_generation(UUID, INTEGER)
IS 'Claims a canonical wall-clock CoA generation lease after locked validation.';

COMMENT ON FUNCTION public.claim_coa_report_regeneration(UUID, INTEGER)
IS 'Claims a canonical wall-clock regeneration lease for reviewed CoA reports.';

COMMENT ON FUNCTION
public.complete_coa_report_generation(UUID, UUID, TEXT, TEXT, UUID)
IS 'Completes a claimed CoA only while its wall-clock lease remains fresh.';

COMMENT ON FUNCTION
public.fail_coa_report_generation(UUID, UUID, TEXT, BOOLEAN)
IS 'Fails or restores a claimed CoA only while its wall-clock lease remains fresh.';

COMMENT ON FUNCTION public.test_coa_report_provenance_guard()
IS 'Validates canonical wall-clock CoA leases and lock-safe claim transitions.';

REVOKE ALL ON FUNCTION public.queue_coa_report_for_generation(UUID, INTEGER)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.claim_coa_report_regeneration(UUID, INTEGER)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION
public.complete_coa_report_generation(UUID, UUID, TEXT, TEXT, UUID)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION
public.fail_coa_report_generation(UUID, UUID, TEXT, BOOLEAN)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.test_coa_generation_wall_clock_contract()
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.test_coa_report_provenance_guard()
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION
public.queue_coa_report_for_generation(UUID, INTEGER)
TO authenticated;
GRANT EXECUTE ON FUNCTION
public.claim_coa_report_regeneration(UUID, INTEGER)
TO authenticated;
GRANT EXECUTE ON FUNCTION
public.complete_coa_report_generation(UUID, UUID, TEXT, TEXT, UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION
public.fail_coa_report_generation(UUID, UUID, TEXT, BOOLEAN)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_coa_generation_wall_clock_contract()
TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_coa_report_provenance_guard()
TO authenticated;

DROP FUNCTION
public.queue_coa_report_for_generation_transaction_time(UUID, INTEGER);
DROP FUNCTION
public.claim_coa_report_regeneration_transaction_time(UUID, INTEGER);
DROP FUNCTION
public.complete_coa_report_generation_transaction_time(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID
);
DROP FUNCTION
public.fail_coa_report_generation_transaction_time(
    UUID,
    UUID,
    TEXT,
    BOOLEAN
);

DO $$
BEGIN
    IF NOT public.test_coa_report_provenance_guard() THEN
        RAISE EXCEPTION
            'Migration 187 CoA wall-clock contract verification failed';
    END IF;

    IF to_regprocedure(
        'public.queue_coa_report_for_generation_wall_clock(uuid,integer)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.claim_coa_report_regeneration_wall_clock(uuid,integer)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.complete_coa_report_generation_wall_clock(uuid,uuid,text,text,uuid)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.fail_coa_report_generation_wall_clock(uuid,uuid,text,boolean)'
       ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 187 left staged CoA RPC names behind';
    END IF;
END;
$$;

COMMIT;
