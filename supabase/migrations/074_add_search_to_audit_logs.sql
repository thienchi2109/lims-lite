-- Migration 074: Add full-text search to audit_logs
-- Description: Adds tsvector column, GIN index, and automatic trigger for Vietnamese diacritic-insensitive search
-- Note: audit_logs table does NOT need to exclude search_vector from its own audit (no recursion)

SET search_path TO public;

-- Add tsvector column
ALTER TABLE audit_logs
ADD COLUMN search_vector tsvector;

-- Create GIN index
-- Development: Use regular CREATE INDEX
-- Production: Use CREATE INDEX CONCURRENTLY to avoid table locks
CREATE INDEX audit_logs_search_idx
ON audit_logs USING GIN(search_vector);

-- Create trigger function
-- This function combines searchable columns and applies unaccent for Vietnamese support
CREATE OR REPLACE FUNCTION update_search_vector_audit_logs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Combine searchable columns and apply unaccent
    -- Convert JSONB columns to text for full-text indexing
    NEW.search_vector := to_tsvector(
        'simple',
        unaccent(
            COALESCE(NEW.operation, '') || ' ' ||
            COALESCE(NEW.table_name, '') || ' ' ||
            COALESCE(NEW.old_values::text, '') || ' ' ||
            COALESCE(NEW.new_values::text, '')
        )
    );
    RETURN NEW;
END;
$$;

-- Create trigger
-- NOTE: Only trigger on relevant column changes to reduce overhead
CREATE TRIGGER audit_logs_search_update
BEFORE INSERT OR UPDATE OF operation, table_name, old_values, new_values ON audit_logs
FOR EACH ROW EXECUTE FUNCTION update_search_vector_audit_logs();

-- Backfill existing data
UPDATE audit_logs SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(operation, '') || ' ' ||
        COALESCE(table_name, '') || ' ' ||
        COALESCE(old_values::text, '') || ' ' ||
        COALESCE(new_values::text, '')
    )
);

-- Verify backfill (audit log count)
SELECT COUNT(*) as backfilled_audit_logs FROM audit_logs WHERE search_vector IS NOT NULL;
