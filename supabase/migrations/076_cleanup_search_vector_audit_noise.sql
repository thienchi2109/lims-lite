-- Migration 076: Cleanup search_vector audit noise
-- Security Impact: Low - Removes noise audit entries that don't contain meaningful changes
-- Description: Deletes audit log entries from migrations 071-074 where only search_vector
--              was updated (backfill pollution). These entries have identical old_values
--              and new_values after excluding search_vector.

SET search_path TO public;

-- Delete audit entries where old_values and new_values are identical
-- These were created during the search_vector backfill migrations
-- We identify them by:
-- 1. Operation is UPDATE
-- 2. old_values (minus search_vector) equals new_values (minus search_vector)
-- 3. Both old_values and new_values exist (UPDATE operation)
DELETE FROM public.audit_logs
WHERE
    operation = 'UPDATE'
    AND old_values IS NOT NULL
    AND new_values IS NOT NULL
    -- Check if values are identical (meaning only search_vector changed)
    AND (old_values - 'search_vector') = (new_values - 'search_vector')
    -- Optional: Add time filter if you know when backfills happened
    -- AND created_at >= '2025-12-18 00:00:00'::timestamptz
    -- AND created_at < '2025-12-19 00:00:00'::timestamptz
;

-- Log the cleanup action
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % audit log entries with search_vector-only changes', deleted_count;
END $$;

COMMENT ON TABLE audit_logs IS 'Audit trail for 21 CFR Part 11 compliance - cleaned of search_vector backfill noise on 2025-12-18';
