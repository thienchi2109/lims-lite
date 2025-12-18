-- Migration 072: Add full-text search to assay_definitions (PRODUCTION VERSION)
-- Description: Adds tsvector column, GIN index with CONCURRENTLY, and automatic trigger for Vietnamese diacritic-insensitive search
--
-- **IMPORTANT**: This version uses CREATE INDEX CONCURRENTLY for zero-downtime deployment
-- - CONCURRENTLY allows reads/writes during index creation
-- - Takes longer than regular CREATE INDEX but prevents table locks
-- - Use this version for staging/production with active users
-- - For development, use the regular version (072_add_search_to_assays.sql)

SET search_path TO public;

-- Add tsvector column
ALTER TABLE assay_definitions
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index CONCURRENTLY
-- This can be run on a live production database without blocking reads/writes
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
-- Must be run separately from other statements
CREATE INDEX CONCURRENTLY IF NOT EXISTS assay_definitions_search_idx
ON assay_definitions USING GIN(search_vector);

-- Create trigger function
-- This function combines searchable columns and applies unaccent for Vietnamese support
CREATE OR REPLACE FUNCTION update_search_vector_assay_definitions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Combine searchable columns and apply unaccent
    NEW.search_vector := to_tsvector(
        'simple',
        unaccent(
            COALESCE(NEW.name, '') || ' ' ||
            COALESCE(NEW.units, '')
        )
    );
    RETURN NEW;
END;
$$;

-- Create trigger
-- NOTE: Only trigger on relevant column changes to reduce overhead
DROP TRIGGER IF EXISTS assay_definitions_search_update ON assay_definitions;
CREATE TRIGGER assay_definitions_search_update
BEFORE INSERT OR UPDATE OF name, units ON assay_definitions
FOR EACH ROW EXECUTE FUNCTION update_search_vector_assay_definitions();

-- Backfill existing data
-- WHERE clause ensures idempotency: only processes unindexed rows
-- Safe to re-run if migration is interrupted
UPDATE assay_definitions SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(name, '') || ' ' ||
        COALESCE(units, '')
    )
)
WHERE search_vector IS NULL;

-- Verify backfill (assay count)
SELECT COUNT(*) as backfilled_assays FROM assay_definitions WHERE search_vector IS NOT NULL;
