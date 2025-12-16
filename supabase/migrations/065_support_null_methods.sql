-- Migration 065: Support NULL method_id for method-less test assignments
-- Description: Allow assigning tests without methods (method_id = NULL) with proper audit logging
-- Security Impact: Low - Maintains existing RLS, adds audit trail for method-less assignments

SET search_path TO public;

-- The assign_tests_to_sample RPC already handles NULL method_id via COALESCE
-- This migration adds explicit documentation and audit logging for method-less assignments

-- Add audit log function for method-less assignments
CREATE OR REPLACE FUNCTION log_methodless_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Log when a result is created without a method
    IF NEW.method_id IS NULL AND NEW.status = 'pending' THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            operation,
            old_values,
            new_values,
            changed_by
        ) VALUES (
            'results',
            NEW.id,
            'INSERT',
            NULL,
            jsonb_build_object(
                'sample_id', NEW.sample_id,
                'assay_id', NEW.assay_id,
                'method_id', NULL,
                'status', NEW.status,
                'note', 'Xét nghiệm được chỉ định không có phương pháp. Quản lý cần bổ sung sau.'
            ),
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trigger_log_methodless_assignment ON public.results;

-- Create trigger to log method-less assignments
CREATE TRIGGER trigger_log_methodless_assignment
    AFTER INSERT ON public.results
    FOR EACH ROW
    WHEN (NEW.method_id IS NULL)
    EXECUTE FUNCTION log_methodless_assignment();

-- Add comment explaining NULL method support
COMMENT ON COLUMN results.method_id IS
'Method used for this test. Can be NULL for method-less tests (e.g., visual inspections).
When NULL, system logs audit trail and managers should backfill methods.';

-- Update RPC comment to document NULL method support
COMMENT ON FUNCTION public.assign_tests_to_sample(UUID, JSONB)
IS 'Assigns tests to a sample, updating status/updated_at atomically with RLS-safe permissions.
Supports NULL method_id for method-less tests. NULL methods are logged to audit trail.';
