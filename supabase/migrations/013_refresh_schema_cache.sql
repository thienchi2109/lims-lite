-- ============================================================================
-- Migration 013: Refresh Schema Cache
-- ============================================================================
-- This migration adds a comment to the assay_methods table.
-- This is a no-op change for data, but it forces PostgREST to reload its
-- schema cache, which should resolve the "Could not find a relationship" error.
-- ============================================================================

COMMENT ON TABLE public.assay_methods IS 'Many-to-many relationship between assays and valid testing methods. Refreshed schema cache.';
