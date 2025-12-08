-- Migration 036: Refresh PostgREST schema cache
-- Description: Forces PostgREST to reload the schema cache to recognize new foreign keys

-- Send NOTIFY to all PostgREST instances to reload their schema cache
NOTIFY pgrst, 'reload schema';

-- Alternative: Update a dummy table that PostgREST watches
-- This ensures the cache is refreshed even if NOTIFY doesn't work
COMMENT ON SCHEMA public IS 'Schema cache refresh ' || NOW()::text;
