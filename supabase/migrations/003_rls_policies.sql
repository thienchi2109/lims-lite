-- CDC-LIMS Row Level Security Policies
-- Migration 003: RLS Policies
-- Implements role-based access control at the database level

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assay_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Get User Role
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role FROM public.users WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON public.users FOR SELECT
USING (id = auth.uid());

-- Managers can read all users
CREATE POLICY "Managers can read all users"
ON public.users FOR SELECT
USING (get_user_role() = 'manager');

-- Managers can update users
CREATE POLICY "Managers can update users"
ON public.users FOR UPDATE
USING (get_user_role() = 'manager');

-- Managers can insert users
CREATE POLICY "Managers can insert users"
ON public.users FOR INSERT
WITH CHECK (get_user_role() = 'manager');

-- ============================================================================
-- METHODS TABLE POLICIES
-- ============================================================================

-- All authenticated users can read methods
CREATE POLICY "Authenticated users can read methods"
ON public.methods FOR SELECT
USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- Managers can manage methods
CREATE POLICY "Managers can manage methods"
ON public.methods FOR ALL
USING (get_user_role() = 'manager');

-- ============================================================================
-- ASSAY DEFINITIONS TABLE POLICIES
-- ============================================================================

-- All authenticated users can read assay definitions
CREATE POLICY "Authenticated users can read assay definitions"
ON public.assay_definitions FOR SELECT
USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- Managers can manage assay definitions
CREATE POLICY "Managers can manage assay definitions"
ON public.assay_definitions FOR ALL
USING (get_user_role() = 'manager');

-- ============================================================================
-- SAMPLES TABLE POLICIES
-- ============================================================================

-- All authenticated users can read non-deleted samples
CREATE POLICY "Authenticated users can read samples"
ON public.samples FOR SELECT
USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- Managers can insert samples
CREATE POLICY "Managers can insert samples"
ON public.samples FOR INSERT
WITH CHECK (get_user_role() = 'manager');

-- Managers can update samples
CREATE POLICY "Managers can update samples"
ON public.samples FOR UPDATE
USING (get_user_role() = 'manager');

-- Managers can soft delete samples
CREATE POLICY "Managers can delete samples"
ON public.samples FOR DELETE
USING (get_user_role() = 'manager');

-- ============================================================================
-- RESULTS TABLE POLICIES (CRITICAL FOR COMPLIANCE)
-- ============================================================================

-- All authenticated users can read results
CREATE POLICY "Authenticated users can read results"
ON public.results FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Analysts can insert pending results
CREATE POLICY "Analysts can insert results"
ON public.results FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND
    status = 'pending'
);

-- Analysts can update ONLY pending or entered results (NOT approved)
CREATE POLICY "Analysts can update pending results"
ON public.results FOR UPDATE
USING (
    auth.uid() IS NOT NULL AND
    status != 'approved'
)
WITH CHECK (
    status != 'approved'
);

-- Managers can do everything with results
CREATE POLICY "Managers can manage all results"
ON public.results FOR ALL
USING (get_user_role() = 'manager');

-- ============================================================================
-- AUDIT LOGS TABLE POLICIES
-- ============================================================================

-- All authenticated users can read audit logs
CREATE POLICY "Authenticated users can read audit logs"
ON public.audit_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only the system can insert audit logs (via triggers)
-- No manual INSERT policy - only triggers can insert

-- No one can update or delete audit logs (immutable)
-- No UPDATE or DELETE policies

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION get_user_role() IS 'Helper function to get the current user role for RLS policies';
