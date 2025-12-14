-- Migration 059: RPC for username -> email lookup
-- Security Impact: Low
-- Changes: Adds SECURITY DEFINER RPC to resolve login email for a username (service_role only)

SET search_path TO public;

-- This function is used server-side to support "login by username" even when `public.users`
-- is protected by RLS. It intentionally does NOT grant access to anon/authenticated roles.
DROP FUNCTION IF EXISTS public.get_user_email_by_username(text);

CREATE OR REPLACE FUNCTION public.get_user_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.email
    FROM public.users u
    WHERE u.username = p_username
      AND u.deleted_at IS NULL
    ORDER BY u.created_at DESC
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_email_by_username(text)
IS 'Service-role-only helper for resolving login email from public.users under RLS (server-side username login).';

GRANT EXECUTE ON FUNCTION public.get_user_email_by_username(text) TO service_role;

-- Ask PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

