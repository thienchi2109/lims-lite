-- Migration 073: Add full-text search to results
-- Description: Adds tsvector column, GIN index, and automatic trigger for Vietnamese diacritic-insensitive search

SET search_path TO public;

-- Add tsvector column
ALTER TABLE results
ADD COLUMN search_vector tsvector;

-- Create GIN index
-- Development: Use regular CREATE INDEX
-- Production: Use CREATE INDEX CONCURRENTLY to avoid table locks
CREATE INDEX results_search_idx
ON results USING GIN(search_vector);

-- Create trigger function
-- This function combines searchable columns and applies unaccent for Vietnamese support
CREATE OR REPLACE FUNCTION update_search_vector_results()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Combine searchable columns and apply unaccent
    NEW.search_vector := to_tsvector(
        'simple',
        unaccent(
            COALESCE(NEW.value, '') || ' ' ||
            COALESCE(NEW.status::text, '') || ' ' ||
            COALESCE(NEW.approval_note, '')
        )
    );
    RETURN NEW;
END;
$$;

-- Create trigger
-- NOTE: Only trigger on relevant column changes to reduce overhead
CREATE TRIGGER results_search_update
BEFORE INSERT OR UPDATE OF value, status, approval_note ON results
FOR EACH ROW EXECUTE FUNCTION update_search_vector_results();

-- Backfill existing data
UPDATE results SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(value, '') || ' ' ||
        COALESCE(status::text, '') || ' ' ||
        COALESCE(approval_note, '')
    )
);

-- Verify backfill (results count)
SELECT COUNT(*) as backfilled_results FROM results WHERE search_vector IS NOT NULL;
