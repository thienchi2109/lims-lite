-- Migration 071: Add full-text search to clients (PRODUCTION VERSION)
-- Description: Adds tsvector column, GIN index with CONCURRENTLY, and automatic trigger for Vietnamese diacritic-insensitive search
--
-- **IMPORTANT**: This version uses CREATE INDEX CONCURRENTLY for zero-downtime deployment
-- - CONCURRENTLY allows reads/writes during index creation
-- - Takes longer than regular CREATE INDEX but prevents table locks
-- - Use this version for staging/production with active users
-- - For development, use the regular version (071_add_search_to_clients.sql)

SET search_path TO public;

-- Add tsvector column
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index CONCURRENTLY
-- This can be run on a live production database without blocking reads/writes
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
-- Must be run separately from other statements
CREATE INDEX CONCURRENTLY IF NOT EXISTS clients_search_idx
ON clients USING GIN(search_vector);

-- Create trigger function (reusable for all tables)
-- This function combines searchable columns and applies unaccent for Vietnamese support
CREATE OR REPLACE FUNCTION update_search_vector_clients()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Combine searchable columns and apply unaccent
    NEW.search_vector := to_tsvector(
        'simple',
        unaccent(
            COALESCE(NEW.name, '') || ' ' ||
            COALESCE(NEW.phone, '') || ' ' ||
            COALESCE(NEW.address, '') || ' ' ||
            COALESCE(NEW.id_card_num, '') || ' ' ||
            COALESCE(NEW.health_insurance_num, '')
        )
    );
    RETURN NEW;
END;
$$;

-- Create trigger
-- NOTE: Only trigger on relevant column changes to reduce overhead
DROP TRIGGER IF EXISTS clients_search_update ON clients;
CREATE TRIGGER clients_search_update
BEFORE INSERT OR UPDATE OF name, phone, address, id_card_num, health_insurance_num ON clients
FOR EACH ROW EXECUTE FUNCTION update_search_vector_clients();

-- Backfill existing data
-- WHERE clause ensures idempotency: only processes unindexed rows
-- Safe to re-run if migration is interrupted
UPDATE clients SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(name, '') || ' ' ||
        COALESCE(phone, '') || ' ' ||
        COALESCE(address, '') || ' ' ||
        COALESCE(id_card_num, '') || ' ' ||
        COALESCE(health_insurance_num, '')
    )
)
WHERE search_vector IS NULL;

-- Verify backfill (client count)
SELECT COUNT(*) as backfilled_clients FROM clients WHERE search_vector IS NOT NULL;
