-- Migration 074: Add full-text search to audit_logs (PRODUCTION VERSION)
-- Description: Adds tsvector column, GIN index with CONCURRENTLY, and automatic trigger for Vietnamese diacritic-insensitive search
-- Note: audit_logs table does NOT need to exclude search_vector from its own audit (no recursion)
--
-- **IMPORTANT**: This version uses CREATE INDEX CONCURRENTLY for zero-downtime deployment
-- - CONCURRENTLY allows reads/writes during index creation
-- - Takes longer than regular CREATE INDEX but prevents table locks
-- - Use this version for staging/production with active users
-- - For development, use the regular version (074_add_search_to_audit_logs.sql)

SET search_path TO public;

-- Add tsvector column
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index CONCURRENTLY
-- This can be run on a live production database without blocking reads/writes
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
-- Must be run separately from other statements
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_search_idx
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
DROP TRIGGER IF EXISTS audit_logs_search_update ON audit_logs;
CREATE TRIGGER audit_logs_search_update
BEFORE INSERT OR UPDATE OF operation, table_name, old_values, new_values ON audit_logs
FOR EACH ROW EXECUTE FUNCTION update_search_vector_audit_logs();

-- Backfill existing data
-- CRITICAL: audit_logs is typically the largest table in the system
-- WHERE clause ensures idempotency: only processes unindexed rows
-- For very large tables (>100k rows), consider batching this operation
-- Safe to re-run if migration is interrupted
UPDATE audit_logs SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(operation, '') || ' ' ||
        COALESCE(table_name, '') || ' ' ||
        COALESCE(old_values::text, '') || ' ' ||
        COALESCE(new_values::text, '')
    )
)
WHERE search_vector IS NULL;

-- Verify backfill (audit log count)
SELECT COUNT(*) as backfilled_audit_logs FROM audit_logs WHERE search_vector IS NOT NULL;
