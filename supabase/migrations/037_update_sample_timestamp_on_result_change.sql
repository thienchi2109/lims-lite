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
    -- For DELETE operations, use OLD.sample_id, otherwise use NEW.sample_id
    IF TG_OP = 'DELETE' THEN
        UPDATE public.samples
        SET updated_at = NOW()
        WHERE id = OLD.sample_id;
        RETURN OLD;
    ELSE
        UPDATE public.samples
        SET updated_at = NOW()
        WHERE id = NEW.sample_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Fire on result INSERT, UPDATE, or DELETE
-- ============================================================================
DROP TRIGGER IF EXISTS update_sample_on_result_change ON public.results;

CREATE TRIGGER update_sample_on_result_change
    AFTER INSERT OR UPDATE OR DELETE ON public.results
    FOR EACH ROW
    EXECUTE FUNCTION update_sample_updated_at_from_result();

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION update_sample_updated_at_from_result() 
IS 'Automatically updates parent sample updated_at timestamp when results are inserted, updated, or deleted';

COMMENT ON TRIGGER update_sample_on_result_change ON public.results 
IS 'Ensures sample.updated_at reflects the latest result activity (insert/update/delete) for proper sorting and tracking';
