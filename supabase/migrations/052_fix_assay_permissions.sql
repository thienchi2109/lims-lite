-- Migration 052: Fix assay permissions and add audit trigger
-- Description: Reset RLS policies for assay_definitions to allow soft deletes and ensure audit logging.

SET search_path TO public;

-- 1. Add Audit Trigger (Missing in 002)
DROP TRIGGER IF EXISTS audit_log_trigger ON assay_definitions;
CREATE TRIGGER audit_log_trigger
    AFTER INSERT OR UPDATE OR DELETE ON assay_definitions
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- 2. Reset RLS Policies
ALTER TABLE assay_definitions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Managers can manage assay definitions" ON assay_definitions;
DROP POLICY IF EXISTS "Authenticated users can read assay definitions" ON assay_definitions;
DROP POLICY IF EXISTS "Managers can insert assay definitions" ON assay_definitions;
DROP POLICY IF EXISTS "Managers can update assay definitions" ON assay_definitions;
DROP POLICY IF EXISTS "Managers can delete assay definitions" ON assay_definitions;
DROP POLICY IF EXISTS "Managers can updatte assay definitions" ON assay_definitions; -- Typo check from previous if any

-- SELECT Policies
-- 1. Anyone can read active assays
CREATE POLICY "Anyone can read active assays"
ON assay_definitions FOR SELECT
USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- 2. Managers can read ALL assays (including soft deleted)
CREATE POLICY "Managers can read all assays"
ON assay_definitions FOR SELECT
USING (get_user_role() = 'manager');

-- INSERT: Managers only
CREATE POLICY "Managers can insert assays"
ON assay_definitions FOR INSERT
WITH CHECK (get_user_role() = 'manager');

-- UPDATE: Managers only
-- Implicitly sets WITH CHECK to the same condition
CREATE POLICY "Managers can update assays"
ON assay_definitions FOR UPDATE
USING (get_user_role() = 'manager');

-- DELETE: Managers only
CREATE POLICY "Managers can delete assays"
ON assay_definitions FOR DELETE
USING (get_user_role() = 'manager');
