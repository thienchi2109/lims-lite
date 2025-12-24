-- Migration 098: Fix SECURITY DEFINER views
-- Security Impact: HIGH - Ensures views respect caller's RLS policies
-- Reference: Supabase advisor security_definer_view warning
--
-- Issue: Views public.objects and public.buckets have SECURITY DEFINER
-- which bypasses RLS policies of the querying user.
--
-- Fix: Recreate views with SECURITY INVOKER (explicit, though it's default)

SET search_path TO public;

-- ============================================================================
-- Fix 1: Recreate public.objects with SECURITY INVOKER
-- ============================================================================
DROP VIEW IF EXISTS public.objects;
CREATE VIEW public.objects
WITH (security_invoker = true)
AS SELECT * FROM storage.objects;

-- Restore grants
GRANT ALL ON public.objects TO service_role, authenticated, anon;

-- ============================================================================
-- Fix 2: Recreate public.buckets with SECURITY INVOKER
-- ============================================================================
DROP VIEW IF EXISTS public.buckets;
CREATE VIEW public.buckets
WITH (security_invoker = true)
AS SELECT * FROM storage.buckets;

-- Restore grants
GRANT ALL ON public.buckets TO service_role, authenticated, anon;

-- ============================================================================
-- Also fix public.migrations view for consistency
-- ============================================================================
DROP VIEW IF EXISTS public.migrations;
CREATE VIEW public.migrations
WITH (security_invoker = true)
AS SELECT * FROM storage.migrations;

-- Restore grants
GRANT ALL ON public.migrations TO service_role, authenticated, anon;

COMMENT ON VIEW public.objects IS 'View to storage.objects with SECURITY INVOKER - respects caller RLS';
COMMENT ON VIEW public.buckets IS 'View to storage.buckets with SECURITY INVOKER - respects caller RLS';
COMMENT ON VIEW public.migrations IS 'View to storage.migrations with SECURITY INVOKER - respects caller RLS';
