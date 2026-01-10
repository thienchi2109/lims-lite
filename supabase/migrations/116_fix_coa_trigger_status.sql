-- Migration 116: Fix CoA trigger to fire on 'completed' status
-- Description: The original trigger checked for status='approved' but sample_status enum uses 'completed'
-- Related: UX fix for CoA generation after sample approval
--
-- Background:
-- - samples.status uses sample_status enum: {received,assigned,in_progress,review,completed,discarded}
-- - results.status uses result_status enum: {pending,entered,approved}
-- - Original trigger incorrectly checked samples.status = 'approved' (which doesn't exist)
-- - Should check samples.status = 'completed' (when all results are approved)

SET search_path TO public;

-- ============================================================================
-- 1. Drop and recreate the trigger function with correct status check
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_generate_coa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only generate CoA when sample status changes to 'completed'
    -- (all results approved) and no existing CoA record exists for this sample
    IF NEW.status = 'completed'
       AND (OLD.status IS NULL OR OLD.status != 'completed')
       AND NOT EXISTS (
           SELECT 1 FROM coa_reports
           WHERE sample_id = NEW.id
           AND deleted_at IS NULL
       )
    THEN
        -- Insert pending CoA record
        -- Server action will pick this up and generate HTML
        INSERT INTO coa_reports (
            sample_id,
            file_path,
            file_hash,
            version,
            status
        ) VALUES (
            NEW.id,
            '', -- Will be populated by server action
            '', -- Will be populated by server action
            1,
            'pending'
        );

        RAISE NOTICE 'CoA generation queued for sample %', NEW.sample_id;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_generate_coa()
IS 'Queues CoA generation when sample status changes to completed (all results approved)';

-- ============================================================================
-- 2. Recreate trigger (ensure it uses updated function)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_generate_coa_on_approval ON samples;
CREATE TRIGGER trigger_generate_coa_on_approval
    AFTER INSERT OR UPDATE OF status ON samples
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_coa();

COMMENT ON TRIGGER trigger_generate_coa_on_approval ON samples
IS 'Automatically queues CoA generation when sample status changes to completed';

-- ============================================================================
-- End of Migration 116
-- ============================================================================
