-- Migration 066: Optimize RLS Performance
-- Security Impact: None - Performance optimization only
-- Changes:
--   1. Fix auth.uid() and auth.role() re-evaluation in RLS policies
--   2. Combine multiple permissive policies on assay_definitions

SET search_path TO public;

-- ========================================
-- Fix 1: Optimize assay_definitions policies
-- ========================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Anyone can read active assays" ON public.assay_definitions;
DROP POLICY IF EXISTS "Managers can read all assays" ON public.assay_definitions;

-- Create combined SELECT policy (fixes multiple permissive policies warning)
CREATE POLICY "Users can read assays"
ON public.assay_definitions FOR SELECT
USING (
    -- Use subquery to prevent re-evaluation per row
    ((SELECT auth.role()) = 'authenticated' AND deleted_at IS NULL)
    OR
    (get_user_role() = 'manager')
);

COMMENT ON POLICY "Users can read assays" ON public.assay_definitions
IS 'Authenticated users see active assays, managers see all assays';

-- ========================================
-- Fix 2: Optimize user_signatures policies
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "user_signatures_select_own" ON public.user_signatures;
DROP POLICY IF EXISTS "user_signatures_insert_own" ON public.user_signatures;
DROP POLICY IF EXISTS "user_signatures_update_own" ON public.user_signatures;

-- Recreate with optimized auth.uid() calls
CREATE POLICY "user_signatures_select_own"
ON public.user_signatures FOR SELECT
USING (
    get_user_role() = 'manager'
    AND user_id = (SELECT auth.uid())  -- Subquery prevents re-evaluation
);

CREATE POLICY "user_signatures_insert_own"
ON public.user_signatures FOR INSERT
WITH CHECK (
    get_user_role() = 'manager'
    AND user_id = (SELECT auth.uid())  -- Subquery prevents re-evaluation
);

CREATE POLICY "user_signatures_update_own"
ON public.user_signatures FOR UPDATE
USING (
    get_user_role() = 'manager'
    AND user_id = (SELECT auth.uid())  -- Subquery prevents re-evaluation
)
WITH CHECK (
    get_user_role() = 'manager'
    AND user_id = (SELECT auth.uid())  -- Subquery prevents re-evaluation
);

COMMENT ON POLICY "user_signatures_select_own" ON public.user_signatures
IS 'Managers can read their own signatures';
COMMENT ON POLICY "user_signatures_insert_own" ON public.user_signatures
IS 'Managers can insert their own signatures';
COMMENT ON POLICY "user_signatures_update_own" ON public.user_signatures
IS 'Managers can update their own signatures';
