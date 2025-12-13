-- ============================================================================
-- Migration 010: Assay-Method Many-to-Many Junction Table
-- ============================================================================
-- Creates junction table to support many-to-many relationship between
-- assay_definitions and methods tables
-- 
-- Business Rule: One assay can have multiple valid testing methods
-- Example: Glucose can be tested via HPLC, Enzymatic, or Spectrophotometry
-- ============================================================================

SET search_path TO public;

-- ============================================================================
-- CREATE JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assay_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assay_id UUID NOT NULL REFERENCES public.assay_definitions(id) ON DELETE CASCADE,
    method_id UUID NOT NULL REFERENCES public.methods(id) ON DELETE RESTRICT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one assay-method pair only (no duplicates)
    CONSTRAINT unique_assay_method UNIQUE(assay_id, method_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for querying methods by assay
CREATE INDEX idx_assay_methods_assay_id ON public.assay_methods(assay_id);

-- Index for querying assays by method
CREATE INDEX idx_assay_methods_method_id ON public.assay_methods(method_id);

-- Partial unique index: Only ONE default method per assay
CREATE UNIQUE INDEX idx_assay_methods_one_default
ON public.assay_methods (assay_id)
WHERE is_default = true;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER update_assay_methods_updated_at
    BEFORE UPDATE ON public.assay_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.assay_methods ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read assay-method relationships
CREATE POLICY "Authenticated users can read assay methods"
ON public.assay_methods FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only managers can manage assay-method relationships
CREATE POLICY "Managers can manage assay methods"
ON public.assay_methods FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'manager'
    )
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.assay_methods IS 'Many-to-many relationship between assays and valid testing methods. Each assay can have multiple methods, with one marked as default.';
COMMENT ON COLUMN public.assay_methods.is_default IS 'Only one method per assay can be marked as default (enforced by unique partial index)';
COMMENT ON COLUMN public.assay_methods.notes IS 'Optional notes about when to use this method for this assay (e.g., "Use for regulatory samples")';
