-- Migration 069: Add full-text search to samples (PRODUCTION VERSION)
-- Description: Adds tsvector column, GIN index with CONCURRENTLY, and automatic trigger for Vietnamese diacritic-insensitive search
--
-- **IMPORTANT**: This version uses CREATE INDEX CONCURRENTLY for zero-downtime deployment
-- - CONCURRENTLY allows reads/writes during index creation
-- - Takes longer than regular CREATE INDEX but prevents table locks
-- - Use this version for staging/production with active users
-- - For development, use the regular version (069_add_search_to_samples.sql)

SET search_path TO public;

-- Add tsvector column
ALTER TABLE samples
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index CONCURRENTLY
-- This can be run on a live production database without blocking reads/writes
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
-- Must be run separately from other statements
CREATE INDEX CONCURRENTLY IF NOT EXISTS samples_search_idx
ON samples USING GIN(search_vector);

-- Create trigger function (reusable for all tables)
-- This function combines searchable columns and applies unaccent for Vietnamese support
CREATE OR REPLACE FUNCTION update_search_vector_samples()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Combine searchable columns and apply unaccent
    NEW.search_vector := to_tsvector(
        'simple',
        unaccent(
            COALESCE(NEW.sample_id, '') || ' ' ||
            COALESCE(NEW.client_name, '') || ' ' ||
            COALESCE(NEW.type, '') || ' ' ||
            COALESCE(NEW.status::text, '') || ' ' ||
            COALESCE(NEW.rejection_reason, '') || ' ' ||
            COALESCE(to_char(NEW.received_at, 'YYYY-MM-DD'), '')
        )
    );
    RETURN NEW;
END;
$$;

-- Create trigger
-- NOTE: Only trigger on relevant column changes to reduce overhead
DROP TRIGGER IF EXISTS samples_search_update ON samples;
CREATE TRIGGER samples_search_update
BEFORE INSERT OR UPDATE OF sample_id, client_name, type, status, rejection_reason, received_at ON samples
FOR EACH ROW EXECUTE FUNCTION update_search_vector_samples();

-- Backfill existing data
-- This update will take time proportional to table size
-- WHERE clause ensures idempotency: only processes unindexed rows
-- Safe to re-run if migration is interrupted
UPDATE samples SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(sample_id, '') || ' ' ||
        COALESCE(client_name, '') || ' ' ||
        COALESCE(type, '') || ' ' ||
        COALESCE(status::text, '') || ' ' ||
        COALESCE(rejection_reason, '') || ' ' ||
        COALESCE(to_char(received_at, 'YYYY-MM-DD'), '')
    )
)
WHERE search_vector IS NULL;

-- Verify backfill (sample count)
SELECT COUNT(*) as backfilled_samples FROM samples WHERE search_vector IS NOT NULL;
