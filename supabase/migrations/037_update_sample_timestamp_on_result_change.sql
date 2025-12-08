-- Migration 037: Update Sample Timestamp on Result Change
-- Security Impact: None (automated timestamp update only)
-- Changes: Adds trigger to update samples.updated_at when results are modified
-- This ensures the "Ngày cập nhật" column reflects result entry activity

SET search_path TO public;

-- ============================================================================
-- TRIGGER FUNCTION: Update parent sample's updated_at when results change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_sample_updated_at_from_result()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the parent sample's updated_at timestamp
    UPDATE public.samples
    SET updated_at = NOW()
    WHERE id = NEW.sample_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Fire on result value or status changes
-- ============================================================================
DROP TRIGGER IF EXISTS update_sample_on_result_change ON public.results;

CREATE TRIGGER update_sample_on_result_change
    AFTER UPDATE ON public.results
    FOR EACH ROW
    WHEN (
        OLD.value IS DISTINCT FROM NEW.value 
        OR OLD.status IS DISTINCT FROM NEW.status
    )
    EXECUTE FUNCTION update_sample_updated_at_from_result();

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION update_sample_updated_at_from_result() 
IS 'Automatically updates parent sample updated_at timestamp when result value or status changes';

COMMENT ON TRIGGER update_sample_on_result_change ON public.results 
IS 'Ensures sample.updated_at reflects the latest result activity for proper sorting and tracking';
