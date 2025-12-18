-- Migration 073: Add full-text search to results (PRODUCTION VERSION)
-- Description: Adds tsvector column, GIN index with CONCURRENTLY, and automatic trigger for Vietnamese diacritic-insensitive search
--
-- **IMPORTANT**: This version uses CREATE INDEX CONCURRENTLY for zero-downtime deployment
-- - CONCURRENTLY allows reads/writes during index creation
-- - Takes longer than regular CREATE INDEX but prevents table locks
-- - Use this version for staging/production with active users
-- - For development, use the regular version (073_add_search_to_results.sql)

SET search_path TO public;

-- Add tsvector column
ALTER TABLE results
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index CONCURRENTLY
-- This can be run on a live production database without blocking reads/writes
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
-- Must be run separately from other statements
CREATE INDEX CONCURRENTLY IF NOT EXISTS results_search_idx
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
DROP TRIGGER IF EXISTS results_search_update ON results;
CREATE TRIGGER results_search_update
BEFORE INSERT OR UPDATE OF value, status, approval_note ON results
FOR EACH ROW EXECUTE FUNCTION update_search_vector_results();

-- Backfill existing data
-- WHERE clause ensures idempotency: only processes unindexed rows
-- Safe to re-run if migration is interrupted
UPDATE results SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(value, '') || ' ' ||
        COALESCE(status::text, '') || ' ' ||
        COALESCE(approval_note, '')
    )
)
WHERE search_vector IS NULL;

-- Verify backfill (results count)
SELECT COUNT(*) as backfilled_results FROM results WHERE search_vector IS NOT NULL;
