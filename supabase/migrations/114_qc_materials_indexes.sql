-- Migration: Add indexes for QC materials server-side filtering
-- Purpose: Optimize text search (name, lot_number, manufacturer), level filter, and status filter
-- Part of: Server-side pagination and filtering for QC Materials table

-- Index for name search (partial: excludes soft-deleted records)
CREATE INDEX IF NOT EXISTS idx_qc_materials_name
  ON qc_materials(name) WHERE deleted_at IS NULL;

-- Index for manufacturer search (partial: excludes soft-deleted records)
CREATE INDEX IF NOT EXISTS idx_qc_materials_manufacturer
  ON qc_materials(manufacturer) WHERE deleted_at IS NULL;

-- Index for level filter dropdown (partial: excludes soft-deleted records)
CREATE INDEX IF NOT EXISTS idx_qc_materials_level
  ON qc_materials(level) WHERE deleted_at IS NULL;

-- Note: idx_qc_materials_lot_number already exists (full index)
-- Note: idx_qc_materials_expiration already exists with WHERE deleted_at IS NULL

-- Verify indexes were created
DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE tablename = 'qc_materials'
    AND indexname IN (
      'idx_qc_materials_name',
      'idx_qc_materials_manufacturer',
      'idx_qc_materials_level'
    );

  IF idx_count < 3 THEN
    RAISE EXCEPTION 'Expected 3 new indexes, found %', idx_count;
  END IF;

  RAISE NOTICE 'Successfully created % QC materials indexes', idx_count;
END $$;
