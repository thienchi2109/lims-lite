-- Migration 123: Add confidential assay schema helpers
-- Security Impact: Medium
-- Changes:
--   - Adds assay_definitions.is_confidential and users.can_access_confidential
--   - Adds user_can_access_confidential() for future confidential RLS predicates
--   - Adds partial indexes for confidential assay and user-authorization lookups

SET search_path TO public;

ALTER TABLE public.assay_definitions
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS can_access_confidential BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.assay_definitions.is_confidential IS
'Marks assays whose related results and sample context require explicit confidential authorization.';

COMMENT ON COLUMN public.users.can_access_confidential IS
'Indicates whether the user may access assay data marked as confidential.';

CREATE OR REPLACE FUNCTION public.user_can_access_confidential()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users AS current_user_profile
        WHERE current_user_profile.id = auth.uid()
          AND current_user_profile.deleted_at IS NULL
          AND current_user_profile.can_access_confidential = TRUE
    );
$$;

COMMENT ON FUNCTION public.user_can_access_confidential() IS
'Returns true when the current authenticated user has explicit confidential-data authorization.';

REVOKE ALL ON FUNCTION public.user_can_access_confidential() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_confidential() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_assay_definitions_confidential_lookup
ON public.assay_definitions (id)
WHERE is_confidential = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_confidential_access_lookup
ON public.users (id)
WHERE can_access_confidential = TRUE AND deleted_at IS NULL;
