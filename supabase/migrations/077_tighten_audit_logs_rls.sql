-- Migration 077: Tighten audit_logs RLS with scoped access
-- Security Impact: HIGH - Restricts audit log access with role-based scoping
-- Description: Changes audit_logs RLS policy from "any authenticated user can see everything"
--              to a scoped model:
--              - Managers: Can read ALL audit logs (unrestricted)
--              - Analysts: Can read audit logs ONLY for samples/results they can access
--              This prevents analysts from searching/viewing audit logs for records they
--              don't have access to, while still allowing them to see activity history
--              for their own work.
--              Aligns with 21 CFR Part 11 compliance and principle of least privilege.

SET search_path TO public;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON public.audit_logs;

-- Create manager policy: unrestricted access to all audit logs
CREATE POLICY "Managers can read all audit logs"
ON public.audit_logs FOR SELECT
USING (
    get_user_role() = 'manager'
);

-- Create analyst policy: scoped access to audit logs for samples/results they can access
-- Analysts can only see audit logs for:
-- 1. Samples table records (they have read access to all non-deleted samples)
-- 2. Results table records (they have read access to all results)
CREATE POLICY "Analysts can read scoped audit logs"
ON public.audit_logs FOR SELECT
USING (
    get_user_role() = 'analyst'
    AND (
        -- Audit logs for samples (analysts can read non-deleted samples)
        (table_name = 'samples' AND EXISTS (
            SELECT 1 FROM samples
            WHERE samples.id = audit_logs.record_id::uuid
            AND samples.deleted_at IS NULL
        ))
        OR
        -- Audit logs for results (analysts can read all results)
        (table_name = 'results' AND EXISTS (
            SELECT 1 FROM results
            WHERE results.id = audit_logs.record_id::uuid
        ))
    )
);

-- Add comments explaining the policies
COMMENT ON POLICY "Managers can read all audit logs" ON public.audit_logs
IS 'Managers have unrestricted access to all audit logs for compliance oversight and investigation.';

COMMENT ON POLICY "Analysts can read scoped audit logs" ON public.audit_logs
IS 'Analysts can only view audit logs for samples and results they have legitimate access to, preventing unauthorized access to sensitive audit data from other records.';

-- Grant explicit permissions to authenticated role (policies will enforce scoping)
GRANT SELECT ON public.audit_logs TO authenticated;
