-- Migration 20251212000001: Combine Overlapping Policies
-- Description: Combines multiple permissive policies on results and samples tables to resolve performance warnings.
--              Merges Manager and Analyst policies into single policies using OR logic.
-- Security Impact: Low (Logic preserved, just structured more efficiently)

SET search_path TO public;

-- ============================================================================
-- 1. PUBLIC.RESULTS - INSERT
-- ============================================================================

DROP POLICY IF EXISTS "Analysts can insert pending results" ON public.results;
DROP POLICY IF EXISTS "Managers can insert results" ON public.results;
DROP POLICY IF EXISTS "Analysts and managers can insert pending results" ON public.results; -- From previous checks if any
DROP POLICY IF EXISTS "Analysts and managers can insert results" ON public.results; -- Idempotency

CREATE POLICY "Analysts and managers can insert results"
ON public.results FOR INSERT
WITH CHECK (
    get_user_role() = 'manager'
    OR (
        get_user_role() = 'analyst'
        AND status = 'pending'
        AND EXISTS (
            SELECT 1 FROM public.samples s
            WHERE s.id = results.sample_id 
            AND s.deleted_at IS NULL
        )
    )
);

-- ============================================================================
-- 2. PUBLIC.RESULTS - UPDATE
-- ============================================================================

DROP POLICY IF EXISTS "Analysts can update non-review results" ON public.results;
DROP POLICY IF EXISTS "Managers can update results" ON public.results;
DROP POLICY IF EXISTS "Analysts and managers can update results" ON public.results; -- Idempotency

CREATE POLICY "Analysts and managers can update results"
ON public.results FOR UPDATE
USING (
    get_user_role() = 'manager'
    OR (
        -- Original logic for analysts/users:
        status != 'approved' 
        AND (
            SELECT status FROM public.samples 
            WHERE id = results.sample_id
        ) NOT IN ('review', 'completed')
    )
)
WITH CHECK (
    get_user_role() = 'manager'
    OR (
        status != 'approved' 
        AND (
            SELECT status FROM public.samples 
            WHERE id = results.sample_id
        ) NOT IN ('review', 'completed')
    )
);

-- ============================================================================
-- 3. PUBLIC.SAMPLES - INSERT
-- ============================================================================

DROP POLICY IF EXISTS "Analysts can insert own samples" ON public.samples;
DROP POLICY IF EXISTS "Managers can insert samples" ON public.samples;
DROP POLICY IF EXISTS "Analysts and managers can insert samples" ON public.samples; -- Idempotency

CREATE POLICY "Analysts and managers can insert samples"
ON public.samples FOR INSERT
WITH CHECK (
    get_user_role() = 'manager'
    OR (
        get_user_role() = 'analyst'
        AND received_by = (select auth.uid())
    )
);

-- ============================================================================
-- 4. PUBLIC.SAMPLES - UPDATE
-- ============================================================================

DROP POLICY IF EXISTS "Analysts can start samples" ON public.samples;
DROP POLICY IF EXISTS "Analysts can update own samples" ON public.samples;
DROP POLICY IF EXISTS "Managers can update samples" ON public.samples;
DROP POLICY IF EXISTS "Analysts and managers can update samples" ON public.samples; -- Idempotency

CREATE POLICY "Analysts and managers can update samples"
ON public.samples FOR UPDATE
USING (
    get_user_role() = 'manager'
    OR (
        get_user_role() = 'analyst'
        AND deleted_at IS NULL
        AND (
            received_by = (select auth.uid())
            OR status = 'assigned'
        )
    )
)
WITH CHECK (
    get_user_role() = 'manager'
    OR (
        get_user_role() = 'analyst'
        AND deleted_at IS NULL
        AND (
            received_by = (select auth.uid())
            OR status = 'in_progress'
        )
    )
);