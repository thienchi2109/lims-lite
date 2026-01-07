-- Migration 110: Prevent concurrent login sessions
-- Security Impact: Medium
-- Changes: Add SECURITY DEFINER RPC to invalidate all sessions for a user by deleting from auth.sessions

SET search_path TO public;

-- Ensure service_role exists (should already exist from migration 054)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO service_role;

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.invalidate_other_user_sessions(UUID, UUID);

-- Create function to invalidate all sessions for a user EXCEPT the current one
-- This prevents DoS attacks where attacker invalidates sessions without knowing password
CREATE OR REPLACE FUNCTION public.invalidate_other_user_sessions(
    p_user_id UUID,
    p_keep_session_id UUID  -- The session to keep (just created by login)
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
    session_count INTEGER;
BEGIN
    -- Count OTHER sessions before deletion (excluding current)
    SELECT COUNT(*) INTO session_count
    FROM auth.sessions
    WHERE user_id = p_user_id
      AND id != p_keep_session_id;

    -- Delete all OTHER sessions for this user (keep current session)
    -- This forces logout on their next request
    DELETE FROM auth.sessions
    WHERE user_id = p_user_id
      AND id != p_keep_session_id;

    RETURN session_count;
END;
$$;

-- Security: Only service_role can execute
REVOKE ALL ON FUNCTION public.invalidate_other_user_sessions(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invalidate_other_user_sessions(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.invalidate_other_user_sessions(UUID, UUID)
IS 'Invalidates all active sessions for a user EXCEPT the specified session. Used to prevent concurrent logins after successful authentication. Returns count of sessions deleted.';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
