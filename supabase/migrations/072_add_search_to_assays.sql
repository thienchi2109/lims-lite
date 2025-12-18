-- Migration 072: Add full-text search to assay_definitions
-- Description: Adds tsvector column, GIN index, and automatic trigger for Vietnamese diacritic-insensitive search

SET search_path TO public;

-- Add tsvector column
ALTER TABLE assay_definitions
ADD COLUMN search_vector tsvector;

-- Create GIN index
-- Development: Use regular CREATE INDEX
-- Production: Use CREATE INDEX CONCURRENTLY to avoid table locks
CREATE INDEX assay_definitions_search_idx
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
CREATE TRIGGER assay_definitions_search_update
BEFORE INSERT OR UPDATE OF name, units ON assay_definitions
FOR EACH ROW EXECUTE FUNCTION update_search_vector_assay_definitions();

-- Backfill existing data
UPDATE assay_definitions SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(name, '') || ' ' ||
        COALESCE(units, '')
    )
);

-- Verify backfill (assay count)
SELECT COUNT(*) as backfilled_assays FROM assay_definitions WHERE search_vector IS NOT NULL;
