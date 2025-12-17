-- Migration 069: Add full-text search to samples
-- Description: Adds tsvector column, GIN index, and automatic trigger for Vietnamese diacritic-insensitive search

SET search_path TO public;

-- Add tsvector column
ALTER TABLE samples
ADD COLUMN search_vector tsvector;

-- Create GIN index
-- Development: Use regular CREATE INDEX
-- Production: Use CREATE INDEX CONCURRENTLY to avoid table locks
CREATE INDEX samples_search_idx
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
CREATE TRIGGER samples_search_update
BEFORE INSERT OR UPDATE OF sample_id, client_name, type, status, rejection_reason, received_at ON samples
FOR EACH ROW EXECUTE FUNCTION update_search_vector_samples();

-- Backfill existing data
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
);

-- Verify backfill (sample count)
SELECT COUNT(*) as backfilled_samples FROM samples WHERE search_vector IS NOT NULL;
