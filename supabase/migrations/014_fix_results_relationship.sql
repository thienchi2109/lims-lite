-- ============================================================================
-- Migration 014: Fix Results Relationship Schema Cache
-- ============================================================================
-- The foreign key results_assay_id_fkey exists, but PostgREST is not seeing it.
-- This migration adds a comment to the results table to force a schema cache reload.
-- ============================================================================

COMMENT ON TABLE public.results IS 'Test results linked to samples and assays. Schema cache refreshed.';
COMMENT ON CONSTRAINT results_assay_id_fkey ON public.results IS 'Foreign key to assay_definitions';

-- Explicitly notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
