-- Migration 017: Fix permissions for auth schema so RPCs can call auth.uid()
-- Some self-hosted setups don't grant usage/execute on schema auth to the JWT roles.

SET search_path TO public;

-- Allow API roles to reference auth.uid() and other auth helpers
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
