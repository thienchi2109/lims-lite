-- Migration 20251212000000: Optimize RLS Policies
-- Description: Optimizes RLS policies by wrapping auth calls, resolving overlaps, and splitting Manager "ALL" policies.
-- Security Impact: Low (Performance optimization, maintains existing security logic)

SET search_path TO public;

-- ============================================================================
-- 1. OPTIMIZE HELPER FUNCTION
-- ============================================================================

-- Mark get_user_role as STABLE to prevent per-row re-evaluation
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role FROM public.users WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 2. PUBLIC.CLIENTS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.clients;

CREATE POLICY "Authenticated users can read clients"
ON public.clients FOR SELECT
USING ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- 3. PUBLIC.LAB_SPECIALTIES
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read lab specialties" ON public.lab_specialties;
DROP POLICY IF EXISTS "Managers can manage lab specialties" ON public.lab_specialties;

CREATE POLICY "Authenticated users can read lab specialties"
ON public.lab_specialties FOR SELECT
USING ((select auth.uid()) IS NOT NULL AND deleted_at IS NULL);

-- Split Manager policies to avoid SELECT overlap
CREATE POLICY "Managers can insert lab specialties"
ON public.lab_specialties FOR INSERT
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can update lab specialties"
ON public.lab_specialties FOR UPDATE
USING (get_user_role() = 'manager')
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can delete lab specialties"
ON public.lab_specialties FOR DELETE
USING (get_user_role() = 'manager');

-- ============================================================================
-- 4. PUBLIC.ASSAY_DEFINITIONS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read assay definitions" ON public.assay_definitions;
DROP POLICY IF EXISTS "Managers can manage assay definitions" ON public.assay_definitions;

CREATE POLICY "Authenticated users can read assay definitions"
ON public.assay_definitions FOR SELECT
USING ((select auth.uid()) IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Managers can insert assay definitions"
ON public.assay_definitions FOR INSERT
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can update assay definitions"
ON public.assay_definitions FOR UPDATE
USING (get_user_role() = 'manager')
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can delete assay definitions"
ON public.assay_definitions FOR DELETE
USING (get_user_role() = 'manager');

-- ============================================================================
-- 5. PUBLIC.METHODS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read methods" ON public.methods;
DROP POLICY IF EXISTS "Managers can manage methods" ON public.methods;

CREATE POLICY "Authenticated users can read methods"
ON public.methods FOR SELECT
USING ((select auth.uid()) IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Managers can insert methods"
ON public.methods FOR INSERT
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can update methods"
ON public.methods FOR UPDATE
USING (get_user_role() = 'manager')
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can delete methods"
ON public.methods FOR DELETE
USING (get_user_role() = 'manager');

-- ============================================================================
-- 6. PUBLIC.ASSAY_METHODS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read assay methods" ON public.assay_methods;
DROP POLICY IF EXISTS "Managers can manage assay methods" ON public.assay_methods;

CREATE POLICY "Authenticated users can read assay methods"
ON public.assay_methods FOR SELECT
USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Managers can insert assay methods"
ON public.assay_methods FOR INSERT
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can update assay methods"
ON public.assay_methods FOR UPDATE
USING (get_user_role() = 'manager')
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can delete assay methods"
ON public.assay_methods FOR DELETE
USING (get_user_role() = 'manager');

-- ============================================================================
-- 7. PUBLIC.SAMPLES
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read samples" ON public.samples;
DROP POLICY IF EXISTS "Analysts can insert own samples" ON public.samples;
DROP POLICY IF EXISTS "Analysts can update own samples" ON public.samples;

CREATE POLICY "Authenticated users can read samples"
ON public.samples FOR SELECT
USING ((select auth.uid()) IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY "Analysts can insert own samples"
ON public.samples FOR INSERT
WITH CHECK (
    get_user_role() = 'analyst'
    AND received_by = (select auth.uid())
);

CREATE POLICY "Analysts can update own samples"
ON public.samples FOR UPDATE
USING (
    get_user_role() = 'analyst'
    AND received_by = (select auth.uid())
    AND deleted_at IS NULL
)
WITH CHECK (
    get_user_role() = 'analyst'
    AND received_by = (select auth.uid())
    AND deleted_at IS NULL
);

-- ============================================================================
-- 8. PUBLIC.RESULTS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read results" ON public.results;
DROP POLICY IF EXISTS "Analysts can update non-review results" ON public.results;
DROP POLICY IF EXISTS "Managers can manage all results" ON public.results;
DROP POLICY IF EXISTS "Analysts and managers can insert pending results" ON public.results;

CREATE POLICY "Authenticated users can read results"
ON public.results FOR SELECT
USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Analysts can update non-review results"
ON public.results FOR UPDATE
USING (
    (select auth.uid()) IS NOT NULL AND
    status != 'approved' AND
    (SELECT status FROM public.samples WHERE id = results.sample_id) 
        NOT IN ('review', 'completed')
)
WITH CHECK (
    status != 'approved' AND
    (SELECT status FROM public.samples WHERE id = results.sample_id) 
        NOT IN ('review', 'completed')
);

-- Separate Insert Policies
CREATE POLICY "Analysts can insert pending results"
ON public.results FOR INSERT
WITH CHECK (
    get_user_role() = 'analyst'
    AND status = 'pending'
    AND EXISTS (
        SELECT 1
        FROM public.samples s
        WHERE s.id = public.results.sample_id
          AND s.deleted_at IS NULL
    )
);

CREATE POLICY "Managers can insert results"
ON public.results FOR INSERT
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can update results"
ON public.results FOR UPDATE
USING (get_user_role() = 'manager')
WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Managers can delete results"
ON public.results FOR DELETE
USING (get_user_role() = 'manager');

-- ============================================================================
-- 9. PUBLIC.AUDIT_LOGS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can read audit logs"
ON public.audit_logs FOR SELECT
USING ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- 10. PUBLIC.USERS
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Managers can read all users" ON public.users;

CREATE POLICY "Authenticated users can read profiles"
ON public.users FOR SELECT
USING (
    id = (select auth.uid()) 
    OR 
    get_user_role() = 'manager'
);
