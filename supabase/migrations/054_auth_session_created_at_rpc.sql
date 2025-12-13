-- Migration 054: Add auth session created_at lookup RPC
-- Security Impact: Medium
-- Changes: Add `service_role` DB role (if missing) and a SECURITY DEFINER RPC to read `auth.sessions.created_at` by session id.

SET search_path TO public;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO service_role;

DROP FUNCTION IF EXISTS public.get_session_created_at(UUID);

CREATE OR REPLACE FUNCTION public.get_session_created_at(p_session_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
    SELECT created_at
    FROM auth.sessions
    WHERE id = p_session_id;
$$;

REVOKE ALL ON FUNCTION public.get_session_created_at(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_created_at(UUID) TO service_role;

COMMENT ON FUNCTION public.get_session_created_at(UUID)
IS 'Returns auth.sessions.created_at for a session id. Used by server-side session timebox enforcement.';

NOTIFY pgrst, 'reload schema';

