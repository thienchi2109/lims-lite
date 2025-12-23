-- Migration 093: Allow analysts to view CoA audit logs
-- Security Impact: LOW - Extends existing scoped audit log access to include CoA reports
-- Description: Updates the analyst RLS policy on audit_logs to include coa_reports table.
--              Analysts can see CoA audit logs only for samples they have access to.
--              This allows the activity feed to show CoA generation events.

SET search_path TO public;

-- Drop the existing analyst policy
DROP POLICY IF EXISTS "Analysts can read scoped audit logs" ON public.audit_logs;

-- Recreate with coa_reports included
CREATE POLICY "Analysts can read scoped audit logs"
ON public.audit_logs FOR SELECT
USING (
    get_user_role() = 'analyst'
    AND (
        -- Audit logs for samples (analysts can read non-deleted samples)
        (table_name = 'samples' AND EXISTS (
            SELECT 1 FROM samples
            WHERE samples.id = audit_logs.record_id
            AND samples.deleted_at IS NULL
        ))
        OR
        -- Audit logs for results (analysts can read all results)
        (table_name = 'results' AND EXISTS (
            SELECT 1 FROM results
            WHERE results.id = audit_logs.record_id
        ))
        OR
        -- Audit logs for coa_reports (analysts can see CoA logs for samples they can access)
        (table_name = 'coa_reports' AND EXISTS (
            SELECT 1 FROM coa_reports cr
            JOIN samples s ON cr.sample_id = s.id
            WHERE cr.id = audit_logs.record_id
            AND s.deleted_at IS NULL
        ))
    )
);

-- Update comment
COMMENT ON POLICY "Analysts can read scoped audit logs" ON public.audit_logs
IS 'Analysts can view audit logs for samples, results, and CoA reports they have legitimate access to.';
