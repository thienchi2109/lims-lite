-- Migration 111: Add RPC to get latest session ID for a user
-- Security Impact: Low
-- Changes: Add SECURITY DEFINER RPC to get the most recent session ID for a user from auth.sessions

SET search_path TO public;

DROP FUNCTION IF EXISTS public.get_latest_session_id(UUID);

CREATE OR REPLACE FUNCTION public.get_latest_session_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
    SELECT id
    FROM auth.sessions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_latest_session_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_session_id(UUID) TO service_role;

COMMENT ON FUNCTION public.get_latest_session_id(UUID)
IS 'Returns the most recent session ID for a user. Used after login to identify the current session for concurrent login prevention.';

NOTIFY pgrst, 'reload schema';
