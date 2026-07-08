-- Optimize Supabase auth_rls_initplan performance advisors.
--
-- Security impact:
-- - Recreates seven existing RLS policies with the same access semantics.
-- - Wraps auth/helper calls in SELECT init-plan expressions so PostgreSQL can
--   evaluate stable per-request values once instead of once per candidate row.
-- - Does not consolidate permissive policies or move extensions; those require
--   separate security review because they can change RLS behavior.

-- user_signatures: users can read their own active signature rows.
DROP POLICY IF EXISTS "Users can view own signatures" ON public.user_signatures;
CREATE POLICY "Users can view own signatures"
ON public.user_signatures
FOR SELECT
TO public
USING (
    user_id = (select auth.uid())
    AND (select get_user_role()) = ANY (
        ARRAY['manager'::public.user_role, 'analyst'::public.user_role]
    )
);

-- user_signatures: users can create their own signature rows.
DROP POLICY IF EXISTS "Users can insert own signatures" ON public.user_signatures;
CREATE POLICY "Users can insert own signatures"
ON public.user_signatures
FOR INSERT
TO public
WITH CHECK (
    user_id = (select auth.uid())
    AND (select get_user_role()) = ANY (
        ARRAY['manager'::public.user_role, 'analyst'::public.user_role]
    )
);

-- user_signatures: users can update their own signature rows.
DROP POLICY IF EXISTS "Users can update own signatures" ON public.user_signatures;
CREATE POLICY "Users can update own signatures"
ON public.user_signatures
FOR UPDATE
TO public
USING (
    user_id = (select auth.uid())
    AND (select get_user_role()) = ANY (
        ARRAY['manager'::public.user_role, 'analyst'::public.user_role]
    )
)
WITH CHECK (
    user_id = (select auth.uid())
    AND (select get_user_role()) = ANY (
        ARRAY['manager'::public.user_role, 'analyst'::public.user_role]
    )
);

-- user_signatures: service role can read signatures for CoA generation.
DROP POLICY IF EXISTS "Service role can read all signatures" ON public.user_signatures;
CREATE POLICY "Service role can read all signatures"
ON public.user_signatures
FOR SELECT
TO service_role
USING (
    ((select auth.jwt()) ->> 'role'::text) = 'service_role'::text
);

-- sample_submissions: users see their own submissions, managers see all.
DROP POLICY IF EXISTS "Users can view submissions" ON public.sample_submissions;
CREATE POLICY "Users can view submissions"
ON public.sample_submissions
FOR SELECT
TO public
USING (
    user_id = (select auth.uid())
    OR (select get_user_role()) = 'manager'::public.user_role
);

-- results: authenticated analysts/managers can read non-confidential results,
-- plus confidential results when the confidential helper grants access.
DROP POLICY IF EXISTS "Authenticated users can read results" ON public.results;
CREATE POLICY "Authenticated users can read results"
ON public.results
FOR SELECT
TO public
USING (
    (select auth.uid()) IS NOT NULL
    AND (select get_user_role()) = ANY (
        ARRAY['analyst'::public.user_role, 'manager'::public.user_role]
    )
    AND (
        NOT EXISTS (
            SELECT 1
            FROM public.assay_definitions assay_definition
            WHERE assay_definition.id = results.assay_id
              AND assay_definition.is_confidential = true
        )
        OR (select user_can_access_confidential())
    )
);

-- manager_otp_settings: managers can read their own OTP destination.
DROP POLICY IF EXISTS "Managers can read manager OTP settings" ON public.manager_otp_settings;
CREATE POLICY "Managers can read manager OTP settings"
ON public.manager_otp_settings
FOR SELECT
TO public
USING (
    user_id = (select auth.uid())
    AND (select get_user_role()) = 'manager'::public.user_role
);
