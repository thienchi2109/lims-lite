-- Migration: Normalize QC Material Level Column
-- Date: 2026-01-04
-- Purpose: Fix fragile level parsing by adding normalized level_normalized column
-- Addresses: Critical Issue #2 from qc-entry-redesign-review-findings.md

-- Add normalized level column (if not already added from failed migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qc_materials' AND column_name = 'level_normalized'
  ) THEN
    ALTER TABLE qc_materials ADD COLUMN level_normalized VARCHAR(3);
  END IF;
END $$;

-- Migrate existing data from qc_level enum to normalized format
-- Map: low → L1, normal → L2, high → L3
UPDATE qc_materials
SET level_normalized =
  CASE level::text
    WHEN 'low' THEN 'L1'
    WHEN 'normal' THEN 'L2'
    WHEN 'high' THEN 'L3'
    ELSE NULL
  END
WHERE level_normalized IS NULL OR level_normalized = '';

-- Add NOT NULL constraint after data migration
ALTER TABLE qc_materials
ALTER COLUMN level_normalized SET NOT NULL;

-- Drop old check constraint if exists (from failed migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qc_materials_level_normalized_check'
  ) THEN
    ALTER TABLE qc_materials DROP CONSTRAINT qc_materials_level_normalized_check;
  END IF;
END $$;

-- Add check constraint to enforce valid values
ALTER TABLE qc_materials
ADD CONSTRAINT qc_materials_level_normalized_check
CHECK (level_normalized IN ('L1', 'L2', 'L3', 'L4'));

-- Create index for faster queries (drop if exists first)
DROP INDEX IF EXISTS idx_qc_materials_level_normalized;
CREATE INDEX idx_qc_materials_level_normalized
ON qc_materials(level_normalized);

-- Add comment
COMMENT ON COLUMN qc_materials.level_normalized IS 'Normalized level identifier: L1 (low), L2 (normal), L3 (high)';

-- Verify migration
DO $$
DECLARE
  unmigrated_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM qc_materials;
  SELECT COUNT(*) INTO unmigrated_count FROM qc_materials WHERE level_normalized IS NULL;

  IF unmigrated_count > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % of % rows with NULL level_normalized', unmigrated_count, total_count;
  END IF;

  RAISE NOTICE 'Migration successful: All % qc_materials rows have level_normalized', total_count;
END $$;
