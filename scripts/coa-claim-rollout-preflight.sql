\set ON_ERROR_STOP on

-- Read-only gate for databases that may still be on schema 170.
DO $preflight$
DECLARE
    claim_column_count INTEGER;
    pending_report_count BIGINT;
BEGIN
    IF to_regclass('public.coa_reports') IS NULL THEN
        RAISE EXCEPTION
            'CoA claim rollout preflight requires public.coa_reports';
    END IF;

    SELECT COUNT(*)
    INTO claim_column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'coa_reports'
      AND column_name IN (
          'generation_claim_id',
          'generation_claimed_by',
          'generation_claimed_at',
          'generation_previous_status'
      );

    IF claim_column_count BETWEEN 1 AND 3 THEN
        RAISE EXCEPTION
            'Partial CoA generation claim columns detected (% of 4). '
            'Stop rollout and investigate before continuing.',
            claim_column_count;
    END IF;

    IF claim_column_count = 0 THEN
        SELECT COUNT(*)
        INTO pending_report_count
        FROM public.coa_reports
        WHERE status = 'pending';

        IF pending_report_count > 0 THEN
            RAISE EXCEPTION
                'CoA claim rollout blocked by % legacy pending report(s). '
                'Follow docs/coa-claim-rollout-remediation.md before migration 171.',
                pending_report_count;
        END IF;
    END IF;
END;
$preflight$;

SELECT CASE
    WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name = 'generation_claim_id'
    )
        THEN 'COA_CLAIM_PREFLIGHT_OK_CLAIM_COLUMNS_PRESENT'
    ELSE 'COA_CLAIM_PREFLIGHT_OK_SCHEMA_170'
END;
